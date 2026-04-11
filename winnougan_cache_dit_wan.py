from __future__ import annotations

import logging
import time
import traceback
from typing import Any, Dict, Optional

import torch
import comfy.model_patcher
import comfy.patcher_extension

logger = logging.getLogger("Winnougan-CacheDiT-Wan")

NODE_NAME = "Winnougan Cache DiT Wan"

# ── Per-transformer cache registry ────────────────────────────────────────────
# Keyed by id(transformer) so High-Noise and Low-Noise experts never share state

_wan_registry: Dict[int, Dict[str, Any]] = {}


def _get_state(transformer_id: int) -> Dict[str, Any]:
    if transformer_id not in _wan_registry:
        _wan_registry[transformer_id] = {
            "enabled":       False,
            "call_count":    0,
            "skip_count":    0,
            "compute_count": 0,
            "last_result":   None,
            "compute_times": [],
            "config":        None,
        }
    return _wan_registry[transformer_id]


# ── Config ────────────────────────────────────────────────────────────────────

class WanCacheConfig:
    def __init__(
        self,
        warmup_steps:  int  = 4,
        skip_interval: int  = 2,
        print_summary: bool = True,
        verbose:       bool = False,
    ):
        self.warmup_steps  = warmup_steps
        self.skip_interval = skip_interval
        self.print_summary = print_summary
        self.verbose       = verbose

        self.is_enabled:          bool         = False
        self.num_inference_steps: Optional[int] = None

    def clone(self) -> "WanCacheConfig":
        c = WanCacheConfig(
            warmup_steps  = self.warmup_steps,
            skip_interval = self.skip_interval,
            print_summary = self.print_summary,
            verbose       = self.verbose,
        )
        c.is_enabled          = self.is_enabled
        c.num_inference_steps = self.num_inference_steps
        return c

    def reset(self):
        pass  # stateless — runtime lives in the registry


# ── Transformer patching ──────────────────────────────────────────────────────

def _cleanup_transformer(transformer):
    if hasattr(transformer, "_winnougan_wan_original_forward"):
        try:
            transformer.forward = transformer._winnougan_wan_original_forward
            delattr(transformer, "_winnougan_wan_original_forward")
            logger.info(f"[Winnougan-Wan] Restored forward on transformer {id(transformer)}")
        except Exception as e:
            logger.warning(f"[Winnougan-Wan] Cleanup warning: {e}")


def _enable_wan_cache(transformer, config: WanCacheConfig):
    tid = id(transformer)
    _cleanup_transformer(transformer)
    transformer._winnougan_wan_original_forward = transformer.forward

    state = _get_state(tid)
    state.update({
        "enabled":       True,
        "call_count":    0,
        "skip_count":    0,
        "compute_count": 0,
        "last_result":   None,
        "compute_times": [],
        "config":        config,
    })

    def cached_forward(*args, **kwargs):
        s   = _get_state(tid)
        s["call_count"] += 1
        n   = s["call_count"]
        cfg = s["config"]
        ws  = cfg.warmup_steps  if cfg else 4
        si  = cfg.skip_interval if cfg else 2

        def _compute():
            t0 = time.time()
            result = transformer._winnougan_wan_original_forward(*args, **kwargs)
            s["compute_times"].append(time.time() - t0)
            s["compute_count"] += 1
            # Cache with detach only — no clone, memory-efficient
            if isinstance(result, torch.Tensor):
                s["last_result"] = result.detach()
            elif isinstance(result, tuple):
                s["last_result"] = tuple(
                    r.detach() if isinstance(r, torch.Tensor) else r for r in result
                )
            else:
                s["last_result"] = result
            return result

        def _use_cache():
            s["skip_count"] += 1
            return s["last_result"]

        # Warmup — always compute
        if n <= ws:
            return _compute()

        # Post-warmup — skip every si-th step
        cache_valid    = s["last_result"] is not None
        steps_post     = n - ws
        should_compute = (steps_post % si == 0) or not cache_valid

        return _compute() if should_compute else _use_cache()

    transformer.forward = cached_forward
    logger.info(
        f"[Winnougan-Wan] Cache enabled on transformer {tid} — "
        f"warmup={config.warmup_steps}, skip={config.skip_interval}"
    )


def _refresh_wan_cache(transformer, config: WanCacheConfig):
    """Reset per-run counters without re-patching the forward method."""
    tid   = id(transformer)
    state = _get_state(tid)
    state.update({
        "call_count":    0,
        "skip_count":    0,
        "compute_count": 0,
        "last_result":   None,
        "compute_times": [],
        "config":        config,
    })
    logger.info(
        f"[Winnougan-Wan] Cache refreshed for transformer {tid} — "
        f"{config.num_inference_steps} steps"
    )


def _get_stats(transformer_id: int) -> Optional[Dict[str, Any]]:
    if transformer_id not in _wan_registry:
        return None
    s = _wan_registry[transformer_id]
    if not s["enabled"] or s["call_count"] == 0:
        return None
    total    = s["call_count"]
    computed = s["compute_count"]
    cached   = s["skip_count"]
    avg_ms   = sum(s["compute_times"]) / max(len(s["compute_times"]), 1) * 1000
    return {
        "total":    total,
        "computed": computed,
        "cached":   cached,
        "hit_rate": cached / total * 100,
        "speedup":  total / max(computed, 1),
        "avg_ms":   avg_ms,
    }


# ── Sampling wrapper ──────────────────────────────────────────────────────────

def _outer_sample_wrapper(executor, *args, **kwargs):
    guider             = executor.class_obj
    orig_model_options = guider.model_options

    try:
        guider.model_options = comfy.model_patcher.create_model_options_clone(orig_model_options)

        config: WanCacheConfig = guider.model_options.get(
            "transformer_options", {}
        ).get("winnougan_wan_cache")

        if config is None:
            return executor(*args, **kwargs)

        config = config.clone()
        config.reset()
        guider.model_options["transformer_options"]["winnougan_wan_cache"] = config

        # Detect step count from sigmas
        sigmas = args[3] if len(args) > 3 else kwargs.get("sigmas")
        if sigmas is not None:
            config.num_inference_steps = len(sigmas) - 1

        # Get transformer
        transformer = None
        mp = guider.model_patcher
        if hasattr(mp, "model") and hasattr(mp.model, "diffusion_model"):
            transformer = mp.model.diffusion_model

        if transformer is None:
            return executor(*args, **kwargs)

        already_patched = hasattr(transformer, "_winnougan_wan_original_forward")

        if not already_patched:
            _enable_wan_cache(transformer, config)
        else:
            _refresh_wan_cache(transformer, config)

        config.is_enabled = True

        result = executor(*args, **kwargs)

        if config.print_summary:
            stats = _get_stats(id(transformer))
            if stats:
                logger.info(
                    f"\n[Winnougan-Wan] ── Run Summary ──────────────────────\n"
                    f"  Total fwd calls  : {stats['total']}\n"
                    f"  Computed         : {stats['computed']}\n"
                    f"  Cached (skipped) : {stats['cached']}\n"
                    f"  Cache hit rate   : {stats['hit_rate']:.1f}%\n"
                    f"  Est. speedup     : {stats['speedup']:.2f}x\n"
                    f"  Avg compute      : {stats['avg_ms']:.1f} ms/call\n"
                    f"──────────────────────────────────────────────────────"
                )

        return result

    except Exception as e:
        logger.error(f"[Winnougan-Wan] Wrapper error: {e}")
        traceback.print_exc()
        return executor(*args, **kwargs)
    finally:
        try:
            guider.model_options = orig_model_options
        except Exception:
            pass


# ── Main node ─────────────────────────────────────────────────────────────────

class WinnouganCacheDiTWan:

    NAME     = NODE_NAME
    CATEGORY = "Winnougan"

    # Presets — (warmup_steps, skip_interval)
    PRESETS = {
        "Balanced ⭐": (4, 2),
        "Speed ⚡":    (3, 2),
        "Quality ✦":   (6, 3),
        "Custom":      (None, None),
    }

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "model": ("MODEL",),
                "enable": ("BOOLEAN", {
                    "default": True,
                    "tooltip": "Toggle Wan2.2 cache acceleration on or off.",
                }),
                "preset": (list(cls.PRESETS.keys()), {
                    "default": "Balanced ⭐",
                    "tooltip": (
                        "Balanced: warmup=4 skip=2 — good default for most workflows.\n"
                        "Speed:    warmup=3 skip=2 — slightly more aggressive.\n"
                        "Quality:  warmup=6 skip=3 — conservative, best quality.\n"
                        "Custom:   use warmup_steps and skip_interval manually."
                    ),
                }),
                "warmup_steps": ("INT", {
                    "default": 4, "min": 1, "max": 20, "step": 1,
                    "tooltip": (
                        "Steps always computed before caching begins. "
                        "Only active in Custom mode."
                    ),
                }),
                "skip_interval": ("INT", {
                    "default": 2, "min": 2, "max": 10, "step": 1,
                    "tooltip": (
                        "Reuse cached result every N steps after warmup. "
                        "Only active in Custom mode."
                    ),
                }),
                "print_summary": ("BOOLEAN", {
                    "default": True,
                    "tooltip": "Print hit rate and speedup after each generation.",
                }),
            }
        }

    RETURN_TYPES  = ("MODEL",)
    RETURN_NAMES  = ("model",)
    FUNCTION      = "apply"

    def apply(
        self,
        model,
        enable:        bool = True,
        preset:        str  = "Balanced ⭐",
        warmup_steps:  int  = 4,
        skip_interval: int  = 2,
        print_summary: bool = True,
    ):
        if not enable:
            return self._disable(model)

        # Resolve preset
        pw, ps = self.PRESETS.get(preset, (None, None))
        if pw is not None:
            warmup_steps  = pw
            skip_interval = ps

        # Check for unchanged config — avoids unnecessary re-patching
        if hasattr(model.model, "diffusion_model"):
            existing = getattr(model.model.diffusion_model, "_winnougan_wan_config", None)
            if existing:
                if (
                    existing["warmup_steps"]  == warmup_steps  and
                    existing["skip_interval"] == skip_interval and
                    existing["print_summary"] == print_summary
                ):
                    logger.info("[Winnougan-Wan] Configuration unchanged, skipping re-patch.")
                    return (model,)
                else:
                    result = self._disable(model)
                    model  = result[0]

        model = model.clone()

        config = WanCacheConfig(
            warmup_steps  = warmup_steps,
            skip_interval = skip_interval,
            print_summary = print_summary,
        )

        model.model_options.setdefault("transformer_options", {})
        model.model_options["transformer_options"]["winnougan_wan_cache"] = config

        # Persist config fingerprint on transformer for change-detection
        if hasattr(model.model, "diffusion_model"):
            model.model.diffusion_model._winnougan_wan_config = {
                "warmup_steps":  warmup_steps,
                "skip_interval": skip_interval,
                "print_summary": print_summary,
            }

        model.add_wrapper_with_key(
            comfy.patcher_extension.WrappersMP.OUTER_SAMPLE,
            "winnougan_wan_cache",
            _outer_sample_wrapper,
        )

        logger.info(
            f"[Winnougan-Wan] Configured — preset={preset}, "
            f"warmup={warmup_steps}, skip={skip_interval}"
        )

        return (model,)

    def _disable(self, model):
        model = model.clone()

        to = model.model_options.get("transformer_options", {})
        to.pop("winnougan_wan_cache", None)

        wrappers = model.wrappers.get(
            comfy.patcher_extension.WrappersMP.OUTER_SAMPLE, {}
        )
        wrappers.pop("winnougan_wan_cache", None)

        if hasattr(model.model, "diffusion_model"):
            transformer = model.model.diffusion_model
            _cleanup_transformer(transformer)

            tid = id(transformer)
            _wan_registry.pop(tid, None)

            if hasattr(transformer, "_winnougan_wan_config"):
                delattr(transformer, "_winnougan_wan_config")

        logger.info("[Winnougan-Wan] Disabled and cleaned up.")
        return (model,)


# ── Registration ──────────────────────────────────────────────────────────────

NODE_CLASS_MAPPINGS = {
    "WinnouganCacheDiTWan": WinnouganCacheDiTWan,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WinnouganCacheDiTWan": "Winnougan Cache DiT Wan",
}
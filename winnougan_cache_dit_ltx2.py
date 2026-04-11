from __future__ import annotations

import logging
import time
import traceback
from typing import Optional

import torch
import comfy.model_patcher
import comfy.patcher_extension

logger = logging.getLogger("Winnougan-CacheDiT-LTX2")

NODE_NAME = "Winnougan Cache DiT LTX2"

# ── Cache state ───────────────────────────────────────────────────────────────

_ltx2_cache_state = {
    "enabled":          False,
    "transformer_id":   None,
    "call_count":       0,
    "skip_count":       0,
    "compute_count":    0,
    "last_result":      None,
    "compute_times":    [],
    "config":           None,
    "current_timestep": None,
    "timestep_count":   0,
    "last_input_shape": None,
    "calls_per_step":   None,
    "last_timestep_call": 0,
    "i2v_mode":         False,
}


class LTX2CacheConfig:
    def __init__(
        self,
        warmup_steps:  int   = 10,
        skip_interval: int   = 5,
        noise_scale:   float = 0.001,
        print_summary: bool  = True,
        verbose:       bool  = False,
    ):
        self.warmup_steps  = warmup_steps
        self.skip_interval = skip_interval
        self.noise_scale   = noise_scale
        self.print_summary = print_summary
        self.verbose       = verbose

        self.is_enabled          = False
        self.num_inference_steps: Optional[int] = None
        self.current_step:        int = 0

    def clone(self) -> "LTX2CacheConfig":
        c = LTX2CacheConfig(
            warmup_steps  = self.warmup_steps,
            skip_interval = self.skip_interval,
            noise_scale   = self.noise_scale,
            print_summary = self.print_summary,
            verbose       = self.verbose,
        )
        c.is_enabled          = self.is_enabled
        c.num_inference_steps = self.num_inference_steps
        return c

    def reset(self):
        self.current_step = 0


# ── Transformer patching ──────────────────────────────────────────────────────

def _cleanup_transformer(transformer):
    if hasattr(transformer, "_winnougan_ltx2_original_forward"):
        try:
            transformer.forward = transformer._winnougan_ltx2_original_forward
            delattr(transformer, "_winnougan_ltx2_original_forward")
            logger.info(f"[Winnougan-LTX2] Restored original forward on {id(transformer)}")
        except Exception as e:
            logger.warning(f"[Winnougan-LTX2] Cleanup failed: {e}")


def _extract_timestep_value(timestep):
    """Safely extract a float scalar from various timestep formats."""
    try:
        if isinstance(timestep, (tuple, list)):
            if len(timestep) == 0:
                return None
            ts = timestep[0]
            if isinstance(ts, torch.Tensor):
                flat = ts.flatten()
                nonzero = flat[flat > 0.001]
                return float(nonzero.max().item()) if nonzero.numel() > 0 else float(flat[0].item())
            return float(ts)
        if isinstance(timestep, torch.Tensor):
            flat = timestep.flatten()
            nonzero = flat[flat > 0.001]
            return float(nonzero.max().item()) if nonzero.numel() > 0 else float(flat[0].item())
        return float(timestep)
    except Exception:
        return None


def _enable_ltx2_cache(transformer, config: LTX2CacheConfig):
    global _ltx2_cache_state

    _cleanup_transformer(transformer)
    transformer._winnougan_ltx2_original_forward = transformer.forward

    _ltx2_cache_state.clear()
    _ltx2_cache_state.update({
        "enabled":            True,
        "transformer_id":     id(transformer),
        "call_count":         0,
        "skip_count":         0,
        "compute_count":      0,
        "last_result":        None,
        "compute_times":      [],
        "config":             config,
        "current_timestep":   None,
        "timestep_count":     0,
        "last_input_shape":   None,
        "calls_per_step":     None,
        "last_timestep_call": 0,
        "i2v_mode":           False,
    })

    def cached_forward(*args, **kwargs):
        state = _ltx2_cache_state
        state["call_count"] += 1
        cfg = state["config"]
        ws  = cfg.warmup_steps  if cfg else 10
        si  = cfg.skip_interval if cfg else 5
        ns  = cfg.noise_scale   if cfg else 0.001

        # ── Input shape change detection ──────────────────────────────────────
        current_shape = None
        if args:
            x = args[0]
            if isinstance(x, torch.Tensor):
                current_shape = tuple(x.shape)
            elif isinstance(x, (tuple, list)) and x and isinstance(x[0], torch.Tensor):
                current_shape = tuple(x[0].shape)

        if current_shape and state["last_input_shape"] and current_shape != state["last_input_shape"]:
            state.update({
                "last_result": None, "current_timestep": None,
                "timestep_count": 0, "call_count": 1,
                "skip_count": 0, "compute_count": 0, "compute_times": [],
            })
        state["last_input_shape"] = current_shape

        # ── Timestep tracking ─────────────────────────────────────────────────
        raw_ts = args[1] if len(args) >= 2 else kwargs.get("timestep", kwargs.get("v_timestep"))
        current_ts = _extract_timestep_value(raw_ts)

        prev_ts = state["current_timestep"]
        if current_ts is not None and current_ts != prev_ts:
            state["current_timestep"] = current_ts
            state["timestep_count"]  += 1

            if state["timestep_count"] == 1 and abs(current_ts) < 0.001:
                state["i2v_mode"] = True

            if state["timestep_count"] == 2:
                state["calls_per_step"] = state["call_count"] - state["last_timestep_call"]

            state["last_timestep_call"] = state["call_count"]
            timestep_id = state["timestep_count"]
        else:
            cps = state.get("calls_per_step")
            if cps and cps > 0:
                timestep_id = max((state["call_count"] - 1) // cps + 1, state["timestep_count"])
            else:
                timestep_id = state["timestep_count"]

        # ── Helper: run and cache ─────────────────────────────────────────────
        def _compute():
            t0 = time.time()
            result = transformer._winnougan_ltx2_original_forward(*args, **kwargs)
            state["compute_times"].append(time.time() - t0)
            state["compute_count"] += 1
            if isinstance(result, tuple):
                state["last_result"] = tuple(
                    r.detach() if isinstance(r, torch.Tensor) else r for r in result
                )
            elif isinstance(result, torch.Tensor):
                state["last_result"] = result.detach()
            else:
                state["last_result"] = result
            return result

        def _use_cache():
            state["skip_count"] += 1
            cached = state["last_result"]
            if ns > 0 and isinstance(cached, tuple):
                cached = tuple(
                    (r + torch.randn_like(r) * ns) if isinstance(r, torch.Tensor) else r
                    for r in cached
                )
            elif ns > 0 and isinstance(cached, torch.Tensor):
                cached = cached + torch.randn_like(cached) * ns
            return cached

        cache_valid = state["last_result"] is not None

        # ── I2V mode ──────────────────────────────────────────────────────────
        if state["i2v_mode"]:
            if state["call_count"] <= ws:
                return _compute()
            calls_post = state["call_count"] - ws
            should_skip = (calls_post % si != 0) or not cache_valid
            return _use_cache() if (not should_skip) else _compute()

        # ── T2V mode ──────────────────────────────────────────────────────────
        if timestep_id <= ws:
            return _compute()

        steps_post   = timestep_id - ws
        should_compute = (steps_post == 1) or ((steps_post - 1) % si == 0) or not cache_valid
        return _compute() if should_compute else _use_cache()

    transformer.forward = cached_forward
    logger.info(
        f"[Winnougan-LTX2] Cache enabled — "
        f"warmup={config.warmup_steps}, skip={config.skip_interval}, noise={config.noise_scale:.4f}"
    )


def _refresh_ltx2_cache(transformer, config: LTX2CacheConfig):
    global _ltx2_cache_state
    _ltx2_cache_state.update({
        "call_count": 0, "skip_count": 0, "compute_count": 0,
        "last_result": None, "compute_times": [],
        "config": config, "transformer_id": id(transformer),
        "current_timestep": None, "timestep_count": 0,
        "last_input_shape": None, "calls_per_step": None,
        "last_timestep_call": 0, "i2v_mode": False,
    })
    logger.info(f"[Winnougan-LTX2] Cache refreshed for {config.num_inference_steps} steps")


def _get_stats():
    s = _ltx2_cache_state
    if not s["enabled"] or s["call_count"] == 0:
        return None
    total     = s["call_count"]
    computed  = s["compute_count"]
    cached    = s["skip_count"]
    avg_ms    = sum(s["compute_times"]) / max(len(s["compute_times"]), 1) * 1000
    return {
        "steps":    s["timestep_count"],
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

        config: LTX2CacheConfig = guider.model_options.get(
            "transformer_options", {}
        ).get("winnougan_ltx2_cache")

        if config is None:
            return executor(*args, **kwargs)

        config = config.clone()
        config.reset()
        guider.model_options["transformer_options"]["winnougan_ltx2_cache"] = config

        # Detect step count
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

        already_enabled = (
            hasattr(transformer, "_winnougan_ltx2_original_forward")
            or _ltx2_cache_state.get("enabled")
        )

        if not already_enabled:
            _enable_ltx2_cache(transformer, config)
        else:
            _refresh_ltx2_cache(transformer, config)

        config.is_enabled = True

        result = executor(*args, **kwargs)

        if config.print_summary:
            stats = _get_stats()
            if stats:
                logger.info(
                    f"\n[Winnougan-LTX2] ── Run Summary ──────────────────────\n"
                    f"  Denoising steps  : {stats['steps']}\n"
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
        logger.error(f"[Winnougan-LTX2] Wrapper error: {e}")
        traceback.print_exc()
        return executor(*args, **kwargs)
    finally:
        try:
            guider.model_options = orig_model_options
        except Exception:
            pass


# ── Main node ─────────────────────────────────────────────────────────────────

class WinnouganCacheDiTLTX2:

    NAME     = NODE_NAME
    CATEGORY = "Winnougan"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "model": ("MODEL",),
                "enable": ("BOOLEAN", {
                    "default": True,
                    "tooltip": "Toggle LTX-2 cache acceleration on or off.",
                }),
                "preset": (["Balanced ⭐", "Speed ⚡", "Quality ✦", "Custom"], {
                    "default": "Balanced ⭐",
                    "tooltip": (
                        "Balanced: warmup=10 skip=5 — good quality/speed trade-off.\n"
                        "Speed:    warmup=6  skip=4 — ~2x faster, slight quality loss.\n"
                        "Quality:  warmup=12 skip=7 — conservative, best quality.\n"
                        "Custom:   use warmup_steps and skip_interval below."
                    ),
                }),
                "warmup_steps": ("INT", {
                    "default": 10, "min": 3, "max": 30, "step": 1,
                    "tooltip": "Steps to always compute before caching begins. Only used in Custom mode.",
                }),
                "skip_interval": ("INT", {
                    "default": 5, "min": 2, "max": 15, "step": 1,
                    "tooltip": "Reuse cached output every N steps. Only used in Custom mode.",
                }),
                "noise_scale": ("FLOAT", {
                    "default": 0.001, "min": 0.0, "max": 0.01, "step": 0.0001,
                    "tooltip": (
                        "Tiny noise added to cached outputs for temporal consistency. "
                        "0.001 is recommended for video."
                    ),
                }),
                "print_summary": ("BOOLEAN", {
                    "default": True,
                    "tooltip": "Print cache hit rate and speedup after each generation.",
                }),
            }
        }

    RETURN_TYPES  = ("MODEL",)
    RETURN_NAMES  = ("model",)
    FUNCTION      = "apply"

    # Preset definitions
    PRESETS = {
        "Balanced ⭐": (10, 5),
        "Speed ⚡":    (6,  4),
        "Quality ✦":   (12, 7),
    }

    def apply(
        self,
        model,
        enable:        bool  = True,
        preset:        str   = "Balanced ⭐",
        warmup_steps:  int   = 10,
        skip_interval: int   = 5,
        noise_scale:   float = 0.001,
        print_summary: bool  = True,
    ):
        if not enable:
            return self._disable(model)

        # Validate model is LTX-2
        if hasattr(model.model, "diffusion_model"):
            cls_name = model.model.diffusion_model.__class__.__name__
            if cls_name != "LTXAVModel":
                logger.warning(
                    f"[Winnougan-LTX2] Expected LTXAVModel, got {cls_name}. "
                    "Node will still attach but may not accelerate correctly."
                )

        # Resolve preset
        if preset in self.PRESETS:
            warmup_steps, skip_interval = self.PRESETS[preset]

        model = model.clone()

        config = LTX2CacheConfig(
            warmup_steps  = warmup_steps,
            skip_interval = skip_interval,
            noise_scale   = noise_scale,
            print_summary = print_summary,
        )

        if "transformer_options" not in model.model_options:
            model.model_options["transformer_options"] = {}

        model.model_options["transformer_options"]["winnougan_ltx2_cache"] = config

        model.add_wrapper_with_key(
            comfy.patcher_extension.WrappersMP.OUTER_SAMPLE,
            "winnougan_ltx2_cache",
            _outer_sample_wrapper,
        )

        logger.info(
            f"[Winnougan-LTX2] Configured — preset={preset}, "
            f"warmup={warmup_steps}, skip={skip_interval}, noise={noise_scale:.4f}"
        )

        return (model,)

    def _disable(self, model):
        model = model.clone()

        to = model.model_options.get("transformer_options", {})
        to.pop("winnougan_ltx2_cache", None)

        wrappers = model.wrappers.get(comfy.patcher_extension.WrappersMP.OUTER_SAMPLE, {})
        wrappers.pop("winnougan_ltx2_cache", None)

        if hasattr(model.model, "diffusion_model"):
            _cleanup_transformer(model.model.diffusion_model)

        global _ltx2_cache_state
        _ltx2_cache_state.update({
            "enabled": False, "transformer_id": None,
            "call_count": 0, "skip_count": 0, "compute_count": 0,
            "last_result": None, "compute_times": [],
        })

        logger.info("[Winnougan-LTX2] Disabled and cleaned up.")
        return (model,)


# ── Registration ──────────────────────────────────────────────────────────────

NODE_CLASS_MAPPINGS = {
    "WinnouganCacheDiTLTX2": WinnouganCacheDiTLTX2,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WinnouganCacheDiTLTX2": "Winnougan Cache DiT LTX2",
}
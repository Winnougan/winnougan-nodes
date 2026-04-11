from __future__ import annotations

import logging
import time
from typing import Optional

import torch
import comfy.model_patcher
import comfy.patcher_extension

logger = logging.getLogger("Winnougan-CacheDiT")

NODE_NAME = "Winnougan Cache DiT"

# ── Lightweight cache state ───────────────────────────────────────────────────

_cache_state = {
    "enabled": False,
    "transformer_id": None,
    "call_count": 0,
    "skip_count": 0,
    "compute_count": 0,
    "last_result": None,
    "compute_times": [],
    "warmup_steps": 3,
    "skip_interval": 2,
    "noise_scale": 0.0,
}


def _cleanup_transformer(transformer):
    """Restore original forward method on transformer."""
    if hasattr(transformer, "_winnougan_original_forward"):
        try:
            transformer.forward = transformer._winnougan_original_forward
            delattr(transformer, "_winnougan_original_forward")
            logger.info(f"[Winnougan-CacheDiT] Restored original forward on transformer {id(transformer)}")
        except Exception as e:
            logger.warning(f"[Winnougan-CacheDiT] Cleanup failed: {e}")


def _detect_model_defaults(transformer):
    """
    Auto-detect model class and return sensible caching defaults.
    Returns (warmup_steps, skip_interval, noise_scale, display_name)
    """
    class_name = transformer.__class__.__name__

    if "NextDiT" in class_name:
        # Z-Image Turbo — quality-sensitive, heavier warmup
        return 8, 3, 0.0, "Z-Image Turbo (NextDiT)"

    elif "Qwen" in class_name:
        # Qwen-Image — moderate caching
        return 3, 2, 0.0, "Qwen-Image"

    elif "Flux" in class_name or "FLUX" in class_name:
        # Flux / Flux 2 — well tested, light caching
        return 3, 2, 0.0, "Flux / Flux 2"

    elif "LTX" in class_name or "Ltx" in class_name:
        # LTX Video — video models need conservative caching
        return 4, 3, 0.01, "LTX Video"

    elif "Wan" in class_name:
        # Wan Video
        return 4, 3, 0.01, "Wan Video"

    else:
        # Unknown — safe conservative defaults
        return 3, 3, 0.0, f"Unknown ({class_name})"


def _enable_cache(transformer, warmup_steps, skip_interval, noise_scale):
    """Replace transformer.forward with a caching wrapper."""
    global _cache_state

    _cleanup_transformer(transformer)

    transformer._winnougan_original_forward = transformer.forward

    _cache_state.clear()
    _cache_state.update({
        "enabled": True,
        "transformer_id": id(transformer),
        "call_count": 0,
        "skip_count": 0,
        "compute_count": 0,
        "last_result": None,
        "compute_times": [],
        "warmup_steps": warmup_steps,
        "skip_interval": skip_interval,
        "noise_scale": noise_scale,
    })

    def cached_forward(*args, **kwargs):
        state = _cache_state
        state["call_count"] += 1
        call_id = state["call_count"]
        ws = state["warmup_steps"]
        si = state["skip_interval"]
        ns = state["noise_scale"]

        def _run_and_store():
            t0 = time.time()
            result = transformer._winnougan_original_forward(*args, **kwargs)
            state["compute_times"].append(time.time() - t0)
            state["compute_count"] += 1
            if isinstance(result, torch.Tensor):
                state["last_result"] = result.detach()
            elif isinstance(result, tuple):
                state["last_result"] = tuple(
                    r.detach() if isinstance(r, torch.Tensor) else r for r in result
                )
            else:
                state["last_result"] = result
            return result

        # Always compute during warmup
        if call_id <= ws:
            return _run_and_store()

        # After warmup: skip every si-th step
        steps_post_warmup = call_id - ws
        should_skip = (steps_post_warmup % si == 0) and state["last_result"] is not None

        if should_skip:
            state["skip_count"] += 1
            cached = state["last_result"]
            if ns > 0:
                if isinstance(cached, torch.Tensor):
                    cached = cached + torch.randn_like(cached) * ns
                elif isinstance(cached, tuple):
                    cached = tuple(
                        (r + torch.randn_like(r) * ns) if isinstance(r, torch.Tensor) else r
                        for r in cached
                    )
            return cached
        else:
            return _run_and_store()

    transformer.forward = cached_forward
    logger.info(
        f"[Winnougan-CacheDiT] Cache enabled — "
        f"warmup={warmup_steps}, skip_interval={skip_interval}, noise={noise_scale}"
    )


def _reset_cache_counters(transformer_id):
    """Reset per-run counters while keeping settings."""
    _cache_state["call_count"] = 0
    _cache_state["skip_count"] = 0
    _cache_state["compute_count"] = 0
    _cache_state["last_result"] = None
    _cache_state["compute_times"] = []
    _cache_state["transformer_id"] = transformer_id


def _get_stats():
    """Return a summary dict of the last run, or None if no data."""
    s = _cache_state
    if not s["enabled"] or s["call_count"] == 0:
        return None
    total    = s["call_count"]
    cached   = s["skip_count"]
    computed = s["compute_count"]
    avg_t    = sum(s["compute_times"]) / max(len(s["compute_times"]), 1)
    return {
        "total":     total,
        "computed":  computed,
        "cached":    cached,
        "hit_rate":  cached / total * 100,
        "speedup":   total / max(computed, 1),
        "avg_ms":    avg_t * 1000,
    }


# ── ComfyUI sampling wrappers ─────────────────────────────────────────────────

def _outer_sample_wrapper(executor, *args, **kwargs):
    """
    Runs once per generation. Detects step count from sigmas,
    enables/resets the cache, runs sampling, then prints stats.
    """
    guider = executor.class_obj
    orig_model_options = guider.model_options

    try:
        guider.model_options = comfy.model_patcher.create_model_options_clone(orig_model_options)

        cfg = guider.model_options.get("transformer_options", {}).get("winnougan_cache_dit")
        if cfg is None:
            return executor(*args, **kwargs)

        # Detect step count from sigmas
        sigmas = args[3] if len(args) > 3 else kwargs.get("sigmas")
        num_steps = (len(sigmas) - 1) if sigmas is not None else cfg["warmup_steps"] * 4

        # Get transformer
        model_patcher = guider.model_patcher
        transformer = None
        if hasattr(model_patcher, "model") and hasattr(model_patcher.model, "diffusion_model"):
            transformer = model_patcher.model.diffusion_model

        if transformer is None:
            return executor(*args, **kwargs)

        current_id = id(transformer)
        transformer_changed = _cache_state.get("transformer_id") != current_id

        if not _cache_state["enabled"] or transformer_changed:
            _enable_cache(
                transformer,
                warmup_steps  = cfg["warmup_steps"],
                skip_interval = cfg["skip_interval"],
                noise_scale   = cfg["noise_scale"],
            )
        else:
            _reset_cache_counters(current_id)

        logger.info(
            f"[Winnougan-CacheDiT] Starting generation — "
            f"steps={num_steps}, warmup={cfg['warmup_steps']}, "
            f"skip_interval={cfg['skip_interval']}"
        )

        result = executor(*args, **kwargs)

        # Print summary
        if cfg.get("print_summary"):
            stats = _get_stats()
            if stats:
                logger.info(
                    f"\n[Winnougan-CacheDiT] ── Run Summary ──────────────────\n"
                    f"  Total steps   : {stats['total']}\n"
                    f"  Computed      : {stats['computed']}\n"
                    f"  Cached (skipped): {stats['cached']}\n"
                    f"  Cache hit rate: {stats['hit_rate']:.1f}%\n"
                    f"  Est. speedup  : {stats['speedup']:.2f}x\n"
                    f"  Avg compute   : {stats['avg_ms']:.1f} ms/step\n"
                    f"────────────────────────────────────────────────────"
                )

        return result

    except Exception as e:
        logger.error(f"[Winnougan-CacheDiT] Error in outer wrapper: {e}")
        import traceback; traceback.print_exc()
        return executor(*args, **kwargs)
    finally:
        guider.model_options = orig_model_options


# ── Main node ─────────────────────────────────────────────────────────────────

class WinnouganCacheDiT:
    """
    Winnougan Cache DiT — speeds up DiT model inference by caching and
    reusing transformer outputs across similar diffusion steps.
    """

    NAME     = NODE_NAME
    CATEGORY = "Winnougan"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "model": ("MODEL",),
                "enable": ("BOOLEAN", {
                    "default": True,
                    "tooltip": "Toggle cache acceleration on or off."
                }),
                "warmup_steps": ("INT", {
                    "default": 0,
                    "min": 0, "max": 50, "step": 1,
                    "tooltip": (
                        "How many steps to always compute before caching begins. "
                        "0 = auto (model-specific default)."
                    ),
                }),
                "skip_interval": ("INT", {
                    "default": 0,
                    "min": 0, "max": 10, "step": 1,
                    "tooltip": (
                        "Reuse the cached result every N steps. "
                        "2 = skip every 2nd step, 3 = skip every 3rd. "
                        "0 = auto (model-specific default)."
                    ),
                }),
                "noise_scale": ("FLOAT", {
                    "default": 0.0,
                    "min": 0.0, "max": 0.1, "step": 0.001,
                    "tooltip": (
                        "Add a tiny amount of noise to cached outputs to prevent "
                        "static artifacts. 0.0 = off (recommended for images). "
                        "0.01 = light (recommended for video)."
                    ),
                }),
                "print_summary": ("BOOLEAN", {
                    "default": True,
                    "tooltip": "Print a cache hit rate and speedup summary after each generation."
                }),
            }
        }

    RETURN_TYPES  = ("MODEL",)
    RETURN_NAMES  = ("model",)
    FUNCTION      = "apply"

    def apply(
        self,
        model,
        enable:        bool  = True,
        warmup_steps:  int   = 0,
        skip_interval: int   = 0,
        noise_scale:   float = 0.0,
        print_summary: bool  = True,
    ):
        if not enable:
            return self._disable(model)

        model = model.clone()

        # Auto-detect defaults if user left settings at 0
        transformer = None
        if hasattr(model.model, "diffusion_model"):
            transformer = model.model.diffusion_model

        auto_warmup, auto_skip, auto_noise, display_name = _detect_model_defaults(
            transformer
        ) if transformer is not None else (3, 2, 0.0, "Unknown")

        resolved_warmup = warmup_steps  if warmup_steps  > 0 else auto_warmup
        resolved_skip   = skip_interval if skip_interval > 0 else auto_skip
        resolved_noise  = noise_scale   if noise_scale   > 0 else auto_noise

        logger.info(
            f"[Winnougan-CacheDiT] Configuring for {display_name} — "
            f"warmup={resolved_warmup}, skip_interval={resolved_skip}, "
            f"noise={resolved_noise}"
        )

        # Store config in transformer_options for the wrapper to read
        if "transformer_options" not in model.model_options:
            model.model_options["transformer_options"] = {}

        model.model_options["transformer_options"]["winnougan_cache_dit"] = {
            "warmup_steps":  resolved_warmup,
            "skip_interval": resolved_skip,
            "noise_scale":   resolved_noise,
            "print_summary": print_summary,
            "display_name":  display_name,
        }

        # Attach the outer sample wrapper
        model.add_wrapper_with_key(
            comfy.patcher_extension.WrappersMP.OUTER_SAMPLE,
            "winnougan_cache_dit",
            _outer_sample_wrapper,
        )

        return (model,)

    def _disable(self, model):
        model = model.clone()

        # Remove config
        to = model.model_options.get("transformer_options", {})
        to.pop("winnougan_cache_dit", None)

        # Remove wrapper
        wrappers = model.wrappers.get(comfy.patcher_extension.WrappersMP.OUTER_SAMPLE, {})
        wrappers.pop("winnougan_cache_dit", None)

        # Restore transformer forward if we patched it
        if hasattr(model.model, "diffusion_model"):
            _cleanup_transformer(model.model.diffusion_model)

        # Reset global state
        global _cache_state
        _cache_state.update({
            "enabled": False,
            "transformer_id": None,
            "call_count": 0,
            "skip_count": 0,
            "compute_count": 0,
            "last_result": None,
            "compute_times": [],
        })

        logger.info("[Winnougan-CacheDiT] Disabled and cleaned up.")
        return (model,)


# ── Registration ──────────────────────────────────────────────────────────────

NODE_CLASS_MAPPINGS = {
    "WinnouganCacheDiT": WinnouganCacheDiT,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WinnouganCacheDiT": "Winnougan Cache DiT",
}
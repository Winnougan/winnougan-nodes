"""
Winnougan Model Loader
──────────────────────
Loads a diffusion model (safetensors/pt OR GGUF), optionally patches
SageAttention, and optionally applies FluxKVCache — all in one node.
"""

import logging
import sys
import os
import folder_paths
import comfy.sd
import comfy.utils
import comfy.model_management

log = logging.getLogger("Winnougan")

NODE_NAME = "Winnougan Model Loader"

# ── SageAttention mode list ───────────────────────────────────────────────────
SAGE_MODES = [
    "disabled",
    "auto",
    "sageattn_qk_int8_pv_fp16_cuda",
    "sageattn_qk_int8_pv_fp16_triton",
    "sageattn_qk_int8_pv_fp8_cuda",
    "sageattn_qk_int8_pv_fp8_cuda++",
    "sageattn3",
    "sageattn3_per_block_mean",
]

# ── Weight dtype options ──────────────────────────────────────────────────────
WEIGHT_DTYPES = [
    "default",
    "fp8_e4m3fn",
    "fp8_e4m3fn_fast",
    "fp8_e5m2",
    "fp16",
    "bf16",
]

# ── Model list helpers ────────────────────────────────────────────────────────

def _get_all_model_files():
    """
    Collect every model filename from diffusion_models, unet, AND unet_gguf
    (the folder key ComfyUI-GGUF registers).  Returns (std_models, gguf_models).
    """
    seen, all_files = set(), []
    for key in ("diffusion_models", "unet", "unet_gguf"):
        try:
            for f in folder_paths.get_filename_list(key):
                if f not in seen:
                    seen.add(f)
                    all_files.append(f)
        except Exception:
            pass

    gguf = sorted(f for f in all_files if f.lower().endswith(".gguf"))
    std  = sorted(f for f in all_files if not f.lower().endswith(".gguf"))
    return std, gguf


# ── GGUF loader lookup ────────────────────────────────────────────────────────

def _is_real_class(obj, name):
    """Return True only if obj is an actual Python class with the given name."""
    import inspect
    return inspect.isclass(obj) and obj.__name__ == name


def _find_gguf_nodes_module():
    """
    Find the ComfyUI-GGUF nodes module that contains UnetLoaderGGUF.

    Strategy (in order):
    1. Walk sys.modules looking for keys that contain 'gguf' AND whose value
       has UnetLoaderGGUF as a real class — this avoids false positives from
       PyTorch _OpNamespace objects which respond to arbitrary getattr.
    2. Walk the custom_nodes directory on disk, find any folder with 'gguf'
       in its name, and directly exec its nodes.py.
    """
    import inspect, importlib.util

    # ── Stage 1: sys.modules scan, strict class check ─────────────────────────
    for key in list(sys.modules.keys()):
        if "gguf" not in key.lower():
            continue
        mod = sys.modules.get(key)
        if mod is None:
            continue
        candidate = getattr(mod, "UnetLoaderGGUF", None)
        if _is_real_class(candidate, "UnetLoaderGGUF"):
            log.info(f"[{NODE_NAME}] Found UnetLoaderGGUF in sys.modules['{key}']")
            return mod

    # ── Stage 2: disk scan — most reliable ───────────────────────────────────
    custom_dirs = []
    info = folder_paths.folder_names_and_paths.get("custom_nodes")
    if info:
        custom_dirs.extend(info[0])
    parent = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if parent not in custom_dirs:
        custom_dirs.append(parent)

    for base in custom_dirs:
        if not os.path.isdir(base):
            continue
        for dirname in os.listdir(base):
            if "gguf" not in dirname.lower():
                continue
            nodes_py = os.path.join(base, dirname, "nodes.py")
            if not os.path.isfile(nodes_py):
                continue
            mod_name = f"_winnougan_gguf_nodes"
            if mod_name in sys.modules:
                mod = sys.modules[mod_name]
                candidate = getattr(mod, "UnetLoaderGGUF", None)
                if _is_real_class(candidate, "UnetLoaderGGUF"):
                    return mod
            try:
                spec = importlib.util.spec_from_file_location(mod_name, nodes_py)
                mod  = importlib.util.module_from_spec(spec)
                sys.modules[mod_name] = mod
                spec.loader.exec_module(mod)
                candidate = getattr(mod, "UnetLoaderGGUF", None)
                if _is_real_class(candidate, "UnetLoaderGGUF"):
                    log.info(f"[{NODE_NAME}] Loaded GGUF nodes from disk: {nodes_py}")
                    return mod
                else:
                    del sys.modules[mod_name]
            except Exception as e:
                sys.modules.pop(mod_name, None)
                log.warning(f"[{NODE_NAME}] Could not load {nodes_py}: {e}")

    return None


_gguf_nodes_mod = None
_gguf_checked   = False

def get_gguf_loader():
    """Return the UnetLoaderGGUF class, or None if ComfyUI-GGUF isn't installed."""
    global _gguf_nodes_mod, _gguf_checked
    if not _gguf_checked:
        _gguf_nodes_mod = _find_gguf_nodes_module()
        _gguf_checked   = True
        if _gguf_nodes_mod is None:
            log.warning(f"[{NODE_NAME}] ComfyUI-GGUF not found — GGUF loading disabled.")
    return getattr(_gguf_nodes_mod, "UnetLoaderGGUF", None) if _gguf_nodes_mod else None


def _resolve_model_path(model_name, *extra_keys):
    """Search folder_paths for a model file, trying multiple registered keys."""
    for key in ("diffusion_models", "unet", "unet_gguf") + extra_keys:
        try:
            path = folder_paths.get_full_path(key, model_name)
            if path:
                return path
        except Exception:
            pass
    return None


# ── GGUF load_unet caller ─────────────────────────────────────────────────────

# FIX 1: Cache the GGUF API variant so we only probe once, not on every load.
_gguf_api_variant = None   # "new" | "string" | "none"

def _detect_gguf_api_variant(gguf_cls):
    """
    Inspect the load_unet signature WITHOUT instantiating the class.
    Returns "new", "string", or "none".
    """
    import inspect
    try:
        # inspect.signature on an unbound method — no instantiation needed
        sig = inspect.signature(gguf_cls.load_unet)
        return "new" if "dequant_dtype" in sig.parameters else "none"
    except Exception:
        return "none"


def _load_gguf_model(gguf_cls, model_name, weight_dtype_str):
    """
    Call UnetLoaderGGUF.load_unet robustly across ComfyUI-GGUF versions.

    FIX 1: Instantiate gguf_cls exactly ONCE per call.
    FIX 1: Detect the API variant via class-level signature inspection (no
            premature instantiation) and cache the result globally so the probe
            only runs once per session, not on every generation.
    """
    import torch

    global _gguf_api_variant

    dtype_map = {
        "default":         None,
        "fp8_e4m3fn":      torch.float8_e4m3fn,
        "fp8_e4m3fn_fast": torch.float8_e4m3fn,
        "fp8_e5m2":        torch.float8_e5m2,
        "fp16":            torch.float16,
        "bf16":            torch.bfloat16,
    }
    torch_dtype = dtype_map.get(weight_dtype_str, None)

    # Probe the API once per session
    if _gguf_api_variant is None:
        _gguf_api_variant = _detect_gguf_api_variant(gguf_cls)
        log.info(f"[{NODE_NAME}] GGUF API variant detected: {_gguf_api_variant}")

    # Instantiate exactly once
    loader = gguf_cls()

    if _gguf_api_variant == "new":
        # New API: dequant_dtype accepts torch.dtype or None
        try:
            result = loader.load_unet(model_name, dequant_dtype=torch_dtype)
            log.info(f"[{NODE_NAME}] Loaded GGUF (new API, dtype={torch_dtype}): {model_name}")
            return result[0]
        except TypeError as e:
            # The installed version rejects torch.dtype — downgrade and retry
            log.warning(f"[{NODE_NAME}] GGUF new API rejected torch.dtype ({e}), "
                        "falling back to string API")
            _gguf_api_variant = "string"

    if _gguf_api_variant == "string":
        try:
            result = loader.load_unet(model_name, dequant_dtype=weight_dtype_str)
            log.info(f"[{NODE_NAME}] Loaded GGUF (string API): {model_name}")
            return result[0]
        except Exception as e:
            log.warning(f"[{NODE_NAME}] GGUF string API failed ({e}), "
                        "trying no-dtype fallback")
            _gguf_api_variant = "none"

    # Last resort: no dequant_dtype at all
    result = loader.load_unet(model_name)
    log.info(f"[{NODE_NAME}] Loaded GGUF (no-dtype API): {model_name}")
    return result[0]


# ── SageAttention patcher ─────────────────────────────────────────────────────

def _build_sage_func(mode):
    if mode == "disabled":
        return None
    try:
        if mode == "auto":
            from sageattention import sageattn
            def f(q, k, v, is_causal=False, attn_mask=None, tensor_layout="NHD"):
                return sageattn(q, k, v, is_causal=is_causal, attn_mask=attn_mask,
                                tensor_layout=tensor_layout)
        elif mode == "sageattn_qk_int8_pv_fp16_cuda":
            from sageattention import sageattn_qk_int8_pv_fp16_cuda
            def f(q, k, v, is_causal=False, attn_mask=None, tensor_layout="NHD"):
                return sageattn_qk_int8_pv_fp16_cuda(q, k, v, is_causal=is_causal,
                    attn_mask=attn_mask, pv_accum_dtype="fp32", tensor_layout=tensor_layout)
        elif mode == "sageattn_qk_int8_pv_fp16_triton":
            from sageattention import sageattn_qk_int8_pv_fp16_triton
            def f(q, k, v, is_causal=False, attn_mask=None, tensor_layout="NHD"):
                return sageattn_qk_int8_pv_fp16_triton(q, k, v, is_causal=is_causal,
                    attn_mask=attn_mask, tensor_layout=tensor_layout)
        elif mode == "sageattn_qk_int8_pv_fp8_cuda":
            from sageattention import sageattn_qk_int8_pv_fp8_cuda
            def f(q, k, v, is_causal=False, attn_mask=None, tensor_layout="NHD"):
                return sageattn_qk_int8_pv_fp8_cuda(q, k, v, is_causal=is_causal,
                    attn_mask=attn_mask, pv_accum_dtype="fp32+fp32", tensor_layout=tensor_layout)
        elif mode == "sageattn_qk_int8_pv_fp8_cuda++":
            from sageattention import sageattn_qk_int8_pv_fp8_cuda
            def f(q, k, v, is_causal=False, attn_mask=None, tensor_layout="NHD"):
                return sageattn_qk_int8_pv_fp8_cuda(q, k, v, is_causal=is_causal,
                    attn_mask=attn_mask, pv_accum_dtype="fp32+fp16", tensor_layout=tensor_layout)
        elif mode in ("sageattn3", "sageattn3_per_block_mean"):
            from sageattention import sageattn3_blackwell
            per_block = (mode == "sageattn3_per_block_mean")
            def f(q, k, v, is_causal=False, attn_mask=None, tensor_layout="NHD"):
                out = sageattn3_blackwell(q, k, v, is_causal=is_causal,
                    attn_mask=attn_mask, per_block_mean=per_block)
                return out.transpose(1, 2) if tensor_layout == "NHD" else out
        else:
            log.warning(f"[{NODE_NAME}] Unknown sage mode: {mode}")
            return None
        return f
    except ImportError as e:
        log.warning(f"[{NODE_NAME}] sageattention import failed for '{mode}': {e}")
        return None


def _patch_sage_attention(model, mode):
    if mode == "disabled":
        return model
    sage_func = _build_sage_func(mode)
    if sage_func is None:
        return model

    import torch

    def attention_sage(q, k, v, heads, mask=None, attn_precision=None,
                       skip_reshape=False, skip_output_reshape=False,
                       transformer_options=None):
        if not skip_reshape:
            b, _, dim_head = q.shape
            dim_head = dim_head // heads
            q = q.view(b, -1, heads, dim_head)
            k = k.view(b, -1, heads, dim_head)
            v = v.view(b, -1, heads, dim_head)
        dt = q.dtype
        out = sage_func(q.to(torch.float16), k.to(torch.float16),
                        v.to(torch.float16), tensor_layout="NHD")
        out = out.to(dt)
        if not skip_output_reshape:
            b, s, h, d = out.shape
            out = out.reshape(b, s, h * d)
        return out

    m = model.clone()
    m.model_options = (m.model_options.copy() if hasattr(m, "model_options") else {})
    m.model_options.setdefault("transformer_options", {})
    m.model_options["transformer_options"]["patch_attn1_replace"] = attention_sage
    log.info(f"[{NODE_NAME}] SageAttention patched: {mode}")
    return m


# ── FluxKVCache wrapper ───────────────────────────────────────────────────────

def _apply_flux_kv_cache(model):
    try:
        from comfy_extras.nodes_flux import FluxKVCache
        result = FluxKVCache().patch(model)
        log.info(f"[{NODE_NAME}] FluxKVCache applied via comfy_extras.nodes_flux")
        return result[0]
    except Exception:
        pass
    try:
        import torch
        m = model.clone()

        _cache_ref = [None]

        def kv_cache_pre_attn(q, k, v, pe=None, extra_options=None, **kwargs):
            opts = extra_options or {}
            bid  = opts.get("block", (0, 0))

            if bid == (0, 0) or bid == 0:
                _cache_ref[0] = {}

            cache = _cache_ref[0]
            if cache is None:
                cache = {}
                _cache_ref[0] = cache

            if bid not in cache:
                cache[bid] = (k.detach(), v.detach())
            else:
                kc, vc = cache[bid]
                k = torch.cat([kc, k], dim=1)
                v = torch.cat([vc, v], dim=1)

            out = {"q": q, "k": k, "v": v}
            if pe is not None:
                out["pe"] = pe
            return out

        m.set_model_attn1_patch(kv_cache_pre_attn)
        log.info(f"[{NODE_NAME}] FluxKVCache applied via manual patch")
        return m
    except Exception as e:
        log.warning(f"[{NODE_NAME}] FluxKVCache could not be applied: {e}")
        return model


# ── Main node ─────────────────────────────────────────────────────────────────

class WinnouganModelLoader:
    NAME     = NODE_NAME
    CATEGORY = "Winnougan"

    @classmethod
    def INPUT_TYPES(cls):
        std, gguf = _get_all_model_files()
        combined  = std + gguf
        return {
            "required": {
                "model_name":     (combined,),
                "loader_type":    (["diffusion_model", "GGUF"],),
                "weight_dtype":   (WEIGHT_DTYPES,),
                "sage_attention": (SAGE_MODES,),
                "flux_kv_cache":  ("BOOLEAN", {"default": False,
                                               "label_on":  "enabled",
                                               "label_off": "disabled"}),
            }
        }

    RETURN_TYPES  = ("MODEL",)
    RETURN_NAMES  = ("model",)
    FUNCTION      = "load_model"

    def load_model(self, model_name, loader_type, weight_dtype,
                   sage_attention, flux_kv_cache):

        # ── Load ──────────────────────────────────────────────────────────────
        if loader_type == "GGUF":
            gguf_cls = get_gguf_loader()
            if gguf_cls is None:
                raise RuntimeError(
                    f"[{NODE_NAME}] ComfyUI-GGUF is not installed or could not be found. "
                    "Install it from: https://github.com/city96/ComfyUI-GGUF"
                )
            model = _load_gguf_model(gguf_cls, model_name, weight_dtype)

        else:
            import torch
            dtype_map = {
                "default":         None,
                "fp8_e4m3fn":      torch.float8_e4m3fn,
                "fp8_e4m3fn_fast": torch.float8_e4m3fn,
                "fp8_e5m2":        torch.float8_e5m2,
                "fp16":            torch.float16,
                "bf16":            torch.bfloat16,
            }
            dtype = dtype_map.get(weight_dtype, None)

            model_path = _resolve_model_path(model_name)
            if model_path is None:
                raise FileNotFoundError(
                    f"[{NODE_NAME}] Cannot find model file: {model_name}"
                )
            model_options = {}
            if dtype is not None:
                model_options["dtype"] = dtype
            if weight_dtype == "fp8_e4m3fn_fast":
                model_options["fp8_optimizations"] = True
            model = comfy.sd.load_diffusion_model(model_path, model_options=model_options)
            log.info(f"[{NODE_NAME}] Loaded: {model_name} [{weight_dtype}]")

        # ── SageAttention ─────────────────────────────────────────────────────
        if sage_attention != "disabled":
            try:
                model = _patch_sage_attention(model, sage_attention)
            except Exception as e:
                log.error(f"[{NODE_NAME}] SageAttention failed: {e}")

        # ── FluxKVCache ───────────────────────────────────────────────────────
        if flux_kv_cache:
            try:
                model = _apply_flux_kv_cache(model)
            except Exception as e:
                log.error(f"[{NODE_NAME}] FluxKVCache failed: {e}")

        return (model,)


# ── ComfyUI registration ──────────────────────────────────────────────────────

NODE_CLASS_MAPPINGS = {
    "WinnouganModelLoader": WinnouganModelLoader,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WinnouganModelLoader": "Winnougan Model Loader",
}

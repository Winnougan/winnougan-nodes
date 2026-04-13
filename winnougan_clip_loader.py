"""
Winnougan CLIP Loader
─────────────────────
Single or dual CLIP loader with full dtype support:
  Standard : fp16, bf16, fp8_e4m3fn, fp8_e4m3fn_fast, fp8_e5m2
  NV/MX    : nvfp4, mxfp8
  GGUF     : .gguf files via ComfyUI-GGUF
Toggle between single and dual clip loading in one node.
"""

import logging
import sys
import os

import folder_paths
import comfy.sd

log = logging.getLogger("Winnougan")

NODE_NAME = "Winnougan CLIP Loader"

# ── Dtype map ─────────────────────────────────────────────────────────────────

CLIP_DTYPES = [
    "default",
    "fp16",
    "bf16",
    "fp8_e4m3fn",
    "fp8_e4m3fn_fast",
    "fp8_e5m2",
    "nvfp4",
    "mxfp8",
]

# ── File list helpers ─────────────────────────────────────────────────────────

def _get_clip_files():
    """Return (std_files, gguf_files) from all known CLIP folder keys."""
    seen, all_files = set(), []
    for key in ("clip", "clip_vision", "text_encoders", "unet_gguf"):
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


def _combined_clip_list():
    std, gguf = _get_clip_files()
    return std + gguf


# ── GGUF loader lookup (mirrors model loader pattern) ────────────────────────

_gguf_mod     = None
_gguf_checked = False

def _find_gguf_clip_loader():
    import inspect, importlib.util
    for key in list(sys.modules.keys()):
        if "gguf" not in key.lower():
            continue
        mod = sys.modules.get(key)
        if mod is None:
            continue
        candidate = getattr(mod, "CLIPLoaderGGUF", None)
        if inspect.isclass(candidate) and candidate.__name__ == "CLIPLoaderGGUF":
            return mod
    # Disk scan
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
            mod_name = "_winnougan_gguf_nodes_clip"
            if mod_name in sys.modules:
                mod = sys.modules[mod_name]
                candidate = getattr(mod, "CLIPLoaderGGUF", None)
                if inspect.isclass(candidate) and candidate.__name__ == "CLIPLoaderGGUF":
                    return mod
            try:
                spec = importlib.util.spec_from_file_location(mod_name, nodes_py)
                mod  = importlib.util.module_from_spec(spec)
                sys.modules[mod_name] = mod
                spec.loader.exec_module(mod)
                candidate = getattr(mod, "CLIPLoaderGGUF", None)
                if inspect.isclass(candidate) and candidate.__name__ == "CLIPLoaderGGUF":
                    return mod
                del sys.modules[mod_name]
            except Exception as e:
                sys.modules.pop(mod_name, None)
                log.warning(f"[{NODE_NAME}] Could not load GGUF nodes: {e}")
    return None


def _get_gguf_clip_cls():
    global _gguf_mod, _gguf_checked
    if not _gguf_checked:
        _gguf_mod     = _find_gguf_clip_loader()
        _gguf_checked = True
        if _gguf_mod is None:
            log.warning(f"[{NODE_NAME}] ComfyUI-GGUF not found — GGUF CLIP disabled.")
    return getattr(_gguf_mod, "CLIPLoaderGGUF", None) if _gguf_mod else None


# ── Core load helpers ─────────────────────────────────────────────────────────

def _resolve_clip_path(name):
    for key in ("clip", "text_encoders", "clip_vision", "unet_gguf"):
        try:
            p = folder_paths.get_full_path(key, name)
            if p:
                return p
        except Exception:
            pass
    return None


def _dtype_model_options(dtype_str):
    """Convert dtype string to comfy model_options dict."""
    import torch
    _map = {
        "fp16":            {"dtype": torch.float16},
        "bf16":            {"dtype": torch.bfloat16},
        "fp8_e4m3fn":      {"dtype": torch.float8_e4m3fn},
        "fp8_e4m3fn_fast": {"dtype": torch.float8_e4m3fn, "fp8_optimizations": True},
        "fp8_e5m2":        {"dtype": torch.float8_e5m2},
        # nvfp4 / mxfp8 — use the ComfyUI model_options keys introduced for these formats
        "nvfp4":           {"dtype": "nvfp4"},
        "mxfp8":           {"dtype": "mxfp8"},
    }
    return _map.get(dtype_str, {})


def _load_one_clip(name, clip_type, dtype_str):
    """Load a single CLIP model, handling GGUF and all dtype variants."""
    is_gguf = name.lower().endswith(".gguf")

    if is_gguf:
        gguf_cls = _get_gguf_clip_cls()
        if gguf_cls is None:
            raise RuntimeError(
                f"[{NODE_NAME}] ComfyUI-GGUF is not installed. "
                "Install from: https://github.com/city96/ComfyUI-GGUF"
            )
        # CLIPLoaderGGUF.load_clip(clip_name, type)
        result = gguf_cls().load_clip(clip_name=name, type=clip_type)
        log.info(f"[{NODE_NAME}] Loaded GGUF CLIP: {name}")
        return result[0]

    path = _resolve_clip_path(name)
    if path is None:
        raise FileNotFoundError(f"[{NODE_NAME}] Cannot find CLIP: {name}")

    model_options = _dtype_model_options(dtype_str)
    clip = comfy.sd.load_clip(
        ckpt_paths   = [path],
        embedding_directory = folder_paths.get_folder_paths("embeddings"),
        clip_type    = getattr(comfy.sd.CLIPType, clip_type.upper(), comfy.sd.CLIPType.STABLE_DIFFUSION),
        model_options= model_options,
    )
    log.info(f"[{NODE_NAME}] Loaded CLIP: {name} [{dtype_str}]")
    return clip


# ── Main node ─────────────────────────────────────────────────────────────────

class WinnouganCLIPLoader:
    NAME     = NODE_NAME
    CATEGORY = "Winnougan"

    # CLIP type options mirroring ComfyUI's standard loader
    CLIP_TYPES = ["stable_diffusion", "stable_cascade", "sd3", "stable_audio",
                  "mochi", "ltxv", "pixart", "cosmos", "lumina2", "wan",
                  "hidream", "chroma", "ace",
                  "qwen_image", "flux2", "ovis", "longcat_image"]

    @classmethod
    def INPUT_TYPES(cls):
        files = _combined_clip_list()
        if not files:
            files = ["none"]
        return {
            "required": {
                "clip_name_1":  (files,),
                "clip_type_1":  (cls.CLIP_TYPES,),
                "dtype_1":      (CLIP_DTYPES,),
                "dual_clip":    ("BOOLEAN", {
                    "default": False,
                    "label_on":  "dual",
                    "label_off": "single",
                    "tooltip": "Toggle between single and dual CLIP loading.",
                }),
                "clip_name_2":  (files,),
                "clip_type_2":  (cls.CLIP_TYPES,),
                "dtype_2":      (CLIP_DTYPES,),
            }
        }

    RETURN_TYPES  = ("CLIP",)
    RETURN_NAMES  = ("clip",)
    FUNCTION      = "load_clip"

    def load_clip(
        self,
        clip_name_1, clip_type_1, dtype_1,
        dual_clip,
        clip_name_2, clip_type_2, dtype_2,
    ):
        clip1 = _load_one_clip(clip_name_1, clip_type_1, dtype_1)

        if not dual_clip:
            return (clip1,)

        # Dual: load second and merge via load_clip with both paths
        # ComfyUI's dual clip loader passes both paths to load_clip together
        is_gguf2 = clip_name_2.lower().endswith(".gguf")

        if is_gguf2:
            # Can't merge GGUF with standard path via comfy.sd.load_clip,
            # so load independently and return both merged via the first clip's
            # tokenizer (best-effort — user should use same type for dual GGUF)
            clip2 = _load_one_clip(clip_name_2, clip_type_2, dtype_2)
            # Attempt to merge: ComfyUI dual clips share one tokenizer object
            # The standard way is to pass both ckpt_paths in one call
            log.warning(f"[{NODE_NAME}] Dual GGUF: returning clip1 only — "
                        "use standard + GGUF mix with non-GGUF for clip_1.")
            return (clip1,)

        path2 = _resolve_clip_path(clip_name_2)
        if path2 is None:
            raise FileNotFoundError(f"[{NODE_NAME}] Cannot find CLIP 2: {clip_name_2}")

        path1 = _resolve_clip_path(clip_name_1)
        model_options = _dtype_model_options(dtype_1)  # use clip_1 dtype for merged load

        clip = comfy.sd.load_clip(
            ckpt_paths          = [path1, path2],
            embedding_directory = folder_paths.get_folder_paths("embeddings"),
            clip_type           = getattr(comfy.sd.CLIPType, clip_type_1.upper(), comfy.sd.CLIPType.STABLE_DIFFUSION),
            model_options       = model_options,
        )
        log.info(f"[{NODE_NAME}] Loaded dual CLIP: {clip_name_1} + {clip_name_2}")
        return (clip,)


# ── Registration ──────────────────────────────────────────────────────────────

NODE_CLASS_MAPPINGS = {
    "WinnouganCLIPLoader": WinnouganCLIPLoader,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WinnouganCLIPLoader": "Winnougan CLIP Loader",
}

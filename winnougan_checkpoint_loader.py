"""
Winnougan Checkpoint Loader
────────────────────────────
Loads full checkpoint files (.safetensors, .ckpt) that contain bundled
model + CLIP + VAE, with optional Sage Attention and Triton acceleration.

Outputs MODEL, CLIP, VAE — drop-in replacement for ComfyUI's standard
CheckpointLoaderSimple with extra performance options.
"""

import logging
import folder_paths
import comfy.sd
import comfy.utils

log = logging.getLogger("Winnougan")

NODE_NAME = "Winnougan Checkpoint Loader"


# ── Sage Attention ────────────────────────────────────────────────────────────
#
# FIX: The original implementation patched comfy.ldm.modules.attention
# .optimized_attention globally, meaning it affected every node in the graph.
# Two nodes with different sage settings would fight each other, and calling
# _disable_sage_attention() would silently undo sage for every other model
# loaded in the same session.
#
# The correct approach — matching ComfyUI's own extension pattern and what
# WinnouganModelLoader already does — is to attach the patch to the model
# object via model_options["transformer_options"], so it is scoped to this
# model only and travels with it through the graph.

def _build_sage_func():
    """
    Import sageattn and return a wrapped attention callable, or None on failure.
    Mirrors the "auto" branch of WinnouganModelLoader._build_sage_func.
    """
    try:
        from sageattention import sageattn

        def f(q, k, v, is_causal=False, attn_mask=None, tensor_layout="NHD"):
            return sageattn(q, k, v, is_causal=is_causal,
                            attn_mask=attn_mask, tensor_layout=tensor_layout)

        return f
    except ImportError:
        log.warning(f"[{NODE_NAME}] sageattention not installed — Sage Attention skipped.")
        return None
    except Exception as e:
        log.warning(f"[{NODE_NAME}] sageattention import failed: {e}")
        return None


def _patch_sage_attention(model):
    """
    Clone the model and attach a per-model sage attention patch via
    transformer_options.  Does NOT touch any global comfy module state.
    Returns the patched clone, or the original model on failure.
    """
    import torch

    sage_func = _build_sage_func()
    if sage_func is None:
        return model

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
        out = sage_func(
            q.to(torch.float16),
            k.to(torch.float16),
            v.to(torch.float16),
            tensor_layout="NHD",
        )
        out = out.to(dt)
        if not skip_output_reshape:
            b, s, h, d = out.shape
            out = out.reshape(b, s, h * d)
        return out

    try:
        m = model.clone()
        m.model_options = (m.model_options.copy() if hasattr(m, "model_options") else {})
        m.model_options.setdefault("transformer_options", {})
        m.model_options["transformer_options"]["patch_attn1_replace"] = attention_sage
        log.info(f"[{NODE_NAME}] Sage Attention patched on model.")
        return m
    except Exception as e:
        log.warning(f"[{NODE_NAME}] Sage Attention patch failed: {e}")
        return model


def _try_enable_triton():
    """Enable Triton-accelerated kernels in ComfyUI where possible."""
    try:
        import triton  # noqa: F401
        try:
            from wint8_nodes import wint8_fused_kernel  # noqa: F401
            log.info(f"[{NODE_NAME}] Triton kernels available.")
        except Exception:
            pass
        return True
    except ImportError:
        log.warning(f"[{NODE_NAME}] Triton not installed — Triton acceleration unavailable.")
        return False


# ── Node ──────────────────────────────────────────────────────────────────────

class WinnouganCheckpointLoader:
    NAME     = NODE_NAME
    CATEGORY = "Winnougan"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "ckpt_name": (folder_paths.get_filename_list("checkpoints"),),
                "sage_attention": ("BOOLEAN", {
                    "default": False,
                    "label_on":  "sage on",
                    "label_off": "sage off",
                    "tooltip": "Enable Sage Attention for reduced VRAM usage. Requires sageattn package.",
                }),
                "triton": ("BOOLEAN", {
                    "default": False,
                    "label_on":  "triton on",
                    "label_off": "triton off",
                    "tooltip": "Enable Triton-accelerated kernels where available.",
                }),
            }
        }

    RETURN_TYPES  = ("MODEL", "CLIP", "VAE")
    RETURN_NAMES  = ("model", "clip", "vae")
    FUNCTION      = "load_checkpoint"

    def load_checkpoint(self, ckpt_name, sage_attention, triton):
        # ── Triton ────────────────────────────────────────────────────────────
        if triton:
            _try_enable_triton()

        # ── Load checkpoint ───────────────────────────────────────────────────
        ckpt_path = folder_paths.get_full_path("checkpoints", ckpt_name)
        out = comfy.sd.load_checkpoint_guess_config(
            ckpt_path,
            output_vae=True,
            output_clip=True,
            embedding_directory=folder_paths.get_folder_paths("embeddings"),
        )

        model = out[0]
        clip  = out[1]
        vae   = out[2]

        # ── Sage Attention — applied per-model, not globally ──────────────────
        if sage_attention:
            model = _patch_sage_attention(model)

        log.info(
            f"[{NODE_NAME}] Loaded '{ckpt_name}' | "
            f"sage={sage_attention} | triton={triton}"
        )
        return (model, clip, vae)


# ── Registration ──────────────────────────────────────────────────────────────

NODE_CLASS_MAPPINGS = {
    "WinnouganCheckpointLoader": WinnouganCheckpointLoader,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WinnouganCheckpointLoader": "Winnougan Checkpoint Loader",
}

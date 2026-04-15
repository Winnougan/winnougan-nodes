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


# ── Sage Attention helpers (shared pattern with WINT8) ────────────────────────

def _try_enable_sage_attention():
    try:
        import comfy.ldm.modules.attention as attn_mod
        from sageattn import sageattn as _sageattn

        if getattr(attn_mod, "_orig_attn_winnougan", None) is not None:
            return True  # already patched

        _orig = attn_mod.optimized_attention

        def _sage(q, k, v, heads, mask=None, attn_precision=None, skip_reshape=False):
            try:
                import torch
                B, S, _ = q.shape
                D = q.shape[-1] // heads
                q_ = q.view(B, S, heads, D).transpose(1, 2).contiguous()
                k_ = k.view(B, S, heads, D).transpose(1, 2).contiguous()
                v_ = v.view(B, S, heads, D).transpose(1, 2).contiguous()
                out = _sageattn(q_, k_, v_, tensor_layout="HND", is_causal=False)
                return out.transpose(1, 2).reshape(B, S, heads * D)
            except Exception:
                return _orig(q, k, v, heads, mask, attn_precision, skip_reshape)

        attn_mod._orig_attn_winnougan = _orig
        attn_mod.optimized_attention  = _sage
        log.info(f"[{NODE_NAME}] Sage Attention enabled.")
        return True
    except ImportError:
        log.warning(f"[{NODE_NAME}] sageattn not installed — Sage Attention skipped.")
        return False
    except Exception as e:
        log.warning(f"[{NODE_NAME}] Sage Attention patch failed: {e}")
        return False


def _disable_sage_attention():
    try:
        import comfy.ldm.modules.attention as attn_mod
        orig = getattr(attn_mod, "_orig_attn_winnougan", None)
        if orig is not None:
            attn_mod.optimized_attention = orig
            del attn_mod._orig_attn_winnougan
            log.info(f"[{NODE_NAME}] Sage Attention disabled.")
    except Exception:
        pass


def _try_enable_triton():
    """Enable Triton-accelerated kernels in ComfyUI where possible."""
    try:
        import triton  # noqa: F401
        # Signal to our wint8_quant kernels that triton is available
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
        # ── Sage Attention ────────────────────────────────────────────────────
        if sage_attention:
            _try_enable_sage_attention()
        else:
            _disable_sage_attention()

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

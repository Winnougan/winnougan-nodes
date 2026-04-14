"""
Winnougan Prompt Encoder
────────────────────────
Combined positive + negative CLIP text encoder in one node.

  • Positive prompt  — green section, encodes via clip_pos input
  • Negative prompt  — red section,   encodes via clip_neg input
  • zero_neg toggle  — when ON: skips the negative CLIP entirely and
                       produces a ConditioningZeroOut of the POSITIVE
                       conditioning for the negative output slot.
                       (Required for Flux2 / Kl-F8-Anime2 / Z-Image Turbo
                        where a real negative embedding breaks inference.)

Inputs  (left)  : clip_pos  CLIP   — positive text encoder
                  clip_neg  CLIP   — negative text encoder (ignored when zero_neg=ON)
                  positive  STRING — positive prompt text
                  negative  STRING — negative prompt text
Outputs (right) : positive  CONDITIONING
                  negative  CONDITIONING  (zeroed when zero_neg=ON)
"""

import logging
import torch
import comfy.sd

log = logging.getLogger("Winnougan")

NODE_NAME = "Winnougan Prompt Encoder"


def _encode(clip, text: str):
    """Tokenise + encode text with the given CLIP model."""
    tokens = clip.tokenize(text)
    return clip.encode_from_tokens_scheduled(tokens)


def _zero_out(conditioning):
    """
    Replicate ConditioningZeroOut: zero every tensor in the conditioning list.
    Each element is (tensor, dict_of_extra).  We zero the tensor in-place on
    a clone so we don't mutate the positive conditioning.
    """
    result = []
    for cond, extra in conditioning:
        result.append((torch.zeros_like(cond), extra.copy()))
    return result


class WinnouganPromptEncoder:
    NAME     = NODE_NAME
    CATEGORY = "Winnougan"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "clip_pos": ("CLIP", {"tooltip": "CLIP model for the positive prompt."}),
                "clip_neg": ("CLIP", {"tooltip": "CLIP model for the negative prompt. Not used when zero_neg is ON."}),
                "positive": ("STRING", {
                    "multiline": True,
                    "default": "",
                    "placeholder": "Positive prompt…",
                    "tooltip": "Positive conditioning text.",
                }),
                "negative": ("STRING", {
                    "multiline": True,
                    "default": "",
                    "placeholder": "Negative prompt…",
                    "tooltip": "Negative conditioning text. Ignored when zero_neg is ON.",
                }),
                "zero_neg": ("BOOLEAN", {
                    "default": False,
                    "label_on":  "zero neg",
                    "label_off": "encode neg",
                    "tooltip": (
                        "When ON: outputs ConditioningZeroOut for the negative slot "
                        "(required for Flux2, Kl-F8-Anime2, Z-Image Turbo). "
                        "The clip_neg input is ignored."
                    ),
                }),
            }
        }

    RETURN_TYPES  = ("CONDITIONING", "CONDITIONING")
    RETURN_NAMES  = ("positive", "negative")
    FUNCTION      = "encode"

    def encode(self, clip_pos, clip_neg, positive, negative, zero_neg):
        # ── Positive conditioning ─────────────────────────────────────────────
        pos_cond = _encode(clip_pos, positive)
        log.info(f"[{NODE_NAME}] Encoded positive prompt ({len(positive)} chars).")

        # ── Negative conditioning ─────────────────────────────────────────────
        if zero_neg:
            neg_cond = _zero_out(pos_cond)
            log.info(f"[{NODE_NAME}] zero_neg=ON — negative output is ConditioningZeroOut.")
        else:
            neg_cond = _encode(clip_neg, negative)
            log.info(f"[{NODE_NAME}] Encoded negative prompt ({len(negative)} chars).")

        return (pos_cond, neg_cond)


# ── Registration ──────────────────────────────────────────────────────────────

NODE_CLASS_MAPPINGS = {
    "WinnouganPromptEncoder": WinnouganPromptEncoder,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WinnouganPromptEncoder": "Winnougan Prompt Encoder",
}

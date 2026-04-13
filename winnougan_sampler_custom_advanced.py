"""
Winnougan SamplerCustomAdvanced
────────────────────────────────
Enhanced wrapper around ComfyUI's SamplerCustomAdvanced with:
  - start_at_step / end_at_step  : sigma slicing for chained samplers
  - noise_multiplier             : scale noise before sampling
  - return_with_leftover_noise   : return at stopped sigma for chaining
  - cfg_rescale                  : reduce CFG artifacts (Flux / SD3)
  - preview_method               : live step previews without extra nodes
"""

import logging
import torch
import comfy.samplers
import comfy.sample
import comfy.sampler_helpers
import comfy.model_management
import comfy.utils
import latent_preview

log = logging.getLogger("Winnougan")

NODE_NAME = "Winnougan SamplerCustomAdvanced"

PREVIEW_METHODS = ["none", "auto", "latent2rgb", "taesd"]


def _apply_cfg_rescale(x, rescale: float):
    """
    Rescale CFG output to reduce over-saturation / artifacts.
    Based on the technique from Ref: https://arxiv.org/abs/2305.08891
    Blends the std-normalised result back with the original at `rescale` strength.
    """
    if rescale == 0.0:
        return x
    x_std  = x.std()
    x_norm = x * (x_std / (x.std() + 1e-8))   # preserve scale
    # Lin-interp between original and rescaled
    return rescale * x_norm + (1.0 - rescale) * x


class WinnouganSamplerCustomAdvanced:
    NAME     = NODE_NAME
    CATEGORY = "Winnougan"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "noise":                    ("NOISE",),
                "guider":                   ("GUIDER",),
                "sampler":                  ("SAMPLER",),
                "sigmas":                   ("SIGMAS",),
                "latent_image":             ("LATENT",),
                # ── Step range ────────────────────────────────────────────────
                "start_at_step":            ("INT", {
                    "default": 0, "min": 0, "max": 10000,
                    "tooltip": "Skip the first N sigmas. Use for chained sampler passes.",
                }),
                "end_at_step":              ("INT", {
                    "default": 10000, "min": 0, "max": 10000,
                    "tooltip": "Stop after this sigma index. 10000 = run all steps.",
                }),
                # ── Noise ─────────────────────────────────────────────────────
                "noise_multiplier":         ("FLOAT", {
                    "default": 1.0, "min": 0.0, "max": 10.0, "step": 0.01,
                    "tooltip": "Scale the noise tensor before sampling. 1.0 = unchanged.",
                }),
                # ── CFG rescale ───────────────────────────────────────────────
                "cfg_rescale":              ("FLOAT", {
                    "default": 0.0, "min": 0.0, "max": 1.0, "step": 0.01,
                    "tooltip": "CFG rescale strength (0 = off). Reduces over-saturation on Flux/SD3.",
                }),
                # ── Output mode ───────────────────────────────────────────────
                "return_with_leftover_noise": ("BOOLEAN", {
                    "default": False,
                    "label_on":  "leftover noise",
                    "label_off": "fully denoised",
                    "tooltip": (
                        "When on, output retains the noise level at the stopped step "
                        "so it can be fed directly into a second sampler pass."
                    ),
                }),
                # ── Preview ───────────────────────────────────────────────────
                "preview_method":           (PREVIEW_METHODS, {
                    "default": "auto",
                    "tooltip": "Live step preview method. 'none' disables previews entirely.",
                }),
            }
        }

    RETURN_TYPES  = ("LATENT", "LATENT")
    RETURN_NAMES  = ("output", "denoised_output")
    FUNCTION      = "sample"

    def sample(
        self,
        noise,
        guider,
        sampler,
        sigmas,
        latent_image,
        start_at_step,
        end_at_step,
        noise_multiplier,
        cfg_rescale,
        return_with_leftover_noise,
        preview_method,
    ):
        # ── Sigma slicing ─────────────────────────────────────────────────────
        # sigmas has length steps+1 (the final 0-sigma is the terminator).
        # We clamp the range and slice so chained passes work correctly.
        total_steps = max(len(sigmas) - 1, 1)
        start       = min(start_at_step, total_steps)
        end         = min(end_at_step,   total_steps)
        if start >= end:
            # Nothing to do — return input latent as-is
            out = latent_image.copy()
            return (out, out)

        sigmas_slice = sigmas[start : end + 1].clone()

        # ── Noise multiplier ──────────────────────────────────────────────────
        # Patch the noise object to scale its output.
        # We wrap generate_noise rather than replacing the object so all
        # other attributes (seed etc.) stay intact.
        if noise_multiplier != 1.0:
            _orig_gen = noise.generate_noise

            def _scaled_noise(latent):
                return _orig_gen(latent) * noise_multiplier

            noise.generate_noise = _scaled_noise

        # ── CFG rescale via model_options patch ───────────────────────────────
        if cfg_rescale > 0.0:
            orig_cfg_function = guider.model_options.get("sampler_cfg_function")

            def _rescaled_cfg(args):
                if orig_cfg_function is not None:
                    result = orig_cfg_function(args)
                else:
                    cond   = args["cond"]
                    uncond = args["uncond"]
                    scale  = args["cond_scale"]
                    result = uncond + scale * (cond - uncond)
                return _apply_cfg_rescale(result, cfg_rescale)

            guider.model_options["sampler_cfg_function"] = _rescaled_cfg

        # ── Preview callback ──────────────────────────────────────────────────
        callback = None
        if preview_method != "none":
            try:
                method_map = {
                    "auto":       latent_preview.LatentPreviewMethod.Auto,
                    "latent2rgb": latent_preview.LatentPreviewMethod.Latent2RGB,
                    "taesd":      latent_preview.LatentPreviewMethod.TAESD,
                }
                previewer = latent_preview.get_previewer(
                    "cuda",
                    method_map.get(preview_method, latent_preview.LatentPreviewMethod.Auto),
                )
                if previewer:
                    pbar = comfy.utils.ProgressBar(len(sigmas_slice) - 1)

                    def callback(step, x0, x, total_steps):
                        preview_bytes = previewer.decode_latent_to_preview_image("JPEG", x0)
                        pbar.update_absolute(step + 1, total_steps, preview_bytes)
            except Exception as e:
                log.warning(f"[{NODE_NAME}] Preview setup failed: {e}")

        # ── Leftover-noise mode ───────────────────────────────────────────────
        # When enabled we don't append a 0-sigma terminator, so the latent
        # remains at the noise level of sigmas_slice[-1].
        # When disabled (default) we ensure the terminator is present so
        # the denoised_output is fully clean.
        if not return_with_leftover_noise and sigmas_slice[-1] != 0:
            sigmas_slice = torch.cat(
                [sigmas_slice, sigmas_slice.new_zeros(1)]
            )

        # ── Run sampling ──────────────────────────────────────────────────────
        latent_samples = latent_image["samples"]
        noise_mask     = latent_image.get("noise_mask")

        samples, denoised = guider.sample(
            noise.generate_noise(latent_image),
            latent_samples,
            sampler,
            sigmas_slice,
            denoise_mask = noise_mask,
            callback     = callback,
            disable_pbar = preview_method == "none",
            seed         = noise.seed,
        )

        samples        = samples.to(comfy.model_management.intermediate_device())
        denoised_out   = denoised.to(comfy.model_management.intermediate_device())

        # ── Restore patched noise generator ──────────────────────────────────
        if noise_multiplier != 1.0:
            noise.generate_noise = _orig_gen

        # ── Restore patched cfg function ──────────────────────────────────────
        if cfg_rescale > 0.0:
            if orig_cfg_function is not None:
                guider.model_options["sampler_cfg_function"] = orig_cfg_function
            else:
                guider.model_options.pop("sampler_cfg_function", None)

        # ── Build outputs ─────────────────────────────────────────────────────
        out              = latent_image.copy()
        out["samples"]   = samples

        out_denoised             = latent_image.copy()
        out_denoised["samples"]  = denoised_out

        return (out, out_denoised)


# ── Registration ──────────────────────────────────────────────────────────────

NODE_CLASS_MAPPINGS = {
    "WinnouganSamplerCustomAdvanced": WinnouganSamplerCustomAdvanced,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WinnouganSamplerCustomAdvanced": "Winnougan SamplerCustomAdvanced",
}

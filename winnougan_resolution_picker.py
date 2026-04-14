import torch

NODE_NAME = "Winnougan Resolution Picker"


class WinnouganResolutionPicker:

    NAME = NODE_NAME
    CATEGORY = "Winnougan"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "optional": {
                "width":      ("INT", {"default": 1024, "min": 64, "max": 8192, "step": 8,
                                       "tooltip": "Override width (used when connected via subgraph)"}),
                "height":     ("INT", {"default": 1024, "min": 64, "max": 8192, "step": 8,
                                       "tooltip": "Override height (used when connected via subgraph)"}),
                "batch_size": ("INT", {"default": 1,    "min": 1,  "max": 64,   "step": 1,
                                       "tooltip": "Number of latents to generate"}),
            },
        }

    RETURN_TYPES = ("INT", "INT", "LATENT")
    RETURN_NAMES = ("WIDTH", "HEIGHT", "LATENT")
    FUNCTION = "pick_resolution"

    def pick_resolution(
        self,
        width=1024,
        height=1024,
        batch_size=1,
    ):
        latent = torch.zeros(
            [batch_size, 16, height // 8, width // 8],
            dtype=torch.float32,
        )
        return (width, height, {"samples": latent})


NODE_CLASS_MAPPINGS = {
    "WinnouganResolutionPicker": WinnouganResolutionPicker,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WinnouganResolutionPicker": "Winnougan Resolution Picker",
}

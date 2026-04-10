import torch

NODE_NAME = "Winnougan Resolution Picker"


class WinnouganResolutionPicker:

    NAME = NODE_NAME
    CATEGORY = "Winnougan"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "hidden": {
                "width":      ("INT", {"default": 1024}),
                "height":     ("INT", {"default": 1024}),
                "batch_size": ("INT", {"default": 1}),
            }
        }

    RETURN_TYPES = ("INT", "INT", "LATENT")
    RETURN_NAMES = ("WIDTH", "HEIGHT", "LATENT")
    FUNCTION = "pick_resolution"

    def pick_resolution(self, width=1024, height=1024, batch_size=1):
        import torch
        latent = torch.zeros(
            [batch_size, 16, height // 8, width // 8],
            dtype=torch.float32
        )
        return (width, height, {"samples": latent})


NODE_CLASS_MAPPINGS = {
    "WinnouganResolutionPicker": WinnouganResolutionPicker,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WinnouganResolutionPicker": "Winnougan Resolution Picker",
}
import torch

NODE_NAME = "Winnougan LTX Resolution Picker"


class WinnouganLTXResolutionPicker:

    NAME = NODE_NAME
    CATEGORY = "Winnougan"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "hidden": {
                "width":      ("INT", {"default": 1280}),
                "height":     ("INT", {"default": 720}),
                "batch_size": ("INT", {"default": 1}),
            }
        }

    RETURN_TYPES = ("INT", "INT", "LATENT")
    RETURN_NAMES = ("WIDTH", "HEIGHT", "LATENT")
    FUNCTION = "pick_resolution"

    def pick_resolution(self, width=1280, height=720, batch_size=1):
        # LTX-Video uses a 32-channel latent space with 1/8 spatial compression
        latent = torch.zeros(
            [batch_size, 128, 1, height // 32, width // 32],
            dtype=torch.float32
        )
        return (width, height, {"samples": latent})


NODE_CLASS_MAPPINGS = {
    "WinnouganLTXResolutionPicker": WinnouganLTXResolutionPicker,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WinnouganLTXResolutionPicker": "Winnougan LTX Resolution Picker",
}
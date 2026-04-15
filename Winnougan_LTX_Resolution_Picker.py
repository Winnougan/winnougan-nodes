import torch

NODE_NAME = "Winnougan LTX Resolution Picker"


class WinnouganLTXResolutionPicker:

    NAME = NODE_NAME
    CATEGORY = "Winnougan"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "width":      ("INT", {"default": 1280, "min": 32, "max": 8192, "step": 32}),
                "height":     ("INT", {"default": 720,  "min": 32, "max": 8192, "step": 32}),
                "length":     ("INT", {"default": 97,   "min": 9,  "max": 4096, "step": 8}),
                "batch_size": ("INT", {"default": 1,    "min": 1,  "max": 64,   "step": 1}),
            }
        }

    RETURN_TYPES = ("INT", "INT", "LATENT")
    RETURN_NAMES = ("WIDTH", "HEIGHT", "LATENT")
    FUNCTION = "pick_resolution"

    def pick_resolution(self, width=1280, height=720, length=97, batch_size=1):
        import logging
        log = logging.getLogger("Winnougan")
        log.warning(f"[LTX Picker] width={width}, height={height}, length={length}, batch={batch_size}")
        latent = torch.zeros(
            [batch_size, 128, ((length - 1) // 8) + 1, height // 32, width // 32],
            dtype=torch.float32
        )
        return (width, height, {"samples": latent})


NODE_CLASS_MAPPINGS = {
    "WinnouganLTXResolutionPicker": WinnouganLTXResolutionPicker,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WinnouganLTXResolutionPicker": "Winnougan LTX Resolution Picker",
}

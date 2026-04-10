import folder_paths
from typing import Union
from nodes import LoraLoader

NODE_NAME = 'Winnougan Power Lora Loader'


def get_lora_by_filename(filename, log_node=None):
    """Get a lora file by its filename from folder_paths."""
    if not filename or filename == "None":
        return None
    loras = folder_paths.get_filename_list("loras")
    for lora in loras:
        if lora == filename or lora.endswith(filename):
            return lora
    if log_node:
        print(f"[{log_node}] WARNING: Could not find lora: {filename}")
    return None


class FlexibleOptionalInputType(dict):
    """A dict subclass that allows any key as a valid optional input."""
    def __init__(self, type, data=None):
        super().__init__(data or {})
        self.type = type

    def __contains__(self, key):
        return True

    def __getitem__(self, key):
        if key in self.keys():
            return super().__getitem__(key)
        return (self.type,)


any_type = "*"


class WinnouganPowerLoraLoader:
    """
    The Winnougan Power Lora Loader is a powerful, flexible node
    to add multiple LoRAs to a model/clip in a single compact node.
    """

    NAME = NODE_NAME
    CATEGORY = "Winnougan"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "optional": FlexibleOptionalInputType(type=any_type, data={
                "model": ("MODEL",),
                "clip": ("CLIP",),
            }),
            "hidden": {},
        }

    RETURN_TYPES = ("MODEL", "CLIP")
    RETURN_NAMES = ("MODEL", "CLIP")
    FUNCTION = "load_loras"

    def load_loras(self, model=None, clip=None, **kwargs):
        """Loops over the provided loras in kwargs and applies valid ones."""
        for key, value in kwargs.items():
            key_upper = key.upper()
            if key_upper.startswith('LORA_') and isinstance(value, dict):
                if 'on' in value and 'lora' in value and 'strength' in value:
                    strength_model = value['strength']
                    strength_clip = value.get('strengthTwo', None)

                    if clip is None:
                        if strength_clip is not None and strength_clip != 0:
                            print(f'[{NODE_NAME}] WARNING: Received clip strength even though no clip supplied!')
                        strength_clip = 0
                    else:
                        strength_clip = strength_clip if strength_clip is not None else strength_model

                    if value['on'] and (strength_model != 0 or strength_clip != 0):
                        lora = get_lora_by_filename(value['lora'], log_node=NODE_NAME)
                        if model is not None and lora is not None:
                            model, clip = LoraLoader().load_lora(
                                model, clip, lora, strength_model, strength_clip
                            )

        return (model, clip)

    @classmethod
    def get_enabled_loras_from_prompt_node(cls, prompt_node: dict) -> list[dict[str, Union[str, float]]]:
        """Gets enabled loras of a node within a server prompt."""
        result = []
        for name, lora in prompt_node['inputs'].items():
            if name.startswith('lora_') and isinstance(lora, dict) and lora.get('on'):
                lora_file = get_lora_by_filename(lora['lora'], log_node=cls.NAME)
                if lora_file is not None:
                    lora_dict = {
                        'name': lora['lora'],
                        'strength': lora['strength'],
                        'path': folder_paths.get_full_path("loras", lora_file)
                    }
                    if 'strengthTwo' in lora:
                        lora_dict['strength_clip'] = lora['strengthTwo']
                    result.append(lora_dict)
        return result


# ── ComfyUI registration ──────────────────────────────────────────────────────
NODE_CLASS_MAPPINGS = {
    "WinnouganPowerLoraLoader": WinnouganPowerLoraLoader,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WinnouganPowerLoraLoader": "Winnougan Power Lora Loader",
}
from .winnougan_power_lora_loader import (
    NODE_CLASS_MAPPINGS as LORA_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as LORA_DISPLAY,
)
from .winnougan_resolution_picker import (
    NODE_CLASS_MAPPINGS as RES_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as RES_DISPLAY,
)
from .Winnougan_LTX_Resolution_Picker import (
    NODE_CLASS_MAPPINGS as LTX_RES_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as LTX_RES_DISPLAY,
)
from .winnougan_cache_dit import (
    NODE_CLASS_MAPPINGS as CACHE_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as CACHE_DISPLAY,
)
from .winnougan_cache_dit_ltx2 import (
    NODE_CLASS_MAPPINGS as LTX2_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as LTX2_DISPLAY,
)
from .winnougan_cache_dit_wan import (
    NODE_CLASS_MAPPINGS as WAN_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as WAN_DISPLAY,
)

NODE_CLASS_MAPPINGS = {
    **LORA_MAPPINGS,
    **RES_MAPPINGS,
    **LTX_RES_MAPPINGS,
    **CACHE_MAPPINGS,
    **LTX2_MAPPINGS,
    **WAN_MAPPINGS,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    **LORA_DISPLAY,
    **RES_DISPLAY,
    **LTX_RES_DISPLAY,
    **CACHE_DISPLAY,
    **LTX2_DISPLAY,
    **WAN_DISPLAY,
}

WEB_DIRECTORY = "./js"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
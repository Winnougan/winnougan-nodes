"""
Winnougan Cache & VRAM Cleanup
───────────────────────────────
Passthrough node that cleans up GPU cache and VRAM between nodes.
Accepts and returns any type — drop it anywhere in your workflow.
Execution time is reported back to the JS frontend for the digital timer display.
"""

import time
import logging
import gc
import torch

log = logging.getLogger("Winnougan")

NODE_NAME = "Winnougan Cache Cleanup"


class WinnouganCacheCleanup:
    NAME     = NODE_NAME
    CATEGORY = "Winnougan"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "optional": {
                "any_input": ("*", {}),
                "empty_cache": ("BOOLEAN", {
                    "default": True,
                    "label_on":  "cache clear on",
                    "label_off": "cache clear off",
                }),
                "gc_collect": ("BOOLEAN", {
                    "default": True,
                    "label_on":  "gc on",
                    "label_off": "gc off",
                }),
            }
        }

    # Use * for passthrough
    RETURN_TYPES  = ("*",)
    RETURN_NAMES  = ("any_output",)
    FUNCTION      = "cleanup"
    OUTPUT_NODE   = True

    def cleanup(self, any_input=None, empty_cache=True, gc_collect=True):
        t_start = time.perf_counter()

        if gc_collect:
            gc.collect()

        if empty_cache and torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.ipc_collect()

        elapsed = time.perf_counter() - t_start

        vram_free  = 0
        vram_total = 0
        if torch.cuda.is_available():
            mem = torch.cuda.mem_get_info()
            vram_free  = mem[0] / 1024**3
            vram_total = mem[1] / 1024**3

        log.info(
            f"[{NODE_NAME}] Cleanup done in {elapsed*1000:.1f}ms | "
            f"VRAM free: {vram_free:.2f}GB / {vram_total:.2f}GB"
        )

        return {
            "ui": {
                "elapsed_ms": [round(elapsed * 1000, 1)],
                "vram_free_gb": [round(vram_free, 2)],
                "vram_total_gb": [round(vram_total, 2)],
            },
            "result": (any_input,)
        }


NODE_CLASS_MAPPINGS = {
    "WinnouganCacheCleanup": WinnouganCacheCleanup,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WinnouganCacheCleanup": "Winnougan Cache Cleanup",
}

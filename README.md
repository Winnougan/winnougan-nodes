<img width="687" height="687" alt="download (15)" src="https://github.com/user-attachments/assets/bdb2438c-c654-4df0-8495-24334087fa1c" />

Winnougan Nodes for ComfyUI
A suite of high-quality custom nodes for ComfyUI, split into two families: the Winnougan general-purpose nodes and the WINT8 INT8-optimized nodes for quantized model inference.

Winnougan Nodes
A set of polished, production-ready utility nodes with a distinctive green animated UI.

✍️ Winnougan Prompt Encoder
A combined positive/negative CLIP text encoder in a single node. Green section for positive prompt, red section for negative. Includes a zero_neg toggle that outputs ConditioningZeroOut for the negative slot — required for models like Flux2, Kl-F8-Anime2, and Z-Image Turbo where a real negative embedding breaks inference.

Two CLIP inputs (positive and negative)
Multiline text areas for both prompts
Zero neg toggle replaces the negative conditioning with a zeroed tensor
Always outputs both positive and negative CONDITIONING — fully ksampler-ready

👉👈 Winnougan CLIP Loader
Single or dual CLIP loader with full dtype support including fp16, bf16, fp8_e4m3fn, fp8_e4m3fn_fast, fp8_e5m2, nvfp4, mxfp8, and GGUF via ComfyUI-GGUF. Toggle between single and dual CLIP loading in one node.

👉👈 Winnougan Power LoRA Loader
Multi-LoRA loader in a single compact node. Add as many LoRAs as you need with individual on/off toggles, strength controls, and a global toggle all button. Live search dialog for finding LoRAs quickly. Supports wired LoRA filename inputs from other nodes.

👉👈 Winnougan Model Loader
Model loader with full dtype and format support.

📐 Winnougan Resolution Picker / LTX Resolution Picker
Preset and custom resolution pickers with aspect ratio thumbnails and latent size preview. The LTX variant includes presets for LTX-Video 2.3 at 720p, 1080p, 2K and 4K, plus Wan2.2 I2V and T2V presets.

⚡ Winnougan KSampler / Sampler Custom Advanced
Styled sampler nodes with the Winnougan visual theme.

🗜️ Winnougan Cache DiT / Cache DiT LTX2 / Cache DiT WAN
Cached DiT nodes for LTX, LTX2, and WAN models.

Introducing Winnougan's Nodes Suite:
<img width="1024" height="1024" alt="Klein9b_00032_" src="https://github.com/user-attachments/assets/09a02c23-2700-4df2-80e4-63e9dad697cd" />

1. Power Lora Loader Stack
2. Resolution Picker for HD image generation
3. Resolution Picker for Wan and LTX video generation

Supercharge your workflow inside ComfyUI with the Winnougan Lora Power Loader — a fast, flexible, and intuitive way to manage all your favorite LoRAs in one place.

Instead of manually stacking, hunting, and reloading LoRAs every time you tweak a prompt, this custom node lets you instantly add, remove, and organize LoRAs on the fly 🧩✨. Build your perfect style mix in seconds and iterate like a pro without breaking your flow.

Whether you're fine-tuning character consistency, blending artistic styles, or experimenting with wild combinations, the Power Loader keeps everything smooth, fast, and creative 🚀🎨.

Features:

⚡ Instant add/remove LoRAs during workflow
🎛️ Clean, organized LoRA stacking system
🧠 Designed for rapid iteration and experimentation
🎨 Perfect for style mixing, character control, and creative workflows
💡 Built for speed, simplicity, and maximum creative freedom

Make your LoRA workflow feel less like setup… and more like play 🎮✨
Screenshots of the lora in action. Just start typing the lora name and it'll populate for you.
You can right-click on your mouse to activate the widget to move up, move down, toggle on or off or remove each lora
<img width="571" height="380" alt="2026-04-10_12-27-16" src="https://github.com/user-attachments/assets/383f36de-bcf2-4d3f-9c0c-ab7068e5de8d" />
<img width="580" height="459" alt="2026-04-10_12-26-47" src="https://github.com/user-attachments/assets/41fce542-2c49-4e11-89e0-d1416f37e123" />
<img width="593" height="745" alt="2026-04-10_12-30-24" src="https://github.com/user-attachments/assets/0480ecce-9070-40e7-a109-f98b263fd137" />

Introducing new Cache Dit nodes:
What it does
DiT models (Diffusion Transformers like Flux, Z-Image, Qwen-Image, LTX, Wan) run their full transformer every single diffusion step. But here's the insight: consecutive diffusion steps produce very similar transformer outputs, especially in the middle of the denoising process. Cache DiT exploits this.
The mechanism in plain terms:

During a 20-step generation, instead of running the transformer 20 times, it might only run it 13 times and reuse ("cache") the output from the previous step for the other 7. The cached output is close enough to what the real output would have been that the final image quality is barely affected, but you save the compute cost of those 7 full transformer passes.
The three controls:

warmup_steps — how many steps at the start always compute for real. The first few diffusion steps have the biggest changes in output so caching there would hurt quality. Setting this to 3 means steps 1–3 always run fully.

skip_interval — after warmup, how often to reuse the cache. A value of 2 means: compute, reuse, compute, reuse. A value of 3 means: compute, compute, reuse, compute, compute, reuse — more conservative, better quality, less speedup.

noise_scale — a tiny amount of random noise added to cached outputs. For images leave this at 0. For video models (LTX, Wan) a value like 0.01 prevents static "frozen" artifacts from appearing in frames where the cache was reused.

Auto-detection — when you leave warmup and skip at 0, the node reads the transformer class name and applies model-specific defaults. Z-Image gets a longer warmup (8 steps) because it's more quality-sensitive. Flux gets lighter caching (warmup 3, skip every 2nd). Video models get noise injection turned on automatically.

Expected speedup — roughly 1.3x to 1.8x depending on the model and settings, with negligible quality loss at conservative settings. The summary printed after each run shows you the exact hit rate and estimated speedup so you can tune it.

New nodes:
Clip loader. This one's a doozy. You can load one or two clips by toggling them on or off. And it does regular clips or GGUF clips! No more searching for single or dual clip loaders and then scrounging around looking for GGUF clips. We got you bro.

Diffusion and GGUF model loader all-in-one (AIO). I got you bro, I promise! This one's amazing, switch between your regular diffuser (mxfp8 or nvpf4 or fp8) and your GGUF model. I've included patching Sageattention and KV cache! AIO!

More to come!

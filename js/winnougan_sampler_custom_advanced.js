import { app } from "../../scripts/app.js";

const NODE_TYPE = "WinnouganSamplerCustomAdvanced";

// ── Breathing green glow ──────────────────────────────────────────────────────
function drawGreenGlow(ctx, node) {
    if (node.flags?.collapsed) return;
    const w    = node.size[0];
    const h    = node.size[1] + LiteGraph.NODE_TITLE_HEIGHT;
    const yOff = -LiteGraph.NODE_TITLE_HEIGHT;
    const r    = 8;
    const t     = Date.now() / 1000;
    const pulse = 0.5 + 0.5 * Math.sin(t * (2 * Math.PI / 3));
    app.graph.setDirtyCanvas(true, false);
    ctx.save();
    ctx.shadowColor  = "#4ade80";
    ctx.shadowBlur   = 18 + pulse * 22;
    ctx.strokeStyle  = "#4ade80";
    ctx.lineWidth    = 2;
    ctx.globalAlpha  = 0.30 + pulse * 0.40;
    ctx.beginPath();
    ctx.roundRect(0, yOff, w, h, r);
    ctx.stroke();
    ctx.shadowBlur   = 8 + pulse * 8;
    ctx.globalAlpha  = 0.55 + pulse * 0.35;
    ctx.lineWidth    = 1.5;
    ctx.beginPath();
    ctx.roundRect(1, yOff + 1, w - 2, h - 2, r);
    ctx.stroke();
    ctx.restore();
}

// ── Small pill helper ─────────────────────────────────────────────────────────
function drawPill(ctx, label, x, y, bg, border, textColor) {
    ctx.font = "bold 9px monospace";
    const tw  = ctx.measureText(label).width;
    const pad = 5;
    const pw  = tw + pad * 2;
    const ph  = 14;
    ctx.beginPath();
    ctx.roundRect(x - pw, y, pw, ph, 4);
    ctx.fillStyle   = bg;
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth   = 1;
    ctx.stroke();
    ctx.fillStyle    = textColor;
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x - pw / 2, y + ph / 2);
}

// ── Extension ─────────────────────────────────────────────────────────────────
app.registerExtension({
    name: "Winnougan.SamplerCustomAdvanced",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_TYPE) return;

        // ── onNodeCreated ─────────────────────────────────────────────────────
        const origCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            origCreated?.call(this);

            this.color   = "#1a3a1a";
            this.bgcolor = "#0f2a0f";
            this.title   = "🌿 Winnougan SamplerCustomAdvanced";

            // ── Sync widgets that should collapse when inactive ───────────────
            // cfg_rescale detail: always visible (it's just a float, no sub-widgets)
            // return_with_leftover_noise: always visible
            // preview_method: always visible
            // start/end at step: always visible
            // noise_multiplier: always visible
            // → Nothing to hide, all widgets are simple values.
            // But we redraw on any change so pills stay current.
            const watchNames = [
                "cfg_rescale", "return_with_leftover_noise",
                "preview_method", "noise_multiplier",
                "start_at_step", "end_at_step",
            ];
            for (const wname of watchNames) {
                const ww = this.widgets?.find(w => w.name === wname);
                if (!ww) continue;
                const origCb = ww.callback;
                ww.callback = (val) => {
                    app.graph.setDirtyCanvas(true, false);
                    origCb?.call(ww, val);
                };
            }
        };

        // ── Breathing glow ────────────────────────────────────────────────────
        const origBg = nodeType.prototype.onDrawBackground;
        nodeType.prototype.onDrawBackground = function (ctx) {
            origBg?.call(this, ctx);
            drawGreenGlow(ctx, this);
        };

        // ── Foreground: badge + status pills ──────────────────────────────────
        const origFg = nodeType.prototype.onDrawForeground;
        nodeType.prototype.onDrawForeground = function (ctx) {
            origFg?.call(this, ctx);
            if (this.flags?.collapsed) return;

            const W = this.size[0];
            const w = (name) => this.widgets?.find(w => w.name === name);

            ctx.save();
            ctx.shadowBlur = 0;

            // ── ⚡ WINNOUGAN badge ─────────────────────────────────────────────
            ctx.font        = "bold 10px sans-serif";
            ctx.textAlign   = "right";
            ctx.fillStyle   = "#4ade80";
            ctx.shadowColor = "#4ade80";
            ctx.shadowBlur  = 6;
            ctx.fillText("⚡ WINNOUGAN", W - 8, 14);
            ctx.shadowBlur  = 0;
            ctx.shadowColor = "transparent";

            // ── Status pills row (top-right, below badge) ─────────────────────
            // We stack pills from right to left, each 4px apart.
            let pillX = W - 8;
            const pillY = 46;

            // preview method pill
            const preview = w("preview_method")?.value ?? "auto";
            if (preview !== "none") {
                const previewColors = {
                    "auto":       ["#0a1a2a", "#1a5a8a", "#55aaff"],
                    "latent2rgb": ["#1a1a0a", "#6a6a1a", "#eebb33"],
                    "taesd":      ["#0a1a0a", "#1a6a3a", "#44ddaa"],
                };
                const [bg, border, tc] = previewColors[preview] ?? previewColors["auto"];
                drawPill(ctx, `👁 ${preview}`, pillX, pillY, bg, border, tc);
                pillX -= (ctx.measureText(`👁 ${preview}`).width + 20);
            }

            // cfg_rescale pill
            const cfgR = w("cfg_rescale")?.value ?? 0;
            if (cfgR > 0) {
                drawPill(ctx, `cfg↓${cfgR.toFixed(2)}`, pillX, pillY,
                    "#2a1a0a", "#8a5a1a", "#ffcc66");
                pillX -= (ctx.measureText(`cfg↓${cfgR.toFixed(2)}`).width + 20);
            }

            // noise multiplier pill
            const nm = w("noise_multiplier")?.value ?? 1.0;
            if (Math.abs(nm - 1.0) > 0.001) {
                drawPill(ctx, `η×${nm.toFixed(2)}`, pillX, pillY,
                    "#1a0a2a", "#6a1a9a", "#cc77ff");
                pillX -= (ctx.measureText(`η×${nm.toFixed(2)}`).width + 20);
            }

            // ── Step-range indicator (bottom of node) ─────────────────────────
            const start  = w("start_at_step")?.value  ?? 0;
            const end    = w("end_at_step")?.value     ?? 10000;
            const leftover = w("return_with_leftover_noise")?.value ?? false;

            const endLabel  = end >= 10000 ? "end" : String(end);
            const rangeText = `steps ${start} → ${endLabel}` + (leftover ? "  ·  leftover noise" : "");

            ctx.font         = "10px monospace";
            ctx.textAlign    = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle    = leftover ? "#ffcc44" : "#3a7a3a";
            ctx.shadowColor  = leftover ? "#ffcc44" : "transparent";
            ctx.shadowBlur   = leftover ? 4 : 0;
            ctx.fillText(rangeText, W / 2, this.size[1] - 10);

            ctx.restore();
        };

        // ── computeSize ───────────────────────────────────────────────────────
        nodeType.prototype.computeSize = function () {
            // 5 connection inputs + 9 widget rows
            const widgetH = LiteGraph.NODE_WIDGET_HEIGHT ?? 20;
            const gap     = 4;
            const TH      = LiteGraph.NODE_TITLE_HEIGHT;
            const rows    = 9; // start, end, noise_mult, cfg_rescale, leftover, preview
            const h = TH + 8 + rows * (widgetH + gap) + 28; // +28 for step range label
            return [340, Math.max(h, 260)];
        };
    },
});

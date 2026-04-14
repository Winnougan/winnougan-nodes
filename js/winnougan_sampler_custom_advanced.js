import { app } from "../../scripts/app.js";

const NODE_TYPE = "WinnouganSamplerCustomAdvanced";

// ── Sparkle system ────────────────────────────────────────────────────────────
class SparkleSystem {
    constructor(maxParticles = 14) {
        this.particles = [];
        this.max = maxParticles;
    }
    _spawn(w, h, yOff) {
        const perim = 2 * (w + h);
        let d = Math.random() * perim;
        let x, y;
        if (d < w)              { x = d;               y = yOff; }
        else if (d < w + h)     { x = w;                y = yOff + (d - w); }
        else if (d < 2 * w + h) { x = w - (d - w - h);  y = yOff + h; }
        else                    { x = 0;                y = yOff + h - (d - 2 * w - h); }
        this.particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 0.6,
            vy: (Math.random() - 0.5) * 0.6,
            life: 1.0,
            decay: 0.008 + Math.random() * 0.012,
            size: 1.2 + Math.random() * 2.0,
        });
    }
    update(w, h, yOff) {
        while (this.particles.length < this.max) this._spawn(w, h, yOff);
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx; p.y += p.vy; p.life -= p.decay;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
    }
    draw(ctx) {
        for (const p of this.particles) {
            ctx.save();
            ctx.globalAlpha = p.life * 0.9;
            ctx.shadowColor = "#a0ffc0"; ctx.shadowBlur = 6 + p.size * 2;
            ctx.fillStyle = "#d0ffe0";
            const s = p.size;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x + s*0.3, p.y);
            ctx.lineTo(p.x, p.y + s); ctx.lineTo(p.x - s*0.3, p.y);
            ctx.closePath(); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(p.x - s, p.y); ctx.lineTo(p.x, p.y + s*0.3);
            ctx.lineTo(p.x + s, p.y); ctx.lineTo(p.x, p.y - s*0.3);
            ctx.closePath(); ctx.fill();
            ctx.restore();
        }
    }
}

// ── Enhanced breathing glow with sparkles ─────────────────────────────────────
function drawEnhancedGlow(ctx, node, sparkles) {
    if (node.flags?.collapsed) return;
    const w = node.size[0], h = node.size[1] + LiteGraph.NODE_TITLE_HEIGHT;
    const yOff = -LiteGraph.NODE_TITLE_HEIGHT, r = 8;
    const t = Date.now() / 1000;
    const pulse = 0.5 + 0.5 * Math.sin(t * (2 * Math.PI / 3));
    const pulse2 = 0.5 + 0.5 * Math.sin(t * (2 * Math.PI / 5) + 1.0);
    app.graph.setDirtyCanvas(true, false);
    ctx.save();
    ctx.shadowColor = "#22dd66"; ctx.shadowBlur = 28 + pulse * 30;
    ctx.strokeStyle = "#22dd66"; ctx.lineWidth = 1;
    ctx.globalAlpha = 0.12 + pulse * 0.15;
    ctx.beginPath(); ctx.roundRect(-2, yOff-2, w+4, h+4, r+2); ctx.stroke();
    ctx.shadowColor = "#4ade80"; ctx.shadowBlur = 18 + pulse * 22;
    ctx.strokeStyle = "#4ade80"; ctx.lineWidth = 2;
    ctx.globalAlpha = 0.30 + pulse * 0.40;
    ctx.beginPath(); ctx.roundRect(0, yOff, w, h, r); ctx.stroke();
    ctx.shadowBlur = 8 + pulse2 * 10; ctx.globalAlpha = 0.55 + pulse2 * 0.35;
    ctx.lineWidth = 1.5; ctx.strokeStyle = "#6aefa0";
    ctx.beginPath(); ctx.roundRect(1, yOff+1, w-2, h-2, r); ctx.stroke();
    ctx.shadowColor = "#a0ffc0"; ctx.shadowBlur = 8;
    ctx.globalAlpha = 0.3 + pulse * 0.5; ctx.fillStyle = "#a0ffc0";
    const dotR = 2 + pulse * 1.5;
    for (const [cx, cy] of [[2,yOff+2],[w-2,yOff+2],[2,yOff+h-2],[w-2,yOff+h-2]]) {
        ctx.beginPath(); ctx.arc(cx, cy, dotR, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
    sparkles.update(w, h, yOff);
    sparkles.draw(ctx);
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
            this._sparkles = new SparkleSystem(14);
            this.title   = "👉👈 Winnougan SamplerCustomAdvanced";

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
            if (!this._sparkles) this._sparkles = new SparkleSystem(14);
            drawEnhancedGlow(ctx, this, this._sparkles);
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
            ctx.fillText("⚡ WINNOUGAN", W - 28, 14);
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

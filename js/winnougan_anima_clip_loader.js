import { app } from "../../scripts/app.js";

const NODE_TYPE = "WinnouganAnimaCLIPLoader";

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
            ctx.globalAlpha  = p.life * 0.9;
            ctx.shadowColor  = "#a0ffc0";
            ctx.shadowBlur   = 6 + p.size * 2;
            ctx.fillStyle    = "#d0ffe0";
            const s = p.size;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y - s);
            ctx.lineTo(p.x + s * 0.3, p.y);
            ctx.lineTo(p.x, p.y + s);
            ctx.lineTo(p.x - s * 0.3, p.y);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(p.x - s, p.y);
            ctx.lineTo(p.x, p.y + s * 0.3);
            ctx.lineTo(p.x + s, p.y);
            ctx.lineTo(p.x, p.y - s * 0.3);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
    }
}

// ── Enhanced breathing glow with multi-layer bloom ────────────────────────────
function drawEnhancedGlow(ctx, node, sparkles) {
    if (node.flags?.collapsed) return;

    const w    = node.size[0];
    const h    = node.size[1] + LiteGraph.NODE_TITLE_HEIGHT;
    const yOff = -LiteGraph.NODE_TITLE_HEIGHT;
    const r    = 8;
    const t     = Date.now() / 1000;
    const pulse  = 0.5 + 0.5 * Math.sin(t * (2 * Math.PI / 3));
    const pulse2 = 0.5 + 0.5 * Math.sin(t * (2 * Math.PI / 5) + 1.0);

    app.graph.setDirtyCanvas(true, false);
    ctx.save();

    // Layer 1: Wide outer bloom
    ctx.shadowColor = "#22dd66"; ctx.shadowBlur = 28 + pulse * 30;
    ctx.strokeStyle = "#22dd66"; ctx.lineWidth  = 1;
    ctx.globalAlpha = 0.12 + pulse * 0.15;
    ctx.beginPath(); ctx.roundRect(-2, yOff - 2, w + 4, h + 4, r + 2); ctx.stroke();

    // Layer 2: Main glow
    ctx.shadowColor = "#4ade80"; ctx.shadowBlur = 18 + pulse * 22;
    ctx.strokeStyle = "#4ade80"; ctx.lineWidth  = 2;
    ctx.globalAlpha = 0.30 + pulse * 0.40;
    ctx.beginPath(); ctx.roundRect(0, yOff, w, h, r); ctx.stroke();

    // Layer 3: Inner rim
    ctx.shadowBlur  = 8 + pulse2 * 10;
    ctx.globalAlpha = 0.55 + pulse2 * 0.35;
    ctx.lineWidth   = 1.5; ctx.strokeStyle = "#6aefa0";
    ctx.beginPath(); ctx.roundRect(1, yOff + 1, w - 2, h - 2, r); ctx.stroke();

    // Layer 4: Corner accents
    ctx.shadowColor = "#a0ffc0"; ctx.shadowBlur = 8;
    ctx.globalAlpha = 0.3 + pulse * 0.5; ctx.fillStyle = "#a0ffc0";
    const dotR = 2 + pulse * 1.5;
    for (const [cx, cy] of [[2, yOff+2],[w-2, yOff+2],[2, yOff+h-2],[w-2, yOff+h-2]]) {
        ctx.beginPath(); ctx.arc(cx, cy, dotR, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    sparkles.update(w, h, yOff);
    sparkles.draw(ctx);
}

// ── Toggle state badge colours ────────────────────────────────────────────────
const TOGGLE_ON  = { text: "#4ade80", shadow: "#4ade80", blur: 5 };
const TOGGLE_OFF = { text: "#4a7a4a", shadow: "transparent", blur: 0 };

// ── Extension ─────────────────────────────────────────────────────────────────
app.registerExtension({
    name: "Winnougan.AnimaCLIPLoader",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_TYPE) return;

        // ── onNodeCreated ─────────────────────────────────────────────────────
        const origCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            origCreated?.call(this);

            this.color   = "#1a3a1a";
            this.bgcolor = "#0f2a0f";
            this.title   = "👉👈 Winnougan Anima CLIP Loader";
            this._sparkles = new SparkleSystem(14);

            const w = (name) => this.widgets?.find(w => w.name === name);
            ["use_calibration", "use_alignment", "alignment_strength", "output_scale"].forEach(name => {
                const widget = w(name);
                if (!widget) return;
                const origCb = widget.callback;
                widget.callback = (val) => {
                    app.graph.setDirtyCanvas(true, false);
                    origCb?.call(widget, val);
                };
            });
        };

        // ── Enhanced glow + sparkles ──────────────────────────────────────────
        const origBg = nodeType.prototype.onDrawBackground;
        nodeType.prototype.onDrawBackground = function (ctx) {
            origBg?.call(this, ctx);
            if (!this._sparkles) this._sparkles = new SparkleSystem(14);
            drawEnhancedGlow(ctx, this, this._sparkles);
        };

        // ── Foreground: badges + status footer ────────────────────────────────
        const origFg = nodeType.prototype.onDrawForeground;
        nodeType.prototype.onDrawForeground = function (ctx) {
            origFg?.call(this, ctx);
            if (this.flags?.collapsed) return;

            const W = this.size[0];
            const H = this.size[1];
            const t = Date.now() / 1000;
            const pulse = 0.5 + 0.5 * Math.sin(t * (2 * Math.PI / 3));
            const w = (name) => this.widgets?.find(w => w.name === name);

            const useCalib      = w("use_calibration")?.value   ?? false;
            const useAlign      = w("use_alignment")?.value      ?? false;
            const alignStrength = w("alignment_strength")?.value ?? 0.0;
            const outScale      = w("output_scale")?.value        ?? 1.0;

            ctx.save();

            // ── ⚡ WINNOUGAN badge — extra spacing from right edge ────────────
            ctx.font        = "bold 10px sans-serif";
            ctx.textAlign   = "right";
            ctx.fillStyle   = "#4ade80";
            ctx.shadowColor = "#4ade80";
            ctx.shadowBlur  = 6 + pulse * 4;
            ctx.fillText("⚡ WINNOUGAN", W - 28, 14);

            // ANIMA sub-badge
            ctx.font        = "bold 9px monospace";
            ctx.fillStyle   = "#2dbd60";
            ctx.shadowBlur  = 3;
            ctx.fillText("ANIMA · QWEN3.5-4B", W - 28, 25);

            ctx.shadowBlur  = 0;
            ctx.shadowColor = "transparent";

            // ── Footer status area ────────────────────────────────────────────
            const footerY = H - 34;

            const calibC = useCalib ? TOGGLE_ON : TOGGLE_OFF;
            ctx.font = "bold 10px sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
            ctx.fillStyle = calibC.text; ctx.shadowColor = calibC.shadow; ctx.shadowBlur = calibC.blur;
            ctx.fillText(useCalib ? "◉ CALIB" : "◎ CALIB", 10, footerY);

            const alignC = useAlign ? TOGGLE_ON : TOGGLE_OFF;
            ctx.fillStyle = alignC.text; ctx.shadowColor = alignC.shadow; ctx.shadowBlur = alignC.blur;
            ctx.fillText(useAlign ? "◉ ALIGN" : "◎ ALIGN", 90, footerY);

            ctx.shadowBlur = 0; ctx.shadowColor = "transparent";

            if (useAlign) {
                const strengthLabel = `str: ${alignStrength.toFixed(2)}`;
                const pillAlpha = 0.4 + alignStrength * 0.6;
                ctx.font = "bold 9px monospace";
                const tw = ctx.measureText(strengthLabel).width;
                const pad = 5, pw = tw + pad * 2, ph = 14;
                const px = W - 28 - pw, py = footerY - 7;
                ctx.globalAlpha = pillAlpha;
                ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 4);
                ctx.fillStyle = "#1a2a1a"; ctx.fill();
                ctx.strokeStyle = "#3a6a3a"; ctx.lineWidth = 1; ctx.stroke();
                ctx.globalAlpha = 1; ctx.fillStyle = "#9aefa0";
                ctx.textAlign = "center"; ctx.textBaseline = "middle";
                ctx.fillText(strengthLabel, px + pw / 2, py + ph / 2);
            }

            const row2Y = footerY + 18;
            const scaleLabel = `scale: ×${outScale.toFixed(1)}`;
            const scaleModified = Math.abs(outScale - 1.0) > 0.001;
            ctx.font = "bold 9px monospace";
            const tw2 = ctx.measureText(scaleLabel).width;
            const pad2 = 5, pw2 = tw2 + pad2 * 2, ph2 = 14;
            const px2 = W - 28 - pw2, py2 = row2Y - 7;
            ctx.beginPath(); ctx.roundRect(px2, py2, pw2, ph2, 4);
            ctx.fillStyle = scaleModified ? "#2a2a0a" : "#1a2a1a"; ctx.fill();
            ctx.strokeStyle = scaleModified ? "#8a8a1a" : "#3a5a3a"; ctx.lineWidth = 1; ctx.stroke();
            ctx.fillStyle = scaleModified ? "#ffee66" : "#7acc7a";
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(scaleLabel, px2 + pw2 / 2, py2 + ph2 / 2);

            ctx.restore();
        };

        // ── computeSize ───────────────────────────────────────────────────────
        nodeType.prototype.computeSize = function () {
            const baseW = 340, widgetH = LiteGraph.NODE_WIDGET_HEIGHT ?? 20;
            const gap = 4, TH = LiteGraph.NODE_TITLE_HEIGHT, numSlots = 5;
            const h = TH + 8 + numSlots * (widgetH + gap) + 50;
            return [baseW, Math.max(h, 190)];
        };
    },
});

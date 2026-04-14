import { app } from "../../scripts/app.js";

const NODE_TYPE = "WinnouganModelLoader";

// ── Sparkle system ────────────────────────────────────────────────────────────
// Persistent sparkle particles that float along the node border
class SparkleSystem {
    constructor(maxParticles = 14) {
        this.particles = [];
        this.max = maxParticles;
    }

    _spawn(w, h, yOff) {
        // Pick a random edge position
        const perim = 2 * (w + h);
        let d = Math.random() * perim;
        let x, y;
        if (d < w)              { x = d;           y = yOff; }
        else if (d < w + h)     { x = w;            y = yOff + (d - w); }
        else if (d < 2 * w + h) { x = w - (d - w - h); y = yOff + h; }
        else                    { x = 0;            y = yOff + h - (d - 2 * w - h); }

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
        // Spawn new sparkles
        while (this.particles.length < this.max) {
            this._spawn(w, h, yOff);
        }
        // Tick existing
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x    += p.vx;
            p.y    += p.vy;
            p.life -= p.decay;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
    }

    draw(ctx) {
        for (const p of this.particles) {
            const a = p.life * 0.9;
            ctx.save();
            ctx.globalAlpha  = a;
            ctx.shadowColor  = "#a0ffc0";
            ctx.shadowBlur   = 6 + p.size * 2;
            ctx.fillStyle    = "#d0ffe0";

            // 4-point star
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
    const pulse = 0.5 + 0.5 * Math.sin(t * (2 * Math.PI / 3));
    const pulse2 = 0.5 + 0.5 * Math.sin(t * (2 * Math.PI / 5) + 1.0); // slower secondary

    app.graph.setDirtyCanvas(true, false);

    ctx.save();

    // Layer 1: Wide outer bloom
    ctx.shadowColor  = "#22dd66";
    ctx.shadowBlur   = 28 + pulse * 30;
    ctx.strokeStyle  = "#22dd66";
    ctx.lineWidth    = 1;
    ctx.globalAlpha  = 0.12 + pulse * 0.15;
    ctx.beginPath();
    ctx.roundRect(-2, yOff - 2, w + 4, h + 4, r + 2);
    ctx.stroke();

    // Layer 2: Main glow border
    ctx.shadowColor  = "#4ade80";
    ctx.shadowBlur   = 18 + pulse * 22;
    ctx.strokeStyle  = "#4ade80";
    ctx.lineWidth    = 2;
    ctx.globalAlpha  = 0.30 + pulse * 0.40;
    ctx.beginPath();
    ctx.roundRect(0, yOff, w, h, r);
    ctx.stroke();

    // Layer 3: Inner rim
    ctx.shadowBlur   = 8 + pulse2 * 10;
    ctx.globalAlpha  = 0.55 + pulse2 * 0.35;
    ctx.lineWidth    = 1.5;
    ctx.strokeStyle  = "#6aefa0";
    ctx.beginPath();
    ctx.roundRect(1, yOff + 1, w - 2, h - 2, r);
    ctx.stroke();

    // Layer 4: Corner accent dots
    ctx.shadowColor = "#a0ffc0";
    ctx.shadowBlur  = 8;
    ctx.globalAlpha = 0.3 + pulse * 0.5;
    ctx.fillStyle   = "#a0ffc0";
    const dotR = 2 + pulse * 1.5;
    const corners = [
        [2, yOff + 2], [w - 2, yOff + 2],
        [2, yOff + h - 2], [w - 2, yOff + h - 2],
    ];
    for (const [cx, cy] of corners) {
        ctx.beginPath();
        ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();

    // Sparkles
    sparkles.update(w, h, yOff);
    sparkles.draw(ctx);
}

// ── Model list filtering ──────────────────────────────────────────────────────
function isGguf(name) {
    return name.toLowerCase().endsWith(".gguf");
}

// ── Extension ─────────────────────────────────────────────────────────────────
app.registerExtension({
    name: "Winnougan.ModelLoader",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_TYPE) return;

        // ── Node created ──────────────────────────────────────────────────────
        const origOnNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            origOnNodeCreated?.call(this);

            this.color   = "#1a3a1a";
            this.bgcolor = "#0f2a0f";
            this.title   = "👉👈 Winnougan Model Loader";

            // Init sparkle system per node instance
            this._sparkles = new SparkleSystem(14);

            // Cache the full combined model list from the combo widget
            const modelWidget      = this.widgets?.find(w => w.name === "model_name");
            const loaderTypeWidget = this.widgets?.find(w => w.name === "loader_type");

            if (modelWidget && loaderTypeWidget) {
                if (!this._allModelNames) {
                    this._allModelNames = [...(modelWidget.options?.values ?? [])];
                }

                const applyFilter = (loaderType) => {
                    const all      = this._allModelNames;
                    const filtered = loaderType === "GGUF"
                        ? all.filter(isGguf)
                        : all.filter(m => !isGguf(m));

                    modelWidget.options.values = filtered.length ? filtered : all;

                    if (!filtered.includes(modelWidget.value)) {
                        modelWidget.value = filtered[0] ?? modelWidget.value;
                    }

                    app.graph.setDirtyCanvas(true);
                };

                applyFilter(loaderTypeWidget.value);

                const origCallback = loaderTypeWidget.callback;
                loaderTypeWidget.callback = (value) => {
                    applyFilter(value);
                    origCallback?.call(loaderTypeWidget, value);
                };
            }
        };

        // ── Enhanced glow + sparkles: draw behind the node ────────────────────
        const origOnDrawBackground = nodeType.prototype.onDrawBackground;
        nodeType.prototype.onDrawBackground = function (ctx) {
            origOnDrawBackground?.call(this, ctx);
            if (!this._sparkles) this._sparkles = new SparkleSystem(14);
            drawEnhancedGlow(ctx, this, this._sparkles);
        };

        // ── Badge in top-right corner — with extra spacing ────────────────────
        const origOnDrawForeground = nodeType.prototype.onDrawForeground;
        nodeType.prototype.onDrawForeground = function (ctx) {
            origOnDrawForeground?.call(this, ctx);
            if (this.flags?.collapsed) return;

            const W = this.size[0];
            const t = Date.now() / 1000;
            const pulse = 0.5 + 0.5 * Math.sin(t * (2 * Math.PI / 3));

            ctx.save();

            // ⚡ WINNOUGAN badge — pushed further left to avoid bleeding
            ctx.font        = "bold 10px sans-serif";
            ctx.textAlign   = "right";
            ctx.fillStyle   = "#4ade80";
            ctx.shadowColor = "#4ade80";
            ctx.shadowBlur  = 6 + pulse * 4;
            ctx.fillText("⚡ WINNOUGAN", W - 28, 14);

            ctx.restore();
        };
    },
});

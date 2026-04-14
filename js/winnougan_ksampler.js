import { app } from "../../scripts/app.js";

const NODE_TYPE = "WinnouganKSampler";

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





// ── Sampler category colour map ───────────────────────────────────────────────
const CAT_COLORS = {
    "multistep":      { bg: "#1a2a1a", border: "#3a6a3a", text: "#7adf7a" },
    "exponential":    { bg: "#0a1a2a", border: "#1a5a8a", text: "#55aaff" },
    "hybrid":         { bg: "#1a1a2a", border: "#4a4a9a", text: "#9999ff" },
    "linear":         { bg: "#2a1a0a", border: "#7a5a1a", text: "#ffcc66" },
    "diag_implicit":  { bg: "#2a0a1a", border: "#8a1a5a", text: "#ff77bb" },
    "fully_implicit": { bg: "#1a0a2a", border: "#6a1a8a", text: "#cc77ff" },
    "none":           { bg: "#1a1a1a", border: "#3a3a3a", text: "#888888" },
};

function samplerCategory(name) {
    if (!name || name === "none") return "none";
    const slash = name.indexOf("/");
    return slash >= 0 ? name.slice(0, slash) : "std";
}

function catColor(name) {
    const cat = samplerCategory(name);
    return CAT_COLORS[cat] ?? { bg: "#1a2a1a", border: "#3a5a3a", text: "#9aefa0" };
}

// ── Extension ─────────────────────────────────────────────────────────────────
app.registerExtension({
    name: "Winnougan.KSampler",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_TYPE) return;

        // ── onNodeCreated ─────────────────────────────────────────────────────
        const origCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            origCreated?.call(this);

            this.color   = "#1a3a1a";
            this.bgcolor = "#0f2a0f";
            this._sparkles = new SparkleSystem(14);
            this.title   = "👉👈 Winnougan KSampler";

            // Hide bongmath detail widgets when bongmath is off
            const bongW      = this.widgets?.find(w => w.name === "bongmath");
            const bongCfgW   = this.widgets?.find(w => w.name === "bongmath_cfg_scale");
            const bongScaleW = this.widgets?.find(w => w.name === "bongmath_scale");

            const syncBong = (val) => {
                [bongCfgW, bongScaleW].forEach(ww => {
                    if (!ww) return;
                    if (!val) {
                        ww._savedType = ww._savedType ?? ww.type;
                        ww.type = "hidden";
                    } else if (ww._savedType) {
                        ww.type = ww._savedType;
                    }
                });
                this.setSize(this.computeSize());
                app.graph.setDirtyCanvas(true, true);
            };

            if (bongW) {
                syncBong(bongW.value);
                const origCb = bongW.callback;
                bongW.callback = (val) => {
                    syncBong(val);
                    origCb?.call(bongW, val);
                };
            }

            // Redraw when clown_sampler changes so pill updates
            const clownW = this.widgets?.find(w => w.name === "clown_sampler");
            if (clownW) {
                const origCb = clownW.callback;
                clownW.callback = (val) => {
                    app.graph.setDirtyCanvas(true, false);
                    origCb?.call(clownW, val);
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

        // ── Foreground: badge + sampler category pill + bongmath indicator ────
        const origFg = nodeType.prototype.onDrawForeground;
        nodeType.prototype.onDrawForeground = function (ctx) {
            origFg?.call(this, ctx);
            if (this.flags?.collapsed) return;

            const W = this.size[0];
            ctx.save();

            // ⚡ WINNOUGAN badge
            ctx.font        = "bold 10px sans-serif";
            ctx.textAlign   = "right";
            ctx.fillStyle   = "#4ade80";
            ctx.shadowColor = "#4ade80";
            ctx.shadowBlur  = 6;
            ctx.fillText("⚡ WINNOUGAN", W - 28, 14);

            ctx.shadowBlur  = 0;
            ctx.shadowColor = "transparent";

            // Resolve active sampler name
            const clownW = this.widgets?.find(w => w.name === "clown_sampler");
            const stdW   = this.widgets?.find(w => w.name === "sampler");
            const active = (clownW?.value && clownW.value !== "none")
                ? clownW.value
                : (stdW?.value ?? "");

            // Category pill — drawn top-right under badge
            if (active && active !== "none") {
                const cat   = samplerCategory(active);
                const c     = catColor(active);
                const label = cat === "std" ? "std" : cat.replace("_", " ");

                ctx.font = "bold 9px monospace";
                const tw  = ctx.measureText(label).width;
                const pad = 5;
                const pw  = tw + pad * 2;
                const ph  = 14;
                const px  = W - 8 - pw;
                const py  = 22;

                ctx.beginPath();
                ctx.roundRect(px, py, pw, ph, 4);
                ctx.fillStyle   = c.bg;
                ctx.fill();
                ctx.strokeStyle = c.border;
                ctx.lineWidth   = 1;
                ctx.stroke();
                ctx.fillStyle    = c.text;
                ctx.textAlign    = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(label, px + pw / 2, py + ph / 2);
            }

            // Bongmath glow indicator
            const bongW = this.widgets?.find(w => w.name === "bongmath");
            if (bongW?.value) {
                ctx.font         = "bold 10px sans-serif";
                ctx.textAlign    = "left";
                ctx.textBaseline = "middle";
                ctx.fillStyle    = "#ffcc44";
                ctx.shadowColor  = "#ffcc44";
                ctx.shadowBlur   = 7;
                ctx.fillText("🔔 bongmath", 12, 26);
            }

            ctx.restore();
        };

        // ── computeSize ───────────────────────────────────────────────────────
        nodeType.prototype.computeSize = function () {
            const bongOn    = this.widgets?.find(w => w.name === "bongmath")?.value ?? false;
            const widgetH   = LiteGraph.NODE_WIDGET_HEIGHT ?? 20;
            const gap       = 4;
            const TH        = LiteGraph.NODE_TITLE_HEIGHT;
            // required slots: model, pos, neg, latent, seed, steps, cfg,
            //                 sampler, clown_sampler, scheduler, denoise, bongmath = 12
            // + 2 bongmath detail widgets when on
            const slots = 12 + (bongOn ? 2 : 0);
            const h = TH + 8 + slots * (widgetH + gap) + 16;
            return [360, Math.max(h, bongOn ? 330 : 280)];
        };
    },
});

import { app } from "../../scripts/app.js";

const NODE_TYPE  = "WinnouganCLIPLoader";

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





// ── Helpers ───────────────────────────────────────────────────────────────────
function isGguf(name) {
    return typeof name === "string" && name.toLowerCase().endsWith(".gguf");
}

// Dtype groups for colour-coding the badge pill
const DTYPE_COLORS = {
    "default":         { bg: "#1a2a1a", border: "#3a5a3a", text: "#7acc7a" },
    "fp16":            { bg: "#1a2a1a", border: "#3a6a3a", text: "#9aefa0" },
    "bf16":            { bg: "#1a2a2a", border: "#3a5a6a", text: "#7aafcf" },
    "fp8_e4m3fn":      { bg: "#2a1a0a", border: "#7a5a1a", text: "#ffcc66" },
    "fp8_e4m3fn_fast": { bg: "#2a1a0a", border: "#8a6a1a", text: "#ffd980" },
    "fp8_e5m2":        { bg: "#2a1a10", border: "#7a4a1a", text: "#ffb060" },
    "nvfp4":           { bg: "#0a1a2a", border: "#1a5a9a", text: "#55aaff" },
    "mxfp8":           { bg: "#1a0a2a", border: "#5a1a9a", text: "#bb77ff" },
};

function dtypeColor(dtype) {
    return DTYPE_COLORS[dtype] ?? DTYPE_COLORS["default"];
}

// ── Extension ─────────────────────────────────────────────────────────────────
app.registerExtension({
    name: "Winnougan.CLIPLoader",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_TYPE) return;

        // ── onNodeCreated ─────────────────────────────────────────────────────
        const origCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            origCreated?.call(this);

            this.color   = "#1a3a1a";
            this.bgcolor = "#0f2a0f";
            this._sparkles = new SparkleSystem(14);
            this.title   = "👉👈 Winnougan CLIP Loader";

            // ── Widget references ─────────────────────────────────────────────
            const w = (name) => this.widgets?.find(w => w.name === name);

            const clip1W   = w("clip_name_1");
            const clip2W   = w("clip_name_2");
            const dtype1W  = w("dtype_1");
            const dtype2W  = w("dtype_2");
            const type1W   = w("clip_type_1");
            const type2W   = w("clip_type_2");
            const dualW    = w("dual_clip");

            // Cache full list for GGUF filtering
            const storeFullList = (widget) => {
                if (widget && !widget._allValues) {
                    widget._allValues = [...(widget.options?.values ?? [])];
                }
            };
            storeFullList(clip1W);
            storeFullList(clip2W);

            // Sync dual visibility: hide clip2 widgets when single mode
            const syncDual = (isDual) => {
                const clip2Widgets = [clip2W, dtype2W, type2W];
                clip2Widgets.forEach(ww => {
                    if (!ww) return;
                    ww.hidden = !isDual;
                    // Grey out visually via type override trick
                    if (!isDual) {
                        ww._origType = ww._origType ?? ww.type;
                        ww.type = "hidden";
                    } else if (ww._origType) {
                        ww.type = ww._origType;
                    }
                });
                // Force node resize
                this.setSize(this.computeSize());
                app.graph.setDirtyCanvas(true, true);
            };

            // GGUF filtering per widget
            const applyGgufFilter = (widget, dtype) => {
                if (!widget?._allValues) return;
                const isGgufMode = isGguf(widget.value) || dtype === "gguf";
                // No explicit gguf dtype — filter based on current selection hint
                // Just show all files; Python handles the routing
                widget.options.values = widget._allValues;
            };

            // Wire dual toggle
            if (dualW) {
                const origCb = dualW.callback;
                dualW.callback = (val) => {
                    syncDual(val);
                    origCb?.call(dualW, val);
                };
                // Apply on load
                syncDual(dualW.value);
            }

            // dtype badges redraw on change
            [dtype1W, dtype2W].forEach(dw => {
                if (!dw) return;
                const origCb = dw.callback;
                dw.callback = (val) => {
                    app.graph.setDirtyCanvas(true, false);
                    origCb?.call(dw, val);
                };
            });
        };

        // ── Breathing glow ────────────────────────────────────────────────────
        const origBg = nodeType.prototype.onDrawBackground;
        nodeType.prototype.onDrawBackground = function (ctx) {
            origBg?.call(this, ctx);
            if (!this._sparkles) this._sparkles = new SparkleSystem(14);
            drawEnhancedGlow(ctx, this, this._sparkles);
        };

        // ── Foreground: badge + dtype pills + dual indicator ──────────────────
        const origFg = nodeType.prototype.onDrawForeground;
        nodeType.prototype.onDrawForeground = function (ctx) {
            origFg?.call(this, ctx);
            if (this.flags?.collapsed) return;

            const W = this.size[0];

            ctx.save();

            // ⚡ WINNOUGAN badge top-right
            ctx.font        = "bold 10px sans-serif";
            ctx.textAlign   = "right";
            ctx.fillStyle   = "#4ade80";
            ctx.shadowColor = "#4ade80";
            ctx.shadowBlur  = 6;
            ctx.fillText("⚡ WINNOUGAN", W - 28, 14);

            // Dtype pills — drawn next to each clip_name widget
            const w      = (name) => this.widgets?.find(w => w.name === name);
            const dtype1 = w("dtype_1")?.value ?? "default";
            const dtype2 = w("dtype_2")?.value ?? "default";
            const dual   = w("dual_clip")?.value ?? false;

            ctx.shadowBlur = 0;
            ctx.shadowColor = "transparent";

            const drawPill = (label, x, y) => {
                const c   = dtypeColor(label);
                const pad = 5;
                ctx.font  = "bold 9px monospace";
                const tw  = ctx.measureText(label).width;
                const pw  = tw + pad * 2;
                const ph  = 14;
                // pill background
                ctx.beginPath();
                ctx.roundRect(x - pw, y, pw, ph, 4);
                ctx.fillStyle   = c.bg;
                ctx.fill();
                ctx.strokeStyle = c.border;
                ctx.lineWidth   = 1;
                ctx.stroke();
                // pill text
                ctx.fillStyle   = c.text;
                ctx.textAlign   = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(label, x - pw / 2, y + ph / 2);
            };

            // Find widget Y positions from LiteGraph layout
            const TH     = LiteGraph.NODE_TITLE_HEIGHT;
            const widgetH = LiteGraph.NODE_WIDGET_HEIGHT ?? 20;
            const gap     = 4;

            // Widgets render top-to-bottom: clip_name_1 (0), clip_type_1 (1),
            // dtype_1 (2), dual_clip (3), clip_name_2 (4), clip_type_2 (5), dtype_2 (6)
            // Each widget slot is widgetH + gap tall
            const slotY = (idx) => TH + 4 + idx * (widgetH + gap) + widgetH / 2;

            // dtype_1 pill — right edge, aligned with dtype_1 widget (slot 2)
            drawPill(dtype1, W - 8, slotY(2) - 7);

            // SINGLE / DUAL label next to the toggle (slot 3)
            const isDual = dual;
            ctx.font         = "bold 10px sans-serif";
            ctx.textAlign    = "left";
            ctx.textBaseline = "middle";
            ctx.fillStyle    = isDual ? "#4ade80" : "#4a7a4a";
            ctx.shadowColor  = isDual ? "#4ade80" : "transparent";
            ctx.shadowBlur   = isDual ? 5 : 0;
            ctx.fillText(isDual ? "◉ DUAL" : "◎ SINGLE", 12, slotY(3));

            if (isDual) {
                // dtype_2 pill (slot 6)
                ctx.shadowBlur  = 0;
                ctx.shadowColor = "transparent";
                drawPill(dtype2, W - 8, slotY(6) - 7);
            }

            ctx.restore();
        };

        // ── computeSize: shrink when single ──────────────────────────────────
        nodeType.prototype.computeSize = function () {
            const dual      = this.widgets?.find(w => w.name === "dual_clip")?.value ?? false;
            const baseW     = 340;
            const widgetH   = LiteGraph.NODE_WIDGET_HEIGHT ?? 20;
            const gap       = 4;
            const TH        = LiteGraph.NODE_TITLE_HEIGHT;
            const numSlots  = dual ? 7 : 4;   // 7 widgets shown vs 4
            const h         = TH + 8 + numSlots * (widgetH + gap) + 12;
            return [baseW, Math.max(h, dual ? 200 : 130)];
        };
    },
});

import { app } from "../../scripts/app.js";

const NODE_TYPE = "WinnouganPromptEncoder";

// ── Sparkle system ────────────────────────────────────────────────────────────
class SparkleSystem {
    constructor(maxParticles = 14) { this.particles = []; this.max = maxParticles; }
    _spawn(w, h, yOff) {
        const perim = 2*(w+h); let d = Math.random()*perim, x, y;
        if      (d < w)          { x = d;              y = yOff; }
        else if (d < w+h)        { x = w;               y = yOff+(d-w); }
        else if (d < 2*w+h)      { x = w-(d-w-h);       y = yOff+h; }
        else                     { x = 0;               y = yOff+h-(d-2*w-h); }
        this.particles.push({ x, y,
            vx:(Math.random()-0.5)*0.6, vy:(Math.random()-0.5)*0.6,
            life:1.0, decay:0.008+Math.random()*0.012,
            size:1.2+Math.random()*2.0, isNeg:Math.random()>0.5 });
    }
    update(w, h, yOff) {
        while (this.particles.length < this.max) this._spawn(w, h, yOff);
        for (let i = this.particles.length-1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx; p.y += p.vy; p.life -= p.decay;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
    }
    draw(ctx) {
        for (const p of this.particles) {
            const col = p.isNeg ? "#ffa0a0" : "#a0ffc0";
            ctx.save();
            ctx.globalAlpha=p.life*0.9; ctx.shadowColor=col;
            ctx.shadowBlur=6+p.size*2; ctx.fillStyle=col;
            const s = p.size;
            ctx.beginPath(); ctx.moveTo(p.x,p.y-s); ctx.lineTo(p.x+s*0.3,p.y);
            ctx.lineTo(p.x,p.y+s); ctx.lineTo(p.x-s*0.3,p.y); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(p.x-s,p.y); ctx.lineTo(p.x,p.y+s*0.3);
            ctx.lineTo(p.x+s,p.y); ctx.lineTo(p.x,p.y-s*0.3); ctx.closePath(); ctx.fill();
            ctx.restore();
        }
    }
}

// ── Glow ──────────────────────────────────────────────────────────────────────
function drawDualGlow(ctx, node, sparkles, dividerBodyY) {
    if (node.flags?.collapsed) return;
    const W = node.size[0];
    const H = node.size[1] + LiteGraph.NODE_TITLE_HEIGHT;
    const yOff = -LiteGraph.NODE_TITLE_HEIGHT, r = 8;
    const t = Date.now()/1000;
    const pulse  = 0.5+0.5*Math.sin(t*(2*Math.PI/3));
    const pulse2 = 0.5+0.5*Math.sin(t*(2*Math.PI/5)+1.0);
    app.graph.setDirtyCanvas(true, false);
    const bodyMid = dividerBodyY ?? H*0.55;
    ctx.save();
    ctx.shadowColor="#22dd66"; ctx.shadowBlur=22+pulse*24; ctx.strokeStyle="#22dd66";
    ctx.lineWidth=1; ctx.globalAlpha=0.12+pulse*0.15;
    ctx.beginPath(); ctx.roundRect(-2,yOff-2,W+4,H+4,r+2); ctx.stroke();
    ctx.shadowColor="#4ade80"; ctx.shadowBlur=16+pulse*20; ctx.strokeStyle="#4ade80";
    ctx.lineWidth=2; ctx.globalAlpha=0.30+pulse*0.40;
    ctx.beginPath(); ctx.roundRect(0,yOff,W,H,r); ctx.stroke();
    ctx.shadowBlur=6+pulse2*8; ctx.globalAlpha=0.50+pulse2*0.30;
    ctx.lineWidth=1.5; ctx.strokeStyle="#6aefa0";
    ctx.beginPath(); ctx.roundRect(1,yOff+1,W-2,H-2,r); ctx.stroke();
    // Red accent below divider
    const drawMid = yOff + LiteGraph.NODE_TITLE_HEIGHT + bodyMid;
    ctx.shadowColor="#dd2244"; ctx.shadowBlur=20+pulse*22; ctx.strokeStyle="#dd2244";
    ctx.lineWidth=1.5; ctx.globalAlpha=0.18+pulse*0.20;
    ctx.beginPath(); ctx.roundRect(0, drawMid, W, yOff+H-drawMid, 0); ctx.stroke();
    ctx.shadowBlur=8; ctx.globalAlpha=0.3+pulse*0.5;
    const dotR = 2+pulse*1.5;
    ctx.fillStyle="#a0ffc0"; ctx.shadowColor="#a0ffc0";
    for (const [cx,cy] of [[2,yOff+2],[W-2,yOff+2]]) { ctx.beginPath(); ctx.arc(cx,cy,dotR,0,Math.PI*2); ctx.fill(); }
    ctx.fillStyle="#ffa0a0"; ctx.shadowColor="#ffa0a0";
    for (const [cx,cy] of [[2,yOff+H-2],[W-2,yOff+H-2]]) { ctx.beginPath(); ctx.arc(cx,cy,dotR,0,Math.PI*2); ctx.fill(); }
    ctx.restore();
    sparkles.update(W,H,yOff); sparkles.draw(ctx);
}

function drawDivider(ctx, W, bodyY) {
    const t = Date.now()/1000;
    const p = 0.5+0.5*Math.sin(t*(2*Math.PI/4));
    ctx.save();
    const grad = ctx.createLinearGradient(8,bodyY,W-8,bodyY);
    grad.addColorStop(0,"#4ade80"); grad.addColorStop(0.5,"#888"); grad.addColorStop(1,"#f87171");
    ctx.shadowColor="#fff"; ctx.shadowBlur=2+p*3;
    ctx.globalAlpha=0.65+p*0.20; ctx.strokeStyle=grad; ctx.lineWidth=1;
    ctx.setLineDash([4,3]);
    ctx.beginPath(); ctx.moveTo(8,bodyY); ctx.lineTo(W-8,bodyY); ctx.stroke();
    ctx.setLineDash([]); ctx.restore();
}

// ── Custom label widget factory ───────────────────────────────────────────────
function makeLabelWidget(name, text, color, height = 20) {
    return {
        name,
        type:     "WINNOUGAN_LABEL",
        value:    text,
        _color:   color,
        _height:  height,
        draw(ctx, node, widgetWidth, y, H) {
            ctx.save();
            ctx.font         = "bold 9px sans-serif";
            ctx.textAlign    = "left";
            ctx.textBaseline = "middle";
            ctx.fillStyle    = this._color;
            ctx.shadowColor  = this._color;
            ctx.shadowBlur   = 4;
            ctx.fillText(this.value, 8, y + this._height / 2);
            ctx.restore();
        },
        computeSize(width) { return [width, this._height]; },
        mouse() { return false; },
        serializeValue() { return undefined; },
    };
}

// ── Divider widget factory ────────────────────────────────────────────────────
function makeDividerWidget() {
    return {
        name:    "_winnougan_divider",
        type:    "WINNOUGAN_DIVIDER",
        value:   null,
        _divY:   null,
        draw(ctx, node, widgetWidth, y, H) {
            this._divY = y + H / 2;
            drawDivider(ctx, widgetWidth, y + H / 2);
        },
        computeSize(width) { return [width, 20]; },
        mouse() { return false; },
        serializeValue() { return undefined; },
    };
}

// ── Core setup: inject decorative widgets and wire zero_neg callback ──────────
// Called once on creation and once after configure (if not already injected).
// Accepts optional savedZeroNeg so we can restore toggle state without relying
// on the widget's .value being set yet (it may not be during onConfigure).
function _injectWidgets(node, savedZeroNeg) {
    const getW = (name) => node.widgets?.find(ww => ww.name === name);

    // Guard: if already injected, just sync state and bail
    if (getW("_pos_label")) {
        _applyZeroNeg(node, savedZeroNeg ?? getW("zero_neg")?.value ?? false);
        return;
    }

    const posW  = getW("positive");
    const negW  = getW("negative");
    const zeroW = getW("zero_neg");
    if (!posW || !negW || !zeroW) return;

    const posLabel = makeLabelWidget("_pos_label", "▲  POSITIVE", "#4ade80", 18);
    const dividerW = makeDividerWidget();
    const negLabel = makeLabelWidget("_neg_label", "▼  NEGATIVE", "#f87171", 18);

    node._negLabel = negLabel;
    node._dividerW = dividerW;

    // Rebuild widget array in desired order — preserving the real widget
    // objects so their .value references stay intact and ComfyUI serializes
    // them correctly.
    node.widgets = [posLabel, posW, dividerW, negLabel, negW, zeroW];

    // Apply initial zero_neg visual state
    _applyZeroNeg(node, savedZeroNeg ?? zeroW.value ?? false);

    // Hook the toggle — only once
    if (!zeroW._winnougan_hooked) {
        zeroW._winnougan_hooked = true;
        const origCb = zeroW.callback;
        zeroW.callback = (val) => {
            _applyZeroNeg(node, val);
            origCb?.call(zeroW, val);
        };
    }

    node.setSize(node.computeSize());
    app.graph.setDirtyCanvas(true, true);
}

function _applyZeroNeg(node, val) {
    if (!node._negLabel) return;
    node._negLabel.value  = val ? "▽  NEGATIVE  (zeroed out)" : "▼  NEGATIVE";
    node._negLabel._color = val ? "#666666" : "#f87171";
    const negW = node.widgets?.find(ww => ww.name === "negative");
    if (negW) negW.disabled = val;
}

// ── Extension ─────────────────────────────────────────────────────────────────
app.registerExtension({
    name: "Winnougan.PromptEncoder",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_TYPE) return;

        // ── onNodeCreated ─────────────────────────────────────────────────────
        // Fired when a brand-new node is dropped onto the canvas.
        // At this point widgets exist and have default values — safe to inject
        // synchronously with no setTimeout.
        const origCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            origCreated?.call(this);
            this.color     = "#1a2a1a";
            this.bgcolor   = "#0f1f0f";
            this._sparkles = new SparkleSystem(16);
            this.title     = "✍️ Winnougan Prompt Encoder";
            _injectWidgets(this);
        };

        // ── onConfigure ───────────────────────────────────────────────────────
        // Fired when a saved workflow is loaded OR when ComfyUI rebuilds the
        // node after a tab switch.  At this point ComfyUI has already written
        // widgets_values back onto the widgets, so we must NOT overwrite them.
        // We pass the serialized zero_neg value explicitly so _applyZeroNeg
        // uses the correct saved state rather than whatever default the widget
        // happens to have at call time.
        const origConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function (data) {
            origConfigure?.call(this, data);

            this.color     = this.color     ?? "#1a2a1a";
            this.bgcolor   = this.bgcolor   ?? "#0f1f0f";
            this._sparkles = this._sparkles ?? new SparkleSystem(16);
            this.title     = "✍️ Winnougan Prompt Encoder";

            // Recover the saved zero_neg value from widgets_values.
            // Python INPUT_TYPES order: positive(0), negative(1), zero_neg(2)
            // widgets_values is written in that same order by ComfyUI.
            const savedZeroNeg = data?.widgets_values?.[2] ?? false;

            // Strip any previously-injected decorative widgets so _injectWidgets
            // can rebuild cleanly without duplicating them.  We must preserve
            // the real widgets' current .value (already restored by ComfyUI).
            if (this.widgets) {
                this.widgets = this.widgets.filter(
                    w => !["_pos_label", "_winnougan_divider", "_neg_label"].includes(w.name)
                );
            }
            // Clear stale refs so _injectWidgets knows to rebuild
            this._negLabel = null;
            this._dividerW = null;

            _injectWidgets(this, savedZeroNeg);
        };

        // ── Background ────────────────────────────────────────────────────────
        const origBg = nodeType.prototype.onDrawBackground;
        nodeType.prototype.onDrawBackground = function (ctx) {
            origBg?.call(this, ctx);
            if (!this._sparkles) this._sparkles = new SparkleSystem(16);
            const divY = this._dividerW?._divY ?? null;
            drawDualGlow(ctx, this, this._sparkles, divY);
        };

        // ── Foreground ────────────────────────────────────────────────────────
        const origFg = nodeType.prototype.onDrawForeground;
        nodeType.prototype.onDrawForeground = function (ctx) {
            origFg?.call(this, ctx);
            if (this.flags?.collapsed) return;
            const W      = this.size[0];
            const getW   = (name) => this.widgets?.find(ww => ww.name === name);
            const isZero = getW("zero_neg")?.value ?? false;

            ctx.save();
            // ⚡ WINNOUGAN badge
            ctx.font="bold 10px sans-serif"; ctx.textAlign="right";
            ctx.textBaseline="alphabetic"; ctx.fillStyle="#4ade80";
            ctx.shadowColor="#4ade80"; ctx.shadowBlur=6;
            ctx.fillText("⚡ WINNOUGAN", W-76, 14);

            // COND ZERO OUT pill
            if (isZero) {
                const negLabelW = getW("_neg_label");
                if (negLabelW?.last_y != null) {
                    ctx.shadowBlur=0; ctx.shadowColor="transparent";
                    const label = "COND ZERO OUT";
                    ctx.font = "bold 9px monospace";
                    const tw = ctx.measureText(label).width;
                    const pad=6, pw=tw+pad*2, ph=14;
                    const px = W-pw-8;
                    const py = negLabelW.last_y + 2;
                    ctx.beginPath(); ctx.roundRect(px,py,pw,ph,4);
                    ctx.fillStyle="#2a0a0a"; ctx.fill();
                    ctx.strokeStyle="#aa3333"; ctx.lineWidth=1; ctx.stroke();
                    ctx.fillStyle="#ff8888"; ctx.textAlign="center"; ctx.textBaseline="middle";
                    ctx.fillText(label, px+pw/2, py+ph/2);
                }
            }
            ctx.restore();
        };

        // ── computeSize ───────────────────────────────────────────────────────
        nodeType.prototype.computeSize = function () {
            const W = 360;
            if (!this.widgets?.length) return [W, 300];
            let h = LiteGraph.NODE_TITLE_HEIGHT + 4;
            const slotH = LiteGraph.NODE_SLOT_HEIGHT ?? 20;
            h += Math.max(this.inputs?.length ?? 0, this.outputs?.length ?? 0) * slotH;
            for (const ww of this.widgets) {
                const [, wh] = ww.computeSize ? ww.computeSize(W) : [W, LiteGraph.NODE_WIDGET_HEIGHT ?? 20];
                h += wh + 4;
            }
            h += 12;
            return [W, Math.max(h, 280)];
        };
    },
});

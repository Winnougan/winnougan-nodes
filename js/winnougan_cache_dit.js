import { app } from "../../scripts/app.js";

const NODE_TYPE  = "WinnouganCacheDiT";
const NODE_TITLE = "Winnougan Cache DiT";

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

// ── Enhanced breathing glow ───────────────────────────────────────────────────
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



const MODEL_BADGES = {
  "NextDiT": { label: "Z-Image Turbo", color: "#4a9f5f", text: "#ccffcc" },
  "Qwen":    { label: "Qwen-Image",    color: "#4a7a9f", text: "#cceeff" },
  "Flux":    { label: "Flux / Flux 2", color: "#7a4a9f", text: "#eeccff" },
  "FLUX":    { label: "Flux / Flux 2", color: "#7a4a9f", text: "#eeccff" },
  "LTX":     { label: "LTX Video",     color: "#9f7a4a", text: "#ffeebb" },
  "Wan":     { label: "Wan Video",     color: "#9f4a4a", text: "#ffcccc" },
};

function getModelBadge(modelName) {
  for (const [key, badge] of Object.entries(MODEL_BADGES)) {
    if (modelName?.includes(key)) return badge;
  }
  return { label: "Auto-detect", color: "#3a5a3a", text: "#7aaa7a" };
}

function roundRect(ctx, x, y, w, h, r, fill, stroke, lw = 1) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill)   { ctx.fillStyle   = fill;   ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

function isLowQuality() {
  return app.canvas.ds.scale < 0.6;
}

// ── Measure where widgets end ─────────────────────────────────────────────────

function getWidgetsBottomY(node) {
  const TH = LiteGraph.NODE_TITLE_HEIGHT;
  if (!node.widgets || node.widgets.length === 0) return TH + 10;
  let y = TH + 4;
  for (const w of node.widgets) {
    const h = w.computedHeight ?? w.options?.height ?? 20;
    y += h + 4;
  }
  return y + 8;
}

// ── Register ──────────────────────────────────────────────────────────────────

app.registerExtension({
  name: "Winnougan.CacheDiT",

  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== NODE_TYPE) return;

    const origOnNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      origOnNodeCreated?.call(this);
      this.color   = "#1a3a1a";
      this.bgcolor = "#0f2a0f";
      this._sparkles = new SparkleSystem(14);
      this.title   = "👉👈 Winnougan Cache DiT";
    };

    // ── Background ────────────────────────────────────────────────────────────
    nodeType.prototype.onDrawBackground = function (ctx) {
      if (this.flags?.collapsed) return;
      const W  = this.size[0];
      const H  = this.size[1];
      const TH = LiteGraph.NODE_TITLE_HEIGHT;
      ctx.save();
      ctx.strokeStyle = "#2a4a2a";
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.roundRect(1, TH + 1, W - 2, H - TH - 2, 6);
      ctx.stroke();
      ctx.fillStyle = "rgba(20,40,20,0.3)";
      ctx.beginPath();
      ctx.roundRect(1, TH + 1, W - 2, H - TH - 2, 6);
      ctx.fill();
      ctx.restore();
      // Enhanced glow + sparkles
      if (!this._sparkles) this._sparkles = new SparkleSystem(14);
      drawEnhancedGlow(ctx, this, this._sparkles);
    };

    // ── Foreground — drawn AFTER widgets, so always below them ───────────────
    nodeType.prototype.onDrawForeground = function (ctx) {
      if (this.flags?.collapsed || isLowQuality()) return;

      const W   = this.size[0];
      const TH  = LiteGraph.NODE_TITLE_HEIGHT;
      const pad = 10;

      ctx.save();

      // ⚡ WINNOUGAN badge
      const _t = Date.now() / 1000;
      const _pulse = 0.5 + 0.5 * Math.sin(_t * (2 * Math.PI / 3));
      ctx.font = "bold 10px sans-serif"; ctx.textAlign = "right";
      ctx.fillStyle = "#4ade80"; ctx.shadowColor = "#4ade80";
      ctx.shadowBlur = 6 + _pulse * 4;
      ctx.fillText("⚡ WINNOUGAN", W - 28, 14);
      ctx.shadowBlur = 0; ctx.shadowColor = "transparent";

      // Accent bar just below title (safe — title area is always clear)
      const grad = ctx.createLinearGradient(pad, 0, W - pad, 0);
      grad.addColorStop(0,   "transparent");
      grad.addColorStop(0.2, "#4aaf4a");
      grad.addColorStop(0.8, "#4aaf4a");
      grad.addColorStop(1,   "transparent");
      ctx.fillStyle = grad;
      ctx.fillRect(pad, TH + 2, W - pad * 2, 3);

      // Everything else goes BELOW all widgets
      const contentY = getWidgetsBottomY(this);

      // Divider
      ctx.strokeStyle = "#2a4a2a";
      ctx.lineWidth   = 0.5;
      ctx.beginPath();
      ctx.moveTo(pad, contentY);
      ctx.lineTo(W - pad, contentY);
      ctx.stroke();

      // Speed pill
      const enableWidget = (this.widgets ?? []).find(w => w.name === "enable");
      const warmupWidget = (this.widgets ?? []).find(w => w.name === "warmup_steps");
      const skipWidget   = (this.widgets ?? []).find(w => w.name === "skip_interval");
      const isEnabled    = enableWidget?.value !== false;
      const warmup       = warmupWidget?.value ?? 0;
      const skip         = skipWidget?.value   ?? 0;

      let pillLabel, pillColor, pillText;
      const effectiveSkip = skip <= 0 ? 2 : skip;
      if (effectiveSkip <= 2 && warmup <= 3) {
        pillLabel = "⚡ Fast";     pillColor = "#4a9f5f"; pillText = "#ccffcc";
      } else if (effectiveSkip <= 3) {
        pillLabel = "⚖ Balanced"; pillColor = "#7a8a4a"; pillText = "#eeffcc";
      } else {
        pillLabel = "✦ Quality";  pillColor = "#4a6a9f"; pillText = "#cce0ff";
      }

      if (!isEnabled) {
        pillLabel = "⏸ Disabled"; pillColor = "#444"; pillText = "#666";
      }

      const pillY = contentY + 8;
      const pillW = W - pad * 2;
      const pillH = 22;
      roundRect(ctx, pad, pillY, pillW, pillH, 11,
        pillColor + "33", pillColor, 0.8);
      ctx.fillStyle    = pillText;
      ctx.font         = "bold 11px sans-serif";
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pillLabel, pad + pillW / 2, pillY + pillH / 2);

      // Model badge
      const badge  = getModelBadge(this._detectedModel ?? "");
      const badgeY = pillY + pillH + 8;
      const badgeH = 20;
      roundRect(ctx, pad, badgeY, pillW, badgeH, 10,
        badge.color + "33", badge.color + "88", 0.5);
      ctx.fillStyle    = badge.text;
      ctx.font         = "bold 10px sans-serif";
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(badge.label, pad + pillW / 2, badgeY + badgeH / 2);

      // Resize node to fit
      const neededH = badgeY + badgeH + 12;
      if (this.size[1] < neededH) {
        this.size[1] = neededH;
      }

      ctx.restore();
    };

    // ── Widget tinting ────────────────────────────────────────────────────────
    const origDrawWidgets = nodeType.prototype.onDrawWidgets;
    nodeType.prototype.onDrawWidgets = function (ctx) {
      const o1 = LiteGraph.WIDGET_OUTLINE_COLOR;
      const o2 = LiteGraph.WIDGET_BGCOLOR;
      const o3 = LiteGraph.WIDGET_TEXT_COLOR;
      const o4 = LiteGraph.WIDGET_SECONDARY_TEXT_COLOR;
      LiteGraph.WIDGET_OUTLINE_COLOR        = "#2a5a2a";
      LiteGraph.WIDGET_BGCOLOR              = "#0d1a0d";
      LiteGraph.WIDGET_TEXT_COLOR           = "#ccffcc";
      LiteGraph.WIDGET_SECONDARY_TEXT_COLOR = "#5a9a5a";
      origDrawWidgets?.call(this, ctx);
      LiteGraph.WIDGET_OUTLINE_COLOR        = o1;
      LiteGraph.WIDGET_BGCOLOR              = o2;
      LiteGraph.WIDGET_TEXT_COLOR           = o3;
      LiteGraph.WIDGET_SECONDARY_TEXT_COLOR = o4;
    };

    const origWidgetChanged = nodeType.prototype.onWidgetChanged;
    nodeType.prototype.onWidgetChanged = function (name, value, old, widget) {
      origWidgetChanged?.call(this, name, value, old, widget);
      this.setDirtyCanvas(true);
    };

    nodeType.prototype.onExecuted = function () { this.setDirtyCanvas(true); };

    nodeType.prototype.onSerialize = function (o) {
      o.winnougan_cache_dit_ui = { detectedModel: this._detectedModel ?? "" };
    };

    nodeType.prototype.onConfigure = function (o) {
      if (o.winnougan_cache_dit_ui) {
        this._detectedModel = o.winnougan_cache_dit_ui.detectedModel ?? "";
      }
    };

    nodeType.prototype.computeSize = function () {
      const widgetH = (this.widgets?.length ?? 0) * 24;
      return [320, LiteGraph.NODE_TITLE_HEIGHT + widgetH + 80];
    };
  },
});
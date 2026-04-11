import { app } from "../../scripts/app.js";

const NODE_TYPE  = "WinnouganCacheDiTWan";
const NODE_TITLE = "Winnougan Cache DiT Wan";

const PRESETS = {
  "Balanced ⭐": { warmup: 4, skip: 2, pill: "⚖ Balanced", pillColor: "#7a8a4a", pillText: "#eeffcc" },
  "Speed ⚡":    { warmup: 3, skip: 2, pill: "⚡ Speed",    pillColor: "#4a9f5f", pillText: "#ccffcc" },
  "Quality ✦":   { warmup: 6, skip: 3, pill: "✦ Quality",  pillColor: "#4a6a9f", pillText: "#cce0ff" },
  "Custom":      { warmup: null, skip: null, pill: "⚙ Custom", pillColor: "#6a5a3a", pillText: "#ffeebb" },
};

function roundRect(ctx, x, y, w, h, r, fill, stroke, lw = 1) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill)   { ctx.fillStyle   = fill;   ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

function isLowQuality() {
  return app.canvas.ds.scale < 0.6;
}

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

app.registerExtension({
  name: "Winnougan.CacheDiTWan",

  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== NODE_TYPE) return;

    const origOnNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      origOnNodeCreated?.call(this);
      this.color   = "#1a2a1a";
      this.bgcolor = "#0f1f0f";
      this.title   = NODE_TITLE;
    };

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
    };

    nodeType.prototype.onDrawForeground = function (ctx) {
      if (this.flags?.collapsed || isLowQuality()) return;

      const W   = this.size[0];
      const TH  = LiteGraph.NODE_TITLE_HEIGHT;
      const pad = 10;

      ctx.save();

      // Accent bar
      const grad = ctx.createLinearGradient(pad, 0, W - pad, 0);
      grad.addColorStop(0,   "transparent");
      grad.addColorStop(0.2, "#4aaf4a");
      grad.addColorStop(0.8, "#4aaf4a");
      grad.addColorStop(1,   "transparent");
      ctx.fillStyle = grad;
      ctx.fillRect(pad, TH + 2, W - pad * 2, 3);

      // Everything below widgets
      const contentY = getWidgetsBottomY(this);
      const iw       = W - pad * 2;

      // Divider
      ctx.strokeStyle = "#2a4a2a";
      ctx.lineWidth   = 0.5;
      ctx.beginPath();
      ctx.moveTo(pad, contentY);
      ctx.lineTo(W - pad, contentY);
      ctx.stroke();

      // Resolve values
      const presetWidget = (this.widgets ?? []).find(w => w.name === "preset");
      const enableWidget = (this.widgets ?? []).find(w => w.name === "enable");
      const warmupWidget = (this.widgets ?? []).find(w => w.name === "warmup_steps");
      const skipWidget   = (this.widgets ?? []).find(w => w.name === "skip_interval");

      const presetName = presetWidget?.value ?? "Balanced ⭐";
      const isEnabled  = enableWidget?.value !== false;
      const preset     = PRESETS[presetName] ?? PRESETS["Balanced ⭐"];

      const activeWarmup = (presetName !== "Custom" && preset.warmup != null)
        ? preset.warmup : (warmupWidget?.value ?? 4);
      const activeSkip   = (presetName !== "Custom" && preset.skip != null)
        ? preset.skip   : (skipWidget?.value   ?? 2);

      // Top pill row — Wan badge + preset pill
      const pillY = contentY + 8;
      const pillH = 22;
      const halfW = (iw - 6) / 2;

      // Wan2.2 badge
      roundRect(ctx, pad, pillY, halfW, pillH, 11, "#1e2a3a", "#3a5a8a", 0.8);
      ctx.fillStyle    = "#7ab8ff";
      ctx.font         = "bold 10px sans-serif";
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🌊 Wan2.2 Video", pad + halfW / 2, pillY + pillH / 2);

      // Preset pill
      const pc = isEnabled ? preset.pillColor : "#444";
      const pt = isEnabled ? preset.pillText  : "#666";
      const pl = isEnabled ? preset.pill      : "⏸ Disabled";
      roundRect(ctx, pad + halfW + 6, pillY, halfW, pillH, 11, pc + "33", pc, 0.8);
      ctx.fillStyle    = pt;
      ctx.font         = "bold 10px sans-serif";
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pl, pad + halfW + 6 + halfW / 2, pillY + pillH / 2);

      // Three stat boxes
      const statY  = pillY + pillH + 8;
      const statH  = 60;
      const thirdW = (iw - 8) / 3;

      this._drawStatBox(ctx, pad, statY, thirdW, statH,
        "Warmup", String(activeWarmup), "compute steps",
        "#4a9f5f", "#ccffcc");

      this._drawStatBox(ctx, pad + thirdW + 4, statY, thirdW, statH,
        "Skip Every", `${activeSkip} steps`, "after warmup",
        "#4a7a9f", "#cce0ff");

      const estHit = Math.round((1 - 1 / activeSkip) * 100);
      this._drawStatBox(ctx, pad + (thirdW + 4) * 2, statY, thirdW, statH,
        "Est. Cache", `${estHit}%`, "hit rate",
        "#7a5a9a", "#ddbbff");

      // Multi-expert note
      ctx.fillStyle    = "#3a6a3a";
      ctx.font         = "9px sans-serif";
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        "HN + LN experts each get isolated cache",
        W / 2, statY + statH + 10
      );

      const neededH = statY + statH + 24;
      if (this.size[1] < neededH) this.size[1] = neededH;

      ctx.restore();
    };

    nodeType.prototype._drawStatBox = function (ctx, x, y, w, h, label, value, sub, color, textColor) {
      roundRect(ctx, x, y, w, h, 5, color + "22", color + "55", 0.5);
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle    = color;
      ctx.font         = "bold 9px sans-serif";
      ctx.fillText(label.toUpperCase(), x + w / 2, y + 12);
      ctx.fillStyle    = textColor;
      ctx.font         = `bold ${value.length <= 4 ? 18 : 13}px monospace`;
      ctx.fillText(value, x + w / 2, y + 35);
      ctx.fillStyle    = color;
      ctx.font         = "9px sans-serif";
      ctx.fillText(sub, x + w / 2, y + 52);
    };

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

    nodeType.prototype.onExecuted  = function () { this.setDirtyCanvas(true); };

    nodeType.prototype.onSerialize = function (o) {
      o.winnougan_wan_ui = { preset: this._lastPreset ?? "Balanced ⭐" };
    };

    nodeType.prototype.onConfigure = function (o) {
      if (o.winnougan_wan_ui) this._lastPreset = o.winnougan_wan_ui.preset ?? "Balanced ⭐";
    };

    nodeType.prototype.computeSize = function () {
      const widgetH = (this.widgets?.length ?? 0) * 24;
      return [340, LiteGraph.NODE_TITLE_HEIGHT + widgetH + 120];
    };
  },
});
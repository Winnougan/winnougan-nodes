import { app } from "../../scripts/app.js";

const NODE_TYPE = "WinnouganPowerLoraLoader";
const NODE_TITLE = "Winnougan Power Lora Loader";

const PROP_SHOW_STRENGTHS = "Show Strengths";
const PROP_VALUE_SINGLE = "Single Strength";
const PROP_VALUE_SEPARATE = "Separate Model & Clip";

// ── Helpers ───────────────────────────────────────────────────────────────────

function isLowQuality() {
  return app.canvas.ds.scale < 0.6;
}

function drawRoundedRect(ctx, x, y, w, h, r = 5) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.strokeStyle = LiteGraph.WIDGET_OUTLINE_COLOR ?? "#333";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = LiteGraph.WIDGET_BGCOLOR ?? "#222";
  ctx.fill();
}

function drawToggle(ctx, x, y, h, value) {
  const tw = 28, th = h * 0.55;
  const tx = x + 4, ty = y + (h - th) / 2;
  const r = th / 2;
  ctx.beginPath();
  ctx.roundRect(tx, ty, tw, th, r);
  ctx.fillStyle = value ? "#4a9f5f" : "#555";
  ctx.fill();
  // knob
  const knobX = value ? tx + tw - r - 2 : tx + r + 2;
  ctx.beginPath();
  ctx.arc(knobX, ty + r, r - 2, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  return [x, tw + 8]; // [startX, width]
}

function drawArrowButton(ctx, x, y, w, h, dir) {
  ctx.beginPath();
  ctx.roundRect(x, y + h * 0.15, w, h * 0.7, 3);
  ctx.fillStyle = LiteGraph.WIDGET_BGCOLOR ?? "#333";
  ctx.fill();
  ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR ?? "#ccc";
  ctx.font = `${h * 0.45}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(dir < 0 ? "◀" : "▶", x + w / 2, y + h / 2);
  return [x, w];
}

function drawStrengthWidget(ctx, posX, posY, h, value, direction = -1) {
  const bw = 18, vw = 50;
  const totalW = bw + vw + bw;
  const startX = direction < 0 ? posX - totalW : posX;
  const [la] = drawArrowButton(ctx, startX, posY, bw, h, -1);
  // value box
  ctx.fillStyle = LiteGraph.WIDGET_BGCOLOR ?? "#333";
  ctx.fillRect(startX + bw, posY + h * 0.15, vw, h * 0.7);
  ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR ?? "#eee";
  ctx.font = `bold ${h * 0.42}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(Number(value).toFixed(2), startX + bw + vw / 2, posY + h / 2);
  drawArrowButton(ctx, startX + bw + vw, posY, bw, h, 1);
  return [startX, totalW]; // [x, width]
}

function fitString(ctx, str, maxWidth) {
  if (ctx.measureText(str).width <= maxWidth) return str;
  while (str.length > 1 && ctx.measureText(str + "…").width > maxWidth) {
    str = str.slice(0, -1);
  }
  return str + "…";
}

// ── Widget: individual lora row ───────────────────────────────────────────────

class PowerLoraWidget {
  constructor(name) {
    this.name = name;
    this.type = "custom";
    this.y = 0;
    this.last_y = 0;
    this._value = { on: true, lora: null, strength: 1.0, strengthTwo: null };
    this.hitAreas = {};
    this.draggingStrength = false;
    this.dragStartX = 0;
    this.dragStartVal = 0;
    this.dragIsTwo = false;
  }

  get value() { return this._value; }
  set value(v) {
    this._value = (v && typeof v === "object") ? v : { on: true, lora: null, strength: 1.0, strengthTwo: null };
  }

  computeSize() { return [220, 30]; }

  draw(ctx, node, widgetWidth, posY, height) {
    this.last_y = posY;
    const margin = 10, im = margin * 0.33;
    const lowQ = isLowQuality();
    const midY = posY + height / 2;
    const showSep = node.properties?.[PROP_SHOW_STRENGTHS] === PROP_VALUE_SEPARATE;

    ctx.save();
    drawRoundedRect(ctx, margin, posY + 2, widgetWidth - margin * 2, height - 4);

    // Toggle
    const [tX, tW] = drawToggle(ctx, margin + 4, posY, height, this._value.on);
    this.hitAreas.toggle = { x: tX, y: posY, w: tW + 4, h: height };
    let posX = margin + 4 + tW + im;

    if (lowQ) { ctx.restore(); return; }

    ctx.globalAlpha = this._value.on ? 1 : 0.45;
    ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR ?? "#ccc";
    ctx.textBaseline = "middle";

    // Strength(s) on right
    let rposX = widgetWidth - margin - im;

    if (showSep && this._value.strengthTwo != null) {
      // Clip strength (rightmost)
      const [sx2, sw2] = drawStrengthWidget(ctx, rposX, posY, height, this._value.strengthTwo ?? 1);
      this.hitAreas.strengthTwo = { x: sx2, y: posY, w: sw2, h: height };
      rposX = sx2 - im * 2;
    }

    // Model / single strength
    const [sx, sw] = drawStrengthWidget(ctx, rposX, posY, height, this._value.strength ?? 1);
    this.hitAreas.strength = { x: sx, y: posY, w: sw, h: height };
    rposX = sx - im;

    // Lora name
    const loraW = rposX - posX - im;
    ctx.textAlign = "left";
    ctx.font = `${height * 0.4}px sans-serif`;
    const label = this._value.lora || "None";
    ctx.fillText(fitString(ctx, label, loraW), posX, midY);
    this.hitAreas.lora = { x: posX, y: posY, w: loraW, h: height };

    ctx.restore();
  }

  // returns true if event was inside one of this widget's hit areas
  mouse(event, pos, node) {
    const [mx, my] = pos;

    const inRect = (r) => r && mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;

    if (event.type === "pointerdown" || event.type === "mousedown") {
      if (inRect(this.hitAreas.toggle)) {
        this._value.on = !this._value.on;
        node.setDirtyCanvas(true);
        return true;
      }
      if (inRect(this.hitAreas.strength)) {
        const bw = 18, vw = 50;
        const relX = mx - this.hitAreas.strength.x;
        if (relX < bw) { this.stepStrength(-1, false); node.setDirtyCanvas(true); return true; }
        if (relX > bw + vw) { this.stepStrength(1, false); node.setDirtyCanvas(true); return true; }
        // drag on value
        this.draggingStrength = true;
        this.dragIsTwo = false;
        this.dragStartX = mx;
        this.dragStartVal = this._value.strength ?? 1;
        return true;
      }
      if (inRect(this.hitAreas.strengthTwo)) {
        const bw = 18, vw = 50;
        const relX = mx - this.hitAreas.strengthTwo.x;
        if (relX < bw) { this.stepStrength(-1, true); node.setDirtyCanvas(true); return true; }
        if (relX > bw + vw) { this.stepStrength(1, true); node.setDirtyCanvas(true); return true; }
        this.draggingStrength = true;
        this.dragIsTwo = true;
        this.dragStartX = mx;
        this.dragStartVal = this._value.strengthTwo ?? 1;
        return true;
      }
      if (inRect(this.hitAreas.lora)) {
        this._showLoraChooser(event, node);
        return true;
      }
    }

    if ((event.type === "pointermove" || event.type === "mousemove") && this.draggingStrength) {
      const delta = (mx - this.dragStartX) * 0.01;
      const prop = this.dragIsTwo ? "strengthTwo" : "strength";
      this._value[prop] = Math.round((this.dragStartVal + delta) * 100) / 100;
      node.setDirtyCanvas(true);
      return true;
    }

    if (event.type === "pointerup" || event.type === "mouseup") {
      this.draggingStrength = false;
    }

    return false;
  }

  stepStrength(dir, isTwo) {
    const prop = isTwo ? "strengthTwo" : "strength";
    this._value[prop] = Math.round(((this._value[prop] ?? 1) + dir * 0.05) * 100) / 100;
  }

  _showLoraChooser(event, node) {
    // Build lora list from ComfyUI's widget definitions
    const loraDef = app.graph?.extra?.ds ?? null;
    // Fetch available loras from the server
    fetch("/object_info/LoraLoader")
      .then(r => r.json())
      .then(data => {
        const loras = data?.LoraLoader?.input?.required?.lora_name?.[0] ?? [];
        const menuItems = ["None", ...loras].map(l => ({
          content: l,
          callback: () => {
            this._value.lora = l === "None" ? null : l;
            node.setDirtyCanvas(true);
          }
        }));
        new LiteGraph.ContextMenu(menuItems, {
          title: "Choose LoRA",
          event: event,
        });
      })
      .catch(() => {
        console.warn("[Winnougan] Could not fetch lora list.");
      });
  }

  serialize() {
    const v = { ...this._value };
    if (v.strengthTwo === null) delete v.strengthTwo;
    return v;
  }
}

// ── Main Node Class ───────────────────────────────────────────────────────────

class WinnouganPowerLoraLoaderNode extends LGraphNode {
  constructor() {
    super(NODE_TITLE);
    this.title = NODE_TITLE;
    this.color = "#1a2a1a";
    this.bgcolor = "#0f1f0f";
    this.serialize_widgets = true;
    this.properties = {
      [PROP_SHOW_STRENGTHS]: PROP_VALUE_SINGLE,
    };
    this._loraCounter = 0;
    this._addButton = null;

    // Outputs
    this.addOutput("MODEL", "MODEL");
    this.addOutput("CLIP", "CLIP");
    // Inputs
    this.addInput("model", "MODEL");
    this.addInput("clip", "CLIP");

    this._addAddButton();
    this.size = this.computeSize();
  }

  _addAddButton() {
    // We'll draw the button ourselves in onDrawForeground
  }

  addLoraRow(value) {
    this._loraCounter++;
    const w = new PowerLoraWidget("lora_" + this._loraCounter);
    if (value) w.value = { ...value };
    // Insert before last "button" spot
    if (!this.widgets) this.widgets = [];
    this.widgets.push(w);
    this._recalcSize();
    return w;
  }

  removeLoraWidget(widget) {
    const idx = this.widgets.indexOf(widget);
    if (idx !== -1) this.widgets.splice(idx, 1);
    this._recalcSize();
  }

  _loraWidgets() {
    return (this.widgets ?? []).filter(w => w.name?.startsWith("lora_"));
  }

  _recalcSize() {
    const rows = this._loraWidgets().length;
    this.size[1] = Math.max(130 + rows * 34, this.size[1]);
    this.setDirtyCanvas(true, true);
  }

  onDrawForeground(ctx) {
    if (this.flags?.collapsed) return;
    const w = this.size[0], h = this.size[1];
    const margin = 10;
    const btnH = 26;
    const btnY = h - btnH - 8;

    // "+ Add Lora" button
    ctx.save();
    ctx.fillStyle = "#2a5a2a";
    ctx.strokeStyle = "#4a9f4a";
    ctx.lineWidth = 1;
    const bx = margin, by = btnY, bw = w - margin * 2;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, btnH, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#aaffaa";
    ctx.font = `bold ${btnH * 0.48}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("➕ Add Lora", bx + bw / 2, by + btnH / 2);

    // Header
    const hasLoras = this._loraWidgets().length > 0;
    if (hasLoras && !isLowQuality()) {
      const showSep = this.properties?.[PROP_SHOW_STRENGTHS] === PROP_VALUE_SEPARATE;
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR ?? "#ccc";
      ctx.font = `${10}px sans-serif`;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      const headerY = (this.widgets?.[0]?.last_y ?? 40) - 10;
      ctx.fillText(showSep ? "Model  Clip" : "Strength", w - margin - 4, headerY);
    }

    ctx.restore();

    // Store button bounds for click detection
    this._addBtnBounds = { x: margin, y: btnY + this.pos[1], w: w - margin * 2, h: btnH };
  }

  onMouseDown(event, pos, canvas) {
    // Check "+ Add Lora" button
    const [mx, my] = pos;
    const h = this.size[1], margin = 10, btnH = 26;
    const btnY = h - btnH - 8;
    if (mx >= margin && mx <= this.size[0] - margin && my >= btnY && my <= btnY + btnH) {
      this._showAddLoraMenu(event);
      return true;
    }
    return false;
  }

  _showAddLoraMenu(event) {
    fetch("/object_info/LoraLoader")
      .then(r => r.json())
      .then(data => {
        const loras = data?.LoraLoader?.input?.required?.lora_name?.[0] ?? [];
        const menuItems = loras.map(l => ({
          content: l,
          callback: () => {
            const w = this.addLoraRow({ on: true, lora: l, strength: 1.0, strengthTwo: null });
            this.size[1] = Math.max(this.size[1], this.computeSize()[1]);
            this.setDirtyCanvas(true, true);
          }
        }));
        new LiteGraph.ContextMenu(menuItems, {
          title: "Add LoRA",
          event: event,
        });
      })
      .catch(() => console.warn("[Winnougan] Could not load lora list."));
  }

  getExtraMenuOptions(canvas, options) {
    // Right-click on a lora row
    const pos = canvas.canvas_mouse;
    if (!pos) return;
    const localPos = [pos[0] - this.pos[0], pos[1] - this.pos[1]];

    const loraWidgets = this._loraWidgets();
    for (const widget of loraWidgets) {
      const wy = widget.last_y;
      const wh = 30;
      if (localPos[1] >= wy && localPos[1] <= wy + wh) {
        const idx = loraWidgets.indexOf(widget);
        options.push(
          null,
          {
            content: widget.value.on ? "⚫ Toggle Off" : "🟢 Toggle On",
            callback: () => { widget.value.on = !widget.value.on; this.setDirtyCanvas(true); }
          },
          {
            content: "⬆️ Move Up",
            disabled: idx === 0,
            callback: () => {
              const all = this.widgets;
              const wi = all.indexOf(widget);
              if (wi > 0) { [all[wi - 1], all[wi]] = [all[wi], all[wi - 1]]; }
              this.setDirtyCanvas(true);
            }
          },
          {
            content: "⬇️ Move Down",
            disabled: idx === loraWidgets.length - 1,
            callback: () => {
              const all = this.widgets;
              const wi = all.indexOf(widget);
              if (wi < all.length - 1) { [all[wi], all[wi + 1]] = [all[wi + 1], all[wi]]; }
              this.setDirtyCanvas(true);
            }
          },
          {
            content: "🗑️ Remove",
            callback: () => { this.removeLoraWidget(widget); }
          }
        );
        return;
      }
    }
  }

  onSerialize(o) {
    o.widgets_values = this._loraWidgets().map(w => w.serialize());
  }

  onConfigure(o) {
    // Restore lora widgets from saved data
    const saved = o.widgets_values ?? [];
    // Clear existing lora widgets
    this.widgets = (this.widgets ?? []).filter(w => !w.name?.startsWith("lora_"));
    this._loraCounter = 0;
    for (const v of saved) {
      if (v && typeof v.lora !== "undefined") {
        this.addLoraRow(v);
      }
    }
    this.size[1] = Math.max(130 + this._loraWidgets().length * 34, this.size[1] ?? 0);
  }

  computeSize() {
    const rows = this._loraWidgets().length;
    return [340, 130 + rows * 34];
  }
}

// ── Register ──────────────────────────────────────────────────────────────────

app.registerExtension({
  name: "Winnougan.PowerLoraLoader",

  async beforeRegisterNodeDef(nodeType, nodeData, app) {
    if (nodeData.name !== NODE_TYPE) return;

    // Override the node class
    const origOnNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      origOnNodeCreated?.call(this);
      this.color = "#1a2a1a";
      this.bgcolor = "#0f1f0f";
      this._loraCounter = 0;
      this.serialize_widgets = true;
      this.properties ??= {};
      this.properties[PROP_SHOW_STRENGTHS] ??= PROP_VALUE_SINGLE;

      // Ensure outputs/inputs exist
      if (this.outputs?.length === 0) {
        this.addOutput("MODEL", "MODEL");
        this.addOutput("CLIP", "CLIP");
      }
      if (this.inputs?.length === 0) {
        this.addInput("model", "MODEL");
        this.addInput("clip", "CLIP");
      }

      this.size = [340, 130];
    };

    nodeType.prototype._loraWidgets = function () {
      return (this.widgets ?? []).filter(w => w.name?.startsWith("lora_"));
    };

    nodeType.prototype.addLoraRow = function (value) {
      this._loraCounter = (this._loraCounter ?? 0) + 1;
      const w = new PowerLoraWidget("lora_" + this._loraCounter);
      if (value) w.value = { on: true, lora: null, strength: 1.0, strengthTwo: null, ...value };
      this.widgets ??= [];
      this.widgets.push(w);
      this.size[1] = Math.max(130 + this._loraWidgets().length * 34, this.size[1]);
      this.setDirtyCanvas(true, true);
      return w;
    };

    nodeType.prototype.removeLoraWidget = function (widget) {
      const idx = (this.widgets ?? []).indexOf(widget);
      if (idx !== -1) this.widgets.splice(idx, 1);
      this.size[1] = Math.max(130 + this._loraWidgets().length * 34, 130);
      this.setDirtyCanvas(true, true);
    };

    nodeType.prototype._showAddLoraMenu = function (event) {
      fetch("/object_info/LoraLoader")
        .then(r => r.json())
        .then(data => {
          const loras = data?.LoraLoader?.input?.required?.lora_name?.[0] ?? [];
          const items = loras.map(l => ({
            content: l,
            callback: () => {
              this.addLoraRow({ on: true, lora: l, strength: 1.0 });
            }
          }));
          new LiteGraph.ContextMenu(items, { title: "Add LoRA", event });
        })
        .catch(() => console.warn("[Winnougan] Could not load lora list."));
    };

    nodeType.prototype.onDrawForeground = function (ctx) {
      if (this.flags?.collapsed) return;
      const w = this.size[0], h = this.size[1];
      const margin = 10, btnH = 26;
      const btnY = h - btnH - 8;

      ctx.save();
      ctx.fillStyle = "#2a5a2a";
      ctx.strokeStyle = "#4aaf4a";
      ctx.lineWidth = 1;
      const bx = margin, bw = w - margin * 2;
      ctx.beginPath();
      ctx.roundRect(bx, btnY, bw, btnH, 5);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#ccffcc";
      ctx.font = `bold ${btnH * 0.46}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("➕ Add Lora", bx + bw / 2, btnY + btnH / 2);
      ctx.restore();

      this._addBtnRelY = btnY;
      this._addBtnH = btnH;
    };

    nodeType.prototype.onMouseDown = function (event, pos) {
      const [mx, my] = pos;
      const margin = 10, btnH = this._addBtnH ?? 26;
      const btnY = this._addBtnRelY ?? (this.size[1] - btnH - 8);

      if (mx >= margin && mx <= this.size[0] - margin && my >= btnY && my <= btnY + btnH) {
        this._showAddLoraMenu(event);
        return true;
      }

      // Pass to lora widgets
      for (const w of this._loraWidgets()) {
        if (w.mouse && w.mouse(event, pos, this)) return true;
      }
      return false;
    };

    nodeType.prototype.onMouseMove = function (event, pos) {
      for (const w of this._loraWidgets()) {
        if (w.mouse && w.mouse(event, pos, this)) return true;
      }
    };

    nodeType.prototype.onMouseUp = function (event, pos) {
      for (const w of this._loraWidgets()) {
        if (w.mouse && w.mouse(event, pos, this)) return true;
      }
    };

    const origGetExtraMenuOptions = nodeType.prototype.getExtraMenuOptions;
    nodeType.prototype.getExtraMenuOptions = function (canvas, options) {
      origGetExtraMenuOptions?.call(this, canvas, options);

      const mouse = canvas.canvas_mouse;
      if (!mouse) return;
      const localY = mouse[1] - this.pos[1];

      const loraWidgets = this._loraWidgets();
      for (let idx = 0; idx < loraWidgets.length; idx++) {
        const widget = loraWidgets[idx];
        const wy = widget.last_y ?? 0;
        if (localY >= wy && localY <= wy + 32) {
          options.push(
            null,
            {
              content: widget.value.on ? "⚫ Toggle Off" : "🟢 Toggle On",
              callback: () => { widget.value.on = !widget.value.on; this.setDirtyCanvas(true); }
            },
            {
              content: "⬆️ Move Up",
              disabled: idx === 0,
              callback: () => {
                const all = this.widgets;
                const wi = all.indexOf(widget);
                if (wi > 0) [all[wi - 1], all[wi]] = [all[wi], all[wi - 1]];
                this.setDirtyCanvas(true);
              }
            },
            {
              content: "⬇️ Move Down",
              disabled: idx === loraWidgets.length - 1,
              callback: () => {
                const all = this.widgets;
                const wi = all.indexOf(widget);
                if (wi < all.length - 1) [all[wi], all[wi + 1]] = [all[wi + 1], all[wi]];
                this.setDirtyCanvas(true);
              }
            },
            {
              content: "🗑️ Remove",
              callback: () => { this.removeLoraWidget(widget); }
            }
          );
          return;
        }
      }

      // Global toggle option
      options.push(null, {
        content: "Show Separate Model & Clip Strengths",
        callback: () => {
          const cur = this.properties[PROP_SHOW_STRENGTHS];
          this.properties[PROP_SHOW_STRENGTHS] =
            cur === PROP_VALUE_SEPARATE ? PROP_VALUE_SINGLE : PROP_VALUE_SEPARATE;
          for (const w of loraWidgets) {
            if (this.properties[PROP_SHOW_STRENGTHS] === PROP_VALUE_SEPARATE) {
              w.value.strengthTwo = w.value.strength;
            } else {
              w.value.strengthTwo = null;
            }
          }
          this.setDirtyCanvas(true);
        }
      });
    };

    nodeType.prototype.onSerialize = function (o) {
      o.widgets_values = this._loraWidgets().map(w => w.serialize());
    };

    nodeType.prototype.onConfigure = function (o) {
      const saved = o.widgets_values ?? [];
      this.widgets = (this.widgets ?? []).filter(w => !w.name?.startsWith("lora_"));
      this._loraCounter = 0;
      for (const v of saved) {
        if (v && typeof v.lora !== "undefined") this.addLoraRow(v);
      }
      this.size[1] = Math.max(130 + this._loraWidgets().length * 34, this.size[1] ?? 130);
    };

    // Custom draw for lora rows
    const origOnDrawWidgets = nodeType.prototype.onDrawWidgets;
    nodeType.prototype.onDrawWidgets = function (ctx) {
      origOnDrawWidgets?.call(this, ctx);
      let posY = LiteGraph.NODE_TITLE_HEIGHT + 6;
      for (const w of this._loraWidgets()) {
        w.draw(ctx, this, this.size[0], posY, 28);
        posY += 32;
      }
    };
  },
});
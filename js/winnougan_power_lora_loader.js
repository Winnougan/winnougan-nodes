import { app } from "../../scripts/app.js";

const NODE_TYPE = "WinnouganPowerLoraLoader";
const NODE_TITLE = "Winnougan Power Lora Loader";

const PROP_SHOW_STRENGTHS = "Show Strengths";
const PROP_VALUE_SINGLE = "Single Strength";
const PROP_VALUE_SEPARATE = "Separate Model & Clip";

// ── Cached lora list ──────────────────────────────────────────────────────────

let _loraCache = null;
function getLoras() {
  if (_loraCache) return Promise.resolve(_loraCache);
  return fetch("/object_info/LoraLoader")
    .then(r => r.json())
    .then(data => {
      _loraCache = data?.LoraLoader?.input?.required?.lora_name?.[0] ?? [];
      return _loraCache;
    });
}

// ── Live search dialog ────────────────────────────────────────────────────────

function showLoraSearchDialog(currentValue, onSelect) {
  const existing = document.getElementById("winnougan-lora-search-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "winnougan-lora-search-overlay";
  Object.assign(overlay.style, {
    position: "fixed", inset: "0", zIndex: "9999",
    background: "rgba(0,0,0,0.5)",
    display: "flex", alignItems: "center", justifyContent: "center",
  });

  const dialog = document.createElement("div");
  Object.assign(dialog.style, {
    background: "#1a1a1a", border: "1px solid #444",
    borderRadius: "8px", padding: "12px",
    width: "480px", maxWidth: "90vw",
    display: "flex", flexDirection: "column", gap: "8px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
  });

  const title = document.createElement("div");
  title.textContent = "Search LoRA";
  Object.assign(title.style, {
    color: "#ccc", fontSize: "12px", fontWeight: "bold",
    textTransform: "uppercase", letterSpacing: "0.08em",
    marginBottom: "2px",
  });

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Type to filter... (e.g. 'aes')";
  input.value = currentValue || "";
  Object.assign(input.style, {
    background: "#111", border: "1px solid #555", borderRadius: "5px",
    color: "#eee", fontSize: "14px", padding: "8px 10px",
    outline: "none", width: "100%", boxSizing: "border-box",
  });

  const list = document.createElement("div");
  Object.assign(list.style, {
    maxHeight: "320px", overflowY: "auto",
    border: "1px solid #333", borderRadius: "5px",
    background: "#111",
  });

  const status = document.createElement("div");
  Object.assign(status.style, {
    color: "#666", fontSize: "12px", textAlign: "center", padding: "4px 0",
  });

  dialog.appendChild(title);
  dialog.appendChild(input);
  dialog.appendChild(list);
  dialog.appendChild(status);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  let allLoras = [];
  let selectedIndex = -1;
  let rows = [];

  function renderList(filter) {
    list.innerHTML = "";
    rows = [];
    selectedIndex = -1;

    const q = filter.trim().toLowerCase();
    const filtered = q
      ? allLoras.filter(l => l.toLowerCase().includes(q))
      : allLoras;

    status.textContent = `${filtered.length} of ${allLoras.length} loras`;

    if (filtered.length === 0) {
      const empty = document.createElement("div");
      empty.textContent = "No matches found";
      Object.assign(empty.style, {
        color: "#555", fontSize: "13px", padding: "12px", textAlign: "center",
      });
      list.appendChild(empty);
      return;
    }

    filtered.forEach((lora, i) => {
      const row = document.createElement("div");
      const loraName = lora.split(/[\\/]/).pop();
      const loraPath = lora.includes("/") || lora.includes("\\")
        ? lora.substring(0, lora.lastIndexOf(loraName))
        : "";

      row.innerHTML = q
        ? highlightMatch(lora, q)
        : `<span style="color:#ccc">${escapeHtml(lora)}</span>`;

      Object.assign(row.style, {
        padding: "7px 10px", cursor: "pointer", fontSize: "13px",
        borderBottom: "1px solid #1e1e1e", userSelect: "none",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      });

      row.addEventListener("mouseenter", () => setSelected(i));
      row.addEventListener("click", () => { choose(filtered[i]); });
      list.appendChild(row);
      rows.push({ el: row, value: filtered[i] });
    });

    if (rows.length > 0) setSelected(0);
  }

  function highlightMatch(text, q) {
    const escaped = escapeHtml(text);
    const idx = text.toLowerCase().indexOf(q);
    if (idx === -1) return `<span style="color:#ccc">${escaped}</span>`;
    const before = escapeHtml(text.slice(0, idx));
    const match = escapeHtml(text.slice(idx, idx + q.length));
    const after = escapeHtml(text.slice(idx + q.length));
    return `<span style="color:#ccc">${before}<span style="color:#7dffb3;font-weight:bold">${match}</span>${after}</span>`;
  }

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function setSelected(i) {
    rows.forEach((r, ri) => {
      r.el.style.background = ri === i ? "#2a4a3a" : "transparent";
    });
    selectedIndex = i;
    if (rows[i]) {
      rows[i].el.scrollIntoView({ block: "nearest" });
    }
  }

  function choose(value) {
    overlay.remove();
    onSelect(value);
  }

  function close() {
    overlay.remove();
  }

  input.addEventListener("input", () => renderList(input.value));

  input.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected(Math.min(selectedIndex + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected(Math.max(selectedIndex - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && rows[selectedIndex]) {
        choose(rows[selectedIndex].value);
      } else if (input.value.trim()) {
        choose(input.value.trim());
      }
    } else if (e.key === "Escape") {
      close();
    }
  });

  overlay.addEventListener("click", e => {
    if (e.target === overlay) close();
  });

  getLoras().then(loras => {
    allLoras = loras;
    renderList(input.value);
    input.focus();
    input.select();
  }).catch(() => {
    status.textContent = "Could not load lora list — press Enter to use typed name";
    input.focus();
    input.addEventListener("keydown", e => {
      if (e.key === "Enter" && input.value.trim()) choose(input.value.trim());
    });
  });
}

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
  const knobX = value ? tx + tw - r - 2 : tx + r + 2;
  ctx.beginPath();
  ctx.arc(knobX, ty + r, r - 2, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  return [x, tw + 8];
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
  drawArrowButton(ctx, startX, posY, bw, h, -1);
  ctx.fillStyle = LiteGraph.WIDGET_BGCOLOR ?? "#333";
  ctx.fillRect(startX + bw, posY + h * 0.15, vw, h * 0.7);
  ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR ?? "#eee";
  ctx.font = `bold ${h * 0.42}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(Number(value).toFixed(2), startX + bw + vw / 2, posY + h / 2);
  drawArrowButton(ctx, startX + bw + vw, posY, bw, h, 1);
  return [startX, totalW];
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
    this._value = (v && typeof v === "object")
      ? v
      : { on: true, lora: null, strength: 1.0, strengthTwo: null };
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

    const [tX, tW] = drawToggle(ctx, margin + 4, posY, height, this._value.on);
    this.hitAreas.toggle = { x: tX, y: posY, w: tW + 4, h: height };
    let posX = margin + 4 + tW + im;

    if (lowQ) { ctx.restore(); return; }

    ctx.globalAlpha = this._value.on ? 1 : 0.45;
    ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR ?? "#ccc";
    ctx.textBaseline = "middle";

    let rposX = widgetWidth - margin - im;

    if (showSep && this._value.strengthTwo != null) {
      const [sx2, sw2] = drawStrengthWidget(ctx, rposX, posY, height, this._value.strengthTwo ?? 1);
      this.hitAreas.strengthTwo = { x: sx2, y: posY, w: sw2, h: height };
      rposX = sx2 - im * 2;
    }

    const [sx, sw] = drawStrengthWidget(ctx, rposX, posY, height, this._value.strength ?? 1);
    this.hitAreas.strength = { x: sx, y: posY, w: sw, h: height };
    rposX = sx - im;

    const loraW = rposX - posX - im;
    ctx.textAlign = "left";
    ctx.font = `${height * 0.4}px sans-serif`;
    const label = this._value.lora || "None";
    ctx.fillText(fitString(ctx, label, loraW), posX, midY);
    this.hitAreas.lora = { x: posX, y: posY, w: loraW, h: height };

    ctx.restore();
  }

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
        showLoraSearchDialog(this._value.lora, (chosen) => {
          this._value.lora = chosen;
          node.setDirtyCanvas(true);
        });
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

  serialize() {
    const v = { ...this._value };
    if (v.strengthTwo === null) delete v.strengthTwo;
    return v;
  }
}

// ── Register extension ────────────────────────────────────────────────────────

app.registerExtension({
  name: "Winnougan.PowerLoraLoader",

  async beforeRegisterNodeDef(nodeType, nodeData, app) {
    if (nodeData.name !== NODE_TYPE) return;

    const origOnNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      origOnNodeCreated?.call(this);
      this.color = "#1a2a1a";
      this.bgcolor = "#0f1f0f";
      this._loraCounter = 0;
      this.serialize_widgets = true;
      this.properties ??= {};
      this.properties[PROP_SHOW_STRENGTHS] ??= PROP_VALUE_SINGLE;

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

    nodeType.prototype._showAddLoraMenu = function () {
      showLoraSearchDialog(null, (chosen) => {
        if (chosen) this.addLoraRow({ on: true, lora: chosen, strength: 1.0 });
      });
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
        this._showAddLoraMenu();
        return true;
      }

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
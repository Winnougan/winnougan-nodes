import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const NODE_TYPE = "WinnouganPowerLoraLoader";

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


const NODE_TITLE = "Winnougan Power Lora Loader";

const PROP_SHOW_STRENGTHS = "Show Strengths";
const PROP_VALUE_SINGLE = "Single Strength";
const PROP_VALUE_SEPARATE = "Separate Model & Clip";

// ── Cached lora list ──────────────────────────────────────────────────────────

let _loraCache = null;

function invalidateLoraCache() {
  _loraCache = null;
}

function getLoras() {
  if (_loraCache) return Promise.resolve(_loraCache);
  return fetch("/object_info/LoraLoader")
    .then(r => r.json())
    .then(data => {
      _loraCache = data?.LoraLoader?.input?.required?.lora_name?.[0] ?? [];
      return _loraCache;
    });
}

// Bust the cache whenever ComfyUI refreshes node definitions (triggered by "r")
api.addEventListener("graphCleared", invalidateLoraCache);
api.addEventListener("reconnected", invalidateLoraCache);

// Also hook into the native refreshComboInNodes if available
const _origRefresh = app.refreshComboInNodes?.bind(app);
if (_origRefresh) {
  app.refreshComboInNodes = function (...args) {
    invalidateLoraCache();
    return _origRefresh(...args);
  };
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
    const filtered = q ? allLoras.filter(l => l.toLowerCase().includes(q)) : allLoras;

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
      const q2 = filter.trim().toLowerCase();
      row.innerHTML = q2 ? highlightMatch(lora, q2) : `<span style="color:#ccc">${escapeHtml(lora)}</span>`;
      Object.assign(row.style, {
        padding: "7px 10px", cursor: "pointer", fontSize: "13px",
        borderBottom: "1px solid #1e1e1e", userSelect: "none",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      });
      row.addEventListener("mouseenter", () => setSelected(i));
      row.addEventListener("click", () => choose(filtered[i]));
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
    const match  = escapeHtml(text.slice(idx, idx + q.length));
    const after  = escapeHtml(text.slice(idx + q.length));
    return `<span style="color:#ccc">${before}<span style="color:#7dffb3;font-weight:bold">${match}</span>${after}</span>`;
  }

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function setSelected(i) {
    rows.forEach((r, ri) => { r.el.style.background = ri === i ? "#2a4a3a" : "transparent"; });
    selectedIndex = i;
    if (rows[i]) rows[i].el.scrollIntoView({ block: "nearest" });
  }

  function choose(value) { overlay.remove(); onSelect(value); }

  input.addEventListener("input", () => renderList(input.value));
  input.addEventListener("keydown", e => {
    if      (e.key === "ArrowDown") { e.preventDefault(); setSelected(Math.min(selectedIndex + 1, rows.length - 1)); }
    else if (e.key === "ArrowUp")   { e.preventDefault(); setSelected(Math.max(selectedIndex - 1, 0)); }
    else if (e.key === "Enter")     { e.preventDefault(); if (selectedIndex >= 0 && rows[selectedIndex]) choose(rows[selectedIndex].value); else if (input.value.trim()) choose(input.value.trim()); }
    else if (e.key === "Escape")    { overlay.remove(); }
  });
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });

  getLoras().then(loras => {
    allLoras = loras;
    renderList(input.value);
    input.focus();
    input.select();
  }).catch(() => {
    status.textContent = "Could not load lora list — press Enter to use typed name";
    input.focus();
  });
}

// ── Strength input dialog ─────────────────────────────────────────────────────

function showStrengthDialog(currentValue, onConfirm) {
  const existing = document.getElementById("winnougan-strength-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "winnougan-strength-overlay";
  Object.assign(overlay.style, {
    position: "fixed", inset: "0", zIndex: "9999",
    background: "rgba(0,0,0,0.45)",
    display: "flex", alignItems: "center", justifyContent: "center",
  });

  const dialog = document.createElement("div");
  Object.assign(dialog.style, {
    background: "#1a1a1a", border: "1px solid #444",
    borderRadius: "8px", padding: "16px",
    width: "260px",
    display: "flex", flexDirection: "column", gap: "10px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
  });

  const title = document.createElement("div");
  title.textContent = "Set Strength";
  Object.assign(title.style, {
    color: "#ccc", fontSize: "12px", fontWeight: "bold",
    textTransform: "uppercase", letterSpacing: "0.08em",
  });

  const input = document.createElement("input");
  input.type = "number";
  input.step = "0.01";
  input.value = Number(currentValue).toFixed(2);
  Object.assign(input.style, {
    background: "#111", border: "1px solid #555", borderRadius: "5px",
    color: "#eee", fontSize: "18px", padding: "8px 10px",
    outline: "none", width: "100%", boxSizing: "border-box",
    textAlign: "center", fontFamily: "monospace",
  });

  const btnRow = document.createElement("div");
  Object.assign(btnRow.style, { display: "flex", gap: "8px" });

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  Object.assign(cancelBtn.style, {
    flex: "1", padding: "7px", background: "#222", border: "1px solid #444",
    borderRadius: "5px", color: "#888", cursor: "pointer", fontSize: "13px",
  });

  const confirmBtn = document.createElement("button");
  confirmBtn.textContent = "Set";
  Object.assign(confirmBtn.style, {
    flex: "1", padding: "7px", background: "#2a5a2a", border: "1px solid #4aaf4a",
    borderRadius: "5px", color: "#cfffcf", cursor: "pointer", fontSize: "13px",
    fontWeight: "bold",
  });

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(confirmBtn);
  dialog.appendChild(title);
  dialog.appendChild(input);
  dialog.appendChild(btnRow);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  function confirm() {
    const v = parseFloat(input.value);
    if (!isNaN(v)) onConfirm(Math.round(v * 100) / 100);
    overlay.remove();
  }

  confirmBtn.addEventListener("click", confirm);
  cancelBtn.addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
  input.addEventListener("keydown", e => {
    if (e.key === "Enter")  confirm();
    if (e.key === "Escape") overlay.remove();
  });

  input.focus();
  input.select();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isLowQuality() { return app.canvas.ds.scale < 0.6; }

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
  const tw = 22, th = h * 0.60;
  const tx = x + 4, ty = y + (h - th) / 2;
  const r  = th / 2;
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
  ctx.roundRect(x, y + h * 0.1, w, h * 0.8, 3);
  ctx.fillStyle = LiteGraph.WIDGET_BGCOLOR ?? "#333";
  ctx.fill();
  ctx.fillStyle    = LiteGraph.WIDGET_TEXT_COLOR ?? "#ccc";
  ctx.font         = `${h * 0.45}px sans-serif`;
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(dir < 0 ? "◀" : "▶", x + w / 2, y + h / 2);
  return [x, w];
}

function drawStrengthWidget(ctx, posX, posY, h, value, direction = -1) {
  const bw = 14, vw = 42;
  const totalW = bw + vw + bw;
  const startX = direction < 0 ? posX - totalW : posX;
  drawArrowButton(ctx, startX, posY, bw, h, -1);
  ctx.fillStyle = LiteGraph.WIDGET_BGCOLOR ?? "#333";
  ctx.fillRect(startX + bw, posY + h * 0.1, vw, h * 0.8);
  ctx.fillStyle    = LiteGraph.WIDGET_TEXT_COLOR ?? "#eee";
  ctx.font         = `bold ${h * 0.55}px monospace`;
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(Number(value).toFixed(2), startX + bw + vw / 2, posY + h / 2);
  drawArrowButton(ctx, startX + bw + vw, posY, bw, h, 1);
  return [startX, totalW];
}

function fitString(ctx, str, maxWidth) {
  if (ctx.measureText(str).width <= maxWidth) return str;
  while (str.length > 1 && ctx.measureText(str + "…").width > maxWidth) str = str.slice(0, -1);
  return str + "…";
}

// ── Row height constant ───────────────────────────────────────────────────────

const ROW_HEIGHT = 24; // compact rows matching rgthree

// ── Global toggle header widget ───────────────────────────────────────────────

class GlobalToggleWidget {
  constructor() {
    this.name = "__global_toggle__";
    this.type = "custom";
    this.last_y = 0;
    this.hitArea = null;
  }

  computeSize() { return [220, 0]; }  // height managed manually

  draw(ctx, node, widgetWidth, posY, height) {
    this.last_y = posY;
    if (!node._manualDraw) return;  // only render from our manual loop
    if (isLowQuality()) return;

    const margin = 10;
    const midY   = posY + height / 2;
    const state  = node._allLorasOn();

    ctx.save();

    const [tX, tW] = drawToggle(ctx, margin, posY, height, state);
    this.hitArea = { x: tX, y: posY, w: tW + 4, h: height };

    ctx.fillStyle    = "#5a8a5a";
    ctx.font         = `bold 9px sans-serif`;
    ctx.textAlign    = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("Toggle All", margin + tW + 6, midY);
    ctx.textAlign = "right";
    ctx.fillText("Strength", widgetWidth - margin - 4, midY);
    ctx.restore();
  }

  mouse(event, pos, node) {
    if (event.type !== "pointerdown" && event.type !== "mousedown") return false;
    const [mx, my] = pos;
    const r = this.hitArea;
    if (r && mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
      node._toggleAllLoras();
      node.setDirtyCanvas(true);
      return true;
    }
    return false;
  }
}

// ── Individual lora row widget ────────────────────────────────────────────────

class PowerLoraWidget {
  constructor(name) {
    this.name  = name;
    this.type  = "custom";
    this.y     = 0;
    this.last_y = 0;
    this._value = { on: true, lora: null, strength: 1.0, strengthTwo: null };
    this.hitAreas = {};
    this.draggingStrength = false;
    this.dragStartX = 0;
    this.dragStartVal = 0;
    this.dragIsTwo = false;
  }

  get value()  { return this._value; }
  set value(v) { this._value = (v && typeof v === "object") ? v : { on: true, lora: null, strength: 1.0, strengthTwo: null }; }

  computeSize() { return [220, 0]; }  // height managed manually in onDrawBackground

  draw(ctx, node, widgetWidth, posY, height) {
    this.last_y = posY;
    if (!node._manualDraw) return;  // only render from our manual loop
    const margin = 10, im = margin * 0.33;
    const lowQ   = isLowQuality();
    const midY   = posY + height / 2;
    const showSep = node.properties?.[PROP_SHOW_STRENGTHS] === PROP_VALUE_SEPARATE;

    // Check if this row has a live input connection
    const inputIdx    = node.inputs?.findIndex(inp => inp.name === this.name) ?? -1;
    const isConnected = inputIdx !== -1 && node.inputs[inputIdx]?.link != null;

    ctx.save();

    const [tX, tW] = drawToggle(ctx, margin + 4, posY, height, this._value.on);
    this.hitAreas.toggle = { x: tX, y: posY, w: tW + 4, h: height };
    let posX = margin + 4 + tW + im;

    if (lowQ) { ctx.restore(); return; }

    ctx.globalAlpha = this._value.on ? 1 : 0.45;
    ctx.fillStyle   = LiteGraph.WIDGET_TEXT_COLOR ?? "#ccc";
    ctx.textBaseline = "middle";

    // ── Remove button (✕) on the far right ─────────────────────────────────
    const removeSize = height * 0.75;
    const removeX    = widgetWidth - margin - removeSize;
    const removeY    = posY + (height - removeSize) / 2;
    ctx.beginPath();
    ctx.roundRect(removeX, removeY, removeSize, removeSize, 3);
    ctx.fillStyle = "#1a0800";
    ctx.fill();
    ctx.strokeStyle = "#662200";
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.fillStyle    = "#cc4400";
    ctx.font         = `bold ${removeSize * 0.65}px sans-serif`;
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("✕", removeX + removeSize / 2, removeY + removeSize / 2);
    this.hitAreas.remove = { x: removeX, y: removeY, w: removeSize, h: removeSize };

    let rposX = widgetWidth - margin - im - removeSize - 4;

    if (showSep && this._value.strengthTwo != null) {
      const [sx2, sw2] = drawStrengthWidget(ctx, rposX, posY, height, this._value.strengthTwo ?? 1);
      this.hitAreas.strengthTwo = { x: sx2, y: posY, w: sw2, h: height };
      rposX = sx2 - im * 2;
    }

    const [sx, sw] = drawStrengthWidget(ctx, rposX, posY, height, this._value.strength ?? 1);
    this.hitAreas.strength = { x: sx, y: posY, w: sw, h: height };

    rposX = sx - im;

    const loraW = rposX - posX - im;

    if (isConnected) {
      ctx.textAlign = "left";
      ctx.font      = `italic ${height * 0.55}px sans-serif`;
      ctx.fillStyle = "#7dffb3";
      ctx.fillText("⟶ (connected)", posX, midY);
    } else {
      ctx.textAlign = "left";
      ctx.font      = `${height * 0.55}px sans-serif`;
      const label   = this._value.lora || "None";
      ctx.fillText(fitString(ctx, label, loraW), posX, midY);
    }
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
        const bw  = 18, vw = 50;
        const relX = mx - this.hitAreas.strength.x;
        if (relX < bw) {
          this.stepStrength(-1, false); node.setDirtyCanvas(true); return true;
        }
        if (relX > bw + vw) {
          this.stepStrength(1, false); node.setDirtyCanvas(true); return true;
        }
        showStrengthDialog(this._value.strength ?? 1, val => {
          this._value.strength = val;
          node.setDirtyCanvas(true);
        });
        return true;
      }

      if (inRect(this.hitAreas.strengthTwo)) {
        const bw  = 18, vw = 50;
        const relX = mx - this.hitAreas.strengthTwo.x;
        if (relX < bw) {
          this.stepStrength(-1, true); node.setDirtyCanvas(true); return true;
        }
        if (relX > bw + vw) {
          this.stepStrength(1, true); node.setDirtyCanvas(true); return true;
        }
        showStrengthDialog(this._value.strengthTwo ?? 1, val => {
          this._value.strengthTwo = val;
          node.setDirtyCanvas(true);
        });
        return true;
      }

      if (inRect(this.hitAreas.remove)) {
        node.removeLoraWidget(this);
        return true;
      }

      if (inRect(this.hitAreas.lora)) {
        const inputIdx    = node.inputs?.findIndex(inp => inp.name === this.name) ?? -1;
        const isConnected = inputIdx !== -1 && node.inputs[inputIdx]?.link != null;
        if (!isConnected) {
          showLoraSearchDialog(this._value.lora, (chosen) => {
            this._value.lora = chosen;
            node.setDirtyCanvas(true);
          });
        }
        return true;
      }
    }

    if ((event.type === "pointermove" || event.type === "mousemove") && this.draggingStrength) {
      const delta = (mx - this.dragStartX) * 0.01;
      const prop  = this.dragIsTwo ? "strengthTwo" : "strength";
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
      this.color   = "#1a3a1a";
      this.title   = "👉👈 Winnougan Power Lora Loader";
      this.bgcolor = "#0f1f0f";
            this._sparkles = new SparkleSystem(14);
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
        this.addInput("clip",  "CLIP");
      }


      this.widgets ??= [];
      this.widgets.push(new GlobalToggleWidget());

      this.size = [340, 60];
    };

    // ── Compact input slot positions ─────────────────────────────────────────
    // Override getConnectionPos so input slots stack tightly at top-left,
    // independent of LiteGraph's auto-spacing which was creating huge gaps.
    const SLOT_START_Y = 16;  // y of first input slot relative to node top
    const SLOT_STEP    = 14;  // vertical gap between slots — keep tight

    nodeType.prototype.getConnectionPos = function (isInput, slotNum, out) {
      out = out ?? [0, 0];
      if (isInput) {
        out[0] = this.pos[0];                              // left edge
        out[1] = this.pos[1] + SLOT_START_Y + slotNum * SLOT_STEP;
        return out;
      }
      // Outputs: use default LiteGraph behaviour
      return LiteGraph.LGraphNode.prototype.getConnectionPos.call(this, isInput, slotNum, out);
    };

    // ── All-loras state helpers ───────────────────────────────────────────────
    nodeType.prototype._loraWidgets = function () {
      return (this.widgets ?? []).filter(w => w.name?.startsWith("lora_"));
    };

    nodeType.prototype._allLorasOn = function () {
      const loras = this._loraWidgets();
      if (!loras.length) return false;
      return loras.every(w => w.value?.on === true);
    };

    nodeType.prototype._toggleAllLoras = function () {
      const loras  = this._loraWidgets();
      const turnOn = !this._allLorasOn();
      loras.forEach(w => { if (w.value) w.value.on = turnOn; });
    };

    // ── Sync input slots to match current lora widgets ────────────────────────
    nodeType.prototype._syncLoraInputs = function () {
      const loraWidgets = this._loraWidgets();
      const desired = new Set(loraWidgets.map(w => w.name));

      // Remove stale lora inputs (iterate backwards to keep indices stable)
      for (let i = (this.inputs ?? []).length - 1; i >= 0; i--) {
        const inp = this.inputs[i];
        if (inp.name.startsWith("lora_") && !desired.has(inp.name)) {
          this.removeInput(i);
        }
      }

      // Add any missing ones and pin their slot positions beside their rows
      for (const w of loraWidgets) {
        const exists = (this.inputs ?? []).some(inp => inp.name === w.name);
        if (!exists) this.addInput(w.name, "*");
      }
    };

    // ── Add lora row ──────────────────────────────────────────────────────────
    nodeType.prototype.addLoraRow = function (value) {
      this._loraCounter = (this._loraCounter ?? 0) + 1;
      const w = new PowerLoraWidget("lora_" + this._loraCounter);
      if (value) w.value = { on: true, lora: null, strength: 1.0, strengthTwo: null, ...value };
      this.widgets ??= [];
      this.widgets.push(w);
      this._syncLoraInputs();
      this._recalcHeight();
      this.setDirtyCanvas(true, true);
      return w;
    };

    nodeType.prototype.removeLoraWidget = function (widget) {
      const idx = (this.widgets ?? []).indexOf(widget);
      if (idx !== -1) this.widgets.splice(idx, 1);
      this._syncLoraInputs();
      this._recalcHeight();
      this.setDirtyCanvas(true, true);
    };

    // ── Height calculation ────────────────────────────────────────────────────
    nodeType.prototype._recalcHeight = function () {
      const rows    = this._loraWidgets().length;
      const slotH   = LiteGraph.NODE_SLOT_HEIGHT ?? 20;
      const nSlots  = Math.max((this.inputs?.length ?? 0), (this.outputs?.length ?? 0));
      const needed  = slotH * nSlots + 4  // slot rows
                    + 18 + 2              // global toggle + gap
                    + rows * ROW_HEIGHT   // lora rows (zero gap between)
                    + 32;                 // Add Lora button + bottom pad
      this.size[1] = needed;
    };

    nodeType.prototype._showAddLoraMenu = function () {
      showLoraSearchDialog(null, (chosen) => {
        if (chosen) this.addLoraRow({ on: true, lora: chosen, strength: 1.0 });
      });
    };


        // ── Enhanced glow + sparkles ──────────────────────────────────────────
    const origOnDrawBackground = nodeType.prototype.onDrawBackground;
    nodeType.prototype.onDrawBackground = function (ctx) {
        origOnDrawBackground?.call(this, ctx);
        if (!this._sparkles) this._sparkles = new SparkleSystem(14);
        drawEnhancedGlow(ctx, this, this._sparkles);

        // ── Manually draw all widgets with zero inter-row gap ─────────────
        this._manualDraw = true;
        // Because computeSize() returns 0, LiteGraph's own widget loop draws
        // nothing. We take full control here.
        if (!this.widgets?.length) return;
        const W   = this.size[0];
        const TH  = LiteGraph.NODE_TITLE_HEIGHT;
        // Start Y: below the input/output slot rows
        const slotH = LiteGraph.NODE_SLOT_HEIGHT ?? 20;
        const nSlots = Math.max(
            (this.inputs?.length ?? 0),
            (this.outputs?.length ?? 0)
        );
        let y = slotH * nSlots + 6;

        for (const widget of this.widgets) {
            if (widget.hidden) continue;
            const isLora   = widget.name?.startsWith("lora_");
            const isToggle = widget.name === "__global_toggle__";
            const rowH     = isLora ? ROW_HEIGHT : (isToggle ? 18 : 18);
            const gap      = isToggle ? 2 : 0; // tiny gap after header only
            widget.last_y  = y;
            if (widget.draw) widget.draw(ctx, this, W, y, rowH);
            y += rowH + gap;
        }
        // Store the bottom of the last widget for the Add Lora button
        this._widgetsBottomY = y;
        this._manualDraw = false;
    };

    // ── Draw foreground ───────────────────────────────────────────────────────
    // LiteGraph already calls draw() on custom widgets automatically.
    // onDrawForeground is only used here for the "Add Lora" button overlay.
    nodeType.prototype.onDrawForeground = function (ctx) {
      if (this.flags?.collapsed) return;

      // ── ⚡ WINNOUGAN badge ──────────────────────────────────────────────
      ctx.save();
      ctx.font = "bold 10px sans-serif"; ctx.textAlign = "right";
      ctx.fillStyle = "#4ade80"; ctx.shadowColor = "#4ade80";
      const _t = Date.now()/1000;
      ctx.shadowBlur = 6 + (0.5 + 0.5*Math.sin(_t*(2*Math.PI/3))) * 4;
      ctx.fillText("⚡ WINNOUGAN", this.size[0] - 76, 14);
      ctx.restore();

      // ── "Add Lora" button at the bottom ───────────────────────────────────
      const w = this.size[0], h = this.size[1];
      const margin = 8, btnH = 20;
      const btnY = (this._widgetsBottomY ?? (h - btnH - 8 - 8)) + 4;

      ctx.save();
      ctx.fillStyle   = "#2a5a2a";
      ctx.strokeStyle = "#4aaf4a";
      ctx.lineWidth   = 1;
      const bx = margin, bw = w - margin * 2;
      ctx.beginPath();
      ctx.roundRect(bx, btnY, bw, btnH, 5);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle    = "#ccffcc";
      ctx.font         = `bold ${btnH * 0.46}px sans-serif`;
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("➕ Add Lora", bx + bw / 2, btnY + btnH / 2);
      ctx.restore();

      this._addBtnRelY = btnY;
      this._addBtnH    = btnH;
    };

    // ── Mouse ─────────────────────────────────────────────────────────────────
    nodeType.prototype.onMouseDown = function (event, pos) {
      const [mx, my] = pos;
      const margin   = 10;
      const btnH     = this._addBtnH ?? 26;
      const btnY     = this._addBtnRelY ?? (this.size[1] - btnH - 8);

      if (mx >= margin && mx <= this.size[0] - margin && my >= btnY && my <= btnY + btnH) {
        this._showAddLoraMenu();
        return true;
      }

      for (const w of (this.widgets ?? [])) {
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

    // ── Right-click menu ──────────────────────────────────────────────────────
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
        if (localY >= wy && localY <= wy + ROW_HEIGHT) {
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
                const all = this.widgets, wi = all.indexOf(widget);
                if (wi > 0) [all[wi - 1], all[wi]] = [all[wi], all[wi - 1]];
                this.setDirtyCanvas(true);
              }
            },
            {
              content: "⬇️ Move Down",
              disabled: idx === loraWidgets.length - 1,
              callback: () => {
                const all = this.widgets, wi = all.indexOf(widget);
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
          this.properties[PROP_SHOW_STRENGTHS] = cur === PROP_VALUE_SEPARATE ? PROP_VALUE_SINGLE : PROP_VALUE_SEPARATE;
          for (const w of loraWidgets) {
            w.value.strengthTwo = this.properties[PROP_SHOW_STRENGTHS] === PROP_VALUE_SEPARATE ? w.value.strength : null;
          }
          this.setDirtyCanvas(true);
        }
      });
    };

    // ── Serialize / restore ───────────────────────────────────────────────────
    nodeType.prototype.onSerialize = function (o) {
      o.widgets_values = this._loraWidgets().map(w => w.serialize());
    };

    nodeType.prototype.onConfigure = function (o) {
      this.widgets = (this.widgets ?? []).filter(
        w => !w.name?.startsWith("lora_") && w.name !== "__global_toggle__"
      );
      this.widgets.unshift(new GlobalToggleWidget());
      this._loraCounter = 0;
      for (const v of o.widgets_values ?? []) {
        if (v && typeof v.lora !== "undefined") this.addLoraRow(v);
      }
      this.size[1] = Math.max(
        (() => { const s = LiteGraph.NODE_SLOT_HEIGHT ?? 20; const n = Math.max((this.inputs?.length??0),(this.outputs?.length??0)); return s*n+4+18+2+this._loraWidgets().length*ROW_HEIGHT+32; })(),
        this.size[1] ?? 100
      );
    };

    nodeType.prototype.computeSize = function () {
      const rows   = this._loraWidgets().length;
      const slotH  = LiteGraph.NODE_SLOT_HEIGHT ?? 20;
      const nSlots = Math.max((this.inputs?.length ?? 0), (this.outputs?.length ?? 0));
      const h      = slotH * nSlots + 6 + 22 + 4 + rows * ROW_HEIGHT + 42;
      return [340, h];
    };
  },
});

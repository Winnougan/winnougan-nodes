import { app } from "../../scripts/app.js";

const NODE_TYPE  = "WinnouganLTXResolutionPicker";

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


const NODE_TITLE = "Winnougan LTX Resolution Picker";

const PRESETS = [

  // ── LTX-Video 2.3 ─────────────────────────────────────────────────────────
  { label: "── LTX-Video 2.3 · 720p ──", separator: true },
  { label: "1280 × 720",  sub: "LTX 720p Landscape",       w: 1280, h: 720  },
  { label: "720 × 1280",  sub: "LTX 720p Portrait",        w: 720,  h: 1280 },
  { label: "1024 × 576",  sub: "LTX 720p Landscape Alt",   w: 1024, h: 576  },
  { label: "576 × 1024",  sub: "LTX 720p Portrait Alt",    w: 576,  h: 1024 },
  { label: "960 × 544",   sub: "LTX 720p Landscape Slim",  w: 960,  h: 544  },
  { label: "544 × 960",   sub: "LTX 720p Portrait Slim",   w: 544,  h: 960  },
  { label: "768 × 768",   sub: "LTX 720p Square",          w: 768,  h: 768  },

  { label: "── LTX-Video 2.3 · 1080p ──", separator: true },
  { label: "1920 × 1088", sub: "LTX 1080p Landscape",      w: 1920, h: 1088 },
  { label: "1088 × 1920", sub: "LTX 1080p Portrait",       w: 1088, h: 1920 },
  { label: "1472 × 832",  sub: "LTX 1080p Landscape Alt",  w: 1472, h: 832  },
  { label: "832 × 1472",  sub: "LTX 1080p Portrait Alt",   w: 832,  h: 1472 },
  { label: "1280 × 960",  sub: "LTX 1080p 4:3",            w: 1280, h: 960  },
  { label: "960 × 1280",  sub: "LTX 1080p 3:4 Portrait",   w: 960,  h: 1280 },
  { label: "1056 × 1056", sub: "LTX 1080p Square",         w: 1056, h: 1056 },

  { label: "── LTX-Video 2.3 · 2K ──", separator: true },
  { label: "2560 × 1440", sub: "LTX 2K QHD Landscape",     w: 2560, h: 1440 },
  { label: "1440 × 2560", sub: "LTX 2K QHD Portrait",      w: 1440, h: 2560 },
  { label: "2048 × 1152", sub: "LTX 2K 16:9 Landscape",    w: 2048, h: 1152 },
  { label: "1152 × 2048", sub: "LTX 2K 16:9 Portrait",     w: 1152, h: 2048 },
  { label: "1920 × 1440", sub: "LTX 2K 4:3 Landscape",     w: 1920, h: 1440 },
  { label: "1440 × 1920", sub: "LTX 2K 4:3 Portrait",      w: 1440, h: 1920 },
  { label: "1536 × 1536", sub: "LTX 2K Square",            w: 1536, h: 1536 },

  { label: "── LTX-Video 2.3 · 4K ──", separator: true },
  { label: "3840 × 2160", sub: "LTX 4K UHD Landscape",     w: 3840, h: 2160 },
  { label: "2160 × 3840", sub: "LTX 4K UHD Portrait",      w: 2160, h: 3840 },
  { label: "4096 × 2304", sub: "LTX 4K DCI Landscape",     w: 4096, h: 2304 },
  { label: "2304 × 4096", sub: "LTX 4K DCI Portrait",      w: 2304, h: 4096 },
  { label: "2880 × 2160", sub: "LTX 4K 4:3 Landscape",     w: 2880, h: 2160 },
  { label: "2160 × 2880", sub: "LTX 4K 4:3 Portrait",      w: 2160, h: 2880 },
  { label: "2048 × 2048", sub: "LTX 4K Square",            w: 2048, h: 2048 },

  // ── Wan2.2 · Image to Video 720p ──────────────────────────────────────────
  { label: "── Wan2.2 · I2V 720p ──", separator: true },
  { label: "1280 × 720",  sub: "Wan I2V-720p Horizontal HQ",  w: 1280, h: 720  },
  { label: "832 × 480",   sub: "Wan I2V-720p Horizontal MQ",  w: 832,  h: 480  },
  { label: "704 × 544",   sub: "Wan I2V-720p Horizontal LQ",  w: 704,  h: 544  },
  { label: "720 × 1280",  sub: "Wan I2V-720p Vertical HQ",    w: 720,  h: 1280 },
  { label: "480 × 832",   sub: "Wan I2V-720p Vertical MQ",    w: 480,  h: 832  },
  { label: "544 × 704",   sub: "Wan I2V-720p Vertical LQ",    w: 544,  h: 704  },
  { label: "624 × 624",   sub: "Wan I2V-720p Squarish",       w: 624,  h: 624  },

  // ── Wan2.2 · Image to Video 480p ──────────────────────────────────────────
  { label: "── Wan2.2 · I2V 480p ──", separator: true },
  { label: "832 × 480",   sub: "Wan I2V-480p Horizontal HQ",  w: 832,  h: 480  },
  { label: "704 × 544",   sub: "Wan I2V-480p Horizontal MQ",  w: 704,  h: 544  },
  { label: "480 × 832",   sub: "Wan I2V-480p Vertical HQ",    w: 480,  h: 832  },
  { label: "544 × 704",   sub: "Wan I2V-480p Vertical MQ",    w: 544,  h: 704  },
  { label: "624 × 624",   sub: "Wan I2V-480p Squarish",       w: 624,  h: 624  },

  // ── Wan2.2 · Text to Video 14B ────────────────────────────────────────────
  { label: "── Wan2.2 · T2V 14B ──", separator: true },
  { label: "1280 × 720",  sub: "Wan T2V-14B Horizontal HQ",  w: 1280, h: 720  },
  { label: "1088 × 832",  sub: "Wan T2V-14B Horizontal MQ",  w: 1088, h: 832  },
  { label: "832 × 480",   sub: "Wan T2V-14B Horizontal LQ",  w: 832,  h: 480  },
  { label: "720 × 1280",  sub: "Wan T2V-14B Vertical HQ",    w: 720,  h: 1280 },
  { label: "832 × 1088",  sub: "Wan T2V-14B Vertical MQ",    w: 832,  h: 1088 },
  { label: "480 × 832",   sub: "Wan T2V-14B Vertical LQ",    w: 480,  h: 832  },
  { label: "960 × 960",   sub: "Wan T2V-14B Squarish HQ",    w: 960,  h: 960  },
  { label: "624 × 624",   sub: "Wan T2V-14B Squarish MQ",    w: 624,  h: 624  },
  { label: "544 × 704",   sub: "Wan T2V-14B Squarish LQ",    w: 544,  h: 704  },

  // ── Wan2.2 · Text to Video 1.3B ───────────────────────────────────────────
  { label: "── Wan2.2 · T2V 1.3B ──", separator: true },
  { label: "832 × 480",   sub: "Wan T2V-1.3B Horizontal HQ", w: 832,  h: 480  },
  { label: "704 × 544",   sub: "Wan T2V-1.3B Horizontal MQ", w: 704,  h: 544  },
  { label: "480 × 832",   sub: "Wan T2V-1.3B Vertical HQ",   w: 480,  h: 832  },
  { label: "544 × 704",   sub: "Wan T2V-1.3B Vertical MQ",   w: 544,  h: 704  },
  { label: "624 × 624",   sub: "Wan T2V-1.3B Squarish",      w: 624,  h: 624  },
];

const REAL_PRESETS = PRESETS.filter(p => !p.separator);

// ── Preset picker dialog ──────────────────────────────────────────────────────

function showPresetDialog(currentLabel, onSelect) {
  const existing = document.getElementById("winnougan-ltx-res-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "winnougan-ltx-res-overlay";
  Object.assign(overlay.style, {
    position: "fixed", inset: "0", zIndex: "9999",
    background: "rgba(0,0,0,0.55)",
    display: "flex", alignItems: "center", justifyContent: "center",
  });

  const dialog = document.createElement("div");
  Object.assign(dialog.style, {
    background: "#141f14", border: "1px solid #3a6a3a",
    borderRadius: "10px", padding: "16px",
    width: "480px", maxWidth: "92vw",
    display: "flex", flexDirection: "column", gap: "10px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
  });

  const titleEl = document.createElement("div");
  titleEl.textContent = "Choose Video Resolution Preset";
  Object.assign(titleEl.style, {
    color: "#9effa0", fontSize: "11px", fontWeight: "bold",
    textTransform: "uppercase", letterSpacing: "0.1em",
  });

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Filter… (e.g. 'ltx 1080', 'wan 14b', 'portrait', '720')";
  Object.assign(input.style, {
    background: "#0d160d", border: "1px solid #3a6a3a", borderRadius: "6px",
    color: "#eee", fontSize: "13px", padding: "8px 12px",
    outline: "none", width: "100%", boxSizing: "border-box",
  });

  const list = document.createElement("div");
  Object.assign(list.style, {
    maxHeight: "420px", overflowY: "auto",
    border: "1px solid #2a4a2a", borderRadius: "6px",
    background: "#0d160d",
  });

  dialog.appendChild(titleEl);
  dialog.appendChild(input);
  dialog.appendChild(list);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  let selectedIndex = -1;
  let visibleItems  = [];

  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function hilite(text, q) {
    if (!q) return `<span style="color:#ccc">${esc(text)}</span>`;
    const i = text.toLowerCase().indexOf(q);
    if (i < 0) return `<span style="color:#ccc">${esc(text)}</span>`;
    return `<span style="color:#ccc">${esc(text.slice(0, i))}<span style="color:#7dffb3;font-weight:bold">${esc(text.slice(i, i + q.length))}</span>${esc(text.slice(i + q.length))}</span>`;
  }

  function renderList(filter) {
    list.innerHTML = "";
    visibleItems   = [];
    selectedIndex  = -1;
    const q = filter.trim().toLowerCase();

    PRESETS.forEach(preset => {
      if (preset.separator) {
        if (q) return;
        const sep = document.createElement("div");
        sep.textContent = preset.label;
        Object.assign(sep.style, {
          padding: "8px 14px 4px",
          color: "#4a8a4a", fontSize: "10px",
          fontWeight: "bold", textTransform: "uppercase",
          letterSpacing: "0.12em", borderTop: "1px solid #1a2a1a",
        });
        list.appendChild(sep);
        return;
      }

      const searchStr = `${preset.label} ${preset.sub}`.toLowerCase();
      if (q && !searchStr.includes(q)) return;

      const isCurrent = preset.label === currentLabel && preset.sub === (REAL_PRESETS.find(p => p.label === currentLabel)?.sub ?? "");
      const row = document.createElement("div");
      Object.assign(row.style, {
        display: "flex", alignItems: "center",
        padding: "9px 14px", cursor: "pointer",
        borderBottom: "1px solid #111",
        background: isCurrent ? "#1e3a1e" : "transparent",
        gap: "10px",
      });

      // Aspect ratio thumbnail
      const thumbWrap = document.createElement("div");
      Object.assign(thumbWrap.style, {
        width: "32px", height: "24px",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: "0",
      });
      const aspect = preset.w / preset.h;
      let tw, th;
      if (aspect >= 1) { tw = 30; th = Math.max(4, Math.round(30 / aspect)); }
      else             { th = 22; tw = Math.max(4, Math.round(22 * aspect)); }
      const thumb = document.createElement("div");
      Object.assign(thumb.style, {
        width: tw + "px", height: th + "px",
        background: isCurrent ? "#3a7a3a" : "#1e3a1e",
        border: `1px solid ${isCurrent ? "#7adf7a" : "#3a6a3a"}`,
        borderRadius: "1px",
      });
      thumbWrap.appendChild(thumb);

      // Text
      const textWrap = document.createElement("div");
      Object.assign(textWrap.style, { flex: "1", minWidth: "0" });

      const mainLabel = document.createElement("div");
      mainLabel.innerHTML = hilite(preset.label, q);
      Object.assign(mainLabel.style, { fontSize: "13px", fontWeight: "500" });

      const subLabel = document.createElement("div");
      subLabel.innerHTML = hilite(preset.sub, q);
      Object.assign(subLabel.style, { fontSize: "11px", color: "#5a8a5a", marginTop: "1px" });

      textWrap.appendChild(mainLabel);
      textWrap.appendChild(subLabel);
      row.appendChild(thumbWrap);
      row.appendChild(textWrap);

      const vi = visibleItems.length;
      row.addEventListener("mouseenter", () => setSelected(vi));
      row.addEventListener("click",      () => choose(preset));
      list.appendChild(row);
      visibleItems.push({ el: row, preset });
    });

    if (visibleItems.length === 0) {
      const empty = document.createElement("div");
      empty.textContent = "No presets match";
      Object.assign(empty.style, {
        color: "#555", fontSize: "13px", padding: "20px", textAlign: "center",
      });
      list.appendChild(empty);
    } else {
      const cur = visibleItems.findIndex(v =>
        v.preset.label === currentLabel
      );
      setSelected(cur >= 0 ? cur : 0);
    }
  }

  function setSelected(i) {
    visibleItems.forEach((v, ri) => {
      v.el.style.background = ri === i ? "#1e3a1e" : "transparent";
    });
    selectedIndex = i;
    visibleItems[i]?.el.scrollIntoView({ block: "nearest" });
  }

  function choose(preset) { overlay.remove(); onSelect(preset); }

  input.addEventListener("input",   () => renderList(input.value));
  input.addEventListener("keydown", e => {
    if      (e.key === "ArrowDown") { e.preventDefault(); setSelected(Math.min(selectedIndex + 1, visibleItems.length - 1)); }
    else if (e.key === "ArrowUp")   { e.preventDefault(); setSelected(Math.max(selectedIndex - 1, 0)); }
    else if (e.key === "Enter")     { e.preventDefault(); if (visibleItems[selectedIndex]) choose(visibleItems[selectedIndex].preset); }
    else if (e.key === "Escape")    { overlay.remove(); }
  });
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });

  renderList("");
  input.focus();
}

// ── Canvas helpers ────────────────────────────────────────────────────────────

function roundRect(ctx, x, y, w, h, r, fill, stroke, lw = 1) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill)   { ctx.fillStyle   = fill;   ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

// ── Register ──────────────────────────────────────────────────────────────────

app.registerExtension({
  name: "Winnougan.LTXResolutionPicker",

  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== NODE_TYPE) return;

    const orig = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      orig?.call(this);

      // Strip any native widgets
      setTimeout(() => {
        if (this.widgets?.length) {
          this.widgets = [];
          this.setDirtyCanvas(true, true);
        }
      }, 0);

      this.color   = "#1a2a1a";
      this.bgcolor = "#0f2a0f";
            this._sparkles = new SparkleSystem(14);
      this.title   = "👉👈 Winnougan LTX Resolution Picker";

      this._mode         = "preset";
      this._presetLabel  = "1280 × 720";
      this._presetSub    = "LTX 720p Landscape";
      this._customWidth  = 1280;
      this._customHeight = 720;
      this._length       = 97;
      this._batchSize    = 1;

      this.size = [310, 150];
    };

    nodeType.prototype.onSerialize = function (o) {
      const { w, h } = this._resolvedDims();
      o.widgets_values = [w, h, this._length, this._batchSize];
      o.winnougan_ltx_res = {
        mode:         this._mode,
        presetLabel:  this._presetLabel,
        presetSub:    this._presetSub,
        customWidth:  this._customWidth,
        customHeight: this._customHeight,
        length:       this._length,
        batchSize:    this._batchSize,
      };
    };

    nodeType.prototype.onConfigure = function (o) {
      if (this.widgets?.length) this.widgets = [];
      if (o.winnougan_ltx_res) {
        const r = o.winnougan_ltx_res;
        this._mode         = r.mode         ?? "preset";
        this._presetLabel  = r.presetLabel  ?? "1280 × 720";
        this._presetSub    = r.presetSub    ?? "LTX 720p Landscape";
        this._customWidth  = r.customWidth  ?? 1280;
        this._customHeight = r.customHeight ?? 720;
        this._length       = r.length       ?? 97;
        this._batchSize    = r.batchSize    ?? 1;
      }
      this.setDirtyCanvas(true);
    };

    nodeType.prototype._resolvedDims = function () {
      if (this._mode === "preset") {
        const preset = REAL_PRESETS.find(p => p.label === this._presetLabel && p.sub === this._presetSub)
          ?? REAL_PRESETS[0];
        return { w: preset.w, h: preset.h };
      }
      return { w: this._customWidth, h: this._customHeight };
    };

    nodeType.prototype._layout = function () {
      const TH  = LiteGraph.NODE_TITLE_HEIGHT;
      const W   = this.size[0];
      const pad = 14;
      const iw  = W - pad * 2;

      const modeY    = TH + 6;
      const modeH    = 20;
      const halfIw   = (iw - 6) / 2;
      const contentY = modeY + modeH + 8;

      return { TH, W, pad, iw, modeY, modeH, halfIw, contentY };
    };

    // ── Enhanced glow + sparkles ──────────────────────────────────────────
    const origOnDrawBackground = nodeType.prototype.onDrawBackground;
    nodeType.prototype.onDrawBackground = function (ctx) {
        origOnDrawBackground?.call(this, ctx);
        if (!this._sparkles) this._sparkles = new SparkleSystem(14);
        drawEnhancedGlow(ctx, this, this._sparkles);
    };

    nodeType.prototype.onDrawForeground = function (ctx) {
      if (this.flags?.collapsed) return;

            // ⚡ WINNOUGAN badge
            ctx.save();
            ctx.font = "bold 10px sans-serif"; ctx.textAlign = "right";
            ctx.fillStyle = "#4ade80"; ctx.shadowColor = "#4ade80";
            const _t = Date.now()/1000;
            ctx.shadowBlur = 6 + (0.5 + 0.5*Math.sin(_t*(2*Math.PI/3))) * 4;
            ctx.fillText("⚡ WINNOUGAN", this.size[0] - 82, 14);
            ctx.restore();
      const { TH, W, pad, iw, modeY, modeH, halfIw, contentY } = this._layout();

      ctx.save();

      // Mode tabs
      ["preset", "custom"].forEach((mode, i) => {
        const bx     = pad + i * (halfIw + 8);
        const active = this._mode === mode;
        roundRect(ctx, bx, modeY, halfIw, modeH, 6,
          active ? "#2a5a2a" : "#151f15",
          active ? "#5aaf5a" : "#2a3a2a");
        ctx.fillStyle    = active ? "#cfffcf" : "#4a7a4a";
        ctx.font         = "bold 10px sans-serif";
        ctx.textAlign    = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          mode === "preset" ? "⚡  Presets" : "✏️  Custom",
          bx + halfIw / 2, modeY + modeH / 2
        );
      });

      if (this._mode === "preset") {
        const preset = REAL_PRESETS.find(
          p => p.label === this._presetLabel && p.sub === this._presetSub
        ) ?? REAL_PRESETS[0];

        const btnH = 32;
        roundRect(ctx, pad, contentY, iw, btnH, 5, "#0d1a0d", "#3a6a3a");

        // Aspect ratio thumbnail — compact
        const aspect = preset.w / preset.h;
        let tw, th;
        if (aspect >= 1) { tw = 20; th = Math.max(4, Math.round(20 / aspect)); }
        else             { th = 20; tw = Math.max(4, Math.round(20 * aspect)); }
        const tx = pad + 8;
        const ty = contentY + (btnH - th) / 2;
        roundRect(ctx, tx, ty, tw, th, 1, "#2a5a2a", "#5aaf5a", 0.8);

        // Resolution label + latent inline on same row
        const lw = Math.floor(preset.w / 32);
        const lh = Math.floor(preset.h / 32);
        const lf = Math.floor((this._length - 1) / 8) + 1;
        ctx.textAlign    = "left";
        ctx.textBaseline = "middle";
        ctx.fillStyle    = "#e0e0e0";
        ctx.font         = "bold 11px sans-serif";
        ctx.fillText(preset.label, tx + tw + 8, contentY + btnH / 2 - 7);
        ctx.fillStyle = "#3a6a3a";
        ctx.font      = "9px monospace";
        ctx.fillText(`${lf}f · ${lw}×${lh}`, tx + tw + 8, contentY + btnH / 2 + 7);

        ctx.fillStyle = "#4a7a4a";
        ctx.font      = "11px sans-serif";
        ctx.textAlign = "right";
        ctx.fillText("▼", pad + iw - 8, contentY + btnH / 2);

        this._presetBtnBounds = { x: pad, y: contentY, w: iw, h: btnH };

      } else {
        this._presetBtnBounds = null;

        const rowH  = 26;
        const gap   = 10;
        const wRowY = contentY;
        const hRowY = contentY + rowH + gap;

        this._drawDimRow(ctx, "WIDTH",  this._customWidth,  pad, wRowY, iw, rowH);
        this._drawDimRow(ctx, "HEIGHT", this._customHeight, pad, hRowY, iw, rowH);

        const lw = Math.floor(this._customWidth  / 32);
        const lh = Math.floor(this._customHeight / 32);
        const lf = Math.floor((this._length - 1) / 8) + 1;
        ctx.fillStyle    = "#3a6a3a";
        ctx.font         = "9px monospace";
        ctx.textAlign    = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${lf}f · ${lw}×${lh}`, W / 2, hRowY + rowH + 10);

        this._dimRows = {
          w: { x: pad, y: wRowY, h: rowH },
          h: { x: pad, y: hRowY, h: rowH },
        };
      }

      ctx.restore();
    };

    nodeType.prototype._drawDimRow = function (ctx, labelText, value, x, y, iw, rowH) {
      const btnW  = 24;
      const valW  = iw - btnW * 2 - 6;
      const valX  = x + btnW + 3;
      const btnRX = valX + valW + 3;
      const midY  = y + rowH / 2;

      ctx.fillStyle    = "#4a8a4a";
      ctx.font         = "bold 9px sans-serif";
      ctx.textAlign    = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(labelText, x, y - 6);

      roundRect(ctx, x, y, btnW, rowH, 4, "#151f15", "#2a4a2a");
      ctx.fillStyle    = "#7acc7a";
      ctx.font         = "bold 14px sans-serif";
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("−", x + btnW / 2, midY);

      roundRect(ctx, valX, y, valW, rowH, 4, "#0d1a0d", "#2a4a2a");
      ctx.fillStyle    = "#e8e8e8";
      ctx.font         = "bold 12px monospace";
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(value), valX + valW / 2, midY);

      roundRect(ctx, btnRX, y, btnW, rowH, 4, "#151f15", "#2a4a2a");
      ctx.fillStyle    = "#7acc7a";
      ctx.font         = "bold 14px sans-serif";
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("+", btnRX + btnW / 2, midY);
    };

    nodeType.prototype.onMouseDown = function (event, pos) {
      const [mx, my] = pos;
      const { pad, iw, modeY, modeH, halfIw, contentY } = this._layout();
      const hit = (x, y, w, h) => mx >= x && mx <= x + w && my >= y && my <= y + h;

      // Mode tabs
      if (hit(pad, modeY, halfIw, modeH)) {
        this._mode = "preset"; this.setDirtyCanvas(true); return true;
      }
      if (hit(pad + halfIw + 8, modeY, halfIw, modeH)) {
        this._mode = "custom"; this.setDirtyCanvas(true); return true;
      }

      // Preset button
      if (this._mode === "preset" && this._presetBtnBounds) {
        const b = this._presetBtnBounds;
        if (hit(b.x, b.y, b.w, b.h)) {
          showPresetDialog(this._presetLabel, p => {
            this._presetLabel = p.label;
            this._presetSub   = p.sub;
            this.setDirtyCanvas(true);
          });
          return true;
        }
      }

      // Custom rows
      if (this._mode === "custom" && this._dimRows) {
        const btnW  = 24;
        const valW  = iw - btnW * 2 - 6;
        const valX  = pad + btnW + 3;
        const btnRX = valX + valW + 3;

        for (const [dim, row] of Object.entries(this._dimRows)) {
          const { x, y, h } = row;
          const isW = dim === "w";
          const cur = isW ? this._customWidth : this._customHeight;

          if (hit(x, y, btnW, h)) {
            const next = Math.max(64, cur - 32);
            if (isW) this._customWidth = next; else this._customHeight = next;
            this.setDirtyCanvas(true); return true;
          }
          if (hit(valX, y, valW, h)) {
            const v = prompt(
              `Enter ${isW ? "width" : "height"} (px, snapped to multiples of 32):`,
              String(cur)
            );
            if (v !== null) {
              const n = Math.round(parseInt(v) / 32) * 32;
              if (!isNaN(n) && n >= 64 && n <= 8192) {
                if (isW) this._customWidth = n; else this._customHeight = n;
              }
            }
            this.setDirtyCanvas(true); return true;
          }
          if (hit(btnRX, y, btnW, h)) {
            const next = Math.min(8192, cur + 32);
            if (isW) this._customWidth = next; else this._customHeight = next;
            this.setDirtyCanvas(true); return true;
          }
        }
      }

      return false;
    };

    nodeType.prototype.computeSize = function () {
      return [310, this._mode === "custom" ? 155 : 130];
    };
  },
});
import { app } from "../../scripts/app.js";

const NODE_TYPE  = "WinnouganResolutionPicker";

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


const NODE_TITLE = "Winnougan Resolution Picker";

const PRESETS = [

  // ── Square ────────────────────────────────────────────────────────────────
  { label: "── Square ──", separator: true },
  { label: "512 × 512",    sub: "Square SD 1.5",          w: 512,  h: 512  },
  { label: "768 × 768",    sub: "Square SD 2.0",          w: 768,  h: 768  },
  { label: "1024 × 1024",  sub: "Square HD",              w: 1024, h: 1024 },
  { label: "1280 × 1280",  sub: "Square 1.3K",            w: 1280, h: 1280 },
  { label: "1536 × 1536",  sub: "Square 1.5K",            w: 1536, h: 1536 },
  { label: "2048 × 2048",  sub: "Square 2K",              w: 2048, h: 2048 },
  { label: "3072 × 3072",  sub: "Square 3K",              w: 3072, h: 3072 },
  { label: "4096 × 4096",  sub: "Square 4K",              w: 4096, h: 4096 },

  // ── Portrait ──────────────────────────────────────────────────────────────
  { label: "── Portrait ──", separator: true },
  { label: "512 × 768",    sub: "Portrait 2:3 SD",        w: 512,  h: 768  },
  { label: "512 × 912",    sub: "Portrait 9:16 SD",       w: 512,  h: 912  },
  { label: "640 × 960",    sub: "Portrait 2:3",           w: 640,  h: 960  },
  { label: "768 × 1024",   sub: "Portrait 3:4",           w: 768,  h: 1024 },
  { label: "768 × 1152",   sub: "Portrait 2:3 HD",        w: 768,  h: 1152 },
  { label: "832 × 1152",   sub: "Portrait Flux Native",   w: 832,  h: 1152 },
  { label: "832 × 1216",   sub: "Portrait SDXL",          w: 832,  h: 1216 },
  { label: "896 × 1152",   sub: "Portrait Alt",           w: 896,  h: 1152 },
  { label: "896 × 1344",   sub: "Portrait 2:3 SDXL",      w: 896,  h: 1344 },
  { label: "1024 × 1280",  sub: "Portrait 4:5",           w: 1024, h: 1280 },
  { label: "1024 × 1536",  sub: "Portrait 2:3 HD",        w: 1024, h: 1536 },
  { label: "1080 × 1350",  sub: "Instagram Portrait",     w: 1080, h: 1350 },
  { label: "1080 × 1920",  sub: "Portrait 9:16 Full HD",  w: 1080, h: 1920 },
  { label: "1152 × 1728",  sub: "Portrait 2:3 Flux",      w: 1152, h: 1728 },
  { label: "1440 × 2560",  sub: "Portrait 9:16 2K",       w: 1440, h: 2560 },
  { label: "1536 × 2048",  sub: "Portrait 3:4 2K",        w: 1536, h: 2048 },
  { label: "2160 × 3840",  sub: "Portrait 9:16 4K",       w: 2160, h: 3840 },

  // ── Landscape ─────────────────────────────────────────────────────────────
  { label: "── Landscape ──", separator: true },
  { label: "768 × 512",    sub: "Landscape 3:2 SD",       w: 768,  h: 512  },
  { label: "912 × 512",    sub: "Landscape 16:9 SD",      w: 912,  h: 512  },
  { label: "960 × 640",    sub: "Landscape 3:2",          w: 960,  h: 640  },
  { label: "1024 × 768",   sub: "Landscape 4:3",          w: 1024, h: 768  },
  { label: "1152 × 768",   sub: "Landscape 3:2 HD",       w: 1152, h: 768  },
  { label: "1152 × 832",   sub: "Landscape Flux Native",  w: 1152, h: 832  },
  { label: "1152 × 896",   sub: "Landscape Alt",          w: 1152, h: 896  },
  { label: "1216 × 832",   sub: "Landscape SDXL",         w: 1216, h: 832  },
  { label: "1280 × 720",   sub: "HD 720p",                w: 1280, h: 720  },
  { label: "1280 × 960",   sub: "Landscape 4:3 HD",       w: 1280, h: 960  },
  { label: "1280 × 1024",  sub: "Landscape 5:4",          w: 1280, h: 1024 },
  { label: "1344 × 768",   sub: "Landscape 16:9 Flux",    w: 1344, h: 768  },
  { label: "1344 × 896",   sub: "Landscape 3:2 SDXL",     w: 1344, h: 896  },
  { label: "1536 × 1024",  sub: "Landscape 3:2 2K",       w: 1536, h: 1024 },
  { label: "1920 × 1080",  sub: "Full HD 16:9",           w: 1920, h: 1080 },
  { label: "2048 × 1152",  sub: "2K 16:9",                w: 2048, h: 1152 },
  { label: "2560 × 1440",  sub: "2K QHD 16:9",            w: 2560, h: 1440 },
  { label: "3840 × 2160",  sub: "4K UHD 16:9",            w: 3840, h: 2160 },

  // ── Cinematic ─────────────────────────────────────────────────────────────
  { label: "── Cinematic ──", separator: true },
  { label: "1280 × 544",   sub: "Cinematic 2.35:1 720p",  w: 1280, h: 544  },
  { label: "1920 × 816",   sub: "Cinematic 2.35:1 1080p", w: 1920, h: 816  },
  { label: "1920 × 832",   sub: "Cinematic 2.30:1",       w: 1920, h: 832  },
  { label: "2048 × 858",   sub: "Cinematic 2.39:1 2K",    w: 2048, h: 858  },
  { label: "2560 × 1080",  sub: "Ultra-wide 21:9",        w: 2560, h: 1080 },
  { label: "3440 × 1440",  sub: "Ultra-wide QHD 21:9",    w: 3440, h: 1440 },
  { label: "4096 × 1716",  sub: "Cinematic 4K DCI",       w: 4096, h: 1716 },

  // ── Flux 2 ────────────────────────────────────────────────────────────────
  { label: "── Flux 2 ──", separator: true },
  { label: "768 × 768",    sub: "Flux 2 Square Fast",     w: 768,  h: 768  },
  { label: "1024 × 1024",  sub: "Flux 2 Square Native",   w: 1024, h: 1024 },
  { label: "832 × 1152",   sub: "Flux 2 Portrait",        w: 832,  h: 1152 },
  { label: "1152 × 832",   sub: "Flux 2 Landscape",       w: 1152, h: 832  },
  { label: "1024 × 1536",  sub: "Flux 2 Portrait Tall",   w: 1024, h: 1536 },
  { label: "1536 × 1024",  sub: "Flux 2 Landscape Wide",  w: 1536, h: 1024 },
  { label: "1344 × 768",   sub: "Flux 2 Widescreen",      w: 1344, h: 768  },
  { label: "768 × 1344",   sub: "Flux 2 Tall",            w: 768,  h: 1344 },
  { label: "1920 × 1080",  sub: "Flux 2 Full HD",         w: 1920, h: 1080 },
  { label: "1080 × 1920",  sub: "Flux 2 Full HD Portrait",w: 1080, h: 1920 },

  // ── Z-Image Turbo ─────────────────────────────────────────────────────────
  { label: "── Z-Image Turbo ──", separator: true },
  { label: "512 × 512",    sub: "Z-Turbo Square Fast",    w: 512,  h: 512  },
  { label: "768 × 768",    sub: "Z-Turbo Square HD",      w: 768,  h: 768  },
  { label: "1024 × 1024",  sub: "Z-Turbo Square Native",  w: 1024, h: 1024 },
  { label: "512 × 768",    sub: "Z-Turbo Portrait",       w: 512,  h: 768  },
  { label: "512 × 912",    sub: "Z-Turbo Portrait Tall",  w: 512,  h: 912  },
  { label: "768 × 1024",   sub: "Z-Turbo Portrait HD",    w: 768,  h: 1024 },
  { label: "768 × 512",    sub: "Z-Turbo Landscape",      w: 768,  h: 512  },
  { label: "912 × 512",    sub: "Z-Turbo Landscape Wide", w: 912,  h: 512  },
  { label: "1024 × 768",   sub: "Z-Turbo Landscape HD",   w: 1024, h: 768  },
  { label: "1280 × 720",   sub: "Z-Turbo 720p",           w: 1280, h: 720  },
  { label: "1920 × 1080",  sub: "Z-Turbo Full HD",        w: 1920, h: 1080 },
];

const REAL_PRESETS = PRESETS.filter(p => !p.separator);

// ── Preset picker dialog ──────────────────────────────────────────────────────

function showPresetDialog(currentLabel, onSelect) {
  const existing = document.getElementById("winnougan-res-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "winnougan-res-overlay";
  Object.assign(overlay.style, {
    position: "fixed", inset: "0", zIndex: "9999",
    background: "rgba(0,0,0,0.55)",
    display: "flex", alignItems: "center", justifyContent: "center",
  });

  const dialog = document.createElement("div");
  Object.assign(dialog.style, {
    background: "#141f14", border: "1px solid #3a6a3a",
    borderRadius: "10px", padding: "16px",
    width: "460px", maxWidth: "92vw",
    display: "flex", flexDirection: "column", gap: "10px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
  });

  const titleEl = document.createElement("div");
  titleEl.textContent = "Choose Resolution Preset";
  Object.assign(titleEl.style, {
    color: "#9effa0", fontSize: "11px", fontWeight: "bold",
    textTransform: "uppercase", letterSpacing: "0.1em",
  });

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Filter… (e.g. '1080' or 'portrait')";
  Object.assign(input.style, {
    background: "#0d160d", border: "1px solid #3a6a3a", borderRadius: "6px",
    color: "#eee", fontSize: "13px", padding: "8px 12px",
    outline: "none", width: "100%", boxSizing: "border-box",
  });

  const list = document.createElement("div");
  Object.assign(list.style, {
    maxHeight: "400px", overflowY: "auto",
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
    return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  function hilite(text, q) {
    if (!q) return `<span style="color:#ccc">${esc(text)}</span>`;
    const i = text.toLowerCase().indexOf(q);
    if (i < 0) return `<span style="color:#ccc">${esc(text)}</span>`;
    return `<span style="color:#ccc">${esc(text.slice(0,i))}<span style="color:#7dffb3;font-weight:bold">${esc(text.slice(i,i+q.length))}</span>${esc(text.slice(i+q.length))}</span>`;
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

      const isCurrent = preset.label === currentLabel;
      const row = document.createElement("div");
      Object.assign(row.style, {
        display: "flex", alignItems: "center",
        padding: "9px 14px", cursor: "pointer",
        borderBottom: "1px solid #111",
        background: isCurrent ? "#1e3a1e" : "transparent",
        gap: "10px",
      });

      const thumbWrap = document.createElement("div");
      Object.assign(thumbWrap.style, {
        width: "28px", height: "28px",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: "0",
      });
      const aspect = preset.w / preset.h;
      let tw, th;
      if (aspect >= 1) { tw = 26; th = Math.max(4, Math.round(26 / aspect)); }
      else             { th = 26; tw = Math.max(4, Math.round(26 * aspect)); }
      const thumb = document.createElement("div");
      Object.assign(thumb.style, {
        width: tw + "px", height: th + "px",
        background: isCurrent ? "#3a7a3a" : "#1e3a1e",
        border: `1px solid ${isCurrent ? "#7adf7a" : "#3a6a3a"}`,
        borderRadius: "1px",
      });
      thumbWrap.appendChild(thumb);

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
      const cur = visibleItems.findIndex(v => v.preset.label === currentLabel);
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
  name: "Winnougan.ResolutionPicker",

  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== NODE_TYPE) return;

    const orig = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      orig?.call(this);

      // ── Hide widgets visually but keep them alive so ComfyUI can
      //    serialize their values to the Python backend.
      //    Wiping this.widgets = [] breaks serialization entirely.
      setTimeout(() => {
        if (this.widgets?.length) {
          this.widgets.forEach(w => {
            w.type         = "hidden";
            w.hidden       = true;
            w.computeSize  = () => [0, -4]; // collapse row height to zero
          });
          this.setSize(this.computeSize());
          this.setDirtyCanvas(true, true);
        }
      }, 0);

      this.color   = "#1a2a1a";
      this.bgcolor = "#0f2a0f";
      this._sparkles = new SparkleSystem(14);
      this.title   = "👉👈 Winnougan Resolution Picker";

      this._mode         = "preset";
      this._presetLabel  = "1024 × 1024";
      this._customWidth  = 1024;
      this._customHeight = 1024;
      this._batchSize    = 1;

      // Add explicit input slots for subgraph wiring
      // These allow external connections while widgets handle the UI
      if (!this.inputs?.find(i => i.name === "width")) {
        this.addInput("width",  "INT");
      }
      if (!this.inputs?.find(i => i.name === "height")) {
        this.addInput("height", "INT");
      }

      this.size = [310, 160];
    };

    // ── Sync widget values and serialize ─────────────────────────────────
    // We must keep the underlying widgets' .value in sync so that
    // ComfyUI's prompt builder picks up the correct w/h/batch_size.
    nodeType.prototype._syncWidgetValues = function () {
      const { w, h } = this._resolvedDims();

      const isConnected = (name) => {
        const slot = this.inputs?.find(inp => inp.name === name);
        return slot && slot.link !== null && slot.link !== undefined;
      };

      const widgetW = this.widgets?.find(ww => ww.name === "width");
      const widgetH = this.widgets?.find(ww => ww.name === "height");
      const widgetB = this.widgets?.find(ww => ww.name === "batch_size");

      // Always sync widget values — this is what Python reads
      if (widgetW) widgetW.value = w;
      if (widgetH) widgetH.value = h;
      if (widgetB) widgetB.value = this._batchSize;
    };

    nodeType.prototype.onSerialize = function (o) {
      this._syncWidgetValues();
      const { w, h } = this._resolvedDims();
      o.widgets_values = [w, h, this._batchSize];
      // Store UI state for round-trip restore
      o.winnougan_res = {
        mode:         this._mode,
        presetLabel:  this._presetLabel,
        customWidth:  this._customWidth,
        customHeight: this._customHeight,
        batchSize:    this._batchSize,
      };
    };

    nodeType.prototype.onConfigure = function (o) {
      // Re-hide widgets after loading a saved graph
      if (this.widgets?.length) {
        this.widgets.forEach(w => {
          w.type        = "hidden";
          w.hidden      = true;
          w.computeSize = () => [0, -4];
        });
      }
      if (o.winnougan_res) {
        const r = o.winnougan_res;
        this._mode         = r.mode         ?? "preset";
        this._presetLabel  = r.presetLabel  ?? "1024 × 1024";
        this._customWidth  = r.customWidth  ?? 1024;
        this._customHeight = r.customHeight ?? 1024;
        this._batchSize    = r.batchSize    ?? 1;
      }
      this._syncWidgetValues();
      this.setDirtyCanvas(true);
    };

    nodeType.prototype._resolvedDims = function () {
      if (this._mode === "preset") {
        const preset = REAL_PRESETS.find(p => p.label === this._presetLabel) ?? REAL_PRESETS[0];
        return { w: preset.w, h: preset.h };
      }
      return { w: this._customWidth, h: this._customHeight };
    };

    // ── Layout ────────────────────────────────────────────────────────────
    nodeType.prototype._layout = function () {
      const TH  = LiteGraph.NODE_TITLE_HEIGHT;
      const W   = this.size[0];
      const pad = 14;
      const iw  = W - pad * 2;

      const modeY    = TH + 26;
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
        // ── Preset button ──────────────────────────────────────────────
        const preset = REAL_PRESETS.find(p => p.label === this._presetLabel) ?? REAL_PRESETS[0];
        const btnH   = 32;

        roundRect(ctx, pad, contentY, iw, btnH, 5, "#0d1a0d", "#3a6a3a");

        // Aspect ratio thumbnail — compact
        const aspect = preset.w / preset.h;
        let tw, th;
        if (aspect >= 1) { tw = 20; th = Math.max(4, Math.round(20 / aspect)); }
        else             { th = 20; tw = Math.max(4, Math.round(20 * aspect)); }
        const tx = pad + 8;
        const ty = contentY + (btnH - th) / 2;
        roundRect(ctx, tx, ty, tw, th, 1, "#2a5a2a", "#5aaf5a", 0.8);

        // Resolution + latent inline
        ctx.textAlign    = "left";
        ctx.textBaseline = "middle";
        ctx.fillStyle    = "#e0e0e0";
        ctx.font         = "bold 11px sans-serif";
        ctx.fillText(preset.label, tx + tw + 8, contentY + btnH / 2 - 7);
        ctx.fillStyle = "#3a6a3a";
        ctx.font      = "9px monospace";
        ctx.fillText(`latent ${preset.w / 8}×${preset.h / 8}`, tx + tw + 8, contentY + btnH / 2 + 7);

        ctx.fillStyle = "#4a7a4a";
        ctx.font      = "11px sans-serif";
        ctx.textAlign = "right";
        ctx.fillText("▼", pad + iw - 8, contentY + btnH / 2);

        this._presetBtnBounds = { x: pad, y: contentY, w: iw, h: btnH };

      } else {
        // ── Custom rows ────────────────────────────────────────────────
        this._presetBtnBounds = null;

        const rowH  = 26;
        const gap   = 10;
        const wRowY = contentY;
        const hRowY = contentY + rowH + gap;

        this._drawDimRow(ctx, "WIDTH",  this._customWidth,  pad, wRowY, iw, rowH);
        this._drawDimRow(ctx, "HEIGHT", this._customHeight, pad, hRowY, iw, rowH);

        ctx.fillStyle    = "#3a6a3a";
        ctx.font         = "9px monospace";
        ctx.textAlign    = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          `latent ${Math.floor(this._customWidth / 8)}×${Math.floor(this._customHeight / 8)}`,
          W / 2, hRowY + rowH + 10
        );

        this._dimRows = {
          w: { x: pad, y: wRowY, h: rowH },
          h: { x: pad, y: hRowY, h: rowH },
        };
      }

      ctx.restore();
    };

    nodeType.prototype._drawDimRow = function (ctx, labelText, value, x, y, iw, rowH) {
      const btnW = 24;
      const valW = iw - btnW * 2 - 6;
      const valX = x + btnW + 3;
      const btnRX = valX + valW + 3;
      const midY = y + rowH / 2;

      // Label
      ctx.fillStyle    = "#4a8a4a";
      ctx.font         = "bold 10px sans-serif";
      ctx.textAlign    = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(labelText, x, y - 6);

      // Dec
      roundRect(ctx, x, y, btnW, rowH, 4, "#151f15", "#2a4a2a");
      ctx.fillStyle    = "#7acc7a";
      ctx.font         = "bold 14px sans-serif";
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("−", x + btnW / 2, midY);

      // Value box
      roundRect(ctx, valX, y, valW, rowH, 4, "#0d1a0d", "#2a4a2a");
      ctx.fillStyle    = "#e8e8e8";
      ctx.font         = "bold 12px monospace";
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(value), valX + valW / 2, midY);

      // Inc
      roundRect(ctx, btnRX, y, btnW, rowH, 4, "#151f15", "#2a4a2a");
      ctx.fillStyle    = "#7acc7a";
      ctx.font         = "bold 14px sans-serif";
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("+", btnRX + btnW / 2, midY);
    };

    // ── Mouse ─────────────────────────────────────────────────────────────
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
            this._syncWidgetValues();
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
            const next = Math.max(64, cur - 8);
            if (isW) this._customWidth = next; else this._customHeight = next;
            this._syncWidgetValues();
            this.setDirtyCanvas(true); return true;
          }
          if (hit(valX, y, valW, h)) {
            const v = prompt(`Enter ${isW ? "width" : "height"} (px, snapped to multiples of 8):`, String(cur));
            if (v !== null) {
              const n = Math.round(parseInt(v) / 8) * 8;
              if (!isNaN(n) && n >= 64 && n <= 8192) {
                if (isW) this._customWidth = n; else this._customHeight = n;
              }
            }
            this._syncWidgetValues();
            this.setDirtyCanvas(true); return true;
          }
          if (hit(btnRX, y, btnW, h)) {
            const next = Math.min(8192, cur + 8);
            if (isW) this._customWidth = next; else this._customHeight = next;
            this._syncWidgetValues();
            this.setDirtyCanvas(true); return true;
          }
        }
      }

      return false;
    };

    nodeType.prototype.computeSize = function () {
      return [310, this._mode === "custom" ? 165 : 140];
    };
  },
});

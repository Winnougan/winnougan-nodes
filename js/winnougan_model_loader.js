import { app } from "../../scripts/app.js";

const NODE_TYPE = "WinnouganModelLoader";

// ── Glow draw helper ──────────────────────────────────────────────────────────
// Draws a breathing glowing green border using canvas shadow blur + sine wave.
function drawGreenGlow(ctx, node) {
    if (node.flags?.collapsed) return;

    const w    = node.size[0];
    const h    = node.size[1] + LiteGraph.NODE_TITLE_HEIGHT;
    const yOff = -LiteGraph.NODE_TITLE_HEIGHT;
    const r    = 8;

    // Breathing: smooth sine wave, one full breath every ~3 seconds
    const t     = Date.now() / 1000;
    const pulse = 0.5 + 0.5 * Math.sin(t * (2 * Math.PI / 3)); // 0..1

    // Keep canvas redrawing so the animation runs continuously
    app.graph.setDirtyCanvas(true, false);

    ctx.save();

    // Outer bloom — breathes between dim and bright
    ctx.shadowColor  = "#4ade80";
    ctx.shadowBlur   = 18 + pulse * 22;     // 18..40
    ctx.strokeStyle  = "#4ade80";
    ctx.lineWidth    = 2;
    ctx.globalAlpha  = 0.30 + pulse * 0.40; // 0.30..0.70
    ctx.beginPath();
    ctx.roundRect(0, yOff, w, h, r);
    ctx.stroke();

    // Inner rim — always visible, pulses more subtly
    ctx.shadowBlur   = 8 + pulse * 8;       // 8..16
    ctx.globalAlpha  = 0.55 + pulse * 0.35; // 0.55..0.90
    ctx.lineWidth    = 1.5;
    ctx.beginPath();
    ctx.roundRect(1, yOff + 1, w - 2, h - 2, r);
    ctx.stroke();

    ctx.restore();
}

// ── Model list filtering ──────────────────────────────────────────────────────
// The Python side puts std models first, then GGUF files (ending in .gguf).
// We cache the full list on first use and filter per loader_type selection.
function isGguf(name) {
    return name.toLowerCase().endsWith(".gguf");
}

// ── Extension ────────────────────────────────────────────────────────────────
app.registerExtension({
    name: "Winnougan.ModelLoader",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_TYPE) return;

        // ── Node created ──────────────────────────────────────────────────────
        const origOnNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            origOnNodeCreated?.call(this);

            this.color   = "#1a3a1a";
            this.bgcolor = "#0f2a0f";
            this.title   = "🌿 Winnougan Model Loader";

            // Cache the full combined model list from the combo widget
            const modelWidget      = this.widgets?.find(w => w.name === "model_name");
            const loaderTypeWidget = this.widgets?.find(w => w.name === "loader_type");

            if (modelWidget && loaderTypeWidget) {
                // Store the complete original list once
                if (!this._allModelNames) {
                    this._allModelNames = [...(modelWidget.options?.values ?? [])];
                }

                const applyFilter = (loaderType) => {
                    const all      = this._allModelNames;
                    const filtered = loaderType === "GGUF"
                        ? all.filter(isGguf)
                        : all.filter(m => !isGguf(m));

                    modelWidget.options.values = filtered.length ? filtered : all;

                    // Reset value if current selection is no longer valid
                    if (!filtered.includes(modelWidget.value)) {
                        modelWidget.value = filtered[0] ?? modelWidget.value;
                    }

                    app.graph.setDirtyCanvas(true);
                };

                // Apply filter immediately on load
                applyFilter(loaderTypeWidget.value);

                // Re-apply whenever loader_type changes
                const origCallback = loaderTypeWidget.callback;
                loaderTypeWidget.callback = (value) => {
                    applyFilter(value);
                    origCallback?.call(loaderTypeWidget, value);
                };
            }
        };

        // ── Glow: draw behind the node ────────────────────────────────────────
        const origOnDrawBackground = nodeType.prototype.onDrawBackground;
        nodeType.prototype.onDrawBackground = function (ctx) {
            origOnDrawBackground?.call(this, ctx);
            drawGreenGlow(ctx, this);
        };

        // ── Badge in top-right corner ─────────────────────────────────────────
        const origOnDrawForeground = nodeType.prototype.onDrawForeground;
        nodeType.prototype.onDrawForeground = function (ctx) {
            origOnDrawForeground?.call(this, ctx);
            if (this.flags?.collapsed) return;

            ctx.save();
            ctx.font      = "bold 10px sans-serif";
            ctx.textAlign = "right";
            ctx.fillStyle = "#4ade80";
            ctx.shadowColor = "#4ade80";
            ctx.shadowBlur  = 6;
            ctx.fillText("⚡ WINNOUGAN", this.size[0] - 8, 14);
            ctx.restore();
        };
    },
});

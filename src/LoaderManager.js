export class LoaderManager {
    constructor() {
        this.loader = document.getElementById("loader");
        this.card = document.querySelector(".loader-card");
        this.text = document.getElementById("loader-text");
        this.sub = document.getElementById("loader-subtext");
        this.progress = document.getElementById("loader-progress");
    }
    show(message = "Loading...") {
        this.text.textContent = message;
        this.sub.textContent = "";

        this.loader.style.display = "flex";
        requestAnimationFrame(() => {
            this.loader.style.opacity = "1";
            this.card.style.transform = "translateY(0)";
        })
    }

    hide() {
        this.loader.style.opacity = "0";
        this.card.style.transform = "translateY(20px)";

        setTimeout(() => {
            this.loader.style.display = "none";
        }, 450);
    }
    setMessage(msg) {
        this.text.textContent = msg;
        this.text.style.opacity = 0;
        setTimeout(() => {
            this.text.textContent = msg;
            this.text.style.opacity = 1;
        }, 150);
    }
    setSubmessage(msg) {
        this.sub.style.opacity = 0;
        setTimeout(() => {
            this.sub.textContent = msg;
            this.sub.style.opacity = 1;
        }, 50);
    }
    updateProgress(fraction, label) {
        const pct = Math.round(fraction * 100); // target width
        const currentWidth = parseFloat(this.progress.style.width) || 0;
        const targetWidth = pct;

        let start = null;
        const animate = timestamp => {
            if (!start) start = timestamp;
            const elapsed = timestamp - start;
            const speed = 0.004; // tweak for smoothness
            const newWidth = currentWidth + (targetWidth - currentWidth) * Math.min(elapsed * speed, 1);
            this.progress.style.width = `${newWidth}%`;
            if (newWidth < targetWidth) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);

        if (label) this.setSubmessage(label);
    }
    // For the layers 
    handleLayerProgress(loadedLayers, totalLayers, currentLayer, layerProgress, totalProgress) {
        const now = performance.now();

        if (!this._layerStartTimes) this._layerStartTimes = {};
        if (!this._layerStartTimes[currentLayer]) this._layerStartTimes[currentLayer] = now;

        const elapsed = now - this._layerStartTimes[currentLayer]; // ms

        const minPixelsForETA = 5; // small threshold to avoid 0s
        let etaSeconds = "...";
        if (layerProgress > 0 && loadedLayers >= minPixelsForETA) {
            const estTotal = elapsed / layerProgress; // estimated total time for this layer
            const remaining = estTotal - elapsed;
            //console.log(estTotal, remaining);
            etaSeconds = Math.max(0, Math.round(remaining / 1000));
        } 
        const percent = Math.round(layerProgress * 100);
        const message = `Preloading Layers (${loadedLayers} / ${totalLayers}) - Layer ${currentLayer} (${percent}%) - ETA: ${etaSeconds}${etaSeconds !== "..." ? "s" : ""}`;

        this.setSubmessage(message);
        this.updateProgress(totalProgress);
    }
    handleProgress(current, total, msg) {
        const fraction = current / total;
        const percent = Math.round(fraction * 100);
        const message = msg != null ? `${msg}: (${percent}%)` : `(${percent}%)`;
        this.setSubmessage(message);
        this.updateProgress(fraction);
    }
    async fadeLoaderShowScene(sceneEl) {
        this.hide(); // fade out loader

        if (sceneEl) {
            sceneEl.style.opacity = 0;
            sceneEl.style.transition = "opacity 0.6s ease";
            requestAnimationFrame(() => {
                sceneEl.style.opacity = 1;
            });
        }
    }
}
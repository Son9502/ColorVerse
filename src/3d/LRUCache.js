import { generateCanvas } from "./thread-texture.js";

/**
 * LRU (Least Recently Used) Cache
 * 
 * Options:
 *  - maxEntries: max number of cached textures
 *  - prefetchRange: how many layers before/after current to prefetch
 *  - workerPath: path to worker script
 */
export class LRUCache {
  constructor({ type = "cube", maxEntries = 180, prefetchRange = 2, workerPath = "./worker-texture.js" } = {}) {
    this.type = type;
    this.maxEntries = Number.isInteger(maxEntries) && maxEntries > 0 && maxEntries < 256 ? maxEntries : 180;
    this.prefetchRange = Number.isInteger(prefetchRange) && prefetchRange >= 0 ? prefetchRange : 2;
    this.workerPath = workerPath;

    // LRU Map: key -> { textures, textureData }
    this.cache = new Map();

    // Inflight requests: key -> Promise
    this.inflight = new Map();

    // Worker init
    this.worker = null;
    this._initWorker();
  }

  /** Initialize Worker if possible */
  _initWorker() {
    try {
      if (window.Worker && window.OffscreenCanvas && this.workerPath) {
        this.worker = new Worker(new URL(this.workerPath, import.meta.url), { type: "module" });
        this.worker.onmessage = (ev) => this._handleWorkerMessage(ev.data);
        this._workerRequests = new Map(); // id -> { resolve, reject }
        this._workerNextId = 1;
        //console.log(this.worker);
      }
    } catch (error) {
      console.warn('Worker init failed, falling back to main-thread generation', error);
      this.worker = null;
    }
  }

  /** Build cache key */
  _key(colorSpace, layer) {
    return `${colorSpace}-${layer}`;
  }

  /** Mark as recently used */
  _touch(key) {
    if (!this.cache.has(key)) return;
    const entry = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, entry);
  }

  /** Evict oldest textures if over limit */
  _evict() {
    while (this.cache.size > this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      const entry = this.cache.get(oldestKey);

      // Dispose WebGL textures
      entry?.textures?.forEach(tex => tex.dispose());
      this.cache.delete(oldestKey);
      console.debug(`Evicted cache key: ${oldestKey}`);
    }
  }
  _loadLayer(layer, onPixelProgress) {
    return Promise.all(["RGB", "HSL"].map(colorSpace =>
      this.get(colorSpace, layer, onPixelProgress)
        .catch(err => {
          console.warn(`${colorSpace}-${layer} preload error:`, err);
          return null;
        })
    ));
  }

  /**
 * Reorder layers for progressive extremes-first loading
 * Always starts with 127, then alternates min/max inward
 */
  extremesFirst(layers) {
    const min = 0;
    const max = 127;
    const sorted = [...layers].filter(l => l >= min && l <= max).sort((a, b) => a - b);

    const result = [];
    const used = new Set();

    if (sorted.includes(max)) { result.push(max); used.add(max); }

    let left = 0, right = sorted.length - 1;

    while (used.size < sorted.length) {
      while (left <= right && used.has(sorted[left])) left++;
      if (left <= right) { result.push(sorted[left]); used.add(sorted[left]); }

      while (left <= right && used.has(sorted[right])) right--;
      if (left <= right) { result.push(sorted[right]); used.add(sorted[right]); }
    }

    return result;
  }
  async preloadLayers(layers = [0, 1, 2, 10, 32, 50, 64, 96, 100, 127, 126, 125], batchSize = 3, onProgress) {

    const orderedLayers = this.extremesFirst(layers);
    const totalLayers = layers.length;

    const layerPixelCounts = {};
    let totalPixels = 0;
    //console.log("Preloading layers:", orderedLayers);
    for (const layer of layers) {
      const size = 256 - (2 * layer);
      switch (this.type) {
        case "cube":
          totalPixels += 6 * size * size;
          layerPixelCounts[layer] = 6 * size * size;
          break;
        case "sphere":
          totalPixels += size * size;
          layerPixelCounts[layer] = size * size;
          break;
      }
    }

    let loadedPixels = 0;
    let loadedLayers = 0;

    for (let i = 0; i < orderedLayers.length; i += batchSize) {
      const batch = orderedLayers.slice(i, i + batchSize);

      const batchPromise = () => Promise.all(
        batch.map(layer => {
          const layerPixels = layerPixelCounts[layer];
          return this._loadLayer(layer, (loaded, total, __layer, layerProgress) => {
            const currentPixels = loaded * (layerPixels / total);
            const totalProgress = (loadedPixels + currentPixels) / totalPixels;
            onProgress?.(
              loadedLayers, // loadedLayers
              totalLayers,
              layer,
              layerProgress,
              totalProgress
            );
          }).then(() => {
            loadedPixels += layerPixels;
            loadedLayers++;
          });
        })
      );
      // Use requestIdleCallback if available to avoid blocking UI
      if (typeof requestIdleCallback !== 'undefined') {
        await new Promise(res => requestIdleCallback(() => batchPromise().then(res)));
      } else {
        await batchPromise();
      }
    }
  }

  /** Handle messages from the worker */
  async _handleWorkerMessage(message) {
    const { id, type, loaded, total, imageBitmaps, textureData, error, layer } = message;
    const request = this._workerRequests.get(id);
    if (!request) return console.warn("Worker sent message with unknown id", id);

    const { resolve, reject, key, onProgress } = request;

    //console.log(message);
    switch (type) {
      case "progress":
        onProgress?.(loaded, total, layer, loaded / total);
        break;
      case "completed":
        try {
          if (!Array.isArray(imageBitmaps)) {
            return reject(new Error("imageBitmaps is not an array"));
          }
          const textures = imageBitmaps.filter(ib => ib).map(ib => {
            const canvas = document.createElement('canvas');
            canvas.width = ib.width;
            canvas.height = ib.height;

            canvas.getContext('2d').drawImage(ib, 0, 0);

            const tex = new THREE.CanvasTexture(canvas);
            tex.userData = {};

            const orig = document.createElement('canvas');
            orig.width = canvas.width; orig.height = canvas.height;
            orig.getContext('2d', { willReadFrequently: true }).drawImage(canvas, 0, 0);
            // console.log(tex);
            tex.userData.originalCanvas = orig;

            try { ib.close?.(); } catch { }
            return tex;
          });
          const result = { textures, textureData };
          this.cache.set(key, result);

          this._touch(key);
          this._evict();
          resolve(result);
        } catch (err) { reject(err); }
        finally {
          this._workerRequests.delete(id);
        }
        break;
      case "error":
        reject(new Error(error));
        this._workerRequests.delete(id);
        break;

      default:
        console.warn("Unknown message type from worker:", type);
    }
  }

  /** Normalize payload values so nothing non-cloneable is posted to worker */
  _normalizePayload(colorSpace, layer) {
    const cs = String(colorSpace ?? '').toUpperCase();
    // If layer is an object (accidentally) try to pull numeric value,
    // otherwise coerce to Number and clamp to allowed range.
    let n = Number.isFinite(layer) ? Number(layer) : Number(((layer && layer.value) || layer));
    if (!Number.isFinite(n)) n = 0;
    n = Math.max(0, Math.min(127, Math.floor(n)));
    return { colorSpace: cs, layer: n };
  }

  /** Generate textures using the worker (worker-safe) */
  _generateWorker(colorSpace, layer, key, onProgress) {

    if (!this.worker) return Promise.reject(new Error('No worker available'));

    const { colorSpace: cs, layer: normalizedLayer } = this._normalizePayload(colorSpace, layer);

    const type = this.type;
    const safeKey = String(key); // ensure key is plain string

    return new Promise((resolve, reject) => {
      const id = this._workerNextId++;

      // Store only main-thread things in the map (resolve/reject are functions - ok on main thread)
      this._workerRequests.set(id, { resolve, reject, key: safeKey, onProgress });

      // Build a payload that contains only cloneable primitives
      const payload = {
        id,
        colorSpace: cs,
        layer: normalizedLayer,
        type
      };

      try {
        // Post the clean payload. Never include objects with methods/DOM/THREE objects here.
        this.worker.postMessage(payload);
        //console.log(payload);
        //console.log("Able to send message");
      } catch (err) {
        // Clean up and forward error to caller
        this._workerRequests.delete(id);
        reject(new Error(`Worker postMessage failed for ${key}: ${err?.message || err}`));
      }
    });
  }


  /** Generate textures on main thread as fallback */
  async _generateMainThread(colorSpace, layer, key, onProgress) {
    let canvases, textureData;
    const size = 256 - layer * 2;
    let processed = 0;
    let total = 0;
    switch (this.type){
      case "cube":
        total = size * size * 6; 
        break;
      case "sphere":
        total = size * size; 
        break; 
    }
    const sendProgress = () => {
      processed++;
      onProgress?.({
        loaded: processed,
        total: total,
        current: layer,
        progress: processed / total
      });
    };
    switch (this.type) {
      case "cube":
        total = size * size * 6;
        break;
      case "sphere":
        total = size * size;
        break;
    }
    ({ canvases, textureData } = generateCanvas(layer, colorSpace, this.type, sendProgress));
    
    const textures = canvases.map(canvas => {
      const tex = new THREE.CanvasTexture(canvas);
      tex.userData = tex.userData || {};

      const orig = document.createElement('canvas');
      orig.width = canvas.width;
      orig.height = canvas.height;
      orig.getContext('2d', { willReadFrequently: true }).drawImage(canvas, 0, 0);
      tex.userData.originalCanvas = orig;

      // console.log(tex);
      return tex;
    });

    const entry = { textures, textureData };
    this.cache.set(key, entry);
    this._touch(key);
    this._evict();
    return entry;
  }

  /** Public API: get textures */
  async get(colorSpace, layer, onProgress) {
    colorSpace = String(colorSpace).toUpperCase();
    const key = this._key(colorSpace, layer);
    // console.log(key);
    if (this.cache.has(key)) {
      this._touch(key);
      console.debug(`Cache hit: ${key}`);
      return this.cache.get(key);
    }
    if (this.inflight.has(key)) return this.inflight.get(key);
    const genPromise = (async () => {
      try {
        return this.worker
          ? await this._generateWorker(colorSpace, layer, key, onProgress)
          : await this._generateMainThread(colorSpace, layer, key, onProgress);
      } finally {
        this.inflight.delete(key);
      }
    })();

    this.inflight.set(key, genPromise);

    genPromise.then(() => this._prefetch(colorSpace, layer)).catch((err) => { console.warn(`Prefetch failed for ${key}:`, err) });
    return genPromise;
  }

  /** Prefetch layers before/after current */
  _prefetch(colorSpace, layer) {
    colorSpace = String(colorSpace).toUpperCase();
    for (let d = 1; d <= this.prefetchRange; d++) {
      [layer + d, layer - d].forEach(l => {
        if (l < 0 || l > 127) return;
        const key = this._key(colorSpace, l);
        if (this.cache.has(key) || this.inflight.has(key)) return;
        this.get(colorSpace, l).catch(() => { });
      });
    }
  }
}

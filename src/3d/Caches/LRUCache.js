export class LRULayerCache {
    /**
     * Base class for LRU (Least Recently Used) layer cache.
     * @param {number} maxEntries - Maximum number of entries in the cache.
     * @param {string} type - Type of textures being cached (e.g., "cube", "sphere").
     * @param {number} minLayer - Minimum layer index.
     * @param {number} maxLayer - Maximum layer index.
     * @param {number} faceCount - Number of faces (e.g., 6 for cube).
     */
    constructor(type = "cube", maxEntries = 180, minLayer = 0, maxLayer = 127) {
        this.maxEntries = maxEntries;
        this.type = type;
        switch (type) {
            case "cube":
                this.faceCount = 6;
                break;
            case "sphere":
                this.faceCount = 1;
                break;
            default:
                this.faceCount = 1;
        }
        this.minLayer = minLayer;
        this.maxLayer = maxLayer;
        this.cache = new Map();
    }
    _touch(key) {
        if (!this.cache.has(key)) return;
        const entry = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, entry);
    }
    _evict() {
        while (this.cache.size > this.maxEntries) {
            const oldestKey = this.cache.keys().next().value;
            const tex = this.cache.get(oldestKey);
            tex.dispose?.();
            this.cache.delete(oldestKey);
        }
    }
    _key(...keys) {
        return keys.join("-");
    }
    clear() {
        this.cache.forEach((tex) => {
            tex.dispose?.();
        });
        this.cache.clear();
    }
    has(key) {
        return this.cache.has(key);
    }
    get(...keys) {
        const key = this._key(...keys);
        if (!this.cache.has(key)) return null;
        this._touch(key);
        return this.cache.get(key);
    }
    set(...args) {
        const texture = args.pop();
        const key = this._key(...args);
        this.cache.set(key, texture);
        this._touch(key);
        this._evict();
        return texture;
        
    }
}
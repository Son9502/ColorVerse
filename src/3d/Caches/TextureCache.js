import { LRULayerCache } from './LRUCache.js';
import { WorkerCache } from './WorkerCache.js';
import { THREE } from "../../three-setup.js";
export class TextureCache extends LRULayerCache {
    /**
     * Texture Cache for 3D object textures.
     * LRU eviction policy.
     * key = (colorSpace, layer)
     * value = Three.js Texture
     * Uses LRU eviction policy.
     * @param {string} type - Type of 3D object (e.g., "cube", "sphere").
     * @param {number} maxEntries - Maximum number of entries in the cache.
     * @param {number} minLayer - Minimum layer index.
     * @param {number} maxLayer - Maximum layer index.
     * @param {number[]} defaultLayers - Default layers to prefetch.
     */
    constructor(type = "cube", maxEntries = 256, minLayer = 0, maxLayer = 127, defaultLayers = [0, 1, 2, 10, 32, 50, 64, 96, 100, 117, 125, 126, 127]) {
        super(type, maxEntries, minLayer, maxLayer);
        this.defaultLayers = defaultLayers;
        this.workerCache = new WorkerCache({ type, maxEntries, minLayer, maxLayer, defaultLayers });
        this.pending = new Map();
        this.colorSpaces = ["RGB", "HSL"];
    }
    /**
     * Load default layers on init.
    */
    async makeTexture(buffer) {
        if (!buffer || !buffer.data || buffer.data.length === 0) throw new Error("Invalid buffer data for texture creation");

        const { data, width, height } = buffer;

        const pixels = new Uint8ClampedArray(data);
        //console.log("Creating texture with size:", width, height, pixels);

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const imageData = new ImageData(pixels, width, height);
        ctx.putImageData(imageData, 0, 0);

        const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
        //const texture = new THREE.CanvasTexture(canvas);
        // Raw sRGB bytes: layerFade.frag converts to linear itself (see three-setup.js)
        texture.flipY = false;
        texture.needsUpdate = true;

        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = true;

        texture.userData = { canvas };

        return texture;
    }
    async getOrCreate(colorSpace, layer, onProgress) {
        let entry = this.get(layer);
        if (!entry) {
            entry = { layer, textures: {} };
            this.set(layer, entry);
        }
        if (entry.textures[colorSpace]) return entry;
        // Load from worker cache
        const pendingKey = `${layer}`;
        if (this.pending.has(pendingKey)) {
            await this.pending.get(pendingKey);
            return this.get(layer);
        }
        const promise = (async () => {
            const buffer = await this.workerCache.getOrCreate(colorSpace, layer, onProgress)

            if (!buffer) return null;

            const textures = [];

            for (let i = 0; i < this.faceCount; i++) {
                const texture = await this.makeTexture(buffer[i]);

                textures.push(texture);
            }
            entry.textures[colorSpace] = textures;
        })();
        this.pending.set(pendingKey, promise);
        await promise;
        this.pending.delete(pendingKey);
        return this.get(layer);
    }
    async preload(onProgress) {
        await this.workerCache.preload(this.defaultLayers, undefined, onProgress);
        const totalOps = this.defaultLayers.length * this.faceCount * this.colorSpaces.length;
        let completedOps = 0;

        for (const layer of this.defaultLayers) {
            if (layer < this.minLayer || layer > this.maxLayer) continue;

            for (let faceIndex = 0; faceIndex < this.faceCount; faceIndex++) {
                for (const colorSpace of this.colorSpaces) {
                    await this.getOrCreate(colorSpace, layer, onProgress);
                    completedOps++;
                    if (onProgress) {
                        const fraction = completedOps / totalOps;
                        onProgress(completedOps, totalOps, layer, faceIndex, fraction);
                    }
                }

            }
        }
    }
}
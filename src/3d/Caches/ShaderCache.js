import { createLayerFadeMaterial } from '../FaderTextures/layerMaterial.js';
import { LRULayerCache } from './LRUCache.js';
export class ShaderCache extends LRULayerCache {
  /**
   Fader Cache for blended textures between layers and faces.
   Uses LRU eviction policy.
   key = (colorSpace, layerA, layerB, faceIndex)
   @param {string} type - Type of 3D object (e.g., "cube", "sphere").
   @param {number} maxEntries - Maximum number of entries in the cache.
   @param {number[]} defaultLayers - Default layers to prefetch.
   @param {number} minLayer - Minimum layer index.
   @param {number} maxLayer - Maximum layer index.

   */
  constructor(type = "cube", maxEntries = 128, minLayer = 0, maxLayer = 127) {
    super(type, maxEntries, minLayer, maxLayer);
  }
  async getOrCreate(colorSpace, layerA, layerB, faceIndex, texA, texB, mixFactor, opacity = 1.0, lightNeeded = true) {
    // console.log("ShaderCache getOrCreate called");
    // console.log(colorSpace, layerA, layerB, faceIndex, mixFactor, opacity);
    let texture = this.get(colorSpace, layerA, layerB, faceIndex);
    if (texture) return texture;
    // Create blended texture using shader material
    const material = createLayerFadeMaterial(texA, texB, mixFactor, opacity, lightNeeded);

    material.toneMapped = false;
    material.transparent = false;
    material.depthWrite = true;
    material.depthTest = true;

    return this.set(colorSpace, layerA, layerB, faceIndex, material);
  }

}
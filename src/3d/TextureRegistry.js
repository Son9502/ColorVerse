// A registry for LRU caches for different 3D object texture types
import { ShaderCache } from "./Caches/ShaderCache.js";
import { TextureCache } from "./Caches/TextureCache.js";

const caches = new Map();

// Get both ShaderCache and TextureCache for a given type
export function getCaches(type){
    if (!caches.has(type)){
        caches.set(type, [new TextureCache(type), new ShaderCache(type)]);
    }
    return caches.get(type);
}
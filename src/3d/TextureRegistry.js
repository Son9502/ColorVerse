// A registry of LRU texture caches, one per 3-D object type
import { TextureCache } from "./Caches/TextureCache.js";

const caches = new Map();

export function getTextureCache(type) {
    if (!caches.has(type)) caches.set(type, new TextureCache(type));
    return caches.get(type);
}
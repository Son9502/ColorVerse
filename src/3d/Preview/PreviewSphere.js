import { PreviewBase } from "./PreviewBase.js";
import { createLayerFadeMaterial } from "../FaderTextures/layerMaterial.js";
export class PreviewSphere extends PreviewBase {
    constructor(textureCache, size = 1, opacity = 0.25, scale = 1.5, colorSpace = "RGB") {
        super(textureCache, size, opacity, scale, colorSpace);
        this.material = null;
    }
    async _createObject(layer, colorSpace = "RGB") {
        const entry = await this.textureCache.getOrCreate(colorSpace, layer);
        const geometry = new THREE.SphereGeometry(this.size * this.scale, 64, 64);
    
        this.material = createLayerFadeMaterial(
            entry.textures[colorSpace][0],
            entry.textures[colorSpace][0],
            0,
            this.opacity
        );

        const sphere = new THREE.Mesh(geometry, this.material);

        if (this.mainObject?.object) {
            sphere.position.copy(this.mainObject.object.position);
            sphere.rotation.copy(this.mainObject.object.rotation);
        }

        this.object = sphere;
    }
    async updateLayer(layer, colorSpace = "RGB", {commit = false} = {}) {
        if (!this.object) return;
        
        const entry = await this.textureCache.getOrCreate(colorSpace, layer);
        
        if (commit) {
            this._startBlend(this.material, this.material.uniforms.texB.value, entry.textures[colorSpace][0]);
        }
        else {
            this.material.uniforms.texA.value = this.material.uniforms.texB.value;
            this.material.uniforms.texB.value = entry.textures[colorSpace][0];
            this.material.uniforms.mixFactor.value = 0.0;
        }
        this.colorSpace = colorSpace;
        this.currentLayer = layer;
    }
    async switchColorSpace(colorSpace, duration = 500) {
        const fromSpace = this.colorSpace;
        const toSpace = colorSpace;
        if (fromSpace === toSpace) return;

        const entryFrom = await this.textureCache.getOrCreate(fromSpace, this.currentLayer);
        const entryTo = await this.textureCache.getOrCreate(toSpace, this.currentLayer);

        const startTime = performance.now();

        const animate = () => {
            const elapsed = performance.now() - startTime;
            const t = Math.min(elapsed / duration, 1);

            this.material.uniforms.texA.value = entryFrom.textures[fromSpace][0];
            this.material.uniforms.texB.value = entryTo.textures[toSpace][0];
            this.material.uniforms.mixFactor.value = t;

            if (t < 1) {
                requestAnimationFrame(animate);
            } else {
                this.colorSpace = toSpace;
            }
        };
        requestAnimationFrame(animate);
    }
}

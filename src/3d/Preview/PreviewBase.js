export class PreviewBase {
    constructor(cache, size = 1, opacity = 0.9, scale = 1.5, colorSpace = "RGB") {
        this.textureCache = cache;

        this.object = null;
        this.scene = null;
        this.mainObject = null;
       
        
        this.size = size;
        this.opacity = opacity;
        this.scale = scale;

        this.isVisible = false;
        this.ready = false;

        this.currentLayer = null;
        this.lastBlendKey = null;

        this.blendDuration = 250;
        this._blendStartTime = 0;
        this.blending = false;

        this.colorSpace = colorSpace;
        
    }
    async show(scene, layerNum, colorSpace) {
        if (!this.scene) this.scene = scene;
        if (!this.object) {
            await this._createObject(layerNum, colorSpace);
            this.scene.add(this.object);
            this.ready = true;
        }
        await this.updateLayer(layerNum, colorSpace, {commit: true});
        this.object.visible = true;
        this.isVisible = true;
    }
    hide() {
        if (this.object) {
            this.object.visible = false;
            this.isVisible = false;
            this.blending = true;
        }
    }
    async toggle(scene, layerNum, colorSpace = "RGB") {
        if (this.isVisible) {
            this.hide();
        } else {
            await this.show(scene, layerNum, colorSpace);
        }
    }
    setupControls(mainObject) {
        this.mainObject = mainObject;
    }
    syncRotation() {
        if (this.mainObject?.object && this.object) {
            this.object.rotation.copy(this.mainObject.object.rotation);
        }
    }
    async _getEntry(layerNum, colorSpace) {
        const entry = await this.textureCache.getOrCreate(colorSpace, layerNum);
        return entry;
    }
    
    debounce(fn, delay) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                fn.apply(this, args);
            }, delay);
        };
    }
    _startBlend(material,fromTex, toTex){
        this.blending = false;

        material.uniforms.texA.value = fromTex;
        material.uniforms.texB.value = toTex;
        material.uniforms.mixFactor.value = 0.0;

        this._blendStartTime = performance.now();
        this.blending = true;

        const animate = () => {
            if (!this.blending) return;

            const elapsed = performance.now() - this._blendStartTime;
            const t = Math.min(elapsed / this.blendDuration, 1.0);

            material.uniforms.mixFactor.value = t;

            if (t < 1.0) {
                requestAnimationFrame(animate);
            } else {
                this.blending = false;
                material.uniforms.mixFactor.value = 1.0;
            }
        };
        requestAnimationFrame(animate);
    }
    async _createObject(layerNum, colorSpace) {
        throw new Error("_createObject method must be implemented in subclass");
    }
    async updateLayer(layerNum, colorSpace, {commit = false} = {}) {
        throw new Error("updateLayer method must be implemented in subclass");
    }
    async switchColorSpace(colorSpace, duration = 500) {
        throw new Error("switchColorSpace must be implemented by subclass");
    }
}

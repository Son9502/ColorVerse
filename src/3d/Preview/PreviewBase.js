export class PreviewBase {
    constructor(lruCache, size = 1, opacity = 0.25, scale = 1.5) {
        this.lruCache = lruCache;
        this.object = null;
        this.isVisible = false;
        this.mainObject = null;
        this.size = size;
        this.opacity = opacity;
        this.scale = scale;
        this.scene = null;
    }
    async show(scene, layerNum, colorSpace) {
        if (!this.scene) this.scene = scene;
        if (!this.object) {
            await this._createObject(layerNum, colorSpace);
            if (!this.scene.children.includes(this.object)) {
                this.scene.add(this.object);
            }

        }
        await this.updateLayer(layerNum, colorSpace);
        this.object.visible = true;
        this.isVisible = true;
    }
    hide() {
        if (this.object) {
            this.object.visible = false;
            this.isVisible = false;
        }
    }
    async toggle(scene, layerNum, colorSpace = "RGB") {
        if (this.isVisible) {
            this.hide();
        } else {
            await this.show(scene, layerNum, colorSpace);
        }
    }

    async _createObject(layerNum, colorSpace) {
        throw new Error("_createObject method must be implemented in subclass");
    }
    async updateLayer(layerNum, colorSpace) {
        throw new Error("updateLayer method must be implemented in subclass");
    }
    syncRotation() {
        if (this.mainObject?.object && this.object) {
            this.object.rotation.copy(this.mainObject.object.rotation);
        }
    }
    setupControls(mainObject) {
        this.mainObject = mainObject;
    }
}
import { PreviewBase } from "./PreviewBase.js";
export class PreviewSphere extends PreviewBase {
    constructor(textureCache, size = 1, opacity = 0.25, scale = 1.5) {
        super(textureCache, size, opacity, scale);
    }
    async _createObject(layer, colorSpace = "RGB") {
        const nextSpace = colorSpace;

        const entry = await this.lruCache.get(nextSpace, layer);
        const texture = entry.textures[0];

        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;

        const geometry = new THREE.SphereGeometry(
            this.size * this.scale,
            64,
            64
        );

        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: this.opacity,
            side: THREE.DoubleSide,
            depthWrite: false,   // prevents z-fighting with main sphere
            toneMapped: false
        });

        const newObject = new THREE.Mesh(geometry, material);

        // Sync transform with main sphere
        if (this.mainObject?.object) {
            newObject.position.copy(this.mainObject.object.position);
            newObject.rotation.copy(this.mainObject.object.rotation);
        }

        this.object = newObject;
    }
    async updateLayer(layer, colorSpace = "RGB") {
        if (!this.object) return;
        const nextSpace = colorSpace;

        const entry = await this.lruCache.get(nextSpace, layer);
        const newTexture = entry.textures[0];

        newTexture.colorSpace = THREE.SRGBColorSpace;
        newTexture.needsUpdate = true;

        // Swap texture
        this.object.material.map = newTexture;
        this.object.material.needsUpdate = true;
        this.object.material.userData.originalCanvas = newTexture.userData.originalCanvas;
    }
}

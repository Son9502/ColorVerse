import { PreviewBase } from "./Preview/PreviewBase.js";
export class PreviewCube extends PreviewBase {
    constructor(lruCache, size = 1, opacity = 0.25, scale = 1.5) {
        super(lruCache, size, opacity, scale);

        this.positions = [
            { pos: [0, 0, size / 2], rot: [0, 0, 0] }, // Front
            { pos: [size / 2, 0, 0], rot: [0, Math.PI / 2, 0] }, // Right
            { pos: [0, 0, -size / 2], rot: [0, Math.PI, 0] }, // Back
            { pos: [-size / 2, 0, 0], rot: [0, -Math.PI / 2, 0] }, // Left
            { pos: [0, size / 2, 0], rot: [-Math.PI / 2, 0, 0] }, // Top
            { pos: [0, -size / 2, 0], rot: [Math.PI / 2, 0, 0] }, // Bottom
        ];

    }

    async _createObject(layer, colorSpace = "RGB") {

        const nextSpace = colorSpace;

        const entry = await this.lruCache.get(nextSpace, layer);

        const group = new THREE.Group();
        for (let i = 0; i < 6; i++) {
            const geometry = new THREE.PlaneGeometry(this.size * this.scale, this.size * this.scale);

            const texture = entry.textures[i];
            texture.colorSpace = THREE.SRGBColorSpace; // Ensure correct color space
            texture.needsUpdate = true;

            const material = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: this.opacity
            });
            const plane = new THREE.Mesh(geometry, material);
            plane.position.set(...this.positions[i].pos.map(v => v * this.scale));
            plane.rotation.set(...this.positions[i].rot);
            
            material.userData.originalCanvas = texture.userData.originalCanvas;

            group.add(plane);
        }

        if (this.mainObject?.object) {
            group.position.copy(this.mainObject.object.position);
            group.rotation.copy(this.mainObject.object.rotation);
        }

        this.object = group;
    }
    updateLayer(layer, colorSpace = "RGB") {
        if (!this.object) return;
        
        const nextSpace = colorSpace;
        const entry = await this.lruCache.get(nextSpace, layer);

        this.object.children.forEach((plane, i) => {
            const newTexture = entry.textures[i];
            newTexture.colorSpace = THREE.SRGBColorSpace; // Ensure correct color space
            newTexture.needsUpdate = true;
            plane.material.map = newTexture;
            plane.material.needsUpdate = true;
        });
    }
}

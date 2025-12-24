import { MainBase } from "./MainBase.js";
export class MainSphere extends MainBase {
    constructor(scene, textureCache, camera, onProgress, {
        size = 1,
        colorSpace = "RGB",
        startLayer = 127,
    } = {}) {
        super(scene, textureCache, camera, onProgress, {
            size,
            colorSpace,
            startLayer,
        });

        this.faceMap = {
            "1": 0, "2": 1, "3": 2, "4": 3,
            "5": 4, "6": 5, "7": 6, "8": 7
        };

        this.faceQuaternions = [
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0)), // +X
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI / 2, 0)), // -X
            new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), // +Y
            new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), // -Y
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)),            // +Z (front)
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0)),      // -Z (back)
            new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, Math.PI / 2, 0)), // North pole
            new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, Math.PI / 2, 0))  // South pole
        ];

    }
    async _initObject() {
        const entry = await this.textureCache.get(this.colorSpace, this.currentLayer, this.onProgress);
        //console.log("MainSphere texture entry:", entry);
        const geometry = new THREE.SphereGeometry(this.size, 64, 64); // radius, widthSegments, heightSegments
        const texture = entry.textures[0];
        texture.colorSpace = THREE.SRGBColorSpace; // Ensure correct color space
        texture.needsUpdate = true;
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.DoubleSide,
            toneMapped: false,
            needsUpdate: true
        });
        material.userData.originalCanvas = entry.textures[0].userData.originalCanvas;

        this.object = new THREE.Mesh(geometry, material);
        this.scene.add(this.object);
    }

    // --------------------------
    // Update a sphere layer
    // --------------------------
    async updateLayer(layer) {
        const entry = await this.textureCache.get(this.colorSpace, layer, this.onProgress);

        const newTexture = entry.textures[0];
        newTexture.colorSpace = THREE.SRGBColorSpace; // Ensure correct color space
        newTexture.needsUpdate = true;

        this.object.material.map = newTexture;
        this.object.material.needsUpdate = true;
        this.object.material.userData.originalCanvas = entry.textures[0].userData.originalCanvas;

        this.currentLayer = layer;
    }
}
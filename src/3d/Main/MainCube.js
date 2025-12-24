import { MainBase } from "./MainBase.js";
export class MainCube extends MainBase {
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
        this.cubeSides = [];

        this.faceMap = {
            "1": 0, "2": 1, "3": 2,
            "4": 3, "5": 4, "6": 5
        };

        this.faceQuaternions = [
            new THREE.Quaternion(),                                    // front
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI / 2, 0)), // right
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0)),    // back
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0)),  // left
            new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)),  // top
            new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), // bottom
        ];
    }

    // --------------------------
    // Cube creation
    // --------------------------

    async _initObject() {
        const entry = await this.textureCache.get(this.colorSpace, this.currentLayer, this.onProgress);
        const positions = this._facePositions();

        this.object = new THREE.Group();

        for (let i = 0; i < 6; i++) {
            const geometry = new THREE.PlaneGeometry(this.size, this.size);

            const texture = entry.textures[i];
            texture.colorSpace = THREE.SRGBColorSpace; // Ensure correct color space
            texture.needsUpdate = true;

            const material = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.DoubleSide
            });

            material.userData.originalCanvas = entry.textures[i].userData.originalCanvas;

            const plane = new THREE.Mesh(geometry, material);

            plane.position.set(...positions[i].pos);
            plane.rotation.set(...positions[i].rot);

            this.object.add(plane);
            this.cubeSides.push({ plane, ogColors: entry.textureData[i] });
        }

        this.scene.add(this.object);
    }
    // --------------------------
    // Face positions
    // --------------------------
    _facePositions() {
        const s = this.size;
        return [
            { pos: [0, 0, s / 2], rot: [0, 0, 0] },
            { pos: [s / 2, 0, 0], rot: [0, Math.PI / 2, 0] },
            { pos: [0, 0, -s / 2], rot: [0, Math.PI, 0] },
            { pos: [-s / 2, 0, 0], rot: [0, -Math.PI / 2, 0] },
            { pos: [0, s / 2, 0], rot: [-Math.PI / 2, 0, 0] },
            { pos: [0, -s / 2, 0], rot: [Math.PI / 2, 0, 0] },
        ];
    }

    // --------------------------
    // Update a cube layer
    // --------------------------
    async updateLayer(layer) {
        const entry = await this.textureCache.get(this.colorSpace, layer, this.onProgress);

        this.cubeSides.forEach((side, i) => {
            // Replace Texture 
            if (side.plane.material.map) side.plane.material.map.dispose();

            const texture = entry.textures[i];
            texture.colorSpace = THREE.SRGBColorSpace; // Ensure correct color space
            texture.needsUpdate = true;
            side.plane.material.map = texture;
            side.plane.material.map.needsUpdate = true;
            side.plane.material.userData.originalCanvas = entry.textures[i].userData.originalCanvas;
            // Reset Geometry
            side.plane.geometry.dispose();
            side.plane.geometry = new THREE.PlaneGeometry(this.size, this.size);

            side.ogColors = entry.textureData[i];
        });

        this.currentLayer = layer;
    }

}

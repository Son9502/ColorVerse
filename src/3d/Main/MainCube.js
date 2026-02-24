import { MainBase } from "./MainBase.js";
import { createLayerFadeMaterial } from "../FaderTextures/layerMaterial.js";
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
        this.objectType = "cube";
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
        this.positions = this._facePositions();
        this.faceCount = 6;
    }

    // --------------------------
    // Cube creation
    // --------------------------

    async initObject() {
        const entry = await this.textureCache.getOrCreate(this.colorSpace, this.currentLayer, this.onProgress);

        this.object = new THREE.Group();
        for (let i = 0; i < 6; i++) {
            const { pos, rot, uvFlip } = this.positions[i];
            const geometry = new THREE.PlaneGeometry(this.size, this.size);
            geometry.scale(uvFlip[0] ? -1 : 1, uvFlip[1] ? -1 : 1, 1);

            const material = createLayerFadeMaterial(entry.textures[this.colorSpace][i], entry.textures[this.colorSpace][i], 0);

            const plane = new THREE.Mesh(geometry, material);
            plane.material.side = THREE.DoubleSide;
            plane.position.set(...pos);
            plane.rotation.set(...rot);

            this.object.add(plane);
            this.cubeSides.push({plane: plane, material: material, uvFlip: uvFlip});
        }
        this.scene.add(this.object);
        this.ready = true;
    }
    // --------------------------
    // Face positions
    // --------------------------
    _facePositions() {
        const s = this.size;
        return [
            { pos: [0, 0, s / 2], rot: [0, 0, 0], uvFlip: [0, 1] }, // front
            { pos: [s / 2, 0, 0], rot: [0, Math.PI / 2, 0], uvFlip: [0, 1] }, // right
            { pos: [0, 0, -s / 2], rot: [0, 0, Math.PI], uvFlip: [0, 0] }, // back
            { pos: [-s / 2, 0, 0], rot: [0, -Math.PI / 2, 0], uvFlip: [0, 1] }, // left
            { pos: [0, s / 2, 0], rot: [Math.PI / 2, 0, 0], uvFlip: [0, 0] }, // top
            { pos: [0, -s / 2, 0], rot: [-Math.PI / 2, 0, 0], uvFlip: [0, 0] }, // bottom
        ];
    }
    // --------------------------
    // Update a cube layer
    // --------------------------
    async updateLayer(layerFloat) {
        const z0 = Math.floor(layerFloat);
        const t = layerFloat - z0;

        const layerA = z0;
        const layerB = Math.min(127, z0 + 1);

        const entryA = await this.textureCache.getOrCreate(this.colorSpace, layerA, this.onProgress);
        const entryB = await this.textureCache.getOrCreate(this.colorSpace, layerB, this.onProgress);

        for (let i = 0; i < 6; i++) {
            const newMaterial = this.cubeSides[i].material;
            newMaterial.uniforms.texA.value = entryA.textures[this.colorSpace][i];
            newMaterial.uniforms.texB.value = entryB.textures[this.colorSpace][i];
            newMaterial.uniforms.mixFactor.value = t;
        }

        this.currentLayer = z0;
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
            for (let i = 0; i < 6; i++) {
                const newMaterial = this.cubeSides[i].material;
                newMaterial.uniforms.texA.value = entryFrom.textures[fromSpace][i];
                newMaterial.uniforms.texB.value = entryTo.textures[toSpace][i];
                newMaterial.uniforms.mixFactor.value = t;
            }
            if (t < 1) {
                requestAnimationFrame(animate);
            } else {
                this.colorSpace = toSpace;
            }
        };
        requestAnimationFrame(animate);
    }

}

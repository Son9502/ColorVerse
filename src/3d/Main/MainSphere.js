import { MainBase } from "./MainBase.js";
import { createLayerFadeMaterial } from "../FaderTextures/layerMaterial.js";
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
            "5": 4, "6": 5, 
            //"7": 6, "8": 7
        };

        this.faceQuaternions = [
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0)), // +X
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI / 2, 0)), // -X
            new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), // +Y
            new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), // -Y
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)),            // +Z (front)
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0)),      // -Z (back)
            //new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, Math.PI / 2, 0)), // North pole
            //new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, Math.PI / 2, 0))  // South pole
        ];
        this.faceCount = 1;
    }
    async initObject() {
        const entry = await this.textureCache.getOrCreate(this.colorSpace, this.currentLayer, this.onProgress);
        const geometry = new THREE.SphereGeometry(this.size, 64, 64); // radius, widthSegments, heightSegments

        this.material = createLayerFadeMaterial(entry.textures[this.colorSpace][0], entry.textures[this.colorSpace][0], 0);
        this.objectType = "sphere";
        this.object = new THREE.Mesh(geometry, this.material);
        this.scene.add(this.object);
        this.ready = true;
        
    }

    // --------------------------
    // Update a sphere layer
    // --------------------------
    async updateLayer(layerFloat) {
        const z0 = Math.floor(layerFloat);
        const t = layerFloat - z0;

        const layerA = z0;
        const layerB = Math.min(127, z0 + 1);

        const entryA = await this.textureCache.getOrCreate(this.colorSpace, layerA);
        const entryB = await this.textureCache.getOrCreate(this.colorSpace, layerB);

        const newMaterial = this.material; 
        newMaterial.uniforms.texA.value = entryA.textures[this.colorSpace][0];
        newMaterial.uniforms.texB.value = entryB.textures[this.colorSpace][0];
        newMaterial.uniforms.mixFactor.value = t;

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
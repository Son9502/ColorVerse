import { PreviewBase } from "./PreviewBase.js";
import { createLayerFadeMaterial } from "../FaderTextures/layerMaterial.js";
import { THREE } from "../../three-setup.js";
export class PreviewCube extends PreviewBase {
    constructor(lruCache, size = 1, opacity = 0.25, scale = 1.5, colorSpace = "RGB") {
        super(lruCache, size, opacity, scale, colorSpace);
        this.cubeSides = [];
        this.positions = this._facePositions();
    }
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
    async _createObject(layer, colorSpace = "RGB") {
        //const s = this.size * this.scale;

        const entry = await this.textureCache.getOrCreate(colorSpace, layer);


        const materials = [];
        for (let i = 0; i < 6; i++) {
            const material = createLayerFadeMaterial(
                entry.textures[colorSpace][i],
                entry.textures[colorSpace][i],
                0,
                this.opacity
            );
            materials.push(material);
        }

        const group = new THREE.Group();
        for (let i = 0; i < 6; i++) {
            const { pos, rot, uvFlip } = this.positions[i];

            const geometry = new THREE.PlaneGeometry(this.size * this.scale, this.size * this.scale);
            geometry.scale(uvFlip[0] ? -1 : 1, uvFlip[1] ? -1 : 1, 1);

            const plane = new THREE.Mesh(geometry, materials[i]);
            plane.position.set(...pos.map(v => v * this.scale));
            plane.rotation.set(...rot);

            plane.material.side = THREE.DoubleSide;
            group.add(plane);
            this.cubeSides.push(materials[i]);
        }

        if (this.mainObject?.object) {
            group.position.copy(this.mainObject.object.position);
            group.rotation.copy(this.mainObject.object.rotation);
        }

        this.object = group;
    }

    async updateLayer(layer, colorSpace = "RGB", { commit = false } = {}) {
        if (!this.object) return;

        const entry = await this.textureCache.getOrCreate(colorSpace, layer);

        for (let i = 0; i < 6; i++) {
            const material = this.cubeSides[i];
            if (commit) {
                this._startBlend(material, material.uniforms.texB.value, entry.textures[colorSpace][i]);
            } else {
                material.uniforms.texA.value = entry.textures[colorSpace][i];
                material.uniforms.texB.value = entry.textures[colorSpace][i];
                material.uniforms.mixFactor.value = 0.0;
            }
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
            for (let i = 0; i < 6; i++) {
                const newMaterial = this.cubeSides[i];
                newMaterial.uniforms.texA.value = entryFrom.textures[fromSpace][i];
                newMaterial.uniforms.texB.value = entryTo.textures[toSpace][i];
                newMaterial.uniforms.mixFactor.value = t;
            }
            if (t < 1) {
                requestAnimationFrame(animate);
            } else {
                for (let i = 0; i < 6; i++) {
                    const material = this.cubeSides[i];
                    material.uniforms.texA.value = entryTo.textures[toSpace][i];
                    material.uniforms.texB.value = entryTo.textures[toSpace][i];
                    material.uniforms.mixFactor.value = 0.0;
                }
                this.colorSpace = toSpace;
            }
        };
        requestAnimationFrame(animate);
    }
}   

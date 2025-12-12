export class PreviewCube {
    constructor(textureCache, size = 1, opacity = 0.25, scale = 1.5) {
        this.textureCache = textureCache;
        this.size = size;
        this.opacity = opacity;
        this.scale = scale;

        this.positions = [
            { pos: [0, 0, size / 2], rot: [0, 0, 0] }, // Front
            { pos: [size / 2, 0, 0], rot: [0, Math.PI / 2, 0] }, // Right
            { pos: [0, 0, -size / 2], rot: [0, Math.PI, 0] }, // Back
            { pos: [-size / 2, 0, 0], rot: [0, -Math.PI / 2, 0] }, // Left
            { pos: [0, size / 2, 0], rot: [-Math.PI / 2, 0, 0] }, // Top
            { pos: [0, -size / 2, 0], rot: [Math.PI / 2, 0, 0] }, // Bottom
        ];

        this.object = null;
        this.scene = null;
        this.mainCube = null;
    }

    async createPreview(scene, layer, colorSpace = "RGB", toggle = false) {
        this.scene = scene;
        if (this.object) this.removePreview();
        
        const nextSpace = toggle ? (colorSpace === "RGB" ? "HSL" : "RGB") : colorSpace;
        const entry = await this.textureCache.get(nextSpace, layer);

        const group = new THREE.Group();
        for (let i = 0; i < 6; i++) {
            const geometry = new THREE.PlaneGeometry(this.size * this.scale, this.size * this.scale);
            const material = new THREE.MeshBasicMaterial({
                map: entry.textures[i],
                side: THREE.DoubleSide,
                transparent: true,
                opacity: this.opacity
            });
            const plane = new THREE.Mesh(geometry, material);
            plane.position.set(...this.positions[i].pos.map(v => v * this.scale));
            plane.rotation.set(...this.positions[i].rot);
            group.add(plane);
        }

        if (this.mainCube && this.mainCube.object) {
            group.position.copy(this.mainCube.object.position);
            group.rotation.copy(this.mainCube.object.rotation);
        }

        this.object = group;
        scene.add(this.object);
    }


    removePreview() {
        if (!this.object || !this.scene) return;
        this.scene.remove(this.object);
        this.object.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });
        this.object = null;
    }

    // Automatically sync position and rotation from MainCube
    syncRotation() {
        if (this.mainCube && this.mainCube.object) {
            this.object.rotation.copy(this.mainCube.object.rotation);
        }
    }
    setupControls(mainCube) {
        this.mainCube = mainCube;
    }
}

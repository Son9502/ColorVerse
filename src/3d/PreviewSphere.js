export class PreviewSphere {
    constructor(textureCache, size = 1, opacity = 0.25, scale = 1.5) {
        this.textureCache = textureCache;
        this.size = size;
        this.opacity = opacity;
        this.scale = scale;

        this.object = null;
        this.scene = null;
        this.mainSphere = null;
    }
    async createPreview(scene, layer, colorSpace = "RGB") {
        this.scene = scene;
        if (this.object) this.removePreview();

        const nextSpace = colorSpace;

        const entry = await this.textureCache.get(nextSpace, layer);
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
        if (this.mainSphere?.object) {
            newObject.position.copy(this.mainSphere.object.position);
            newObject.rotation.copy(this.mainSphere.object.rotation);
        }

        this.object = newObject;
        scene.add(this.object);
    }
    removePreview() {
        if (!this.object || !this.scene) return;

        this.scene.remove(this.object);

        this.object.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (obj.material.map) {
                    obj.material.map = null;
                }
                obj.material.dispose();
            }
        });

        this.object = null;
    }

    syncRotation() {
        if (this.mainSphere?.object && this.object) {
            this.object.rotation.copy(this.mainSphere.object.rotation);
        }
    }
    setupControls(mainSphere) {
        this.mainSphere = mainSphere;
    }

}
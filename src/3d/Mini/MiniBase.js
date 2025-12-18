
export class MiniBase {
    constructor(renderer, colorSpace = "RGB", size = 2, offset = 20, padding = 10) {
        this.renderer = renderer;
        this.colorSpace = colorSpace;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(60, 1, 0.01, 100);
        this.root = new THREE.Group();
        this.scene.add(this.root);

        this.object = null; // The main mini mesh
        this.axesHelper = null; // Axes group
        this.labelGroup = null; // Optional labels

        this.size = size;
        this.offset = offset;
        this.padding = padding;

        this.materials = {};

        // Axis arrows
        this.buildAxesHelper([
            { len: 3, dir: new THREE.Vector3(1, 0, 0), color: 0xff0000 },
            { len: 3, dir: new THREE.Vector3(0, 1, 0), color: 0x00ff00 },
            { len: 3, dir: new THREE.Vector3(0, 0, 1), color: 0x0000ff },
        ]);

    }

    createObject() {
        // To be implemented in subclasses
        throw new Error("createObject() must be implemented in subclass");
    }
    buildMaterials(materialsObj) {
        this.materials = materialsObj;
        Object.values(this.materials).forEach(mat => {
            mat.opacity = 0.9;
            mat.transparent = true;
        });
    }

    buildAxesHelper(axesDefs = []) {
        this.axesHelper = new THREE.Group();
        axesDefs.forEach(def => {
            const { len, dir, color } = def;
            const arrow = new THREE.ArrowHelper(dir, new THREE.Vector3(0, 0, 0), len, color, 0.2, 0.1);
            this.axesHelper.add(arrow);
        });
        this.root.add(this.axesHelper);
    }

    updateRotation(mainQuat) {
        this.root.quaternion.copy(mainQuat);
        //if (this.object) this.object.quaternion.copy(mainQuat);
        //if (this.axesHelper) this.axesHelper.quaternion.copy(mainQuat);
        // Optional label syncing could go here
        // Keep labels facing the MiniCube's camera
        /*
        this.labelGroup.children.forEach(label => {
            const axisRot = label.userData.axisRot;
            if (axisRot) label.rotateX(axisRot.x).rotateY(axisRot.y).rotateZ(axisRot.z);
        });*/
    }

    updateColorSpace(colorSpace = "RGB") {
        this.colorSpace = colorSpace;
        if (this.materials[colorSpace] && this.object) {
            this.object.material = this.materials[colorSpace];
            this.object.material.needsUpdate = true;
        }
        // Optional: labels update hook
    }
    /*
     _addLabel(text, color, x, y, z, rotation = new THREE.Euler(0, 0, 0), viewportSize = 150) {
         try {
             const canvas = document.createElement("canvas");
             canvas.width = canvas.height = 256;
             const ctx = canvas.getContext("2d");
             ctx.font = `${Math.max(20, 140 * (viewportSize / 150))}px Arial`;
             ctx.fillStyle = color;
             ctx.textAlign = "center";
             ctx.textBaseline = "middle";
             ctx.fillText(text, canvas.width / 2, canvas.height / 2);
     
             const texture = new THREE.CanvasTexture(canvas);
             texture.needsUpdate = true;
             const material = new THREE.SpriteMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
             const geometry = new THREE.PlaneGeometry(1, 1);
             const mesh = new THREE.Mesh(geometry, material);
     
             mesh.position.set(x, y, z);
             mesh.rotation.copy(rotation);
     
             mesh.userData.axisRot = rotation.clone();
             this.labelGroup.add(mesh);
     
         } catch (error) {
             console.error("Error creating label:", error);
         }
     }*/
    /*
     updateLabels(colorSpace = "RGB") {
         // Clear old labels
         while (this.labelGroup.children.length) {
             this.labelGroup.remove(this.labelGroup.children[0]);
         }
     
         const xLabel = colorSpace === "RGB" ? "R" : "H";
         const yLabel = colorSpace === "RGB" ? "G" : "L";
         const zLabel = colorSpace === "RGB" ? "B" : "S";
     
         const xRot = new THREE.Euler(-Math.PI / 2, Math.PI / 2, 0);
         const yRot = new THREE.Euler(0, 0, 0);
         const zRot = new THREE.Euler(-Math.PI / 2, Math.PI / 4, 0);
     
         this._addLabel(xLabel, "red", this.axisLength, 0, 0, xRot);
         this._addLabel(yLabel, "green", 0, this.axisLength, 0, yRot);
         this._addLabel(zLabel, "blue", 0, 0, this.axisLength, zRot);
     }*/
    renderMiniObject(minDivisor = 16, maxDivisor = 25) {
        const sizeVec = this.renderer.getSize(new THREE.Vector2());
        let size = Math.min(sizeVec.x, sizeVec.y) / minDivisor;
        const minSize = Math.min(sizeVec.x, sizeVec.y) / maxDivisor;
        size = Math.max(size, minSize);

        const x = sizeVec.x - size - this.offset - this.padding;
        const y = this.offset + this.padding;

        this.camera.aspect = 1;
        this.camera.updateProjectionMatrix();

        this.renderer.setScissorTest(true);
        this.renderer.setViewport(x, y, size, size);
        this.renderer.setScissor(x, y, size, size);

        this.renderer.clearDepth();
        this.renderer.render(this.scene, this.camera);

        this.renderer.setViewport(0, 0, sizeVec.x, sizeVec.y);
        this.renderer.setScissorTest(false);
    }
}
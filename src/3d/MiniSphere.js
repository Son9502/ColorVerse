import { makeRGBMat, makeHSLMat } from "../color-utils.js";

export class MiniSphere {
    constructor(renderer, colorSpace = "RGB") {
        this.renderer = renderer;

        // Mini scene and camera
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(60, 1, 0.01, 100);

        this.sphereSize = 2;
        this.axisLength = this.sphereSize * 1.5;

        // Create mini sphere
        const geometry = new THREE.SphereGeometry(this.sphereSize, 64, 64);
        this.materials = {
            "RGB": makeRGBMat(),
            "HSL": makeHSLMat()
        };
        Object.values(this.materials).forEach(mat => {
            mat.opacity = 0.9
            mat.transparent = true;
        });
        this.axesSphere = new THREE.Mesh(geometry, this.materials[colorSpace]);
        this.scene.add(this.axesSphere);

        // Axis arrows
        this.axesHelper = new THREE.Group();
        this._makeAxis(this.axesHelper, this.axisLength, 1, 0, 0, 0xff0000); // X
        this._makeAxis(this.axesHelper, this.axisLength, 0, 1, 0, 0x00ff00); // Y
        this._makeAxis(this.axesHelper, this.axisLength, 0, 0, 1, 0x0000ff); // Z
        this.scene.add(this.axesHelper);

        // Labels
        /*
        this.labelGroup = new THREE.Group();
        this.scene.add(this.labelGroup);
        this.updateLabels(colorSpace); // default colorSpace*/

    }

    _makeAxis(group, len, x, y, z, color) {
        const dir = new THREE.Vector3(x, y, z).normalize();
        const origin = new THREE.Vector3(0, 0, 0);
        const arrow = new THREE.ArrowHelper(dir, origin, len, color, 0.2, 0.1);
        group.add(arrow);
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
    updateColorSpace(colorSpace = "RGB") {
        if (!this.materials[colorSpace]) {
            console.warn(`Unknown colorSpace: ${colorSpace}`);
            return;
        }
        this.axesSphere.material = this.materials[colorSpace];
        this.axesSphere.material.needsUpdate = true;
        //this.updateLabels(colorSpace);
    }
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

    updateRotation(mainQuat) {
        this.axesSphere.quaternion.copy(mainQuat);
        this.axesHelper.quaternion.copy(mainQuat);

        // Keep labels facing the MiniCube's camera
        /*
        this.labelGroup.children.forEach(label => {
            const axisRot = label.userData.axisRot;
            if (axisRot) label.rotateX(axisRot.x).rotateY(axisRot.y).rotateZ(axisRot.z);
        });*/
    }


    renderMiniObject(minDivisor = 16, maxDivisor = 25, offset = 20, padding = 10) {
        const sizeVec = this.renderer.getSize(new THREE.Vector2());
        let size = Math.min(sizeVec.x, sizeVec.y) / minDivisor;
        const minSize = Math.min(sizeVec.x, sizeVec.y) / maxDivisor;
        size = Math.max(size, minSize);

        const x = sizeVec.x - size - offset - padding;
        const y = offset + padding;

        // Camera setup
        this.camera.aspect = 1;
        this.camera.updateProjectionMatrix();
        const camDist = this.sphereSize * 2.5;
        this.camera.position.set(camDist, camDist, camDist);
        this.camera.lookAt(0, 0, 0);

        this.renderer.setScissorTest(true);
        this.renderer.setViewport(x, y, size, size);
        this.renderer.setScissor(x, y, size, size);

        this.renderer.clearDepth();
        this.renderer.render(this.scene, this.camera);

        // Reset viewport
        this.renderer.setViewport(0, 0, sizeVec.x, sizeVec.y);
        this.renderer.setScissorTest(false);
    }

}

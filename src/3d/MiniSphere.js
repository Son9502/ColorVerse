export class MiniSphere {
    constructor(renderer) {
        this.renderer = renderer;

        // Mini scene and camera
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(60, 1, 0.01, 100);

        this.cubeSize = 2;
        this.axisLength = this.cubeSize * 1.5;

        // Create mini cube
        const geometry = new THREE.BoxGeometry(this.cubeSize, this.cubeSize, this.cubeSize);
        this.materials = [
            this._makeFace(0xff0000, "R"), // Right - Red
            this._makeFace(0x00ff00, "L"), // Left - Green
            this._makeFace(0x0000ff, "T"), // Top - Blue
            this._makeFace(0xffff00, "Bo"), // Bottom - Yellow
            this._makeFace(0xff00ff, "F"), // Front - Magenta
            this._makeFace(0x00ffff, "Ba"), // Back - Cyan
        ];
        this.materials.forEach(mat => {
            mat.opacity = 0.9;
            mat.transparent = true;
        });
        this.axesCube = new THREE.Mesh(geometry, this.materials);
        this.scene.add(this.axesCube);

        // Cube outline
        const edges = new THREE.EdgesGeometry(geometry);
        const outline = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({ color: 0x000000 })
        );
        this.axesCube.add(outline);

        // Axis arrows
        this.axesHelper = new THREE.Group();
        this.scene.add(this.axesHelper);
        this._makeAxis(this.axesHelper, this.axisLength, 1, 0, 0, 0xff0000); // X
        this._makeAxis(this.axesHelper, this.axisLength, 0, 1, 0, 0x00ff00); // Y
        this._makeAxis(this.axesHelper, this.axisLength, 0, 0, 1, 0x0000ff); // Z

        // Labels
        this.labelGroup = new THREE.Group();
        this.scene.add(this.labelGroup);
        this.updateLabels("RGB"); // default colorSpace
    }

    _makeAxis(group, len, x, y, z, color) {
        const dir = new THREE.Vector3(x, y, z).normalize();
        const origin = new THREE.Vector3(0, 0, 0);
        const arrow = new THREE.ArrowHelper(dir, origin, len, color, 0.2, 0.1);
        group.add(arrow);
    }

    _makeFace(colorHex, text) {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 256;
        const ctx = canvas.getContext("2d");

        // Fill background
        ctx.fillStyle = `#${colorHex.toString(16).padStart(6, '0')}`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw text
        ctx.font = "bold 100px Arial";
        ctx.fillStyle = "black";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        return new THREE.MeshBasicMaterial({ map: texture, transparent: false });
    }

    _addLabel(text, color, x, y, z, viewportSize = 150) {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 256;
        const ctx = canvas.getContext("2d");
        ctx.font = `${Math.max(20, 140 * (viewportSize / 150))}px Arial`;
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);

        const offset = 0.2;
        sprite.scale.set(1.5, 1.5, 1.5);
        sprite.position.set(x * (1 + offset), y * (1 + offset), z * (1 + offset));
        this.labelGroup.add(sprite);
    }

    updateLabels(colorSpace = "RGB") {
        // Clear old labels
        while (this.labelGroup.children.length) {
            this.labelGroup.remove(this.labelGroup.children[0]);
        }

        const xLabel = colorSpace === "RGB" ? "R" : "H";
        const yLabel = colorSpace === "RGB" ? "G" : "S";
        const zLabel = colorSpace === "RGB" ? "B" : "L";

        this._addLabel(xLabel, "red", this.axisLength, 0, 0);
        this._addLabel(yLabel, "green", 0, this.axisLength, 0);
        this._addLabel(zLabel, "blue", 0, 0, this.axisLength);
    }

    updateRotation(mainQuat) {
        this.axesCube.quaternion.copy(mainQuat);
        this.axesHelper.quaternion.copy(mainQuat);

        // Keep labels facing the MiniCube's camera
        this.labelGroup.children.forEach(label =>
            label.quaternion.copy(this.camera.quaternion)
        );
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
        const camDist = this.cubeSize * 2.5;
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

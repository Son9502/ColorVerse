import { makeRGBMat, makeHSLMat } from "../color-utils.js";
export class MiniCube {
    constructor(renderer, colorSpace = "RGB") {
        this.renderer = renderer;

        // Mini scene and camera
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(60, 1, 0.01, 100);
        this.root = new THREE.Group();
        this.scene.add(this.root);

        this.cubeSize = 2;
        this.axisLength = this.cubeSize * 1.5;

        // Create mini cube
        const geometry = new THREE.BoxGeometry(this.cubeSize, this.cubeSize, this.cubeSize);
        this.materials = {
            "RGB": makeRGBMat(),
            "HSL": makeHSLMat()
        };
        this.axesCube = new THREE.Mesh(geometry, this.materials[colorSpace]);
        this.root.add(this.axesCube);
        
        // Rotate to match main cube orientation
        //this.axesCube.rotation.x = Math.PI;
        this.axesCube.rotation.y = Math.PI;
        this.axesCube.scale.x = -1;
        //this.axesCube.rotation.z = Math.PI;

        // Cube outline
        const edges = new THREE.EdgesGeometry(geometry);
        const outline = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({ color: 0x000000 })
        );

        // Axis arrows
        this.axesHelper = new THREE.Group();
        this.root.add(this.axesHelper);
        this._makeAxis(this.axesHelper, this.axisLength, 1, 0, 0, 0xff0000); // X
        this._makeAxis(this.axesHelper, this.axisLength, 0, 1, 0, 0x00ff00); // Y
        this._makeAxis(this.axesHelper, this.axisLength, 0, 0, 1, 0x0000ff); // Z
        this.axesCube.add(outline);
        
        // Face labels
        this.labelGroup = new THREE.Group();
        this.root.add(this.labelGroup);
        this._createFaceLabels();
        /*
        // Labels
        this.labelGroup = new THREE.Group();
        this.scene.add(this.labelGroup);
        this.updateLabels("RGB"); // default colorSpace 
        */
    }

    _makeAxis(group, len, x, y, z, color) {
        const dir = new THREE.Vector3(x, y, z).normalize();
        const origin = new THREE.Vector3(0, 0, 0);
        const arrow = new THREE.ArrowHelper(dir, origin, len, color, 0.2, 0.1);
        group.add(arrow);
    }
    _createFaceLabels() {
        while (this.labelGroup?.children.length) {
            this.labelGroup.remove(this.labelGroup.children[0]);
        }
        const faces = [
            {"text": "F", pos: [0,0,this.cubeSize/2], rot: new THREE.Euler(0,0,0) }, // Front
            {"text": "Ba", pos: [0,0,-this.cubeSize/2], rot: new THREE.Euler(0,Math.PI,0) }, // Back
            {"text": "R", pos: [this.cubeSize/2,0,0], rot: new THREE.Euler(0,Math.PI/2,0) }, // Right
            {"text": "L", pos: [-this.cubeSize/2,0,0], rot: new THREE.Euler(0,-Math.PI/2,0) }, // Left
            {"text": "T", pos: [0,this.cubeSize/2,0], rot: new THREE.Euler(-Math.PI/2,0,0) }, // Up
            {"text": "Bo", pos: [0,-this.cubeSize/2,0], rot: new THREE.Euler(Math.PI/2,0,0) }, // Down
        ]
        const offset = 0.1;
        faces.forEach(face => {
            this._addFaceLabel(face.text, face.pos, face.rot, 150, offset, 0x000000);
        });
    }
    _addFaceLabel(text, pos, rot, viewportSize = 150, offset = 0.05, colorHex = 0x000000) {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 256;
        const ctx = canvas.getContext("2d");

        // Draw text
        ctx.font = `${Math.max(20, 140 * (viewportSize / 150))}px Arial`;
        ctx.fillStyle = `#${colorHex.toString(16).padStart(6, '0')}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, depthWrite: false, depthTest: true, opacity: 0.9 });
        const plane = new THREE.PlaneGeometry(this.cubeSize * 0.5, this.cubeSize * 0.5);
        const mesh  = new THREE.Mesh(plane, material);
        

        mesh.position.set(pos[0] * (1 + offset), pos[1] * (1 + offset), pos[2] * (1 + offset));
        mesh.rotation.copy(rot);
        this.labelGroup.add(mesh);
    }
    /*
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
    }*/
    updateColorSpace(colorSpace = "RGB") {
        if (!this.materials[colorSpace]) {
            console.warn(`Unknown colorSpace: ${colorSpace}`);
            return;
        }
        this.axesCube.material = this.materials[colorSpace];
        this.axesCube.material.needsUpdate = true;
        if (colorSpace === "RGB") {
            this.axesCube.scale.x = -1;
            this.axesCube.rotation.y = Math.PI;
        } else {
            this.axesCube.scale.x = 1;
            this.axesCube.rotation.y = 0;
        }
        //this.updateLabels(colorSpace);
    }
    updateRotation(mainQuat) {
        /*
        this.axesCube.quaternion.copy(mainQuat);
        this.axesHelper.quaternion.copy(mainQuat);
        // Keep labels facing the MiniCube's camera
        this.labelGroup.children.forEach(label =>
            label.quaternion.copy(this.camera.quaternion)
        );*/
        this.root.quaternion.copy(mainQuat);
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

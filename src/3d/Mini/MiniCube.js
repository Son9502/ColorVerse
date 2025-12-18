import { MiniBase } from "./MiniBase.js";
import { makeRGBMat, makeHSLMat } from "../../color-utils.js";
export class MiniCube extends MiniBase {
    constructor(renderer, colorSpace = "RGB") {
        super(renderer, colorSpace);

        this.buildMaterials({ "RGB": makeRGBMat(), "HSL": makeHSLMat() });

        this.createObject();

        this.viewportSize = 150;
    }
    createObject() {
        const geometry = new THREE.BoxGeometry(this.size, this.size, this.size);
        this.object = new THREE.Mesh(geometry, this.materials[this.colorSpace]);
        this.root.add(this.object);

        this.object.rotation.y = Math.PI;
        this.object.scale.x = -1;

        this.viewportSize = 150;

        const edges = new THREE.EdgesGeometry(geometry);
        const outline = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({ color: 0x000000 })
        );

        // Face labels
        this.labelGroup = new THREE.Group();
        this.root.add(this.labelGroup);
        this._createFaceLabels();

    }
    _createFaceLabels() {
        while (this.labelGroup?.children.length) {
            this.labelGroup.remove(this.labelGroup.children[0]);
        }
        const faces = [
            { "text": "F", pos: [0, 0, this.cubeSize / 2], rot: new THREE.Euler(0, 0, 0) }, // Front
            { "text": "Ba", pos: [0, 0, -this.cubeSize / 2], rot: new THREE.Euler(0, Math.PI, 0) }, // Back
            { "text": "R", pos: [this.cubeSize / 2, 0, 0], rot: new THREE.Euler(0, Math.PI / 2, 0) }, // Right
            { "text": "L", pos: [-this.cubeSize / 2, 0, 0], rot: new THREE.Euler(0, -Math.PI / 2, 0) }, // Left
            { "text": "T", pos: [0, this.cubeSize / 2, 0], rot: new THREE.Euler(-Math.PI / 2, 0, 0) }, // Up
            { "text": "Bo", pos: [0, -this.cubeSize / 2, 0], rot: new THREE.Euler(Math.PI / 2, 0, 0) }, // Down
        ]
        const offset = 0.1;
        faces.forEach(face => {
            this._addFaceLabel(face.text, face.pos, face.rot, offset, 0x000000);
        });
    }
    _addFaceLabel(text, pos, rot, offset = 0.05, colorHex = 0x000000) {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 256;
        const ctx = canvas.getContext("2d");

        // Draw text
        ctx.font = `${Math.max(20, 140 * (this.viewportSize / 150))}px Arial`;
        ctx.fillStyle = `#${colorHex.toString(16).padStart(6, '0')}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, depthWrite: false, depthTest: true, opacity: 0.9 });
        const plane = new THREE.PlaneGeometry(this.size * 0.5, this.size * 0.5);
        const mesh = new THREE.Mesh(plane, material);


        mesh.position.set(pos[0] * (1 + offset), pos[1] * (1 + offset), pos[2] * (1 + offset));
        mesh.rotation.copy(rot);
        this.labelGroup.add(mesh);
    }
    updateColorSpace(colorSpace = "RGB") {
        super.updateColorSpace(colorSpace);
        if (colorSpace === "RGB") {
            this.axesCube.scale.x = -1;
            this.axesCube.rotation.y = Math.PI;
        } else {
            this.axesCube.scale.x = 1;
            this.axesCube.rotation.y = 0;
        }   
    }
}

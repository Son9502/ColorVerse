import { makeRGBMat, makeHSLMat } from "./miniMaterials.js";
import { THREE } from "../../three-setup.js";
export class MiniBase {
    constructor(renderer, colorSpace = "RGB", size = 2, offset = 20, padding = 10, {fadeIn = 200, fadeOut = 400, idleDelay = 1500} = {}) {
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
        this.buildMaterials({ "RGB": makeRGBMat(), "HSL": makeHSLMat() });

        // Axis arrows
        this.buildAxesHelper([
            { len: 3, dir: new THREE.Vector3(1, 0, 0), color: 0xff0000 },
            { len: 3, dir: new THREE.Vector3(0, 1, 0), color: 0x00ff00 },
            { len: 3, dir: new THREE.Vector3(0, 0, 1), color: 0x0000ff },
        ]);

        this.camera.position.set(0, 0, this.size * 3);
        this.camera.lookAt(0, 0, 0);

        // Animation parameters
        this.fadeIn = fadeIn;
        this.fadeOut = fadeOut;
        this.idleDelay = idleDelay;

        this.opacity = 0;
        this.targetOpacity = 0;
        this.visible = false;
        this.lastActiveTime = 0;
        this.lastTickTime = null;

        this.highlighted = null; 
    }
    
    createObject() {
        // To be implemented in subclasses
        throw new Error("createObject() must be implemented in subclass");
    }
    buildMaterials(materialsObj) {
        this.materials = materialsObj;
        Object.values(this.materials).forEach(mat => {
            //if (mat.uniforms?.uOpacity) mat.uniforms.uOpacity.value = 0.0;
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
    }

    updateColorSpace(colorSpace = "RGB") {
        this.colorSpace = colorSpace;
        if (this.materials[colorSpace] && this.object) {
            this.object.material = this.materials[colorSpace];
            this.object.material.needsUpdate = true;
        }
        this.activateFade();
    }
    activateFade() {
        this.visible = true;
        this.targetOpacity = 1.0;
        this.lastActiveTime = performance.now();
    }
    deactivateFade() {
        this.targetOpacity = 0.0;
    }
    setVisibility(visible) {
        visible ? this.activateFade() : this.deactivateFade();
    }
    tickFade() {
        if (!this.object) return;

        const now = performance.now();  
        this.lastTickTime ??= now;
        const delta = Math.min(32, now - this.lastTickTime);
        this.lastTickTime = now;
        
        if (this.visible && now - this.lastActiveTime > this.idleDelay) {
            this.deactivateFade();
        }

        const speed = this.targetOpacity > this.opacity ? (1 / this.fadeIn) : (1 / this.fadeOut);
        this.opacity += (this.targetOpacity - this.opacity) * speed * delta; 
        this.opacity = Math.max(0, Math.min(1, this.opacity));
        
        this.root.visible = this.opacity > 0.01;
        if (this.opacity < 0.01 && this.targetOpacity === 0.0) {
            this.visible = false;
        }
        this.root.traverse(obj => {
            const mat = obj.material;
            if (!mat) return;
            if (mat.uniforms?.uOpacity) mat.uniforms.uOpacity.value = this.opacity;
            else if (mat.opacity !== undefined) {
                mat.transparent = true;
                mat.opacity = this.opacity;
            }
        });
        this._tickHighlight();
    }
    _applyOpacity(alpha) {
        // Traverse all objects inside root and update material opacity
        this.root.traverse(obj => {
            const mat = obj.material;
            if (!mat) return;
            if (mat.uniforms?.uOpacity !== undefined) {
                mat.uniforms.uOpacity.value = alpha;
            } else if (mat.opacity !== undefined) {
                mat.transparent = true;
                mat.opacity = alpha;
            }
        });
    }
    // Both color space materials, not just the one on the mesh, so toggling keeps the same highlight state
    _eachHighlightUniforms(fn) {
        Object.values(this.materials).forEach(mat => {
            const u = mat.uniforms;
            if (u?.uHighlightDir && u.uHighlightStrength) fn(u);
        });
    }
    setHighlight(direction, strength = 1.0) {
        if (!direction) return;
        this.clearHighlight();
        
        const dir = direction.clone().normalize();
        this.highlighted = {dir, strength};

        this._eachHighlightUniforms(u => {
            u.uHighlightDir.value = dir;
            u.uHighlightStrength.value = strength;
        });

        this.activateFade();
    }

    clearHighlight() {
        this.highlighted = null;
        this._eachHighlightUniforms(u => { u.uHighlightStrength.value = 0.0; });
    }

    _tickHighlight() {
        if (!this.highlighted) return;

        this.highlighted.strength *= 0.85;
        this._eachHighlightUniforms(u => { u.uHighlightStrength.value = this.highlighted.strength; });

        if (this.highlighted.strength < 0.01) {
            this.clearHighlight();
        }
    }

    renderMiniObject(minDivisor = 16, maxDivisor = 25) {
        if (!this.visible) return;

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
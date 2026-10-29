import { createLayerFadeMaterial } from "../FaderTextures/layerMaterial.js";

export class MainBase {
    constructor(scene, cache, camera, onProgress, {
        size = 1,
        colorSpace = "RGB",
        startLayer = 127,
    } = {}) {

        // Core
        this.scene = scene;
        this.textureCache = cache;
        this.camera = camera;
        this.onProgress = onProgress;

        // State
        this.colorSpace = colorSpace;
        this.currentLayer = startLayer;
        this.size = size;
        this.object = null;
        this.ready = false;

        // Physics
        this.velX = 0;
        this.velY = 0;
        this.acc = 0.015;
        this.friction = 0.92;

        // Input
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        // Keyboard
        this.keys = { up: false, down: false, left: false, right: false };
        this.keyMap = {
            ArrowUp: "up",
            ArrowDown: "down",
            ArrowLeft: "left",
            ArrowRight: "right"
        };

        // Auto-rotation
        this.faceMap = {};              // 👈 subclass fills this
        this.faceQuaternions = [];      // 👈 subclass fills this
        this.targetQuat = new THREE.Quaternion();
        this.rotateStartQuat = new THREE.Quaternion();
        this.rotateDuration = 700;
        this.rotateTime = 0;
        this.isAutoRotating = false;

        // Layer animation
        this.layerFloat = this.currentLayer;
        this.layerTarget = this.currentLayer;
        this.layerSpeed = 0; // animated velocity
        this.layerLerpSpeed = 0.1;

        // Init
        this._initControls();
    }

    // -------- Abstract functions --------
    async initObject() {
        throw new Error("initObject() must be implemented by subclass");
    }

    async updateLayer(layer) {
        throw new Error("updateLayer must be implemented by subclass");
    }
    async switchColorSpace(colorSpace, duration = 500) {
        throw new Error("switchColorSpace must be implemented by subclass");
    }
    // -------- Controls --------
    _initControls() {
        const container = document.getElementById("ui-canvas");
        // Aborting removes every listener below (see dispose)
        this._controls = new AbortController();
        const { signal } = this._controls;

        container.addEventListener("mousedown", event => {
            this.isDragging = true;
            this.lastMouseX = event.clientX;
            this.lastMouseY = event.clientY;
        }, { signal });

        window.addEventListener("mouseup", () => { this.isDragging = false; }, { signal });

        window.addEventListener("mousemove", event => this._onMouseMove(event), { signal });
        window.addEventListener("keydown", event => this._onKeyDown(event), { signal });
        window.addEventListener("keyup", event => this._onKeyUp(event), { signal });
    }

    dispose() {
        this._controls?.abort();
        this.ready = false;
    }

    _onKeyDown(event) {
        // Arrow keys belong to the focused control (search box, sliders, selects), not the object
        if (event.target.closest?.("input, textarea, select")) return;
        const key = this.keyMap[event.key];
        if (key) this.keys[key] = true;
    }

    _onKeyUp(event) {
        const key = this.keyMap[event.key];
        if (key) this.keys[key] = false;
    }

    _onMouseMove(event) {
        if (!this.isDragging || !this.ready) return;

        const dx = event.clientX - this.lastMouseX;
        const dy = event.clientY - this.lastMouseY;

        this.velX -= dx * 0.002;
        this.velY += dy * 0.002;

        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
    }
    _updateAutoRotation() {
        const t = (performance.now() - this.rotateTime) / this.rotateDuration;
        if (t >= 1) {
            this.object.quaternion.copy(this.targetQuat);
            this.isAutoRotating = false;
        } else {
            const eased = 1 - Math.pow(1 - t, 3);
            this.object.quaternion.slerpQuaternions(this.rotateStartQuat, this.targetQuat, eased);
        }
    }
    // -------- Layer Blending --------
    async _updateInterpolatedLayer() {
        const z0 = Math.floor(this.layerFloat); // lower layer
        const t = this.layerFloat - z0;

        if (z0 === this.currentLayer && Math.abs(t - this._lastT) < 0.001) return;

        this.currentLayer = z0;

        const layerA = z0;
        this._lastT = t;

        await this.updateLayer(layerA + t);

    }
    // -------- Peeling (v1.4) --------
    // Jump straight to a layer with a peel (Color Golf strokes, a typed layer number). Going deeper,
    // a copy of the current shell lifts off (grows and fades) while the surface underneath is already
    // the new layer; coming back out, a copy showing the new layer settles down onto the surface.
    // One-step changes (scroll, ] and [) keep the smooth cross-fade through layerTarget instead.
    async peelTo(layer, duration = 650) {
        const from = Math.round(this.layerFloat);
        if (!this.object || !this._shellParts || layer === from) {
            this.layerTarget = layer;
            return;
        }
        this._peel?.finish(); // a new jump ends the one in progress
        const token = (this._peelToken = (this._peelToken ?? 0) + 1);
        const deeper = layer > from;
        const shellLayer = deeper ? from : layer;
        const [shellEntry] = await Promise.all([
            this.textureCache.getOrCreate(this.colorSpace, shellLayer, this.onProgress),
            this.textureCache.getOrCreate(this.colorSpace, layer, this.onProgress), // ready before the swap
        ]);
        if (token !== this._peelToken || !this.object) return; // superseded while loading

        const shell = new THREE.Group();
        shell.add(...this._shellParts(shellEntry.textures[this.colorSpace]));
        this.object.add(shell);
        const settle = async () => {
            this.layerFloat = this.layerTarget = layer;
            this._lastT = 0;
            await this.updateLayer(layer);
        };
        if (deeper) await settle(); // the new layer is underneath as the old shell lifts off

        const LIFT = 0.22;
        const start = performance.now();
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            shell.parent?.remove(shell);
            shell.traverse(part => part.material?.dispose()); // geometry is shared with the object
            if (!deeper) settle();
            if (this._peel?.finish === finish) this._peel = null;
        };
        this._peel = { finish };
        const step = () => {
            if (done) return;
            const t = Math.min(1, (performance.now() - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            const out = deeper ? eased : 1 - eased; // how far the shell is lifted off
            shell.scale.setScalar(1 + LIFT * out);
            shell.traverse(part => { if (part.material) part.material.uniforms.uOpacity.value = 1 - out; });
            if (t < 1) requestAnimationFrame(step);
            else finish();
        };
        step();
    }

    // A see-through copy of the surface's parts showing `textures`, for a peel (subclasses build the parts)
    _shellMaterial(texture) {
        const material = createLayerFadeMaterial(texture, texture, 0, 0.999);
        material.depthWrite = false;
        material.side = THREE.DoubleSide;
        return material;
    }

    // -------- Rotation --------
    rotateTo(faceIndex) {
        if (!this.faceQuaternions[faceIndex]) return;
        this.rotateToQuaternion(this.faceQuaternions[faceIndex]);
    }

    // Ease to any orientation (Color Golf turns the current color toward the camera)
    rotateToQuaternion(quaternion) {
        if (!this.object) return;
        this.velX = this.velY = 0;
        this.targetQuat.copy(quaternion);
        this.rotateStartQuat.copy(this.object.quaternion);
        this.rotateTime = performance.now();
        this.isAutoRotating = true;
    }

    // -------- Per-frame update --------
    update(delta = 1 / 60) {

        // keyboard input
        if (this.keys.up) this.velX -= this.acc;
        if (this.keys.down) this.velX += this.acc;
        if (this.keys.left) this.velY -= this.acc;
        if (this.keys.right) this.velY += this.acc;

        this.velX *= this.friction;
        this.velY *= this.friction;

        if (!this.ready || !this.object) return;

        // Layer animation
        if (this.layerFloat !== this.layerTarget) {
            const k = 1 - Math.exp(-this.layerLerpSpeed * delta * 60);
            this.layerFloat += (this.layerTarget - this.layerFloat) * k;

            if (Math.abs(this.layerTarget - this.layerFloat) < 0.001) {
                this.layerFloat = this.layerTarget;
            }
            this._updateInterpolatedLayer(this.layerFloat);
        }

        // Apply rotation
        this.object.rotation.x += this.velX;
        this.object.rotation.y += this.velY;

        // auto-rotation
        if (this.isAutoRotating) this._updateAutoRotation();
    }

    getRotation() {
        return this.object?.quaternion.clone();
    }

    resetObject(duration = 700) {
        if (!this.object) return;

        const startQuat = this.object.quaternion.clone();
        const targetQuat = new THREE.Quaternion();
        const startPos = this.camera.position.clone();
        const targetPos = new THREE.Vector3(0, 0, 3);
        const startTime = performance.now();

        const animate = () => {
            const t = Math.min((performance.now() - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            // Smoothly rotate main cube
            this.object.quaternion.slerpQuaternions(startQuat, targetQuat, eased);
            // Smoothly move camera
            this.camera.position.lerpVectors(startPos, targetPos, eased);

            if (t < 1) requestAnimationFrame(animate);
            else this.velX = this.velY = 0;
        };
        animate();
    }
}
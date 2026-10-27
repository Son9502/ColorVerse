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
    // -------- Rotation --------
    rotateTo(faceIndex) {
        if (!this.faceQuaternions[faceIndex] || !this.object) return;

        this.targetQuat.copy(this.faceQuaternions[faceIndex]);
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
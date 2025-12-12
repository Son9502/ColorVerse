export class MainSphere {
    constructor(scene, textureCache, camera, onProgress) {
        this.scene = scene;
        this.textureCache = textureCache; // unified cache
        this.camera = camera;

        // Cube parameters
        this.colorSpace = 'RGB';
        this.currentLayer = 127;
        this.size = 1;

        this.object = null;

        this.velX = 0;
        this.velY = 0;
        this.acc = 0.015;
        this.friction = 0.92;

        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        this.faceQuaternion = new THREE.Quaternion();

        this.targetQuat = new THREE.Quaternion();
        this.rotateStartQuat = new THREE.Quaternion();
        this.rotateDuration = 700;
        this.rotateTime = 0;
        this.isAutoRotating = false;

        this.keys = { up: false, down: false, left: false, right: false };
        this.keyMap = { "ArrowUp": "up", "ArrowDown": "down", "ArrowLeft": "left", "ArrowRight": "right" };

        this.onProgress = onProgress; //Remember to implement 

        this._initObject(); // initialize object
        this._initControls();   // mouse/keyboard
    }
    async _initObject() {
        const geometry = new THREE.SphereGeometry(this.size, 64, 64); // radius, widthSegments, heightSegments
        const material = new THREE.MeshBasicMaterial({ color: 0x7f7f7f });
        this.object = new THREE.Mesh(geometry, material);
        this.object = new THREE.SphereGeometry();
        this.scene.add(this.object);
    }
    _initControls() {
        const container = document.getElementById("ui-canvas");

        container.addEventListener("mousedown", e => {
            this.isDragging = true;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
        });

        // keyboard bindings

        window.addEventListener("keydown", e => this._onKeyDown(e));
        window.addEventListener("keyup", e => this._onKeyUp(e));

        // mouse controls
        window.addEventListener("mouseup", () => { this.isDragging = false; });
        window.addEventListener("mousemove", e => this._onMouseMove(e));
    }

    _onKeyDown(event) { if (this.keys[this.keyMap[event.key]] !== undefined) this.keys[this.keyMap[event.key]] = true; }
    _onKeyUp(event) { if (this.keys[this.keyMap[event.key]] !== undefined) this.keys[this.keyMap[event.key]] = false; }

    _onMouseMove(event) {
        if (!this.isDragging) return;

        const dx = event.clientX - this.lastMouseX;
        const dy = event.clientY - this.lastMouseY;

        this.velX -= dx * 0.002;
        this.velY += dy * 0.002;

        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
    }
    update() {
        // --- Keyboard rotation ---
        if (this.keys.up) this.velX -= this.acc;
        if (this.keys.down) this.velX += this.acc;
        if (this.keys.left) this.velY -= this.acc;
        if (this.keys.right) this.velY += this.acc;

        this.velX *= this.friction;
        this.velY *= this.friction;

        this.object.rotation.x += this.velX;
        this.object.rotation.y += this.velY;

        //if (this.previewCube && this.previewCube.object) this.previewCube.object.rotation.copy(this.object.rotation);

        // --- Auto-rotation ---
        if (this.isAutoRotating) {
            const elapsed = performance.now() - this.rotateTime;
            const t = elapsed / this.rotateDuration;

            if (t >= 1) {
                this.object.quaternion.copy(this.targetQuat);
                this.isAutoRotating = false;
            } else {
                const easedT = 1 - Math.pow(1 - t, 3);
                this.object.quaternion.slerpQuaternions(this.rotateStartQuat, this.targetQuat, easedT);
                //if (this.previewCube && this.previewCube.object) this.previewCube.object.quaternion.slerpQuaternions(this.rotateStartQuat, this.targetQuat, easedT);
            }
        }
    }
}
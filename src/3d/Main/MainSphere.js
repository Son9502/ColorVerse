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
        this._initFaceQuaternions();
    }
    async _initObject() {
        const entry = await this.textureCache.get(this.colorSpace, this.currentLayer, this.onProgress);
        //console.log("MainSphere texture entry:", entry);
        const geometry = new THREE.SphereGeometry(this.size, 64, 64); // radius, widthSegments, heightSegments
        const texture = entry.textures[0];
        texture.colorSpace = THREE.SRGBColorSpace; // Ensure correct color space
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.DoubleSide,
            toneMapped: false
        });
        material.userData.originalCanvas = entry.textures[0].userData.originalCanvas;

        this.object = new THREE.Mesh(geometry, material);
        this.scene.add(this.object);
    }
    // --------------------------
    // Face positions
    // --------------------------
    _initFaceQuaternions() {
        this.faceQuaternions = [
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0)), // +X
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI / 2, 0)), // -X
            new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), // +Y
            new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), // -Y
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)),            // +Z (front)
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0)),      // -Z (back)
            new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), // North pole
            new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0))  // South pole
        ];
    }

    // --------------------------
    // Update a sphere layer
    // --------------------------
    async updateLayer(layer) {
        const entry = await this.textureCache.get(this.colorSpace, layer, this.onProgress);

        const newTexture = entry.textures[0];
        newTexture.colorSpace = THREE.SRGBColorSpace; // Ensure correct color space
        newTexture.needsUpdate = true;

        this.object.material.map = newTexture;
        this.object.material.needsUpdate = true;
        this.object.material.userData.originalCanvas = entry.textures[0].userData.originalCanvas;

        this.currentLayer = layer;
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
    rotateTo(faceIndex) {
        this.targetQuat.copy(this.faceQuaternions[faceIndex]);
        this.rotateStartQuat.copy(this.object.quaternion);
        this.rotateTime = performance.now();
        this.isAutoRotating = true;
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
            }
        }
    }
    getRotation() {
        return this.object.quaternion.clone();
    }
    resetObject(duration = 700) {
        const startQuat = this.object.quaternion.clone();
        const targetQuat = new THREE.Quaternion(); // identity
        const startPos = this.camera.position.clone();
        const targetPos = new THREE.Vector3(0, 0, 3);
        const startTime = performance.now();

        const animateReset = () => {
            const elapsed = performance.now() - startTime;
            const t = Math.min(elapsed / duration, 1);
            const easedT = 1 - Math.pow(1 - t, 3); // ease out cubic

            // Smoothly rotate main cube
            this.object.quaternion.slerpQuaternions(startQuat, targetQuat, easedT);

            // Smoothly move camera
            this.camera.position.lerpVectors(startPos, targetPos, easedT);

            if (t < 1) {
                requestAnimationFrame(animateReset);
            } else {
                this.velX = 0;
                this.velY = 0;
            }
        };
        animateReset();
    }
}
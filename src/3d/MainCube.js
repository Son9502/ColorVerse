export class MainCube {
    constructor(scene, textureCache, camera, onProgress) {
        this.scene = scene;
        this.textureCache = textureCache; // unified cache
        this.camera = camera;

        // Cube parameters
        this.colorSpace = 'RGB';
        this.currentLayer = 127;
        this.size = 1;

        this.object = null;
        this.cubeSides = [];

        this.velX = 0;
        this.velY = 0;
        this.acc = 0.015;
        this.friction = 0.92;

        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        this.onProgress = onProgress;

        this.faceQuaternions = [
            new THREE.Quaternion(),                                    // front
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI / 2, 0)), // right
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0)),    // back
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0)),  // left
            new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)),  // top
            new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), // bottom
        ];

        this.targetQuat = new THREE.Quaternion();
        this.rotateStartQuat = new THREE.Quaternion();
        this.rotateDuration = 700;
        this.rotateTime = 0;
        this.isAutoRotating = false;

        this.keys = { up: false, down: false, left: false, right: false };
        this.keyMap = {"ArrowUp": "up", "ArrowDown": "down", "ArrowLeft": "left", "ArrowRight": "right"};

        this._initObject(); // initialize object
        this._initControls();   // mouse/keyboard
    }

    // --------------------------
    // Cube creation
    // --------------------------

    async _initObject() {
        const entry = await this.textureCache.get(this.colorSpace, this.currentLayer, this.onProgress);
        const positions = this._facePositions();

        this.object = new THREE.Group();

        for (let i = 0; i < 6; i++) {
            const geometry = new THREE.PlaneGeometry(this.size, this.size);

            const material = new THREE.MeshBasicMaterial({
                map: entry.textures[i],
                side: THREE.DoubleSide
            });

            material.userData.originalCanvas = entry.textures[i].userData.originalCanvas;

            const plane = new THREE.Mesh(geometry, material);

            plane.position.set(...positions[i].pos);
            plane.rotation.set(...positions[i].rot);

            this.object.add(plane);
            this.cubeSides.push({ plane, ogColors: entry.textureData[i] });
        }

        this.scene.add(this.object);
    }
    // --------------------------
    // Face positions
    // --------------------------
    _facePositions() {
        const s = this.size;
        return [
            { pos: [0, 0, s / 2], rot: [0, 0, 0] },
            { pos: [s / 2, 0, 0], rot: [0, Math.PI / 2, 0] },
            { pos: [0, 0, -s / 2], rot: [0, Math.PI, 0] },
            { pos: [-s / 2, 0, 0], rot: [0, -Math.PI / 2, 0] },
            { pos: [0, s / 2, 0], rot: [-Math.PI / 2, 0, 0] },
            { pos: [0, -s / 2, 0], rot: [Math.PI / 2, 0, 0] },
        ];
    }

    // --------------------------
    // Update a cube layer
    // --------------------------
    async updateLayer(layer) {
        const entry = await this.textureCache.get(this.colorSpace, layer, this.onProgress);

        this.cubeSides.forEach((side, i) => {
            // Replace Texture 
            if (side.plane.material.map) side.plane.material.map.dispose();

            side.plane.material.map = entry.textures[i];
            side.plane.material.map.needsUpdate = true;
            side.plane.material.userData.originalCanvas = entry.textures[i].userData.originalCanvas;
            // Reset Geometry
            side.plane.geometry.dispose();
            side.plane.geometry = new THREE.PlaneGeometry(this.size, this.size);

            side.ogColors = entry.textureData[i];
        });

        this.currentLayer = layer;
    }
    // --------------------------
    // Controls Init
    // --------------------------
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

    // --------------------------
    // Auto-rotate to a face
    // --------------------------
    rotateTo(faceIndex) {
        this.targetQuat.copy(this.faceQuaternions[faceIndex]);
        this.rotateStartQuat.copy(this.object.quaternion);
        this.rotateTime = performance.now();
        this.isAutoRotating = true;
    }

    // --------------------------
    // Update per-frame
    // --------------------------
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
    // --------------------------
    // Optional: external controls
    // --------------------------
    /*
    setupControls(previewCube) {
        this.previewCube = previewCube;
    }*/
}

// Cube simulator 
import { setBaseColors, resetColors } from "./src/harmony.js";
import { colorTexture } from "./src/color-texture.js";
// Pre-generate texture caches for performance
const textureCaches = { RGB: {}, HSL: {} };

function textCaches() {
    ['RGB', 'HSL'].forEach(colorSpace => {
        for (let layer = 0; layer <= 127; layer++) {
            const { canvases, textureData } = colorTexture(layer, colorSpace);
            const textures = canvases.map(canvas => {
                const texture = new THREE.CanvasTexture(canvas);
                if (!texture.userData) texture.userData = {};

                const originalCanvas = document.createElement('canvas');
                originalCanvas.width = canvas.width;
                originalCanvas.height = canvas.height;
                originalCanvas.getContext('2d').drawImage(canvas, 0, 0);
                texture.userData.originalCanvas = originalCanvas;
                return texture;
            });
            textureCaches[colorSpace][layer] = { textures, textureData };
        }
    });
}
textCaches();
export const create3DEnvironment = () => {
    //----------------------------------
    // Camera + Scene 
    //----------------------------------
    const fieldOfView = 75;
    const aspect = 2;
    const near = 0.1;
    const far = 5;

    const camera = new THREE.PerspectiveCamera(fieldOfView, aspect, near, far);
    camera.position.z = 3;

    const scene = new THREE.Scene();
    let colorSpace = 'RGB';
    let currentLayer = 127;
    let segments = 4;
    const size = 1;

    // ----------------------------------
    // Renderer Setup
    //----------------------------------

    const container = document.getElementById("ui-canvas")
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    Object.assign(renderer.domElement.style, { position: "absolute", right: "0", top: "0" });

    // Function to fit renderer to container size
    function fitRendererToContainer() {
        const width = container.clientWidth;
        const height = container.clientHeight;
        renderer.setSize(width, height);
        if (camera) {
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        }
    }

    fitRendererToContainer();
    window.addEventListener("resize", fitRendererToContainer);

    //----------------------------------
    //Object Creation and Design
    //----------------------------------

    // Define positions and rotations for each cube face
    const positions = [
        // Front (+Z) No Rotation
        { pos: [0, 0, size / 2], rot: [0, 0, 0] },
        // Right (+X) // Rotate 90º around the Y axis
        { pos: [size / 2, 0, 0], rot: [0, Math.PI / 2, 0] },
        // Back (-Z) // Rotate 180º around the Y axis
        { pos: [0, 0, -size / 2], rot: [0, Math.PI, 0] },
        // Left (-X) // Rotate -90º around the Y axis
        { pos: [-size / 2, 0, 0], rot: [0, -Math.PI / 2, 0] },
        // Top (+Y) // Rotate -90º around the X axis
        { pos: [0, size / 2, 0], rot: [-Math.PI / 2, 0, 0] },
        // Bottom (-Y) // Rotate 90º around the X axis
        { pos: [0, -size / 2, 0], rot: [Math.PI / 2, 0, 0] },
    ];

    // Initialize cube variables
    let cubeGroup, cubeSides = [];

    function createCube() {
        cubeGroup = new THREE.Group();

        const { textures, textureData } = textureCaches[colorSpace][currentLayer];

        for (let i = 0; i < 6; i++) {
            // Get canvas for this face
            const canvasTexture = textures[i];

            // Create geometry and material
            const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
            const material = new THREE.MeshBasicMaterial({
                map: canvasTexture,
                side: THREE.DoubleSide
            });
            material.userData.originalCanvas = canvasTexture.userData.originalCanvas;

            // Create plane mesh
            const plane = new THREE.Mesh(geometry, material);
            plane.position.set(...positions[i].pos);
            plane.rotation.set(...positions[i].rot);

            // Add plane to group and sides array
            cubeGroup.add(plane);
            cubeSides.push({ plane: plane, ogColors: textureData[i] });

        }
        scene.add(cubeGroup);
    }
    createCube();
    function updateCubeLayer(layer) {
        // Update each side's geometry with new segments
        const { textures, textureData } = textureCaches[colorSpace][layer];
        cubeSides.forEach((side, i) => {
            if (side.plane.material.map) side.plane.material.map.dispose();

            const texture = textures[i];
            side.plane.material.map = texture;
            side.plane.material.userData.originalCanvas = texture.userData.originalCanvas;
            side.plane.material.map.needsUpdate = true;


            if (side.plane.geometry) side.plane.geometry.dispose();
            side.plane.geometry = new THREE.PlaneGeometry(size, size, segments, segments);

            side.ogColors = textureData[i];
        });
    }

    // ----------------------------------
    // Layer Control
    // ----------------------------------

    // Enter layer number to adjust segments
    const threeDText = document.getElementById("3dtext");
    const canvasText = document.getElementById("ui-canvas-text");

    // Preview cube for layer selection
    let previewCube = null;

    function createPreviewCube(layer, toggle = false) {
        const nextSpace = toggle ? (colorSpace === 'RGB' ? 'HSL' : 'RGB') : colorSpace;
        if (previewCube) {
            scene.remove(previewCube);
            previewCube = null;
        }

        const { textures } = textureCaches[nextSpace][layer];
        const group = new THREE.Group();


        for (let i = 0; i < 6; i++) {
            const geometry = new THREE.PlaneGeometry(size * 1.5, size * 1.5, segments, segments);
            const material = new THREE.MeshBasicMaterial({
                map: textures[i],
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.25
            });
            const plane = new THREE.Mesh(geometry, material);
            plane.position.set(...positions[i].pos.map(v => v * 1.5));
            plane.rotation.set(...positions[i].rot);
            group.add(plane);
        }
        group.position.copy(cubeGroup.position);
        group.rotation.copy(cubeGroup.rotation);
        previewCube = group;
        scene.add(previewCube);
    }

    function validLayer(input) {
        return Number.isInteger(input) && input >= 0 && input <= 127;
    }

    // Live preview on input
    threeDText.addEventListener("input", () => {
        let layerNum = parseInt(threeDText.value);
        if (!validLayer(layerNum) || layerNum === currentLayer) {
            if (previewCube) {
                scene.remove(previewCube);
                previewCube = null;
            }
            return;
        }
        createPreviewCube(layerNum);
    });

    // Confirm layer on Enter, reset on Escape
    threeDText.addEventListener("keydown", (event) => {
        if (getComputedStyle(threeDText).display === "none") return;
        if (event.key === "Escape") {
            threeDText.value = "";
            if (previewCube) {
                scene.remove(previewCube);
                previewCube = null;
            }
            return;
        }
        else if (event.key != "Enter") return;

        const layerNum = parseInt(threeDText.value);
        // Validate layer number input
        if (!validLayer(layerNum)) {
            alert("Please enter a valid layer number between 0 and 127.");
            return;
        }
        if (previewCube) {
            scene.remove(previewCube);
            previewCube = null;
        }
        currentLayer = layerNum;
        canvasText.textContent = `Layer ${currentLayer}`;
        updateCubeLayer(currentLayer);
    });

    // ----------------------------------
    // Toggle Color Space
    // ----------------------------------
    const toggleColorSpace = document.getElementById("toggle");

    toggleColorSpace.addEventListener("click", () => {
        colorSpace = (colorSpace === "RGB") ? "HSL" : "RGB";

        updateCubeLayer(currentLayer);
        miniCube.updateLabels();
        miniCube.applyColorspaceTheme();

        // Update preview cube if it exists
        if (validLayer(parseInt(threeDText.value))) {
            createPreviewCube(parseInt(threeDText.value));
        }
    });

    toggleColorSpace.addEventListener("mouseover", () => {
        if (validLayer(currentLayer)) {
            createPreviewCube(currentLayer, true); // toggleSpace = true
        }
    });
    toggleColorSpace.addEventListener("mouseout", () => {
        if (previewCube) {
            scene.remove(previewCube);
            previewCube = null;
        }
    });

    // ----------------------------------
    // Mini Axis Cube
    // ----------------------------------

    // Mini renderer class for axis cube
    class miniAxisRenderer {
        constructor(renderer) {
            this.renderer = renderer;

            // Mini scene and camera
            this.scene = new THREE.Scene();
            this.camera = new THREE.PerspectiveCamera(60, 1, 0.01, 100);
            /*this.camera.position.set(1.5, 1.5, 1.5);*/
            this.camera.lookAt(0, 0, 0);

            // Mini cube size and axis length
            this.cubeSize = 2;
            this.axisLength = this.cubeSize * 1.5;

            // Mini cube geometry and materials
            const miniGeometry = new THREE.BoxGeometry(this.cubeSize, this.cubeSize, this.cubeSize);

            // Create colored faces with labels
            const miniMaterials = [
                this.makeFace(0xff0000, "R"), // Right - Red
                this.makeFace(0x00ff00, "L"), // Left - Green
                this.makeFace(0x0000ff, "T"), // Top - Blue
                this.makeFace(0xffff00, "Bo"), // Bottom - Yellow
                this.makeFace(0xff00ff, "F"), // Front - Magenta
                this.makeFace(0x00ffff, "Ba"), // Back - Cyan
            ];
            miniMaterials.forEach(mat => {
                mat.opacity = 0.9;
                mat.transparent = true;
            });
            this.axesCube = new THREE.Mesh(miniGeometry, miniMaterials);
            this.scene.add(this.axesCube);

            // Outline for mini cube
            const edges = new THREE.EdgesGeometry(miniGeometry);
            const outline = new THREE.LineSegments(
                edges, new THREE.LineBasicMaterial({ color: 0x000000 })
            );
            this.axesCube.add(outline);

            // Axes helper with arrows 
            this.axesHelper = new THREE.Group();
            this.scene.add(this.axesHelper);
            this.makeAxis(this.axesHelper, this.axisLength, 1, 0, 0, 0xff0000);   // X axis
            this.makeAxis(this.axesHelper, this.axisLength, 0, 1, 0, 0x00ff00); // Y axis
            this.makeAxis(this.axesHelper, this.axisLength, 0, 0, 1, 0x0000ff);  // Z axis


            // Label group
            this.labelGroup = new THREE.Group();
            this.scene.add(this.labelGroup);
            /*this.axesCube.add(this.labelGroup);*/
            this.updateLabels(150);
        }
        // Create an axis arrow
        makeAxis(group, len, x, y, z, color) {
            const direction = new THREE.Vector3(x, y, z).normalize();
            const origin = new THREE.Vector3(0, 0, 0);
            const arrow = new THREE.ArrowHelper(direction, origin, len, color, 0.1 * len, 0.05 * len);
            group.add(arrow);
        }
        // Create a colored face with text
        makeFace(colorHex, text) {
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
        // Add a label at specified position
        addLabel(text, color, x, y, z, viewportSize) {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            canvas.width = canvas.height = 512;

            const baseFontSize = 140;
            const fontSize = Math.max(20, baseFontSize * (viewportSize / 150));
            ctx.font = `bold ${fontSize}px Arial`;
            ctx.fillStyle = color;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(text, canvas.width / 2, canvas.height / 2);

            const texture = new THREE.CanvasTexture(canvas);
            texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;

            const material = new THREE.SpriteMaterial({
                map: texture, transparent: true
            });
            const sprite = new THREE.Sprite(material);

            const baseScale = 0.5;
            const spriteScale = baseScale * (viewportSize / 150);
            sprite.scale.set(spriteScale, spriteScale, spriteScale);

            const offsetFactor = 0.2;
            sprite.position.set(x * (1 + offsetFactor), y * (1 + offsetFactor), z * (1 + offsetFactor));

            this.labelGroup.add(sprite);
        }
        // Update labels based on color space
        updateLabels(viewportSize = 150) {
            while (this.labelGroup.children.length > 0) {
                this.labelGroup.remove(this.labelGroup.children[0]);
            }
            const xLabel = (colorSpace === 'RGB') ? "R" : "H";
            const yLabel = (colorSpace === 'RGB') ? "G" : "S";
            const zLabel = (colorSpace === 'RGB') ? "B" : "L";

            this.addLabel(xLabel, "red", this.axisLength, 0, 0, viewportSize);
            this.addLabel(yLabel, "green", 0, this.axisLength, 0, viewportSize);
            this.addLabel(zLabel, "blue", 0, 0, this.axisLength, viewportSize);
        }
        // Update rotation of mini cube and axes helper
        updateRotation(mainRotation) {
            this.axesCube.rotation.copy(mainRotation);
            this.axesHelper.rotation.copy(mainRotation);
            this.labelGroup.children.forEach(label => {
                label.quaternion.copy(this.camera.quaternion);
            });
        }
        // Compute camera distance for mini cube
        computeCamDistance(viewportSize) {
            const halfFov = THREE.MathUtils.degToRad(this.camera.fov / 2);
            const maxDim = this.cubeSize * Math.sqrt(3) / 2;
            return (maxDim) / Math.tan(halfFov);
        }
        // Apply color space theme to mini cube
        applyColorspaceTheme() {
            // Future implementation for theming based on color space
            if (colorSpace === 'RGB') {
                this.axesCube.material[0].color.set(0xff0000); // Red
                this.axesCube.material[1].color.set(0x00ff00); // Green
                this.axesCube.material[2].color.set(0x0000ff); // Blue
            } else {
                this.axesCube.material[0].color.set(0xff8800); // Yellow
                this.axesCube.material[1].color.set(0xffffff * 0.7); // Magenta
                this.axesCube.material[2].color.set(0xdddddd); // Cyan
            }
        }
        // Render mini cube in corner
        renderMiniCube(minDivisor = 16, maxDivisor = 25, offset = 20, padding = 10) {
            const r = this.renderer;
            const full = r.getSize(new THREE.Vector2());


            let size = Math.min(full.x, full.y) / minDivisor;
            const minSize = Math.min(full.x, full.y) / maxDivisor;
            size = Math.max(size, minSize);

            const x = full.x - size - offset - padding;
            const y = offset + padding;

            //adjust camera distance based on size
            const camDist = this.computeCamDistance(size);
            this.camera.position.set(camDist, camDist, camDist);
            this.camera.lookAt(0, 0, 0);

            this.updateLabels(size);
            this.applyColorspaceTheme();

            // Set viewport and scissor for mini cube
            r.setScissorTest(true);
            r.setViewport(x, y, size, size);
            r.setScissor(x, y, size, size);

            r.clearDepth();
            this.camera.lookAt(0, 0, 0);
            r.render(this.scene, this.camera);

            r.setViewport(0, 0, full.x, full.y);
            r.setScissorTest(false);
        }
    }
    const miniCube = new miniAxisRenderer(renderer);

    //----------------------------------
    //Object-Click Detection 
    //----------------------------------

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const infoBox = document.querySelectorAll(".color-info");
    const infoSearch = document.getElementById("color-search");
    const colorName = document.getElementById("color-name");
    const baseCircle = document.getElementById("base-circle");
    const colortext = document.getElementById("color-text");
    const ghosttext = document.getElementById("ghost-text");
    const dropdown = document.getElementById("autocomplete");

    // Handle click events
    renderer.domElement.addEventListener("click", (event) => {
        const rect = renderer.domElement.getBoundingClientRect();

        // Calculate mouse position in normalized device coordinates
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        // Calculate objects intersecting the picking ray
        const intersects = raycaster.intersectObjects(cubeSides.map(side => side.plane), false);
        if (intersects.length == 0) {
            infoBox.forEach(box => { box.classList.remove("show"); });
            infoSearch && (infoSearch.style.display = "flex");
            baseCircle && (baseCircle.style.backgroundColor = `hsl(0,0%,0%,0)`);
            resetColors();
            if (colorName) colorName.textContent = "";
            return;
        }
        // Get the first intersected object
        const hit = intersects[0];
        const plane = hit.object;
        const side = cubeSides.find(side => side.plane === plane);
        if (!side) return;

        const canvas = plane.material.map.image;
        const context = canvas.getContext('2d');

        // Determine which face was clicked based on UV coordinates
        const uv = hit.uv;
        const xPos = Math.floor(uv.x * canvas.width);
        const yPos = Math.floor((1 - uv.y) * canvas.height);

        // Calculate vertex indices for the clicked face
        const pixel = context.getImageData(xPos, yPos, 1, 1).data;
        const pixelR = pixel[0] / 255;
        const pixelG = pixel[1] / 255;
        const pixelB = pixel[2] / 255;

        const clickedColor = new THREE.Color(pixelR, pixelG, pixelB);

        // Update info box with color information
        colortext.value = "";
        ghosttext.value = "";
        dropdown.innerHTML = "";

        // Show info box and hide search box
        infoBox.forEach(box => { box.classList.add("show"); });
        if (infoSearch) infoSearch.style.display = "none";
        baseCircle.style.backgroundColor = `#${clickedColor.getHexString()}`;
        if (colorName) colorName.textContent = "";
        setBaseColors(clickedColor);

        // Restore original colors after a short highlight
        context.fillStyle = "white";
        context.fillRect(xPos, yPos, 1, 1);
        plane.material.map.needsUpdate = true;

        setTimeout(() => {
            const orig = plane.material.userData.originalCanvas;
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(orig, 0, 0);
            plane.material.map.needsUpdate = true;
        }, 300);
    });

    // ----------------------------------
    // Keyboard control state
    // ----------------------------------
    const keys = {
        up: false,
        down: false,
        left: false,
        right: false,
    };
    // Map number keys to cube faces
    const faceMap = {
        "1": 0, // Front
        "2": 1, // Right
        "3": 2, // Back
        "4": 3, // Left
        "5": 4, // Top
        "6": 5, // Bottom
    }
    const faceQuaternions = [
        new THREE.Quaternion(), // Front
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI / 2, 0)), // Right
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0)), // Back
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0)), // Left
        new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), // Top
        new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), // Bottom
    ];
    // Simplifies mapping 
    const keyMap = {
        "ArrowUp": "up",
        "ArrowDown": "down",
        "ArrowLeft": "left",
        "ArrowRight": "right",
    }

    let velX = 0; // rotation velocity around X axis
    let velY = 0; // rotation velocity around Y axis

    const acc = 0.015;  // how fast it speeds up
    const friction = 0.92; // how fast it slows down

    let targetQuat = new THREE.Quaternion(); // target quaternion for auto-rotation
    let isAutoRotating = false; // flag for auto-rotation state
    let rotateStartQuat = new THREE.Quaternion(); // starting quaternion for auto-rotation
    let rotateTime = 0; // time elapsed for auto-rotation
    const rotateDuration = 700; // duration of auto-rotation in milliseconds

    function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    // ----------------------------------
    // Keyboard Events
    // ----------------------------------


    window.addEventListener("keydown", (event) => {
        const activeEl = document.activeElement;
        const isTyping = activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable;
        if (keyMap[event.key]) keys[keyMap[event.key]] = true;
        else if (!isTyping && faceMap[event.key] !== undefined) {
            rotateCubeTo(faceMap[event.key]);
        }
    });
    window.addEventListener("keyup", (event) => {
        if (keyMap[event.key]) keys[keyMap[event.key]] = false;
    });

    // ----------------------------------
    // Mouse movement
    // ----------------------------------

    let isDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;
    // ----------------------------------
    // -- Wheel scroll to zoom ------
    // ----------------------------------
    container.addEventListener("wheel", (event) => {
        event.preventDefault();

        const zoomSpeed = 0.3;

        // Zoom in
        if (event.deltaY < 0) {
            camera.position.z -= zoomSpeed;
        }
        // Zoom out 
        else {
            camera.position.z += zoomSpeed;
        }

        camera.position.z = Math.max(1, Math.min(20, camera.position.z));
    })

    container.addEventListener("dblclick", () => {
        camera.position.set(0, 0, 3);
        velX = 0;
        velY = 0;
        cubeGroup.rotation.x = 0;
        cubeGroup.rotation.y = 0;
        if (previewCube) {
            previewCube.rotation.x = 0;
            previewCube.rotation.y = 0;
        }
        rotateCubeTo(faceMap[0]);
    });

    container.addEventListener("mousedown", (event) => {
        isDragging = true;
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
    });

    window.addEventListener("mouseup", (event) => {
        isDragging = false;
    });

    window.addEventListener("mousemove", (event) => {
        if (!isDragging) return;

        const deltaX = event.clientX - lastMouseX;
        const deltaY = event.clientY - lastMouseY;

        if (isDragging) {
            velX -= deltaX * 0.002;
            velY += deltaY * 0.002;
        }

        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
    });

    function rotateCubeTo(index) {
        targetQuat.copy(faceQuaternions[index]);
        rotateStartQuat.copy(cubeGroup.quaternion);
        rotateTime = performance.now();
        isAutoRotating = true;
    }

    const update = () => {

        if (keys.up) velX -= acc;
        if (keys.down) velX += acc;
        if (keys.left) velY -= acc;
        if (keys.right) velY += acc;

        velX *= friction;
        velY *= friction;

        cubeGroup.rotation.x += velX;
        cubeGroup.rotation.y += velY;

        if (previewCube) previewCube.rotation.copy(cubeGroup.rotation);

        if (isAutoRotating) {
            const elapsed = performance.now() - rotateTime;
            const t = elapsed / rotateDuration;
            if (t >= 1) {
                cubeGroup.quaternion.copy(targetQuat);
                isAutoRotating = false;
            } else {
                const easedT = easeOutCubic(t);
                THREE.Quaternion.slerp(rotateStartQuat, targetQuat, cubeGroup.quaternion, easedT);
                if (previewCube) THREE.Quaternion.slerp(rotateStartQuat, targetQuat, previewCube.quaternion, easedT);
            }


        }

        renderer.clear();
        renderer.render(scene, camera);

        miniCube.updateRotation(cubeGroup.rotation);
        miniCube.renderMiniCube();
        // Render mini scene in corner

        requestAnimationFrame(update);
    };

    update();
};

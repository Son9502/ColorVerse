import { MiniCube } from './3d/Mini/MiniCube.js';
import { MiniSphere } from './3d/Mini/MiniSphere.js';
import { MainCube } from './3d/Main/MainCube.js';
import { MainSphere } from './3d/Main/MainSphere.js';
import { setBaseColors, resetColors } from './harmony.js';
import { LoaderManager } from './LoaderManager.js';
import { getCaches } from './3d/TextureRegistry.js';
import { getSharedRenderer, resizeSharedRenderer } from './3d/sharedRenderer.js';

export const create3DEnvironment = async (objectType = "cube") => {
    // --- Loading Elements ---
    const loader = new LoaderManager();
    loader.show("Initializing 3D Engine...");


    // --- Renderer + Scene ---
    const container = document.getElementById("ui-canvas");
    const { renderer, camera } = getSharedRenderer(container);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    resizeSharedRenderer(container);

    // --- Responsive Renderer ---
    window.addEventListener("resize", () => resizeSharedRenderer(container));

    const scene = new THREE.Scene();

    // --- Texture caches ---
    const caches = getCaches(objectType); // [0] = textureCache, [1] = shaderCache

    // --- Preload Textures ---
    loader.show("Preparing textures...");
    await caches[0].preload((loaded, total, current, progress, totalProgress) => {
        loader.handleLayerProgress(loaded, total, current, progress, totalProgress);
    });
    //console.log("Texture caches after preload:", [...caches[0].cache.keys()]);

    // --- Main,Preview and Mini 3D Object ---
    let mainObject, previewObject, miniObject;
    switch (objectType) {
        case "cube":
            loader.setMessage("Creating Cube...");
            mainObject = new MainCube(scene, caches[0], camera, (loaded, total) => {
                loader.handleProgress(loaded, total);
            });
            loader.setMessage("Setting up MiniObject for Cube...");
            miniObject = new MiniCube(renderer);
            break;
        case "sphere":
            loader.setMessage("Creating Sphere...");
            mainObject = new MainSphere(scene, caches[0], camera, (loaded, total) => {
                loader.handleProgress(loaded, total);
            });
            loader.setMessage("Setting up MiniObject for Sphere...");
            miniObject = new MiniSphere(renderer);
            break;
        default:
            throw new Error(`Unknown objectType: ${objectType}`);
    }

    await mainObject.initObject();

    if (!previewObject) {
        switch (objectType) {
            case "cube": {
                const { PreviewCube } = await import('./3d/Preview/PreviewCube.js');
                previewObject = new PreviewCube(caches[0]);
                break;
            }
            case "sphere": {
                const { PreviewSphere } = await import('./3d/Preview/PreviewSphere.js');
                previewObject = new PreviewSphere(caches[0]);
                break;
            }
        }
    }
    previewObject.setupControls(mainObject);

    // --- UI Elements ---
    const toggleColorSpace = document.getElementById("toggle");
    let colorSpace = toggleColorSpace.checked ? "HSL" : "RGB";

    const threeDText = document.getElementById("3dtext");
    const canvasText = document.getElementById("ui-canvas-text");

    let currentLayer = 127;
    threeDText.value = "";

    // --- Layer Input Logic ---
    const validLayer = (input) => Number.isInteger(input) && input >= 0 && input <= 127;

    // --- Preview Object Helper ---
    const createPreview = async (layerNum, newColorSpace = colorSpace) => {
        if (!previewObject) return;
        previewObject.hide();
        await previewObject.show(scene, layerNum, newColorSpace);
    };
    // --- Layer Input Handling ---
    let previewRAF = null;
    threeDText.addEventListener("input", () => {
        cancelAnimationFrame(previewRAF);
        previewRAF = requestAnimationFrame(async () => {
            const layerNum = parseInt(threeDText.value);
            if (!validLayer(layerNum) || layerNum === currentLayer) {
                previewObject?.hide();
                return;
            }
            await createPreview(layerNum);
        });
    });

    threeDText.addEventListener("keydown", async (event) => {
        if (event.key === "Escape") {
            threeDText.value = "";
            previewObject?.hide();
            return;
        }
        if (event.key !== "Enter") return;

        const layerNum = parseInt(threeDText.value);
        if (!validLayer(layerNum)) {
            alert("Please enter a valid layer number between 0 and 127.");
            return;
        }

        previewObject?.hide();
        currentLayer = layerNum;
        mainObject.layerTarget = currentLayer;
        threeDText.value = "";
        canvasText.textContent = `Layer ${currentLayer}`;
    });

    // --- Color Space Toggle ---
    toggleColorSpace.addEventListener("click", async () => {
        colorSpace = colorSpace === "RGB" ? "HSL" : "RGB";
        await mainObject.switchColorSpace(colorSpace, 500);

        // Update preview object if active

        mainObject._lastBlendKey = null;

        miniObject.updateColorSpace(colorSpace);
        if (previewObject && validLayer(parseInt(threeDText.value))) {
            previewObject.switchColorSpace(colorSpace, 500);
        }
    });

    // --- Keyboard / Mouse / Wheel Controls ---
    const faceMap = mainObject.faceMap;

    window.addEventListener("keydown", (e) => {
        const activeEl = document.activeElement;
        const isTyping = activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.isContentEditable;
        if (!isTyping) {
            if (faceMap[e.key] !== undefined) mainObject.rotateTo(faceMap[e.key]);
            if (e.key === "]") {
                mainObject.layerTarget = Math.min(127, mainObject.layerTarget + 1);
                canvasText.textContent = `Layer ${mainObject.layerTarget}`;
            }
            if (e.key === "[") {
                mainObject.layerTarget = Math.max(0, mainObject.layerTarget - 1);
                canvasText.textContent = `Layer ${mainObject.layerTarget}`;
            }
            if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
                miniObject.activateFade();
            }
        }
    });

    container.addEventListener("wheel", (event) => {
        event.preventDefault();
        const zoomSpeed = 0.3;
        camera.position.z += (event.deltaY > 0 ? 1 : -1) * zoomSpeed;
        camera.position.z = Math.max(1, Math.min(20, camera.position.z));
    });

    // --- Raycasting for color picker ---
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    // UI Elements for color info
    const infoBox = document.querySelectorAll(".color-info");
    const infoSearch = document.getElementById("color-search");
    const colorName = document.getElementById("color-name");
    const baseCircle = document.getElementById("base-circle");
    const colortext = document.getElementById("color-text");
    const ghosttext = document.getElementById("ghost-text");
    const dropdown = document.getElementById("autocomplete");

    container.addEventListener("click", (event) => {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        let targets = [];
        switch (objectType) {
            case "cube":
                targets = mainObject.cubeSides.map(s => s.plane);
                break;
            case "sphere":
                targets = [mainObject.object];
                break;
        }
        let intersects = raycaster.intersectObjects(targets, false);
        if (intersects.length === 0) {
            infoBox.forEach(box => box.classList.remove("show"));
            if (infoSearch) infoSearch.style.display = "flex";
            if (baseCircle) baseCircle.style.backgroundColor = `hsl(0,0%,0%,0)`;
            if (colorName) colorName.textContent = "";
            resetColors();
            miniObject.clearHighlight();
            return;
        }
        function handleClick(intersects, mainObject) {
            const hit = intersects[0];
            const uv = hit.uv;
            if (!uv) return; // safety check

            // 2️⃣ Get texture and canvas

            //For cube, find the corresponding plane, for sphere, use the mesh directly
            let mesh;
            switch (mainObject.objectType) {
                case "cube": {
                    mesh = mainObject.cubeSides.find(s => s.plane === hit.object)?.plane;
                    break;
                }
                case "sphere": {
                    mesh = hit.object;
                    break;
                }
            }
            if (!mesh) return; // safety check
            const texture = mesh.material.uniforms.texB.value;
            const canvas = texture.userData.canvas;
            if (!canvas) return; // safety check

            // 3️⃣ Get clicked pixel color
            function getPixelColor(tex, uv, uvFlip = [0, 0]) {
                const width = tex.image.width;
                const height = tex.image.height;
                const pixelData = tex.image.data;
                const xPos = Math.floor(uv.x * width);
                const yPos = Math.floor(uv.y * height);
                const idx = (yPos * width + xPos) * 4;
                return new THREE.Color(pixelData[idx] / 255, pixelData[idx + 1] / 255, pixelData[idx + 2] / 255);
            }
            const clickedColor = getPixelColor(texture, uv);


            // 4️⃣ Update UI
            colortext.value = "";
            ghosttext.value = "";
            dropdown.innerHTML = "";

            infoBox.forEach(box => box.classList.add("show"));
            if (infoSearch) infoSearch.style.display = "none";
            baseCircle.style.backgroundColor = `#${clickedColor.getHexString()}`;
            if (colorName) colorName.textContent = "";
            setBaseColors(clickedColor);

            // 5️⃣ Animate highlight
            let highlightDir;
            switch (colorSpace) {
                case "RGB":
                    highlightDir = new THREE.Vector3(clickedColor.r * 2 - 1,
                        clickedColor.g * 2 - 1, clickedColor.b * 2 - 1).normalize();
                    break;
                case "HSL":
                    const hsl = {};
                    clickedColor.getHSL(hsl);
                    const angle = hsl.h * 2 * Math.PI;
                    highlightDir = new THREE.Vector3(Math.cos(angle) * hsl.s, hsl.l * 2 - 1, Math.sin(angle) * hsl.s).normalize();
                    break;
            }
            miniObject.setHighlight(highlightDir, 1.0);
        }
        handleClick(intersects, mainObject);
    });
    // --- Double-click reset with smooth animation ---
    container.addEventListener("dblclick", () => {
        mainObject.resetObject();
        if (previewObject?.object) previewObject.syncRotation();
    });

    // --- Animation Loop ---
    let renderReady = false;
    const startRendering = () => {
        renderReady = true;
        loader.fadeLoaderShowScene(container);
        renderer.domElement.style.opacity = 1;
        update();
    }
    const update = () => {
        requestAnimationFrame(update);
        if (!renderReady) return;

        mainObject.update(); // keyboard, mouse, auto-rotation
        if (previewObject?.object) previewObject.syncRotation();

        renderer.render(scene, camera);

        // Update mini object(bottom-right)
        // Update mini object (bottom-right)
        miniObject.updateRotation(mainObject.getRotation());

        const isMoving = mainObject.isUserInteracting || mainObject.autoRotateActive;
        if (isMoving) {
            miniObject.activateFade();
        }
        miniObject.tickFade();

        // Render last
        miniObject.renderMiniObject(4, 25);

    };
    startRendering();

    return {
        renderer,
        scene,
        camera,
        dispose: () => {
            // DO NOT dispose renderer or camera (shared)
            scene.traverse((obj) => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(m => m.dispose());
                    } else {
                        obj.material.dispose();
                    }
                }
            });
        }
    };
};


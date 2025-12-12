import { MiniCube } from './3d/MiniCube.js';
import { MiniSphere } from './3d/MiniSphere.js';
import { MainCube } from './3d/MainCube.js';
import { MainSphere } from './3d/MainSphere.js';
import { setBaseColors, resetColors } from './harmony.js';
import { LRUCache } from "./3d/LRUCache.js";
import { LoaderManager } from './LoaderManager.js';

export const create3DEnvironment = async (objectType = "cube") => {
    // --- Loading Elements ---
    const loader = new LoaderManager();
    loader.show("Initializing 3D Engine...");


    // --- Renderer + Scene ---
    const container = document.getElementById("ui-canvas");
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(75, 2, 0.1, 20);
    camera.position.z = 3;

    const scene = new THREE.Scene();
    // --- Texture caches ---
    //console.log("Loading 3D Object");
    const lruCache = new LRUCache({ type: objectType });
    //await lruCache.preloadLayers();

    // --- Main,Preview and Mini 3D Object ---
    let mainObject, previewObject, miniObject;
    switch (objectType) {
        case "cube":
            loader.setMessage("Creating Cube...");
            mainObject = new MainCube(scene, lruCache, camera, (loaded, total) => {
                loader.handleProgress(loaded, total);
            });
            loader.setMessage("Setting up Axes Helper for Cube...");
            miniObject = new MiniCube(renderer);
            break;
        case "sphere":
            loader.setMessage("Creating Sphere...");
            mainObject = new MainSphere(scene, lruCache, camera, (loaded, total) => {
                loader.handleProgress(loaded, total);
            });
            loader.setMessage("Setting up Axes Helper for Sphere...");
            miniObject = new MiniSphere(renderer);
            break;
        default:
            throw new Error(`Unknown objectType: ${objectType}`);
    }
    if (objectType == "cube") {
        const { PreviewCube } = await import('./3d/PreviewCube.js');
        previewObject = new PreviewCube(lruCache);
    }
    else if (objectType == "sphere") {
        //console.log("Switch to Sphere");
        const { PreviewSphere } = await import('./3d/PreviewSphere.js');
        previewObject = new PreviewSphere(lruCache);
    }
    previewObject.setupControls(mainObject);
    loader.show("Preparing textures...");
    await mainObject.textureCache.preloadLayers(
        undefined,  // default layers
        undefined,  // default batchSize
        (loaded, total, current, progress, totalProgress) => loader.handleLayerProgress(loaded, total, current, progress, totalProgress)
    );

    // --- Responsive Renderer ---
    const fitRendererToContainer = () => {
        const width = container.clientWidth;
        const height = container.clientHeight;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    };
    fitRendererToContainer();
    window.addEventListener("resize", fitRendererToContainer);

    // --- UI Elements ---
    const threeDText = document.getElementById("3dtext");
    const toggleColorSpace = document.getElementById("toggle");
    const canvasText = document.getElementById("ui-canvas-text");
    let currentLayer = 127;
    let colorSpace = "RGB";
    const validLayer = (input) => Number.isInteger(input) && input >= 0 && input <= 127;

    // --- Preview Object Helper ---
    const createPreview = (layerNum, newColorSpace = colorSpace, toggleSpace = false) => {
        if (!previewObject) return;
        previewObject.removePreview();
        previewObject.createPreview(scene, layerNum, newColorSpace, toggleSpace);
    };
    // --- Layer Input Handling ---
    threeDText.addEventListener("input", () => {
        const layerNum = parseInt(threeDText.value);
        if (!validLayer(layerNum) || layerNum === currentLayer) {
            previewObject?.removePreview();
            return;
        }
        createPreview(layerNum);
    });

    threeDText.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            threeDText.value = "";
            previewObject?.removePreview();
            return;
        }
        if (event.key !== "Enter") return;

        const layerNum = parseInt(threeDText.value);
        if (!validLayer(layerNum)) {
            alert("Please enter a valid layer number between 0 and 127.");
            return;
        }

        previewObject?.removePreview();
        currentLayer = layerNum;
        mainObject.updateLayer(currentLayer);
        threeDText.value = "";
        canvasText.textContent = `Layer ${currentLayer}`;
    });

    // --- Color Space Toggle ---
    toggleColorSpace.addEventListener("click", () => {
        colorSpace = colorSpace === "RGB" ? "HSL" : "RGB";
        mainObject.colorSpace = colorSpace;
        mainObject.updateLayer(currentLayer);
        miniObject.updateLabels(colorSpace);

        if (previewObject && validLayer(parseInt(threeDText.value))) {
            createPreview(parseInt(threeDText.value), colorSpace);
        }
    });

    // --- Keyboard / Mouse / Wheel Controls ---
    const faceMap = { "1": 0, "2": 1, "3": 2, "4": 3, "5": 4, "6": 5 };

    window.addEventListener("keydown", (e) => {
        const activeEl = document.activeElement;
        const isTyping = activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.isContentEditable;
        if (!isTyping && objectType != "sphere") {
            if (faceMap[e.key] !== undefined) mainObject.rotateTo(faceMap[e.key]);
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
        const intersects = objectType == "cube" ? raycaster.intersectObjects(mainObject.cubeSides.map(s => s.plane), false) : [];

        if (intersects.length === 0) {
            infoBox.forEach(box => box.classList.remove("show"));
            if (infoSearch) infoSearch.style.display = "flex";
            if (baseCircle) baseCircle.style.backgroundColor = `hsl(0,0%,0%,0)`;
            if (colorName) colorName.textContent = "";
            resetColors();
            return;
        }

        const hit = intersects[0];
        const plane = hit.object;
        const side = mainObject.cubeSides.find(s => s.plane === plane);
        if (!side) return;

        const canvas = plane.material.map.image;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        const uv = hit.uv;
        const xPos = Math.floor(uv.x * canvas.width);
        const yPos = Math.floor((1 - uv.y) * canvas.height);

        const pixel = context.getImageData(xPos, yPos, 1, 1).data;
        const clickedColor = new THREE.Color(pixel[0] / 255, pixel[1] / 255, pixel[2] / 255);

        colortext.value = "";
        ghosttext.value = "";
        dropdown.innerHTML = "";

        infoBox.forEach(box => box.classList.add("show"));
        if (infoSearch) infoSearch.style.display = "none";
        baseCircle.style.backgroundColor = `#${clickedColor.getHexString()}`;
        if (colorName) colorName.textContent = "";
        setBaseColors(clickedColor);

        const origPixel = context.getImageData(xPos, yPos, 1, 1);
        let alpha = 1.0;
        const fadeSpeed = 0.05;

        function animateHighlight() {
            // Restore original pixel
            context.putImageData(origPixel, xPos, yPos);

            // Draw fading white highlight
            context.fillStyle = `rgba(255,255,255,${alpha})`;
            context.fillRect(xPos, yPos, 1, 1);

            plane.material.map.needsUpdate = true;

            alpha -= fadeSpeed;
            if (alpha > 0) {
                requestAnimationFrame(animateHighlight);
            } else {
                // Ensure original pixel is restored at the end
                context.putImageData(origPixel, xPos, yPos);
                plane.material.map.needsUpdate = true;
            }
        }
        animateHighlight();
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
        miniObject.updateRotation(mainObject.getRotation());
        miniObject.renderMiniObject(4, 25, 0, 0);

    };
    startRendering();

    return {
        renderer,
        scene,
        camera,
        dispose: () => {
            renderer.dispose();
            renderer.domElement.remove();
            // Dispose materials, geometries, textures if needed
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


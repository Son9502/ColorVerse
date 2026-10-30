import { THREE } from "../three-setup.js";

let renderer = null;
let camera = null;

export function getSharedRenderer(container) {
    if (!renderer) {
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(renderer.domElement);

        camera = new THREE.PerspectiveCamera(75, 2, 0.1, 20);
        camera.position.z = 3;
    }
    return { renderer, camera };
}

export function resizeSharedRenderer(container) {
    if (renderer && camera) {
        const width = container.clientWidth;
        const height = container.clientHeight;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }
}
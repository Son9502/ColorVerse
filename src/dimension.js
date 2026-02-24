// ----------------------------------
// Dimensionial Searcher
// ----------------------------------
import { create1DEnvironment } from './1d-mode.js';
import { create2DEnvironment } from './2d-mode.js';
import { create3DEnvironment } from './3d-mode.js';

let currentVisual = null;
let currentType = null;

export function setupDimensionDropdown() {
    const shapeSelect = document.getElementById("shape-select");
    const dropdown = document.getElementById("dimensions");

    dropdown.addEventListener("change", async (event) => {
        const value = event.target.value;
        shapeSelect.innerHTML = "";

        document.querySelectorAll(".dimension-info").forEach(div => {
            div.style.display = "none";
        })
        switch (value) {
            case "1-D": {
                document.getElementById("info1D").style.display = "block";
                shapeSelect.disabled = true;
                await switchVisualization("line");
                break;
            }
            case "2-D": {
                shapeSelect.disabled = false;
                document.getElementById("info2D").style.display = "block";
                populateVisualizationList([ "square", "circle" ]);
                // default value is a square 
                shapeSelect.value = "square";
                await switchVisualization("square");
                break;
            }
            case "3-D": {
                shapeSelect.disabled = false;
                document.getElementById("info3D").style.display = "block";
                populateVisualizationList([ "cube", "sphere" ]);
                // default value is a cube 
                shapeSelect.value = "cube";
                await switchVisualization("cube");
                break;
            }
        }
    });

    shapeSelect.addEventListener("change", async (event) => {
        const selected = event.target.value;
        await switchVisualization(selected);
    })
}
// ----------------------------------
// Visualization Switcher
// ----------------------------------
export
    async function switchVisualization(type) {
    if (currentType == type) return;
    if (currentVisual) {
        await currentVisual?.dispose?.();
        if (currentVisual.renderer) {
            await currentVisual.renderer.dispose();
        }
    }
    switch (type) {
        case "line":
            currentVisual = await create1DEnvironment();
            break;
        case "square":
        case "circle":
            currentVisual = await create2DEnvironment(type);
            break;
        case "cube":
        case "sphere":
            currentVisual = await create3DEnvironment(type);
            break;
        default:
            console.error("Unknown visualization type", type);
    }
    currentType = type;
}
// ----------------------------------
// Get Current Visualization
// ----------------------------------
export function getVisualization() {
    return currentVisual;
}
function populateVisualizationList(shapes) {
    const shapeSelect = document.getElementById("shape-select");
    shapeSelect.innerHTML = "";
    for (const shape of shapes) {
        const opt = document.createElement("option");
        opt.value = shape;
        opt.textContent = shape.charAt(0).toUpperCase() + shape.slice(1);
        shapeSelect.appendChild(opt);
    }
}
export async function defaultVisualization(shape) {
    const shapeSelect = document.getElementById("shape-select");
    const dimensionSelect = document.getElementById("dimensions");
    const shapes = {
        "line": "1-D",
        "square": "2-D",
        "circle": "2-D",
        "cube": "3-D",
        "sphere": "3-D",
    }
    dimensionSelect.value = shapes[shape];
    switch (shapes[shape]) {
        case "1-D": {
            document.getElementById("info1D").style.display = "block";
            shapeSelect.disabled = true;
            break;
        }
        case "2-D": {
            shapeSelect.disabled = false;
            document.getElementById("info2D").style.display = "block";
            populateVisualizationList([ "square", "circle" ]);
            shapeSelect.value = shape;
            break;
        }
        case "3-D": {
            shapeSelect.disabled = false;
            document.getElementById("info3D").style.display = "block";
            populateVisualizationList([ "cube", "sphere" ]);
            shapeSelect.value = shape;
            break;
        }
    }
    await switchVisualization(shape);
}

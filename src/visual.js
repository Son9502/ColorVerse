import { create1DEnvironment } from './1d-mode.js';
import { create2DEnvironment } from './2d-mode.js';
import { create3DEnvironment } from './3d-mode.js';

let currentVisual = null; 
let currentType = null; 
export async function switchVisualization(type){
    if (currentType == type) return;
    if (currentVisual){
        await currentVisual?.dispose?.();
        if (currentVisual.renderer){
            currentVisual.renderer.domElement.remove();
            currentVisual.renderer.dispose();
        }
    }
    
    switch (type){
        case "line":
            currentVisual = await create1DEnvironment();
            break;
        case "square":
            currentVisual = await create2DEnvironment("square");
            break;
        case "cube":
            currentVisual = await create3DEnvironment("cube");
            break;
        case "circle":
            currentVisual = await create2DEnvironment("circle");
            break;
        case "sphere":
            currentVisual = await create3DEnvironment("sphere");
            break;
        default:
            console.error("Unknown visualization type");
    }
    currentType = type; 
}
export function getCurrentVisualization(){
    return currentVisual; 
}
import { computeCubeColor, computeSphereColor, linearToSRGB, SRGBtoLinear } from "../color-utils.js";
// returns texture data for RGB and HSL color spaces

// 
export function generateCanvas(layer, colorSpace, type, onProgress) {
    switch (type) {
        case "cube":
            return cubeCanvas(layer, colorSpace, onProgress);
        case "sphere":
            return sphereCanvas(layer, colorSpace, onProgress);
        default:
            throw new Error(`Unknown type: ${type}`);
    }
}
function cubeCanvas(layer, colorSpace, onProgress) {

    // Helper function to map coordinates based on flip
    function mapCoord(index, size, flip) {
        return flip ? size - 1 - index : index;
    }

    const size = 256 - (layer * 2);
    let faceMap = [];

    let canvases = [];
    let textureData = [];

    let processed = 0;
    let total = 0;
    const progressInterval = Math.max(1000, Math.floor(total / 100));

    total = size * size * 6;

    switch (colorSpace) {
        case "RGB": {
            faceMap = [
                { x: { channel: "r", start: 0 }, y: { channel: "g", start: 1 }, fixed: { channel: "b", value: 0 } },
                { x: { channel: "b", start: 0 }, y: { channel: "g", start: 1 }, fixed: { channel: "r", value: 1 } },
                { x: { channel: "r", start: 1 }, y: { channel: "g", start: 1 }, fixed: { channel: "b", value: 1 } },
                { x: { channel: "b", start: 1 }, y: { channel: "g", start: 1 }, fixed: { channel: "r", value: 0 } },
                { x: { channel: "r", start: 0 }, y: { channel: "b", start: 1 }, fixed: { channel: "g", value: 1 } },
                { x: { channel: "r", start: 0 }, y: { channel: "b", start: 0 }, fixed: { channel: "g", value: 0 } },
            ];
            break;
        }
        case "HSL": {
            faceMap = [
                { x_start: 0, y_start: 0, loop: false }, // Front
                { x_start: 1, y_start: 0, loop: false }, // Right
                { x_start: 2, y_start: 0, loop: false }, // Back
                { x_start: 3, y_start: 0, loop: false }, // Left
                { x_start: 0, y_start: 1, loop: true },  // Top
                { x_start: 0, y_start: 0, loop: true }   // Bottom
            ];
            break;
        }
    }
    faceMap.forEach(face => {
        const cubeCanvas = document.createElement('canvas');
        cubeCanvas.width = cubeCanvas.height = size;
        const cubeCtx = cubeCanvas.getContext("2d", { willReadFrequently: true });
        const cubeImg = cubeCtx.createImageData(size, size);

        const faceColors = Array.from({ length: size }, () => new Array(size));

        for (let y = 0; y < size; y += 1) {
            let mapY = colorSpace == "RGB" ? mapCoord(y, size, face.y.flip) : mapCoord(y, size, true);
            for (let x = 0; x < size; x += 1) {
                let mapX = colorSpace == "RGB" ? mapCoord(x, size, face.x.flip) : mapCoord(x, size, false);

                const color = computeCubeColor(mapX, mapY, layer, face, colorSpace, size);
                faceColors[y][x] = color;

                const idx = (y * size + x) * 4;

                // Apply gamma correction to linear RGB values
                cubeImg.data[idx] = linearToSRGB(color.r);
                cubeImg.data[idx + 1] = linearToSRGB(color.g);
                cubeImg.data[idx + 2] = linearToSRGB(color.b);
                cubeImg.data[idx + 3] = 255;

                // Increment processed count
                // Notify worker that 1 pixel was processed.
                // Worker handles incrementing and batching progress messages.
                processed++;
                if (processed % progressInterval == 0) {
                    onProgress?.({ loaded: processed, total, current: layer, progress: processed / total });
                }
            }
        }
        cubeCtx.putImageData(cubeImg, 0, 0);
        canvases.push(cubeCanvas);
        textureData.push(faceColors);
    });

    return { canvases, textureData };
}
function sphereCanvas(layer, colorSpace, onProgress) {
    const size = 256 - (layer * 2);

    let canvases = [];
    let textureData = [];

    let processed = 0;
    let total = 0;
    const progressInterval = Math.max(1000, Math.floor(total / 100));

    total = size * size;

    const sphereCanvas = document.createElement('canvas');
    sphereCanvas.width = sphereCanvas.height = size;
    const sphereCtx = sphereCanvas.getContext("2d", { willReadFrequently: true });
    const sphereImg = sphereCtx.createImageData(size, size);

    const sphereColors = Array.from({ length: size }, () => new Array(size));

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const color = computeSphereColor(x, y, layer, colorSpace, size);
            sphereColors[y][x] = color;
            // Apply gamma correction to linear RGB values
            const idx = (y * size + x) * 4;
            sphereImg.data[idx] = linearToSRGB(color.r);
            sphereImg.data[idx + 1] = linearToSRGB(color.g);
            sphereImg.data[idx + 2] = linearToSRGB(color.b);
            sphereImg.data[idx + 3] = 255;

            // Increment processed count
            // Notify worker that 1 pixel was processed.
            // Worker handles incrementing and batching progress messages.
            processed++;
            if (processed % progressInterval == 0) {
                onProgress?.({ loaded: processed, total, current: layer, progress: processed / total });
            }
        }
    }
    sphereCtx.putImageData(sphereImg, 0, 0);
    canvases.push(sphereCanvas);
    textureData.push(sphereColors);
    return { canvases, textureData };
}

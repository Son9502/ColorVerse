import { hslToRgb, computeCubeColor, computeSphereColor, linearToSRGB, SRGBtoLinear } from "../color-utils.js";
import { clamp } from "../utils.js";
// returns texture data for RGB and HSL color spaces

// 
export function rgbCanvas(layer, type, onProgress) {
    const size = 256 - (layer * 2);
    let faceMap = [];

    let canvases = [];
    let textureData = [];

    let processed = 0;
    let total = 0;
    const progressInterval = Math.max(1000, Math.floor(total / 100));
    switch (type) {
        case "cube": {
            total = size * size * 6;
            faceMap = [
                { x: { channel: "r", start: 0 }, y: { channel: "g", start: 1 }, fixed: { channel: "b", value: 0 } },
                { x: { channel: "b", start: 0 }, y: { channel: "g", start: 1 }, fixed: { channel: "r", value: 1 } },
                { x: { channel: "r", start: 1 }, y: { channel: "g", start: 1 }, fixed: { channel: "b", value: 1 } },
                { x: { channel: "b", start: 1 }, y: { channel: "g", start: 1 }, fixed: { channel: "r", value: 0 } },
                { x: { channel: "r", start: 0 }, y: { channel: "b", start: 1 }, fixed: { channel: "g", value: 1 } },
                { x: { channel: "r", start: 0 }, y: { channel: "b", start: 0 }, fixed: { channel: "g", value: 0 } },
            ];
            faceMap.forEach(face => {
                const cubeCanvas = document.createElement('canvas');
                cubeCanvas.width = cubeCanvas.height = size;
                const cubeCtx = cubeCanvas.getContext("2d", { willReadFrequently: true });
                const cubeImg = cubeCtx.createImageData(size, size);

                const faceColors = Array.from({ length: size }, () => new Array(size));

                const yStep = face.y.start === 0 ? 1 : -1;
                const yStart = face.y.start === 0 ? 0 : size - 1;
                const yEnd = face.y.start === 0 ? size : -1;

                const xStep = face.x.start === 0 ? 1 : -1;
                const xStart = face.x.start === 0 ? 0 : size - 1;
                const xEnd = face.x.start === 0 ? size : -1;

                let yIndex = 0;

                for (let y = yStart; y !== yEnd; y += yStep, yIndex++) {
                    let xIndex = 0;

                    for (let x = xStart; x !== xEnd; x += xStep, xIndex++) {
                        const color = computeCubeColor(x, y, layer, face, "RGB", size);
                        faceColors[yIndex][xIndex] = color;

                        const idx = (yIndex * size + xIndex) * 4;

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
            break;
        }
        case "sphere": {
            total = size * size;
            const sphereCanvas = document.createElement('canvas');
            sphereCanvas.width = sphereCanvas.height = size;
            const sphereCtx = sphereCanvas.getContext("2d", { willReadFrequently: true });
            const sphereImg = sphereCtx.createImageData(size, size);

            const sphereColors = Array.from({ length: size }, () => new Array(size));

            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const color = computeSphereColor(x, y, layer, "RGB", size);
                    sphereColors[y][x] = color;

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
            break;
        }
        default:
            throw new Error(`Unknown texture type: ${type}`);
    }
    return { canvases, textureData };
}
export function hslCanvas(layer, type, onProgress) {
    const size = 256 - (layer * 2);
    let faceMap = [];

    let canvases = [];
    let textureData = [];

    let processed = 0;
    let total = 0;
    const progressInterval = Math.max(1000, Math.floor(total / 100));

    switch (type) {
        case "cube": {
            total = size * size * 6;
            faceMap = [
                { x_start: 0, y_start: 0, loop: false }, // Front
                { x_start: 1, y_start: 0, loop: false }, // Right
                { x_start: 2, y_start: 0, loop: false }, // Back
                { x_start: 3, y_start: 0, loop: false }, // Left
                { x_start: 0, y_start: 1, loop: true },  // Top
                { x_start: 0, y_start: 0, loop: true }   // Bottom
            ];
            faceMap.forEach(face => {
                const cubeCanvas = document.createElement('canvas');
                cubeCanvas.width = cubeCanvas.height = size;
                const cubeCtx = cubeCanvas.getContext("2d", { willReadFrequently: true });
                const cubeImg = cubeCtx.createImageData(size, size);

                const faceColors = Array.from({ length: size }, () => new Array(size));

                for (let y = 0; y < size; y++) {
                    for (let x = 0; x < size; x++) {
                        const color = computeCubeColor(x, y, layer, face, "HSL", size);
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
            break;
        }
        case "sphere": {
            total = size * size;
            const sphereCanvas = document.createElement('canvas');
            sphereCanvas.width = sphereCanvas.height = size;
            const sphereCtx = sphereCanvas.getContext("2d", { willReadFrequently: true });
            const sphereImg = sphereCtx.createImageData(size, size);

            const sphereColors = Array.from({ length: size }, () => new Array(size));

            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const color = computeSphereColor(x, y, layer, "HSL", size);
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
            break;
        }
        default:
            throw new Error(`Unknown texture type: ${type}`);
    }
    return { canvases, textureData };
}
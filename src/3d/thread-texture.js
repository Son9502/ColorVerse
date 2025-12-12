import { hslToRgb, colorMap, computeColor } from "../color-utils.js";
// returns texture data for RGB and HSL color spaces

// 
export function cubeCanvases(layer, colorSpace, onProgress) {
    // RGB/HSL Color Space Mapping:
    // -/+ X face: R/H = 0/1, G/S = u, B/L = v 
    // -/+ Y face: G/S = 0/1, R/H = u, B/L = v
    // -/+ Z face: B/L = 0/1, R/H = u, G/S = v
    const size = 256 - (layer * 2);
    const faceMap = colorMap(colorSpace);
    let canvases = [];
    let textureData = [];
    let processed = 0;
    let total = size * size * 6;
    const progressInterval = Math.max(1000, Math.floor(total / 100));
    // Iterate over each face
    faceMap.forEach(face => {

        // Create canvas and context
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const context = canvas.getContext('2d', { willReadFrequently: true, });
        // Temporary array to hold face colors
        const faceColors = Array.from({ length: size }, () => new Array(size));


        // Clear canvas for new face
        const image = context.createImageData(size, size);

        // Create directions:
        const yStart = face.y.start === 0 ? 0 : size - 1;
        const yEnd = face.y.start === 0 ? size : -1;
        const yStep = face.y.start === 0 ? 1 : -1;

        const xStart = face.x.start === 0 ? 0 : size - 1;
        const xEnd = face.x.start === 0 ? size : -1;
        const xStep = face.x.start === 0 ? 1 : -1;

        let yIndex = 0;
        // For each face, compute colors
        for (let y = yStart; y !== yEnd; y += yStep, yIndex++) {
            let xIndex = 0;
            for (let x = xStart; x !== xEnd; x += xStep, xIndex++) {
                const color = computeColor(x, y, layer, face, colorSpace, size);
                // Store color in faceColors array
                faceColors[yIndex][xIndex] = color;

                const index = (yIndex * size + xIndex) * 4;

                if (colorSpace === "RGB") {
                    image.data[index] = color.r;
                    image.data[index + 1] = color.g;
                    image.data[index + 2] = color.b;
                } else {
                    const rgb = hslToRgb(color.h, color.s, color.l);
                    image.data[index] = rgb.r;
                    image.data[index + 1] = rgb.g;
                    image.data[index + 2] = rgb.b;
                }

                image.data[index + 3] = 255;
                processed++;
                if (processed % progressInterval == 0) {
                    onProgress?.({ loaded: processed, total, current: layer, progress: processed / total });
                }
            }
        }
        context.putImageData(image, 0, 0);

        canvases.push(canvas);
        textureData.push(faceColors);
    });
    return { canvases, textureData };
}
export function sphereCanvases(layer, colorSpace, onProgress) {
    console.log("sphereCanvases called:", layer, colorSpace);

    // TODO: generate actual sphere textures
    const size = 256 - layer * 2;
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');

    let processed = 0;
    let total = size * size;
    const progressInterval = Math.max(1000, Math.floor(total / 100));
    // Iterate over each face

    for (let i = 0; i < total; i++) {
        processed++;
        if (processed % progressInterval == 0) {
            onProgress?.({ loaded: processed, total, current: layer, progress: processed / total });
        }
    }
    ctx.fillStyle = colorSpace === "RGB" ? "rgba(255, 0, 0, 1)" : "hsla(0, 100%, 50%, 1.00)";
    ctx.fillRect(0, 0, size, size);

    return { canvases: [canvas], textureData: [[[{ r: 255, g: 0, b: 0 }]]] };
}
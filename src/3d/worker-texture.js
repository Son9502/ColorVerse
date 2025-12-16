import { hslToRgb, computeCubeColor, computeSphereColor, SRGBtoLinear, linearToSRGB } from "../color-utils.js";
import { clamp } from "../utils.js";
// thread-texture.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.0/build/three.module.js';

// returns texture data for RGB and HSL color spaces
function rgbCanvas(layer, type, onProgress) {
  //console.log("Cube Canvases called:", layer, colorSpace);
  const size = 256 - (layer * 2);
  let faceMap = [];

  const canvases = [];
  const textureData = [];

  switch (type) {
    case "cube": {
      faceMap = [
        { x: { channel: "r", start: 0 }, y: { channel: "g", start: 1 }, fixed: { channel: "b", value: 0 } },
        { x: { channel: "b", start: 0 }, y: { channel: "g", start: 1 }, fixed: { channel: "r", value: 1 } },
        { x: { channel: "r", start: 1 }, y: { channel: "g", start: 1 }, fixed: { channel: "b", value: 1 } },
        { x: { channel: "b", start: 1 }, y: { channel: "g", start: 1 }, fixed: { channel: "r", value: 0 } },
        { x: { channel: "r", start: 0 }, y: { channel: "b", start: 1 }, fixed: { channel: "g", value: 1 } },
        { x: { channel: "r", start: 0 }, y: { channel: "b", start: 0 }, fixed: { channel: "g", value: 0 } },
      ];
      for (const face of faceMap) {

        const cubeCanvas = new OffscreenCanvas(size, size);

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
            // Notify worker that 1 pixel was processed.
            // Worker handles incrementing and batching progress messages.
            onProgress?.();
            const color = computeCubeColor(x, y, layer, face, "RGB", size);
            faceColors[yIndex][xIndex] = color;

            const idx = (yIndex * size + xIndex) * 4;

            // Apply gamma correction to linear RGB values
            cubeImg.data[idx] = linearToSRGB(color.r);
            cubeImg.data[idx + 1] = linearToSRGB(color.g);
            cubeImg.data[idx + 2] = linearToSRGB(color.b);
            cubeImg.data[idx + 3] = 255;
          }
        }
        cubeCtx.putImageData(cubeImg, 0, 0);
        canvases.push(cubeCanvas);
        textureData.push(faceColors);
      }
      break;
    }
    case "sphere": {
      const sphereCanvas = new OffscreenCanvas(size, size);
      const sphereCtx = sphereCanvas.getContext("2d", { willReadFrequently: true });
      const sphereImg = sphereCtx.createImageData(size, size);
      const sphereColors = Array.from({ length: size }, () => new Array(size));

      let nonZero = 0;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          onProgress?.();

          const color = computeSphereColor(x, y, layer, "RGB", size);
          sphereColors[y][x] = color;

          const idx = (y * size + x) * 4;
          sphereImg.data[idx] = linearToSRGB(color.r);
          sphereImg.data[idx + 1] = linearToSRGB(color.g);
          sphereImg.data[idx + 2] = linearToSRGB(color.b);
          sphereImg.data[idx + 3] = 255;
          //if (color.r !== 0 || color.g !== 0 || color.b !== 0) nonZero++;
        }
      }
      //console.log(sphereImg.data)
      //console.log(`Sphere RGB layer ${layer} non-zero pixels: ${nonZero} / ${size * size}`);
      sphereCtx.putImageData(sphereImg, 0, 0);
      canvases.push(sphereCanvas);
      textureData.push(sphereColors);

      break;
    }
    default:
      throw new Error(`Unknown type: ${type}`);
  }
  return { canvases, textureData };
}
function hslCanvas(layer, type, onProgress) {

  const size = 256 - (layer * 2);

  const canvases = [];
  const textureData = [];
  let faceMap = [];

  switch (type) {
    case "cube": {
      faceMap = [
        { x_start: 0, y_start: 0, loop: false }, // Front
        { x_start: 1, y_start: 0, loop: false }, // Right
        { x_start: 2, y_start: 0, loop: false }, // Back
        { x_start: 3, y_start: 0, loop: false }, // Left
        { x_start: 0, y_start: 1, loop: true },  // Top
        { x_start: 0, y_start: 0, loop: true }   // Bottom
      ];
      for (const face of faceMap) {

        const cubeCanvas = new OffscreenCanvas(size, size);

        const cubeCtx = cubeCanvas.getContext("2d", { willReadFrequently: true });
        const cubeImg = cubeCtx.createImageData(size, size);

        const faceColors = Array.from({ length: size }, () => new Array(size));
        for (let y = size - 1; y >= 0; y--) {
          //let xIndex = 0;
          for (let x = 0; x < size; x++) {
            // Notify worker that 1 pixel was processed.
            // Worker handles incrementing and batching progress messages.
            onProgress?.();
            const color = computeCubeColor(x, y, layer, face, "HSL", size);
            faceColors[y][x] = color;

            const idx = (y * size + x) * 4;
            
            // Apply gamma correction to linear RGB values
            cubeImg.data[idx] = linearToSRGB(color.r);
            cubeImg.data[idx + 1] = linearToSRGB(color.g);
            cubeImg.data[idx + 2] = linearToSRGB(color.b);
            cubeImg.data[idx + 3] = 255;

          }
        }
        cubeCtx.putImageData(cubeImg, 0, 0);
        canvases.push(cubeCanvas);
        textureData.push(faceColors);
      }
      break;
    }
    case "sphere": {
      const sphereCanvas = new OffscreenCanvas(size, size);
      const sphereCtx = sphereCanvas.getContext("2d", { willReadFrequently: true });
      const sphereImg = sphereCtx.createImageData(size, size);
      const sphereColors = Array.from({ length: size }, () => new Array(size));
      let nonZero = 0;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          onProgress?.();

          const color = computeSphereColor(x, y, layer, "HSL", size);
          sphereColors[y][x] = color;

          //console.log(linearToSRGB(color.r),linearToSRGB(color.g),linearToSRGB(color.b));

          const idx = (y * size + x) * 4

          // Apply gamma correction to linear RGB values
          sphereImg.data[idx] = linearToSRGB(color.r);
          sphereImg.data[idx + 1] = linearToSRGB(color.g);
          sphereImg.data[idx + 2] = linearToSRGB(color.b);
          sphereImg.data[idx + 3] = 255;
          //if (color.r !== 0 || color.g !== 0 || color.b !== 0) nonZero++;
        }
      }
      sphereCtx.putImageData(sphereImg, 0, 0);
      canvases.push(sphereCanvas);
      textureData.push(sphereColors);
      //console.log(`Sphere HSL layer ${layer} non-zero pixels: ${nonZero} / ${size * size}`);
      break;
    }
    default:
      throw new Error(`Unknown type: ${type}`);
  }
  return { canvases, textureData };

}
/**
 * Worker for generating cube textures using OffscreenCanvas.
 * Receives: { id, colorSpace, layer }
 * Responds: { id, imageBitmaps, textureData } or { id, error }
 */
self.addEventListener('message', async (ev) => {
  const { id, colorSpace, layer, type } = ev.data;
  //console.log("Worker start", ev.data);

  try {
    let processed = 0;
    let total = 0;
    const size = (256 - layer * 2);
    total = (type === "cube") ? size * size * 6 : size * size;

    const progressInterval = Math.max(1000, Math.floor(total / 100));
    const sendProgress = () => {
      processed++;
      if (processed % progressInterval == 0) {
        self.postMessage({ id, type: "progress", loaded: processed, total, layer });
      }
    };

    let canvases, textureData;

    if (colorSpace == "RGB") {
      ({ canvases, textureData } = rgbCanvas(layer, type, sendProgress));
    }
    else {
      ({ canvases, textureData } = hslCanvas(layer, type, sendProgress));
    }

    const imageBitmaps = await Promise.all(
      canvases.map(off => createImageBitmap(off))
    );

    // Send message that the process is completed 
    self.postMessage({ id, type: "completed", imageBitmaps, textureData, layer }, imageBitmaps);

  } catch (err) {
    console.log("Worker error", err);
    self.postMessage({ id, type: "error", error: err.message || String(err) });
  }
});

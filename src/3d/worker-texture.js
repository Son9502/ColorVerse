import { hslToRgb, computeCubeColor, computeSphereColor, SRGBtoLinear, linearToSRGB } from "../color-utils.js";
import { clamp } from "../utils.js";
// thread-texture.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.0/build/three.module.js';

// returns texture data for RGB and HSL color spaces
function rgbCanvas(layer, type, onProgress, shininess = 15, specular = 0.5) {
  //console.log("Cube Canvases called:", layer, colorSpace);
  const size = 256 - (layer * 2);
  let faceMap = [];

  const canvases = [];
  const textureData = [];

  const lightDir = new THREE.Vector3(0.4, 0.6, 1).normalize();
  const V = new THREE.Vector3(0, 0, 1);
  const H = lightDir.clone().add(V).normalize();

  switch (type) {
    case "cube":
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
            // Compute base RGB values
            let r, g, b;
            r = color.r;
            g = color.g;
            b = color.b;

            // Compure normal for lighting
            const nx = (2 * (xIndex / (size - 1))) - 1;
            const ny = (2 * (yIndex / (size - 1))) - 1;
            let nz = 1 - Math.abs(nx) - Math.abs(ny);
            if (nz < 0) nz = 0;
            const N = new THREE.Vector3(nx, ny, nz).normalize();

            // Compute lighting
            const NdotH = Math.max(N.dot(H), 0);
            const spec = Math.pow(NdotH, shininess) * specular * 255;

            //Gamma correction to linear space
            let rLin = Math.min(color.r + spec, 1);
            let gLin = Math.min(color.g + spec, 1);
            let bLin = Math.min(color.b + spec, 1);

            r = linearToSRGB(rLin);
            g = linearToSRGB(gLin);
            b = linearToSRGB(bLin);

            // Apply lighting to base color
            cubeImg.data[idx] = r;
            cubeImg.data[idx + 1] = g;
            cubeImg.data[idx + 2] = b;
            cubeImg.data[idx + 3] = 255;
          }
        }
        cubeCtx.putImageData(cubeImg, 0, 0);
        canvases.push(cubeCanvas);
        textureData.push(faceColors);
      }
      break;
    case "sphere":
      const sphereCanvas = new OffscreenCanvas(size, size);
      const sphereCtx = sphereCanvas.getContext("2d", { willReadFrequently: true });
      const sphereImg = sphereCtx.createImageData(size, size);
      const sphereColors = Array.from({ length: size }, () => new Array(size));

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          onProgress?.();

          const color = computeSphereColor(x, y, layer, "RGB", size);
          sphereColors[y][x] = color;

          // Sphere normals 
          const nx = (2 * (x / (size - 1))) - 1;
          const ny = 1 - (2 * (y / (size - 1)));
          const rLen = Math.sqrt(nx * nx + ny * ny);
          if (rLen > 1) {
            // Outside sphere
            color.r = color.g = color.b = 0;
          } else {
            // On sphere
            const nz = Math.sqrt(1 - rLen * rLen);
            const N = new THREE.Vector3(nx, ny, nz).normalize();

            // Compute lighting
            const NdotH = Math.max(N.dot(H), 0);
            const spec = Math.pow(NdotH, shininess) * specular * 255;

            color.r = Math.min(color.r + spec, 1);
            color.g = Math.min(color.g + spec, 1);
            color.b = Math.min(color.b + spec, 1);
          }

          const idx = (y * size + x) * 4;
          sphereImg.data[idx] = linearToSRGB(color.r);
          sphereImg.data[idx + 1] = linearToSRGB(color.g);
          sphereImg.data[idx + 2] = linearToSRGB(color.b);
          sphereImg.data[idx + 3] = 255;
        }
      }
      sphereCtx.putImageData(sphereImg, 0, 0);
      canvases.push(sphereCanvas);
      textureData.push(sphereColors);
      break;
    default:
      throw new Error(`Unknown type: ${type}`);
  }
  return { canvases, textureData };
}
function hslCanvas(layer, type, onProgress, shininess = 15, specular = 0.5) {

  const size = 256 - (layer * 2);

  const canvases = [];
  const textureData = [];
  let faceMap = [];

  const lightDir = new THREE.Vector3(0.4, 0.6, 1).normalize();
  const V = new THREE.Vector3(0, 0, 1);
  const H = lightDir.clone().add(V).normalize();

  switch (type) {
    case "cube":
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
            // Compute base RGB values
            let r, g, b;
            r = color.r;
            g = color.g;
            b = color.b;

            // Compure normal for lighting
            const nx = (2 * (x / (size - 1))) - 1;
            const ny = (2 * (y / (size - 1))) - 1;
            let nz = 1 - Math.abs(nx) - Math.abs(ny);
            if (nz < 0) nz = 0;
            const N = new THREE.Vector3(nx, ny, nz).normalize();

            // Compute lighting
            const NdotH = Math.max(N.dot(H), 0);
            const spec = Math.pow(NdotH, shininess) * specular * 255;

            //Gamma correction to linear space
            let rLin = Math.min(color.r + spec, 1);
            let gLin = Math.min(color.g + spec, 1);
            let bLin = Math.min(color.b + spec, 1);

            r = linearToSRGB(rLin);
            g = linearToSRGB(gLin);
            b = linearToSRGB(bLin);

            // Apply lighting to base color
            cubeImg.data[idx] = r;
            cubeImg.data[idx + 1] = g;
            cubeImg.data[idx + 2] = b;
            cubeImg.data[idx + 3] = 255;
          }
        }

        cubeCtx.putImageData(cubeImg, 0, 0);
        canvases.push(cubeCanvas);
        textureData.push(faceColors);
      }
      break;
    case "sphere":
      const sphereCanvas = new OffscreenCanvas(size, size);
      const sphereCtx = sphereCanvas.getContext("2d", { willReadFrequently: true });
      const sphereImg = sphereCtx.createImageData(size, size);
      const sphereColors = Array.from({ length: size }, () => new Array(size));

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          onProgress?.();

          const color = computeSphereColor(x, y, layer, "HSL", size);
          sphereColors[y][x] = color;

          // Sphere normals 
          const nx = (2 * (x / (size - 1))) - 1;
          const ny = 1 - (2 * (y / (size - 1)));
          const rLen = Math.sqrt(nx * nx + ny * ny);
          if (rLen > 1) {
            // Outside sphere
            color.r = color.g = color.b = 0;
          } else {
            // On sphere
            const nz = Math.sqrt(1 - rLen * rLen);
            const N = new THREE.Vector3(nx, ny, nz).normalize();

            // Compute lighting
            const NdotH = Math.max(N.dot(H), 0);
            const spec = Math.pow(NdotH, shininess) * specular * 255;

            color.r = Math.min(color.r + spec, 1);
            color.g = Math.min(color.g + spec, 1);
            color.b = Math.min(color.b + spec, 1);
          }

          const idx = (y * size + x) * 4;
          sphereImg.data[idx] = linearToSRGB(color.r);
          sphereImg.data[idx + 1] = linearToSRGB(color.g);
          sphereImg.data[idx + 2] = linearToSRGB(color.b);
          sphereImg.data[idx + 3] = 255;
        }
      }
      sphereCtx.putImageData(sphereImg, 0, 0);
      canvases.push(sphereCanvas);
      textureData.push(sphereColors);
      break;
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

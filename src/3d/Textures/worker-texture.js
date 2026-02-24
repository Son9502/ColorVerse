import { computeCubeColor, computeSphereColor} from "../../color-utils.js";
// thread-texture.js
// import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.166.0/build/three.module.js';

// returns texture data for RGB and HSL color spaces
function generatePixelLayer(layer, colorSpace, type, onProgress) {
  switch (type) {
    case "cube":
      return generateCubeLayer(layer, colorSpace, onProgress);
    case "sphere":
      return generateSphereLayer(layer, colorSpace, onProgress);
    default:
      throw new Error(`Unknown type: ${type}`);
  }
}
function generateCubeLayer(layer, colorSpace, onProgress) {
  //console.log("Cube Canvases called:", layer, colorSpace);

  // Helper function to map coordinates based on flip
  function mapCoord(index, size, flip) {
    return flip ? size - 1 - index : index;
  }

  const size = 256 - (layer * 2);
  const buffers = [];
  let faceMap = [];

  switch (colorSpace) {
    case "RGB": {
      faceMap = [
        { x: { channel: "r", flip: false }, y: { channel: "g", flip: true }, fixed: { channel: "b", value: 0 } }, // Front
        { x: { channel: "b", flip: false }, y: { channel: "g", flip: true }, fixed: { channel: "r", value: 1 } }, // Right
        { x: { channel: "r", flip: true }, y: { channel: "g", flip: true }, fixed: { channel: "b", value: 1 } }, // Back
        { x: { channel: "b", flip: true }, y: { channel: "g", flip: true }, fixed: { channel: "r", value: 0 } }, // Left
        { x: { channel: "r", flip: false }, y: { channel: "b", flip: true }, fixed: { channel: "g", value: 1 } }, // Top
        { x: { channel: "r", flip: false }, y: { channel: "b", flip: false }, fixed: { channel: "g", value: 0 } }, // Bottom
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
  for (const face of faceMap) {
    const buffer = new Uint8ClampedArray(size * size * 4);

    for (let y = 0; y < size; y += 1) {
      let mapY = colorSpace == "RGB" ? mapCoord(y, size, face.y.flip) : mapCoord(y, size, true);
      for (let x = 0; x < size; x += 1) {
        // Notify worker that 1 pixel was processed.
        // Worker handles incrementing and batching progress messages.
        onProgress?.();

        let mapX = colorSpace == "RGB" ? mapCoord(x, size, face.x.flip) : mapCoord(x, size, false);

        const color = computeCubeColor(mapX, mapY, layer, face, colorSpace, size);

        const idx = (y * size + x) * 4;

        buffer[idx] = color.r * 255;
        buffer[idx + 1] = color.g * 255;
        buffer[idx + 2] = color.b * 255;
        buffer[idx + 3] = 255;
      }
    }
    buffers.push(buffer);
  }
  return buffers;
}
function generateSphereLayer(layer, colorSpace, onProgress) {

  const size = 256 - (layer * 2);
  const buffers = [];
  const buffer = new Uint8ClampedArray(size * size * 4);
  
  // let nonZero = 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      onProgress?.();

      const color = computeSphereColor(x, y, layer, colorSpace, size);
      const idx = (y * size + x) * 4;
      
      buffer[idx] = color.r * 255;
      buffer[idx + 1] = color.g * 255;
      buffer[idx + 2] = color.b * 255;
      buffer[idx + 3] = 255;
      //if (color.r !== 0 || color.g !== 0 || color.b !== 0) nonZero++;
    }
  }
  buffers.push(buffer);
  //console.log(buffer);
  //console.log(`Sphere RGB layer ${layer} non-zero pixels: ${nonZero} / ${size * size}`);
  return buffers;
}

/**
 * Worker for generating cube textures using OffscreenCanvas.
 * Receives: { id, colorSpace, layer }
 * Responds: { id, imageBitmaps, buffers } or { id, error }
 */
self.addEventListener('message', async (ev) => {
  const { id, colorSpace, layer, type } = ev.data;
  //console.log("Worker start", ev.data);
  //console.log("Worker start", { id, colorSpace, layer, type });
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

    let buffers;
    buffers = generatePixelLayer(layer, colorSpace, type, sendProgress);
    //console.log(buffers.buffer);
    const safeBuffer = buffers.map(buf => ({ data: buf.buffer, width: size, height: size}));
    //console.log(safeBuffer);
    // Send message that the process is completed 
    self.postMessage({ id, type: "completed", 
      buffers: safeBuffer, layer});

  } catch (err) {
    console.log("Worker error", err);
    self.postMessage({ id, type: "error", error: err.message || String(err) });
  }
});

import { hslToRgb, colorMap, computeColor } from "../color-utils.js";


function cubeCanvases(layer, colorSpace, onProgress) {
  //console.log("Cube Canvases called:", layer, colorSpace);
  const size = 256 - (layer * 2);
  const faceMap = colorMap(colorSpace);

  const canvases = [];
  const textureData = [];

  for (const face of faceMap) {

    const canvas = new OffscreenCanvas(size, size);

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const img = ctx.createImageData(size, size);

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
        const color = computeColor(x, y, layer, face, colorSpace, size);
        faceColors[yIndex][xIndex] = color;

        const idx = (yIndex * size + xIndex) * 4;

        if (colorSpace === "RGB") {
          img.data[idx] = color.r;
          img.data[idx + 1] = color.g;
          img.data[idx + 2] = color.b;
        } else {
          const rgb = hslToRgb(color.h, color.s, color.l);
          img.data[idx] = rgb.r;
          img.data[idx + 1] = rgb.g;
          img.data[idx + 2] = rgb.b;
        }

        img.data[idx + 3] = 255;
      }
    }

    ctx.putImageData(img, 0, 0);

    canvases.push(canvas);
    textureData.push(faceColors);
  }

  return { canvases, textureData };
}
function sphereCanvases(layer, colorSpace, onProgress) {
  //console.log("sphereCanvases called:", layer, colorSpace);

  // TODO: generate actual sphere textures
  const size = 256 - layer * 2;
  const canvas = new OffscreenCanvas(size, size);
  // Notify worker that 1 pixel was processed.
  // Worker handles incrementing and batching progress messages.
  for (let i = 0; i < size * size; i++) onProgress?.();

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = colorSpace === "RGB" ? "rgb(255,0,0)" : "hsl(0,100%,50%)";
  ctx.fillRect(0, 0, size, size);

  return { canvases: [canvas], textureData: [[[{ r: 255, g: 0, b: 0 }]]] };
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

    if (type === "cube") {
      ({ canvases, textureData } = cubeCanvases(layer, colorSpace, sendProgress));
    } else if (type === "sphere") {
      ({ canvases, textureData } = sphereCanvases(layer, colorSpace, sendProgress));
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

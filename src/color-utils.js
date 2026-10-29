import { clamp, lerp } from './utils.js';
// Color conversion and mapping utilities
export function hslToRgb(h, s, l) {
  h = h % 360;
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));

  let r = 0, g = 0, b = 0;

  if (0 <= hp && hp < 1) [r, g, b] = [c, x, 0];
  else if (1 <= hp && hp < 2) [r, g, b] = [x, c, 0];
  else if (2 <= hp && hp < 3) [r, g, b] = [0, c, x];
  else if (3 <= hp && hp < 4) [r, g, b] = [0, x, c];
  else if (4 <= hp && hp < 5) [r, g, b] = [x, 0, c];
  else if (5 <= hp && hp < 6) [r, g, b] = [c, 0, x];

  const m = l - c / 2;

  let rLin = r + m;
  let gLin = g + m;
  let bLin = b + m;

  return {
    r: rLin,
    g: gLin,
    b: bLin
  };
}
// Gamma correction from linear to sRGB (Expect 0-1 input -> 0-255 output)
export function linearToSRGB(c) {
  let s;
  s = c <= 0.0031308
    ? 12.92 * c
    : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.round(clamp(s, 0, 1) * 255);
}
// Gamma correction from sRGB to linear (Expect 0-255 input -> 0-1 output)
export function SRGBtoLinear(s) {
  let c = s / 255;
  return c <= 0.04045
    ? c / 12.92
    : Math.pow((c + 0.055) / 1.055, 2.4);
}
// Cube faces in MainCube order (front, right, back, left, top, bottom): which channel runs along
// each texture axis (RGB), or which hue quarter / cap each face shows (HSL). Shared by the texture
// worker and Color Golf's map, so both read the same layout.
export const CUBE_FACE_MAPS = {
  RGB: [
    { x: { channel: "r", flip: false }, y: { channel: "g", flip: true }, fixed: { channel: "b", value: 0 } }, // Front
    { x: { channel: "b", flip: false }, y: { channel: "g", flip: true }, fixed: { channel: "r", value: 1 } }, // Right
    { x: { channel: "r", flip: true }, y: { channel: "g", flip: true }, fixed: { channel: "b", value: 1 } }, // Back
    { x: { channel: "b", flip: true }, y: { channel: "g", flip: true }, fixed: { channel: "r", value: 0 } }, // Left
    { x: { channel: "r", flip: false }, y: { channel: "b", flip: true }, fixed: { channel: "g", value: 1 } }, // Top
    { x: { channel: "r", flip: false }, y: { channel: "b", flip: false }, fixed: { channel: "g", value: 0 } }, // Bottom
  ],
  HSL: [
    { x_start: 0, y_start: 0, loop: false }, // Front
    { x_start: 1, y_start: 0, loop: false }, // Right
    { x_start: 2, y_start: 0, loop: false }, // Back
    { x_start: 3, y_start: 0, loop: false }, // Left
    { x_start: 0, y_start: 1, loop: true },  // Top
    { x_start: 0, y_start: 0, loop: true },  // Bottom
  ],
};

// Compute color for given x, y, layer, faceMap, colorSpace, and size
export function computeCubeColor(x, y, layer, faceMap, colorSpace, size) {
  // Normalize x and y to [0, 1]
  const u = x / (size - 1);
  const v = y / (size - 1);

  // Bounds of color values
  const mini = layer / 255;
  const maxi = (layer + size - 1) / 255;
  const t = layer / 127;

  if (colorSpace === 'RGB') {
    const color = { r: 0, g: 0, b: 0 };

    color[faceMap.x.channel] = lerp(mini, maxi, u);
    color[faceMap.y.channel] = lerp(mini, maxi, v);
    color[faceMap.fixed.channel] = faceMap.fixed.value === 1 ? maxi : mini;

    return color;
  } else {
    let h, s, l;
    // Non-looping faces (Front, Right, Back, Left)
    if (!faceMap.loop) {
      // Hue: each side covers a full 90°, so neighbouring sides meet at every layer
      h = lerp(faceMap.x_start * 90, (faceMap.x_start + 1) * 90, u);

      // Saturation (decreases with layer)
      s = 1 - t;

      // Lightness
      l = lerp(mini, maxi, v);
    }
    // Looping faces (Top, Bottom)
    else {
      // Center the face; the bottom is mirrored and turned 180° so its edges line up with the sides
      let cx = u - 0.5;
      let cy = v - 0.5;
      if (faceMap.y_start === 0) cx = -cx;

      // Square "radius" (0 at the center, 0.5 on every edge) and position around the square (0–4),
      // so each edge carries the same linear 90° hue run and saturation as the side it touches
      const radius = Math.max(Math.abs(cx), Math.abs(cy));
      const r = radius || 1;
      let around;
      if (-cy >= Math.abs(cx)) around = (cx / r + 1) / 2;
      else if (cx >= Math.abs(cy)) around = 1 + (cy / r + 1) / 2;
      else if (cy >= Math.abs(cx)) around = 2 + (1 - cx / r) / 2;
      else around = 3 + (1 - cy / r) / 2;
      if (faceMap.y_start === 0) around += 2;
      h = (around % 4) * 90;

      // Saturation: 0 at the center, the sides' saturation at the edges
      s = clamp(radius * 2 * (1 - t), 0, 1);

      // Lightness
      l = faceMap.y_start === 0 ? mini : maxi;
    }
    return hslToRgb(h, s * 100, l * 100);
  }

}
export function computeSphereColor(x, y, layer, colorSpace, size) {
  // Normalize x and y to [0,1]
  const u = (x + 0.5) / size;
  const v = (y + 0.5) / size;

  // Latitude-Longitude (equal area) mapping
  const phi = 2 * Math.PI * u;             // longitude
  const theta = Math.acos(1 - 2 * v);       // latitude, prevents pole collapse

  // Convert spherical to Cartesian coordinates.
  // Texture row 0 lands at the bottom of the sphere (DataTexture, flipY = false), so y and z are negated
  // (a 180° turn about x) to put G / lightness up and match the cube and mini object
  const nx = Math.sin(theta) * Math.cos(phi);
  const ny = -Math.cos(theta);
  const nz = -Math.sin(theta) * Math.sin(phi);

  // Define layer bounds for color mapping
  const mini = layer / 255;
  const maxi = (layer + size - 1) / 255;

  if (colorSpace === "RGB") {
    // Simple linear interpolation between mini/maxi
    const r = lerp(mini, maxi, (nx + 1) * 0.5);
    const g = lerp(mini, maxi, (ny + 1) * 0.5);
    const b = lerp(mini, maxi, (nz + 1) * 0.5);
    return { r, g, b };
  } else if (colorSpace === "HSL") {
    // Convert direction to HSL
    let h = Math.atan2(nz, nx) / (2 * Math.PI);
    if (h < 0) h += 1;
    h *= 360;

    const s = Math.sqrt(nx * nx + nz * nz) * (1 - layer / 127);
    const l = lerp(mini, maxi, (ny + 1) * 0.5);

    return hslToRgb(h, s * 100, l * 100);

  } else {
    throw new Error(`Unknown colorSpace: ${colorSpace}`);
  }
}

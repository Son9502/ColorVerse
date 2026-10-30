import { computeCubeColor, computeSphereColor, CUBE_FACE_MAPS } from "../color-utils.js";
import { srgbToOklab, oklabDistance } from "./oklab.js";
import { THREE } from "../three-setup.js";

// ----------------------------------
// Color Golf map: where a color sits on the main shape
// ----------------------------------
// Every layer is drawn on the same surface (only the texture changes), so a color's spot is
// a layer plus a point on that surface. Rather than invert each texture formula by hand, this
// searches the same forward functions the texture worker uses, so markers always agree with
// what's drawn: a coarse grid over every layer, then a local refine.

// Cube faces as in MainCube._facePositions (size 1): position, rotation, UV flips
const CUBE_FACES = [
    { pos: [0, 0, 0.5], rot: [0, 0, 0], flip: [0, 1] }, // front
    { pos: [0.5, 0, 0], rot: [0, Math.PI / 2, 0], flip: [0, 1] }, // right
    { pos: [0, 0, -0.5], rot: [0, 0, Math.PI], flip: [0, 0] }, // back
    { pos: [-0.5, 0, 0], rot: [0, -Math.PI / 2, 0], flip: [0, 1] }, // left
    { pos: [0, 0.5, 0], rot: [Math.PI / 2, 0, 0], flip: [0, 0] }, // top
    { pos: [0, -0.5, 0], rot: [-Math.PI / 2, 0, 0], flip: [0, 0] }, // bottom
];

const layerSize = (layer) => 256 - layer * 2;

// Texture color at (u, v) on a cube face, mirroring worker-texture.js's pixel mapping
function cubeColor(face, u, v, layer, colorSpace) {
    const size = layerSize(layer);
    const map = CUBE_FACE_MAPS[colorSpace][face];
    const px = u * (size - 1);
    const py = v * (size - 1);
    const mapX = colorSpace === "RGB" && map.x.flip ? size - 1 - px : px;
    const mapY = colorSpace === "RGB" ? (map.y.flip ? size - 1 - py : py) : size - 1 - py;
    return computeCubeColor(mapX, mapY, layer, map, colorSpace, size);
}

// Texture color at SphereGeometry parameters (u around, v from the top pole)
function sphereColor(u, v, layer, colorSpace) {
    const size = layerSize(layer);
    return computeSphereColor(u * size - 0.5, (1 - v) * size - 0.5, layer, colorSpace, size);
}

// Object-space point for a cube face's (u, v), as PlaneGeometry + the face's transform place it
function cubePoint(face, u, v) {
    const { pos, rot, flip } = CUBE_FACES[face];
    const local = new THREE.Vector3(flip[0] ? 0.5 - u : u - 0.5, flip[1] ? 0.5 - v : v - 0.5, 0);
    return local.applyEuler(new THREE.Euler(...rot)).add(new THREE.Vector3(...pos));
}

// Object-space point for SphereGeometry (radius 1) parameters
function spherePoint(u, v) {
    const phi = u * 2 * Math.PI;
    const theta = v * Math.PI;
    return new THREE.Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta));
}

const colorError = (c, rgb) => (c.r - rgb.r) ** 2 + (c.g - rgb.g) ** 2 + (c.b - rgb.b) ** 2;
const clamp01 = (x) => Math.min(1, Math.max(0, x));

// Where `rgb` ({r, g, b} 0–1) appears on the shape: { layer, point (object space), error }
export function locateColor(rgb, shape, colorSpace) {
    const faces = shape === "cube" ? 6 : 1;
    const color = shape === "cube"
        ? (f, u, v, layer) => cubeColor(f, u, v, layer, colorSpace)
        : (f, u, v, layer) => sphereColor(u, v, layer, colorSpace);

    // Coarse: every 3rd layer, a grid on every face
    const grid = shape === "cube" ? 10 : 24;
    let best = { error: Infinity };
    for (let layer = 0; layer <= 127; layer += 3) {
        for (let f = 0; f < faces; f++) {
            for (let i = 0; i <= grid; i++) {
                for (let j = 0; j <= grid; j++) {
                    const u = i / grid;
                    const v = shape === "cube" ? j / grid : j / grid;
                    const error = colorError(color(f, u, v, layer), rgb);
                    if (error < best.error) best = { face: f, u, v, layer, error };
                }
            }
        }
    }

    // Refine: step layer and (u, v), halving the steps until they're tiny
    let du = 1 / grid;
    let dl = 2;
    while (du > 1e-4) {
        let improved = false;
        for (const [a, b, c] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
            const u = shape === "sphere" ? (best.u + a * du + 1) % 1 : clamp01(best.u + a * du);
            const v = clamp01(best.v + b * du);
            const layer = Math.min(127, Math.max(0, best.layer + c * dl));
            const error = colorError(color(best.face, u, v, layer), rgb);
            if (error < best.error) {
                best = { ...best, u, v, layer, error };
                improved = true;
            }
        }
        if (!improved) {
            du /= 2;
            dl = Math.max(1, Math.floor(dl / 2));
        }
    }

    const pointAt = (u, v) => (shape === "cube" ? cubePoint(best.face, u, v) : spherePoint(u, v));
    const point = pointAt(best.u, best.v);

    // Local scale: OKLab distance per unit of surface around the point (on its layer), so a hazard's
    // radius in yards can be drawn at the right size. Averaged over a small step in u and in v.
    const lab = (u, v) => { const c = color(best.face, u, v, best.layer); return srgbToOklab([c.r, c.g, c.b]); };
    const here = lab(best.u, best.v);
    const step = 0.01;
    const rates = [[step, 0], [0, step]].map(([du, dv]) => {
        const u = shape === "sphere" ? (best.u + du) % 1 : Math.min(1, best.u + du);
        const v = Math.min(1, best.v + dv);
        const along = point.distanceTo(pointAt(u, v));
        return along > 1e-6 ? oklabDistance(here, lab(u, v)) / along : null;
    }).filter(rate => rate !== null && rate > 0);
    const scale = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;

    return { layer: best.layer, point, error: Math.sqrt(best.error), scale };
}

// A hazard's exact footprint on one layer: the hazard is a ball in OKLab (center, radius), and the
// layer's colors that fall inside it form its footprint there. On each face (the sphere has one),
// find the face's closest color to the center; if it's inside, walk out in 48 directions until the
// color leaves each radius (bisecting the edge). A hazard that spills over a cube edge gets a patch
// on each face it reaches. Returns [{ center, outlines: [[points] per radius] }] in object space,
// empty if the hazard doesn't reach this layer.
export function footprintOnLayer(centerRgb, radii, shape, colorSpace, layer) {
    const goal = srgbToOklab([centerRgb.r, centerRgb.g, centerRgb.b]);
    const raw = shape === "cube"
        ? (f, u, v) => cubeColor(f, u, v, layer, colorSpace)
        : (f, u, v) => sphereColor(u, v, layer, colorSpace);
    const dist = (f, u, v) => { const c = raw(f, u, v); return oklabDistance(srgbToOklab([c.r, c.g, c.b]), goal); };
    const pointAt = (f, u, v) => (shape === "cube" ? cubePoint(f, u, v) : spherePoint(u, v));
    const wrapU = (u) => (shape === "sphere" ? ((u % 1) + 1) % 1 : u);
    const inside = (u, v) => v >= 0 && v <= 1 && (shape === "sphere" || (u >= 0 && u <= 1));
    const grid = shape === "cube" ? 10 : 24;

    const patches = [];
    for (let f = 0; f < (shape === "cube" ? 6 : 1); f++) {
        // Closest color on this face: grid, then refine
        let best = { d: Infinity };
        for (let i = 0; i <= grid; i++) {
            for (let j = 0; j <= grid; j++) {
                const d = dist(f, i / grid, j / grid);
                if (d < best.d) best = { u: i / grid, v: j / grid, d };
            }
        }
        for (let step = 1 / grid; step > 1e-4;) {
            let improved = false;
            for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const u = shape === "sphere" ? wrapU(best.u + a * step) : clamp01(best.u + a * step);
                const v = clamp01(best.v + b * step);
                const d = dist(f, u, v);
                if (d < best.d) { best = { u, v, d }; improved = true; }
            }
            if (!improved) step /= 2;
        }
        if (best.d >= radii[0]) continue;

        const outlines = radii.map(radius => Array.from({ length: 48 }, (_, k) => {
            const angle = (k / 48) * Math.PI * 2;
            const [cu, cv] = [Math.cos(angle), Math.sin(angle)];
            const at = (t) => [wrapU(best.u + cu * t), best.v + cv * t];
            let lo = 0;
            let hi = null;
            for (let t = 0.008; t <= 0.6; t += 0.008) {
                const [u, v] = at(t);
                if (!inside(u, v) || dist(f, u, v) >= radius) { hi = t; break; }
                lo = t;
            }
            if (hi === null) hi = lo;
            for (let i = 0; i < 6 && hi > lo; i++) { // bisect the edge
                const mid = (lo + hi) / 2;
                const [u, v] = at(mid);
                if (inside(u, v) && dist(f, u, v) < radius) lo = mid; else hi = mid;
            }
            const [u, v] = at(lo);
            return pointAt(f, clamp01(u), clamp01(v));
        }));
        patches.push({ center: pointAt(f, best.u, best.v), outlines });
    }
    return patches;
}

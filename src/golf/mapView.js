import { hslToRgb } from "../color-utils.js";
import { locateColor, footprintOnLayer } from "./map.js";
import { THREE } from "../three-setup.js";

// ----------------------------------
// Color Golf map markers on the main shape
// ----------------------------------
// A ball for the current color, a pin for the target and a trail line through each stroke.
// Markers are children of the main object, so they turn with it. On every update the shape
// peels to the current color's layer and turns that spot toward the camera.

const LIFT = 0.02; // markers sit just off the surface

const GOLD = 0xffc83d; // perfect-route replay
const WHITE = new THREE.Color(0xffffff);
const DECAL_LIFT = 0.006; // hazard footprints sit just above the texture, under the trail
const TRAIL_RADIUS = 0.008; // path thickness

const cssColor = ({ h, s, l }) => `hsl(${h}, ${s}%, ${l}%)`;

// "You": a ball in the current color with a white rim and dark outline
function drawBall(hsl, rim = "#fff") {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.arc(32, 32, 26, 0, Math.PI * 2);
    ctx.fillStyle = cssColor(hsl);
    ctx.fill();
    ctx.lineWidth = 7;
    ctx.strokeStyle = rim;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI * 2);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#111";
    ctx.stroke();
    return canvas;
}

// Footprint textures: sand speckle, or water stripes that drift (see tick)
const textures = {};
function hazardTexture(type) {
    if (textures[type]) return textures[type];
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (type === "water") {
        ctx.fillStyle = "#2a63d4";
        ctx.fillRect(0, 0, 128, 128);
        ctx.strokeStyle = "rgba(170, 205, 255, 0.7)";
        ctx.lineWidth = 3;
        for (let y = 8; y < 128; y += 16) {
            ctx.beginPath();
            for (let x = 0; x <= 128; x += 4) ctx.lineTo(x, y + Math.sin((x / 128) * Math.PI * 4) * 3);
            ctx.stroke();
        }
    } else {
        ctx.fillStyle = "#e6cd92";
        ctx.fillRect(0, 0, 128, 128);
        for (let i = 0; i < 420; i++) {
            ctx.fillStyle = i % 3 ? "#b8955a" : "#f5e6c0";
            ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
        }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 3);
    textures[type] = texture;
    return texture;
}

// Tee: a small peg where both the player's trail and the perfect route start
function drawTee() {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.arc(32, 32, 24, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#111";
    ctx.stroke();
    ctx.fillStyle = "#111";
    ctx.font = "bold 30px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("T", 32, 34);
    return canvas;
}

// Hazard icons: on the hazard's patch, or at its own spot when it doesn't reach the layer shown
// A named-wedge bunker (Expert) shows the wedge's first letters instead of grains
const WEDGE_LETTERS = { tints: "Ti", shades: "Sh", tones: "To", saturate: "Sa" };
function drawHazardIcon(type, wedge) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.fillStyle = type === "water" ? "#1f5fd6" : "#e8cf96";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#111";
    ctx.stroke();
    if (type === "water") { // two waves
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 4;
        for (const y of [26, 40]) {
            ctx.beginPath();
            ctx.moveTo(14, y);
            ctx.bezierCurveTo(22, y - 8, 28, y + 8, 36, y);
            ctx.bezierCurveTo(42, y - 8, 46, y + 6, 50, y);
            ctx.stroke();
        }
    } else if (wedge) {
        ctx.fillStyle = "#3d2b0c";
        ctx.font = "bold 28px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(WEDGE_LETTERS[wedge], 32, 34);
    } else { // sand grains
        ctx.fillStyle = "#8a6a33";
        [[22, 24], [36, 20], [44, 32], [28, 38], [40, 44], [20, 46], [32, 30]].forEach(([x, y]) => {
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        });
    }
    return canvas;
}

// Target: a pin whose foot (bottom-left) marks the spot, flag in the target color
function drawFlag(hsl) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#111";
    ctx.fillRect(13, 6, 5, 120); // pole
    ctx.beginPath(); // flag
    ctx.moveTo(18, 8);
    ctx.lineTo(112, 34);
    ctx.lineTo(18, 60);
    ctx.closePath();
    ctx.fillStyle = cssColor(hsl);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#111";
    ctx.stroke();
    ctx.beginPath(); // cup
    ctx.ellipse(15, 122, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    return canvas;
}

export class GolfMapView {
    constructor(mainObject, shape, getColorSpace, onLayer) {
        this.main = mainObject;
        this.shape = shape;
        this.getColorSpace = getColorSpace;
        this.onLayer = onLayer;
        this.group = null;
        this.cache = new Map();
        this.hazards = [];
        this.decals = [];
        this.footprints = new Map(); // traced outlines per hazard + layer
        this.flash = null; // { index, start } while a landing flash is playing
    }

    // Per frame: water ripples drift, and the hazard just landed in flashes (1 → 0 over 1.5 s, pulsing)
    tick(now = performance.now()) {
        if (!this.decals?.length) return;
        let flash = 0;
        if (this.flash) {
            const t = (now - this.flash.start) / 1500;
            if (t >= 1) this.flash = null;
            else flash = (1 - t) * (0.5 + 0.5 * Math.cos(t * Math.PI * 6));
        }
        if (textures.water) textures.water.offset.x = (now / 8000) % 1; // shared by every lake
        this.decals.forEach(({ ring, ringColor }, i) => {
            ring.forEach(mesh => mesh.material.color.copy(ringColor).lerp(WHITE, this.flash?.index === i ? flash : 0));
        });
    }

    // Footprint of a hazard on the current layer, traced exactly (golf/map.js footprintOnLayer):
    // the layer's colors inside the hazard, with an edge ring. The ball is always on this layer,
    // so it's inside the patch exactly when it's in the hazard. If the hazard doesn't reach this
    // layer, only a faint outline marks where it is. Returns where its icon goes.
    _decal(hazard, focusLayer) {
        const water = hazard.type === "water";
        const ringColor = new THREE.Color(water ? 0x0b3a8c : 0x6b4f16);
        const r = hazard.radius / 1000;
        const key = `${this.getColorSpace()}|${JSON.stringify(hazard)}|${focusLayer}`;
        if (!this.footprints.has(key)) {
            const { h, s, l } = hazard.center;
            this.footprints.set(key, footprintOnLayer(hslToRgb(h, s, l), [r], this.shape, this.getColorSpace(), focusLayer));
        }
        const patches = this.footprints.get(key);

        if (!patches.length) {
            const spot = this._locate(hazard.center);
            const radius = Math.min(0.6, Math.max(0.03, r / (spot.scale ?? 1)));
            const ring = new THREE.Mesh(this._wrap(new THREE.RingGeometry(radius * 0.96, radius, 64), spot), new THREE.MeshBasicMaterial({
                color: ringColor.clone(), transparent: true, opacity: 0.4, depthWrite: false,
            }));
            ring.renderOrder = 3;
            this.group.add(ring);
            return { fill: [], ring: [ring], type: hazard.type, wedge: hazard.wedge, ringColor, icon: spot.point.clone().addScaledVector(spot.normal, LIFT) };
        }

        const meshes = patches.map(patch => this._patch(patch, water, ringColor));
        const icon = this._onSurface(patches[0].center.clone(), LIFT);
        return { fill: meshes.map(m => m.fill), ring: meshes.map(m => m.ring), type: hazard.type, wedge: hazard.wedge, ringColor, icon };
    }

    // One traced patch: fill and edge ring
    _patch(patch, water, ringColor) {
        const [edge] = patch.outlines.map(points => points.map(p => this._onSurface(p.clone())));
        const center = this._onSurface(patch.center.clone());

        // Fill: a fan from the closest point out to the edge
        const fillGeometry = new THREE.BufferGeometry().setFromPoints([center, ...edge]);
        fillGeometry.setIndex(edge.flatMap((_, k) => [0, k + 1, ((k + 1) % edge.length) + 1]));
        fillGeometry.setAttribute("uv", new THREE.Float32BufferAttribute([center, ...edge].flatMap(p => [(p.x + p.z) * 4, p.y * 4]), 2));
        const fill = new THREE.Mesh(fillGeometry, new THREE.MeshBasicMaterial({
            map: hazardTexture(water ? "water" : "sand"), transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide,
        }));

        // Edge ring: a thin tube around the outline
        const n = edge.length;
        const path = new THREE.CurvePath();
        edge.forEach((p, k) => {
            const next = edge[(k + 1) % n];
            if (!p.equals(next)) path.add(new THREE.LineCurve3(p, next));
        });
        const ring = new THREE.Mesh(
            path.curves.length ? new THREE.TubeGeometry(path, n * 2, 0.005, 5, true) : new THREE.BufferGeometry(),
            new THREE.MeshBasicMaterial({ color: ringColor.clone() }),
        );

        [fill, ring].forEach((mesh, order) => { mesh.renderOrder = 2 + order; });
        this.group.add(fill, ring);
        return { fill, ring };
    }

    // Push a point onto the sphere or cube surface, just above the texture
    _onSurface(v, lift = DECAL_LIFT) {
        if (this.shape === "sphere") return v.setLength(1 + lift);
        return v.multiplyScalar((0.5 + lift) / (Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)) || 1));
    }

    // Bend a flat disk/ring (in the XY plane) onto the surface around `spot`: orient it along the
    // normal, then push every vertex onto the sphere or the cube, just above the texture
    _wrap(geometry, spot) {
        geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), spot.normal));
        geometry.translate(spot.point.x, spot.point.y, spot.point.z);
        const position = geometry.attributes.position;
        const v = new THREE.Vector3();
        for (let i = 0; i < position.count; i++) {
            this._onSurface(v.fromBufferAttribute(position, i));
            position.setXYZ(i, v.x, v.y, v.z);
        }
        position.needsUpdate = true;
        return geometry;
    }

    // Layer + surface point + outward normal for a whole-number HSL color (cached per color space)
    _locate({ h, s, l }) {
        const colorSpace = this.getColorSpace();
        const key = `${colorSpace}|${h},${s},${l}`;
        if (!this.cache.has(key)) {
            const found = locateColor(hslToRgb(h, s, l), this.shape, colorSpace);
            this.cache.set(key, { ...found, normal: this._normal(found.point) });
        }
        return this.cache.get(key);
    }

    // Outward normal: the sphere's radius, or the cube face the point is on
    _normal(point) {
        if (this.shape === "sphere") return point.clone().normalize();
        const axis = ["x", "y", "z"].reduce((a, b) => (Math.abs(point[a]) >= Math.abs(point[b]) ? a : b));
        return new THREE.Vector3().setComponent("xyz".indexOf(axis), Math.sign(point[axis]));
    }

    update(state) {
        this.clear();
        this.hazards = (state?.hazards ?? []).slice(0, 8);
        if (!state || !this.main.object) return;
        this._target = state.target;
        if (state.flash && state.flash.start !== this.flash?.start) this.flash = { ...state.flash };

        const current = this._locate(state.current);
        const target = this._locate(state.target);
        const lifted = (spot) => spot.point.clone().addScaledVector(spot.normal, LIFT);

        this.group = new THREE.Group();

        // Player's trail (white): tee → each stroke → current position (→ the pin once holed)
        this._trail([...state.trail, state.current], state.holed, 0xffffff);
        // Perfect-route replay (gold): tee → each stroke so far (→ the pin when it finishes)
        const replay = state.replay ?? [];
        if (replay.length) this._trail(replay, state.replayHoled, GOLD);

        // Holed: the ball has dropped, so only the path and the pin remain
        if (!state.holed) this.group.add(this._sprite(drawBall(state.current), lifted(current), 0.12, [0.5, 0.5]));
        const ghost = replay.at(-1);
        if (ghost && !state.replayHoled) {
            this.group.add(this._sprite(drawBall(ghost, "#ffc83d"), lifted(this._locate(ghost)), 0.12, [0.5, 0.5]));
        }
        this.group.add(this._sprite(drawFlag(state.target), lifted(target), 0.22, [0.12, 0.02]));
        if (state.tee) {
            const tee = this._sprite(drawTee(), lifted(this._locate(state.tee)), 0.07, [0.5, 0.5]);
            tee.renderOrder = 9; // under the ball while it's still on the tee
            tee.material.depthTest = true; // hidden on the far side, so it can't show through the shape
            this.group.add(tee);
        }
        // Follow the ghost ball during a replay, otherwise the player's ball:
        // peel to its layer and turn it to face the camera
        const focus = ghost ? this._locate(state.replayHoled ? state.target : ghost) : current;

        // Hazards: footprint on this layer, plus an icon on it
        this.decals = this.hazards.map(hazard => this._decal(hazard, focus.layer));
        this.decals.forEach(({ type, wedge, icon }) => this.group.add(this._sprite(drawHazardIcon(type, wedge), icon, wedge ? 0.1 : 0.08, [0.5, 0.5])));
        this.main.object.add(this.group);

        this.main.peelTo(focus.layer);
        this.onLayer?.(focus.layer);
        this.main.rotateToQuaternion(new THREE.Quaternion().setFromUnitVectors(focus.normal, new THREE.Vector3(0, 0, 1)));
    }

    // A path along the surface through `colors` (→ the pin if holed), with dots where strokes landed
    _trail(colors, holed, color) {
        const lifted = (spot) => spot.point.clone().addScaledVector(spot.normal, LIFT);
        const stops = colors.map(hsl => lifted(this._locate(hsl)));
        if (holed) stops.push(lifted(this._locate(this._target)));
        if (stops.length < 2) return;
        // A thin tube rather than a Line: WebGL draws lines 1 px wide whatever linewidth says
        const points = stops.slice(1).flatMap((stop, i) => this._arc(stops[i], stop));
        const path = new THREE.CurvePath();
        points.slice(1).forEach((point, i) => {
            if (!point.equals(points[i])) path.add(new THREE.LineCurve3(points[i], point));
        });
        if (path.curves.length) this.group.add(new THREE.Mesh(
            new THREE.TubeGeometry(path, points.length * 2, TRAIL_RADIUS, 6, false),
            new THREE.MeshBasicMaterial({ color }),
        ));
        stops.slice(0, holed ? -2 : -1).forEach(stop => this.group.add(this._dot(stop, color)));
    }

    // Points from a to b that stay on the (lifted) surface instead of cutting through the shape
    _arc(a, b, steps = 24) {
        return Array.from({ length: steps + 1 }, (_, i) => {
            const p = a.clone().lerp(b, i / steps);
            if (this.shape === "sphere") return p.setLength(1 + LIFT);
            const extent = Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z)) || 1;
            return p.multiplyScalar((0.5 + LIFT) / extent);
        });
    }

    _dot(position, color = 0xffffff) {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(TRAIL_RADIUS * 2, 12, 12), new THREE.MeshBasicMaterial({ color }));
        dot.position.copy(position);
        return dot;
    }

    // Screen-facing icon; `anchor` is the point of the image that sits on the spot
    _sprite(canvas, position, size, anchor) {
        const texture = new THREE.CanvasTexture(canvas);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
        sprite.center.set(anchor[0], anchor[1]);
        sprite.scale.set(size, size, 1);
        sprite.position.copy(position);
        sprite.renderOrder = 10; // drawn over the surface and trail
        return sprite;
    }

    clear() {
        if (!this.group) return;
        this.group.removeFromParent();
        this.group.traverse(obj => {
            obj.geometry?.dispose();
            if (!Object.values(textures).includes(obj.material?.map)) obj.material?.map?.dispose(); // footprint textures are shared
            obj.material?.dispose();
        });
        this.group = null;
    }
}

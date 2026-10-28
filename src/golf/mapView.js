import { hslToRgb } from "../color-utils.js";
import { locateColor } from "./map.js";

// ----------------------------------
// Color Golf map markers on the main shape
// ----------------------------------
// A ball for the current color, a pin for the target and a trail line through each stroke.
// Markers are children of the main object, so they turn with it. On every update the shape
// peels to the current color's layer and turns that spot toward the camera.

const LIFT = 0.02; // markers sit just off the surface

const GOLD = 0xffc83d; // perfect-route replay

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
        if (!state || !this.main.object) return;
        this._target = state.target;

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
        this.main.object.add(this.group);

        // Follow the ghost ball during a replay, otherwise the player's ball:
        // peel to its layer and turn it to face the camera
        const focus = ghost ? this._locate(state.replayHoled ? state.target : ghost) : current;
        this.main.layerTarget = focus.layer;
        this.onLayer?.(focus.layer);
        this.main.rotateToQuaternion(new THREE.Quaternion().setFromUnitVectors(focus.normal, new THREE.Vector3(0, 0, 1)));
    }

    // A path along the surface through `colors` (→ the pin if holed), with dots where strokes landed
    _trail(colors, holed, color) {
        const lifted = (spot) => spot.point.clone().addScaledVector(spot.normal, LIFT);
        const stops = colors.map(hsl => lifted(this._locate(hsl)));
        if (holed) stops.push(lifted(this._locate(this._target)));
        if (stops.length < 2) return;
        const points = stops.slice(1).flatMap((stop, i) => this._arc(stops[i], stop));
        this.group.add(new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(points),
            new THREE.LineBasicMaterial({ color }),
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
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 12), new THREE.MeshBasicMaterial({ color }));
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
        this.group.parent?.remove(this.group); // (removeFromParent() needs r129+; the app uses r128)
        this.group.traverse(obj => {
            obj.geometry?.dispose();
            obj.material?.map?.dispose();
            obj.material?.dispose();
        });
        this.group = null;
    }
}

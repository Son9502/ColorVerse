import { STATE_COUNT, encode } from "./clubs.js";
import { hslToOklab, oklabDistance } from "./oklab.js";

// ----------------------------------
// Color Golf hazards: sand, water, portals and black holes
// ----------------------------------
// A hazard is a "looks-like" region of color space: { type: "sand" | "water" | "portal" | "blackhole", center: {h, s, l},
// radius } with the radius in yards (OKLab distance × 1000), the same measure as yards and the hole.
//
// Rules (see game.js and solver.js):
// - Water: +1 penalty stroke and the ball returns to where it was hit from.
// - Sand: the next shot must be a wedge (Tints, Shades, Tones, Saturate); no putter.
//   An Expert bunker (v1.4) names one wedge (`wedge: "shades"`), and only that one can be played.
// - Portal (v1.8): the ball warps straight to the portal's `exit` color, which is never inside any
//   region. Only the landing matters, so the solver stays exact. Water wins over a portal, a portal
//   over sand, if regions ever overlap.
// - Black hole (v1.8): +1 penalty stroke and the ball goes back to the tee. Like water, landing in
//   one is never worth it, so the solver skips those strokes. A black hole wins over everything.

export const WEDGES = ["tints", "shades", "tones", "saturate"];
export const WEDGE_ROWS = new Set(WEDGES);
export const isWedge = (club) => WEDGE_ROWS.has(club.row);

const NONE = 1;
const SAND = 2; // any wedge; SAND + 1 + i: only WEDGES[i]
const WATER = 7;
const BLACK_HOLE = 8;
const PORTAL = 9; // PORTAL + i: inside the portal at hazards[i]

// Which hazard a color is in, memoized per whole-number HSL state.
// A black hole wins if a color is somehow inside several, then water.
export function hazardMap(hazards = []) {
    const centers = hazards.map(h => ({ type: h.type, center: hslToOklab(h.center), radius: h.radius / 1000, wedge: h.wedge }));
    const cache = centers.length ? new Uint8Array(STATE_COUNT) : null;

    const classify = (hsl) => {
        const lab = hslToOklab(hsl);
        let found = NONE;
        if (centers.some(({ type, center, radius }) => type === "blackhole" && oklabDistance(lab, center) < radius)) return BLACK_HOLE;
        for (const [i, { type, center, radius, wedge }] of centers.entries()) {
            if (oklabDistance(lab, center) >= radius) continue;
            if (type === "blackhole") continue;
            if (type === "water") return WATER;
            if (type === "portal") { if (found < PORTAL) found = PORTAL + i; }
            else if (found === NONE) found = wedge ? SAND + 1 + WEDGES.indexOf(wedge) : SAND; // the first bunker's rule
        }
        return found;
    };
    const kind = (hsl, code) => {
        if (!cache[code]) cache[code] = classify(hsl);
        return cache[code];
    };

    // "sand", "water", "portal", "blackhole" or null
    const at = (hsl, code = encode(hsl)) => {
        if (!cache) return null;
        const k = kind(hsl, code);
        return k >= PORTAL ? "portal" : k === BLACK_HOLE ? "blackhole" : k === WATER ? "water" : k === NONE ? null : "sand";
    };

    // The portal a color is in (its hazard object), or null
    const portalAt = (hsl, code = encode(hsl)) => {
        if (!cache) return null;
        const k = kind(hsl, code);
        return k >= PORTAL ? hazards[k - PORTAL] : null;
    };

    // Where a ball that lands on `hsl` ends up: the portal's exit, or right there
    const land = (hsl, code = encode(hsl)) => portalAt(hsl, code)?.exit ?? hsl;

    // In a bunker: the one wedge row allowed there, or null if any wedge is (also null outside sand)
    const wedgeAt = (hsl, code = encode(hsl)) => {
        if (!cache) return null;
        const k = kind(hsl, code);
        return k > SAND && k < WATER ? WEDGES[k - SAND - 1] : null;
    };

    // Whether `club` can be played from `hsl`: anything outside sand; in sand, a wedge (the named one, if any)
    const allows = (hsl, club, code = encode(hsl)) => {
        if (at(hsl, code) !== "sand") return true;
        const wedge = wedgeAt(hsl, code);
        return wedge ? club.row === wedge : isWedge(club);
    };

    // The hazard object itself (for the landing highlight and yardage): the one whose rule applies
    const which = (hsl) => {
        const portal = portalAt(hsl);
        if (portal) return portal;
        const type = at(hsl);
        const lab = hslToOklab(hsl);
        const inside = (h, i) => oklabDistance(lab, centers[i].center) < centers[i].radius;
        return hazards.find((h, i) => (type === "sand" ? h.type === "sand" : h.type === type) && inside(h, i)) ?? null;
    };

    return { hazards, at, portalAt, land, wedgeAt, allows, which, empty: !centers.length };
}

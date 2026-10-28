import { STATE_COUNT, encode } from "./clubs.js";
import { hslToOklab, oklabDistance } from "./oklab.js";

// ----------------------------------
// Color Golf hazards: sand and water
// ----------------------------------
// A hazard is a "looks-like" region of color space: { type: "sand" | "water", center: {h, s, l},
// radius } with the radius in yards (OKLab distance × 1000), the same measure as yards and the hole.
//
// Rules (see game.js and solver.js):
// - Water: +1 penalty stroke and the ball returns to where it was hit from.
// - Sand: the next shot must be a wedge (Tints, Shades, Tones, Saturate); no putter.

export const WEDGE_ROWS = new Set(["tints", "shades", "tones", "saturate"]);
export const isWedge = (club) => WEDGE_ROWS.has(club.row);

const NONE = 1;
const SAND = 2;
const WATER = 3;

// Which hazard a color is in, memoized per whole-number HSL state.
// Water wins if a color is somehow inside both.
export function hazardMap(hazards = []) {
    const centers = hazards.map(h => ({ type: h.type, center: hslToOklab(h.center), radius: h.radius / 1000 }));
    const cache = centers.length ? new Uint8Array(STATE_COUNT) : null;

    const classify = (hsl) => {
        const lab = hslToOklab(hsl);
        let found = NONE;
        for (const { type, center, radius } of centers) {
            if (oklabDistance(lab, center) >= radius) continue;
            if (type === "water") return WATER;
            found = SAND;
        }
        return found;
    };

    // "sand", "water" or null
    const at = (hsl, code = encode(hsl)) => {
        if (!cache) return null;
        if (!cache[code]) cache[code] = classify(hsl);
        return cache[code] === SAND ? "sand" : cache[code] === WATER ? "water" : null;
    };

    // The hazard object itself (for the landing highlight and yardage)
    const which = (hsl) => {
        const lab = hslToOklab(hsl);
        return hazards.find((h, i) => oklabDistance(lab, centers[i].center) < centers[i].radius) ?? null;
    };

    return { hazards, at, which, empty: !centers.length };
}

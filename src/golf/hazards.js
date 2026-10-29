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
//   An Expert bunker (v1.4) names one wedge (`wedge: "shades"`), and only that one can be played.

export const WEDGES = ["tints", "shades", "tones", "saturate"];
export const WEDGE_ROWS = new Set(WEDGES);
export const isWedge = (club) => WEDGE_ROWS.has(club.row);

const NONE = 1;
const SAND = 2; // any wedge; SAND + 1 + i: only WEDGES[i]
const WATER = 7;

// Which hazard a color is in, memoized per whole-number HSL state.
// Water wins if a color is somehow inside both.
export function hazardMap(hazards = []) {
    const centers = hazards.map(h => ({ type: h.type, center: hslToOklab(h.center), radius: h.radius / 1000, wedge: h.wedge }));
    const cache = centers.length ? new Uint8Array(STATE_COUNT) : null;

    const classify = (hsl) => {
        const lab = hslToOklab(hsl);
        let found = NONE;
        for (const { type, center, radius, wedge } of centers) {
            if (oklabDistance(lab, center) >= radius) continue;
            if (type === "water") return WATER;
            if (found === NONE) found = wedge ? SAND + 1 + WEDGES.indexOf(wedge) : SAND; // the first bunker's rule
        }
        return found;
    };
    const kind = (hsl, code) => {
        if (!cache[code]) cache[code] = classify(hsl);
        return cache[code];
    };

    // "sand", "water" or null
    const at = (hsl, code = encode(hsl)) => {
        if (!cache) return null;
        const k = kind(hsl, code);
        return k === WATER ? "water" : k === NONE ? null : "sand";
    };

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

    // The hazard object itself (for the landing highlight and yardage)
    const which = (hsl) => {
        const lab = hslToOklab(hsl);
        return hazards.find((h, i) => oklabDistance(lab, centers[i].center) < centers[i].radius) ?? null;
    };

    return { hazards, at, wedgeAt, allows, which, empty: !centers.length };
}

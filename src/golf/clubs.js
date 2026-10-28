import { harmonyDict } from "../harmonyMath.js";
import { clamp } from "../utils.js";

// ----------------------------------
// Color Golf clubs: every move a stroke can make
// ----------------------------------
// Game state is whole-number HSL (h 0–359, s 0–100, l 0–100), the same values the swatches show.
// Rounding after every stroke keeps the game and the par solver in exact agreement.

export const PUTT = 4; // putter nudge, in degrees (hue) or percentage points (s, l)

const HARMONY_ROWS = [
    "complementary", "split-complementary", "triadic", "tetradic", "double-complementary",
    "analogous", "tints", "shades", "tones", "saturate",
];

// Putter row: game mode only, small nudges so a near miss can be finished
export const PUTTER = [
    { label: "Hue −", apply: ({ h, s, l }) => ({ h: h - PUTT, s, l }) },
    { label: "Hue +", apply: ({ h, s, l }) => ({ h: h + PUTT, s, l }) },
    { label: "Sat −", apply: ({ h, s, l }) => ({ h, s: s - PUTT, l }) },
    { label: "Sat +", apply: ({ h, s, l }) => ({ h, s: s + PUTT, l }) },
    { label: "Light −", apply: ({ h, s, l }) => ({ h, s, l: l - PUTT }) },
    { label: "Light +", apply: ({ h, s, l }) => ({ h, s, l: l + PUTT }) },
];

// Every club as { row, index }: harmony rows in panel order, then the putter
export const CLUBS = [
    ...HARMONY_ROWS.flatMap(row => harmonyDict({ h: 0, s: 0, l: 0 })[row].map((_, index) => ({ row, index }))),
    ...PUTTER.map((_, index) => ({ row: "putter", index })),
];

export function roundHSL({ h, s, l }) {
    return {
        h: ((Math.round(h) % 360) + 360) % 360,
        s: clamp(Math.round(s), 0, 100),
        l: clamp(Math.round(l), 0, 100),
    };
}

// All results from one position, in CLUBS order
export function allStrikes(hsl) {
    const harmonies = harmonyDict(hsl);
    return [
        ...HARMONY_ROWS.flatMap(row => harmonies[row].map(roundHSL)),
        ...PUTTER.map(club => roundHSL(club.apply(hsl))),
    ];
}

// One stroke with a given club
export function strike(hsl, { row, index }) {
    if (row === "putter") return roundHSL(PUTTER[index].apply(hsl));
    return roundHSL(harmonyDict(hsl)[row][index]);
}

// Pack HSL into one integer (and back), for the solver's lookup tables
export const STATE_COUNT = 360 * 101 * 101;
export const encode = ({ h, s, l }) => (h * 101 + s) * 101 + l;
export const decode = (code) => ({ h: Math.floor(code / 10201), s: Math.floor(code / 101) % 101, l: code % 101 });

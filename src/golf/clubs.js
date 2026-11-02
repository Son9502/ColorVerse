import { harmonyDict } from "../harmonyMath.js";
import { clamp } from "../utils.js";
import { hslToHex } from "./oklab.js";

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

// Roulette (v1.8.4, Scarlet Roulette): four hue shifts set per hole (rules.js: roulette), a full shot
// each. Only on holes that have them, so they're not among allStrikes' usual 41.
export const ROULETTE_SLOTS = 4;

// Flip (v1.8.5, Hexflip Hollow): five clubs that move the color's hex digits left by 1–5 places
// (#A23432 → #23432A), a full shot each. Only on holes whose rules have `flip`.
export const FLIPS = 5;

// Every club as { row, index }: harmony rows in panel order, then the putter, the roulette and the
// flip (new clubs go at the end, so recorded rounds keep their club ids)
export const CLUBS = [
    ...HARMONY_ROWS.flatMap(row => harmonyDict({ h: 0, s: 0, l: 0 })[row].map((_, index) => ({ row, index }))),
    ...PUTTER.map((_, index) => ({ row: "putter", index })),
    ...Array.from({ length: ROULETTE_SLOTS }, (_, index) => ({ row: "roulette", index })),
    ...Array.from({ length: FLIPS }, (_, index) => ({ row: "flip", index })),
];
export const STANDARD_CLUBS = CLUBS.filter(club => club.row !== "roulette" && club.row !== "flip"); // every hole's 41

// Clubs that always land where another does (v1.8.5): Tetradic and Double-comp. +180° are
// Complementary, Double-comp. +240° is Triadic −120°. Golf doesn't show them (golf-ui.js: the long
// row) and the perfect line doesn't count them; they stay in CLUBS so recorded rounds keep their ids.
export const COPIES = new Set(CLUBS.flatMap((club, i) =>
    (club.row === "tetradic" && club.index === 1) || (club.row === "double-complementary" && club.index > 0) ? [i] : []));

// A club as one small number (its place in CLUBS) and back, for recorded rounds (v1.6)
export const clubId = ({ row, index }) => CLUBS.findIndex(club => club.row === row && club.index === index);
export const clubById = (id) => CLUBS[id] ?? null;

export function roundHSL({ h, s, l }) {
    return {
        h: ((Math.round(h) % 360) + 360) % 360,
        s: clamp(Math.round(s), 0, 100),
        l: clamp(Math.round(l), 0, 100),
    };
}

// Wind (v1.2): a fixed drift per hole, { hue } in degrees or { light } in percentage points,
// added to every full shot's landing (any harmony club). Putts are unaffected (greens are sheltered).
// Drifts are whole numbers, so states stay whole-number HSL and the solver stays exact.
export const CALM = null;
const blow = (hsl, wind) => (wind ? { h: hsl.h + (wind.hue ?? 0), s: hsl.s, l: hsl.l + (wind.light ?? 0) } : hsl);

// All results from one position, in CLUBS order: the 41 harmony and putter shots, then a hole's
// roulette shifts (`roulette`: 4 hue shifts in degrees) if it has them, then the five flips if `flip`.
// Index i is always CLUBS[i]'s landing: on a flip hole without a roulette, the roulette's places are null.
export function allStrikes(hsl, wind = CALM, roulette = null, flip = false) {
    const harmonies = harmonyDict(hsl);
    const shifts = roulette ?? (flip ? Array(ROULETTE_SLOTS).fill(null) : []);
    return [
        ...HARMONY_ROWS.flatMap(row => harmonies[row].map(landing => roundHSL(blow(roundHSL(landing), wind)))),
        ...PUTTER.map(club => roundHSL(club.apply(hsl))),
        ...shifts.map(shift => (shift === null ? null : roundHSL(blow({ h: hsl.h + shift, s: hsl.s, l: hsl.l }, wind)))),
        ...(flip ? Array.from({ length: FLIPS }, (_, index) => roundHSL(blow(flipOf(hsl, index + 1), wind))) : []),
    ];
}

// One stroke with a given club (the swatch shows the calm landing; wind then drifts it).
// A roulette club needs the hole's shifts.
export function strike(hsl, { row, index }, wind = CALM, roulette = null) {
    if (row === "roulette") return roundHSL(blow({ h: hsl.h + roulette[index], s: hsl.s, l: hsl.l }, wind));
    if (row === "flip") return roundHSL(blow(flipOf(hsl, index + 1), wind));
    if (row === "putter") return roundHSL(PUTTER[index].apply(hsl));
    return roundHSL(blow(roundHSL(harmonyDict(hsl)[row][index]), wind));
}

// The color whose hex is this one's backwards (#234243 → #342432), as whole-number HSL: where a
// mirror (v1.8.1) sends a ball that lands on it
export const mirrorOf = (hsl) => hexToHSL([...hslToHex(hsl).slice(1)].reverse().join(""));

// The color whose hex is this one's moved left by `places` digits (#A23432 by 1 → #23432A), as
// whole-number HSL: a flip club's landing (v1.8.5)
export function flipOf(hsl, places) {
    const hex = hslToHex(hsl).slice(1);
    return hexToHSL(hex.slice(places) + hex.slice(0, places));
}

// Six hex digits (no #) as whole-number HSL
function hexToHSL(hex) {
    const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    const h = d === 0 ? 0 : max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
    return roundHSL({ h, s: s * 100, l: l * 100 });
}

// Pack HSL into one integer (and back), for the solver's lookup tables
export const STATE_COUNT = 360 * 101 * 101;
export const encode = ({ h, s, l }) => (h * 101 + s) * 101 + l;
export const decode = (code) => ({ h: Math.floor(code / 10201), s: Math.floor(code / 101) % 101, l: code % 101 });

import { clamp } from "./utils.js";
// Harmony formulas on {h: 0–360, s: 0–100, l: 0–100}.
// No DOM access, so Color Golf's par solver can run them in a worker.

export function setHue(h, shift) {
    return (h + shift + 360) % 360;
}
export function harmonyDict(baseColor) {
    const { h, s, l } = baseColor;

    const steps = [20, 40, 60, 80, 100];

    return {
        "complementary": [
            { h: setHue(h, 180), s, l }
        ],
        "split-complementary": [
            { h: setHue(h, 150), s, l },
            { h: setHue(h, 210), s, l }
        ],
        "triadic": [
            { h: setHue(h, 120), s, l },
            { h: setHue(h, -120), s, l }
        ],
        "tetradic": [
            { h: setHue(h, 90), s, l },
            { h: setHue(h, 180), s, l },
            { h: setHue(h, 270), s, l }
        ],
        "double-complementary": [
            { h: setHue(h, 60), s, l },
            { h: setHue(h, 180), s, l },
            { h: setHue(h, 240), s, l }
        ],
        "analogous": [
            { h: setHue(h, -40), s, l },
            { h: setHue(h, -20), s, l },
            { h: setHue(h, 20), s, l },
            { h: setHue(h, 40), s, l }
        ],
        "tints": steps.map(v => ({ h: h, s: s, l: clamp(l + (100 - l) * (v / 100), 0, 100) })),
        "shades": steps.map(v => ({ h: h, s: s, l: clamp(l * (1 - v / 100), 0, 100) })),
        "tones": steps.map(v => ({ h: h, s: clamp(s * (1 - v / 100), 0, 100), l: clamp(l + (50 - l) * (v / 100), 0, 100) })),
        // Mirror of tones: the only harmony that raises saturation, so muted colors can reach vivid ones
        "saturate": steps.map(v => ({ h: h, s: clamp(s + (100 - s) * (v / 100), 0, 100), l: l }))
    };
}

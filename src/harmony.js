import { clamp } from "./utils.js";
export const harmonySets = {
    "complementary": ["comp1"],
    "split-complementary": ["split-comp1", "split-comp2"],
    "triadic": ["triad1", "triad2"],
    "tetradic": ["tetra1", "tetra2", "tetra3"],
    "double-complementary": ["dcomp1", "dcomp2", "dcomp3"],
    "analogous": ["analog1", "analog2", "analog3", "analog4"],
    "tints": ["light1", "light2", "light3", "light4", "light5"],
    "shades": ["dark5", "dark4", "dark3", "dark2", "dark1"],
    "tones": ["tone1", "tone2", "tone3", "tone4", "tone5"],
    "saturate": ["sat1", "sat2", "sat3", "sat4", "sat5"]
};

const hexInfo = document.getElementById("hex");
const rgbInfo = document.getElementById("rgb");
const hslInfo = document.getElementById("hsl");

for (const type in harmonySets) {
    harmonySets[type] = harmonySets[type].map(id => {
        const box = document.getElementById(id);
        const label = box?.parentElement.querySelector(".square-label");
        return { box, label };
    });
}

// Make `color` the selected base color: details card + harmonies
export function selectBaseColor(color, name = "") {
    const baseCircle = document.getElementById("base-circle");
    const colorName = document.getElementById("color-name");

    document.querySelectorAll(".color-info").forEach(box => box.classList.add("show"));
    if (baseCircle) baseCircle.style.backgroundColor = color;
    if (colorName) colorName.textContent = name;
    setBaseColors(color);
}

// Double-click a harmony swatch to make it the base color
export function setupSwatchSelection() {
    const container = document.getElementById("ui-container");
    container?.addEventListener("dblclick", (event) => {
        const square = event.target.closest(".square");
        // Swatches are transparent until a base color is picked
        if (!square || !document.getElementById("base-color")?.classList.contains("show")) return;
        const color = square.style.backgroundColor;
        if (color) selectBaseColor(color);
    });
}

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
export function resetColors() {
    if (hexInfo) {
        hexInfo.textContent = "#xxxxxx";
    }
    if (rgbInfo) {
        rgbInfo.textContent = "RGB(xxx,xxx,xxx)";
    }
    if (hslInfo) {
        hslInfo.textContent = "HSL(xxx,xxx,xxx)";
    }
    for (const elements of Object.values(harmonySets)) {
        elements.forEach(element => {
            if (element.box) {
                element.box.style.backgroundColor = `hsl(0,0%,0%,0)`;
            }
            if (element.label) {
                element.label.textContent = "#xxxxxx"
            }
        });
    }
}
export function setBaseColors(color) {
    if (!(color instanceof THREE.Color)) {
        color = new THREE.Color(color);
    }
    const hex = `#${color.getHexString()}`;

    const rgb = {
        r: Math.round(color.r * 255),
        g: Math.round(color.g * 255),
        b: Math.round(color.b * 255)
    };

    const hsl = {};
    color.getHSL(hsl);
    const newHSL = {
        h: Math.round(hsl.h * 360),
        s: Math.round(hsl.s * 100),
        l: Math.round(hsl.l * 100)
    };

    const harmonies = harmonyDict(newHSL);

    if (hexInfo) {
        hexInfo.textContent = hex.toUpperCase();
    }
    if (rgbInfo) {
        rgbInfo.textContent = `RGB(${rgb.r},${rgb.g},${rgb.b})`;
    }
    if (hslInfo) {
        hslInfo.textContent = `HSL(${newHSL.h}º,${newHSL.s}%,${newHSL.l}%)`;
    }

    for (const [type, elements] of Object.entries(harmonySets)) {
        const set = harmonies[type];
        elements.forEach((element, index) => {
            if (!element.box || !set[index]) return;
            const { h, s, l } = set[index]
            const colour = `hsl(${Math.round(h)},${Math.round(s)}%,${Math.round(l)}%)`;

            element.box.style.backgroundColor = colour;

            if (element.label) {
                const hexText = "#" + new THREE.Color(colour).getHexString().toUpperCase();
                element.label.textContent = hexText;
            }
        });
    };
}
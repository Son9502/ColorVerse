import { harmonyDict } from "./harmonyMath.js";
import { THREE } from "./three-setup.js";
import { lastPointerType } from "./pointer.js";
import { describeColor } from "./color-names.js";
export { harmonyDict, setHue } from "./harmonyMath.js";
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
        return { box, label, name: addNameLabel(box) };
    });
}

// Make `color` the selected base color: details card + harmonies
// `source` is passed through to the "basecolorchange" event (sliders ignore their own updates)
// `exactHSL` (whole-number {h, s, l}) skips re-deriving HSL from RGB; Color Golf uses it so the
// swatches match its strokes exactly
// A swatch's color in words, under its hex label (shown with "Color names" on, color-names.js)
export function addNameLabel(box) {
    if (!box) return null;
    const name = document.createElement("p");
    name.className = "square-name";
    box.parentElement.append(name);
    return name;
}

export function selectBaseColor(color, name = "", source = "", exactHSL = null) {
    const baseCircle = document.getElementById("base-circle");
    const colorName = document.getElementById("color-name");

    document.querySelectorAll(".color-info").forEach(box => box.classList.add("show"));
    if (baseCircle) baseCircle.style.backgroundColor = color;
    if (colorName) colorName.textContent = name;
    setBaseColors(color, source, exactHSL);
}

// Clear the selected color; the panel switches back to Color Search (see index.css)
export function clearBaseColor() {
    const baseCircle = document.getElementById("base-circle");
    const colorName = document.getElementById("color-name");

    document.querySelectorAll(".color-info").forEach(box => box.classList.remove("show"));
    if (baseCircle) baseCircle.style.backgroundColor = "transparent";
    if (colorName) colorName.textContent = "";
    resetColors(); // dispatches "basecolorclear"
}

// The swatch an arrow key moves to: along the row, or the nearest place in the row above or below.
// Hidden and collapsed rows are skipped.
export function swatchNeighbour(square, key) {
    const rows = [...document.querySelectorAll("#ui-container .colors-row:not(.collapsed) .swatch-row")]
        .map(row => [...row.querySelectorAll(".square")].filter(swatch => swatch.offsetParent !== null))
        .filter(row => row.length);
    const r = rows.findIndex(row => row.includes(square));
    if (r < 0) return null;
    const i = rows[r].indexOf(square);
    const inRow = (row) => (row ? row[Math.min(i, row.length - 1)] : null);
    switch (key) {
        case "ArrowLeft": return rows[r][i - 1] ?? null;
        case "ArrowRight": return rows[r][i + 1] ?? null;
        case "ArrowUp": return inRow(rows[r - 1]);
        case "ArrowDown": return inRow(rows[r + 1]);
        default: return null;
    }
}

// Choose a harmony swatch as the base color: double-click with a mouse, tap on a touch screen, or
// Enter / Space with the keyboard (arrow keys move between swatches). In a Color Golf game the same
// gestures play a stroke instead (golf-ui.js).
export function setupSwatchSelection() {
    const container = document.getElementById("ui-container");
    if (!container) return;
    const choose = (square) => {
        // Swatches are transparent until a base color is picked
        if (!square || document.body.classList.contains("golf") || !document.getElementById("base-color")?.classList.contains("show")) return;
        const color = square.style.backgroundColor;
        if (color) selectBaseColor(color);
    };
    container.addEventListener("dblclick", (event) => {
        if (lastPointerType() !== "touch") choose(event.target.closest(".square"));
    });
    container.addEventListener("click", (event) => {
        if (lastPointerType() === "touch") choose(event.target.closest(".square"));
    });

    container.querySelectorAll(".square").forEach(square => {
        square.tabIndex = 0;
        square.setAttribute("role", "button");
    });
    container.addEventListener("keydown", (event) => {
        const square = event.target.closest?.(".square");
        if (!square) return;
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            choose(square);
            return;
        }
        const next = swatchNeighbour(square, event.key);
        if (next) {
            event.preventDefault();
            next.focus();
        }
    });
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
            if (element.name) element.name.textContent = "";
            element.box?.removeAttribute("aria-label");
        });
    }
    document.dispatchEvent(new CustomEvent("basecolorclear"));
}
export function setBaseColors(color, source = "", exactHSL = null) {
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
    const newHSL = exactHSL ?? {
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
    const description = document.getElementById("color-description");
    if (description) description.textContent = describeColor(newHSL);

    for (const [type, elements] of Object.entries(harmonySets)) {
        const set = harmonies[type];
        elements.forEach((element, index) => {
            if (!element.box || !set[index]) return;
            const { h, s, l } = set[index]
            const colour = `hsl(${Math.round(h)},${Math.round(s)}%,${Math.round(l)}%)`;

            element.box.style.backgroundColor = colour;

            const hexText = "#" + new THREE.Color(colour).getHexString().toUpperCase();
            const name = describeColor({ h: Math.round(h), s: Math.round(s), l: Math.round(l) });
            if (element.label) element.label.textContent = hexText;
            if (element.name) element.name.textContent = name;
            element.box.dataset.name = name; // golf-ui.js adds it to the club's label
            element.box.setAttribute("aria-label", `${hexText}, ${name}`);
        });
    };
    // Lets other UI (e.g. sliders) follow the selected color
    document.dispatchEvent(new CustomEvent("basecolorchange", { detail: { color, source } }));
}
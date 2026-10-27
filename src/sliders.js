// ----------------------------------
// HSL / RGB Sliders (color details card)
// ----------------------------------
import { selectBaseColor } from "./harmony.js";

const SPACES = {
    HSL: [
        { name: "H", max: 360, unit: "°" },
        { name: "S", max: 100, unit: "%" },
        { name: "L", max: 100, unit: "%" },
    ],
    RGB: [
        { name: "R", max: 255, unit: "" },
        { name: "G", max: 255, unit: "" },
        { name: "B", max: 255, unit: "" },
    ],
};

export function setupSliders() {
    const toggle = document.getElementById("toggle");
    const rows = [...document.querySelectorAll("#color-sliders .slider-row")].map(row => ({
        label: row.querySelector(".slider-name"),
        input: row.querySelector("input"),
        output: row.querySelector("output"),
    }));

    let space = toggle.checked ? "HSL" : "RGB";
    let values = [0, 0, 0];     // current values in `space`
    let color = null;           // selected THREE.Color, null when nothing is selected

    // Read the selected color into slider values for the current space
    const valuesFromColor = () => {
        if (space === "HSL") {
            const hsl = {};
            color.getHSL(hsl);
            return [Math.round(hsl.h * 360), Math.round(hsl.s * 100), Math.round(hsl.l * 100)];
        }
        return [color.r, color.g, color.b].map(c => Math.round(c * 255));
    };

    const cssFor = (v) => space === "HSL"
        ? `hsl(${v[0]}, ${v[1]}%, ${v[2]}%)`
        : `rgb(${v[0]}, ${v[1]}, ${v[2]})`;

    // Track gradient shows what each slider does, given the other two values
    const trackFor = (i) => {
        const [a, b, c] = values;
        if (space === "HSL") {
            if (i === 0) return `linear-gradient(to right, ${[0, 60, 120, 180, 240, 300, 360].map(h => `hsl(${h}, ${b}%, ${c}%)`).join(", ")})`;
            if (i === 1) return `linear-gradient(to right, hsl(${a}, 0%, ${c}%), hsl(${a}, 100%, ${c}%))`;
            return `linear-gradient(to right, hsl(${a}, ${b}%, 0%), hsl(${a}, ${b}%, 50%), hsl(${a}, ${b}%, 100%))`;
        }
        const lo = [...values], hi = [...values];
        lo[i] = 0; hi[i] = 255;
        return `linear-gradient(to right, rgb(${lo.join(",")}), rgb(${hi.join(",")}))`;
    };

    const render = () => {
        SPACES[space].forEach((def, i) => {
            const { label, input, output } = rows[i];
            label.textContent = def.name;
            input.max = def.max;
            input.value = values[i];
            input.disabled = !color;
            input.setAttribute("aria-label", `${space} ${def.name}`);
            input.style.background = color ? trackFor(i) : "";
            output.textContent = color ? `${values[i]}${def.unit}` : "–";
        });
    };

    rows.forEach((row, i) => {
        row.input.addEventListener("input", () => {
            values[i] = Number(row.input.value);
            // "slider" source: keep our own values instead of re-deriving them from RGB,
            // so e.g. hue doesn't snap to 0 when saturation hits 0
            selectBaseColor(cssFor(values), "", "slider");
            render();
        });
    });

    document.addEventListener("basecolorchange", (event) => {
        color = event.detail.color;
        if (event.detail.source !== "slider") values = valuesFromColor();
        render();
    });

    document.addEventListener("basecolorclear", () => {
        color = null;
        render();
    });

    // Sliders follow the HSL toggle
    toggle.addEventListener("change", () => {
        space = toggle.checked ? "HSL" : "RGB";
        if (color) values = valuesFromColor();
        render();
    });

    render();
}

// ----------------------------------
// Color names (v1.7)
// ----------------------------------
// A plain description of any HSL color ("dark muted teal", "pale pink"), so the swatches, the golf
// You / Target and the selected color can be told apart without seeing the difference. The
// "Color names" switch (body.color-names) shows them; the choice is kept in this browser.

const NAMES_KEY = "colorverse.colorNames";

// Hue families by where they start on the wheel (degrees); the last one wraps round to red
const HUES = [
    [0, "red"], [15, "orange"], [45, "yellow"], [70, "yellow-green"], [90, "green"], [150, "teal"],
    [175, "cyan"], [195, "azure"], [215, "blue"], [250, "violet"], [275, "purple"], [300, "magenta"],
    [330, "pink"], [345, "red"],
];

function hueName(h, l) {
    let name = HUES[0][1];
    for (const [start, family] of HUES) if (h >= start) name = family;
    // Dark oranges, yellows and cyans read as browns, olives and teals
    if (l < 35 && name === "orange") return "brown";
    if (l < 35 && name === "yellow") return "olive";
    if (l < 35 && name === "cyan") return "teal";
    return name;
}

// { h: 0–360, s: 0–100, l: 0–100 } → "dark muted teal"
export function describeColor({ h, s, l }) {
    h = ((h % 360) + 360) % 360;
    if (l <= 6) return "black";
    if (l >= 96) return "white";
    const shade = l < 20 ? "very dark" : l < 38 ? "dark" : l > 82 ? "pale" : l > 64 ? "light" : "";
    if (s < 10) return [shade, "gray"].filter(Boolean).join(" ");
    const tone = s < 30 ? "grayish" : s < 60 ? "muted" : s >= 85 && !shade ? "vivid" : "";
    return [shade, tone, hueName(h, l)].filter(Boolean).join(" ");
}

export function colorNamesOn() {
    try { return localStorage.getItem(NAMES_KEY) === "1"; } catch { return false; }
}

export function setColorNames(on) {
    try { localStorage.setItem(NAMES_KEY, on ? "1" : "0"); } catch { /* ignore */ }
    document.body.classList.toggle("color-names", on);
    document.querySelectorAll(".color-names-switch").forEach(input => { input.checked = on; });
}

// Every "Color names" switch on the page follows the same setting
export function setupColorNames() {
    document.querySelectorAll(".color-names-switch").forEach(input => {
        input.addEventListener("change", () => setColorNames(input.checked));
    });
    setColorNames(colorNamesOn());
}

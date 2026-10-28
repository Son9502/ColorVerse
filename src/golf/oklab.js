// ----------------------------------
// OKLab distance: how different two colors look
// ----------------------------------
// Equal distances look roughly equally different anywhere in the space, unlike RGB or HSL.

export const IN_THE_HOLE = 0.02; // looks the same side by side
export const ON_THE_GREEN = 0.05; // close, but you can tell them apart

// CSS hsl() -> sRGB 0–1 (same formula the browser uses for the swatches)
function hslToSRGB({ h, s, l }) {
    s /= 100;
    l /= 100;
    const f = (n) => {
        const k = (n + h / 30) % 12;
        const a = s * Math.min(l, 1 - l);
        return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return [f(0), f(8), f(4)];
}

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

// sRGB 0–1 -> OKLab [L, a, b] (Björn Ottosson's matrices)
export function srgbToOklab([r, g, b]) {
    r = toLinear(r);
    g = toLinear(g);
    b = toLinear(b);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
        0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
    ];
}

export const hslToOklab = (hsl) => srgbToOklab(hslToSRGB(hsl));

export function oklabDistance(a, b) {
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export const hslDistance = (a, b) => oklabDistance(hslToOklab(a), hslToOklab(b));

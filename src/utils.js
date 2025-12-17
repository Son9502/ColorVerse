// Clamps a value between a minimum and maximum
export function clamp(value, min, max) {
    return Math.min(max, Math.max(min,value));
}
// Linear interpolation
export function lerp(min, max, t) {
    return min + (max - min) * t;
}


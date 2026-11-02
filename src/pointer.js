// ----------------------------------
// Last pointer type (v1.7)
// ----------------------------------
// "mouse", "touch" or "pen" for the press that came last. A swatch is chosen with a double-click
// on a mouse but a tap on a touch screen (harmony.js, golf-ui.js), and phones also fire a
// double-click after two quick taps, which must not choose it twice.

let last = "mouse";
document.addEventListener("pointerdown", (event) => { last = event.pointerType; }, { capture: true });

export const lastPointerType = () => last;

// ----------------------------------
// First-visit Welcome + Spotlight Tour
// ----------------------------------
const STORAGE_KEY = "colorverse.welcomed";

// `touch`: the step's text on a touch screen (no hover, a finger for a pointer), where it differs
const touchScreen = () => window.matchMedia("(hover: none) and (pointer: coarse)").matches;
const STEPS = [
    {
        target: "#ui-canvas",
        title: "The color space, in 3-D",
        text: "Drag or use the arrow keys to rotate, scroll or pinch to zoom, and double-click to reset the view.",
        touch: "Drag with one finger to rotate, and pinch to zoom.",
    },
    {
        target: "#info3D",
        title: "Peel it layer by layer",
        text: "The shape is 128 nested layers, from the full-color surface (0) to the gray core (127). Press [ and ] or type a layer here.",
        touch: "The shape is 128 nested layers, from the full-color surface (0) to the gray core (127). Drag the slider, tap − / +, or type a layer here.",
    },
    {
        target: "#hsltoggle",
        title: "RGB or HSL",
        text: "Flip the color space and watch the shape morph between the two.",
    },
    {
        target: "#shape-toggle",
        title: "Same colors, different shape",
        text: "Map the color space onto a cube or a sphere. 1-D and 2-D views are coming soon.",
    },
    {
        target: "#color-search",
        title: "Pick a color",
        text: "Click anywhere on the shape, or search ~3,200 named colors. Enter completes the best match; Enter again selects it.",
        touch: "Tap anywhere on the shape, or search ~3,200 named colors and tap a match.",
    },
    {
        target: "#ui-container",
        title: "Explore its harmonies",
        text: "Every pick fills these rows. Double-click any swatch to make it the new color, and use the sliders to fine-tune it.",
        touch: "Every pick fills these rows. Tap any swatch to make it the new color, and use the sliders to fine-tune it.",
    },
    {
        target: "#golf-play",
        title: "Color Golf",
        text: "A mini-game: make a color match a target in as few strokes as you can, playing the harmonies as clubs. Courses to unlock, a daily hole and a weekly Gauntlet.",
    },
    {
        target: "#help-button",
        title: "Need a reminder?",
        text: "The ? lists every control, and can replay this tour.",
    },
];

// localStorage can throw (private mode, blocked storage): never let that break the page
const hasBeenWelcomed = () => {
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
};
const markWelcomed = () => {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
};

// Other parts of the page run their own tours with the same spotlight (Color Golf, v1.8.6):
// runTour(steps, done), steps as in STEPS; `done` runs when it's finished or skipped
let runTourImpl = null;
export const runTour = (steps, done) => runTourImpl?.(steps, done);

export function setupWelcome() {
    const welcome = document.getElementById("welcome");
    const tour = document.getElementById("tour");
    const spotlight = document.getElementById("tour-spotlight");
    const card = document.getElementById("tour-card");
    const stepLabel = document.getElementById("tour-step");
    const title = document.getElementById("tour-title");
    const text = document.getElementById("tour-text");
    const back = document.getElementById("tour-back");
    const next = document.getElementById("tour-next");

    let step = 0;
    let steps = STEPS;
    let onEnd = markWelcomed;

    // ---- Welcome modal ----
    const closeWelcome = () => {
        welcome.hidden = true;
        markWelcomed();
    };
    document.getElementById("welcome-skip").addEventListener("click", closeWelcome);
    document.getElementById("welcome-tour").addEventListener("click", () => {
        closeWelcome();
        startTour();
    });

    // ---- Tour ----
    const place = () => {
        const target = document.querySelector(steps[step].target);
        if (!target) return;
        // A target further down the page or panel: bring it to the middle, leaving room for the card
        const first = target.getBoundingClientRect();
        if (first.top < 0 || first.bottom > window.innerHeight) target.scrollIntoView({ block: "center", inline: "nearest" });
        const pad = 8;
        const r = target.getBoundingClientRect();
        // Clamp to the viewport so large targets (canvas, harmony list) stay fully visible
        const box = {
            left: Math.max(r.left - pad, 4),
            top: Math.max(r.top - pad, 4),
            right: Math.min(r.right + pad, window.innerWidth - 4),
            bottom: Math.min(r.bottom + pad, window.innerHeight - 4),
        };
        Object.assign(spotlight.style, {
            left: `${box.left}px`,
            top: `${box.top}px`,
            width: `${box.right - box.left}px`,
            height: `${box.bottom - box.top}px`,
        });

        // Card goes beside the target (right, then left), else below or above it (phones), else
        // inside its bottom edge (a target as big as the screen)
        const gap = 14;
        const cw = card.offsetWidth;
        const ch = card.offsetHeight;
        let left;
        let top = Math.min(Math.max(box.top, 12), window.innerHeight - ch - 12);
        if (box.right + gap + cw <= window.innerWidth - 12) left = box.right + gap;
        else if (box.left - gap - cw >= 12) left = box.left - gap - cw;
        else {
            left = Math.min(Math.max(box.left + 12, 12), window.innerWidth - cw - 12);
            if (box.bottom + gap + ch <= window.innerHeight - 12) top = box.bottom + gap;
            else if (box.top - gap - ch >= 12) top = box.top - gap - ch;
            else top = Math.max(box.bottom - ch - 12, 12);
        }
        Object.assign(card.style, { left: `${left}px`, top: `${top}px` });
    };

    const render = () => {
        const s = steps[step];
        stepLabel.textContent = `Step ${step + 1} of ${steps.length}`;
        title.textContent = s.title;
        text.textContent = (touchScreen() && s.touch) || s.text;
        back.disabled = step === 0;
        next.textContent = step === steps.length - 1 ? "Done" : "Next";
        place();
        next.focus();
    };

    const startTour = (list = STEPS, done = markWelcomed) => {
        steps = list.filter(s => document.querySelector(s.target)?.getClientRects().length); // skip parts that aren't showing
        onEnd = done;
        if (!steps.length) return done();
        step = 0;
        tour.hidden = false;
        render();
    };
    runTourImpl = startTour;

    const endTour = () => {
        tour.hidden = true;
        onEnd();
    };

    back.addEventListener("click", () => {
        if (step > 0) { step--; render(); }
    });
    next.addEventListener("click", () => {
        if (step < steps.length - 1) { step++; render(); }
        else endTour();
    });
    document.getElementById("tour-skip").addEventListener("click", endTour);
    window.addEventListener("resize", () => { if (!tour.hidden) place(); });

    // While the welcome or tour is open, keys drive it and don't reach the app
    // (capture phase, so the 3-D shortcuts and Esc handlers never see them)
    window.addEventListener("keydown", (event) => {
        if (!welcome.hidden) {
            if (event.key === "Escape") { event.stopImmediatePropagation(); closeWelcome(); }
            else if (event.key !== "Tab" && event.key !== "Enter" && event.key !== " ") event.stopImmediatePropagation();
            return;
        }
        if (tour.hidden) return;
        if (event.key === "Escape") endTour();
        else if (event.key === "ArrowRight") next.click();
        else if (event.key === "ArrowLeft") back.click();
        else if (event.key === "Tab" || event.key === "Enter" || event.key === " ") return; // let buttons work
        event.preventDefault();
        event.stopImmediatePropagation();
    }, { capture: true });

    // "Replay the tour" in the ? panel
    document.getElementById("replay-tour").addEventListener("click", () => {
        document.getElementById("help-panel").hidden = true;
        document.getElementById("help-button").setAttribute("aria-expanded", "false");
        startTour();
    });

    if (!hasBeenWelcomed()) {
        welcome.hidden = false;
        document.getElementById("welcome-tour").focus();
    }
}

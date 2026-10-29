import courses from "./courses.json";
import { GolfRound, scoreName, compareRounds } from "./game.js";
import { PUTTER, strike } from "./clubs.js";
import { IN_THE_HOLE, hslDistance } from "./oklab.js";
import { harmonySets, selectBaseColor, clearBaseColor } from "../harmony.js";
import { setMapState } from "./mapState.js";

// ----------------------------------
// Color Golf screen
// ----------------------------------
// body.golf hides the explore controls (search, sliders, help) and shows the putter row;
// 3d-mode.js and dropdown.js skip canvas picking and Esc while it's set.

const BEST_KEY = "colorverse.golf.best.v2"; // v2: courses regenerated in v1.1.1, so older bests no longer apply

const ROW_NAMES = {
    "complementary": "Complementary", "split-complementary": "Split-comp.", "triadic": "Triadic",
    "tetradic": "Tetradic", "double-complementary": "Double-comp.", "analogous": "Analogous",
    "tints": "Tints", "shades": "Shades", "tones": "Tones", "saturate": "Saturate", "putter": "Putter",
};
// Hue shifts per swatch, matching harmonyMath.js
const HUE_SHIFTS = {
    "complementary": [180], "split-complementary": [150, 210], "triadic": [120, -120],
    "tetradic": [90, 180, 270], "double-complementary": [60, 180, 240], "analogous": [-40, -20, 20, 40],
};

// "Tints 60%", "Triadic +120°", "Putter Sat +"
function clubName({ row, index }) {
    if (row === "putter") return `Putt ${PUTTER[index].label}`;
    if (HUE_SHIFTS[row]) {
        const shift = HUE_SHIFTS[row][index];
        return `${ROW_NAMES[row]} ${shift > 0 ? "+" : "−"}${Math.abs(shift)}°`;
    }
    return `${ROW_NAMES[row]} ${(index + 1) * 20}%`;
}

// The perfect route comes from a worker (the search can take most of a second).
// Created on first use; the worker path must stay a literal so Vite bundles it.
let solver = null;
let solverRequest = 0;
const pendingRoutes = new Map();
function solveRoute({ tee, target, perfect, hazards = [], wind = null }) {
    if (!solver) {
        solver = new Worker(new URL("./solver-worker.js", import.meta.url), { type: "module" });
        solver.onmessage = ({ data }) => {
            const pending = pendingRoutes.get(data.id);
            pendingRoutes.delete(data.id);
            if (data.error) pending?.reject(new Error(data.error));
            else pending?.resolve(data.route);
        };
    }
    const id = ++solverRequest;
    return new Promise((resolve, reject) => {
        pendingRoutes.set(id, { resolve, reject });
        solver.postMessage({ id, tee, target, perfect, hazards, wind });
    });
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const REPLAY_STEP_MS = 1100;

const css = ({ h, s, l }) => `hsl(${h}, ${s}%, ${l}%)`;

function formatTime(ms) {
    const total = Math.floor(ms / 1000);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// Golf-style distance: OKLab distance × 1000 (the hole is 20 yds across; most holes 100–500 yds)
const yards = (a, b) => Math.round(hslDistance(a, b) * 1000);

// "+6° hue ↻" / "brightening +3%" for a hole's wind (null = calm)
function windText(wind) {
    if (!wind) return null;
    if (wind.hue) return `${wind.hue > 0 ? "+" : "−"}${Math.abs(wind.hue)}° hue ${wind.hue > 0 ? "↻" : "↺"}`;
    return `${wind.light > 0 ? "brightening +" : "darkening −"}${Math.abs(wind.light)}%`;
}

// "2 bunkers, 1 lake" (empty for a clear hole)
function hazardSummary(hazards = []) {
    const count = (type) => hazards.filter(h => h.type === type).length;
    const part = (n, one, many) => (n ? `${n} ${n === 1 ? one : many}` : "");
    return [part(count("sand"), "bunker", "bunkers"), part(count("water"), "lake", "lakes")].filter(Boolean).join(", ");
}

const formatToPar = (n) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);

// Best rounds per course, in this browser only. localStorage can throw: fall back to none
function loadBest() {
    try { return JSON.parse(localStorage.getItem(BEST_KEY)) ?? {}; } catch { return {}; }
}
function saveBest(courseId, totals) {
    const best = loadBest();
    if (best[courseId] && compareRounds(best[courseId], totals) <= 0) return false;
    best[courseId] = { strokes: totals.strokes, toPar: totals.toPar, time: totals.time };
    try { localStorage.setItem(BEST_KEY, JSON.stringify(best)); } catch { /* ignore */ }
    return true;
}

// Closeness meter wording; only updated after a stroke
function lieLabel({ distance, holed, onGreen }) {
    if (holed) return "In the hole!";
    if (onGreen) return "On the green";
    if (distance < 0.12) return "Close";
    if (distance < 0.25) return "Fairway";
    return "Rough";
}

export function setupGolf() {
    const $ = (id) => document.getElementById(id);
    const panel = $("golf-panel");
    const setup = $("golf-setup");
    const hud = $("golf-hud");
    const roundEnd = $("golf-round-end");
    const holeEnd = $("golf-hole-end");
    const undoButton = $("golf-undo");
    const pathList = $("golf-path");

    let round = null;
    let timer = null;
    let mapState = null; // last state sent to the map; the replay draws on top of it
    let replayToken = 0; // bumped to stop a replay in progress

    // The map is HSL during a game: the game's colors are HSL, and the RGB sphere doesn't reach
    // the most vivid ones. The toggle is hidden meanwhile; leaving restores the user's choice.
    const spaceToggle = $("toggle");
    let exploringSpace = null; // toggle state before the game, null when not in golf
    const setSpaceToggle = (checked) => {
        if (spaceToggle.checked !== checked) spaceToggle.click(); // fires the same handlers as the user's click
    };

    // Every swatch is a club: harmony squares from harmonySets, plus the putter row
    const clubs = new Map();
    for (const [row, elements] of Object.entries(harmonySets)) {
        elements.forEach(({ box }, index) => box && clubs.set(box, { row, index }));
    }
    const putterBoxes = PUTTER.map((_, index) => $(`putt${index + 1}`));
    putterBoxes.forEach((box, index) => clubs.set(box, { row: "putter", index }));

    const show = (section) => {
        for (const el of [setup, hud, roundEnd]) el.hidden = el !== section;
    };

    // ---- Enter / leave ----
    const openSetup = () => {
        replayToken++;
        $("golf-wind-badge").hidden = true;
        stopTimer();
        round = null;
        setMapState(null);
        exploringSpace ??= spaceToggle.checked;
        setSpaceToggle(true);
        document.body.classList.add("golf");
        panel.hidden = false;
        clearBaseColor();
        putterBoxes.forEach(box => { box.style.backgroundColor = ""; });
        renderCourses();
        show(setup);
    };

    const exitGolf = () => {
        replayToken++;
        $("golf-wind-badge").hidden = true;
        stopTimer();
        round = null;
        setMapState(null);
        document.body.classList.remove("golf");
        if (exploringSpace !== null) setSpaceToggle(exploringSpace);
        exploringSpace = null;
        panel.hidden = true;
        clearBaseColor();
    };

    const renderCourses = () => {
        const best = loadBest();
        $("golf-courses").replaceChildren(...courses.map(course => {
            const [from, to] = course.hues;
            const span = ((to - from + 359) % 360) + 1;
            const stops = Array.from({ length: 7 }, (_, i) => `hsl(${(from + (span * i) / 6) % 360}, 75%, 50%)`);
            const par = course.holes.reduce((sum, hole) => sum + hole.par, 0);
            const length = course.holes.reduce((sum, hole) => sum + yards(hole.tee, hole.target), 0);
            const record = best[course.id];

            const item = document.createElement("li");
            item.className = "golf-course";
            item.innerHTML = `
                <h3>${course.name}</h3>
                <div class="golf-hues" style="background: linear-gradient(to right, ${stops.join(", ")})"></div>
                <span class="golf-best">${course.difficulty} · ${course.holes.length} holes · par ${par} · ${length.toLocaleString()} yds${record ? ` · best ${record.strokes} (${formatToPar(record.toPar)}), ${formatTime(record.time)}` : ""}</span>
                <button class="btn btn-primary" type="button">Play</button>`;
            item.querySelector("button").addEventListener("click", () => startRound(course));
            return item;
        }));
    };

    // ---- A round ----
    const startRound = (course) => {
        round = new GolfRound(course);
        show(hud);
        startHole();
    };

    const startHole = () => {
        replayToken++;
        const { hole, holeIndex } = round;
        $("golf-hole-title").textContent = `Hole ${holeIndex + 1} · Par ${hole.par}`;
        const summary = hazardSummary(hole.hazards);
        $("golf-hole-info").textContent = `${round.course.name} · ${round.nine === 0 ? "Front" : "Back"} 9 · ${yards(hole.tee, hole.target)} yds${summary ? ` · ${summary}` : ""}`;
        // Wind: drifts every full shot (the swatches show the calm landing, so aim off)
        const wind = windText(hole.wind);
        $("golf-wind").hidden = !wind;
        $("golf-wind").textContent = wind ? `Wind ${wind} on every full shot (putts aren't affected)` : "";
        $("golf-wind-badge").hidden = !wind;
        $("golf-wind-badge").textContent = wind ? `🌬 ${wind}` : "";
        $("golf-target").style.backgroundColor = css(hole.target);
        holeEnd.hidden = true;
        pathList.replaceChildren();
        renderPosition(null);
        startTimer();
    };

    // Current color, swatches (harmonies + putter), strokes, undo and the meter
    const renderPosition = (lie) => {
        const { current } = round;
        $("golf-you").style.backgroundColor = css(current);
        selectBaseColor(css(current), "", "golf", current);
        putterBoxes.forEach((box, index) => {
            box.style.backgroundColor = css(strike(current, { row: "putter", index }));
        });

        $("golf-strokes").textContent = round.strokes;
        const undosLeft = round.undosLeft[round.nine];
        undoButton.textContent = `Undo (${undosLeft})`;
        undoButton.disabled = !round.canUndo;
        refreshLiveCard();
        const hazards = round.hole.hazards ?? [];
        // Landing in a hazard flashes its outline on the map
        const flash = lie?.landedIn ? { index: hazards.indexOf(lie.landedIn), start: performance.now() } : mapState?.flash;
        mapState = { current, target: round.hole.target, trail: [...round.trail], holed: !!lie?.holed, hazards, flash };
        setMapState(mapState);
        renderHazards(lie);

        // Yards: last shot's length and what's left to the pin
        const last = round.trail.at(-1);
        $("golf-yards").textContent = last
            ? `Last shot ${yards(last, current)} yds · ${lie?.holed ? "in the hole" : `${yards(current, round.hole.target)} yds to the pin`}`
            : `${yards(current, round.hole.target)} yds to the pin`;

        const fill = $("golf-meter-fill");
        const label = $("golf-meter-label");
        if (!lie) {
            fill.style.width = "0";
            label.textContent = "Tee off";
            return;
        }
        // Full bar at the hole's edge, empty at 0.4 (about as far as two colors get)
        const closeness = Math.max(0, Math.min(1, 1 - (lie.distance - IN_THE_HOLE) / 0.4));
        fill.style.width = `${(lie.holed ? 1 : closeness) * 100}%`;
        label.textContent = lieLabel(lie);
    };


    // Hazard note ("Water! …" / "In the bunker …"), yardage to each hazard, and in a bunker
    // grey out every club but the wedges
    const renderHazards = (lie) => {
        const hazards = round.hole.hazards ?? [];
        const note = $("golf-hazard-note");
        note.hidden = false;
        if (lie?.landed === "water") note.textContent = "Water! +1 stroke, playing again from your last spot.";
        else if (round.inSand && !round.holeDone) note.textContent = "In the bunker: wedges only (Tints, Shades, Tones, Saturate).";
        else note.hidden = true;
        note.className = lie?.landed === "water" ? "water" : "sand";

        $("golf-hazards").replaceChildren(...hazards.map(hazard => {
            const item = document.createElement("li");
            item.className = hazard.type;
            item.textContent = hazard.type === "water"
                ? `Water: ${yards(round.current, hazard.center) + hazard.radius} yds to carry`
                : `Bunker: ${Math.max(0, yards(round.hole.target, hazard.center) - hazard.radius)} yds from the pin`;
            return item;
        }));

        for (const [box, club] of clubs) {
            box.closest(".square-wrapper")?.classList.toggle("golf-blocked", !round.holeDone && !round.canPlay(club));
        }
    };

    const endHole = () => {
        stopTimer();
        refreshLiveCard();
        const result = round.card[round.holeIndex];
        $("golf-result").textContent = result.pickedUp ? "Picked up" : scoreName(result.strokes, result.par);
        $("golf-result-info").textContent =
            `${result.strokes} strokes · Par ${result.par} · Perfect ${result.perfect} · ${formatTime(result.time)}`;
        $("golf-next").textContent = round.finished ? "See score card" : "Next hole";
        $("golf-show-path").disabled = false;
        $("golf-show-path").hidden = false;
        holeEnd.hidden = false;
        $("golf-next").focus();
    };

    // The solver's perfect route: a gold ghost ball replays it on the map, stroke by stroke,
    // while the list below fills in. Next hole (or leaving) stops the replay.
    const showPath = async () => {
        const button = $("golf-show-path");
        button.disabled = true;
        button.textContent = "Working…";
        const token = ++replayToken;
        const hole = round.hole;

        let route;
        try {
            route = await solveRoute(hole);
        } catch {
            button.textContent = "Route unavailable";
            return;
        }
        if (token !== replayToken) return;
        button.hidden = true;
        button.textContent = "Show perfect route";

        pathList.replaceChildren();
        const stops = [hole.tee];
        for (let i = 0; i <= route.length; i++) {
            const done = i === route.length;
            setMapState({ ...mapState, replay: [...stops], replayHoled: done });
            if (done) break;
            await sleep(i === 0 ? 400 : REPLAY_STEP_MS);
            if (token !== replayToken) return;

            const { club, hsl } = route[i];
            stops.push(hsl);
            const item = document.createElement("li");
            item.innerHTML = `<span class="swatch" style="background-color: ${css(hsl)}"></span>${clubName(club)}`;
            pathList.append(item);
        }
    };

    const endRound = () => {
        replayToken++;
        $("golf-wind-badge").hidden = true;
        const totals = round.totals();
        const isBest = saveBest(round.course.id, totals);
        $("golf-round-title").textContent = `${round.course.name}: ${totals.strokes} (${formatToPar(totals.toPar)})`;
        $("golf-round-info").textContent =
            `Par ${totals.par} · Perfect ${totals.perfect} · ${formatTime(totals.time)}${isBest ? " · New best!" : ""}`;
        renderCard($("golf-card"));
        clearBaseColor();
        setMapState(null);
        show(roundEnd);
    };

    // Score card as two tables so it fits the panel: holes 1–9 + Out, then 10–18 + In + Total.
    // Unplayed holes show "–"; a hole's perfect score stays hidden until it's played (no spoilers);
    // the hole in progress is highlighted with its strokes so far.
    const renderCard = (container) => {
        const holes = round.course.holes;
        const sum = (list, key) => list.reduce((total, item) => total + item[key], 0);
        const total = (label, from, to) => {
            const played = round.card.slice(from, to);
            const done = played.length === to - from;
            return {
                label,
                par: sum(holes.slice(from, to), "par"),
                perfect: done ? sum(played, "perfect") : "–",
                strokes: played.length ? sum(played, "strokes") : "–",
                parPlayed: sum(played, "par"),
            };
        };
        const nineTable = (nine) => {
            const columns = holes.slice(nine * 9, nine * 9 + 9).map((hole, i) => {
                const index = nine * 9 + i;
                const played = round.card[index];
                const current = !played && index === round.holeIndex;
                const sand = (hole.hazards ?? []).filter(h => h.type === "sand").length;
                const water = (hole.hazards ?? []).filter(h => h.type === "water").length;
                return {
                    label: index + 1, par: hole.par, current,
                    hazards: `<span class="sand">${"●".repeat(sand)}</span><span class="water">${"●".repeat(water)}</span>`,
                    perfect: played ? played.perfect : "–",
                    strokes: played ? played.strokes : current ? round.strokes : "–",
                    parPlayed: played ? hole.par : null,
                };
            });
            columns.push(total(nine === 0 ? "Out" : "In", nine * 9, nine * 9 + 9));
            if (nine === 1) columns.push(total("Tot", 0, 18));

            const under = (c) => typeof c.strokes === "number" && c.parPlayed !== null && c.strokes < c.parPlayed;
            const row = (title, cell) => `<tr><th>${title}</th>${columns.map(cell).join("")}</tr>`;
            return `<table class="golf-card">${
                row("Hole", c => `<th class="${c.current ? "current" : ""}">${c.label}</th>`) +
                row("Par", c => `<td>${c.par}</td>`) +
                row("Perfect", c => `<td>${c.perfect}</td>`) +
                row("Hazards", c => `<td class="golf-card-hazards">${c.hazards ?? ""}</td>`) +
                row("You", c => `<td class="${[c.current && "current", under(c) && "under"].filter(Boolean).join(" ")}">${c.strokes}</td>`)
            }</table>`;
        };
        container.innerHTML = nineTable(0) + nineTable(1);
    };

    // Live card: shown with the Card button, refreshed after every stroke and hole
    const liveCard = $("golf-live-card");
    const refreshLiveCard = () => {
        if (liveCard.hidden || !round) return;
        const { holes, toPar } = round.totals();
        $("golf-live-total").textContent = holes ? `Thru ${holes}: ${formatToPar(toPar)}` : "No holes finished yet";
        renderCard(liveCard.querySelector(".golf-card-tables"));
    };
    $("golf-card-toggle").addEventListener("click", (event) => {
        liveCard.hidden = !liveCard.hidden;
        event.currentTarget.setAttribute("aria-expanded", String(!liveCard.hidden));
        refreshLiveCard();
    });

    // How to play: either ? button opens it, its Close button hides it
    document.querySelectorAll(".golf-help-toggle").forEach(button => button.addEventListener("click", () => {
        $("golf-help").hidden = !$("golf-help").hidden;
    }));

    // ---- Timer: total round time, ticking during a hole ----
    const startTimer = () => {
        stopTimer();
        const done = round.totals().time;
        const tick = () => { $("golf-time").textContent = formatTime(done + performance.now() - round.holeStart); };
        tick();
        timer = setInterval(tick, 250);
    };
    function stopTimer() {
        clearInterval(timer);
        timer = null;
    }

    // ---- Strokes: double-click a swatch ----
    // Capture phase, so harmony.js's explore-mode double-click never sees it
    $("ui-container").addEventListener("dblclick", (event) => {
        if (!document.body.classList.contains("golf")) return;
        event.stopPropagation();
        const club = clubs.get(event.target.closest(".square"));
        if (!round || !club || round.holeDone) return;

        const lie = round.play(club);
        if (!lie) return; // not playable from here (e.g. a driver in a bunker)
        renderPosition(lie);
        if (round.holeDone) endHole();
    }, { capture: true });

    undoButton.addEventListener("click", () => {
        if (!round?.undo()) return;
        renderPosition(round.history.length ? round.lie() : null);
    });

    $("golf-next").addEventListener("click", () => {
        if (round.finished) endRound();
        else if (round.nextHole()) startHole();
    });
    $("golf-show-path").addEventListener("click", showPath);
    $("golf-quit").addEventListener("click", () => {
        if (confirm("Quit this round? It won't be saved.")) openSetup();
    });

    $("golf-play").addEventListener("click", openSetup);
    $("golf-quit-setup").addEventListener("click", exitGolf);
    $("golf-again").addEventListener("click", openSetup);
    $("golf-done").addEventListener("click", exitGolf);
}

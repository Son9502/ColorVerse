import courses from "./courses.json";
import { GolfRound, scoreName, compareRounds, survivalBoard, UNDOS_PER_ROUND, UNDOS_DAILY } from "./game.js";
import { PUTTER, ROULETTE_SLOTS, FLIPS, STANDARD_CLUBS, COPIES, strike } from "./clubs.js";
import { IN_THE_HOLE, hslDistance, hslToHex } from "./oklab.js";
import { harmonySets, selectBaseColor, clearBaseColor, addNameLabel } from "../harmony.js";
import { describeColor, colorNamesOn } from "../color-names.js";
import { setMapState } from "./mapState.js";
import { WEEK, dateKey, daysBetween, addDays, dayLabel, weekday, weekOf, streak } from "./daily.js";
import { poolKey, PARS } from "./practice.js";
import { courseLock, unlockToPar } from "./unlocks.js";
import { windFor } from "./rules.js";
import { termify, setupTerms } from "./terms.js";
import * as cloud from "../cloud/cloud.js";
import { lastPointerType } from "../pointer.js";

// ----------------------------------
// Color Golf screen
// ----------------------------------
// body.golf hides the explore controls (search, sliders, help) and shows the putter row;
// 3d-mode.js and dropdown.js skip canvas picking and Esc while it's set. body.golf-pro hides the
// swatch colors in a Pro round. Three ways to play: a course (18 holes), the daily hole, practice.
// Expert (any mode) is always Pro and hides the yardage until you're on the green.

const BEST_KEY = "colorverse.golf.best.v2"; // v2: courses regenerated in v1.1.1, so older bests no longer apply
const DAILY_KEY = "colorverse.golf.daily.v1"; // { "2026-10-28": { strokes, par, perfect, time, pickedUp, pro } }
const WEEKLY_KEY = "colorverse.golf.weekly.v1"; // best runs: { "<Monday>": { survived, strokes, toPar, time, pro } }
const PRO_KEY = "colorverse.golf.pro";

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

// The hole's roulette shifts (v1.8.4), for the roulette clubs' names; set at each hole
let rouletteShifts = null;
const shiftText = (shift) => `${shift > 0 ? "+" : "−"}${Math.abs(shift)}°`;

// "Tints 60%", "Triadic +120°", "Putter Sat +", "Roulette +95°", "Flip ← 3"
function clubName({ row, index }) {
    if (row === "putter") return `Putt ${PUTTER[index].label}`;
    if (row === "flip") return `Flip ← ${index + 1}`;
    if (row === "roulette") return `Roulette ${shiftText(rouletteShifts?.[index] ?? 0)}`;
    if (HUE_SHIFTS[row]) {
        const shift = HUE_SHIFTS[row][index];
        return `${ROW_NAMES[row]} ${shift > 0 ? "+" : "−"}${Math.abs(shift)}°`;
    }
    return `${ROW_NAMES[row]} ${(index + 1) * 20}%`;
}

// Club type per harmony row, by how far its shots travel (average yards over tee-like colors):
// Complementary 319, Split-comp. 305, Triadic / Tetradic / Double-comp. 253–270, Analogous 92.
// The wedges move lightness and saturation instead of hue, and are the bunker clubs.
const CLUB_TYPES = {
    "complementary": "Driver", "split-complementary": "Wood",
    "triadic": "Hybrid", "tetradic": "Hybrid", "double-complementary": "Hybrid", "analogous": "Iron",
    "tints": "Wedge", "shades": "Wedge", "tones": "Wedge", "saturate": "Wedge",
};

// Tutorial boxes for the hazards (v1.8.1), on the first hole of a round that has one
const HAZARD_LESSONS = {
    sand: "Bunker (sand on the map): land in one and your next shot must be a wedge (Tints, Shades, Tones or Saturate), so no putting out of it.",
    water: "Water (blue on the map): land in it and it's +1 stroke, playing again from where you hit.",
    blackhole: "Black hole (black with an orange rim on the map): land in one and it's +1 stroke, back to the tee.",
};

// Pro label under a swatch: the row name is already above it, so just the shift or strength
function proLabel({ row, index }) {
    if (row === "putter") return PUTTER[index].label;
    if (row === "roulette") return clubName({ row, index }).slice("Roulette ".length);
    if (row === "flip") return `← ${index + 1}`;
    return clubName({ row, index }).slice(ROW_NAMES[row].length + 1);
}

// The perfect route comes from a worker (the search can take most of a second).
// Created on first use; the worker path must stay a literal so Vite bundles it.
let solver = null;
let solverRequest = 0;
const pendingRoutes = new Map();
function solveRoute({ tee, target, perfect, hazards = [], wind = null, rules = null }) {
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
        solver.postMessage({ id, tee, target, perfect, hazards, wind, rules });
    });
}

// Practice holes come from their own worker (building one takes 0.5–20 s). A newer request
// replaces an unfinished one by restarting the worker, so changing settings never queues builds.
let builder = null;
let building = null; // { reject } for the request in progress
function buildPracticeHole(settings) {
    if (building) {
        builder.terminate();
        builder = null;
        building.reject(new Error("superseded"));
    }
    builder ??= new Worker(new URL("./practice-worker.js", import.meta.url), { type: "module" });
    const seed = Math.floor(Math.random() * 2 ** 31);
    return new Promise((resolve, reject) => {
        const request = { reject };
        building = request;
        builder.onmessage = ({ data }) => {
            if (building === request) building = null;
            if (data.error) reject(new Error(data.error));
            else resolve(data.hole);
        };
        builder.postMessage({ id: seed, seed, ...settings });
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

// "2 bunkers, 1 lake, 1 portal, 1 mirror" (empty for a clear hole)
function hazardSummary(hazards = []) {
    const count = (type) => hazards.filter(h => h.type === type).length;
    const part = (n, one, many) => (n ? `${n} ${n === 1 ? one : many}` : "");
    return [part(count("sand"), "bunker", "bunkers"), part(count("water"), "lake", "lakes"), part(count("portal"), "portal", "portals"), part(count("blackhole"), "black hole", "black holes"), part(count("mirror"), "mirror", "mirrors")]
        .filter(Boolean).join(", ");
}

const formatToPar = (n) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);

// A line for the end of a course round, by how it went against par (and perfect, the floor)
function roundMessage({ strokes, perfect, toPar }) {
    if (strokes <= perfect) return "A perfect round: the fewest strokes possible.";
    if (toPar < 0) return "Under par! A round to remember.";
    if (toPar === 0) return "Level par: a solid round.";
    if (toPar <= 6) return "Close to par. A few putts from something special.";
    return "Every round teaches the clubs. Try again?";
}

// The end of a survival round (v1.8.6): through every hole, or where it ended
function survivalMessage({ survived, holes, strokes, toPar, perfect }, length, last) {
    if (survived === length) return `Through the Gauntlet! ${strokes} strokes (${formatToPar(toPar)}).${strokes <= perfect ? " Perfect, too." : ""}`;
    return `${last.pickedUp ? "Picked up" : "Over par"} on hole ${holes} (survived ${survived} hole${survived === 1 ? "" : "s"})`;
}

// Saved in this browser only. localStorage can throw: fall back to nothing saved
function load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}
function remove(key) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
}

// Whose scores the screens show (v1.6): the guest's under the plain keys, a signed-in account's
// in its own copy ("<key>:<uid>"), which signing out deletes, so the guest's come back untouched
let owner = cloud.rememberedAccount();
const scoped = (key, uid = owner) => (uid ? `${key}:${uid}` : key);
const forgetAccount = (uid) => [BEST_KEY, DAILY_KEY].forEach(key => remove(scoped(key, uid)));

// Best rounds per course; Pro rounds are kept apart under "<id>:pro". A record from an older
// version of a course's holes (its `rev`, 1 if absent) doesn't count.
const bestKey = (courseId, pro) => (pro ? `${courseId}:pro` : courseId);
function bestFor(course, pro) {
    const record = load(scoped(BEST_KEY), {})[bestKey(course.id, pro)];
    return record && (record.rev ?? 1) === (course.rev ?? 1) ? record : null;
}
function saveBest(course, pro, totals) {
    const record = bestFor(course, pro);
    if (record && compareRounds(record, totals) <= 0) return false;
    const best = load(scoped(BEST_KEY), {});
    best[bestKey(course.id, pro)] = { strokes: totals.strokes, toPar: totals.toPar, time: totals.time, rev: course.rev ?? 1, ...(course.survival && { survived: totals.survived }) };
    save(scoped(BEST_KEY), best);
    return true;
}

// Daily results by date. The first stroke of a scored try saves a pick-up (double par), which
// finishing the hole replaces, so quitting or reloading can't buy a second try.
const loadDaily = () => load(scoped(DAILY_KEY), {});
function saveDaily(day, result) {
    save(scoped(DAILY_KEY), { ...loadDaily(), [day]: result });
}

// Signed in: the server's bests and daily results join the account's copy (the better best wins; a
// finished daily from the server replaces a local one), so rounds still waiting to be sent show too
function mergeCloudScores({ bests, daily }) {
    const local = load(scoped(BEST_KEY), {});
    for (const [key, record] of Object.entries(bests)) {
        const mine = local[key];
        const mineRev = mine?.rev ?? 1;
        // A newer course revision always wins; on the same revision, the better round
        if (!mine || record.rev > mineRev || (record.rev === mineRev && compareRounds(record, mine) < 0)) local[key] = record;
    }
    save(scoped(BEST_KEY), local);
    const days = loadDaily();
    for (const [day, result] of Object.entries(daily)) {
        if (!days[day] || result.final) {
            const { par, perfect, strokes, time, pickedUp, pro } = result;
            days[day] = { par, perfect, strokes, time, pickedUp, pro };
        }
    }
    save(scoped(DAILY_KEY), days);
}

// A finished round as the score server wants it: the clubs played on each hole, to replay
const playedHoles = (card) => card.map(({ clubs, time }) => ({ clubs, time: Math.round(time) }));

// The weekly Gauntlet (v1.8.6): the week's nine holes (weekly.json loads on first use) as a
// survival course, and this browser's best run each week
let weeklyList = null;
async function weeklyCourse(week) {
    const { start, weeks } = await (weeklyList ??= import("./weekly.json").then(module => module.default));
    const holes = weeks[daysBetween(start, week) / 7];
    return holes ? { id: `weekly-${week}`, name: "Weekly Gauntlet", difficulty: "Expansion", survival: true, week, holes } : null;
}
const loadWeekly = () => load(scoped(WEEKLY_KEY), {});
function saveWeekly(week, totals, pro) {
    const weeks = loadWeekly();
    if (weeks[week] && compareRounds(weeks[week], totals) <= 0) return false;
    const { survived, strokes, toPar, time } = totals;
    save(scoped(WEEKLY_KEY), { ...weeks, [week]: { survived, strokes, toPar, time, pro } });
    return true;
}

// The daily list loads on first use (it's a few hundred kB), then stays
let dailyList = null;
const loadDailyList = () => (dailyList ??= import("./daily.json").then(module => module.default));
async function todaysHole(day = dateKey()) {
    const { start, holes } = await loadDailyList();
    return holes[daysBetween(start, day)] ?? null;
}

// Practice starter pool: a few pre-built holes per setting, so a session starts without waiting
let practicePool = null;
async function starterHole({ difficulty, par, hazards }) {
    const pool = await (practicePool ??= import("./practice.json").then(module => module.default));
    const holePar = par === "any" ? PARS[Math.floor(Math.random() * PARS.length)] : par;
    const holes = pool[poolKey(difficulty, holePar, hazards)] ?? [];
    return holes[Math.floor(Math.random() * holes.length)] ?? null;
}

const isExpert = (difficulty) => difficulty === "Expert";

// Test mode (`npm run dev:unlocked`): every course open, and rounds stay out of the account.
// Never on in a normal build; the score server keeps its own locks either way. A tester account
// (v1.8.2: `tester: true` on users/{uid}, set in the Firebase console) gets the same on the live site.
const TEST_UNLOCKED = import.meta.env.VITE_UNLOCK_ALL === "1";
const testing = () => TEST_UNLOCKED || !!cloud.currentAccount()?.tester;

// Sign-in problems in words (Firebase error codes); anything else gets a general "try again"
const MIN_PASSWORD = 8;
const NO_MATCH = "That email and password don't match. Try again, or use Forgot password.";
const AUTH_ERRORS = {
    "auth/invalid-credential": NO_MATCH,
    "auth/wrong-password": NO_MATCH,
    "auth/user-not-found": NO_MATCH,
    "auth/email-already-in-use": "That email already has an account. Sign in, or use Forgot password to set a password for it.",
    "auth/weak-password": `Pick a password of at least ${MIN_PASSWORD} characters.`,
    "auth/invalid-email": "That doesn't look like an email address.",
    "auth/too-many-requests": "Too many tries. Wait a minute, then try again.",
    "auth/network-request-failed": "Couldn't reach the server. Check your connection and try again.",
};

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
    let taught = new Set(); // hazards whose tutorial box this round has shown
    let timer = null;
    let mapState = null; // last state sent to the map; the replay draws on top of it
    let replayToken = 0; // bumped to stop a replay in progress
    let mode = "course"; // "course" | "daily" | "practice" | "test"
    let daily = null; // { day, scored, started } during a daily round
    const GAUNTLET = courses.findIndex(course => course.survival); // the weekly Gauntlet opens with it
    let practice = null; // { settings, next } — the next practice hole, built while you play

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
    const putterNames = putterBoxes.map(addNameLabel);
    // Roulette (v1.8.4): four keys (clubs, for the keyboard) and the wheel that spins through them
    const rouletteKeys = [1, 2, 3, 4].map(i => $(`roul${i}`));
    rouletteKeys.forEach((box, index) => clubs.set(box, { row: "roulette", index }));
    const rouletteNames = rouletteKeys.map(addNameLabel);
    const wheel = $("roulette-wheel");
    // Flip (v1.8.5): five clubs that move the hex digits left by 1–5 places
    const flipBoxes = Array.from({ length: FLIPS }, (_, index) => $(`flip${index + 1}`));
    flipBoxes.forEach((box, index) => clubs.set(box, { row: "flip", index }));
    const flipNames = flipBoxes.map(addNameLabel);
    let spin = 0; // the shift the wheel shows
    const wheelClub = () => ({ row: "roulette", index: spin });
    // The keys show while one of them has keyboard focus (index.css); a click focuses the wheel too,
    // and opening them then would let a mouse pick any shift without timing it
    const rouletteRow = $("roulette");
    rouletteRow.addEventListener("focusin", ({ target }) => {
        if (target.matches(":focus-visible")) rouletteRow.classList.add("keys-open");
    });
    rouletteRow.addEventListener("focusout", ({ relatedTarget }) => {
        if (!rouletteRow.contains(relatedTarget)) rouletteRow.classList.remove("keys-open");
    });
    // Long shots (v1.8.5): in golf the Driver, Woods and Hybrids share one row, by hue shift, without
    // the copies (clubs.js: COPIES); their rows hide. Leaving golf puts the swatches back.
    const LONG_SHOTS = [["double-complementary", 0], ["tetradic", 0], ["triadic", 0], ["split-complementary", 0],
        ["complementary", 0], ["split-complementary", 1], ["triadic", 1], ["tetradic", 2]];
    const longRow = $("long");
    const longHome = LONG_SHOTS.map(([row, index]) => {
        const wrapper = harmonySets[row][index].box.closest(".square-wrapper");
        const caption = document.createElement("span");
        caption.className = "long-shift";
        caption.textContent = `+${(HUE_SHIFTS[row][index] + 360) % 360}°`; // all one way round, in order (Triadic −120° is +240°)
        wrapper.prepend(caption);
        wrapper.title = `${CLUB_TYPES[row]}: ${clubName({ row, index })}`;
        return { wrapper, parent: wrapper.parentElement, next: wrapper.nextElementSibling };
    });
    const longRows = [...new Set(LONG_SHOTS.map(([row]) => harmonySets[row][0].box.closest(".colors-row")))];
    const mergeLongShots = (on) => {
        longRows.forEach(row => row.classList.toggle("explore-only", on));
        if (on) longHome.forEach(({ wrapper }) => longRow.append(wrapper));
        else longHome.forEach(({ wrapper, parent, next }) => parent.insertBefore(wrapper, next?.parentElement === parent ? next : null));
    };
    // Pro rounds show these under the swatches instead of the colors (index.css)
    for (const [box, club] of clubs) box.closest(".square-wrapper")?.setAttribute("data-club", proLabel(club));
    longHome.forEach(({ wrapper }) => { wrapper.dataset.club = wrapper.querySelector(".long-shift").textContent; });
    // In a game each row heading starts with its club type (hidden while exploring)
    for (const [row, elements] of Object.entries(harmonySets)) {
        const heading = elements[0]?.box?.closest(".colors-row")?.querySelector(".row-header h3");
        if (!heading || !CLUB_TYPES[row]) continue;
        const type = document.createElement("span");
        type.className = "club-type";
        type.textContent = CLUB_TYPES[row];
        heading.prepend(type);
    }

    setupTerms();

    // Testing (test mode or a tester account): every course open, a hole picker, nothing sent
    const testCourse = $("golf-test-course");
    const testHole = $("golf-test-hole");
    testCourse.replaceChildren(...courses.map((course, i) => new Option(course.name, i)));
    const fillTestHoles = () => {
        const course = courses[testCourse.value];
        testHole.replaceChildren(...course.holes.map((hole, i) => new Option(`Hole ${i + 1} · par ${hole.par}`, i)));
    };
    testCourse.addEventListener("change", fillTestHoles);
    fillTestHoles();
    const renderTesting = () => {
        $("golf-test-mode").hidden = !testing();
        $("golf-test-mode").textContent = TEST_UNLOCKED
            ? "Test mode: every course is unlocked, and rounds aren't sent to your account."
            : "Tester account: every course is unlocked, and rounds aren't sent to your account.";
        $("golf-test-holes").hidden = !testing();
    };
    renderTesting();
    $("golf-test-play").addEventListener("click", () => startRound(courses[testCourse.value], "test", { from: Number(testHole.value) }));

    // ---- Account (v1.6): only when Firebase is configured ----
    if (cloud.cloudAvailable) {
        $("golf-account").hidden = false;
        $("golf-account-settings").hidden = false;
        $("golf-leaderboard-toggle").hidden = false;
        if (cloud.cloudWanted()) cloud.loadCloud(); // signed in before, or back from a sign-in link
    }
    const showSignIn = (open) => {
        $("golf-signin").hidden = !open;
        $("golf-account-out").hidden = open || !!cloud.currentAccount();
        $("golf-signin-status").textContent = "";
    };
    // Status line under the sign-in buttons: grey for progress, red for a problem
    const status = (text, problem = false) => {
        $("golf-signin-status").textContent = text;
        $("golf-signin-status").classList.toggle("golf-error", problem);
    };
    const signInError = (error) => status(error.code === "auth/popup-closed-by-user" ? "" : AUTH_ERRORS[error.code] ?? "Couldn't sign in. Please try again.", true);
    $("golf-signin-open").addEventListener("click", () => showSignIn(true));
    $("golf-signin-cancel").addEventListener("click", () => showSignIn(false));
    $("golf-signin-google").addEventListener("click", () => cloud.signInWithGoogle().catch(signInError));

    // Email: the address is checked by the browser; the password only where one is needed
    const emailInput = $("golf-email");
    const passwordInput = $("golf-password");
    const withEmail = async (needsPassword, working, action) => {
        if (!emailInput.reportValidity()) return;
        if (needsPassword && !passwordInput.value) {
            status("Enter your password (or use a sign-in link instead).", true);
            passwordInput.focus();
            return;
        }
        status(working);
        try {
            await action(emailInput.value.trim(), passwordInput.value);
        } catch (error) {
            signInError(error);
        }
    };
    $("golf-signin-email").addEventListener("submit", (event) => {
        event.preventDefault();
        withEmail(true, "Signing in…", (email, password) => cloud.signInWithPassword(email, password));
    });
    $("golf-signup").addEventListener("click", () => {
        if (passwordInput.value && passwordInput.value.length < MIN_PASSWORD) {
            status(AUTH_ERRORS["auth/weak-password"], true);
            return;
        }
        withEmail(true, "Creating your account…", (email, password) => cloud.createAccount(email, password));
    });
    $("golf-forgot").addEventListener("click", () => withEmail(false, "Sending…", async (email) => {
        // The same answer whether or not the account exists, so the form can't be used to look up emails
        await cloud.sendPasswordReset(email).catch(error => {
            if (error.code !== "auth/user-not-found") throw error;
        });
        status(`If there's an account for ${email}, it has an email with a link to set a new password.`);
    }));
    $("golf-signin-link").addEventListener("click", () => withEmail(false, "Sending…", async (email) => {
        await cloud.sendSignInLink(email);
        status(`Check ${email} for a sign-in link (it opens this page).`);
    }));
    $("golf-signout").addEventListener("click", () => cloud.signOutAccount());
    // Nickname: a problem (taken, too short, characters) shows in red under the box until it's edited
    const nicknameInput = $("golf-nickname-input");
    const nicknameError = (text) => {
        $("golf-nickname-error").textContent = text ?? "";
        $("golf-nickname-error").hidden = !text;
        nicknameInput.setAttribute("aria-invalid", String(!!text));
    };
    nicknameInput.addEventListener("input", () => nicknameError(null));
    $("golf-nickname-edit").addEventListener("click", () => {
        nicknameError(null);
        $("golf-nickname").hidden = false;
        $("golf-nickname-label").textContent = "New nickname for the leaderboard (2–20 characters)";
        nicknameInput.value = cloud.currentAccount()?.nickname ?? "";
        nicknameInput.focus();
    });
    $("golf-nickname").addEventListener("submit", async (event) => {
        event.preventDefault();
        const save = $("golf-nickname-save");
        save.disabled = true;
        save.textContent = "Saving…";
        try {
            await cloud.setNickname(nicknameInput.value);
            nicknameError(null);
            $("golf-nickname").hidden = true;
        } catch (error) {
            nicknameError(error.message || "Couldn't save that nickname.");
            nicknameInput.focus();
        } finally {
            save.disabled = false;
            save.textContent = "Save";
        }
    });
    // Change password: the current one first (wrong → red), then 8+ characters that differ from it
    const passwordForm = $("golf-password-change");
    const currentInput = $("golf-password-current");
    const newInput = $("golf-password-new");
    const passwordStatus = (text, problem = false) => {
        $("golf-password-status").textContent = text;
        $("golf-password-status").hidden = !text;
        $("golf-password-status").classList.toggle("golf-error", problem);
    };
    const showPasswordForm = (open) => {
        passwordForm.hidden = !open;
        currentInput.value = "";
        newInput.value = "";
        passwordStatus("");
        if (open) currentInput.focus();
    };
    $("golf-password-edit").addEventListener("click", () => showPasswordForm(passwordForm.hidden));
    $("golf-password-cancel").addEventListener("click", () => showPasswordForm(false));
    passwordForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!currentInput.value) return passwordStatus("Enter your current password.", true);
        if (newInput.value.length < MIN_PASSWORD) return passwordStatus(AUTH_ERRORS["auth/weak-password"], true);
        if (newInput.value === currentInput.value) return passwordStatus("Pick a new password that's different from your current one.", true);
        const save = $("golf-password-save");
        save.disabled = true;
        passwordStatus("Changing your password…");
        try {
            await cloud.changePassword(currentInput.value, newInput.value);
            showPasswordForm(false);
            passwordStatus("Password changed.");
        } catch (error) {
            const wrong = ["auth/invalid-credential", "auth/wrong-password"].includes(error.code);
            passwordStatus(wrong ? "Your current password isn't right." : AUTH_ERRORS[error.code] ?? "Couldn't change your password. Please try again.", true);
        } finally {
            save.disabled = false;
        }
    });
    $("golf-password-forgot").addEventListener("click", async () => {
        const email = cloud.currentAccount()?.email;
        if (!email) return;
        try {
            await cloud.sendPasswordReset(email);
            showPasswordForm(false);
            passwordStatus(`We've emailed ${email} a link to set a new password.`);
        } catch (error) {
            passwordStatus(AUTH_ERRORS[error.code] ?? "Couldn't send the email. Please try again.", true);
        }
    });

    cloud.onAccount(async (account) => {
        if (!cloud.cloudAvailable) return;
        const uid = account?.uid ?? null;
        if (owner && owner !== uid) forgetAccount(owner); // signed out (or switched): drop that account's copy
        owner = uid;
        $("golf-account-out").hidden = !!account || !$("golf-signin").hidden;
        $("golf-account-in").hidden = !account;
        $("golf-password-edit").hidden = !account?.hasPassword;
        if (!account) showPasswordForm(false);
        if (account) {
            $("golf-signin").hidden = true;
            passwordInput.value = "";
        }
        $("golf-account-name").textContent = account?.nickname ?? account?.email ?? "";
        $("golf-nickname").hidden = !account || !!account.nickname; // first sign-in: pick a nickname
        $("golf-nickname-label").textContent = "Welcome! Pick a nickname for the leaderboard (2–20 characters)";
        if (account && !account.nickname) $("golf-settings").open = true; // the nickname form is in Settings
        $("golf-account").hidden = !!account; // signed in: the account is under Settings
        settingsSummary();
        renderTesting(); // a tester account opens every course
        renderCourses();
        if (account) {
            try {
                const scores = await cloud.loadMyScores();
                if (scores && owner === uid) mergeCloudScores(scores);
            } catch { /* offline: keep the account's copy */ }
        }
        if (!setup.hidden) {
            renderDaily();
            renderWeekly();
            renderCourses();
        }
    });

    // Daily leaderboard: today's top 10 (showBoard)
    $("golf-leaderboard-toggle").addEventListener("click", (event) => showBoard($("golf-leaderboard"), event.currentTarget,
        () => cloud.dailyLeaderboard(dateKey()),
        [["Score", e => `${e.strokes} (${formatToPar(e.toPar)})`], ["Time", e => formatTime(e.time)]],
        "No scores yet today. Be the first!"));

    // A leaderboard under its card (the daily hole, a survival course, the weekly Gauntlet): the
    // toggle opens it and loads the top 10 as a table, your row in bold. `columns` are [heading, entry → cell].
    const showBoard = async (box, toggle, load, columns, empty) => {
        box.hidden = !box.hidden;
        toggle.setAttribute("aria-expanded", String(!box.hidden));
        if (box.hidden) return;
        const note = (text) => box.replaceChildren(Object.assign(document.createElement("p"), { className: "golf-board-note", textContent: text }));
        note("Loading…");
        try {
            const top = await load();
            if (!top.length) return note(empty);
            const me = cloud.currentAccount()?.uid;
            const table = document.createElement("table");
            table.className = "golf-board";
            const row = (cells, tag, className = "") => {
                const tr = document.createElement("tr");
                tr.className = className;
                tr.append(...cells.map(cell => Object.assign(document.createElement(tag), { textContent: cell })));
                return tr;
            };
            table.append(
                row(["#", "Player", ...columns.map(([heading]) => heading)], "th"),
                ...top.map((entry, i) => {
                    const tr = row([String(i + 1), entry.nickname, ...columns.map(([, cell]) => cell(entry))], "td", entry.uid === me ? "me" : "");
                    if (entry.pro) tr.children[1].append(Object.assign(document.createElement("span"), { className: "golf-board-pro", textContent: "Pro" }));
                    return tr;
                }),
            );
            box.replaceChildren(table);
        } catch {
            note("Couldn't load the leaderboard.");
        }
    };
    // Survival courses and the weekly Gauntlet (v1.8.6): holes survived, then strokes, then time
    const showSurvivalBoard = (course, box, toggle) => showBoard(box, toggle,
        () => cloud.survivalLeaderboard(survivalBoard(course)),
        [["Holes", e => `${e.survived}/${course.holes.length}`], ["Strokes", e => String(e.strokes)], ["Time", e => formatTime(e.time)]],
        "No rounds yet. Be the first!");

    // Pro: the switch on the setup screen applies to the next round and picks which bests are shown
    const proSwitch = $("golf-pro");
    proSwitch.checked = load(PRO_KEY, false);
    proSwitch.addEventListener("change", () => {
        save(PRO_KEY, proSwitch.checked);
        renderCourses();
        settingsSummary();
    });

    // Settings, folded away (v1.8.1): its summary says who's signed in and what's switched on
    const settingsSummary = () => {
        const account = cloud.currentAccount();
        $("golf-settings-summary").textContent = [
            account && `signed in as ${account.nickname ?? account.email}`,
            proSwitch.checked ? "Clubs (Pro)" : "Colors",
            colorNamesOn() && "color names on",
        ].filter(Boolean).join(" · ");
    };
    // (after color-names.js has saved the change)
    document.querySelectorAll(".color-names-switch").forEach(input => input.addEventListener("change", () => queueMicrotask(settingsSummary)));
    settingsSummary();

    // The club rows only show while a hole is being played (not with the courses or the score card)
    const show = (section) => {
        for (const el of [setup, hud, roundEnd]) el.hidden = el !== section;
        document.body.classList.toggle("golf-menu", section !== hud);
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
        document.body.classList.remove("golf-pro");
        mergeLongShots(true);
        document.dispatchEvent(new CustomEvent("golfshowcase", { detail: "menu" })); // 3d-mode.js: the full-color surface, turning
        // A layer typed but not jumped to would leave its preview over the map: clear the box (3d-mode.js hides it)
        const layerBox = $("layer-input");
        if (layerBox.value) {
            layerBox.value = "";
            layerBox.dispatchEvent(new Event("input"));
        }
        panel.hidden = false;
        clearBaseColor();
        putterBoxes.forEach(box => { box.style.backgroundColor = ""; });
        renderDaily();
        renderWeekly();
        renderCourses();
        cloud.loadCloud(); // the account section needs the SDK now (no-op without a config)
        show(setup);
    };

    const exitGolf = () => {
        replayToken++;
        $("golf-wind-badge").hidden = true;
        stopTimer();
        round = null;
        setMapState(null);
        document.body.classList.remove("golf", "golf-pro", "golf-menu");
        mergeLongShots(false);
        document.dispatchEvent(new CustomEvent("golfshowcase", { detail: "explore" })); // back to the explore layer
        if (exploringSpace !== null) setSpaceToggle(exploringSpace);
        exploringSpace = null;
        panel.hidden = true;
        clearBaseColor();
    };

    // Courses after the first few need an account and a good round on the one before (unlocks.js).
    // Without a Firebase config there are no accounts, so nothing is locked.
    const lockText = (index) => {
        if (!cloud.cloudAvailable || testing()) return null;
        const lock = courseLock(courses, index, { signedIn: !!owner, bests: load(scoped(BEST_KEY), {}) });
        if (lock === "account") return "Sign in to unlock";
        if (lock === "score") return `Score ${formatToPar(unlockToPar(courses[index]))} or better on ${courses[index - 1].name} to unlock`;
        return null;
    };

    const renderCourses = () => {
        $("golf-courses").replaceChildren(...courses.map((course, index) => {
            const [from, to] = course.hues;
            const span = ((to - from + 359) % 360) + 1;
            const stops = Array.from({ length: 7 }, (_, i) => `hsl(${(from + (span * i) / 6) % 360}, 75%, 50%)`);
            const par = course.holes.reduce((sum, hole) => sum + hole.par, 0);
            const length = course.holes.reduce((sum, hole) => sum + yards(hole.tee, hole.target), 0);
            const pro = proSwitch.checked || isExpert(course.difficulty);
            const record = bestFor(course, pro);
            const locked = lockText(index);
            const bestText = !record ? ""
                : course.survival ? ` · ${pro ? "Pro best" : "best"} ${record.survived} of ${course.holes.length} holes, ${record.strokes} strokes, ${formatTime(record.time)}`
                : ` · ${pro ? "Pro best" : "best"} ${record.strokes} (${formatToPar(record.toPar)}), ${formatTime(record.time)}`;

            const item = document.createElement("li");
            item.className = locked ? "golf-course locked" : "golf-course";
            item.innerHTML = `
                <h3>${course.name}</h3>
                <div class="golf-hues" style="background: linear-gradient(to right, ${stops.join(", ")})"></div>
                <span class="golf-best">${termify(course.difficulty)} · ${course.holes.length} holes · par ${par} · ${length.toLocaleString()} yds${bestText}</span>
                ${course.gimmick ? `<span class="golf-best golf-gimmick">${termify(course.gimmick)}</span>` : ""}
                ${locked ? `<span class="golf-best golf-lock">🔒 ${locked}</span>` : ""}
                <button class="btn btn-primary" type="button"${locked ? " disabled" : ""}>Play</button>
                ${course.survival && cloud.cloudAvailable ? `<button class="btn btn-link golf-leaderboard-toggle" type="button" aria-expanded="false">All-time top 10</button><div class="golf-leaderboard" hidden></div>` : ""}`;
            // The button spans every line of the card
            item.querySelector("button.btn-primary").style.gridRow = `1 / span ${3 + !!course.gimmick + !!locked}`;
            item.querySelector("button.btn-primary").addEventListener("click", () => startRound(course));
            item.querySelector(".golf-leaderboard-toggle")?.addEventListener("click", (event) =>
                showSurvivalBoard(course, item.querySelector(".golf-leaderboard"), event.currentTarget));
            return item;
        }));
    };

    // Daily card: today's hole, your result if you've played it, and your streak
    const renderDaily = async () => {
        const day = dateKey();
        const play = $("golf-daily-play");
        const { name, difficulty } = WEEK[weekday(day)];
        $("golf-daily-date").textContent = `· ${dayLabel(day)}`;
        play.disabled = true;
        const hole = await todaysHole(day).catch(() => null);
        if (!hole) {
            $("golf-daily-info").textContent = "No daily hole today. Check back after the next update.";
            $("golf-daily-status").textContent = "";
            return;
        }
        const summary = hazardSummary(hole.hazards);
        $("golf-daily-info").innerHTML = termify([name, difficulty, isExpert(difficulty) && "Pro", `par ${hole.par}`, `${yards(hole.tee, hole.target)} yds`, summary, hole.wind && "wind"]
            .filter(Boolean).join(" · "));
        const results = loadDaily();
        const result = results[day];
        const run = streak(results, day);
        $("golf-daily-status").textContent = result
            ? `Today: ${result.pickedUp ? "picked up" : scoreName(result.strokes, result.par)} (${result.strokes})${result.pro ? ", Pro" : ""} · streak ${run}`
            : run ? `Streak ${run}: play today to keep it` : "Play today to start a streak";
        play.textContent = result ? "Replay" : "Play";
        play.disabled = false;
    };

    // Weekly Gauntlet card (v1.8.6): this week's nine holes, your best run, the lock, this week's top 10
    let weekly = null; // the week's course during a weekly round
    const renderWeekly = async () => {
        const day = dateKey();
        const week = weekOf(day);
        const play = $("golf-weekly-play");
        const toggle = $("golf-weekly-board-toggle");
        $("golf-weekly-date").textContent = `· week of ${dayLabel(week)}`;
        play.disabled = true;
        const course = await weeklyCourse(week).catch(() => null);
        if (!course) {
            $("golf-weekly-info").textContent = "No Gauntlet this week. Check back after the next update.";
            $("golf-weekly-status").textContent = "";
            toggle.hidden = true;
            return;
        }
        const par = course.holes.reduce((sum, hole) => sum + hole.par, 0);
        const left = daysBetween(day, addDays(week, 7));
        $("golf-weekly-info").innerHTML = termify(["Expansion", "Survival", `${course.holes.length} holes`, `par ${par}`, `new holes in ${left} day${left === 1 ? "" : "s"}`].join(" · "));
        const best = loadWeekly()[week];
        const locked = lockText(GAUNTLET) && "🔒 Unlock The Obsidian Gauntlet to play";
        $("golf-weekly-status").textContent = locked || (best
            ? `Your best this week: ${best.survived} of ${course.holes.length} holes, ${best.strokes} strokes, ${formatTime(best.time)}${best.pro ? ", Pro" : ""}`
            : "No run yet this week");
        play.textContent = best ? "Play again" : "Play";
        play.disabled = !!locked;
        toggle.hidden = !cloud.cloudAvailable;
        const list = $("golf-weekly-board");
        list.hidden = true;
        toggle.setAttribute("aria-expanded", "false");
        toggle.onclick = () => showSurvivalBoard(course, list, toggle);
    };
    const startWeekly = async () => {
        const course = await weeklyCourse(weekOf(dateKey()));
        if (!course || setup.hidden) return;
        weekly = course;
        startRound(course, "weekly");
    };

    const startDaily = async () => {
        const day = dateKey();
        const hole = await todaysHole(day);
        if (!hole || setup.hidden) return; // none today, or left the setup screen meanwhile
        daily = { day, scored: !loadDaily()[day] && !testing(), started: false }; // a tester's daily is never scored
        startRound({ id: "daily", name: "Daily hole", difficulty: WEEK[weekday(day)].difficulty, holes: [hole] }, "daily");
    };

    // Practice: the first hole comes from the starter pool; each next one is built while you play
    const practiceSettings = () => ({
        difficulty: $("golf-practice-difficulty").value,
        par: $("golf-practice-par").value === "any" ? "any" : Number($("golf-practice-par").value),
        hazards: $("golf-practice-hazards").checked,
    });
    const prefetchPractice = () => {
        const settings = practiceSettings();
        const next = buildPracticeHole(settings);
        next.catch(() => {}); // superseded or failed: handled when the hole is needed
        practice = { settings, next };
    };
    // The prefetched hole, waiting out any newer request that replaced it; null if building failed
    const nextPracticeHole = async () => {
        for (;;) {
            const pending = practice.next;
            try {
                return await pending;
            } catch {
                if (practice.next === pending) return null;
            }
        }
    };

    // Waits for the next practice hole on `button` ("Building…"); null if it failed or the game moved on
    const awaitPracticeHole = async (button, label) => {
        const current = round;
        button.disabled = true;
        button.textContent = "Building…";
        const hole = await nextPracticeHole();
        button.disabled = false;
        button.textContent = hole ? label : "Try again";
        if (!hole) prefetchPractice();
        return round === current ? hole : null;
    };

    const startPractice = async () => {
        const settings = practiceSettings();
        const hole = await starterHole(settings);
        if (!hole || setup.hidden) return; // none for these settings, or left the setup screen meanwhile
        startRound({ id: "practice", name: "Practice", difficulty: settings.difficulty, holes: [hole] }, "practice");
        prefetchPractice();
    };

    const nextPractice = async () => {
        const hole = await awaitPracticeHole($("golf-next"), "Next hole");
        if (!hole) return;
        round.course.holes.push(hole);
        round.nextHole();
        prefetchPractice();
        startHole();
    };

    // ---- A round ----
    // `from` (test rounds): start at that hole of the course
    const startRound = (course, newMode = "course", { from = 0 } = {}) => {
        mode = newMode;
        const played = from ? { ...course, holes: course.holes.slice(from) } : course;
        // No undos on a survival course (v1.8.6): taking back the shot that would go over par defeats it
        const undos = ["practice", "test"].includes(mode) ? Infinity : mode === "daily" ? UNDOS_DAILY : course.survival ? 0 : UNDOS_PER_ROUND;
        document.dispatchEvent(new CustomEvent("golfshowcase", { detail: "play" }));
        round = new GolfRound(played, undefined, { undos });
        undoButton.hidden = undos === 0;
        round.firstHole = from;
        taught = new Set();
        round.expert = isExpert(course.difficulty);
        round.pro = proSwitch.checked || round.expert;
        document.body.classList.toggle("golf-pro", round.pro);
        $("golf-card-toggle").hidden = mode !== "course";
        $("golf-card-toggle").setAttribute("aria-expanded", "false");
        liveCard.hidden = true;
        show(hud);
        startHole();
    };

    // Tutorial boxes, each in its own color: a gimmick course's first hole teaches its gimmick
    // (v1.8), and the first hole of a round with a bunker, water or a black hole explains it (v1.8.1)
    const renderTutorials = () => {
        const { hole, holeIndex } = round;
        const lessons = [];
        if (["course", "test"].includes(mode) && round.firstHole + holeIndex === 0 && round.course.tutorial) lessons.push([round.course.id, round.course.tutorial]);
        const types = new Set((hole.hazards ?? []).map(h => h.type));
        const named = (hole.hazards ?? []).some(h => h.wedge);
        for (const type of ["sand", "water", "blackhole"]) {
            if (!types.has(type) || taught.has(type)) continue;
            taught.add(type);
            if (type === "sand" && named) lessons.push([type, "Bunker (sand on the map): land in one and only the wedge it names can play out (it's in the list below)."]);
            else lessons.push([type, HAZARD_LESSONS[type]]);
        }
        $("golf-tutorials").replaceChildren(...lessons.map(([kind, text]) => {
            const box = document.createElement("div");
            box.className = `golf-tutorial ${kind}`;
            const words = document.createElement("p");
            words.textContent = text;
            const close = document.createElement("button");
            close.className = "btn";
            close.type = "button";
            close.textContent = "Got it";
            close.addEventListener("click", () => box.remove());
            box.append(words, close);
            return box;
        }));
    };

    const startHole = () => {
        replayToken++;
        const { hole, holeIndex } = round;
        const length = !round.expert && `${yards(hole.tee, hole.target)} yds`; // Expert: no yardage
        const summary = hazardSummary(hole.hazards);
        const pro = round.pro && "Pro";
        const firstShots = STANDARD_CLUBS.length - COPIES.size + (hole.rules?.roulette ? ROULETTE_SLOTS : 0) + (hole.rules?.flip ? FLIPS : 0);
        const line = hole.lines !== undefined && `perfect line ${hole.lines} of ${firstShots}`;
        let title, info;
        if (mode === "daily") {
            title = `Daily hole · Par ${hole.par}`;
            info = [WEEK[weekday(daily.day)].name, dayLabel(daily.day), length, summary, line, pro, !daily.scored && "replay, not scored"];
        } else if (mode === "weekly") {
            title = `Weekly Gauntlet · Hole ${holeIndex + 1} · Par ${hole.par}`;
            info = [`week of ${dayLabel(weekly.week)}`, length, summary, line, pro, "Survival"];
        } else if (mode === "practice") {
            const { holes, toPar } = round.totals();
            title = `Practice ${holeIndex + 1} · Par ${hole.par}`;
            info = [round.course.difficulty, length, summary, line, pro, holes && `thru ${holes}: ${formatToPar(toPar)}`];
        } else {
            const number = round.firstHole + holeIndex + 1; // test rounds can start partway
            title = `${mode === "test" ? "Test · " : ""}Hole ${number} · Par ${hole.par}`;
            info = [round.course.name, `${number <= 9 ? "Front" : "Back"} 9`, length, summary, line, pro, round.survival && "Survival", mode === "test" && "not saved"];
        }
        $("golf-hole-title").textContent = title;
        $("golf-hole-info").innerHTML = termify(info.filter(Boolean).join(" · ")); // gimmick words explain themselves (terms.js)
        renderTutorials();
        rouletteShifts = hole.rules?.roulette ?? null;
        $("roulette-row").hidden = !rouletteShifts;
        $("flip-row").hidden = !hole.rules?.flip;
        wheel.tabIndex = -1; // the keys are the keyboard's way in
        // Club bans (v1.8.2): the banned rows grey out like a bunker's (renderHazards)
        const ban = hole.rules?.ban && hole.rules.name;
        $("golf-rule").hidden = !ban;
        $("golf-rule").innerHTML = ban ? termify(`Caddie strike: ${ban} on this hole`) : "";
        $("golf-target").style.backgroundColor = css(hole.target);
        $("golf-target-name").textContent = describeColor(hole.target);
        holeEnd.hidden = true;
        pathList.replaceChildren();
        renderPosition(null);
        startTimer();
    };

    // Current color, swatches (harmonies + putter), strokes, undo and the meter
    const renderPosition = (lie) => {
        const { current } = round;
        aim(null);
        $("golf-you").style.backgroundColor = css(current);
        selectBaseColor(css(current), "", "golf", current);
        putterBoxes.forEach((box, index) => {
            const landing = strike(current, { row: "putter", index });
            box.style.backgroundColor = css(landing);
            box.dataset.name = putterNames[index].textContent = describeColor(landing);
        });
        if (round.hole.rules?.flip) {
            flipBoxes.forEach((box, index) => {
                const landing = strike(current, { row: "flip", index });
                box.style.backgroundColor = css(landing);
                box.dataset.name = flipNames[index].textContent = describeColor(landing);
            });
        }
        // Roulette keys show their calm landings and shifts; the wheel shows the one it's on
        if (rouletteShifts) {
            rouletteKeys.forEach((box, index) => {
                const landing = strike(current, { row: "roulette", index }, null, rouletteShifts);
                box.style.backgroundColor = css(landing);
                box.closest(".square-wrapper").querySelector(".square-label").textContent = shiftText(rouletteShifts[index]);
                box.closest(".square-wrapper").dataset.club = proLabel({ row: "roulette", index });
                box.dataset.name = rouletteNames[index].textContent = describeColor(landing);
            });
            paintWheel();
        }
        $("golf-you-name").textContent = describeColor(current);
        renderWind();
        // Screen readers hear the club, and its color unless Pro hides the colors.
        // A swatch that lands in a portal (v1.8) is outlined, labeled with how far from the pin the
        // ball comes out (just "Portal" on Expert, which has no yardage) next to a chip of the exit
        // color (not in Pro, which hides colors), so taking one is a choice. The hex is in the tooltip.
        // A swatch that lands on a mirror (v1.8.1) gets a dotted silver outline, labeled with how far
        // from the pin the flip leaves you ("Mirror" on Expert), next to a chip of that color.
        for (const [box, club] of clubs) {
            if ((club.row === "roulette" && !rouletteShifts) || (club.row === "flip" && !round.hole.rules?.flip)) continue; // rows the hole doesn't have (hidden)
            const landing = strike(current, club, windFor(round.hole, round.strokes), rouletteShifts);
            const portal = round.holeDone ? null : round.hazards.portalAt(landing);
            const mirror = !round.holeDone && round.hazards.at(landing) === "mirror";
            const wrapper = box.closest(".square-wrapper");
            wrapper?.classList.toggle("golf-portal", !!portal);
            wrapper?.classList.toggle("golf-to-mirror", mirror);
            let warps = "";
            if (mirror) {
                const reflected = round.hazards.land(landing);
                const out = yards(reflected, round.hole.target);
                const hex = round.pro ? "" : ` (${hslToHex(reflected)})`;
                warps = round.expert ? ", lands on a mirror" : `, lands on a mirror: flips to${hex} ${out} yds from the pin`;
                wrapper.dataset.mirror = round.expert ? "Mirror" : `⇄ ${out} yds`;
                wrapper.style.setProperty("--reflect", round.pro ? "transparent" : css(reflected));
                wrapper.title = warps.slice(2);
            }
            if (portal) {
                const out = yards(portal.exit, round.hole.target);
                const hex = round.pro ? "" : ` at ${hslToHex(portal.exit)}`;
                warps = round.expert ? `, lands in a portal${hex}` : `, lands in a portal: comes out${hex}, ${out} yds from the pin`;
                wrapper.dataset.portal = round.expert ? "Portal" : `→ ${out} yds`;
                wrapper.style.setProperty("--exit", round.pro ? "transparent" : css(portal.exit));
                wrapper.title = warps.slice(2);
            } else if (wrapper?.title && !mirror) {
                wrapper.title = "";
            }
            box.setAttribute("aria-label", (round.pro ? clubName(club) : `${clubName(club)}, ${box.dataset.name}`) + warps);
        }

        $("golf-strokes").textContent = round.strokes;
        const { undosLeft } = round;
        undoButton.textContent = undosLeft === Infinity ? "Undo" : `Undo (${undosLeft})`;
        undoButton.disabled = !round.canUndo;
        refreshLiveCard();
        const hazards = round.hole.hazards ?? [];
        // Landing in a hazard flashes its outline on the map
        const flash = lie?.landedIn ? { index: hazards.indexOf(lie.landedIn), start: performance.now() } : mapState?.flash;
        mapState = { current, tee: round.hole.tee, target: round.hole.target, trail: [...round.trail], holed: !!lie?.holed, hazards, flash };
        setMapState(mapState);
        renderHazards(lie);

        // Yards: last shot's length and what's left to the pin. Expert hides distance (meter
        // included) until the ball is on the green; you judge it from the map.
        // After a portal, black hole or mirror the trail ends with the landing (marked `warp`): the shot
        // is from the spot before it to there, not the jump
        const last = round.trail.at(-1);
        const shot = last?.warp ? yards(round.trail.at(-2), last) : last && yards(last, current);
        const hidden = round.expert && !lie?.onGreen;
        $("golf-yards").textContent = hidden
            ? "Expert: no yardage until you're on the green"
            : last
            ? `Last shot ${shot} yds · ${lie?.holed ? "in the hole" : `${yards(current, round.hole.target)} yds to the pin`}`
            : `${yards(current, round.hole.target)} yds to the pin`;

        const fill = $("golf-meter-fill");
        const label = $("golf-meter-label");
        if (!lie || hidden) {
            fill.style.width = "0";
            label.textContent = lie ? "Off the green" : "Tee off";
            return;
        }
        // Full bar at the hole's edge, empty at 0.4 (about as far as two colors get)
        const closeness = Math.max(0, Math.min(1, 1 - (lie.distance - IN_THE_HOLE) / 0.4));
        fill.style.width = `${(lie.holed ? 1 : closeness) * 100}%`;
        label.textContent = lieLabel(lie);
    };


    // The roulette wheel (v1.8.4): one swatch that moves to the next shift every second while a hole with
    // one is being played; a stroke on it plays the shift showing (playSwatch)
    const paintWheel = () => {
        if (!round || !rouletteShifts) return;
        const landing = strike(round.current, wheelClub(), null, rouletteShifts);
        wheel.style.backgroundColor = css(landing);
        const wrapper = wheel.closest(".square-wrapper");
        wrapper.querySelector(".square-label").textContent = shiftText(rouletteShifts[spin]);
        $("roulette-order").replaceChildren(...rouletteShifts.map((shift, index) => {
            const item = document.createElement("span");
            item.textContent = shiftText(shift);
            item.classList.toggle("now", index === spin);
            return item;
        }));
        wrapper.dataset.club = proLabel(wheelClub());
        wrapper.classList.toggle("golf-blocked", round.holeDone || !round.canPlay(wheelClub()));
    };
    setInterval(() => {
        if (!round || !rouletteShifts || round.holeDone || hud.hidden) return;
        spin = (spin + 1) % rouletteShifts.length;
        paintWheel();
    }, 1000);

    // Wind: drifts every full shot (the swatches show the calm landing, so aim off). A turning wind
    // (v1.8.3) says the whole cycle under the hole info and this stroke's and the next on the map.
    const renderWind = () => {
        const { hole, strokes } = round;
        const cycle = hole.rules?.windCycle;
        const now = windFor(hole, strokes);
        const say = (wind) => windText(wind) ?? "calm";
        $("golf-wind").hidden = !cycle && !now;
        $("golf-wind").innerHTML = cycle
            ? `${termify(`Wind (per stroke): ${cycle.map(say).join(" → ")}`)}<br>This stroke: ${termify(say(now))}`
            : now ? termify(`Wind: ${say(now)} on every full shot`) : "";
        $("golf-wind-badge").hidden = !cycle && !now;
        $("golf-wind-badge").textContent = cycle ? `🌬 now ${say(now)} · next ${say(windFor(hole, strokes + 1))}` : now ? `🌬 ${say(now)}` : "";
    };

    // Hazard note ("Water! …" / "In the bunker …"), yardage to each hazard, and in a bunker
    // grey out every club but the wedges
    const renderHazards = (lie) => {
        const hazards = round.hole.hazards ?? [];
        const note = $("golf-hazard-note");
        note.hidden = false;
        if (lie?.landed === "water") note.textContent = "Water! +1 stroke, playing again from your last spot.";
        else if (lie?.landed === "portal") note.textContent = "Portal! The ball warped to its exit.";
        else if (lie?.landed === "blackhole") note.textContent = "Black hole! +1 stroke, back to the tee.";
        else if (lie?.landed === "mirror") {
            const landing = round.trail.at(-1); // where it landed, before the flip
            note.textContent = round.pro ? "Mirror! Your color's hex flipped." : `Mirror! Your color's hex flipped: ${hslToHex(landing)} → ${hslToHex(round.current)}.`;
        }
        else if (round.inSand && !round.holeDone) {
            note.textContent = round.sandWedge
                ? `In the bunker: ${ROW_NAMES[round.sandWedge]} only.`
                : "In the bunker: wedges only (Tints, Shades, Tones, Saturate).";
        }
        else note.hidden = true;
        note.className = ["water", "portal", "blackhole", "mirror"].includes(lie?.landed) ? lie.landed : "sand";

        // A portal maze (v1.8) gets one line for its portals instead of a dozen
        const portals = hazards.filter(h => h.type === "portal");
        const listed = portals.length > 3 ? hazards.filter(h => h.type !== "portal") : hazards;
        const mazeLine = portals.length > 3 && document.createElement("li");
        if (mazeLine) {
            mazeLine.className = "portal";
            const nearest = Math.min(...portals.map(p => Math.max(0, yards(round.current, p.center) - p.radius)));
            mazeLine.textContent = round.expert ? `${portals.length} portals` : `${portals.length} portals: nearest ${nearest} yds from you`;
        }
        $("golf-hazards").replaceChildren(...(mazeLine ? [mazeLine] : []), ...listed.map(hazard => {
            const item = document.createElement("li");
            item.className = hazard.type;
            const bunker = hazard.wedge ? `Bunker (${ROW_NAMES[hazard.wedge]} only)` : "Bunker";
            const name = { water: "Water", portal: "Portal", blackhole: "Black hole", mirror: "Mirror", sand: bunker }[hazard.type];
            if (round.expert) item.textContent = name; // no yardage on Expert
            else if (hazard.type === "water") item.textContent = `Water: ${yards(round.current, hazard.center) + hazard.radius} yds to carry`;
            else if (["portal", "blackhole", "mirror"].includes(hazard.type)) item.textContent = `${name}: ${Math.max(0, yards(round.current, hazard.center) - hazard.radius)} yds from you`;
            else item.textContent = `${bunker}: ${Math.max(0, yards(round.hole.target, hazard.center) - hazard.radius)} yds from the pin`;
            return item;
        }));

        for (const [box, club] of clubs) {
            const blocked = !round.holeDone && !round.canPlay(club);
            box.closest(".square-wrapper")?.classList.toggle("golf-blocked", blocked);
            box.setAttribute("aria-disabled", String(blocked)); // in a bunker, or banned (v1.8.2)
        }
    };

    const endHole = () => {
        stopTimer();
        refreshLiveCard();
        const result = round.card[round.holeIndex];
        $("golf-result").textContent = `${round.over ? "Round over: " : ""}${result.pickedUp ? "Picked up" : scoreName(result.strokes, result.par)}`;
        $("golf-result-info").textContent =
            `${result.strokes} strokes · Par ${result.par} · Perfect ${result.perfect} · ${formatTime(result.time)}`;
        $("golf-next").textContent = mode === "practice" || !round.finished ? "Next hole" : mode === "course" ? "See score card" : "See result";
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
            // Through a portal: the replay jumps from where the shot landed to the exit
            const landing = strike(stops.at(-1), club, windFor(hole, i), hole.rules?.roulette); // the route has no penalty strokes
            if (["portal", "mirror"].includes(round.hazards.at(landing))) stops.push({ ...landing, warp: true });
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
        const pro = round.pro ? " · Pro" : "";
        if (mode === "daily") {
            const { clubs, ...result } = round.card[0];
            if (daily.scored) {
                saveDaily(daily.day, { ...result, pro: round.pro });
                sendRound({ kind: "daily", day: daily.day, pro: round.pro, holes: playedHoles(round.card) });
            }
            const run = streak(loadDaily(), daily.day);
            $("golf-round-title").textContent = `Daily hole: ${result.pickedUp ? "Picked up" : scoreName(result.strokes, result.par)}`;
            $("golf-round-message").hidden = true;
            $("golf-round-info").textContent = `${result.strokes} strokes · Par ${result.par} · Perfect ${result.perfect} · ${formatTime(result.time)}${pro} · ${
                daily.scored ? `Streak ${run}` : "Replay, not scored"}`;
            $("golf-card").hidden = true;
            $("golf-again").textContent = "Color Golf menu";
        } else if (mode === "weekly") {
            const length = round.course.holes.length;
            const isBest = !testing() && saveWeekly(weekly.week, totals, round.pro);
            sendRound({ kind: "weekly", day: dateKey(), pro: round.pro, holes: playedHoles(round.card) });
            $("golf-round-title").textContent = `Weekly Gauntlet: ${totals.survived} of ${length} holes survived`;
            $("golf-round-message").textContent = survivalMessage(totals, length, round.card.at(-1));
            $("golf-round-message").hidden = false;
            $("golf-round-info").textContent = `${totals.strokes} strokes (${formatToPar(totals.toPar)}) · Par ${totals.par} · ${formatTime(totals.time)}${pro}${isBest ? " · Your best this week!" : ""}`;
            $("golf-card").hidden = true;
            $("golf-again").textContent = "Color Golf menu";
        } else if (mode === "test") {
            const first = round.firstHole + 1;
            $("golf-round-title").textContent = `Test: ${round.course.name}, holes ${first}–${first + totals.holes - 1}`;
            $("golf-round-message").hidden = true;
            $("golf-round-info").textContent = `${totals.strokes} strokes (${formatToPar(totals.toPar)}) · Perfect ${totals.perfect} · ${formatTime(totals.time)}${pro} · not saved`;
            $("golf-card").hidden = true;
            $("golf-again").textContent = "Color Golf menu";
        } else {
            const isBest = saveBest(round.course, round.pro, totals);
            sendRound({ kind: "course", courseId: round.course.id, rev: round.course.rev ?? 1, pro: round.pro, holes: playedHoles(round.card) });
            const length = round.course.holes.length;
            $("golf-round-title").textContent = round.survival
                ? `${round.course.name}: ${totals.survived} of ${length} holes survived`
                : `${round.course.name}: ${totals.strokes} (${formatToPar(totals.toPar)})`;
            $("golf-round-message").textContent = round.survival ? survivalMessage(totals, length, round.card.at(-1)) : roundMessage(totals);
            $("golf-round-message").hidden = false;
            $("golf-round-info").textContent =
                `${round.survival ? `${totals.strokes} strokes (${formatToPar(totals.toPar)}) · ` : ""}Par ${totals.par} · Perfect ${totals.perfect} · ${formatTime(totals.time)}${pro}${isBest ? ` · New ${round.pro ? "Pro " : ""}best!` : ""}`;
            $("golf-card").hidden = false;
            $("golf-again").textContent = "Choose a course";
            renderCard($("golf-card"));
        }
        clearBaseColor();
        show(roundEnd); // the last hole stays on the map beside the score card
    };

    // Send a finished round to the score server (or queue it for sign-in) and say what happened
    const sendRound = async (payload) => {
        const note = $("golf-round-saved");
        note.hidden = !cloud.cloudAvailable;
        if (!cloud.cloudAvailable) return;
        if (testing()) {
            note.textContent = "Test mode: rounds aren't sent to your account.";
            return;
        }
        note.textContent = cloud.currentAccount() ? "Saving to your account…" : "Sign in to save this round to your account (it'll be sent when you do).";
        try {
            const answer = await cloud.submitRound(payload);
            if (answer && payload.kind === "daily") {
                note.textContent = !answer.scored ? "Today's try was already saved."
                    : answer.ranked ? "Saved to your account and today's leaderboard."
                    : "Saved to your account. It isn't ranked: its first stroke didn't reach the server (offline?).";
            } else if (answer) note.textContent = "Saved to your account.";
            else if (cloud.currentAccount()) note.textContent = "Offline: this round will be saved when you're back online.";
        } catch {
            note.textContent = "The server couldn't check this round, so it wasn't saved to your account.";
        }
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
                const portal = (hole.hazards ?? []).filter(h => h.type === "portal").length;
                const blackHole = (hole.hazards ?? []).filter(h => h.type === "blackhole").length;
                const mirror = (hole.hazards ?? []).filter(h => h.type === "mirror").length;
                return {
                    label: index + 1, par: hole.par, current,
                    hazards: [["sand", sand], ["water", water], ["portal", portal], ["blackhole", blackHole], ["mirror", mirror]]
                        .map(([type, n]) => `<span class="${type}">${n > 3 ? `●${n}` : "●".repeat(n)}</span>`).join(""), // a maze's dozen portals: one dot and the count
                    perfect: played ? played.perfect : "–",
                    strokes: played ? played.strokes : current ? round.strokes : "–",
                    parPlayed: played ? hole.par : null,
                    pickedUp: !!played?.pickedUp,
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
                row("You", c => c.pickedUp
                    ? `<td class="picked-up" title="Picked up">${c.strokes}✕</td>`
                    : `<td class="${[c.current && "current", under(c) && "under"].filter(Boolean).join(" ")}">${c.strokes}</td>`)
            }</table>`;
        };
        container.innerHTML = nineTable(0) + nineTable(1);
    };

    // Live card: shown with the Card button, refreshed after every stroke and hole
    const liveCard = $("golf-live-card");
    const refreshLiveCard = () => {
        if (liveCard.hidden || !round || mode !== "course") return;
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

    // ---- Strokes: double-click a swatch (mouse), tap it (touch), or Enter / Space (keyboard) ----
    // Listeners use the capture phase, so harmony.js's explore-mode choosing never sees them.
    // Touch on Expert: the first tap aims (the swatch is outlined), a second tap on it plays, since
    // Expert swatches are blank and a stray tap would cost a stroke.
    let aimed = null; // square aimed at with a first tap
    const aim = (square) => {
        aimed?.closest(".square-wrapper")?.classList.remove("golf-aimed");
        aimed = square;
        aimed?.closest(".square-wrapper")?.classList.add("golf-aimed");
    };
    const ui = $("ui-container");
    const inGame = () => document.body.classList.contains("golf");
    ui.addEventListener("dblclick", (event) => {
        if (!inGame()) return;
        event.stopPropagation();
        if (lastPointerType() !== "touch") playSwatch(event.target.closest(".square"));
    }, { capture: true });
    ui.addEventListener("click", (event) => {
        const square = event.target.closest(".square");
        if (!inGame() || !(clubs.has(square) || square === wheel) || lastPointerType() !== "touch") return;
        event.stopPropagation();
        if (round?.expert && aimed !== square) aim(square);
        else playSwatch(square);
    }, { capture: true });
    ui.addEventListener("keydown", (event) => {
        const square = event.target.closest?.(".square");
        if (!inGame() || !clubs.has(square) || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        event.stopPropagation();
        playSwatch(square);
    }, { capture: true });

    function playSwatch(square) {
        const club = square === wheel ? wheelClub() : clubs.get(square); // the wheel plays the shift showing
        if (!round || !club || round.holeDone) return;

        const lie = round.play(club);
        if (!lie) return; // not playable from here (e.g. a driver in a bunker)
        if (mode === "daily" && daily.scored && !daily.started) {
            // Today's try has started: it counts as a pick-up unless the hole is finished
            daily.started = true;
            const { par, perfect } = round.hole;
            saveDaily(daily.day, { par, perfect, strokes: par * 2, time: 0, pickedUp: true, pro: round.pro });
            cloud.startDaily(daily.day, round.pro);
        }
        renderPosition(lie);
        if (round.holeDone) endHole();
    }

    undoButton.addEventListener("click", () => {
        if (!round?.undo()) return;
        renderPosition(round.history.length ? round.lie() : null);
    });

    $("golf-next").addEventListener("click", () => {
        if (mode === "practice") nextPractice();
        else if (round.finished) endRound();
        else if (round.nextHole()) startHole();
    });
    $("golf-show-path").addEventListener("click", showPath);
    $("golf-quit").addEventListener("click", () => {
        if (["practice", "test"].includes(mode) || (mode === "daily" && !daily.started) || round.finished) openSetup();
        else if (mode === "daily") {
            if (confirm("Leave today's hole? It counts as a pick-up.")) openSetup();
        } else if (confirm("Quit this round? It won't be saved.")) openSetup();
    });

    $("golf-play").addEventListener("click", openSetup);
    $("golf-daily-play").addEventListener("click", startDaily);
    $("golf-weekly-play").addEventListener("click", startWeekly);
    $("golf-practice-play").addEventListener("click", startPractice);
    $("golf-quit-setup").addEventListener("click", exitGolf);
    $("golf-again").addEventListener("click", openSetup);
    $("golf-done").addEventListener("click", exitGolf);
}

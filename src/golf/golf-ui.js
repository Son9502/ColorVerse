import courses from "./courses.json";
import { GolfRound, scoreName, compareRounds } from "./game.js";
import { PUTTER, strike } from "./clubs.js";
import { IN_THE_HOLE, hslDistance } from "./oklab.js";
import { harmonySets, selectBaseColor, clearBaseColor } from "../harmony.js";
import { setMapState } from "./mapState.js";
import { WEEK, dateKey, daysBetween, dayLabel, weekday, streak } from "./daily.js";
import { poolKey, PARS } from "./practice.js";
import { courseLock, unlockToPar } from "./unlocks.js";
import * as cloud from "../cloud/cloud.js";

// ----------------------------------
// Color Golf screen
// ----------------------------------
// body.golf hides the explore controls (search, sliders, help) and shows the putter row;
// 3d-mode.js and dropdown.js skip canvas picking and Esc while it's set. body.golf-pro hides the
// swatch colors in a Pro round. Three ways to play: a course (18 holes), the daily hole, practice.
// Expert (any mode) is always Pro and hides the yardage until you're on the green.

const BEST_KEY = "colorverse.golf.best.v2"; // v2: courses regenerated in v1.1.1, so older bests no longer apply
const DAILY_KEY = "colorverse.golf.daily.v1"; // { "2026-10-28": { strokes, par, perfect, time, pickedUp, pro } }
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

// "Tints 60%", "Triadic +120°", "Putter Sat +"
function clubName({ row, index }) {
    if (row === "putter") return `Putt ${PUTTER[index].label}`;
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

// Pro label under a swatch: the row name is already above it, so just the shift or strength
function proLabel({ row, index }) {
    if (row === "putter") return PUTTER[index].label;
    return clubName({ row, index }).slice(ROW_NAMES[row].length + 1);
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

// "2 bunkers, 1 lake" (empty for a clear hole)
function hazardSummary(hazards = []) {
    const count = (type) => hazards.filter(h => h.type === type).length;
    const part = (n, one, many) => (n ? `${n} ${n === 1 ? one : many}` : "");
    return [part(count("sand"), "bunker", "bunkers"), part(count("water"), "lake", "lakes")].filter(Boolean).join(", ");
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
    best[bestKey(course.id, pro)] = { strokes: totals.strokes, toPar: totals.toPar, time: totals.time, rev: course.rev ?? 1 };
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
    let timer = null;
    let mapState = null; // last state sent to the map; the replay draws on top of it
    let replayToken = 0; // bumped to stop a replay in progress
    let mode = "course"; // "course" | "daily" | "practice"
    let daily = null; // { day, scored, started } during a daily round
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
    // Pro rounds show these under the swatches instead of the colors (index.css)
    for (const [box, club] of clubs) box.closest(".square-wrapper")?.setAttribute("data-club", proLabel(club));
    // In a game each row heading starts with its club type (hidden while exploring)
    for (const [row, elements] of Object.entries(harmonySets)) {
        const heading = elements[0]?.box?.closest(".colors-row")?.querySelector(".row-header h3");
        if (!heading || !CLUB_TYPES[row]) continue;
        const type = document.createElement("span");
        type.className = "club-type";
        type.textContent = CLUB_TYPES[row];
        heading.prepend(type);
    }

    // ---- Account (v1.6): only when Firebase is configured ----
    if (cloud.cloudAvailable) {
        $("golf-account").hidden = false;
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
        if (account) {
            try {
                const scores = await cloud.loadMyScores();
                if (scores && owner === uid) mergeCloudScores(scores);
            } catch { /* offline: keep the account's copy */ }
        }
        if (!setup.hidden) {
            renderDaily();
            renderCourses();
        }
    });

    // Daily leaderboard: top 10 for today, your entry in bold
    const leaderboard = $("golf-leaderboard");
    $("golf-leaderboard-toggle").addEventListener("click", async (event) => {
        leaderboard.hidden = !leaderboard.hidden;
        event.currentTarget.setAttribute("aria-expanded", String(!leaderboard.hidden));
        if (leaderboard.hidden) return;
        leaderboard.replaceChildren(Object.assign(document.createElement("li"), { textContent: "Loading…" }));
        try {
            const top = await cloud.dailyLeaderboard(dateKey());
            const me = cloud.currentAccount()?.uid;
            leaderboard.replaceChildren(...(top.length ? top.map(entry => {
                const item = document.createElement("li");
                item.className = entry.uid === me ? "me" : "";
                item.textContent = `${entry.nickname}: ${entry.strokes} (${formatToPar(entry.toPar)}) · ${formatTime(entry.time)}${entry.pro ? " · Pro" : ""}`;
                return item;
            }) : [Object.assign(document.createElement("li"), { textContent: "No scores yet today. Be the first!" })]));
        } catch {
            leaderboard.replaceChildren(Object.assign(document.createElement("li"), { textContent: "Couldn't load the leaderboard." }));
        }
    });

    // Pro: the switch on the setup screen applies to the next round and picks which bests are shown
    const proSwitch = $("golf-pro");
    proSwitch.checked = load(PRO_KEY, false);
    proSwitch.addEventListener("change", () => {
        save(PRO_KEY, proSwitch.checked);
        renderCourses();
    });

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
        document.body.classList.remove("golf-pro");
        panel.hidden = false;
        clearBaseColor();
        putterBoxes.forEach(box => { box.style.backgroundColor = ""; });
        renderDaily();
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
        document.body.classList.remove("golf", "golf-pro");
        if (exploringSpace !== null) setSpaceToggle(exploringSpace);
        exploringSpace = null;
        panel.hidden = true;
        clearBaseColor();
    };

    // Courses after the first few need an account and a good round on the one before (unlocks.js).
    // Without a Firebase config there are no accounts, so nothing is locked.
    const lockText = (index) => {
        if (!cloud.cloudAvailable) return null;
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

            const item = document.createElement("li");
            item.className = locked ? "golf-course locked" : "golf-course";
            item.innerHTML = `
                <h3>${course.name}</h3>
                <div class="golf-hues" style="background: linear-gradient(to right, ${stops.join(", ")})"></div>
                <span class="golf-best">${course.difficulty} · ${course.holes.length} holes · par ${par} · ${length.toLocaleString()} yds${record ? ` · ${pro ? "Pro best" : "best"} ${record.strokes} (${formatToPar(record.toPar)}), ${formatTime(record.time)}` : ""}</span>
                ${locked ? `<span class="golf-best golf-lock">🔒 ${locked}</span>` : ""}
                <button class="btn btn-primary" type="button"${locked ? " disabled" : ""}>Play</button>`;
            item.querySelector("button").addEventListener("click", () => startRound(course));
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
        $("golf-daily-info").textContent = [name, difficulty, isExpert(difficulty) && "Pro", `par ${hole.par}`, `${yards(hole.tee, hole.target)} yds`, summary, hole.wind && "wind"]
            .filter(Boolean).join(" · ");
        const results = loadDaily();
        const result = results[day];
        const run = streak(results, day);
        $("golf-daily-status").textContent = result
            ? `Today: ${result.pickedUp ? "picked up" : scoreName(result.strokes, result.par)} (${result.strokes})${result.pro ? ", Pro" : ""} · streak ${run}`
            : run ? `Streak ${run}: play today to keep it` : "Play today to start a streak";
        play.textContent = result ? "Replay" : "Play";
        play.disabled = false;
    };

    const startDaily = async () => {
        const day = dateKey();
        const hole = await todaysHole(day);
        if (!hole || setup.hidden) return; // none today, or left the setup screen meanwhile
        daily = { day, scored: !loadDaily()[day], started: false };
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
    const startRound = (course, newMode = "course") => {
        mode = newMode;
        round = new GolfRound(course, undefined, mode === "practice" ? { undos: Infinity } : {});
        round.expert = isExpert(course.difficulty);
        round.pro = proSwitch.checked || round.expert;
        document.body.classList.toggle("golf-pro", round.pro);
        $("golf-card-toggle").hidden = mode !== "course";
        $("golf-card-toggle").setAttribute("aria-expanded", "false");
        liveCard.hidden = true;
        show(hud);
        startHole();
    };

    const startHole = () => {
        replayToken++;
        const { hole, holeIndex } = round;
        const length = !round.expert && `${yards(hole.tee, hole.target)} yds`; // Expert: no yardage
        const summary = hazardSummary(hole.hazards);
        const pro = round.pro && "Pro";
        const line = hole.lines !== undefined && `perfect line ${hole.lines} of 41`;
        let title, info;
        if (mode === "daily") {
            title = `Daily hole · Par ${hole.par}`;
            info = [WEEK[weekday(daily.day)].name, dayLabel(daily.day), length, summary, line, pro, !daily.scored && "replay, not scored"];
        } else if (mode === "practice") {
            const { holes, toPar } = round.totals();
            title = `Practice ${holeIndex + 1} · Par ${hole.par}`;
            info = [round.course.difficulty, length, summary, line, pro, holes && `thru ${holes}: ${formatToPar(toPar)}`];
        } else {
            title = `Hole ${holeIndex + 1} · Par ${hole.par}`;
            info = [round.course.name, `${round.nine === 0 ? "Front" : "Back"} 9`, length, summary, line, pro];
        }
        $("golf-hole-title").textContent = title;
        $("golf-hole-info").textContent = info.filter(Boolean).join(" · ");
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
        const last = round.trail.at(-1);
        const hidden = round.expert && !lie?.onGreen;
        $("golf-yards").textContent = hidden
            ? "Expert: no yardage until you're on the green"
            : last
            ? `Last shot ${yards(last, current)} yds · ${lie?.holed ? "in the hole" : `${yards(current, round.hole.target)} yds to the pin`}`
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


    // Hazard note ("Water! …" / "In the bunker …"), yardage to each hazard, and in a bunker
    // grey out every club but the wedges
    const renderHazards = (lie) => {
        const hazards = round.hole.hazards ?? [];
        const note = $("golf-hazard-note");
        note.hidden = false;
        if (lie?.landed === "water") note.textContent = "Water! +1 stroke, playing again from your last spot.";
        else if (round.inSand && !round.holeDone) {
            note.textContent = round.sandWedge
                ? `In the bunker: ${ROW_NAMES[round.sandWedge]} only.`
                : "In the bunker: wedges only (Tints, Shades, Tones, Saturate).";
        }
        else note.hidden = true;
        note.className = lie?.landed === "water" ? "water" : "sand";

        $("golf-hazards").replaceChildren(...hazards.map(hazard => {
            const item = document.createElement("li");
            item.className = hazard.type;
            const bunker = hazard.wedge ? `Bunker (${ROW_NAMES[hazard.wedge]} only)` : "Bunker";
            if (round.expert) item.textContent = hazard.type === "water" ? "Water" : bunker; // no yardage on Expert
            else item.textContent = hazard.type === "water"
                ? `Water: ${yards(round.current, hazard.center) + hazard.radius} yds to carry`
                : `${bunker}: ${Math.max(0, yards(round.hole.target, hazard.center) - hazard.radius)} yds from the pin`;
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
        $("golf-next").textContent = mode === "practice" || !round.finished ? "Next hole" : mode === "daily" ? "See result" : "See score card";
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
        } else {
            const isBest = saveBest(round.course, round.pro, totals);
            sendRound({ kind: "course", courseId: round.course.id, rev: round.course.rev ?? 1, pro: round.pro, holes: playedHoles(round.card) });
            $("golf-round-title").textContent = `${round.course.name}: ${totals.strokes} (${formatToPar(totals.toPar)})`;
            $("golf-round-message").textContent = roundMessage(totals);
            $("golf-round-message").hidden = false;
            $("golf-round-info").textContent =
                `Par ${totals.par} · Perfect ${totals.perfect} · ${formatTime(totals.time)}${pro}${isBest ? ` · New ${round.pro ? "Pro " : ""}best!` : ""}`;
            $("golf-card").hidden = false;
            $("golf-again").textContent = "Choose a course";
            renderCard($("golf-card"));
        }
        clearBaseColor();
        setMapState(null);
        show(roundEnd);
    };

    // Send a finished round to the score server (or queue it for sign-in) and say what happened
    const sendRound = async (payload) => {
        const note = $("golf-round-saved");
        note.hidden = !cloud.cloudAvailable;
        if (!cloud.cloudAvailable) return;
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
                return {
                    label: index + 1, par: hole.par, current,
                    hazards: `<span class="sand">${"●".repeat(sand)}</span><span class="water">${"●".repeat(water)}</span>`,
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

    // ---- Strokes: double-click a swatch ----
    // Capture phase, so harmony.js's explore-mode double-click never sees it
    $("ui-container").addEventListener("dblclick", (event) => {
        if (!document.body.classList.contains("golf")) return;
        event.stopPropagation();
        const club = clubs.get(event.target.closest(".square"));
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
    }, { capture: true });

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
        if (mode === "practice" || (mode === "daily" && !daily.started) || round.finished) openSetup();
        else if (mode === "daily") {
            if (confirm("Leave today's hole? It counts as a pick-up.")) openSetup();
        } else if (confirm("Quit this round? It won't be saved.")) openSetup();
    });

    $("golf-play").addEventListener("click", openSetup);
    $("golf-daily-play").addEventListener("click", startDaily);
    $("golf-practice-play").addEventListener("click", startPractice);
    $("golf-quit-setup").addEventListener("click", exitGolf);
    $("golf-again").addEventListener("click", openSetup);
    $("golf-done").addEventListener("click", exitGolf);
}

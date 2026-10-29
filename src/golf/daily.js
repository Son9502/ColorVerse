// ----------------------------------
// Color Golf daily hole: the weekly rotation and dates
// ----------------------------------
// One hole per day, the same for everyone: resources/generateDaily.mjs builds them ahead of time
// into daily.json (one per date from `start`), each from its own seed, so the list can be extended
// without changing any earlier day. The day follows the player's local date.

const STRONG_WIND = { hue: [8, 12], light: [4, 6] };

// Indexed by Date.getUTCDay() of the date (0 = Sunday). Full spectrum of hues every day.
// Expert days use Expert par (holeMaker.js expertPerfect) and are always played as Pro.
// `plan` / `windPlan` as in holeMaker.js's buildHole.
export const WEEK = [
    { name: "Ace Sunday", par: 3, perfect: 1, difficulty: "Beginner" }, // one swatch lands in the hole
    { name: "Easy Monday", par: 3, perfect: 2, difficulty: "Beginner" },
    { name: "Tuesday", par: 4, perfect: 3, difficulty: "Standard" },
    { name: "Windy Wednesday", par: 4, perfect: 3, difficulty: "Standard", plan: { greenside: 1 }, windPlan: { hue: [4, 8], light: [2, 4] } },
    { name: "Long Thursday", par: 5, perfect: 4, difficulty: "Standard", plan: { greenside: 1, route: 1 }, windPlan: { hue: [2, 4] } },
    { name: "Water Friday", par: 4, perfect: 4, difficulty: "Expert", plan: { water: "band" }, windPlan: STRONG_WIND },
    { name: "Championship Saturday", par: 5, perfect: 4, difficulty: "Expert", plan: { water: "band", greenside: 1, route: 1 }, windPlan: STRONG_WIND },
];

export const DAILY_HUES = [0, 360];

const DAY_MS = 86400000;

// "2026-10-28" for a local Date
export function dateKey(date = new Date()) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Whole days from key `a` to key `b` (dates as UTC midnights, so DST never shifts them)
export const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS);
export const addDays = (key, days) => new Date(Date.parse(key) + days * DAY_MS).toISOString().slice(0, 10);
export const weekday = (key) => new Date(Date.parse(key)).getUTCDay();

// Seeds for a day's three random sequences (tee/target, hazards, wind), from the date alone
export const daySeed = (key) => Number(key.replaceAll("-", ""));

// "Wed 28 Oct"
export function dayLabel(key) {
    return new Date(Date.parse(key)).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

// Days in a row with a result, ending today (or yesterday, if today isn't played yet)
export function streak(results, today = dateKey()) {
    let day = results[today] ? today : addDays(today, -1);
    let count = 0;
    while (results[day]) {
        count++;
        day = addDays(day, -1);
    }
    return count;
}

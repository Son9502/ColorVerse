import { CLUBS, STATE_COUNT, allStrikes, encode, decode } from "./clubs.js";
import { hslToOklab, oklabDistance, IN_THE_HOLE } from "./oklab.js";
import { isWedge } from "./hazards.js";

// ----------------------------------
// Par solver: breadth-first search over every club from the tee
// ----------------------------------
// States are whole-number HSL (≈3.7M), so visited/parent tables are flat typed arrays.
//
// Hazards (a hazardMap from hazards.js) keep the search exact, because both rules depend only on
// the current color: a water landing is never worth it (+1 penalty, back where you were), so those
// strokes are skipped; from sand only wedges are tried (only the named one in an Expert bunker). `avoidHazards` treats sand as blocked too,
// for the "finishable within par without touching a hazard" check. `wind` drifts every full shot
// (see clubs.js); it's fixed per hole, so the search stays exact. A landing in a portal (v1.8) is the
// portal's exit, which depends only on the landing, so that stays exact too. A black hole (v1.8)
// is skipped like water (back to the tee is never worth it). `avoidPortals` treats portals as
// blocked, for the "can't make par without a portal" check on black-hole holes. From inside a mirror
// (v1.8.1) hue moves flip, which depends only on the current color, so that stays exact too.

const UNSEEN = 255;

const WEDGE_CLUB = CLUBS.map(isWedge);
const CLUB_ROW = CLUBS.map(club => club.row);
// Whether club `i` can be played from a state whose sand rule is `wedge` (null: any wedge)
const sandAllows = (i, wedge) => (wedge ? CLUB_ROW[i] === wedge : WEDGE_CLUB[i]);

// Strokes from `tee` to every state reachable within `maxDepth`, plus how each was first reached
export function searchFrom(tee, maxDepth = 7, hazards = null, { avoidHazards = false, avoidPortals = false, wind = null } = {}) {
    const blocked = hazards && !hazards.empty;
    const dist = new Uint8Array(STATE_COUNT).fill(UNSEEN);
    const parent = new Int32Array(STATE_COUNT).fill(-1);
    const club = new Uint8Array(STATE_COUNT);

    const start = encode(tee);
    dist[start] = 0;
    let frontier = [start];
    const reached = [start];

    for (let depth = 1; depth <= maxDepth && frontier.length; depth++) {
        const next = [];
        for (const code of frontier) {
            const from = decode(code);
            const lie = blocked ? hazards.at(from, code) : null;
            const inSand = lie === "sand";
            const wedge = inSand ? hazards.wedgeAt(from, code) : null;
            allStrikes(from, wind, lie === "mirror").forEach((landing, clubIndex) => {
                if (inSand && !sandAllows(clubIndex, wedge)) return;
                if (avoidPortals && blocked && hazards.portalAt(landing)) return;
                const hsl = blocked ? hazards.land(landing) : landing; // through a portal, if it's in one
                const to = encode(hsl);
                if (dist[to] !== UNSEEN) return;
                if (blocked) {
                    const hazard = hazards.at(hsl, to);
                    if (hazard === "water" || hazard === "blackhole" || (hazard === "sand" && avoidHazards)) return;
                }
                dist[to] = depth;
                parent[to] = code;
                club[to] = clubIndex;
                next.push(to);
                reached.push(to);
            });
        }
        frontier = next;
    }
    return { tee, dist, parent, club, reached };
}

// Par for `target`: fewest strokes to land anywhere in the hole (OKLab distance < IN_THE_HOLE).
// Returns { par, end } where `end` is the state the best path finishes on, or null if out of reach.
// The generators ask this of the same search for hundreds of targets, so each reached state's
// OKLab color is computed once per search and kept with it.
export function parFor(search, target, tolerance = IN_THE_HOLE) {
    const goal = hslToOklab(target);
    const lab = (search.lab ??= labsOf(search.reached));
    let best = null;
    for (let i = 0; i < search.reached.length; i++) {
        const code = search.reached[i];
        const d = search.dist[code];
        if (best && d >= best.par) continue;
        if (oklabDistance([lab[i * 3], lab[i * 3 + 1], lab[i * 3 + 2]], goal) < tolerance) best = { par: d, end: code };
    }
    return best;
}

function labsOf(codes) {
    const lab = new Float64Array(codes.length * 3);
    codes.forEach((code, i) => lab.set(hslToOklab(decode(code)), i * 3));
    return lab;
}

// Whether `target` can be holed within `maxDepth` strokes from `from`: the same answer as
// parFor(searchFrom(...)).par <= maxDepth, but it stops at the first state in the hole and reuses one
// scratch table, so the generators can ask it thousands of times (the birdie-line checks).
let scratch = null;
export function reachesWithin(from, target, maxDepth, hazards = null, { avoidHazards = false, wind = null } = {}) {
    const goal = hslToOklab(target);
    const inHole = (hsl) => oklabDistance(hslToOklab(hsl), goal) < IN_THE_HOLE;
    if (inHole(from)) return true;
    const blocked = hazards && !hazards.empty;
    const seen = (scratch ??= new Uint8Array(STATE_COUNT));
    const start = encode(from);
    const touched = [start];
    seen[start] = 1;
    let frontier = [start];
    try {
        for (let depth = 1; depth <= maxDepth && frontier.length; depth++) {
            const next = [];
            for (const code of frontier) {
                const here = decode(code);
                const lie = blocked ? hazards.at(here, code) : null;
                const inSand = lie === "sand";
                const wedge = inSand ? hazards.wedgeAt(here, code) : null;
                const landings = allStrikes(here, wind, lie === "mirror");
                for (let clubIndex = 0; clubIndex < landings.length; clubIndex++) {
                    if (inSand && !sandAllows(clubIndex, wedge)) continue;
                    const hsl = blocked ? hazards.land(landings[clubIndex]) : landings[clubIndex];
                    const to = encode(hsl);
                    if (seen[to]) continue;
                    if (blocked) {
                        const hazard = hazards.at(hsl, to);
                        if (hazard === "water" || hazard === "blackhole" || (hazard === "sand" && avoidHazards)) continue;
                    }
                    if (inHole(hsl)) return true;
                    seen[to] = 1;
                    touched.push(to);
                    next.push(to);
                }
            }
            frontier = next;
        }
        return false;
    } finally {
        for (const code of touched) seen[code] = 0;
    }
}

// The par path as a list of { club, hsl } strokes from the tee
export function pathTo(search, end) {
    const strokes = [];
    for (let code = end; search.parent[code] !== -1; code = search.parent[code]) {
        strokes.push({ club: CLUBS[search.club[code]], hsl: decode(code) });
    }
    return strokes.reverse();
}

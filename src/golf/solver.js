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
// strokes are skipped; from sand only wedges are tried. `avoidHazards` treats sand as blocked too,
// for the "finishable within par without touching a hazard" check. `wind` drifts every full shot
// (see clubs.js); it's fixed per hole, so the search stays exact.

const UNSEEN = 255;

const WEDGE_CLUB = CLUBS.map(isWedge);

// Strokes from `tee` to every state reachable within `maxDepth`, plus how each was first reached
export function searchFrom(tee, maxDepth = 7, hazards = null, { avoidHazards = false, wind = null } = {}) {
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
            const inSand = blocked && hazards.at(from, code) === "sand";
            allStrikes(from, wind).forEach((hsl, clubIndex) => {
                if (inSand && !WEDGE_CLUB[clubIndex]) return;
                const to = encode(hsl);
                if (dist[to] !== UNSEEN) return;
                if (blocked) {
                    const hazard = hazards.at(hsl, to);
                    if (hazard === "water" || (hazard === "sand" && avoidHazards)) return;
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
export function parFor(search, target, tolerance = IN_THE_HOLE) {
    const goal = hslToOklab(target);
    let best = null;
    for (const code of search.reached) {
        const d = search.dist[code];
        if (best && d >= best.par) continue;
        if (oklabDistance(hslToOklab(decode(code)), goal) < tolerance) best = { par: d, end: code };
    }
    return best;
}

// The par path as a list of { club, hsl } strokes from the tee
export function pathTo(search, end) {
    const strokes = [];
    for (let code = end; search.parent[code] !== -1; code = search.parent[code]) {
        strokes.push({ club: CLUBS[search.club[code]], hsl: decode(code) });
    }
    return strokes.reverse();
}

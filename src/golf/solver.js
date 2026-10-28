import { CLUBS, STATE_COUNT, allStrikes, encode, decode } from "./clubs.js";
import { hslToOklab, oklabDistance, IN_THE_HOLE } from "./oklab.js";

// ----------------------------------
// Par solver: breadth-first search over every club from the tee
// ----------------------------------
// States are whole-number HSL (≈3.7M), so visited/parent tables are flat typed arrays.

const UNSEEN = 255;

// Strokes from `tee` to every state reachable within `maxDepth`, plus how each was first reached
export function searchFrom(tee, maxDepth = 7) {
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
            allStrikes(decode(code)).forEach((hsl, clubIndex) => {
                const to = encode(hsl);
                if (dist[to] !== UNSEEN) return;
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

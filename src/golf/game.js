import { strike, PUTTER } from "./clubs.js";
import { hslDistance, IN_THE_HOLE } from "./oklab.js";
import { hazardMap, isWedge } from "./hazards.js";

// ----------------------------------
// Color Golf round: strokes, undo, score card
// ----------------------------------
// No DOM access: the UI calls play()/undo()/nextHole() and renders what comes back.

export const UNDOS_PER_NINE = 1;

const SCORE_NAMES = { "-3": "Albatross", "-2": "Eagle", "-1": "Birdie", "0": "Par", "1": "Bogey", "2": "Double bogey", "3": "Triple bogey" };

// "Birdie", "Par", "+4"… for strokes relative to par (a hole in one gets its own name)
export function scoreName(strokes, par) {
    if (strokes === 1) return "Hole in one";
    const diff = strokes - par;
    return SCORE_NAMES[diff] ?? (diff > 0 ? `+${diff}` : `${diff}`);
}

const NO_HAZARDS = hazardMap();

// Fewest putts (0–2) from `hsl` into the hole, or null if it takes more than 2.
// No putting out of sand, and a putt that would land in a hazard doesn't count.
export function puttsToHole(hsl, target, hazards = NO_HAZARDS) {
    if (hazards.at(hsl)) return null;
    let frontier = [hsl];
    for (let putts = 0; putts <= 2; putts++) {
        if (frontier.some(c => hslDistance(c, target) < IN_THE_HOLE)) return putts;
        frontier = frontier
            .flatMap(c => PUTTER.map((_, index) => strike(c, { row: "putter", index })))
            .filter(c => !hazards.at(c));
    }
    return null;
}

export class GolfRound {
    constructor(course, now = () => performance.now()) {
        this.course = course;
        this.now = now;
        this.card = []; // finished holes: { par, perfect, strokes, time, pickedUp }
        this.holeIndex = -1;
        this.nextHole();
    }

    get hole() { return this.course.holes[this.holeIndex]; }
    get nine() { return this.holeIndex < 9 ? 0 : 1; }
    get maxStrokes() { return this.hole.par * 2; } // pick up at double par
    get finished() { return this.card.length === this.course.holes.length; }
    get holeDone() { return this.card.length > this.holeIndex; }
    get inSand() { return this.hazards.at(this.current) === "sand"; }
    get canUndo() { return !this.holeDone && this.history.length > 0 && this.undosLeft[this.nine] > 0; }

    // Clubs allowed from here: wedges only in a bunker
    canPlay(club) { return !this.inSand || isWedge(club); }

    // Distance to the target, whether that's in the hole, whether it's on the green
    // (2 putts or fewer will hole it, as in golf) and which hazard, if any, the ball is in
    lie(hsl = this.current) {
        const distance = hslDistance(hsl, this.hole.target);
        const holed = distance < IN_THE_HOLE;
        const hazard = this.hazards.at(hsl);
        return { distance, holed, hazard, onGreen: holed || puttsToHole(hsl, this.hole.target, this.hazards) !== null };
    }

    // One stroke with a club ({ row, index }); returns the new lie plus `landed`
    // ("water" / "sand" / null) and `landedIn` (that hazard), or null if the club can't be played.
    // Water: +1 penalty stroke and the ball stays where it was hit from.
    play(club) {
        if (this.holeDone || !this.canPlay(club)) return null;
        this.history.push({ current: this.current, strokes: this.strokes, trail: this.trail.length });

        const landing = strike(this.current, club, this.hole.wind);
        const landed = this.hazards.at(landing);
        const landedIn = landed ? this.hazards.which(landing) : null;
        if (landed === "water") {
            this.strokes += 2; // the stroke + 1 penalty
        } else {
            this.trail.push(this.current);
            this.current = landing;
            this.strokes++;
        }

        const lie = this.lie();
        if (lie.holed || this.strokes >= this.maxStrokes) this._finishHole(!lie.holed);
        return { hsl: this.current, ...lie, landed, landedIn };
    }

    // Take back the last stroke, penalty included (doesn't count as a stroke); one per 9 holes
    undo() {
        if (!this.canUndo) return false;
        const before = this.history.pop();
        this.current = before.current;
        this.strokes = before.strokes;
        this.trail.length = before.trail;
        this.undosLeft[this.nine]--;
        return true;
    }

    nextHole() {
        if (this.holeIndex >= 0 && !this.holeDone) return false;
        if (this.holeIndex + 1 >= this.course.holes.length) return false;
        this.holeIndex++;
        this.undosLeft ??= [UNDOS_PER_NINE, UNDOS_PER_NINE];
        this.current = { ...this.hole.tee };
        this.trail = []; // colors before each stroke that moved the ball, for the map's trail
        this.history = []; // snapshots before each stroke, for undo
        this.hazards = hazardMap(this.hole.hazards ?? []);
        this.strokes = 0;
        this.holeStart = this.now();
        return true;
    }

    _finishHole(pickedUp) {
        this.card.push({ par: this.hole.par, perfect: this.hole.perfect, strokes: this.strokes, time: this.now() - this.holeStart, pickedUp });
    }

    // Totals for the round so far, or one nine (0 = front, 1 = back)
    totals(nine = null) {
        const holes = nine === null ? this.card : this.card.slice(nine * 9, nine * 9 + 9);
        const sum = (key) => holes.reduce((total, hole) => total + hole[key], 0);
        return { holes: holes.length, par: sum("par"), perfect: sum("perfect"), strokes: sum("strokes"), toPar: sum("strokes") - sum("par"), time: sum("time") };
    }
}

// Rank two finished rounds: fewer strokes wins, total time breaks ties
export const compareRounds = (a, b) => (a.strokes - b.strokes) || (a.time - b.time);

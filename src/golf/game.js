import { strike, PUTTER, clubId } from "./clubs.js";
import { hslDistance, IN_THE_HOLE, cupOf } from "./oklab.js";
import { hazardMap } from "./hazards.js";
import { ruleAllows, windFor } from "./rules.js";

// ----------------------------------
// Color Golf round: strokes, undo, score card
// ----------------------------------
// No DOM access: the UI calls play()/undo()/nextHole() and renders what comes back.

// Free undos for a whole round (v1.8.3; was 1 per nine). The daily hole gets 1, practice unlimited.
// The score server replays only the strokes kept, so it doesn't count them.
export const UNDOS_PER_ROUND = 5;
export const UNDOS_DAILY = 1;

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
// A mirror (v1.8.1) isn't a hazard here. With the putter banned (v1.8.2), only a ball already in counts.
// `cup`: the hole's size (oklab.js: cupOf; v1.8.6)
export function puttsToHole(hsl, target, hazards = NO_HAZARDS, rules = null, cup = IN_THE_HOLE) {
    const rough = (c) => { const type = hazards.at(c); return type !== null && type !== "mirror"; };
    if (rough(hsl)) return null;
    let frontier = [hsl];
    const putts = ruleAllows(rules, { row: "putter", index: 0 }) ? 2 : 0;
    for (let n = 0; n <= putts; n++) {
        if (frontier.some(c => hslDistance(c, target) < cup)) return n;
        frontier = frontier
            .flatMap(c => PUTTER.map((_, index) => strike(c, { row: "putter", index })))
            .filter(c => !rough(c));
    }
    return null;
}

export class GolfRound {
    // `undos`: free undos for the round (practice passes Infinity). A survival course (v1.8.6, The
    // Obsidian Gauntlet: `course.survival`) ends at the first hole finished over par.
    constructor(course, now = () => performance.now(), { undos = UNDOS_PER_ROUND } = {}) {
        this.course = course;
        this.survival = !!course.survival;
        this.now = now;
        this.undos = undos;
        this.card = []; // finished holes: { par, perfect, strokes, time, pickedUp, clubs }
        this.holeIndex = -1;
        this.nextHole();
    }

    get hole() { return this.course.holes[this.holeIndex]; }
    get nine() { return this.holeIndex < 9 ? 0 : 1; }
    get maxStrokes() { return this.hole.par * 2; } // pick up at double par
    get finished() { return this.card.length === this.course.holes.length || this.over; }
    // Survival: the round ended on a hole over par (or picked up)
    get over() {
        const last = this.card.at(-1);
        return this.survival && !!last && (last.pickedUp || last.strokes > last.par);
    }
    get holeDone() { return this.card.length > this.holeIndex; }
    get inSand() { return this.hazards.at(this.current) === "sand"; }
    get canUndo() { return !this.holeDone && this.history.length > 0 && this.undosLeft > 0; }

    // Clubs allowed from here: wedges only in a bunker (just one, in an Expert bunker that names it),
    // and none the hole bans (v1.8.2)
    canPlay(club) { return ruleAllows(this.hole.rules, club) && this.hazards.allows(this.current, club); }
    get sandWedge() { return this.inSand ? this.hazards.wedgeAt(this.current) : null; }

    // Distance to the target, whether that's in the hole, whether it's on the green
    // (2 putts or fewer will hole it, as in golf) and which hazard, if any, the ball is in
    lie(hsl = this.current) {
        const distance = hslDistance(hsl, this.hole.target);
        const holed = distance < cupOf(this.hole); // bigger on Beginner and Standard holes (v1.8.6)
        const hazard = this.hazards.at(hsl);
        return { distance, holed, hazard, onGreen: holed || puttsToHole(hsl, this.hole.target, this.hazards, this.hole.rules, cupOf(this.hole)) !== null };
    }

    // One stroke with a club ({ row, index }); returns the new lie plus `landed`
    // ("water" / "sand" / "portal" / "blackhole" / "mirror" / null) and `landedIn` (that hazard), or null if the club can't be played.
    // Water: +1 penalty stroke and the ball stays where it was hit from.
    // Portal (v1.8): the ball warps to the portal's exit; the trail keeps the landing, marked `warp`,
    // so the map can show the jump instead of a shot. Black hole (v1.8): +1 penalty stroke and the
    // ball goes back to the tee, drawn the same way. Mirror (v1.8.1): the ball comes out at its color
    // with the hex reversed, drawn as a jump too. Where a warp puts the ball isn't a landing: no penalty there.
    play(club) {
        if (this.holeDone || !this.canPlay(club)) return null;
        this.history.push({ current: this.current, strokes: this.strokes, trail: this.trail.length });
        this.clubs.push(clubId(club));

        // A turning wind (v1.8.3) goes by the stroke; roulette clubs (v1.8.4) by the hole's shifts
        const landing = strike(this.current, club, windFor(this.hole, this.strokes), this.hole.rules?.roulette);
        const landed = this.hazards.at(landing);
        const landedIn = landed ? this.hazards.which(landing) : null;
        if (landed === "water") {
            this.strokes += 2; // the stroke + 1 penalty
        } else if (landed === "portal" || landed === "blackhole" || landed === "mirror") {
            this.trail.push(this.current, { ...landing, warp: true });
            this.current = { ...(landed === "blackhole" ? this.hole.tee : this.hazards.land(landing)) };
            this.strokes += landed === "blackhole" ? 2 : 1; // a black hole adds a penalty stroke
        } else {
            this.trail.push(this.current);
            this.current = landing;
            this.strokes++;
        }

        const lie = this.lie();
        if (lie.holed || this.strokes >= this.maxStrokes) this._finishHole(!lie.holed);
        return { hsl: this.current, ...lie, landed, landedIn };
    }

    // Take back the last stroke, penalty included (doesn't count as a stroke); `undos` per round
    undo() {
        if (!this.canUndo) return false;
        const before = this.history.pop();
        this.current = before.current;
        this.strokes = before.strokes;
        this.trail.length = before.trail;
        this.clubs.pop();
        this.undosLeft--;
        return true;
    }

    nextHole() {
        if (this.holeIndex >= 0 && !this.holeDone) return false;
        if (this.over) return false;
        if (this.holeIndex + 1 >= this.course.holes.length) return false;
        this.holeIndex++;
        this.undosLeft ??= this.undos;
        this.current = { ...this.hole.tee };
        this.trail = []; // colors before each stroke that moved the ball, for the map's trail
        this.history = []; // snapshots before each stroke, for undo
        this.clubs = []; // club ids played on this hole (undone strokes removed), so the round can be replayed
        this.hazards = hazardMap(this.hole.hazards ?? []);
        this.strokes = 0;
        this.holeStart = this.now();
        return true;
    }

    _finishHole(pickedUp) {
        this.card.push({
            par: this.hole.par, perfect: this.hole.perfect, strokes: this.strokes,
            time: this.now() - this.holeStart, pickedUp, clubs: [...this.clubs],
        });
    }

    // Totals for the round so far, or one nine (0 = front, 1 = back)
    totals(nine = null) {
        const holes = nine === null ? this.card : this.card.slice(nine * 9, nine * 9 + 9);
        const sum = (key) => holes.reduce((total, hole) => total + hole[key], 0);
        const totals = { holes: holes.length, par: sum("par"), perfect: sum("perfect"), strokes: sum("strokes"), toPar: sum("strokes") - sum("par"), time: sum("time") };
        if (this.survival) totals.survived = holes.filter(hole => !hole.pickedUp && hole.strokes <= hole.par).length;
        return totals;
    }
}

// A survival course's leaderboard (v1.8.6): one per version of its holes
export const survivalBoard = (course) => `${course.id}-r${course.rev ?? 1}`;

// Rank two finished rounds: fewer strokes wins, total time breaks ties. Survival rounds (v1.8.6)
// compare holes survived first.
export const compareRounds = (a, b) => ((b.survived ?? 0) - (a.survived ?? 0)) || (a.strokes - b.strokes) || (a.time - b.time);

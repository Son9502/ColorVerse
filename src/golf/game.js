import { strike } from "./clubs.js";
import { hslDistance, IN_THE_HOLE, ON_THE_GREEN } from "./oklab.js";

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

    // Distance to the target, and whether that's in the hole / on the green
    lie(hsl = this.current) {
        const distance = hslDistance(hsl, this.hole.target);
        return { distance, holed: distance < IN_THE_HOLE, onGreen: distance < ON_THE_GREEN };
    }

    // One stroke with a club ({ row, index }); returns the new lie
    play(club) {
        if (this.holeDone) return null;
        this.trail.push(this.current);
        this.current = strike(this.current, club);
        this.strokes++;

        const lie = this.lie();
        if (lie.holed || this.strokes >= this.maxStrokes) this._finishHole(!lie.holed);
        return { hsl: this.current, ...lie };
    }

    // Take back the last stroke (doesn't count as a stroke); one per 9 holes
    undo() {
        if (this.holeDone || !this.trail.length || this.undosLeft[this.nine] === 0) return false;
        this.current = this.trail.pop();
        this.strokes--;
        this.undosLeft[this.nine]--;
        return true;
    }

    nextHole() {
        if (this.holeIndex >= 0 && !this.holeDone) return false;
        if (this.holeIndex + 1 >= this.course.holes.length) return false;
        this.holeIndex++;
        this.undosLeft ??= [UNDOS_PER_NINE, UNDOS_PER_NINE];
        this.current = { ...this.hole.tee };
        this.trail = []; // colors before each stroke, for undo and the map's trail
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

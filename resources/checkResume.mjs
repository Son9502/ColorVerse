// ----------------------------------
// Resume check (v1.8.7)
// ----------------------------------
// Plays every course with random clubs (and the odd undo), and after each stroke, undo and finished
// hole saves the round (resume.js: snapshot, through JSON like localStorage) and restores it on a
// fresh GolfRound: the two must be in the same place. Then three saves that must not restore (a
// course changed, an unknown club, another course). Exits 1 on the first failure.
// Run after regenerating courses: npm run check:resume

import { readFileSync } from "node:fs";
import { GolfRound } from "../src/golf/game.js";
import { CLUBS } from "../src/golf/clubs.js";
import { rng } from "../src/golf/holeMaker.js";
import { snapshot, restore } from "../src/golf/resume.js";

const COURSES = JSON.parse(readFileSync(new URL("../src/golf/courses.json", import.meta.url)));
const rand = rng(42); // seeded, so a failure happens again the same way

// A random club the round allows right now, or null
function randomClub(round) {
    const playable = CLUBS.filter(club => round.canPlay(club));
    if (playable.length === 0) return null;
    return playable[Math.floor(rand() * playable.length)];
}

// Whether two rounds are in the same place (return a message saying what differs, or null)
function differs(a, b) {
    if (a.holeIndex !== b.holeIndex) return `holeIndex differs: ${a.holeIndex} vs ${b.holeIndex}`;
    if (a.strokes !== b.strokes) return `strokes differs: ${a.strokes} vs ${b.strokes}`;
    if (a.current.h !== b.current.h || a.current.s !== b.current.s || a.current.l !== b.current.l) return `current differs: ${JSON.stringify(a.current)} vs ${JSON.stringify(b.current)}`;
    if (a.undosLeft !== b.undosLeft) return `undosLeft differs: ${a.undosLeft} vs ${b.undosLeft}`;
    if (a.history.length !== b.history.length) return `history.length differs: ${a.history.length} vs ${b.history.length}`;
    for (let i = 0; i < a.card.length; i++) {
        if (a.card[i].strokes !== b.card[i].strokes) return `card[${i}].strokes differs: ${a.card[i].strokes} vs ${b.card[i].strokes}`;
        if (a.card[i].pickedUp !== b.card[i].pickedUp) return `card[${i}].pickedUp differs: ${a.card[i].pickedUp} vs ${b.card[i].pickedUp}`;
    }
    return null;
}

function check(round, course, between = () => false) {
    const snap = JSON.parse(JSON.stringify(snapshot(round, { mode: "test" })));
    between();
    const restored = restore(course, snap, { undos: round.undosLeft, now: () => 0 });
    if (!restored) {
        console.log(`Failed to restore round for course ${course.id} at hole ${round.holeIndex + 1}`);
        return false;
    }
    const diff = differs(round, restored);
    if (diff !== null) {
        console.log(diff);
        return false;
    }
    checked++;
    return true;
}

let checked = 0;
for (const course of COURSES) {
    const round = new GolfRound(course, () => 0);
    while (!round.finished) {
        if (round.holeDone) {
            if (!check(round, course, () => round.nextHole())) process.exit(1);
        } else {
            const club = randomClub(round);
            if (!club) break;
            round.play(club);
            if (round.holeDone) continue;
            if (!check(round, course)) process.exit(1);
            if (rand() < 0.1 && round.canUndo) {
                round.undo();
                if (!check(round, course)) process.exit(1);
            }
        }
    }
}
console.log(`${checked} snapshots restored correctly`);

// Saves that must NOT restore (restore should return null, not a broken round)
const [first, second] = COURSES;
const played = new GolfRound(first, () => 0);
for (let i = 0; i < 3; i++) {
    const club = randomClub(played);
    if (!club) break;
    played.play(club);
}
const goodSnapshot = JSON.parse(JSON.stringify(snapshot(played, { mode: "test" })));
const bad = [
    ["course changed", first, { ...structuredClone(goodSnapshot), rev: 99 }],
    ["unknown club", first, structuredClone(goodSnapshot)],
    ["wrong course", second, structuredClone(goodSnapshot)],
];
bad[1][2].current.clubs.push(9999);
for (const [label, course, saved] of bad) {
    if (restore(course, saved, { undos: 0, now: () => 0 }) !== null) {
        console.log(`Failed to reject bad save: ${label}`);
        process.exit(1);
    }
}
console.log(`${bad.length} bad saves rejected`);

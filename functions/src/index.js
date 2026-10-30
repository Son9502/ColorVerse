import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import courses from "../../src/golf/courses.json";
import dailyList from "../../src/golf/daily.json";
import { replayRound } from "../../src/golf/replay.js";
import { compareRounds } from "../../src/golf/game.js";
import { WEEK, daysBetween, weekday } from "../../src/golf/daily.js";
import { courseLock } from "../../src/golf/unlocks.js";
import { cleanNickname, nicknameId, nicknameProblem } from "../../src/cloud/nickname.js";

// ----------------------------------
// ColorVerse score server (v1.6)
// ----------------------------------
// The browser never writes scores itself (firestore.rules): it sends the clubs it played, and these
// functions replay them with the game's own code (src/golf/replay.js) before saving anything.
// Bundled with the game modules and course data into lib/index.js (npm run build).
//
// Firestore layout:
//   users/{uid}                    { nickname, bests: { "<course>" | "<course>:pro": { strokes, toPar, time, rev } } }
//   users/{uid}/rounds/{id}        every course round: { courseId, rev, pro, strokes, toPar, time, at }
//   users/{uid}/daily/{day}        the day's scored try: { par, perfect, strokes, time, pickedUp, pro, final, ranked }
//   dailies/{day}/scores/{uid}     the public leaderboard: { nickname, strokes, toPar, time, pro, at }
//   nicknames/{id}                 who holds a nickname: { uid } (id from nicknameId, so it ignores case)
//
// Trust: strokes, penalties, pick-ups and holes come from the replay. The time taken, the Pro setting
// (outside Expert, which is always Pro) and the undo limit are the browser's word.
//
// Daily hole: one try per account per day, and only a try started while signed in (startDaily on
// its first stroke) is ranked. A guest's try sent on sign-in ({ guest: true }) counts as the day's
// try if the account has none yet, but never reaches the leaderboard, so replaying it signed out
// until it goes well and then signing in gains nothing.

initializeApp();
const db = getFirestore();

const signedIn = (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to save scores.");
    return request.auth.uid;
};
const bad = (message) => new HttpsError("invalid-argument", message);
const utcToday = () => new Date().toISOString().slice(0, 10);

// The daily hole for "YYYY-MM-DD", and whether that day is live now (it's the player's local date,
// so a day either side of UTC counts). Earlier days can still be synced (streaks), never later ones.
function dailyHole(day) {
    if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw bad("Bad day.");
    const offset = daysBetween(utcToday(), day);
    if (offset > 1) throw bad("That day hasn't started yet.");
    const hole = dailyList.holes[daysBetween(dailyList.start, day)];
    if (!hole) throw bad("No daily hole that day.");
    return { hole, live: offset >= -1 };
}

const expert = (difficulty) => difficulty === "Expert";

// First stroke of today's daily: the try is on record as a pick-up until it's finished,
// so leaving and starting again doesn't give a second scored try
export const startDaily = onCall(async (request) => {
    const uid = signedIn(request);
    const day = request.data?.day;
    const { hole } = dailyHole(day);
    const ref = db.doc(`users/${uid}/daily/${day}`);
    await db.runTransaction(async (tx) => {
        if ((await tx.get(ref)).exists) return;
        tx.set(ref, {
            par: hole.par, perfect: hole.perfect, strokes: hole.par * 2, time: 0, pickedUp: true,
            pro: !!request.data.pro, final: false, at: FieldValue.serverTimestamp(),
        });
    });
    return { ok: true };
});

// Nickname: unique ignoring case (src/cloud/nickname.js). Reserving the new one and releasing the old
// happen in one transaction, so two players can't take the same name at once. Ranked daily scores
// already on a leaderboard take the new name too.
export const setNickname = onCall(async (request) => {
    const uid = signedIn(request);
    const nickname = cleanNickname(request.data?.nickname);
    const problem = nicknameProblem(nickname);
    if (problem) throw bad(problem);
    const userRef = db.doc(`users/${uid}`);
    const claimRef = db.doc(`nicknames/${nicknameId(nickname)}`);
    await db.runTransaction(async (tx) => {
        const [claim, user] = await Promise.all([tx.get(claimRef), tx.get(userRef)]);
        if (claim.exists && claim.get("uid") !== uid) throw new HttpsError("already-exists", "That nickname is taken.");
        const old = user.get("nickname");
        if (old && nicknameId(old) !== claimRef.id) tx.delete(db.doc(`nicknames/${nicknameId(old)}`));
        tx.set(claimRef, { uid });
        tx.set(userRef, { nickname }, { merge: true });
    });
    const ranked = await db.collection(`users/${uid}/daily`).where("ranked", "==", true).get();
    await Promise.all(ranked.docs.map(day =>
        db.doc(`dailies/${day.id}/scores/${uid}`).update({ nickname }).catch(() => {}))); // picked up: not listed
    return { nickname };
});

// A finished course round or daily hole: { kind: "course", courseId, rev, pro, holes } or
// { kind: "daily", day, pro, guest, holes }, where holes is [{ clubs: [club ids], time }]
export const submitRound = onCall(async (request) => {
    const uid = signedIn(request);
    const { kind, pro = false } = request.data ?? {};
    const replay = (holes) => {
        try {
            return replayRound(holes, request.data.holes);
        } catch (error) {
            throw bad(`Round didn't replay: ${error.message}`);
        }
    };

    if (kind === "course") {
        const index = courses.findIndex(c => c.id === request.data.courseId);
        const course = courses[index];
        if (!course) throw bad("Unknown course.");
        if (request.data.rev !== (course.rev ?? 1)) throw bad("This course has changed since the round was played.");
        if (request.data.holes?.length !== course.holes.length) throw bad("Only full rounds count.");
        const { totals } = replay(course.holes);
        const isPro = !!pro || expert(course.difficulty);
        const key = isPro ? `${course.id}:pro` : course.id;
        const record = { strokes: totals.strokes, toPar: totals.toPar, time: totals.time, rev: course.rev ?? 1 };

        const userRef = db.doc(`users/${uid}`);
        const bests = (await userRef.get()).get("bests") ?? {};
        if (courseLock(courses, index, { signedIn: true, bests })) throw bad("This course isn't unlocked yet.");
        const isBest = await db.runTransaction(async (tx) => {
            const best = (await tx.get(userRef)).get(`bests.${key}`);
            const better = !best || best.rev !== record.rev || compareRounds(record, best) < 0;
            tx.set(userRef.collection("rounds").doc(), { courseId: course.id, ...record, pro: isPro, at: FieldValue.serverTimestamp() });
            if (better) tx.set(userRef, { bests: { [key]: record } }, { merge: true });
            return better;
        });
        return { totals, isBest };
    }

    if (kind === "daily") {
        const day = request.data.day;
        const { hole, live } = dailyHole(day);
        const { card } = replay([hole]);
        const result = card[0];
        const isPro = !!pro || expert(WEEK[weekday(day)].difficulty);
        const ref = db.doc(`users/${uid}/daily/${day}`);
        const userRef = db.doc(`users/${uid}`);
        const guest = request.data.guest !== false;
        const { scored, ranked } = await db.runTransaction(async (tx) => {
            const [entry, user] = await Promise.all([tx.get(ref), tx.get(userRef)]);
            // The first finished try is the one that counts; a guest's try never replaces one started signed in
            if (entry.get("final") || (guest && entry.exists)) return { scored: false, ranked: false };
            const ranked = !guest && entry.exists; // started signed in (startDaily)
            const saved = { par: result.par, perfect: result.perfect, strokes: result.strokes, time: result.time, pickedUp: result.pickedUp, pro: isPro, final: true, ranked };
            tx.set(ref, { ...saved, at: FieldValue.serverTimestamp() });
            if (live && ranked && !result.pickedUp) {
                tx.set(db.doc(`dailies/${day}/scores/${uid}`), {
                    nickname: user.get("nickname") ?? "Player", strokes: result.strokes, toPar: result.strokes - result.par,
                    time: result.time, pro: isPro, at: FieldValue.serverTimestamp(),
                });
            }
            return { scored: true, ranked };
        });
        return { result, scored, ranked };
    }

    throw bad("Unknown round kind.");
});

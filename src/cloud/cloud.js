import { activeConfig, useEmulators } from "./config.js";
import { cleanNickname, nicknameProblem } from "./nickname.js";

// ----------------------------------
// Accounts and scores in the cloud (v1.6)
// ----------------------------------
// Firebase Auth (Google, email and password, or an emailed link), Firestore for reading your data and the daily
// leaderboard, and two Cloud Functions that replay rounds before saving them (functions/src).
// The SDK loads only when it's needed: when Color Golf opens, when this browser has signed in before,
// or when the page is opened from a sign-in link, so visitors who only explore never download it.
//
// Rounds finished while signed out (or offline) wait in a queue in localStorage and are sent on
// sign-in, tagged with who played them: a guest's go to whoever signs in next (unranked), an
// account's only to that account. Nothing here is required to play: with no config (config.js) every call is a no-op.

export const cloudAvailable = !!activeConfig;

const SIGNED_IN_KEY = "colorverse.cloud.signedIn"; // uid of the account signed in on this browser
const EMAIL_KEY = "colorverse.cloud.email"; // address a sign-in link was sent to
const QUEUE_KEY = "colorverse.cloud.queue.v1"; // rounds waiting to be sent
const QUEUE_MAX = 30;

const store = {
    get: (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
    set: (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ } },
    remove: (key) => { try { localStorage.removeItem(key); } catch { /* ignore */ } },
};

let ready = null; // promise of { auth, db, fns, sdk } once loaded
let user = null; // { uid, email, nickname } or null
let known = false; // whether Firebase has said who's signed in yet
const listeners = new Set();

const notify = () => listeners.forEach(listener => listener(user));

// Call cb whenever the account changes (null when signed out), and now if it's already known
export function onAccount(cb) {
    listeners.add(cb);
    if (known) cb(user);
    return () => listeners.delete(cb);
}
export const currentAccount = () => user;

// The account this browser was signed in to last time, known before the SDK loads (null for a guest)
export function rememberedAccount() {
    const uid = cloudAvailable ? store.get(SIGNED_IN_KEY, null) : null;
    return typeof uid === "string" ? uid : null;
}

// Whether to load the SDK at page load (otherwise it waits for Color Golf to open)
export const cloudWanted = () => cloudAvailable && (store.get(SIGNED_IN_KEY, false) || /[?&]oobCode=/.test(location.search));

export function loadCloud() {
    if (!cloudAvailable) return Promise.resolve(null);
    return (ready ??= (async () => {
        const [app, authSdk, store_, fnSdk] = await Promise.all([
            import("firebase/app"), import("firebase/auth"), import("firebase/firestore/lite"), import("firebase/functions"),
        ]);
        const firebase = app.initializeApp(activeConfig);
        const auth = authSdk.getAuth(firebase);
        const db = store_.getFirestore(firebase);
        const fns = fnSdk.getFunctions(firebase);
        if (useEmulators) {
            authSdk.connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
            store_.connectFirestoreEmulator(db, "127.0.0.1", 8080);
            fnSdk.connectFunctionsEmulator(fns, "127.0.0.1", 5001);
        }
        const sdk = { auth: authSdk, store: store_, fns: fnSdk };
        const cloud = { auth, db, fns, sdk };

        // Coming back from an emailed sign-in link: finish signing in, then tidy the address bar
        if (authSdk.isSignInWithEmailLink(auth, location.href)) {
            const email = store.get(EMAIL_KEY, null) ?? window.prompt("Confirm the email address you signed in with");
            if (email) {
                try {
                    await authSdk.signInWithEmailLink(auth, email, location.href);
                    store.remove(EMAIL_KEY);
                } catch (error) {
                    console.warn("Sign-in link failed:", error.code ?? error);
                }
            }
            history.replaceState(null, "", location.pathname + location.hash);
        }

        authSdk.onAuthStateChanged(auth, async (account) => {
            known = true;
            if (!account) {
                user = null;
                store.remove(SIGNED_IN_KEY);
                notify();
                return;
            }
            store.set(SIGNED_IN_KEY, account.uid);
            let nickname = null;
            try {
                nickname = (await store_.getDoc(store_.doc(db, "users", account.uid))).get("nickname") ?? null;
            } catch { /* offline: no nickname yet */ }
            // hasPassword: signs in with an email address (a password, or a link that hasn't set one yet)
            const hasPassword = account.providerData.some(provider => provider.providerId === "password");
            user = { uid: account.uid, email: account.email, nickname, hasPassword };
            notify();
            flushQueue();
        });
        window.addEventListener("online", flushQueue);
        return cloud;
    })());
}

// ---- Signing in and out ----
export async function signInWithGoogle() {
    const { auth, sdk } = await loadCloud();
    await sdk.auth.signInWithPopup(auth, new sdk.auth.GoogleAuthProvider());
}

// Email and password (v1.6.1). Firebase stores the password; it needs 6+ characters, the screen asks for 8
export async function signInWithPassword(email, password) {
    const { auth, sdk } = await loadCloud();
    await sdk.auth.signInWithEmailAndPassword(auth, email, password);
}

export async function createAccount(email, password) {
    const { auth, sdk } = await loadCloud();
    await sdk.auth.createUserWithEmailAndPassword(auth, email, password);
}

// Also how an account made with Google or a sign-in link gets a password
export async function sendPasswordReset(email) {
    const { auth, sdk } = await loadCloud();
    await sdk.auth.sendPasswordResetEmail(auth, email);
}

// Signed in: check the current password again (Firebase wants a recent sign-in), then set the new one
export async function changePassword(current, next) {
    const { auth, sdk } = await loadCloud();
    const account = auth.currentUser;
    if (!account?.email) throw new Error("Sign in first.");
    await sdk.auth.reauthenticateWithCredential(account, sdk.auth.EmailAuthProvider.credential(account.email, current));
    await sdk.auth.updatePassword(account, next);
}

export async function sendSignInLink(email) {
    const { auth, sdk } = await loadCloud();
    const url = location.origin + location.pathname;
    await sdk.auth.sendSignInLinkToEmail(auth, email, { url, handleCodeInApp: true });
    store.set(EMAIL_KEY, email);
}

export async function signOutAccount() {
    const { auth, sdk } = await loadCloud();
    await sdk.auth.signOut(auth);
}

// The only thing other players see (on the daily leaderboard). The server checks it's free
// (nickname.js); a taken one throws "That nickname is taken."
export async function setNickname(nickname) {
    if (!user) throw new Error("Sign in first.");
    const problem = nicknameProblem(nickname);
    if (problem) throw new Error(problem);
    if (cleanNickname(nickname) === user.nickname) throw new Error("You already have this nickname.");
    try {
        const saved = await call("setNickname", { nickname: cleanNickname(nickname) });
        user = { ...user, nickname: saved.nickname };
    } catch (error) {
        // The server's own answers (taken, too short…) are written for players; anything else isn't
        const answered = ["functions/already-exists", "functions/invalid-argument"].includes(error.code);
        throw new Error(answered
            ? error.message.replace(/\s*\[\d+\]$/, "") // the SDK appends the HTTP status: "… [409]"
            : "Couldn't save that nickname. Check your connection and try again.");
    }
    notify();
}

// ---- Scores ----
const call = async (name, data) => {
    const { fns, sdk } = await loadCloud();
    return (await sdk.fns.httpsCallable(fns, name)(data)).data;
};

// First stroke of today's daily: put the try on record (best effort; offline it waits for the finish)
export function startDaily(day, pro) {
    if (!user) return;
    call("startDaily", { day, pro }).catch(() => {});
}

// A finished course round or daily hole (the payload submitRound expects). Sent now if signed in,
// otherwise queued for sign-in. Resolves to the server's answer, or null if it was queued.
export async function submitRound(payload) {
    if (!cloudAvailable) return null;
    if (!user) {
        queue(null, payload);
        return null;
    }
    try {
        return await call("submitRound", { ...payload, guest: false });
    } catch (error) {
        if (error.code === "functions/invalid-argument") throw error; // the server rejected it: don't retry
        queue(user.uid, payload); // offline or a hiccup: try again later
        return null;
    }
}

// owner: the uid that played it, or null for a guest
function queue(owner, payload) {
    const waiting = store.get(QUEUE_KEY, []);
    waiting.push({ id: `${Date.now()}-${Math.random()}`, owner, payload });
    store.set(QUEUE_KEY, waiting.slice(-QUEUE_MAX));
}

// Sends the guest's rounds and this account's; another account's wait until it signs in again
let flushing = false;
async function flushQueue() {
    if (flushing || !user) return;
    flushing = true;
    try {
        for (const { id, owner, payload } of store.get(QUEUE_KEY, [])) {
            if (owner !== null && owner !== user.uid) continue;
            try {
                await call("submitRound", { ...payload, guest: owner === null });
            } catch (error) {
                if (error.code !== "functions/invalid-argument") break; // offline: keep the rest for later
            }
            store.set(QUEUE_KEY, store.get(QUEUE_KEY, []).filter(entry => entry.id !== id)); // sent (or rejected for good)
        }
    } finally {
        flushing = false;
        notify(); // let the screen pick up the newly saved scores
    }
}

export const queuedRounds = () => store.get(QUEUE_KEY, []).length;

// Your saved data: { bests, daily: { "YYYY-MM-DD": result } }
export async function loadMyScores() {
    if (!user) return null;
    const { db, sdk } = await loadCloud();
    const { getDoc, getDocs, doc, collection } = sdk.store;
    const [profile, days] = await Promise.all([
        getDoc(doc(db, "users", user.uid)),
        getDocs(collection(db, "users", user.uid, "daily")),
    ]);
    return {
        bests: profile.get("bests") ?? {},
        daily: Object.fromEntries(days.docs.map(day => [day.id, day.data()])),
    };
}

// Today's top 10 on the daily hole: [{ uid, nickname, strokes, toPar, time, pro }]
export async function dailyLeaderboard(day) {
    const { db, sdk } = await loadCloud();
    const { getDocs, query, collection, orderBy, limit } = sdk.store;
    const top = await getDocs(query(collection(db, "dailies", day, "scores"), orderBy("strokes"), orderBy("time"), limit(10)));
    return top.docs.map(entry => ({ uid: entry.id, ...entry.data() }));
}

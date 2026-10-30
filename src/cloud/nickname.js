// ----------------------------------
// Nickname rules (v1.6.2)
// ----------------------------------
// Shared by the screen (to answer at once) and the score server (which decides). A nickname is
// 2–20 letters, digits, spaces and _ - . ' and is unique ignoring case, accents written as separate
// marks, and extra spaces: "Tobi" and "tobi " are the same name.

export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 20;

export const cleanNickname = (name) => String(name ?? "").normalize("NFKC").trim().replace(/\s+/g, " ");

// Firestore id of the name's reservation (nicknames/{id}); the prefix keeps ids like ".." or
// "__x__", which Firestore doesn't allow, out of reach
export const nicknameId = (name) => `n_${cleanNickname(name).toLowerCase()}`;

// What's wrong with a nickname, or null if it can be used (taken or not)
export function nicknameProblem(name) {
    const clean = cleanNickname(name);
    if (clean.length < NICKNAME_MIN || clean.length > NICKNAME_MAX) return `A nickname needs ${NICKNAME_MIN}–${NICKNAME_MAX} characters.`;
    if (!/^[\p{L}\p{N} _.'-]+$/u.test(clean)) return "Use letters, numbers, spaces and _ - . ' only.";
    if (!/[\p{L}\p{N}]/u.test(clean)) return "A nickname needs at least one letter or number.";
    return null;
}

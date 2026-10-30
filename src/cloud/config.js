// ----------------------------------
// Firebase project settings (v1.6)
// ----------------------------------
// Paste the web app config from the Firebase console (Project settings → Your apps → Web app →
// SDK setup and configuration → Config). These values are public by design: what protects the data
// is firestore.rules and the Cloud Functions, not this config.
//
// Left as null, the game runs offline-only: scores stay in this browser and no account UI shows.
// For local testing against the emulators, run `npm run emulators` and `npm run dev:cloud`
// instead (VITE_FIREBASE_EMULATORS uses a throwaway demo project).

export const firebaseConfig = null;

export const useEmulators = import.meta.env.VITE_FIREBASE_EMULATORS === "1";

export const activeConfig = useEmulators
    ? { projectId: "demo-colorverse", apiKey: "demo-key", authDomain: "demo-colorverse.firebaseapp.com" }
    : firebaseConfig;

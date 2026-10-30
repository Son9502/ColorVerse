// ----------------------------------
// Firebase project settings (v1.6)
// ----------------------------------
// Paste the web app config from the Firebase console (Project settings → Your apps → Web app →
// SDK setup and configuration → Config). These values are public by design: what protects the data
// is firestore.rules and the Cloud Functions, not this config.
//
// Set to null, the game runs offline-only: scores stay in this browser and no account UI shows.
// For local testing against the emulators, run `npm run emulators` and `npm run dev:cloud`
// instead (VITE_FIREBASE_EMULATORS uses a throwaway demo project).

export const firebaseConfig = {
    apiKey: "AIzaSyDzK-YEcIHMksiIJPErdU_SMwqFh5SSEqU",
    authDomain: "colorverse-9efa3.firebaseapp.com",
    projectId: "colorverse-9efa3",
    storageBucket: "colorverse-9efa3.firebasestorage.app",
    messagingSenderId: "408407522842",
    appId: "1:408407522842:web:84adb49e6dc00ca898dba3",
};

export const useEmulators = import.meta.env.VITE_FIREBASE_EMULATORS === "1";

export const activeConfig = useEmulators
    ? { projectId: "demo-colorverse", apiKey: "demo-key", authDomain: "demo-colorverse.firebaseapp.com" }
    : firebaseConfig;

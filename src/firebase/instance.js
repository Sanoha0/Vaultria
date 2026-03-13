/**
 * Vaultria — Firebase Instance Manager
 * Holds live references to fbApp, fbAuth, db, fbStorage
 */

import { FIREBASE_CONFIG } from "./config.js";
import { loadFirebaseSDKs } from "./loader.js";

export let fbApp     = null;
export let fbAuth    = null;
export let db        = null;
export let fbStorage = null;
export let rtdb      = null; // Firebase Realtime Database for presence
export let isFirebaseReady = false;

/**
 * Attempts to initialize Firebase.
 * Returns true on success, false on failure.
 */
export async function initFirebase() {
  try {
    const loaded = await loadFirebaseSDKs();
    if (!loaded) throw new Error("SDK scripts failed to load");

    fbApp     = window.firebase.apps.length
      ? window.firebase.apps[0]
      : window.firebase.initializeApp(FIREBASE_CONFIG);

    fbAuth    = window.firebase.auth();
    db        = window.firebase.firestore();
    fbStorage = window.firebase.storage();
    rtdb      = window.firebase.database(); // Realtime Database for presence

    await fbAuth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL);

    isFirebaseReady = true;
    console.log("[Vaultria] Firebase connected ✓");
    return true;

  } catch (err) {
    console.warn("[Vaultria] Firebase unavailable — running in local mode:", err.message);
    isFirebaseReady = false;
    return false;
  }
}

/**
 * Getter for the Firestore db singleton.
 * Use this instead of importing `db` directly — it always returns
 * the live reference even after async initFirebase() completes.
 */
export function getDb() { return db; }
export function getAuth() { return fbAuth; }
export function getRtdb() { return rtdb; }

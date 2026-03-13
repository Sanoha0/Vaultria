/**
 * Vaultia — Progress Service
 * Save and load per-language learning progress.
 *
 * Firestore path:   users/{uid}/progress/{langShortKey}
 * localStorage key: lingua_prog_<langShortKey>    (legacy compatible)
 *
 * langShortKey mapping: { japanese: "ja", spanish: "es", korean: "ko" }
 */

import { db, fbStorage, isFirebaseReady } from "../firebase/instance.js";
import { getUser, isGuest } from "../auth/authService.js";
import { LANG_SHORT } from "../utils/constants.js";

// ─── Default progress shape ────────────────────────────────────────
export function defaultProgress(langKey) {
  return {
    language:        langKey,
    xp:              0,
    level:           1,
    streak:          0,
    completed:       [],    // array of completed session IDs
    stars:           {},    // { sessionId: 1-5 }
    weakWords:       [],    // WeakWordDB entries
    reviewQueue:     [],    // items due for review
    placement:       null,  // placement test result
    register:        "natural",
    immersionMode:   "partial",
    stageUnlocked:   0,     // highest unlocked stage index
    last_activity_at: null,
  };
}

// ─── Load progress for a language ─────────────────────────────────
export async function loadProgress(langKey) {
  const shortKey = LANG_SHORT[langKey] || langKey;
  const user = getUser();

  // Firebase path
  if (isFirebaseReady && db && user && !user._isLocal && !user._isGuest) {
    try {
      const snap = await db
        .collection("users").doc(user.uid)
        .collection("progress").doc(shortKey)
        .get();
      if (snap.exists) {
        return { ...defaultProgress(langKey), ...snap.data() };
      }
    } catch (err) {
      console.warn("[Vaultia] Firestore load failed, using localStorage:", err.message);
    }
  }

  // localStorage fallback (legacy key lingua_prog_<shortKey>)
  try {
    const raw = localStorage.getItem("lingua_prog_" + shortKey);
    if (raw) return { ...defaultProgress(langKey), ...JSON.parse(raw) };
  } catch (_) {}

  return defaultProgress(langKey);
}

// ─── Save progress for a language ─────────────────────────────────
export async function saveProgress(langKey, progressData) {
  const user = getUser();
  if (!user || isGuest()) return;

  const shortKey = LANG_SHORT[langKey] || langKey;
  const data = { ...progressData, last_activity_at: new Date().toISOString() };

  // Always write localStorage as fallback (legacy key)
  try {
    localStorage.setItem("lingua_prog_" + shortKey, JSON.stringify(data));
  } catch (_) {}

  // Firebase write
  if (isFirebaseReady && db && !user._isLocal && !user._isGuest) {
    try {
      const fsData = { ...data };
      await db
        .collection("users").doc(user.uid)
        .collection("progress").doc(shortKey)
        .set(fsData, { merge: true });

      // Update top-level user doc summary fields
      await db.collection("users").doc(user.uid).update({
        xp:               progressData.xp || 0,
        streak:           progressData.streak || 0,
        lessonsCompleted: (progressData.completed || []).length,
        currentLanguage:  langKey,
      }).catch(() => {});
    } catch (err) {
      console.warn("[Vaultia] Firestore save failed:", err.message);
    }
  }
}

// ─── Load all languages progress ──────────────────────────────────
export async function loadAllProgress() {
  const user = getUser();
  const result = {};

  if (isFirebaseReady && db && user && !user._isLocal && !user._isGuest) {
    try {
      for (const [fullKey, shortKey] of Object.entries(LANG_SHORT)) {
        const snap = await db
          .collection("users").doc(user.uid)
          .collection("progress").doc(shortKey)
          .get();
        result[fullKey] = snap.exists
          ? { ...defaultProgress(fullKey), ...snap.data() }
          : defaultProgress(fullKey);
      }
      return result;
    } catch (err) {
      console.warn("[Vaultia] Firestore loadAll failed:", err.message);
    }
  }

  // localStorage fallback
  for (const [fullKey, shortKey] of Object.entries(LANG_SHORT)) {
    try {
      const raw = localStorage.getItem("lingua_prog_" + shortKey);
      result[fullKey] = raw
        ? { ...defaultProgress(fullKey), ...JSON.parse(raw) }
        : defaultProgress(fullKey);
    } catch (_) {
      result[fullKey] = defaultProgress(fullKey);
    }
  }
  return result;
}

// ─── Load full user cloud profile ─────────────────────────────────
export async function loadUserProfile() {
  const user = getUser();
  if (!user || !isFirebaseReady || !db || user._isLocal || user._isGuest) return null;
  try {
    const snap = await db.collection("users").doc(user.uid).get();
    return snap.exists ? snap.data() : null;
  } catch (_) {
    return null;
  }
}

// ─── WeakWordDB helpers ────────────────────────────────────────────

/**
 * Record a miss for a word in the WeakWordDB.
 * @param {object[]} weakWords - current array from progress
 * @param {string} word
 * @param {string} langKey
 */
export function recordWeakWord(weakWords, word, langKey) {
  const existing = weakWords.find(
    (w) => w.word === word && w.language === langKey
  );
  if (existing) {
    existing.memoryWeight = Math.min((existing.memoryWeight || 1) + 1, 10);
    existing.lastSeen = Date.now();
  } else {
    weakWords.push({ word, language: langKey, memoryWeight: 1, lastSeen: Date.now() });
  }
  return [...weakWords];
}

/**
 * Mark a word as correct — reduce its memory weight.
 */
export function markWordCorrect(weakWords, word, langKey) {
  const entry = weakWords.find(
    (w) => w.word === word && w.language === langKey
  );
  if (entry) {
    entry.memoryWeight = Math.max((entry.memoryWeight || 1) - 1, 0);
    entry.lastSeen = Date.now();
    if (entry.memoryWeight === 0) {
      return weakWords.filter((w) => !(w.word === word && w.language === langKey));
    }
  }
  return [...weakWords];
}

/**
 * Get top N words due for review (highest weight + oldest lastSeen).
 */
export function getDueWords(weakWords, limit = 15) {
  return [...weakWords]
    .filter((w) => w.memoryWeight > 0)
    .sort((a, b) => {
      const weightDiff = (b.memoryWeight || 0) - (a.memoryWeight || 0);
      if (weightDiff !== 0) return weightDiff;
      return (a.lastSeen || 0) - (b.lastSeen || 0);
    })
    .slice(0, limit);
}

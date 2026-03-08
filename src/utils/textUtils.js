/**
 * Vaultria — Text & Math Utilities
 */

import { LEVENSHTEIN_MAX_DISTANCE, XP_PER_LEVEL, REWARD_EVERY_N_LEVELS } from "./constants.js";

// ─── Levenshtein Distance ──────────────────────────────────────────
export function levenshtein(a, b) {
  a = a.toLowerCase().trim();
  b = b.toLowerCase().trim();
  if (a === b) return 0;
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Fuzzy match for typing exercises.
 * Accepts minor typos, punctuation, capitalization differences.
 * Returns true if answer is close enough.
 */
export function fuzzyMatch(userAnswer, correctAnswer) {
  const ua = normalizeAnswer(userAnswer);
  const ca = normalizeAnswer(correctAnswer);
  if (ua === ca) return true;
  return levenshtein(ua, ca) <= LEVENSHTEIN_MAX_DISTANCE;
}

export function normalizeAnswer(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:'"「」。、！？]/g, "")
    .replace(/\s+/g, " ");
}

// ─── XP & Level ────────────────────────────────────────────────────
export function xpToLevel(xp) {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

export function xpToNextLevel(xp) {
  const level = xpToLevel(xp);
  return level * XP_PER_LEVEL - xp;
}

export function xpProgressInLevel(xp) {
  return xp % XP_PER_LEVEL;
}

export function isRewardLevel(level) {
  return level % REWARD_EVERY_N_LEVELS === 0;
}

// ─── Star calculation ──────────────────────────────────────────────
/**
 * Calculate stars (1–5) for a completed session.
 * @param {object} metrics - { accuracy, speedMs, hintsUsed, retries }
 */
export function calculateStars({ accuracy = 1, speedMs = 0, hintsUsed = 0, retries = 0 } = {}) {
  let score = 5;
  if (accuracy < 1.0)  score -= Math.ceil((1 - accuracy) * 3);
  if (hintsUsed > 0)   score -= Math.min(hintsUsed, 2);
  if (retries > 0)     score -= Math.min(retries, 1);
  if (speedMs > 60000) score -= 1; // took more than 60s total
  return Math.max(1, Math.min(5, score));
}

// ─── Misc helpers ──────────────────────────────────────────────────
export function debounce(fn, delay = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

export function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

export function formatDate(dateOrTs) {
  const d = dateOrTs instanceof Date ? dateOrTs : new Date(dateOrTs);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

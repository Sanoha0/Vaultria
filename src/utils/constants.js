/**
 * Vaultia — Global Constants
 */

// ─── Developer access emails ───────────────────────────────────────
export const DEV_EMAILS = [
  "sabertrons5123@gmail.com",
  "sanoha512x@gmail.com",
  "sabesvill9@gmail.com",
  "sabesvill7@gmail.com",
];

// ─── Language keys ─────────────────────────────────────────────────
// Legacy-compatible short keys (must match lingua_prog_<key> localStorage keys)
export const LANG_SHORT = {
  japanese: "ja",
  spanish:  "es",
  korean:   "ko",
};

export const LANGUAGES = ["japanese", "spanish", "korean"];

// ─── Stages ────────────────────────────────────────────────────────
export const STAGES = [
  { id: 0, key: "starter",    label: "Starter",    unitsCount: 14 },
  { id: 1, key: "beginner",   label: "Beginner",   unitsCount: 14 },
  { id: 2, key: "explorer",   label: "Explorer",   unitsCount: 14 },
  { id: 3, key: "speaker",    label: "Speaker",    unitsCount: 14 },
  { id: 4, key: "scholar",    label: "Scholar",    unitsCount: 14 },
  { id: 5, key: "specialist", label: "Specialist", unitsCount: 14 },
  { id: 6, key: "archivist",  label: "Archivist",  unitsCount: 14 },
];

// Units 7 and 14 (1-indexed) are checkpoints
export const CHECKPOINT_UNITS = [7, 14];

// Sessions per unit (range)
export const SESSIONS_PER_UNIT_MIN = 3;
export const SESSIONS_PER_UNIT_MAX = 5;

// ─── XP / Leveling ─────────────────────────────────────────────────
export const XP_PER_SESSION_BASE  = 50;
export const XP_PER_LEVEL         = 200;
export const REWARD_EVERY_N_LEVELS = 5;

// ─── Star system ───────────────────────────────────────────────────
export const STAR_MAX = 5;

// ─── Speech registers ──────────────────────────────────────────────
export const REGISTERS = ["formal", "natural", "slang", "mixed"];

// ─── Immersion modes ───────────────────────────────────────────────
export const IMMERSION_MODES = ["full_translation", "partial", "full_immersion"];

// ─── Review queue sizes ────────────────────────────────────────────
export const REVIEW_QUEUE_MIN = 10;
export const REVIEW_QUEUE_MAX = 25;

// ─── Typing fuzzy match ────────────────────────────────────────────
export const LEVENSHTEIN_MAX_DISTANCE = 2;

// ─── Support link ──────────────────────────────────────────────────
export const KOFI_URL = "https://ko-fi.com/Sanoha";

// ─── App version ───────────────────────────────────────────────────
export const APP_VERSION = "1.0.0";
export const APP_NAME    = "Vaultia";

/**
 * Vaultia — Smart Tutor Engine
 * Hybrid adaptive tutoring: Why Engine, error classification,
 * dynamic hints, WeakWordDB integration, semantic evaluation.
 * No paid AI API — rule-based + fuzzy matching.
 */

import { fuzzyMatch, levenshtein } from "../utils/textUtils.js";

// ─── Error categories ──────────────────────────────────────────────
export const ERROR_TYPES = {
  TYPO:             "typo",
  GRAMMAR:          "grammar",
  VOCABULARY:       "vocabulary",
  REGISTER:         "register_mismatch",
  NUANCE:           "nuance",
  MEANING:          "meaning_mismatch",
  SCRIPT:           "script_error",
};

// ─── Why Engine ────────────────────────────────────────────────────
/**
 * Generates a Why Card explaining the error.
 * @param {string} userAnswer
 * @param {string} correctAnswer
 * @param {object} itemMeta - { type, grammar, register, notes }
 * @returns {{ errorType, whyCorrect, whyWrong }}
 */
export function generateWhyCard(userAnswer, correctAnswer, itemMeta = {}) {
  const dist = levenshtein(userAnswer, correctAnswer);
  let errorType = classifyError(userAnswer, correctAnswer, itemMeta);

  const whyCorrect = buildWhyCorrect(correctAnswer, itemMeta);
  const whyWrong   = buildWhyWrong(userAnswer, correctAnswer, errorType, itemMeta);

  return { errorType, whyCorrect, whyWrong };
}

export function classifyError(userAnswer, correctAnswer, meta = {}) {
  const dist = levenshtein(
    userAnswer.toLowerCase().trim(),
    correctAnswer.toLowerCase().trim()
  );

  // Script check: if target uses non-latin script
  if (/[\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/.test(correctAnswer)) {
    if (!/[\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/.test(userAnswer)) {
      return ERROR_TYPES.SCRIPT;
    }
  }

  if (dist <= 2) return ERROR_TYPES.TYPO;

  if (meta.grammar && !_matchesGrammarPattern(userAnswer, meta.grammar)) {
    return ERROR_TYPES.GRAMMAR;
  }

  if (meta.register && !_matchesRegister(userAnswer, meta.register)) {
    return ERROR_TYPES.REGISTER;
  }

  if (dist > 6) return ERROR_TYPES.VOCABULARY;

  return ERROR_TYPES.MEANING;
}

function buildWhyCorrect(correct, meta) {
  if (meta.explanation) return meta.explanation;
  if (meta.grammar)     return `This uses the ${meta.grammar} grammar pattern.`;
  if (meta.notes)       return meta.notes;
  return `The correct answer is: "${correct}"`;
}

function buildWhyWrong(user, correct, errorType, meta) {
  switch (errorType) {
    case ERROR_TYPES.TYPO:
      return `Your answer was very close — check the spelling carefully.`;
    case ERROR_TYPES.GRAMMAR:
      return `The grammar structure isn't quite right here. ${meta.grammarNote || ""}`;
    case ERROR_TYPES.VOCABULARY:
      return `That word doesn't fit in this context — try a different word choice.`;
    case ERROR_TYPES.REGISTER:
      return `Your answer uses the wrong speech level for this context (${meta.register || "natural"} is expected here).`;
    case ERROR_TYPES.SCRIPT:
      return `Make sure to use the correct script for this language.`;
    case ERROR_TYPES.NUANCE:
      return `Close in meaning, but the nuance is slightly different.`;
    default:
      return `Your answer doesn't match the expected meaning.`;
  }
}

function _matchesGrammarPattern(answer, grammarPattern) {
  // Simple pattern presence check — extend as needed per grammar type
  return answer.includes(grammarPattern);
}

function _matchesRegister(answer, expectedRegister) {
  // Japanese register markers
  if (expectedRegister === "formal") {
    return /です|ます/.test(answer);
  }
  if (expectedRegister === "slang") {
    return !/です|ます/.test(answer);
  }
  return true;
}

// ─── Semantic evaluation ───────────────────────────────────────────
/**
 * Check if user answer is semantically close enough.
 * Used for scenario / free-answer exercises.
 * @param {string} userAnswer
 * @param {string[]} acceptedAnswers - list of valid answers / synonyms
 * @returns {{ pass: boolean, confidence: number }}
 */
export function semanticEval(userAnswer, acceptedAnswers = []) {
  for (const accepted of acceptedAnswers) {
    if (fuzzyMatch(userAnswer, accepted)) {
      return { pass: true, confidence: 1.0 };
    }
    // Check synonym presence
    const dist = levenshtein(
      userAnswer.toLowerCase().trim(),
      accepted.toLowerCase().trim()
    );
    const ratio = 1 - dist / Math.max(userAnswer.length, accepted.length, 1);
    if (ratio >= 0.75) {
      return { pass: true, confidence: ratio };
    }
  }
  return { pass: false, confidence: 0 };
}

// ─── Dynamic hints ─────────────────────────────────────────────────
/**
 * Generate progressive hints without giving the full answer.
 * @param {string} correctAnswer
 * @param {number} hintLevel - 0, 1, 2
 * @returns {string} hint text
 */
export function generateHint(correctAnswer, hintLevel = 0) {
  if (hintLevel === 0) {
    // First hint: first character only
    return `Starts with: "${correctAnswer[0]}…"`;
  }
  if (hintLevel === 1) {
    // Second hint: first third of characters revealed
    const reveal = Math.ceil(correctAnswer.length / 3);
    return `Beginning: "${correctAnswer.slice(0, reveal)}…"`;
  }
  // Third hint: reveal all but last 2 chars
  const end = Math.max(1, correctAnswer.length - 2);
  return `Almost: "${correctAnswer.slice(0, end)}__"`;
}

// ─── Review queue builder ──────────────────────────────────────────
/**
 * Build a prioritized review queue.
 * Prioritizes: recent mistakes, weak words, low-star sessions, slow items.
 * @param {object} progress - full progress object
 * @param {number} targetSize - default 15
 */
export function buildReviewQueue(progress, targetSize = 15) {
  const { weakWords = [], stars = {}, completed = [] } = progress;

  // Get low-star sessions
  const lowStarSessions = Object.entries(stars)
    .filter(([, s]) => s < 4)
    .sort(([, a], [, b]) => a - b)
    .slice(0, 10)
    .map(([id]) => ({ type: "session_review", sessionId: id, priority: 1 }));

  // Get weak words due for review
  const dueWords = weakWords
    .filter((w) => w.memoryWeight > 0)
    .sort((a, b) => b.memoryWeight - a.memoryWeight)
    .slice(0, targetSize)
    .map((w) => ({ type: "word_review", word: w.word, priority: w.memoryWeight }));

  const queue = [...dueWords, ...lowStarSessions]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, targetSize);

  return queue;
}

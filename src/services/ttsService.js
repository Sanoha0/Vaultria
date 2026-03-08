/**
 * Vaultia — TTS Service
 *
 * Endpoint: POST https://sanohadev-vaultia-tts.hf.space/tts
 * Request:  { text: string, lang: "es"|"ja"|"ko", speed: number }
 * Response: audio blob (type varies — treated as opaque audio, not assumed MP3)
 *
 * ONLY used for learning content: target words, phrases, sentences, prompts.
 * Never called for UI labels, navigation, or menu text.
 *
 * Features:
 *   - LRU blob-URL cache (120 entries) — repeated items don't re-fetch
 *   - Slow mode: sends speed:0.8 to the API (server-side), also applies
 *     playbackRate:0.9 as a mild additional slowdown in the browser
 *   - Shadowing mode: plays normally, waits 2 s for learner to repeat,
 *     then plays once more at speed:0.85 as a model. No looping.
 *   - Word-tap: wires [data-tts][data-lang] elements to speak on click
 *   - Pronunciation overrides: display text → TTS text (per language)
 *     Display text shown to learner is NEVER changed, only TTS payload
 *   - Hesitation + timing tracking via eventBus
 *   - Graceful failure: always logs, never throws to callers
 */

import { eventBus } from "../utils/eventBus.js";

// ─── Config ────────────────────────────────────────────────────────────────

const TTS_ENDPOINT  = "https://sanohadev-vaultia-tts.hf.space/tts";
const CACHE_LIMIT   = 120;
const SPEED_NORMAL  = 1.0;
const SPEED_SLOW    = 0.8;   // sent to the API
const SPEED_SHADOW  = 0.85;  // sent to the API for the model-repeat in shadowing
const RATE_SLOW_BR  = 0.9;   // extra browser playbackRate on top of slow API speed

// lang key used in the app → lang code the API expects
const LANG_CODES = {
  japanese: "ja",
  korean:   "ko",
  spanish:  "es",
};

/**
 * Pronunciation overrides per language.
 * Key   = what the learner sees (item.target / item.phrase — never mutated)
 * Value = what we send to the TTS engine instead
 *
 * Only add entries when the engine produces a clearly wrong reading.
 * Japanese: prefer hiragana/katakana override over kanji when engine misreads
 */
const PRONUNCIATION_OVERRIDES = {
  japanese: {
    // "東京": "とうきょう",
  },
  korean: {
    // "화이팅": "파이팅",
  },
  spanish: {
    // "México": "Méjico",
  },
};

// ─── State ─────────────────────────────────────────────────────────────────

/** cacheKey → blob object URL  (key format: "ja::1.0::text") */
const _cache     = new Map();
const _cacheKeys = [];   // insertion-order for LRU eviction

/** Currently playing Audio element (or null) */
let _currentAudio  = null;

/** Shadow-mode timeout handle — cleared on stop() */
let _shadowTimeout = null;

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Speak a piece of language learning content.
 *
 * @param {string}  text               Display text (as shown to learner)
 * @param {string}  langKey            "japanese" | "korean" | "spanish"
 * @param {object}  [opts]
 * @param {boolean} [opts.slow]        Slow mode — lower speed to API + mild browser rate
 * @param {boolean} [opts.shadowing]   Shadow mode — play, pause 2 s, play model once
 * @param {string}  [opts.ttsOverride] Explicit TTS text, bypasses overrides map
 * @returns {Promise<HTMLAudioElement|null>}
 */
export async function speak(text, langKey, opts = {}) {
  if (!text || !langKey) return null;

  // DEBUG — remove once HF TTS is confirmed working
  console.log(`[TTS:HF] speak() called → text="${text}" lang="${langKey}" slow=${!!opts.slow} shadow=${!!opts.shadowing}`);

  // Resolve TTS text — override map only; display text is never touched
  const ttsText = opts.ttsOverride
    ?? PRONUNCIATION_OVERRIDES[langKey]?.[text]
    ?? text;

  const langCode = LANG_CODES[langKey];
  if (!langCode) {
    console.warn(`[TTS] Unknown langKey: ${langKey}`);
    return null;
  }

  stop(); // cancel any currently playing audio

  const apiSpeed = opts.slow ? SPEED_SLOW : SPEED_NORMAL;
  console.log(`[TTS:HF] fetching → POST ${TTS_ENDPOINT} { text: "${ttsText}", lang: "${langCode}", speed: ${apiSpeed} }`);
  const url = await _fetchAudio(ttsText, langCode, apiSpeed);
  if (!url) return null;

  const audio = _makeAudio(url);
  if (opts.slow) {
    // Mild additional browser-side slowdown layered on top of the API speed
    audio.playbackRate = RATE_SLOW_BR;
  }

  _currentAudio = audio;

  try {
    await audio.play();
  } catch (err) {
    if (err.name !== "AbortError") {
      console.warn("[TTS] play() error:", err.message);
    }
    return null;
  }

  if (opts.shadowing) {
    _scheduleShadowRepeat(ttsText, langCode);
  }

  return audio;
}

/**
 * Stop any currently playing TTS audio and cancel any pending shadow repeat.
 */
export function stop() {
  if (_shadowTimeout) {
    clearTimeout(_shadowTimeout);
    _shadowTimeout = null;
  }
  if (_currentAudio) {
    _currentAudio.pause();
    _currentAudio.currentTime = 0;
    _currentAudio = null;
  }
}

/**
 * Preload items in the background so the first few cards play instantly.
 * Fetches at normal speed only (slow variants fetched on demand).
 *
 * @param {Array<{target?:string, phrase?:string}>} items
 * @param {string} langKey
 */
export async function preload(items, langKey) {
  const langCode = LANG_CODES[langKey];
  if (!langCode) return;

  const texts = items
    .filter(it => it.audio !== false)
    .map(it => it.target || it.phrase || "")
    .filter(Boolean);

  // Max 3 concurrent — don't hammer the HF endpoint
  const BATCH = 3;
  for (let i = 0; i < texts.length; i += BATCH) {
    await Promise.allSettled(
      texts.slice(i, i + BATCH).map(t => {
        const ttsText = PRONUNCIATION_OVERRIDES[langKey]?.[t] ?? t;
        return _fetchAudio(ttsText, langCode, SPEED_NORMAL);
      })
    );
  }
}

/**
 * Wire [data-tts][data-lang] elements inside a container for word-tap audio.
 * Adds a click handler to each; existing listeners are not duplicated.
 *
 * @param {HTMLElement} container
 */
export function attachWordTap(container) {
  container.querySelectorAll("[data-tts]").forEach(el => {
    if (el.dataset.ttsBound) return;  // don't double-bind
    el.dataset.ttsBound = "1";
    el.style.cursor = "pointer";
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const text    = el.dataset.tts;
      const langKey = el.dataset.lang;
      if (text && langKey) speak(text, langKey);
    });
  });
}

/**
 * Start a response timer for an item. Returns a tracker with .resolve(correct).
 *
 * Emits on eventBus:
 *   "tts:timing"     { item, langKey, elapsedMs }          — always
 *   "tts:hesitation" { item, langKey, elapsedMs, correct } — recall items > 8 s
 *
 * @param {object} item
 * @param {string} langKey
 * @returns {{ resolve: (correct: boolean) => void }}
 */
export function startItemTimer(item, langKey) {
  const t0 = Date.now();
  return {
    resolve(correct) {
      const elapsedMs = Date.now() - t0;
      eventBus.emit("tts:timing", { item, langKey, elapsedMs });

      // Recall items (typing drills with an explicit answer) taking > 8 s → hesitation
      if (item.answer && elapsedMs > 8_000) {
        eventBus.emit("tts:hesitation", { item, langKey, elapsedMs, correct });
      }
    }
  };
}

// ─── Internal helpers ──────────────────────────────────────────────────────

/**
 * Schedule the shadowing model-repeat:
 * after 2 s gap (learner repeats aloud), play once more at shadow speed.
 */
function _scheduleShadowRepeat(ttsText, langCode) {
  _shadowTimeout = setTimeout(async () => {
    _shadowTimeout = null;

    // Fetch at shadow speed (may already be cached)
    const url = await _fetchAudio(ttsText, langCode, SPEED_SHADOW);
    if (!url) return;

    // Only play if nothing else has started in the gap
    if (_currentAudio) return;

    const audio = _makeAudio(url);
    _currentAudio = audio;
    try {
      await audio.play();
    } catch (err) {
      if (err.name !== "AbortError") console.warn("[TTS] shadow play error:", err.message);
    }

    audio.addEventListener("ended", () => {
      if (_currentAudio === audio) _currentAudio = null;
    }, { once: true });

  }, 2000); // 2 s gap for learner to repeat
}

/**
 * Fetch audio blob from the HF endpoint and return a cached object URL.
 * Cache key includes lang + speed so normal and slow variants are stored separately.
 *
 * @param {string} text      TTS text (already resolved through overrides)
 * @param {string} langCode  "ja" | "ko" | "es"
 * @param {number} speed     API speed value
 * @returns {Promise<string|null>} object URL or null on failure
 */
async function _fetchAudio(text, langCode, speed) {
  const key = `${langCode}::${speed}::${text}`;

  if (_cache.has(key)) return _cache.get(key);

  let blob;
  try {
    const res = await fetch(TTS_ENDPOINT, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ text, lang: langCode, speed }),
    });

    if (!res.ok) {
      console.warn(`[TTS] HTTP ${res.status} for "${text}" (${langCode}, speed=${speed})`);
      return null;
    }

    blob = await res.blob();

    if (!blob || blob.size === 0) {
      console.warn(`[TTS] Empty response for "${text}" (${langCode})`);
      return null;
    }
  } catch (err) {
    console.warn(`[TTS] Fetch error for "${text}" (${langCode}):`, err.message);
    return null;
  }

  // Create object URL from whatever audio type the server returned
  // We do NOT force a MIME type — let the browser sniff it from the blob
  const url = URL.createObjectURL(blob);

  // LRU eviction
  if (_cacheKeys.length >= CACHE_LIMIT) {
    const oldest = _cacheKeys.shift();
    const evicted = _cache.get(oldest);
    if (evicted) URL.revokeObjectURL(evicted);
    _cache.delete(oldest);
  }

  _cache.set(key, url);
  _cacheKeys.push(key);

  return url;
}

/**
 * Create a new Audio element from a blob URL.
 * We don't force a src type — browser auto-detects from the blob.
 */
function _makeAudio(url) {
  const audio = new Audio();
  audio.src = url;
  audio.addEventListener("ended", () => {
    if (_currentAudio === audio) _currentAudio = null;
  }, { once: true });
  return audio;
}

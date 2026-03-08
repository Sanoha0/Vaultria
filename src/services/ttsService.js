/**
 * Vaultia — TTS Service v3  (static-first, HF fallback)
 *
 * PRIMARY PATH — static pre-generated files:
 *   audio/manifest.json  maps  "lang::text" → "audio/{lang}/{hash}.wav"
 *   These files are committed to the repo alongside the source code.
 *   A static file plays instantly — no network round-trip, no latency.
 *
 * FALLBACK PATH — HuggingFace live TTS:
 *   Used only when a static file is absent (e.g. newly-added curriculum
 *   items not yet regenerated). The HF result is cached in-memory so the
 *   second play of the same text is also instant.
 *
 * Architecture:
 *   1. On module load: fetch audio/manifest.json once, keep in memory.
 *   2. speak(text, langKey):
 *        a. Look up key in manifest  → static file URL  →  play instantly
 *        b. No manifest entry         → _fetchHF()       →  play when ready
 *   3. preload(items, langKey):
 *        Static items:  new Audio(url); audio.load() — browser pre-buffers.
 *        Missing items: HF fetch, result stored in _hfCache.
 *   4. In-flight deduplication for the HF path (Map of key → Promise).
 *   5. LRU cache (120 entries) for HF blob URLs.
 *
 * Debug lifecycle logs:
 *   [TTS] speak()         — every speak call
 *   [TTS] static hit      — served from pre-generated file
 *   [TTS] hf cache hit    — served from in-memory HF cache
 *   [TTS] hf in-flight    — reusing an already-running HF fetch
 *   [TTS] hf fetching     — new HF request started
 *   [TTS] hf received     — HF response landed
 *   [TTS] play start      — audio.play() called
 *   [TTS] play end        — audio ended naturally
 *   [TTS] hf failed       — HF fetch error
 */

import { eventBus } from "../utils/eventBus.js";

// ─── Config ────────────────────────────────────────────────────────────────

const MANIFEST_URL = "./audio/manifest.json";
const HF_ENDPOINT  = "https://sanohadev-vaultia-tts.hf.space/tts";
const HF_CACHE_MAX = 120;

const SPEED_NORMAL = 1.0;
const SPEED_SLOW   = 0.8;
const SPEED_SHADOW = 0.85;
const RATE_SLOW_BR = 0.9;   // browser-side extra slowdown layered on slow API speed

const LANG_CODES = {
  japanese: "ja",
  korean:   "ko",
  spanish:  "es",
};

/**
 * Pronunciation overrides: display text → TTS text.
 * Display text shown to the learner is NEVER changed, only the TTS payload.
 */
const PRONUNCIATION_OVERRIDES = {
  japanese: {},
  korean:   {},
  spanish:  {},
};

// ─── Manifest ─────────────────────────────────────────────────────────────

/**
 * Loaded once at module init from audio/manifest.json.
 * Format: { "ja::あ": "audio/ja/d5b262a29cf2a923.wav", ... }
 */
let _manifest     = null;   // null = not yet loaded; {} = loaded (possibly empty)
let _manifestLoad = null;   // single in-flight Promise for manifest fetch

async function _getManifest() {
  if (_manifest !== null) return _manifest;
  if (_manifestLoad)      return _manifestLoad;

  _manifestLoad = fetch(MANIFEST_URL)
    .then(r => {
      if (!r.ok) throw new Error(`manifest HTTP ${r.status}`);
      return r.json();
    })
    .then(data => {
      _manifest = data;
      console.log(`[TTS] manifest loaded — ${Object.keys(data).length} static entries`);
      return _manifest;
    })
    .catch(err => {
      console.warn("[TTS] manifest unavailable — HF fallback for all items:", err.message);
      _manifest = {};   // empty → everything falls through to HF
      return _manifest;
    });

  return _manifestLoad;
}

// Kick off manifest fetch immediately so it's ready before the first speak()
_getManifest();

// ─── HF in-memory cache (blob URLs) ───────────────────────────────────────

const _hfCache     = new Map();   // cacheKey → blob URL
const _hfCacheKeys = [];          // insertion-order for LRU eviction
const _hfInFlight  = new Map();   // cacheKey → Promise<string|null>

// ─── Playback state ───────────────────────────────────────────────────────

let _currentAudio  = null;
let _shadowTimeout = null;

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Speak a learning content item.
 *
 * @param {string}  text
 * @param {string}  langKey   "japanese" | "korean" | "spanish"
 * @param {object}  [opts]
 * @param {boolean} [opts.slow]        Lower speed + slight browser slowdown
 * @param {boolean} [opts.shadowing]   Play → 2 s gap → model repeat
 * @param {string}  [opts.ttsOverride] Bypass overrides map
 * @returns {Promise<HTMLAudioElement|null>}
 */
export async function speak(text, langKey, opts = {}) {
  if (!text || !langKey) return null;

  console.log(`[TTS] speak() → "${text}" lang=${langKey} slow=${!!opts.slow} shadow=${!!opts.shadowing}`);

  const ttsText  = opts.ttsOverride
    ?? PRONUNCIATION_OVERRIDES[langKey]?.[text]
    ?? text;

  const langCode = LANG_CODES[langKey];
  if (!langCode) { console.warn(`[TTS] unknown langKey: ${langKey}`); return null; }

  // Stop current audio; in-flight HF fetches keep running (land in cache)
  _stopAudio();

  const apiSpeed = opts.slow ? SPEED_SLOW : SPEED_NORMAL;
  const url      = await _resolveAudio(ttsText, langCode, apiSpeed);
  if (!url) return null;

  const audio = _makeAudio(url);
  if (opts.slow) audio.playbackRate = RATE_SLOW_BR;

  _currentAudio = audio;
  console.log(`[TTS] play start → "${text}"`);

  try {
    await audio.play();
  } catch (err) {
    if (err.name !== "AbortError") console.warn("[TTS] play() error:", err.message);
    return null;
  }

  if (opts.shadowing) _scheduleShadowRepeat(ttsText, langCode);
  return audio;
}

/**
 * Stop any current playback and cancel pending shadow repeat.
 * Does NOT cancel in-flight HF fetches — they land in cache for free.
 */
export function stop() {
  if (_shadowTimeout) { clearTimeout(_shadowTimeout); _shadowTimeout = null; }
  _stopAudio();
}

/**
 * Preload items so playback is instant when the session reaches each card.
 *
 * Static items: new Audio(url); audio.load() — browser buffers without playing.
 * HF items:     fire-and-forget fetch, result lands in _hfCache.
 *
 * @param {Array<object>} items
 * @param {string}        langKey
 * @param {number}        [concur=6]  HF concurrent limit (static loads are free)
 */
export async function preload(items, langKey, concur = 6) {
  const langCode = LANG_CODES[langKey];
  if (!langCode) return;

  const manifest = await _getManifest();

  const texts = items
    .filter(it => it.audio !== false)
    .map(it => (it.target || it.phrase || it.prompt || "").trim())
    .filter(Boolean)
    .filter((t, i, arr) => arr.indexOf(t) === i);   // deduplicate

  const needsHF = [];

  for (const t of texts) {
    const ttsText = PRONUNCIATION_OVERRIDES[langKey]?.[t] ?? t;
    const key     = `${langCode}::${ttsText}`;

    if (manifest[key]) {
      // Static file — tell the browser to buffer it now
      _preloadStaticFile(manifest[key]);
    } else {
      needsHF.push(ttsText);
    }
  }

  // Fire HF preloads in batches
  for (let i = 0; i < needsHF.length; i += concur) {
    await Promise.allSettled(
      needsHF.slice(i, i + concur).map(ttsText => {
        const cacheKey = _hfCacheKey(ttsText, langCode, SPEED_NORMAL);
        return _fetchHF(ttsText, langCode, SPEED_NORMAL, cacheKey);
      })
    );
  }
}

/**
 * Wire [data-tts][data-lang] elements in a container for word-tap playback.
 * Idempotent — will not double-bind.
 */
export function attachWordTap(container) {
  container.querySelectorAll("[data-tts]").forEach(el => {
    if (el.dataset.ttsBound) return;
    el.dataset.ttsBound = "1";
    el.style.cursor = "pointer";
    el.addEventListener("click", e => {
      e.stopPropagation();
      const text    = el.dataset.tts;
      const langKey = el.dataset.lang;
      if (text && langKey) speak(text, langKey);
    });
  });
}

/**
 * Start a response timer for one session item.
 * Emits "tts:timing" always; "tts:hesitation" on recall items > 8 s.
 */
export function startItemTimer(item, langKey) {
  const t0 = Date.now();
  return {
    resolve(correct) {
      const elapsedMs = Date.now() - t0;
      eventBus.emit("tts:timing", { item, langKey, elapsedMs });
      if (item.answer && elapsedMs > 8_000) {
        eventBus.emit("tts:hesitation", { item, langKey, elapsedMs, correct });
      }
    }
  };
}

// ─── Resolution logic ──────────────────────────────────────────────────────

/**
 * Returns a URL for the given text:
 *   1. Static file URL (from manifest)  — always preferred, plays instantly
 *   2. HF blob URL                      — fetched live, cached in-memory
 */
async function _resolveAudio(ttsText, langCode, apiSpeed) {
  const manifest = await _getManifest();
  const key      = `${langCode}::${ttsText}`;

  if (manifest[key]) {
    console.log(`[TTS] static hit → "${ttsText}" (${langCode})`);
    return manifest[key];   // relative path — browser resolves vs page origin
  }

  // No static file — fall back to live HF TTS
  const cacheKey = _hfCacheKey(ttsText, langCode, apiSpeed);
  return _fetchHF(ttsText, langCode, apiSpeed, cacheKey);
}

// ─── HF fetch ──────────────────────────────────────────────────────────────

function _hfCacheKey(text, langCode, speed) {
  return `${langCode}::${speed}::${text}`;
}

async function _fetchHF(text, langCode, speed, cacheKey) {
  // 1 — HF cache hit
  if (_hfCache.has(cacheKey)) {
    console.log(`[TTS] hf cache hit → "${text}" (${langCode})`);
    return _hfCache.get(cacheKey);
  }

  // 2 — In-flight: reuse the same Promise (zero duplicate POSTs)
  if (_hfInFlight.has(cacheKey)) {
    console.log(`[TTS] hf in-flight → "${text}" (${langCode})`);
    return _hfInFlight.get(cacheKey);
  }

  // 3 — New HF fetch
  const promise = (async () => {
    try {
      console.log(`[TTS] hf fetching → POST ${HF_ENDPOINT} { text:"${text}", lang:"${langCode}", speed:${speed} }`);

      const res = await fetch(HF_ENDPOINT, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text, lang: langCode, speed }),
      });

      if (!res.ok) {
        console.warn(`[TTS] hf failed → HTTP ${res.status} for "${text}"`);
        return null;
      }

      const blob = await res.blob();
      if (!blob || blob.size === 0) {
        console.warn(`[TTS] hf failed → empty response for "${text}"`);
        return null;
      }

      console.log(`[TTS] hf received → "${text}" (${langCode}) ${blob.size}B`);
      const url = URL.createObjectURL(blob);

      // LRU eviction
      if (_hfCacheKeys.length >= HF_CACHE_MAX) {
        const oldest  = _hfCacheKeys.shift();
        const evicted = _hfCache.get(oldest);
        if (evicted) URL.revokeObjectURL(evicted);
        _hfCache.delete(oldest);
      }
      _hfCache.set(cacheKey, url);
      _hfCacheKeys.push(cacheKey);

      return url;
    } catch (err) {
      console.warn(`[TTS] hf failed → "${text}" (${langCode}):`, err.message);
      return null;
    } finally {
      _hfInFlight.delete(cacheKey);
    }
  })();

  _hfInFlight.set(cacheKey, promise);
  return promise;
}

// ─── Static preload helper ─────────────────────────────────────────────────

const _preloaded = new Set();

function _preloadStaticFile(relativePath) {
  if (_preloaded.has(relativePath)) return;
  _preloaded.add(relativePath);
  // Create an Audio element and call .load() — browser fetches & buffers
  // the file without playing it. Subsequent new Audio(url).play() is instant.
  const audio = new Audio(relativePath);
  audio.preload = "auto";
  audio.load();
}

// ─── Playback helpers ──────────────────────────────────────────────────────

function _makeAudio(url) {
  const audio = new Audio(url);
  audio.addEventListener("ended", () => {
    console.log(`[TTS] play end → ${url.slice(-32)}`);
    if (_currentAudio === audio) _currentAudio = null;
  }, { once: true });
  return audio;
}

function _stopAudio() {
  if (_currentAudio) {
    _currentAudio.pause();
    _currentAudio.currentTime = 0;
    _currentAudio = null;
  }
}

function _scheduleShadowRepeat(ttsText, langCode) {
  _shadowTimeout = setTimeout(async () => {
    _shadowTimeout = null;

    // Shadow repeat always uses HF for the slower model-speed variant
    const cacheKey = _hfCacheKey(ttsText, langCode, SPEED_SHADOW);
    const url      = await _fetchHF(ttsText, langCode, SPEED_SHADOW, cacheKey);
    if (!url || _currentAudio) return;

    const audio = _makeAudio(url);
    _currentAudio = audio;
    console.log(`[TTS] play start (shadow) → "${ttsText}"`);
    try {
      await audio.play();
    } catch (err) {
      if (err.name !== "AbortError") console.warn("[TTS] shadow play error:", err.message);
    }
    audio.addEventListener("ended", () => {
      if (_currentAudio === audio) _currentAudio = null;
    }, { once: true });
  }, 2000);
}

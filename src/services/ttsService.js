/**
 * Vaultia — TTS Service v2
 *
 * Endpoint: POST https://sanohadev-vaultia-tts.hf.space/tts
 * Request:  { text: string, lang: "es"|"ja"|"ko", speed: number }
 * Response: audio blob (type varies — treated as opaque audio)
 *
 * Features:
 *   - LRU blob-URL cache (120 entries)
 *   - In-flight deduplication: same key → same Promise, zero duplicate POSTs
 *   - Slow mode: speed:0.8 to API + playbackRate:0.9 in browser
 *   - Shadowing mode: play → 2 s gap → model repeat at speed:0.85
 *   - Word-tap: [data-tts][data-lang] elements fire speak() on click
 *   - Pronunciation overrides: display text → TTS text (display never mutated)
 *   - Hesitation + timing tracking via eventBus
 *   - Full lifecycle debug logs (removable once stable)
 */

import { eventBus } from "../utils/eventBus.js";

// ─── Config ────────────────────────────────────────────────────────────────

const TTS_ENDPOINT = "https://sanohadev-vaultia-tts.hf.space/tts";
const CACHE_LIMIT  = 120;
const SPEED_NORMAL = 1.0;
const SPEED_SLOW   = 0.8;
const SPEED_SHADOW = 0.85;
const RATE_SLOW_BR = 0.9;

const LANG_CODES = {
  japanese: "ja",
  korean:   "ko",
  spanish:  "es",
};

const PRONUNCIATION_OVERRIDES = {
  japanese: {},
  korean:   {},
  spanish:  {},
};

// ─── State ─────────────────────────────────────────────────────────────────

const _cache     = new Map();   // cacheKey → blob URL
const _cacheKeys = [];          // insertion order for LRU eviction
const _inFlight  = new Map();   // cacheKey → Promise<string|null>

let _currentAudio  = null;
let _shadowTimeout = null;

// ─── Public API ────────────────────────────────────────────────────────────

export async function speak(text, langKey, opts = {}) {
  if (!text || !langKey) return null;

  console.log(`[TTS:HF] speak() called → text="${text}" lang="${langKey}" slow=${!!opts.slow} shadow=${!!opts.shadowing}`);

  const ttsText  = opts.ttsOverride
    ?? PRONUNCIATION_OVERRIDES[langKey]?.[text]
    ?? text;

  const langCode = LANG_CODES[langKey];
  if (!langCode) {
    console.warn(`[TTS] Unknown langKey: ${langKey}`);
    return null;
  }

  const apiSpeed = opts.slow ? SPEED_SLOW : SPEED_NORMAL;
  const key      = _cacheKey(ttsText, langCode, apiSpeed);

  // Stop current audio without cancelling any in-flight fetch —
  // the in-flight result will still land in cache and be reused immediately.
  _stopAudio();

  const url = await _fetchAudio(ttsText, langCode, apiSpeed, key);
  if (!url) return null;

  const audio = _makeAudio(url, key);
  if (opts.slow) audio.playbackRate = RATE_SLOW_BR;

  _currentAudio = audio;

  console.log(`[TTS:HF] audio play start → "${text}"`);
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

export function stop() {
  if (_shadowTimeout) {
    clearTimeout(_shadowTimeout);
    _shadowTimeout = null;
  }
  _stopAudio();
}

export async function preload(items, langKey, batch = 4) {
  const langCode = LANG_CODES[langKey];
  if (!langCode) return;

  const texts = items
    .filter(it => it.audio !== false)
    .map(it => it.target || it.phrase || it.prompt || "")
    .filter(Boolean)
    .filter((t, i, arr) => arr.indexOf(t) === i);  // deduplicate

  for (let i = 0; i < texts.length; i += batch) {
    await Promise.allSettled(
      texts.slice(i, i + batch).map(t => {
        const ttsText = PRONUNCIATION_OVERRIDES[langKey]?.[t] ?? t;
        const key     = _cacheKey(ttsText, langCode, SPEED_NORMAL);
        return _fetchAudio(ttsText, langCode, SPEED_NORMAL, key);
      })
    );
  }
}

export function attachWordTap(container) {
  container.querySelectorAll("[data-tts]").forEach(el => {
    if (el.dataset.ttsBound) return;
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

// ─── Internal ──────────────────────────────────────────────────────────────

function _cacheKey(text, langCode, speed) {
  return `${langCode}::${speed}::${text}`;
}

async function _fetchAudio(text, langCode, speed, key) {
  // 1 — Cache hit
  if (_cache.has(key)) {
    console.log(`[TTS:HF] cache hit → "${text}" (${langCode} @${speed})`);
    return _cache.get(key);
  }

  // 2 — In-flight: reuse the same Promise — zero duplicate POSTs
  if (_inFlight.has(key)) {
    console.log(`[TTS:HF] in-flight hit → "${text}" (${langCode})`);
    return _inFlight.get(key);
  }

  // 3 — New fetch
  const promise = (async () => {
    try {
      console.log(`[TTS:HF] fetching → POST ${TTS_ENDPOINT} { text: "${text}", lang: "${langCode}", speed: ${speed} }`);

      const res = await fetch(TTS_ENDPOINT, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text, lang: langCode, speed }),
      });

      if (!res.ok) {
        console.warn(`[TTS:HF] fetch failed → HTTP ${res.status} for "${text}" (${langCode})`);
        return null;
      }

      const blob = await res.blob();

      if (!blob || blob.size === 0) {
        console.warn(`[TTS:HF] fetch failed → empty response for "${text}" (${langCode})`);
        return null;
      }

      console.log(`[TTS:HF] response received → "${text}" (${langCode}) ${blob.size}B`);

      const url = URL.createObjectURL(blob);

      // LRU eviction
      if (_cacheKeys.length >= CACHE_LIMIT) {
        const oldest  = _cacheKeys.shift();
        const evicted = _cache.get(oldest);
        if (evicted) URL.revokeObjectURL(evicted);
        _cache.delete(oldest);
      }

      _cache.set(key, url);
      _cacheKeys.push(key);

      return url;
    } catch (err) {
      console.warn(`[TTS:HF] fetch failed → "${text}" (${langCode}):`, err.message);
      return null;
    } finally {
      _inFlight.delete(key);
    }
  })();

  _inFlight.set(key, promise);
  return promise;
}

function _makeAudio(url, key) {
  const audio = new Audio();
  audio.src = url;
  audio.addEventListener("ended", () => {
    console.log(`[TTS:HF] audio ended → "${key}"`);
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
  const key = _cacheKey(ttsText, langCode, SPEED_SHADOW);

  _shadowTimeout = setTimeout(async () => {
    _shadowTimeout = null;

    const url = await _fetchAudio(ttsText, langCode, SPEED_SHADOW, key);
    if (!url) return;
    if (_currentAudio) return;  // something else started during the gap

    const audio = _makeAudio(url, key);
    _currentAudio = audio;
    console.log(`[TTS:HF] audio play start (shadow) → "${ttsText}"`);
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

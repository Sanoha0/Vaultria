
/**
 * Vaultria — Static TTS Service
 * Plays pre-generated audio from audio/manifest.json + audio/{ja,ko,es}/*.wav
 */

import { eventBus } from "../utils/eventBus.js";

const ROOT_URL = new URL("../../", import.meta.url);
const MANIFEST_URL = new URL("../../audio/manifest.json", import.meta.url).href;

const LANG_CODES = {
  japanese: "ja",
  korean: "ko",
  spanish: "es",
};

const WEB_SPEECH_LANG = {
  japanese: "ja-JP",
  korean: "ko-KR",
  spanish: "es-ES",
};

const JA_KONNICHIWA = "\u3053\u3093\u306b\u3061\u306f"; // こんにちは
const JA_KONNICHIWA_ALT = "\u3053\u3093\u306b\u3061\u308f"; // こんにちわ
const JA_KATA_KONNICHIWA = "\u30b3\u30f3\u30cb\u30c1\u30ef"; // コンニチワ

const PRONUNCIATION_OVERRIDES = {
  japanese: {
    // Avoid TTS normalization that reads こんにちは as 今日は ("kyou wa").
    // We keep the manifest key as こんにちは but resolve audio using this override.
    "こんにちは": "コンニチワ",
  },
  korean: {},
  spanish: {},
};

// Static file overrides for known-problem phrases (local wavs shipped with the app).
// These override the manifest mapping when present.
const STATIC_PATH_OVERRIDES = {
  // Use a dedicated file for "konnichiwa" to avoid misread audio packs.
  "ja::こんにちは": "audio/ja/konnichiwa.wav",
  "ja::コンニチワ": "audio/ja/konnichiwa.wav",
};

// Bump this if browsers cache old .wav files after you replace them on disk.
const AUDIO_CACHE_BUST = "2026-03-13-2";

let _manifest = null;
let _manifestLoad = null;
let _currentAudio = null;
let _currentKey = null;
let _shadowTimeout = null;
let _playEpoch = 0;
let _currentUtterance = null;
const _preloaded = new Set();

function _toAbsoluteAssetUrl(relativePath) {
  const url = new URL(relativePath, ROOT_URL);
  url.searchParams.set("v", AUDIO_CACHE_BUST);
  return url.href;
}

async function _getManifest() {
  if (_manifest !== null) return _manifest;
  if (_manifestLoad) return _manifestLoad;

  console.log(`[TTS] manifest loading → ${MANIFEST_URL}`);

  _manifestLoad = fetch(MANIFEST_URL)
    .then((r) => {
      if (!r.ok) throw new Error(`manifest HTTP ${r.status}`);
      return r.json();
    })
    .then((data) => {
      _manifest = data || {};
      const keys = Object.keys(_manifest);
      console.log(`[TTS] manifest loaded — ${keys.length} static entries`);
      if (keys.length) {
        console.log(`[TTS] manifest sample keys:`, keys.slice(0, 5));
      }
      return _manifest;
    })
    .catch((err) => {
      console.warn(`[TTS] manifest failed → ${err.message}`);
      _manifest = {};
      eventBus.emit("tts:missing-pack", {
        reason: "manifest",
        error: err.message,
        url: MANIFEST_URL,
      });
      return _manifest;
    });

  return _manifestLoad;
}

_getManifest();

export async function speak(text, langKey, opts = {}) {
  if (!text || !langKey) return null;

  const playEpoch = ++_playEpoch;
  const langCode = LANG_CODES[langKey];
  if (!langCode) {
    console.warn(`[TTS] unknown langKey: ${langKey}`);
    return null;
  }

  // By default, prefer static wav packs. Web Speech is only a fallback.
  if (opts.preferWeb === true) {
    const webText = PRONUNCIATION_OVERRIDES[langKey]?.[text] ?? text;
    const ok = await _speakWeb(webText, langKey, playEpoch, opts);
    if (ok) return null;
  }

  const ttsText =
    opts.ttsOverride ??
    PRONUNCIATION_OVERRIDES[langKey]?.[text] ??
    text;

  console.log(
    `[TTS] speak() → "${text}" lang=${langKey} slow=${!!opts.slow} shadow=${!!opts.shadowing}`
  );

  const resolved = await _resolveStaticAudio(ttsText, langCode);
  if (!resolved || _isStalePlayback(playEpoch)) return null;

  const { key, url, relativePath } = resolved;

  if (_currentAudio && _currentKey === key && !_currentAudio.paused) {
    console.log(`[TTS] already playing → "${text}"`);
    return _currentAudio;
  }

  _stopAudio();

  const audio = new Audio(url);
  audio.preload = "auto";
  audio.playbackRate = opts.slow ? 0.82 : 1.0;

  const ready = await _readyAudio(audio, relativePath, key);
  if (!ready || _isStalePlayback(playEpoch)) {
    _discardPendingAudio(audio);
    eventBus.emit("tts:missing-audio", {
      text,
      langKey,
      key,
      relativePath,
      reason: "load-failed",
    });
    return null;
  }

  _currentAudio = audio;
  _currentKey = key;

  audio.addEventListener(
    "ended",
    () => {
      console.log(`[TTS] play end → ${key}`);
      if (_currentAudio === audio) _currentAudio = null;
      if (_currentKey === key) _currentKey = null;
    },
    { once: true }
  );

  console.log(`[TTS] play start → "${text}"`);

  try {
    if (_isStalePlayback(playEpoch)) {
      _discardPendingAudio(audio);
      if (_currentAudio === audio) _currentAudio = null;
      if (_currentKey === key) _currentKey = null;
      return null;
    }
    await audio.play();
  } catch (err) {
    console.warn(`[TTS] play failed → ${err.message}`);
    eventBus.emit("tts:missing-audio", {
      text,
      langKey,
      key,
      relativePath,
      reason: "play-failed",
      error: err.message,
    });
    if (_currentAudio === audio) _currentAudio = null;
    if (_currentKey === key) _currentKey = null;
    return null;
  }

  if (opts.shadowing) {
    _scheduleShadowRepeat({ text, key, url, relativePath, playEpoch });
  }

  return audio;
}

export function stop() {
  _playEpoch++;
  if (_shadowTimeout) {
    clearTimeout(_shadowTimeout);
    _shadowTimeout = null;
  }
  _stopWebSpeech();
  _stopAudio();
}

export const stopSpeech = stop;

export async function preload(items, langKey) {
  const langCode = LANG_CODES[langKey];
  if (!langCode) return;

  const manifest = await _getManifest();

  const texts = items
    .filter((it) => it.audio !== false)
    .map((it) => (it.target || it.phrase || it.prompt || "").trim())
    .filter(Boolean)
    .filter((t, i, arr) => arr.indexOf(t) === i);

  for (const t of texts) {
    const ttsText = PRONUNCIATION_OVERRIDES[langKey]?.[t] ?? t;
    const key = `${langCode}::${ttsText}`;
    const relativePath = manifest[key];

    if (!relativePath) {
      console.warn(`[TTS] preload miss → ${key}`);
      continue;
    }

    _preloadStaticFile(relativePath);
  }
}

export function attachWordTap(container) {
  container.querySelectorAll("[data-tts]").forEach((el) => {
    if (el.dataset.ttsBound) return;
    el.dataset.ttsBound = "1";
    el.style.cursor = "pointer";

    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const text = el.dataset.tts;
      const langKey = el.dataset.lang;
      if (text && langKey) speak(text, langKey);
    });
  });
}

export function startItemTimer(item, langKey) {
  const start = Date.now();
  return {
    resolve(correct) {
      const elapsed = Date.now() - start;
      const text = item.target || item.phrase || item.word || "";
      eventBus.emit("session:item-time", {
        text,
        langKey,
        correct,
        ms: elapsed,
      });
    },
  };
}

async function _resolveStaticAudio(ttsText, langCode) {
  const manifest = await _getManifest();
  const key = `${langCode}::${ttsText}`;

  const overridden = STATIC_PATH_OVERRIDES[key];
  if (overridden) {
    console.log(`[TTS] static override → key="${key}" file="${overridden}"`);
    return { key, relativePath: overridden, url: _toAbsoluteAssetUrl(overridden) };
  }

  const relativePath = manifest[key];

  if (!relativePath) {
    console.warn(`[TTS] static miss → key="${key}"`);
    if (langCode === "ja" && ttsText === "コンニチワ") {
      const fallbackKey = `${langCode}::こんにちは`;
      const fallbackPath = manifest[fallbackKey];
      if (fallbackPath) {
        return {
          key: fallbackKey,
          relativePath: fallbackPath,
          url: _toAbsoluteAssetUrl(fallbackPath),
        };
      }
    }
    eventBus.emit("tts:missing-audio", {
      text: ttsText,
      langCode,
      key,
      reason: "manifest-miss",
    });
    return null;
  }

  console.log(`[TTS] static path chosen → key="${key}" file="${relativePath}"`);

  return {
    key,
    relativePath,
    url: _toAbsoluteAssetUrl(relativePath),
  };
}

function _preloadStaticFile(relativePath) {
  const url = _toAbsoluteAssetUrl(relativePath);
  if (_preloaded.has(url)) return;
  _preloaded.add(url);

  const audio = new Audio(url);
  audio.preload = "auto";
  audio.load();
}

function _readyAudio(audio, relativePath, key) {
  return new Promise((resolve) => {
    let settled = false;

    const done = (ok) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(ok);
    };

    const onCanPlay = () => {
      console.log(`[TTS] static load ok → "${relativePath}"`);
      done(true);
    };

    const onError = () => {
      console.warn(`[TTS] static load failed → ${relativePath}`);
      eventBus.emit("tts:missing-audio", {
        key,
        relativePath,
        reason: "decode-error",
      });
      done(false);
    };

    const cleanup = () => {
      audio.removeEventListener("canplaythrough", onCanPlay);
      audio.removeEventListener("error", onError);
    };

    if (audio.readyState >= 3) {
      onCanPlay();
      return;
    }

    audio.addEventListener("canplaythrough", onCanPlay, { once: true });
    audio.addEventListener("error", onError, { once: true });
    audio.load();

    setTimeout(() => {
      done(audio.readyState >= 2);
    }, 4000);
  });
}

function _stopAudio() {
  if (_currentAudio) {
    _currentAudio.pause();
    try {
      _currentAudio.currentTime = 0;
    } catch {}
    _currentAudio = null;
    _currentKey = null;
  }
}

function _scheduleShadowRepeat({ text, key, url, relativePath, playEpoch }) {
  _shadowTimeout = setTimeout(async () => {
    _shadowTimeout = null;
    if (_currentAudio || _isStalePlayback(playEpoch)) return;

    const audio = new Audio(url);
    audio.preload = "auto";
    audio.playbackRate = 0.92;

    const ready = await _readyAudio(audio, relativePath, key);
    if (!ready || _currentAudio || _isStalePlayback(playEpoch)) {
      _discardPendingAudio(audio);
      return;
    }

    _currentAudio = audio;
    _currentKey = key;

    console.log(`[TTS] play start (shadow) → "${text}"`);

    try {
      await audio.play();
    } catch (err) {
      console.warn(`[TTS] shadow play failed → ${err.message}`);
      if (_currentAudio === audio) _currentAudio = null;
      if (_currentKey === key) _currentKey = null;
      return;
    }

    audio.addEventListener(
      "ended",
      () => {
        if (_currentAudio === audio) _currentAudio = null;
        if (_currentKey === key) _currentKey = null;
      },
      { once: true }
    );
  }, 1600);
}

function _isStalePlayback(playEpoch) {
  return playEpoch !== _playEpoch;
}

function _discardPendingAudio(audio) {
  if (!audio) return;
  try {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  } catch {}
}

function _stopWebSpeech() {
  try {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  } catch {}
  _currentUtterance = null;
}

function _speakWeb(text, langKey, playEpoch, opts) {
  try {
    if (typeof window === "undefined") return Promise.resolve(false);
    const synth = window.speechSynthesis;
    const Utter = window.SpeechSynthesisUtterance;
    if (!synth || !Utter) return Promise.resolve(false);

    const lang = WEB_SPEECH_LANG[langKey] || "ja-JP";
    _stopWebSpeech();

    return new Promise((resolve) => {
      let settled = false;
      const done = (ok) => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };

      const u = new Utter(text);
      _currentUtterance = u;
      u.lang = lang;
      u.rate = opts.slow ? 0.82 : 1.0;
      u.pitch = 1.0;
      u.volume = 1.0;
      u.onend = () => done(true);
      u.onerror = () => done(false);

      if (_isStalePlayback(playEpoch)) {
        done(false);
        return;
      }

      try {
        synth.speak(u);
      } catch {
        done(false);
        return;
      }

      setTimeout(() => {
        if (_isStalePlayback(playEpoch)) {
          _stopWebSpeech();
          done(false);
          return;
        }
        done(true);
      }, 8000);
    });
  } catch {
    return Promise.resolve(false);
  }
}

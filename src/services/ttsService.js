
/**
 * Vaultria — Static TTS Service
 * Static-only lesson audio.
 *
 * Uses:
 * - audio/manifest.json
 * - audio/ja/*.wav
 * - audio/ko/*.wav
 * - audio/es/*.wav
 *
 * No live HF fallback.
 * No puter fallback.
 * No Web Speech fallback.
 */

import { eventBus } from "../utils/eventBus.js";

const ROOT_URL = new URL("../../", import.meta.url);
const MANIFEST_URL = new URL("../../audio/manifest.json", import.meta.url).href;

const LANG_CODES = {
  japanese: "ja",
  korean: "ko",
  spanish: "es",
};

const PRONUNCIATION_OVERRIDES = {
  japanese: {},
  korean: {},
  spanish: {},
};

let _manifest = null;
let _manifestLoad = null;
let _currentAudio = null;
let _currentKey = null;
let _shadowTimeout = null;
const _preloaded = new Set();

function _toAbsoluteAssetUrl(relativePath) {
  return new URL(relativePath, ROOT_URL).href;
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

  const langCode = LANG_CODES[langKey];
  if (!langCode) {
    console.warn(`[TTS] unknown langKey: ${langKey}`);
    return null;
  }

  const ttsText =
    opts.ttsOverride ??
    PRONUNCIATION_OVERRIDES[langKey]?.[text] ??
    text;

  console.log(
    `[TTS] speak() → "${text}" lang=${langKey} slow=${!!opts.slow} shadow=${!!opts.shadowing}`
  );

  const resolved = await _resolveStaticAudio(ttsText, langCode);
  if (!resolved) return null;

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
  if (!ready) {
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
    _scheduleShadowRepeat({ text, key, url, relativePath });
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

async function _resolveStaticAudio(ttsText, langCode) {
  const manifest = await _getManifest();
  const key = `${langCode}::${ttsText}`;
  const relativePath = manifest[key];

  if (!relativePath) {
    console.warn(`[TTS] static miss → key="${key}"`);
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

function _scheduleShadowRepeat({ text, key, url, relativePath }) {
  _shadowTimeout = setTimeout(async () => {
    _shadowTimeout = null;
    if (_currentAudio) return;

    const audio = new Audio(url);
    audio.preload = "auto";
    audio.playbackRate = 0.92;

    const ready = await _readyAudio(audio, relativePath, key);
    if (!ready || _currentAudio) return;

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

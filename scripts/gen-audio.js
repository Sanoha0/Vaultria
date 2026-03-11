#!/usr/bin/env node
/**
 * Vaultia — Static Audio Generator
 *
 * The HuggingFace TTS endpoint returns WAV audio.
 * This script saves files as .wav (the raw response bytes — no conversion).
 * The manifest records .wav paths. ttsService.js serves them directly.
 *
 * Optional: pass --mp3 to convert each WAV to MP3 via ffmpeg before saving.
 * ffmpeg must be installed and on PATH for --mp3 to work.
 * Without --mp3, no external tools are required.
 *
 * Usage:
 *   node scripts/gen-audio.js             # generate all missing .wav files
 *   node scripts/gen-audio.js --force     # regenerate everything
 *   node scripts/gen-audio.js --lang ja   # only Japanese
 *   node scripts/gen-audio.js --mp3       # convert to MP3 via ffmpeg
 *
 * Output layout (default .wav):
 *   audio/
 *     manifest.json
 *     ja/
 *       d5b262a29cf2a923.wav
 *       ...
 *     ko/
 *     es/
 *
 * Manifest format:
 *   {
 *     "ja::あ":              "audio/ja/d5b262a29cf2a923.wav",
 *     "ja::ありがとうございます": "audio/ja/6a51c2e343e53b91.wav",
 *     "ko::잠깐만요":          "audio/ko/4b2a1a7aab049f32.wav",
 *     "es::buenos días":     "audio/es/dc9b0c5cd16e24d2.wav"
 *   }
 *
 * Keys are "langCode::text" — the same format ttsService.js uses for lookup.
 * Values are repo-relative paths served directly by GitHub Pages.
 */

import { createHash }                                 from "crypto";
import { existsSync, mkdirSync, writeFileSync,
         readFileSync, unlinkSync }                   from "fs";
import { join, dirname }                              from "path";
import { fileURLToPath }                              from "url";
import { execFileSync }                               from "child_process";

const __dir   = dirname(fileURLToPath(import.meta.url));
const ROOT    = join(__dir, "..");
const AUDIO   = join(ROOT, "audio");
const DATA    = join(ROOT, "data");
const MANIFEST= join(AUDIO, "manifest.json");

const TTS_URL = "https://sanohadev-vaultia-tts.hf.space/tts";
const CONCUR  = 3;   // concurrent requests — polite to the HF endpoint
const RETRY   = 2;   // retries per item on network error

// ── CLI flags ─────────────────────────────────────────────────────────────

const args     = process.argv.slice(2);
const FORCE    = args.includes("--force");
const USE_MP3  = args.includes("--mp3");
const ONLY_LANG= (() => { const i = args.indexOf("--lang"); return i >= 0 ? args[i+1] : null; })();
const EXT      = USE_MP3 ? ".mp3" : ".wav";

if (USE_MP3) {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    console.log("ffmpeg found — will convert WAV → MP3");
  } catch {
    console.error("ERROR: --mp3 requires ffmpeg on PATH. Install it or omit --mp3 to save as .wav.");
    process.exit(1);
  }
}

// ── Item collection ───────────────────────────────────────────────────────

function collectItems(jsonFile) {
  const d = JSON.parse(readFileSync(join(DATA, jsonFile), "utf8"));
  const texts = new Set();

  for (const stage of d.stages ?? []) {
    for (const unit of stage.units ?? []) {
      for (const sess of unit.sessions ?? []) {
        for (const item of sess.items ?? []) {
          if (item.audio === false) continue;
          const t = (item.target || item.phrase || item.prompt || "").trim();
          if (t) texts.add(t);
        }
      }
    }
  }
  for (const p of d.phraseLibrary ?? []) {
    if (p.audio === false) continue;
    const t = (p.phrase || "").trim();
    if (t) texts.add(t);
  }
  return [...texts];
}

// ── Filename hash ─────────────────────────────────────────────────────────

/** SHA-1 of "langCode::text", first 16 hex chars. Deterministic, URL-safe. */
function audioHash(langCode, text) {
  return createHash("sha1").update(`${langCode}::${text}`, "utf8").digest("hex").slice(0, 16);
}

// ── Fetch (WAV bytes) ─────────────────────────────────────────────────────

async function fetchWav(text, langCode) {
  for (let attempt = 0; attempt <= RETRY; attempt++) {
    try {
      const res = await fetch(TTS_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text, lang: langCode, speed: 1.0 }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Verify the response is actually WAV (starts with "RIFF")
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0) throw new Error("empty response");

      const magic = buf.slice(0, 4).toString("ascii");
      if (magic !== "RIFF") {
        // Not WAV — log the actual content-type and first bytes for diagnosis
        const ct = res.headers.get("content-type") ?? "unknown";
        console.warn(`\n  [warn] unexpected format: magic="${magic}" content-type="${ct}" for "${text}"`);
        // Still save it — browser will try to play it; may work depending on format
      }

      return buf;
    } catch (err) {
      if (attempt < RETRY) {
        process.stdout.write(` (retry ${attempt + 1})...`);
        await new Promise(r => setTimeout(r, 1200 * (attempt + 1)));
      } else {
        throw err;
      }
    }
  }
}

// ── Optional WAV → MP3 conversion via ffmpeg ──────────────────────────────

function convertToMp3(wavBuf, outPath) {
  // Write WAV to a temp file, run ffmpeg, read MP3 back
  const tmpWav = outPath.replace(/\.mp3$/, ".tmp.wav");
  writeFileSync(tmpWav, wavBuf);
  try {
    execFileSync("ffmpeg", [
      "-y",                    // overwrite output
      "-i", tmpWav,            // input WAV
      "-codec:a", "libmp3lame",
      "-q:a", "4",             // VBR quality ~165 kbps — good for speech
      outPath,
    ], { stdio: "ignore" });
    const mp3 = readFileSync(outPath);
    return mp3;
  } finally {
    try { unlinkSync(tmpWav); } catch { /* ignore */ }
  }
}

// ── Batch runner ──────────────────────────────────────────────────────────

async function processBatch(tasks) {
  const results = [];
  for (let i = 0; i < tasks.length; i += CONCUR) {
    const chunk = tasks.slice(i, i + CONCUR);
    results.push(...await Promise.allSettled(chunk.map(fn => fn())));
  }
  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────

const LANGS = [
  { code: "ja", file: "japanese.json" },
  { code: "ko", file: "korean.json"   },
  { code: "es", file: "spanish.json"  },
].filter(l => !ONLY_LANG || l.code === ONLY_LANG);

// Load existing manifest
let manifest = {};
if (existsSync(MANIFEST)) {
  try { manifest = JSON.parse(readFileSync(MANIFEST, "utf8")); }
  catch { manifest = {}; }
}

let generated = 0, skipped = 0, failed = 0;

for (const { code, file } of LANGS) {
  const texts = collectItems(file);
  console.log(`\n[${code}] ${texts.length} items (saving as ${EXT})`);

  mkdirSync(join(AUDIO, code), { recursive: true });

  const tasks = texts.map(text => async () => {
    const key      = `${code}::${text}`;
    const hash     = audioHash(code, text);
    const filename = `audio/${code}/${hash}${EXT}`;
    const outPath  = join(ROOT, filename);

    if (!FORCE && existsSync(outPath)) {
      manifest[key] = filename;
      skipped++;
      process.stdout.write(".");
      return;
    }

    process.stdout.write(`\n  → ${text.slice(0, 42).padEnd(42)}`);
    try {
      const wavBuf = await fetchWav(text, code);

      if (USE_MP3) {
        convertToMp3(wavBuf, outPath);
        const size = readFileSync(outPath).length;
        process.stdout.write(` ✓ mp3 (${size}B)`);
      } else {
        writeFileSync(outPath, wavBuf);
        process.stdout.write(` ✓ wav (${wavBuf.length}B)`);
      }

      manifest[key] = filename;
      generated++;
    } catch (err) {
      failed++;
      process.stdout.write(` ✗ ${err.message}`);
    }
  });

  await processBatch(tasks);
  console.log("");
}

// Write manifest
mkdirSync(AUDIO, { recursive: true });
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2), "utf8");

console.log(`\n── Done ────────────────────────────────────────`);
console.log(`  Format    : ${USE_MP3 ? "MP3 (ffmpeg)" : "WAV (raw)"}`);
console.log(`  Generated : ${generated}`);
console.log(`  Skipped   : ${skipped}`);
console.log(`  Failed    : ${failed}`);
console.log(`  Manifest  : ${Object.keys(manifest).length} entries → audio/manifest.json`);

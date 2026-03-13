import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const IN_PATH = path.join(ROOT, "audio", "manifest.json.bak");
const OUT_PATH = path.join(ROOT, "audio", "manifest.json");

function stripBom(s) {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function latin1ToUtf8(s) {
  // Typical "mojibake" repair: UTF-8 bytes that were decoded as ISO-8859-1/latin1.
  // Works when every codepoint is within 0..255.
  return Buffer.from(s, "latin1").toString("utf8");
}

function looksRepaired(original, repaired) {
  if (!repaired) return false;
  if (repaired === original) return false;
  // U+FFFD replacement char indicates invalid UTF-8 decode.
  if (repaired.includes("\uFFFD")) return false;
  return true;
}

const raw = stripBom(fs.readFileSync(IN_PATH, "utf8"));
const input = JSON.parse(raw);

const out = Object.create(null);
for (const [key, val] of Object.entries(input)) {
  const repaired = latin1ToUtf8(key);
  if (looksRepaired(key, repaired)) out[repaired] = val;
  out[key] = val; // keep original for backward compatibility
}

const sortedKeys = Object.keys(out).sort((a, b) => a.localeCompare(b));
const sorted = Object.create(null);
for (const k of sortedKeys) sorted[k] = out[k];

// Write UTF-8 without BOM.
fs.writeFileSync(OUT_PATH, JSON.stringify(sorted, null, 2) + "\n", "utf8");

// Minimal sanity check for the reported issue.
const hasKonnichiwa =
  Object.prototype.hasOwnProperty.call(sorted, "ja::\u3053\u3093\u306b\u3061\u306f") ||
  Object.prototype.hasOwnProperty.call(sorted, "ja::\u30b3\u30f3\u30cb\u30c1\u30ef");
if (!hasKonnichiwa) {
  console.warn("[fix-audio-manifest] Warning: expected konnichiwa keys not found");
} else {
  console.log("[fix-audio-manifest] OK: konnichiwa keys present");
}


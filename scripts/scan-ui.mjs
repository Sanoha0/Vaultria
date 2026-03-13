#!/usr/bin/env node
/**
 * Scan repository UI sources for:
 * - Emoji / pictographic symbols (spec prohibits emoji-based UI)
 * - "streak" references
 * - Disallowed "bounce" animation naming
 *
 * Usage:
 *   node scripts/scan-ui.mjs
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const INCLUDE_DIRS = ["src", "docs", "scripts"];
const INCLUDE_FILES = ["index.html"];
const EXT_ALLOW = new Set([".js", ".css", ".html", ".md", ".json"]);

const EMOJI_RE = /\p{Extended_Pictographic}/u;
const STREAK_RE = /\bstreak\b/i;
const BOUNCE_RE = /\bbounce\b/i;

function* walk(dir) {
  const ents = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of ents) {
    // Skip deps/large dirs
    if (ent.name === "node_modules" || ent.name === ".git") continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      yield* walk(p);
    } else {
      yield p;
    }
  }
}

function rel(p) {
  return path.relative(ROOT, p).replaceAll("\\", "/");
}

function shouldScan(p) {
  const base = path.basename(p);
  if (INCLUDE_FILES.includes(base)) return true;
  const ext = path.extname(p).toLowerCase();
  if (!EXT_ALLOW.has(ext)) return false;
  const r = rel(p);
  return INCLUDE_DIRS.some((d) => r === d || r.startsWith(`${d}/`));
}

function scanFile(p) {
  let text;
  try {
    text = fs.readFileSync(p, "utf8");
  } catch {
    return [];
  }

  const out = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Emoji
    if (EMOJI_RE.test(line)) {
      // Report each emoji codepoint position (handle surrogate pairs)
      const cps = Array.from(line);
      for (let j = 0; j < cps.length; j++) {
        const ch = cps[j];
        if (!EMOJI_RE.test(ch)) continue;
        out.push({ kind: "emoji", file: rel(p), line: i + 1, col: j + 1, sample: ch });
      }
    }

    // streak
    if (STREAK_RE.test(line)) {
      out.push({ kind: "streak", file: rel(p), line: i + 1, col: 1, sample: line.trim().slice(0, 140) });
    }

    // bounce
    if (BOUNCE_RE.test(line)) {
      out.push({ kind: "bounce", file: rel(p), line: i + 1, col: 1, sample: line.trim().slice(0, 140) });
    }
  }
  return out;
}

function main() {
  const files = [];
  for (const d of INCLUDE_DIRS) {
    const abs = path.join(ROOT, d);
    if (fs.existsSync(abs)) files.push(...walk(abs));
  }
  for (const f of INCLUDE_FILES) {
    const abs = path.join(ROOT, f);
    if (fs.existsSync(abs)) files.push(abs);
  }

  const findings = [];
  for (const f of files) {
    if (!shouldScan(f)) continue;
    findings.push(...scanFile(f));
  }

  const byKind = findings.reduce((acc, x) => {
    (acc[x.kind] ||= []).push(x);
    return acc;
  }, {});

  const kinds = ["emoji", "streak", "bounce"];
  for (const k of kinds) {
    const arr = byKind[k] || [];
    console.log(`\n== ${k.toUpperCase()} (${arr.length}) ==`);
    for (const f of arr.slice(0, 200)) {
      console.log(`${f.file}:${f.line}:${f.col}  ${f.sample}`);
    }
    if (arr.length > 200) console.log(`... ${arr.length - 200} more`);
  }

  const total = findings.length;
  console.log(`\nTotal findings: ${total}`);
  process.exitCode = total ? 2 : 0;
}

main();

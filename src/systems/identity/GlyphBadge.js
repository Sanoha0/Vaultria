/**
 * Vaultria — GlyphBadge
 * Small inline identity badges for enrolled languages.
 * Shows the language flag emoji, native script sample, and optional prestige rank.
 *
 * Usage:
 *   import { renderGlyphBadge } from "./GlyphBadge.js";
 *   el.innerHTML = renderGlyphBadge("japanese", { rank: 2 });
 */

const GLYPH_DATA = {
  japanese: {
    flag:     "🇯🇵",
    native:   "日本語",
    glyph:    "日",           // Single representative kanji
    accent:   "#e8a0b8",
    shadow:   "rgba(232,160,184,0.25)",
  },
  korean: {
    flag:     "🇰🇷",
    native:   "한국어",
    glyph:    "글",           // Hangul for "writing/letter"
    accent:   "#4db8ff",
    shadow:   "rgba(77,184,255,0.25)",
  },
  spanish: {
    flag:     "🇪🇸",
    native:   "Español",
    glyph:    "Á",            // Spanish accented character
    accent:   "#e8a44a",
    shadow:   "rgba(232,164,74,0.25)",
  },
};

/** Roman numerals for prestige ranks 1–8 */
const RANK_LABEL = ["","I","II","III","IV","V","VI","VII","VIII"];

/**
 * Renders a language glyph badge.
 * @param {string} langKey  — "japanese" | "korean" | "spanish"
 * @param {object} opts
 * @param {number} [opts.rank=0]  — prestige rank (0 = none shown)
 * @param {number} [opts.size=40] — badge height in px (width auto)
 * @returns {string} HTML string
 */
export function renderGlyphBadge(langKey, { rank = 0, size = 40 } = {}) {
  const def = GLYPH_DATA[langKey];
  if (!def) return "";

  const fontSize    = Math.round(size * 0.48);
  const labelSize   = Math.round(size * 0.26);
  const rankSize    = Math.round(size * 0.22);
  const rankBadge   = rank > 0
    ? `<span style="
        display:inline-flex;align-items:center;justify-content:center;
        font-size:${rankSize}px;font-family:var(--font-mono);
        color:${def.accent};line-height:1;
        background:${def.shadow};
        border:1px solid ${def.accent}44;
        border-radius:4px;padding:1px 4px;
        margin-left:4px;
        ">${RANK_LABEL[rank] ?? rank}</span>`
    : "";

  return `<div class="glyph-badge glyph-badge-${langKey}" style="
    display:inline-flex;align-items:center;gap:6px;
    padding:${Math.round(size * 0.1)}px ${Math.round(size * 0.22)}px;
    background:${def.shadow};
    border:1px solid ${def.accent}33;
    border-radius:${Math.round(size * 0.3)}px;
    box-shadow:0 2px 8px ${def.shadow};
    line-height:1;white-space:nowrap;
    transition:border-color 0.2s,box-shadow 0.2s;
  ">
    <span style="font-size:${Math.round(size * 0.5)}px;line-height:1;">${def.flag}</span>
    <span style="
      font-size:${fontSize}px;font-weight:600;
      color:${def.accent};
      font-family:var(--font-display);
      line-height:1;
    ">${def.glyph}</span>
    <span style="
      font-size:${labelSize}px;
      color:rgba(255,255,255,0.6);
      font-family:var(--font-display);
      font-weight:400;
    ">${def.native}</span>
    ${rankBadge}
  </div>`;
}

/**
 * Renders a compact row of glyph badges for multiple languages.
 * @param {object[]} langs — [{ key, rank }]
 * @param {number}   size  — badge height
 * @returns {string} HTML string
 */
export function renderGlyphRow(langs = [], size = 36) {
  return `<div class="glyph-row" style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;">
    ${langs.map(({ key, rank }) => renderGlyphBadge(key, { rank, size })).join("")}
  </div>`;
}

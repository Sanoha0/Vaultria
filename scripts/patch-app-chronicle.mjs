import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const appPath = path.join(root, "src", "app.js");

let txt = fs.readFileSync(appPath, "utf8");

// Minimal mojibake fixes that affect visible UI strings.
txt = txt
  .replaceAll("\u00c2\u00b7", "\u00b7") // Â· -> ·
  .replaceAll("\u00e2\u20ac\u00a6", "...") // â€¦ -> ...
  .replaceAll("\u00e2\u20ac\u201d", "-") // â€” -> -
  .replaceAll("\u00e2\u2020\u2019", ""); // â†’ -> ""

// Remove other common label prefixes that were previously used as pseudo-icons.
txt = txt
  .replaceAll("\u00e2\u0178\u00b3 ", "") // âŸ³
  .replaceAll("\u00e2\u0160\u017e ", "") // âŠž
  .replaceAll("\u00e2\u02dc\u2026 ", ""); // â˜…

// Replace the existing _pageChallenges implementation with a Chronicle page.
const re = /_pageChallenges\(canvas\)\s*\{[\s\S]*?\n\s*\}\n\s*\n\s*\/\/[^\n]*\n\s*async _pageArena\(/m;

const chronicleFn =
  `_pageChallenges(canvas) {\n` +
  `    const accent = ACCENT[this.currentLang];\n` +
  `    const prog   = this.currentProgress || {};\n` +
  `    const xp     = prog.xp || 0;\n` +
  `    const level  = xpToLevel(xp);\n` +
  `\n` +
  `    const profile = this.profile || {};\n` +
  `    const pending = profile.pendingMilestone || null;\n` +
  `    const rewards = profile.rewards || {};\n` +
  `    const unlocked = Object.keys(rewards).filter((k) => rewards[k]);\n` +
  `\n` +
  `    const nextMilestone = pending ? pending : (Math.floor(level / 5) + 1) * 5;\n` +
  `    const lvStart = Math.floor(level / 5) * 5;\n` +
  `    const pct = Math.round((Math.max(0, Math.min(level - lvStart, 5)) / 5) * 100);\n` +
  `\n` +
  `    const icon = (type) => {\n` +
  `      const stroke = "rgba(255,255,255,0.72)";\n` +
  `      const common = \`fill="none" stroke="\${stroke}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"\`;\n` +
  `      if (type === "soundscape") return \`<svg width="18" height="18" viewBox="0 0 24 24" \${common}><path d="M3 12h2l2-6 4 12 3-8 2 2h3"/></svg>\`;\n` +
  `      if (type === "frame")     return \`<svg width="18" height="18" viewBox="0 0 24 24" \${common}><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 15l2-2 2 2 4-4"/></svg>\`;\n` +
  `      if (type === "desk")      return \`<svg width="18" height="18" viewBox="0 0 24 24" \${common}><path d="M4 10h16"/><path d="M6 10v10"/><path d="M18 10v10"/><path d="M9 14h6"/></svg>\`;\n` +
  `      if (type === "parallax")  return \`<svg width="18" height="18" viewBox="0 0 24 24" \${common}><path d="M4 17l4-4 3 3 5-6 4 7"/><path d="M4 7h16"/></svg>\`;\n` +
  `      if (type === "cursor")    return \`<svg width="18" height="18" viewBox="0 0 24 24" \${common}><path d="M4 4l7 17 2-6 6-2z"/></svg>\`;\n` +
  `      return \`<svg width="18" height="18" viewBox="0 0 24 24" \${common}><path d="M12 3v18"/><path d="M3 12h18"/></svg>\`;\n` +
  `    };\n` +
  `\n` +
  `    const classify = (id) => {\n` +
  `      if (id.startsWith("soundscapes_")) return { type: "soundscape", label: id.replace("soundscapes_", "Soundscape: ").replaceAll("_", " ") };\n` +
  `      if (id.startsWith("frame_"))       return { type: "frame",      label: id.replace("frame_", "Frame: ").replaceAll("_", " ") };\n` +
  `      if (id.startsWith("desk_"))        return { type: "desk",       label: id.replace("desk_", "Desk: ").replaceAll("_", " ") };\n` +
  `      if (id.startsWith("parallax_"))    return { type: "parallax",   label: id.replace("parallax_", "Parallax: ").replaceAll("_", " ") };\n` +
  `      if (id.startsWith("cursor_"))      return { type: "cursor",     label: id.replace("cursor_", "Cursor: ").replaceAll("_", " ") };\n` +
  `      return { type: "item", label: id.replaceAll("_", " ") };\n` +
  `    };\n` +
  `\n` +
  `    canvas.innerHTML = \`\n` +
  `<div class="canvas-content page-enter">\n` +
  `  <div class="section-header">\n` +
  `    <div>\n` +
  `      <h2 class="section-title">Chronicle</h2>\n` +
  `      <p class="section-subtitle">Workspace upgrades appear every 5 levels. No penalties, no randomness.</p>\n` +
  `    </div>\n` +
  `    <div style="display:flex;gap:10px;align-items:center;">\n` +
  `      <button class="btn btn-ghost" id="chronicle-open-profile" style="border-color:\${accent}30;color:\${accent};">Open Profile Desk</button>\n` +
  `      \${pending ? \`<button class="btn" id="chronicle-pending" style="background:\${accent};border-color:\${accent};color:#0b0b0c;">Choose Level \${pending} Reward</button>\` : ""}\n` +
  `    </div>\n` +
  `  </div>\n` +
  `\n` +
  `  <div class="card" style="padding:18px 18px 16px;margin-bottom:14px;">\n` +
  `    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">\n` +
  `      <div style="font-size:0.78rem;color:var(--text-muted);font-family:var(--font-mono);">LEVEL \${level} - NEXT MILESTONE: \${nextMilestone}</div>\n` +
  `      <div style="font-size:0.78rem;color:var(--text-muted);font-family:var(--font-mono);">\${pct}%</div>\n` +
  `    </div>\n` +
  `    <div class="progress-bar-container" style="margin-bottom:0;">\n` +
  `      <div class="progress-bar-fill" style="width:\${pct}%;background:\${accent};"></div>\n` +
  `    </div>\n` +
  `  </div>\n` +
  `\n` +
  `  <div class="card" style="padding:18px;margin-bottom:14px;">\n` +
  `    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">\n` +
  `      <div style="font-size:0.92rem;font-weight:600;color:var(--text-primary);">Unlocked Workspace Upgrades</div>\n` +
  `      <div style="font-size:0.75rem;color:var(--text-muted);">\${unlocked.length} unlocked</div>\n` +
  `    </div>\n` +
  `    \${unlocked.length ? \`\n` +
  `      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">\n` +
  `        \${unlocked.slice(0, 10).map((id) => {\n` +
  `          const meta = classify(id);\n` +
  `          return \`\n` +
  `            <div class="card" style="padding:12px;background:var(--bg-glass);border-color:var(--border-subtle);">\n` +
  `              <div style="display:flex;align-items:flex-start;gap:10px;">\n` +
  `                <div style="width:26px;height:26px;display:flex;align-items:center;justify-content:center;opacity:0.9;">\${icon(meta.type)}</div>\n` +
  `                <div>\n` +
  `                  <div style="font-size:0.86rem;font-weight:600;color:var(--text-primary);">\${meta.label}</div>\n` +
  `                  <div style="font-size:0.75rem;color:var(--text-muted);text-transform:capitalize;">\${meta.type}</div>\n` +
  `                </div>\n` +
  `              </div>\n` +
  `            </div>\`;\n` +
  `        }).join(\"\")}\n` +
  `      </div>\n` +
  `    \` : \`\n` +
  `      <div style=\"padding:8px 0;color:var(--text-muted);font-size:0.85rem;\">No upgrades unlocked yet. Reach level 10 for your first Chronicle choice.</div>\n` +
  `    \`}\n` +
  `  </div>\n` +
  `\n` +
  `  <div class="card" style="padding:18px;">\n` +
  `    <div style="font-size:0.92rem;font-weight:600;color:var(--text-primary);margin-bottom:8px;">What This Is</div>\n` +
  `    <div style="font-size:0.85rem;color:var(--text-secondary);line-height:1.6;max-width:70ch;">\n` +
  `      Chronicle milestones are cosmetic and identity-based. They improve your workspace atmosphere without changing learning difficulty or locking you into streaks.\n` +
  `    </div>\n` +
  `  </div>\n` +
  `</div>\n` +
  `\`;\n` +
  `\n` +
  `    canvas.querySelector("#chronicle-open-profile")?.addEventListener("click", () => this._onRightNav("profile"));\n` +
  `    canvas.querySelector("#chronicle-pending")?.addEventListener("click", () => {\n` +
  `      ChronicleSystem.checkPending();\n` +
  `    });\n` +
  `  }\n` +
  `\n` +
  `  async _pageArena(`;

if (!re.test(txt)) {
  console.error("[patch-app-chronicle] Could not find _pageChallenges to replace.");
  process.exit(1);
}

txt = txt.replace(re, chronicleFn);

// Stop showing streak language in other areas (keep data if present, but don't display it as days).
txt = txt.replaceAll("d ascent", "Momentum");

fs.writeFileSync(appPath, txt, "utf8");
console.log("[patch-app-chronicle] Updated src/app.js");

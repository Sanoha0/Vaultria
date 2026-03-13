import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const appPath = path.join(root, "src", "app.js");

let txt = fs.readFileSync(appPath, "utf8");

// 1) Leaderboards: remove medal emojis + swap streak display for momentum percent.
txt = txt.replace(
  /const ua\\s*=\\s*ACCENT\\[u\\.currentLanguage\\]\\s*\\|\\|\\s*accent\\s*\\|\\|\\s*\"#8b7cff\";\\s*\\n\\s*const medal =[^\\n]*\\n\\s*const mc\\s*=\\s*[^\\n]*\\n/m,
  (m) => {
    // Keep exact indentation from the matched text.
    const indent = m.match(/\\n(\\s*)const ua/)?.[1] ?? "        ";
    return (
      `${indent}const ua    = ACCENT[u.currentLanguage] || accent || \"#8b7cff\";\\n` +
      `${indent}const medal = rank;\\n` +
      `${indent}const mc    = rank <= 3 ? \"var(--text-primary)\" : \"var(--text-muted)\";\\n` +
      `${indent}const mScore = u.momentum?.score ?? 0;\\n` +
      `${indent}const mPct = Math.round((Math.log10(1 + Math.max(0, mScore)) / Math.log10(1001)) * 100);\\n`
    );
  }
);

txt = txt.replaceAll(
  "${u.streak||0}Momentum",
  "${mPct}%"
);

// 2) Other public cards: remove remaining streak-to-text artifacts.
// (If these user docs still have streak, we just stop showing it.)
txt = txt.replaceAll("${u.streak||0}Momentum", "${mPct}%");
txt = txt.replaceAll("${p.streak||0}Momentum", "${mPct}%");
txt = txt.replaceAll("(u.streak||0)+\"d\"", "mPct+\"%\"");

fs.writeFileSync(appPath, txt, "utf8");
console.log("[patch-app-momentum-public] Updated src/app.js");


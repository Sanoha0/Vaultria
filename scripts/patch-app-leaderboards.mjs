import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const appPath = path.join(root, "src", "app.js");

let txt = fs.readFileSync(appPath, "utf8");

const startNeedle = "body.innerHTML = rows.map((u, idx) => {";
const start = txt.indexOf(startNeedle);
if (start < 0) {
  console.error("[patch-app-leaderboards] Could not find leaderboard map start.");
  process.exit(1);
}

const endNeedle = "}).join(\"\");";
const end = txt.indexOf(endNeedle, start);
if (end < 0) {
  console.error("[patch-app-leaderboards] Could not find leaderboard map end.");
  process.exit(1);
}

const block = txt.slice(start, end + endNeedle.length);

let newBlock = block;

// Insert momentum percent calculation after `ua` line if not present.
if (!newBlock.includes("const mPct")) {
  newBlock = newBlock.replace(
    /const ua\\s*=\\s*[^\\n]*\\n/,
    (m) =>
      m +
      "        const medal = rank;\n" +
      "        const mc    = rank <= 3 ? \"var(--text-primary)\" : \"var(--text-muted)\";\n" +
      "        const mScore = u.momentum?.score ?? 0;\n" +
      "        const mPct   = Math.round((Math.log10(1 + Math.max(0, mScore)) / Math.log10(1001)) * 100);\n"
  );
  // Remove old medal/mc lines if they still exist later.
  newBlock = newBlock.replace(/\\n\\s*const medal[^\\n]*\\n\\s*const mc\\s*=\\s*[^\\n]*\\n/, "\n");
}

// Replace streak display in leaderboard row to momentum percent.
newBlock = newBlock.replaceAll("${u.streak||0}Momentum", "${mPct}%");

// Replace any medal emojis left by using numeric rank.
newBlock = newBlock.replace(/const medal\\s*=\\s*[^\\n]*\\n/, "        const medal = rank;\n");

// Swap medal colors to a non-gamified palette.
newBlock = newBlock.replace(
  /const mc\\s*=\\s*[^\\n]*\\n/,
  "        const mc    = rank <= 3 ? \"var(--text-primary)\" : \"var(--text-muted)\";\n"
);

txt = txt.slice(0, start) + newBlock + txt.slice(end + endNeedle.length);

fs.writeFileSync(appPath, txt, "utf8");
console.log("[patch-app-leaderboards] Updated src/app.js");


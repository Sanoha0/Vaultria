import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const appPath = path.join(root, "src", "app.js");
let txt = fs.readFileSync(appPath, "utf8");

const startNeedle = "const PLAZA_CATEGORIES = [";
const start = txt.indexOf(startNeedle);
if (start < 0) {
  console.error("[patch-app-plaza-icons] Could not find PLAZA_CATEGORIES start.");
  process.exit(1);
}
const end = txt.indexOf("];", start);
if (end < 0) {
  console.error("[patch-app-plaza-icons] Could not find PLAZA_CATEGORIES end.");
  process.exit(1);
}

const before = txt.slice(0, start);
const after = txt.slice(end + 2);

const replacement =
  `const PLAZA_CATEGORIES = [\n` +
  `  { id:\"question\",    label:\"Question\",    icon:\"help\",     color:\"#a78bfa\" },\n` +
  `  { id:\"discussion\",  label:\"Discussion\",  icon:\"chat\",     color:\"#4db8ff\" },\n` +
  `  { id:\"tip\",         label:\"Tip\",         icon:\"spark\",    color:\"#fbbf24\" },\n` +
  `  { id:\"meme\",        label:\"Humor\",       icon:\"smile\",    color:\"#4ade80\" },\n` +
  `  { id:\"progress\",    label:\"Progress\",    icon:\"medal\",    color:\"#f472b6\" },\n` +
  `  { id:\"resource\",    label:\"Resource\",    icon:\"book\",     color:\"#e8a44a\" },\n` +
  `];\n\n` +
  `function _plazaIconSvg(kind, color) {\n` +
  `  const common = \`fill=\"none\" stroke=\"\${color}\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"\`;\n` +
  `  if (kind === \"help\")  return \`<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" \${common}><path d=\"M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4\"/><path d=\"M12 17h.01\"/><circle cx=\"12\" cy=\"12\" r=\"10\"/></svg>\`;\n` +
  `  if (kind === \"chat\")  return \`<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" \${common}><path d=\"M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z\"/></svg>\`;\n` +
  `  if (kind === \"spark\") return \`<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" \${common}><path d=\"M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z\"/></svg>\`;\n` +
  `  if (kind === \"smile\") return \`<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" \${common}><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M8 14s1.5 2 4 2 4-2 4-2\"/><path d=\"M9 9h.01\"/><path d=\"M15 9h.01\"/></svg>\`;\n` +
  `  if (kind === \"medal\") return \`<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" \${common}><path d=\"M7 2h10l-2 7H9z\"/><circle cx=\"12\" cy=\"14\" r=\"5\"/><path d=\"M12 11v3\"/><path d=\"M10.5 13.5h3\"/></svg>\`;\n` +
  `  if (kind === \"book\")  return \`<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" \${common}><path d=\"M4 19a2 2 0 0 0 2 2h14\"/><path d=\"M6 17V5a2 2 0 0 1 2-2h12v18H8a2 2 0 0 1-2-2z\"/></svg>\`;\n` +
  `  return \"\";\n` +
  `}\n`;

txt = before + replacement + after;

fs.writeFileSync(appPath, txt, "utf8");
console.log("[patch-app-plaza-icons] Updated src/app.js");

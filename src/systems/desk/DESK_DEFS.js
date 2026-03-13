/**
 * Vaultria — DESK_DEFS
 * Profile Board desk material themes and artifact catalog.
 */

export const DESK_MATERIALS = {
  walnut: {
    label:       "Polished Walnut",
    surface:     "linear-gradient(160deg,#5c3d1e 0%,#7a4f2a 40%,#6b4520 100%)",
    edgeColor:   "#3d2510",
    textColor:   "rgba(255,220,170,0.7)",
    unlockedBy:  null,
  },
  marble: {
    label:       "White Marble",
    surface:     "linear-gradient(135deg,#f0f0ec 0%,#e8e4de 50%,#f4f2ee 100%)",
    edgeColor:   "#c8c4be",
    textColor:   "rgba(80,60,40,0.7)",
    unlockedBy:  "rewards.desk_marble",
  },
  carbon: {
    label:       "Carbon Fiber",
    surface:     "repeating-linear-gradient(45deg,#1a1a1a 0px,#1a1a1a 2px,#222 2px,#222 4px)",
    edgeColor:   "#0a0a0a",
    textColor:   "rgba(180,200,220,0.6)",
    unlockedBy:  "rewards.desk_carbon",
  },
  tatami: {
    label:       "Traditional Tatami",
    surface:     "repeating-linear-gradient(0deg,#8b7d5a 0px,#8b7d5a 8px,#7a6c4a 8px,#7a6c4a 16px)",
    edgeColor:   "#5a4a2a",
    textColor:   "rgba(240,220,180,0.7)",
    unlockedBy:  "rewards.desk_tatami",
  },
};

export const ARTIFACT_CATALOG = {
  // ── Seals (one per language × stage) ────────────────────────────
  seal_ja_starter:     { type:"seal",   lang:"japanese", stage:"starter",    size:1, label:"Starter Seal (JA)" },
  seal_ja_beginner:    { type:"seal",   lang:"japanese", stage:"beginner",   size:1, label:"Beginner Seal (JA)" },
  seal_ja_explorer:    { type:"seal",   lang:"japanese", stage:"explorer",   size:1, label:"Explorer Seal (JA)" },
  seal_ja_speaker:     { type:"seal",   lang:"japanese", stage:"speaker",    size:1, label:"Speaker Seal (JA)" },
  seal_ja_scholar:     { type:"seal",   lang:"japanese", stage:"scholar",    size:1, label:"Scholar Seal (JA)" },
  seal_ja_strategist:  { type:"seal",   lang:"japanese", stage:"strategist", size:1, label:"Strategist Seal (JA)" },
  seal_ja_specialist:  { type:"seal",   lang:"japanese", stage:"specialist", size:1, label:"Specialist Seal (JA)" },
  seal_ja_archivist:   { type:"seal",   lang:"japanese", stage:"archivist",  size:1, label:"Archivist Seal (JA)" },

  seal_es_starter:     { type:"seal",   lang:"spanish",  stage:"starter",    size:1, label:"Starter Seal (ES)" },
  seal_es_beginner:    { type:"seal",   lang:"spanish",  stage:"beginner",   size:1, label:"Beginner Seal (ES)" },
  seal_es_explorer:    { type:"seal",   lang:"spanish",  stage:"explorer",   size:1, label:"Explorer Seal (ES)" },
  seal_es_speaker:     { type:"seal",   lang:"spanish",  stage:"speaker",    size:1, label:"Speaker Seal (ES)" },
  seal_es_scholar:     { type:"seal",   lang:"spanish",  stage:"scholar",    size:1, label:"Scholar Seal (ES)" },
  seal_es_strategist:  { type:"seal",   lang:"spanish",  stage:"strategist", size:1, label:"Strategist Seal (ES)" },
  seal_es_specialist:  { type:"seal",   lang:"spanish",  stage:"specialist", size:1, label:"Specialist Seal (ES)" },
  seal_es_archivist:   { type:"seal",   lang:"spanish",  stage:"archivist",  size:1, label:"Archivist Seal (ES)" },

  seal_ko_starter:     { type:"seal",   lang:"korean",   stage:"starter",    size:1, label:"Starter Seal (KO)" },
  seal_ko_beginner:    { type:"seal",   lang:"korean",   stage:"beginner",   size:1, label:"Beginner Seal (KO)" },
  seal_ko_explorer:    { type:"seal",   lang:"korean",   stage:"explorer",   size:1, label:"Explorer Seal (KO)" },
  seal_ko_speaker:     { type:"seal",   lang:"korean",   stage:"speaker",    size:1, label:"Speaker Seal (KO)" },
  seal_ko_scholar:     { type:"seal",   lang:"korean",   stage:"scholar",    size:1, label:"Scholar Seal (KO)" },
  seal_ko_strategist:  { type:"seal",   lang:"korean",   stage:"strategist", size:1, label:"Strategist Seal (KO)" },
  seal_ko_specialist:  { type:"seal",   lang:"korean",   stage:"specialist", size:1, label:"Specialist Seal (KO)" },
  seal_ko_archivist:   { type:"seal",   lang:"korean",   stage:"archivist",  size:1, label:"Archivist Seal (KO)" },

  // ── Trophies ─────────────────────────────────────────────────────
  trophy_first_arena:  { type:"trophy", icon:"arena",  size:1, label:"First Arena Win" },
  trophy_100_sessions: { type:"trophy", icon:"scroll", size:1, label:"100 Study Sessions" },
  trophy_plaza_helper: { type:"trophy", icon:"people", size:1, label:"Community Helper" },

  // ── Chronicle reward items ───────────────────────────────────────
  item_silver_pen:     { type:"item",   icon:"pen",   size:1, label:"The Silver Pen" },
  item_soundscape:     { type:"item",   icon:"waves", size:1, label:"Study Soundscape" },
};

// Default layout grid coordinates for auto-placed seals
export const GRID_COLS = 8;
export const GRID_ROWS = 3;
export const CELL_SIZE = 72; // px

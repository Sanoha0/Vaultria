/**
 * Vaultria — Trophy Definitions
 * Each entry has: id, name, icon, desc, tier, check({ progress, allProgress, profile })
 * Tiers: bronze · silver · gold · plat
 */

export const TIER_STYLE = {
  bronze: { color: "#cd7c2f", glow: "rgba(205,124,47,0.22)",  label: "Bronze"   },
  silver: { color: "#94a3b8", glow: "rgba(148,163,184,0.22)", label: "Silver"   },
  gold:   { color: "#fbbf24", glow: "rgba(251,191,36,0.22)",  label: "Gold"     },
  plat:   { color: "#a0d8ef", glow: "rgba(160,216,239,0.22)", label: "Platinum" },
};

export const TROPHY_DEFS = [

  // ── Lessons ────────────────────────────────────────────────────────
  {
    id: "first_lesson",
    name: "First Step",
    icon: "📖",
    desc: "Complete your very first lesson",
    tier: "bronze",
    check: ({ allProgress }) =>
      Object.values(allProgress || {}).reduce((s, p) => s + (p.completed?.length || 0), 0) >= 1,
  },
  {
    id: "lessons_10",
    name: "Apprentice",
    icon: "🏅",
    desc: "Complete 10 lessons",
    tier: "bronze",
    check: ({ allProgress }) =>
      Object.values(allProgress || {}).reduce((s, p) => s + (p.completed?.length || 0), 0) >= 10,
  },
  {
    id: "lessons_50",
    name: "Scholar",
    icon: "🎓",
    desc: "Complete 50 lessons across all languages",
    tier: "silver",
    check: ({ allProgress }) =>
      Object.values(allProgress || {}).reduce((s, p) => s + (p.completed?.length || 0), 0) >= 50,
  },
  {
    id: "lessons_100",
    name: "Century Mark",
    icon: "💯",
    desc: "Complete 100 lessons — a true devotee",
    tier: "gold",
    check: ({ allProgress }) =>
      Object.values(allProgress || {}).reduce((s, p) => s + (p.completed?.length || 0), 0) >= 100,
  },

  // ── XP ─────────────────────────────────────────────────────────────
  {
    id: "xp_500",
    name: "Dedicated",
    icon: "⭐",
    desc: "Accumulate 500 total XP",
    tier: "bronze",
    check: ({ allProgress }) =>
      Object.values(allProgress || {}).reduce((s, p) => s + (p.xp || 0), 0) >= 500,
  },
  {
    id: "xp_2000",
    name: "Archivist",
    icon: "🗝️",
    desc: "Accumulate 2,000 total XP",
    tier: "silver",
    check: ({ allProgress }) =>
      Object.values(allProgress || {}).reduce((s, p) => s + (p.xp || 0), 0) >= 2000,
  },
  {
    id: "xp_10000",
    name: "Grand Archivist",
    icon: "🏆",
    desc: "Accumulate 10,000 total XP — legendary status",
    tier: "gold",
    check: ({ allProgress }) =>
      Object.values(allProgress || {}).reduce((s, p) => s + (p.xp || 0), 0) >= 10000,
  },

  // ── Levels ─────────────────────────────────────────────────────────
  {
    id: "level_5",
    name: "Rising",
    icon: "⬆️",
    desc: "Reach level 5 in any language",
    tier: "bronze",
    check: ({ allProgress }) =>
      Object.values(allProgress || {}).some(p => Math.floor((p.xp || 0) / 200) + 1 >= 5),
  },
  {
    id: "level_10",
    name: "Established",
    icon: "🌟",
    desc: "Reach level 10 in any language",
    tier: "silver",
    check: ({ allProgress }) =>
      Object.values(allProgress || {}).some(p => Math.floor((p.xp || 0) / 200) + 1 >= 10),
  },
  {
    id: "level_25",
    name: "Ascendant",
    icon: "✨",
    desc: "Reach level 25 — mastery begins here",
    tier: "gold",
    check: ({ allProgress }) =>
      Object.values(allProgress || {}).some(p => Math.floor((p.xp || 0) / 200) + 1 >= 25),
  },

  // ── Momentum ───────────────────────────────────────────────────────
  {
    id: "momentum_50",
    name: "In the Flow",
    icon: "🔥",
    desc: "Achieve 50%+ momentum",
    tier: "bronze",
    check: ({ profile }) => (profile?.momentum?.score || 0) >= 50,
  },
  {
    id: "momentum_80",
    name: "Flow State",
    icon: "⚡",
    desc: "Achieve 80%+ momentum — peak performance",
    tier: "silver",
    check: ({ profile }) => (profile?.momentum?.score || 0) >= 80,
  },
  {
    id: "momentum_100",
    name: "Transcendence",
    icon: "🌙",
    desc: "Reach 100% momentum — perfect, sustained form",
    tier: "gold",
    check: ({ profile }) => (profile?.momentum?.score || 0) >= 100,
  },

  // ── Seals ──────────────────────────────────────────────────────────
  {
    id: "seal_any",
    name: "First Seal",
    icon: "🔖",
    desc: "Earn your first stage seal in any language",
    tier: "bronze",
    check: ({ profile }) =>
      Object.values(profile?.seals || {}).some(arr => arr.length > 0),
  },
  {
    id: "seal_beginner",
    name: "Seal: Beginner",
    icon: "📌",
    desc: "Earn the Beginner stage seal in any language",
    tier: "silver",
    check: ({ profile }) =>
      Object.values(profile?.seals || {}).some(arr => arr.includes("beginner")),
  },

  // ── Social / Misc ──────────────────────────────────────────────────
  {
    id: "multilingual",
    name: "Polyglot",
    icon: "🌍",
    desc: "Actively study 2 or more languages",
    tier: "silver",
    check: ({ allProgress }) =>
      Object.values(allProgress || {}).filter(p => (p.xp || 0) > 0).length >= 2,
  },
  {
    id: "chronicle_first",
    name: "Chronicles Begin",
    icon: "📜",
    desc: "Claim your first Chronicle milestone reward",
    tier: "silver",
    check: ({ profile }) => (profile?.claimedMilestones?.length || 0) >= 1,
  },
  {
    id: "prestige_1",
    name: "Prestige",
    icon: "👑",
    desc: "Reach Prestige rank — you have gone beyond the ordinary",
    tier: "gold",
    check: ({ profile }) =>
      Object.values(profile?.prestige || {}).some(p => (p.rank || 0) >= 1),
  },
];

/**
 * Compute which trophies a user has earned.
 * @param {{ progress: Object, allProgress: Object, profile: Object }} data
 * @returns {Array} earned trophy definitions
 */
export function computeEarned(data) {
  return TROPHY_DEFS.filter(t => {
    try { return t.check(data); } catch { return false; }
  });
}

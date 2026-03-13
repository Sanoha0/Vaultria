/**
 * Vaultria — SEAL_DEFS
 * Material definitions for all 8 stage seals.
 */

export const SEAL_DEFS = {
  starter: {
    label: "Starter", material: "Bronze",
    baseColor: "#cd7f32", hiColor: "#e8a96e", shadowColor: "#7a4420",
    accent: "rgba(100,180,140,0.35)", filter: "seal-filter-bronze",
    shimmer: null, motif: "notch-ring", pulse: false, starfield: false,
  },
  beginner: {
    label: "Beginner", material: "Copper",
    baseColor: "#b87333", hiColor: "#d4956a", shadowColor: "#6b3a1f",
    accent: "rgba(200,140,80,0.2)", filter: "seal-filter-copper",
    shimmer: "shimmer-slow", motif: "gear-ring", pulse: false, starfield: false,
  },
  explorer: {
    label: "Explorer", material: "Silver",
    baseColor: "#8e9cb0", hiColor: "#d0e8f8", shadowColor: "#3a4a5a",
    accent: "rgba(180,220,255,0.3)", filter: "seal-filter-silver",
    shimmer: "shimmer-chrome", motif: "compass-ring", pulse: false, starfield: false,
  },
  speaker: {
    label: "Speaker", material: "Gold",
    baseColor: "#c9a84c", hiColor: "#f0d070", shadowColor: "#7a5a1a",
    accent: "rgba(255,240,140,0.25)", filter: "seal-filter-gold",
    shimmer: "shimmer-gold", motif: "laurel-ring", pulse: false, starfield: false,
  },
  scholar: {
    label: "Scholar", material: "Sapphire",
    baseColor: "#1a4a8a", hiColor: "#5090e0", shadowColor: "#0a1a3a",
    accent: "rgba(100,180,255,0.4)", filter: "seal-filter-crystal",
    shimmer: "shimmer-crystal", motif: "hex-ring", pulse: true, starfield: false,
  },
  strategist: {
    label: "Strategist", material: "Amethyst",
    baseColor: "#6a1a8a", hiColor: "#c084fc", shadowColor: "#2a0a3a",
    accent: "rgba(180,100,255,0.45)", filter: "seal-filter-crystal",
    shimmer: "shimmer-amethyst", motif: "arc-ring", pulse: true, starfield: false,
  },
  specialist: {
    label: "Specialist", material: "Platinum",
    baseColor: "#c8d0d8", hiColor: "#ffffff", shadowColor: "#707880",
    accent: "rgba(220,240,255,0.5)", filter: "seal-filter-iridescent",
    shimmer: "shimmer-iridescent", motif: "weave-ring", pulse: true, starfield: false,
  },
  archivist: {
    label: "Archivist", material: "Obsidian",
    baseColor: "#1a1a22", hiColor: "#4a4a5a", shadowColor: "#050508",
    accent: "rgba(100,100,180,0.3)", filter: "seal-filter-obsidian",
    shimmer: "shimmer-starfield", motif: "void-ring", pulse: true, starfield: true,
  },
};

export const STAGE_ORDER = [
  "starter","beginner","explorer","speaker",
  "scholar","strategist","specialist","archivist",
];

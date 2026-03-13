/**
 * Vaultria — FAMILIAR_DEFS
 * SVG body paths and material tier definitions for all 4 Familiar species.
 */

export const SPECIES = {
  fox: {
    label:    "Fox",
    color:    "#c9a46a",
    accent:   "#e8c99a",
    svgBody: `
      <polygon points="6,14 10,6 13,14"  class="fam-body"/>
      <polygon points="11,14 15,6 18,14" class="fam-body"/>
      <polygon points="7,13 10,8 12,13"  class="fam-accent" opacity="0.6"/>
      <polygon points="12,13 15,8 17,13" class="fam-accent" opacity="0.6"/>
      <ellipse cx="12" cy="19" rx="7" ry="6" class="fam-body"/>
      <ellipse cx="12" cy="21" rx="3.5" ry="2.5" class="fam-accent" opacity="0.5"/>
      <ellipse cx="9.5"  cy="18" rx="1.2" ry="1.4" class="fam-eye"/>
      <ellipse cx="14.5" cy="18" rx="1.2" ry="1.4" class="fam-eye"/>
      <circle  cx="12"   cy="21.5" r="0.7" class="fam-dark"/>`,
    reactions: { speed: "bob", accuracy: "tail-wag", achieve: "ear-twitch", momentum: "ear-twitch" },
    idleSet:   ["breathe","look-left","look-right","ear-twitch"],
  },
  cat: {
    label:    "Cat",
    color:    "#b8a090",
    accent:   "#d4c0b0",
    svgBody: `
      <polygon points="5,13 8,5  11,13" class="fam-body"/>
      <polygon points="13,13 16,5 19,13" class="fam-body"/>
      <polygon points="6,12 8,7  10,12"  class="fam-accent" opacity="0.5"/>
      <polygon points="14,12 16,7 18,12" class="fam-accent" opacity="0.5"/>
      <circle  cx="12" cy="19" r="7" class="fam-body"/>
      <ellipse cx="7"  cy="20" rx="2.5" ry="1.5" class="fam-accent" opacity="0.3"/>
      <ellipse cx="17" cy="20" rx="2.5" ry="1.5" class="fam-accent" opacity="0.3"/>
      <ellipse cx="9.5"  cy="18.5" rx="1.5" ry="1.1" class="fam-eye"/>
      <ellipse cx="14.5" cy="18.5" rx="1.5" ry="1.1" class="fam-eye"/>
      <ellipse cx="9.5"  cy="18.5" rx="0.6" ry="0.9" class="fam-dark"/>
      <ellipse cx="14.5" cy="18.5" rx="0.6" ry="0.9" class="fam-dark"/>
      <path d="M11.5,21 L12,21.5 L12.5,21" stroke-width="0.6"
            class="fam-dark-stroke" fill="none" stroke-linecap="round"/>`,
    reactions: { accuracy: "slow-blink", achieve: "slow-blink" },
    idleSet:   ["breathe","slow-blink","look-left","look-right"],
  },
  wolf: {
    label:    "Wolf",
    color:    "#8a9aaa",
    accent:   "#b0c0cc",
    svgBody: `
      <polygon points="5,12 9,4  12,12"  class="fam-body"/>
      <polygon points="12,12 15,4 19,12" class="fam-body"/>
      <polygon points="6,11 9,6  11,11"  class="fam-accent" opacity="0.4"/>
      <polygon points="13,11 15,6 18,11" class="fam-accent" opacity="0.4"/>
      <path d="M5,18 Q5,25 12,26 Q19,25 19,18 L17,13 L12,12 L7,13 Z" class="fam-body"/>
      <ellipse cx="12" cy="22" rx="4" ry="2.5" class="fam-accent" opacity="0.45"/>
      <ellipse cx="9.5"  cy="17.8" rx="1.3" ry="1.0" class="fam-eye"/>
      <ellipse cx="14.5" cy="17.8" rx="1.3" ry="1.0" class="fam-eye"/>
      <circle  cx="9.5"  cy="17.8" r="0.6" class="fam-dark"/>
      <circle  cx="14.5" cy="17.8" r="0.6" class="fam-dark"/>`,
    reactions: { momentum: "alert-stand", achieve: "alert-stand" },
    idleSet:   ["breathe","look-left","look-right","breathe"],
  },
  crane: {
    label:    "Crane",
    color:    "#dce8f0",
    accent:   "#f0f8ff",
    svgBody: `
      <path d="M12,26 Q10,20 9,14 Q8,8 12,5 Q16,8 15,14 Q14,20 12,26 Z" class="fam-body"/>
      <circle  cx="12"  cy="5"  r="3.5" class="fam-body"/>
      <ellipse cx="12"  cy="3"  rx="2"  ry="1.2" fill="#e53e3e" opacity="0.9"/>
      <path d="M15.5,5 L19,5.5 L15.5,6" class="fam-dark"/>
      <path d="M6,18 Q8,16 10,17 Q8,20 6,18Z"  class="fam-body" opacity="0.7"/>
      <path d="M18,18 Q16,16 14,17 Q16,20 18,18Z" class="fam-body" opacity="0.7"/>
      <circle cx="13.5" cy="5" r="0.8" class="fam-dark"/>`,
    reactions: { reading: "extend-neck", achieve: "extend-neck" },
    idleSet:   ["breathe","look-left","breathe","slow-blink"],
  },
};

export const MATERIAL_TIERS = {
  0: {
    label:      "Natural",
    bodyFill:   "var(--fam-color, #c9a46a)",
    accentFill: "var(--fam-accent, #e8c99a)",
    darkFill:   "#2a1a0a",
    eyeFill:    "#ffffff",
    filter:     "none",
    animClass:  "",
  },
  1: {
    label:      "Smoked Glass",
    bodyFill:   "rgba(60,70,90,0.75)",
    accentFill: "rgba(120,140,180,0.5)",
    darkFill:   "rgba(10,15,25,0.9)",
    eyeFill:    "rgba(200,220,255,0.9)",
    filter:     "drop-shadow(0 0 4px rgba(100,150,255,0.4))",
    animClass:  "",
  },
  3: {
    label:      "Polished Jade",
    bodyFill:   "#1a7a4a",
    accentFill: "#4db87a",
    darkFill:   "#0a2a1a",
    eyeFill:    "#d4f0e0",
    filter:     "drop-shadow(0 0 5px rgba(50,200,100,0.35))",
    animClass:  "",
  },
  5: {
    label:      "Living Ink",
    bodyFill:   "#0a0a14",
    accentFill: "#3a1a6a",
    darkFill:   "#000005",
    eyeFill:    "#c084fc",
    filter:     "drop-shadow(0 0 6px rgba(180,100,255,0.5))",
    animClass:  "fam-material-ink",
  },
  8: {
    label:      "Celestial Silhouette",
    bodyFill:   "#000010",
    accentFill: "rgba(180,200,255,0.15)",
    darkFill:   "#000005",
    eyeFill:    "#ffffff",
    filter:     "drop-shadow(0 0 12px rgba(200,220,255,0.7))",
    animClass:  "fam-material-celestial",
  },
};

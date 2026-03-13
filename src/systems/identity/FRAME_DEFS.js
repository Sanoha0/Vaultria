/**
 * Vaultria — FRAME_DEFS
 * Avatar frame definitions. Each frame produces an SVG overlay.
 * `build(size)` returns an SVG string sized to the given pixel dimension.
 */

export const FRAME_DEFS = {
  default: {
    label:       "Default",
    unlockedBy:  null,
    build:       () => "",   // no frame
  },
  ink: {
    label:       "Scholar",
    unlockedBy:  "rewards.frame_ink",
    build: (size) => {
      const half = size / 2;
      const r    = half - 2;
      const dots = Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * 2 * Math.PI;
        const x = (half + r * Math.cos(a)).toFixed(2);
        const y = (half + r * Math.sin(a)).toFixed(2);
        const dur = (10 + i * 1.5).toFixed(1);
        return `<circle cx="${x}" cy="${y}" r="1.8" fill="rgba(60,30,10,0.65)">
          <animateTransform attributeName="transform" type="rotate"
            from="0 ${half} ${half}" to="360 ${half} ${half}"
            dur="${dur}s" repeatCount="indefinite"/>
        </circle>`;
      }).join("");
      return `<svg class="avatar-frame frame-ink"
                   xmlns="http://www.w3.org/2000/svg"
                   width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"
                   style="position:absolute;inset:0;pointer-events:none;overflow:visible;"
                   aria-hidden="true">
        <circle cx="${half}" cy="${half}" r="${r}"
                fill="none" stroke="rgba(80,50,20,0.55)" stroke-width="1.8"/>
        ${dots}
      </svg>`;
    },
  },
  neon: {
    label:       "Neon",
    unlockedBy:  "rewards.frame_neon",
    build: (size) => {
      const half     = size / 2;
      const r        = half - 2;
      const segCount = 16;
      const segs     = Array.from({ length: segCount }, (_, i) => {
        const a1  = (i / segCount) * 2 * Math.PI - Math.PI / 2;
        const a2  = ((i + 0.68) / segCount) * 2 * Math.PI - Math.PI / 2;
        const x1  = (half + r * Math.cos(a1)).toFixed(2);
        const y1  = (half + r * Math.sin(a1)).toFixed(2);
        const x2  = (half + r * Math.cos(a2)).toFixed(2);
        const y2  = (half + r * Math.sin(a2)).toFixed(2);
        const dly = (i * 0.15).toFixed(2);
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
                      stroke="#22d3ee" stroke-width="1.8" stroke-linecap="round" opacity="0.85">
          <animate attributeName="opacity" values="0.85;0.2;0.85"
                   dur="2.6s" begin="${dly}s" repeatCount="indefinite"/>
        </line>`;
      }).join("");
      return `<svg class="avatar-frame frame-neon"
                   xmlns="http://www.w3.org/2000/svg"
                   width="${size + 8}" height="${size + 8}"
                   viewBox="0 0 ${size + 8} ${size + 8}"
                   style="position:absolute;inset:-4px;pointer-events:none;overflow:visible;"
                   aria-hidden="true">
        ${segs}
      </svg>`;
    },
  },
  ceramic: {
    label:       "Ceramic",
    unlockedBy:  "rewards.frame_ceramic",
    build: (size) => {
      const half = size / 2;
      const r    = half - 1;
      return `<svg class="avatar-frame frame-ceramic"
                   xmlns="http://www.w3.org/2000/svg"
                   width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"
                   style="position:absolute;inset:0;pointer-events:none;overflow:visible;"
                   aria-hidden="true">
        <defs>
          <linearGradient id="ceramic-g-${size}" x1="0" y1="0" x2="1" y2="1"
                          gradientUnits="objectBoundingBox">
            <stop offset="0%"   stop-color="#b45309"/>
            <stop offset="50%"  stop-color="#1d4ed8"/>
            <stop offset="100%" stop-color="#b45309"/>
          </linearGradient>
        </defs>
        <circle cx="${half}" cy="${half}" r="${r}"
                fill="none"
                stroke="url(#ceramic-g-${size})"
                stroke-width="3.5"
                stroke-dasharray="6 3"
                stroke-linecap="round"/>
      </svg>`;
    },
  },
  prestige_vi: {
    label:       "Prestige VI",
    unlockedBy:  "prestige_rank_6",
    build: (size) => {
      const half = size / 2;
      const r    = half - 2;
      return `<svg class="avatar-frame frame-prestige"
                   xmlns="http://www.w3.org/2000/svg"
                   width="${size + 8}" height="${size + 8}"
                   viewBox="0 0 ${size + 8} ${size + 8}"
                   style="position:absolute;inset:-4px;pointer-events:none;overflow:visible;"
                   aria-hidden="true">
        <defs>
          <filter id="pf-glow-${size}" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <linearGradient id="pf-grad-${size}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stop-color="#c8d0d8"/>
            <stop offset="50%"  stop-color="#ffffff"/>
            <stop offset="100%" stop-color="#a0b0c0"/>
            <animateTransform attributeName="gradientTransform" type="rotate"
              from="0 0.5 0.5" to="360 0.5 0.5" dur="8s" repeatCount="indefinite"/>
          </linearGradient>
        </defs>
        <circle cx="${half + 4}" cy="${half + 4}" r="${r}"
                fill="none"
                stroke="url(#pf-grad-${size})"
                stroke-width="2"
                filter="url(#pf-glow-${size})"/>
      </svg>`;
    },
  },
};

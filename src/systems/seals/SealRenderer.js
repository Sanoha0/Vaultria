/**
 * Vaultria — SealRenderer
 * Generates inline SVG seals for any stage key.
 *
 * Usage:
 *   import { renderSeal, mountSealFilters } from "./SealRenderer.js";
 *   mountSealFilters();            // call once on app init
 *   el.innerHTML = renderSeal("scholar", 48);
 */

import { SEAL_DEFS } from "./SEAL_DEFS.js";

let _filtersMounted = false;

export function mountSealFilters() {
  if (_filtersMounted || typeof document === "undefined") return;
  _filtersMounted = true;
  const svg = document.createElement("svg");
  svg.setAttribute("aria-hidden", "true");
  svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;";
  svg.innerHTML = `
    <defs>
      <!-- Shared blur for drop shadow -->
      <filter id="seal-blur-2" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2"/>
      </filter>

      <!-- Bronze: warm tone + verdigris noise overlay -->
      <filter id="seal-filter-bronze" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" result="noise"/>
        <feColorMatrix type="saturate" values="0.6" in="noise" result="toned"/>
        <feBlend in="SourceGraphic" in2="toned" mode="multiply" result="blended"/>
        <feComponentTransfer in="blended">
          <feFuncR type="linear" slope="1.1" intercept="-0.05"/>
          <feFuncG type="linear" slope="0.9"/>
        </feComponentTransfer>
      </filter>

      <!-- Copper: warm orange, brushed texture -->
      <filter id="seal-filter-copper" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" result="noise"/>
        <feBlend in="SourceGraphic" in2="noise" mode="soft-light"/>
        <feComponentTransfer>
          <feFuncR type="linear" slope="1.15" intercept="-0.05"/>
          <feFuncB type="linear" slope="0.7"/>
        </feComponentTransfer>
      </filter>

      <!-- Silver: sharp chrome with highlight -->
      <filter id="seal-filter-silver" color-interpolation-filters="sRGB">
        <feConvolveMatrix order="3" kernelMatrix="0 -1 0 -1 5 -1 0 -1 0" result="sharp"/>
        <feBlend in="SourceGraphic" in2="sharp" mode="screen" result="blend"/>
        <feComponentTransfer in="blend">
          <feFuncR type="linear" slope="1.2" intercept="-0.1"/>
          <feFuncG type="linear" slope="1.1"/>
          <feFuncB type="linear" slope="1.3"/>
        </feComponentTransfer>
      </filter>

      <!-- Gold: warm glow -->
      <filter id="seal-filter-gold" color-interpolation-filters="sRGB">
        <feGaussianBlur stdDeviation="0.4" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        <feComponentTransfer>
          <feFuncR type="linear" slope="1.2"/>
          <feFuncG type="linear" slope="1.05"/>
          <feFuncB type="linear" slope="0.7"/>
        </feComponentTransfer>
      </filter>

      <!-- Crystal: inner glow (sapphire / amethyst) -->
      <filter id="seal-filter-crystal" color-interpolation-filters="sRGB"
              x="-25%" y="-25%" width="150%" height="150%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="shadow"/>
        <feFlood flood-color="rgba(120,180,255,0.35)" result="flood"/>
        <feComposite in="flood" in2="shadow" operator="in" result="glow"/>
        <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>

      <!-- Iridescent (Platinum): animated hue-rotate -->
      <filter id="seal-filter-iridescent" color-interpolation-filters="sRGB"
              x="-25%" y="-25%" width="150%" height="150%">
        <feColorMatrix type="hueRotate" values="0">
          <animate attributeName="values" from="0" to="360" dur="6s" repeatCount="indefinite"/>
        </feColorMatrix>
        <feGaussianBlur stdDeviation="0.3" result="soft"/>
        <feMerge><feMergeNode in="soft"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>

      <!-- Obsidian: dark inner glow -->
      <filter id="seal-filter-obsidian" color-interpolation-filters="sRGB"
              x="-25%" y="-25%" width="150%" height="150%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="shadow"/>
        <feFlood flood-color="rgba(40,40,100,0.65)" result="dark"/>
        <feComposite in="dark" in2="shadow" operator="in" result="inner"/>
        <feMerge><feMergeNode in="inner"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>`;
  document.body.appendChild(svg);
}

// ── Numerals map ──────────────────────────────────────────────────
const NUMERALS = {
  starter:"I", beginner:"II", explorer:"III", speaker:"IV",
  scholar:"V", strategist:"VI", specialist:"VII", archivist:"VIII",
};

// ── Public render function ────────────────────────────────────────
export function renderSeal(stageKey, size = 48, animated = true) {
  const def = SEAL_DEFS[stageKey];
  if (!def) return "";

  const half    = size / 2;
  const outerR  = half - 2;
  const innerR  = outerR - 6;
  const pulseId = `sp-${stageKey}-${size}`;

  return `
<svg class="seal seal-${stageKey}${def.pulse && animated ? " seal-pulsing" : ""}"
     width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"
     xmlns="http://www.w3.org/2000/svg"
     role="img" aria-label="${def.label} Seal — ${def.material}">
  <defs>
    ${def.pulse && animated ? `
    <radialGradient id="${pulseId}" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="${def.accent}" stop-opacity="0.8">
        <animate attributeName="stop-opacity" values="0.8;0.15;0.8"
                 dur="3s" repeatCount="indefinite"/>
      </stop>
      <stop offset="100%" stop-color="${def.accent}" stop-opacity="0"/>
    </radialGradient>` : ""}
  </defs>

  <!-- Drop shadow -->
  <circle cx="${half}" cy="${half + 1.5}" r="${outerR}"
          fill="${def.shadowColor}" opacity="0.55"
          filter="url(#seal-blur-2)"/>

  <!-- Outer decorative ring with notches -->
  <circle cx="${half}" cy="${half}" r="${outerR}"
          fill="none" stroke="${def.hiColor}" stroke-width="1.4"
          opacity="0.5" filter="url(#${def.filter})"/>
  ${_notchMarks(half, outerR, def.hiColor)}

  <!-- Main disc -->
  <circle cx="${half}" cy="${half}" r="${innerR}"
          fill="${def.baseColor}" filter="url(#${def.filter})"/>

  <!-- Inner highlight arc -->
  <path d="M ${(half - innerR*0.55).toFixed(2)} ${(half - innerR*0.45).toFixed(2)}
           A ${(innerR*0.75).toFixed(2)} ${(innerR*0.75).toFixed(2)} 0 0 1
             ${(half + innerR*0.55).toFixed(2)} ${(half - innerR*0.45).toFixed(2)}"
        fill="none" stroke="${def.hiColor}" stroke-width="1.2"
        stroke-linecap="round" opacity="0.55"/>

  <!-- Pulse glow (crystal tiers only) -->
  ${def.pulse && animated ? `<circle cx="${half}" cy="${half}" r="${innerR}" fill="url(#${pulseId})"/>` : ""}

  <!-- Starfield (Archivist only) -->
  ${def.starfield && animated ? _starfield(half, innerR) : ""}

  <!-- Stage numeral -->
  <text x="${half}" y="${(half + size*0.12).toFixed(2)}" text-anchor="middle"
        font-family="var(--font-display)" font-size="${(size * 0.27).toFixed(1)}"
        font-weight="600" fill="${def.hiColor}" opacity="0.92"
        letter-spacing="0.02em">${NUMERALS[stageKey] ?? "?"}</text>
</svg>`;
}

// ── Helpers ───────────────────────────────────────────────────────
function _notchMarks(half, r, color) {
  return Array.from({ length: 8 }, (_, i) => {
    const a  = (i / 8) * 2 * Math.PI - Math.PI / 2;
    const x1 = (half + (r - 1.5) * Math.cos(a)).toFixed(2);
    const y1 = (half + (r - 1.5) * Math.sin(a)).toFixed(2);
    const x2 = (half + (r + 1.5) * Math.cos(a)).toFixed(2);
    const y2 = (half + (r + 1.5) * Math.sin(a)).toFixed(2);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
                  stroke="${color}" stroke-width="1.1" opacity="0.65"/>`;
  }).join("");
}

function _starfield(half, r) {
  return Array.from({ length: 18 }, (_, i) => {
    const angle = (i / 18) * 2 * Math.PI + Math.sin(i * 2.4) * 0.8;
    const dist  = r * (0.2 + (Math.sin(i * 1.7 + 0.3) + 1) / 2 * 0.62);
    const x     = (half + Math.cos(angle) * dist).toFixed(2);
    const y     = (half + Math.sin(angle) * dist).toFixed(2);
    const sr    = (0.4 + Math.abs(Math.sin(i * 3.1)) * 0.75).toFixed(2);
    const delay = (i * 0.4).toFixed(1);
    const dur   = (2 + Math.abs(Math.sin(i)) * 1.5).toFixed(1);
    return `<circle cx="${x}" cy="${y}" r="${sr}" fill="white" opacity="0.55">
      <animate attributeName="opacity" values="0.55;0.08;0.55"
               dur="${dur}s" begin="${delay}s" repeatCount="indefinite"/>
    </circle>`;
  }).join("");
}

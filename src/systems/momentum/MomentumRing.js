/**
 * Vaultria — MomentumRing
 * Wraps any avatar element with the luminous multi-layer SVG Flow Ring.
 *
 * Usage:
 *   const ring = new MomentumRing(avatarEl);
 *   ring.destroy(); // always call on teardown
 */

import { eventBus } from "../../utils/eventBus.js";

const S = 52;                        // SVG canvas size px (must be > avatar)
const R = 21;                        // ring radius
const C = +(2 * Math.PI * R).toFixed(3); // circumference
let   UID = 0;

export class MomentumRing {
  constructor(container) {
    this.container = container;
    this._id       = ++UID;
    this._score    = 0;
    this._handler  = ({ score }) => this.update(score);
    eventBus.on("momentum:updated", this._handler);
    this._mount();
  }

  // ── Build SVG ─────────────────────────────────────────────────────
  _mount() {
    const id = this._id;
    const wrap = document.createElement("div");
    wrap.className = "momentum-ring-wrap";
    wrap.setAttribute("aria-hidden", "true");
    wrap.innerHTML = `
      <svg class="momentum-ring-svg" width="${S}" height="${S}"
           viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="mr-glow-${id}" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <linearGradient id="mr-grad-${id}" gradientUnits="userSpaceOnUse"
                          x1="0" y1="0" x2="${S}" y2="${S}">
            <stop class="mr-stop-a" offset="0%"   stop-color="#4a4a6a"/>
            <stop class="mr-stop-b" offset="100%" stop-color="#6a5a8a"/>
          </linearGradient>
        </defs>

        <!-- Track ring: always visible, very dim -->
        <circle cx="${S/2}" cy="${S/2}" r="${R}"
                fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="2.5"/>

        <!-- Main fill arc -->
        <circle class="mr-fill"
                cx="${S/2}" cy="${S/2}" r="${R}"
                fill="none"
                stroke="url(#mr-grad-${id})"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-dasharray="${C}"
                stroke-dashoffset="${C}"
                transform="rotate(-90 ${S/2} ${S/2})"
                filter="url(#mr-glow-${id})"/>

        <!-- Prism shimmer: visible at >=80 momentum -->
        <circle class="mr-prism"
                cx="${S/2}" cy="${S/2}" r="${R}"
                fill="none"
                stroke="rgba(255,255,255,0.20)"
                stroke-width="1"
                stroke-linecap="round"
                stroke-dasharray="4 ${(C - 4).toFixed(2)}"
                transform="rotate(-90 ${S/2} ${S/2})"
                opacity="0"/>
      </svg>`;

    this.container.style.position = "relative";
    this.container.appendChild(wrap);
    this._wrap  = wrap;
    this._fill  = wrap.querySelector(".mr-fill");
    this._prism = wrap.querySelector(".mr-prism");
    this._stopA = wrap.querySelector(".mr-stop-a");
    this._stopB = wrap.querySelector(".mr-stop-b");
  }

  // ── Update ring visuals ───────────────────────────────────────────
  update(score) {
    this._score = score;
    const offset = C * (1 - score / 100);

    this._fill.style.transition       = "stroke-dashoffset 1.1s cubic-bezier(0.4,0,0.2,1)";
    this._fill.style.strokeDashoffset = offset;

    const prismOp = score >= 80 ? ((score - 80) / 20) * 0.55 : 0;
    this._prism.style.opacity    = prismOp;
    this._prism.style.transition = "opacity 0.8s ease";
    if (prismOp > 0) {
      this._prism.style.animation = "mr-prism-spin 8s linear infinite";
    } else {
      this._prism.style.animation = "none";
    }

    const [ca, cb] = _colorPair(score);
    this._stopA.setAttribute("stop-color", ca);
    this._stopB.setAttribute("stop-color", cb);
  }

  destroy() {
    eventBus.off("momentum:updated", this._handler);
    this._wrap?.remove();
  }
}

// ── Color palette by momentum level ──────────────────────────────
function _colorPair(s) {
  if (s < 40) return [_lerp("#2d2d42","#6366f1", s/40),
                      _lerp("#1e1e2e","#8b5cf6", s/40)];
  if (s < 70) return [_lerp("#6366f1","#a78bfa",(s-40)/30),
                      _lerp("#8b5cf6","#e879f9",(s-40)/30)];
  if (s < 90) return [_lerp("#a78bfa","#f59e0b",(s-70)/20),
                      _lerp("#e879f9","#fbbf24",(s-70)/20)];
              return [_lerp("#f59e0b","#fff7ed",(s-90)/10),
                      _lerp("#fbbf24","#fef3c7",(s-90)/10)];
}

function _lerp(a, b, t) {
  t = Math.max(0, Math.min(1, t));
  const n = (h) => parseInt(h.slice(1), 16);
  const A = n(a), B = n(b);
  const r = Math.round(((A>>16)&255) + (((B>>16)&255)-((A>>16)&255))*t);
  const g = Math.round(((A>>8)&255)  + (((B>>8)&255) -((A>>8)&255)) *t);
  const bl= Math.round((A&255)       + ((B&255)       -(A&255))      *t);
  return "#"+[r,g,bl].map(v=>v.toString(16).padStart(2,"0")).join("");
}

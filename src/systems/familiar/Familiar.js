/**
 * Vaultria — Familiar
 * The calm companion creature. Mounts into any container element.
 * Never visible during exercises — only on dashboard, profile, lesson-complete.
 *
 * Usage:
 *   const fam = new Familiar(containerEl, { species: "fox", materialTier: 0 });
 *   fam.destroy();
 */

import { SPECIES, MATERIAL_TIERS } from "./FAMILIAR_DEFS.js";
import { FamiliarAnimator }         from "./FamiliarAnimator.js";
import { loadProfile }              from "../../services/profileStore.js";

export class Familiar {
  constructor(container, opts = {}) {
    this.container    = container;
    this._species     = opts.species     ?? "fox";
    this._tier        = opts.materialTier ?? 0;
    this._animator    = null;
    this._svgEl       = null;
    this._mount();
  }

  _mount() {
    const def     = SPECIES[this._species] ?? SPECIES.fox;
    const mat     = this._closestTier(this._tier);
    const wrapper = document.createElement("div");
    wrapper.className = "familiar-container";

    wrapper.innerHTML = `
      <svg class="familiar-svg ${mat.animClass}"
           width="72" height="72" viewBox="0 0 24 28"
           xmlns="http://www.w3.org/2000/svg"
           style="
             --fam-color:${def.color};
             --fam-accent:${def.accent};
             filter:${mat.filter};
           ">
        <style>
          .fam-body         { fill: ${mat.bodyFill}; }
          .fam-accent       { fill: ${mat.accentFill}; }
          .fam-dark         { fill: ${mat.darkFill}; }
          .fam-dark-stroke  { stroke: ${mat.darkFill}; }
          .fam-eye          { fill: ${mat.eyeFill}; }
        </style>
        ${def.svgBody}
      </svg>`;

    this.container.appendChild(wrapper);
    this._wrapper = wrapper;
    this._svgEl   = wrapper.querySelector(".familiar-svg");
    this._animator = new FamiliarAnimator(this._svgEl, this._species);
  }

  // ── Update material tier without full remount ─────────────────────
  setMaterialTier(tier) {
    this._tier = tier;
    const mat = this._closestTier(tier);
    if (!this._svgEl) return;
    const styleEl = this._svgEl.querySelector("style");
    if (styleEl) {
      styleEl.textContent = `
        .fam-body        { fill: ${mat.bodyFill}; }
        .fam-accent      { fill: ${mat.accentFill}; }
        .fam-dark        { fill: ${mat.darkFill}; }
        .fam-dark-stroke { stroke: ${mat.darkFill}; }
        .fam-eye         { fill: ${mat.eyeFill}; }`;
    }
    this._svgEl.style.filter = mat.filter;
    // Swap animation class
    for (const cls of [...this._svgEl.classList]) {
      if (cls.startsWith("fam-material-")) this._svgEl.classList.remove(cls);
    }
    if (mat.animClass) this._svgEl.classList.add(mat.animClass);
  }

  // ── Load config from Firestore and mount ──────────────────────────
  static async fromFirestore(container) {
    const prof = await loadProfile();
    const fam = prof?.familiar || {};
    if (fam.enabled === false) return null;
    return new Familiar(container, {
      species: fam.species ?? "fox",
      materialTier: fam.materialTier ?? 0,
    });
  }

  // ── Find closest defined tier (tiers are 0,1,3,5,8 — not sequential) ──
  _closestTier(t) {
    const tiers  = Object.keys(MATERIAL_TIERS).map(Number).sort((a, b) => a - b);
    const closest = tiers.reduce((prev, cur) =>
      Math.abs(cur - t) < Math.abs(prev - t) ? cur : prev
    );
    return MATERIAL_TIERS[closest];
  }

  destroy() {
    this._animator?.destroy();
    this._wrapper?.remove();
  }
}

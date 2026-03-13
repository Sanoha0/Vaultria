/**
 * Vaultria — FamiliarAnimator
 * State machine: idle → sub-idle animations → reaction → idle
 * All motion is CSS class-driven; no JS animation loops.
 */

import { eventBus } from "../../utils/eventBus.js";
import { SPECIES }  from "./FAMILIAR_DEFS.js";

export class FamiliarAnimator {
  constructor(svgEl, species) {
    this._el      = svgEl;
    this._def     = SPECIES[species] ?? SPECIES.fox;
    this._state   = "idle";
    this._timer   = null;
    this._handlers = [];

    this._bindReactions();
    this._scheduleIdle();
  }

  // ── Idle cycle ────────────────────────────────────────────────────
  _scheduleIdle() {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      if (this._state !== "idle") return;
      const pool = this._def.idleSet;
      const anim = pool[Math.floor(Math.random() * pool.length)];
      this._playClass(anim, 2600 + Math.random() * 1800);
      this._scheduleIdle();
    }, 4000 + Math.random() * 6000);
  }

  // ── Reaction triggers ─────────────────────────────────────────────
  _bindReactions() {
    const react = (animClass, duration = 2000) => {
      if (this._state === "reacting") return;
      clearTimeout(this._timer);
      this._state = "reacting";
      this._playClass(animClass, duration);
      setTimeout(() => {
        this._state = "idle";
        this._scheduleIdle();
      }, duration + 500);
    };

    const map = this._def.reactions ?? {};

    const h1 = () => map.achieve  && react(map.achieve,  2200);
    const h2 = () => map.speed    && react(map.speed,    1400);
    const h3 = () => map.accuracy && react(map.accuracy, 1800);
    const h4 = ({ score }) => score >= 90 && map.momentum &&
                              this._state === "idle" && react(map.momentum, 1600);

    eventBus.on("progress:sessionComplete",  h1);
    eventBus.on("progress:sessionFast",      h2);
    eventBus.on("progress:sessionAccurate",  h3);
    eventBus.on("momentum:updated",          h4);

    // Store for cleanup
    this._handlers = [
      ["progress:sessionComplete", h1],
      ["progress:sessionFast",     h2],
      ["progress:sessionAccurate", h3],
      ["momentum:updated",         h4],
    ];
  }

  // ── Class toggle helper ───────────────────────────────────────────
  _playClass(animClass, duration) {
    const cls = `fam-anim-${animClass}`;
    this._el.classList.add(cls);
    setTimeout(() => this._el.classList.remove(cls), duration);
  }

  destroy() {
    clearTimeout(this._timer);
    for (const [event, handler] of this._handlers) {
      eventBus.off(event, handler);
    }
    this._handlers = [];
  }
}

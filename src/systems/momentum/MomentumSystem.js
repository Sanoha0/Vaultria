/**
 * Vaultria — MomentumSystem
 * Manages the Flow Ring score across all activity paths.
 * Decay is computed on-the-fly; only the peak + lastActivityAt are persisted.
 */

import { eventBus } from "../../utils/eventBus.js";
import { getDb }    from "../../firebase/instance.js";
import { getUser }  from "../../auth/authService.js";

const GRACE_MS  = 48 * 3_600_000;      // 48 h — no decay window
const DECAY_MS  = 7  * 24 * 3_600_000; // 7 days — full decay window after grace
const MIN_RATIO = 0.10;                 // floor: never below 10% of stored peak

const GAIN = { path: 12, arena: 18, plaza: 8, vault: 10 };

export class MomentumSystem {
  constructor() {
    this._peak           = 0;
    this._lastActivityAt = 0;
    this._writeTimer     = null;

    eventBus.on("progress:sessionComplete", () => this.addActivity("path"));
    eventBus.on("arena:matchComplete",      () => this.addActivity("arena"));
    eventBus.on("plaza:contributed",        () => this.addActivity("plaza"));
    eventBus.on("vault:reviewComplete",     () => this.addActivity("vault"));
  }

  // ── Load persisted state from Firestore ───────────────────────────
  async load() {
    const user = getUser(); const db = getDb();
    if (!user || !db) return;
    try {
      const snap = await db.collection("users").doc(user.uid).get();
      const m = snap.data()?.momentum;
      if (m) {
        this._peak           = m.score          ?? 0;
        this._lastActivityAt = m.lastActivityAt ?? Date.now();
      } else {
        this._lastActivityAt = Date.now();
      }
    } catch (_) {
      this._lastActivityAt = Date.now();
    }
    this._emit();
  }

  // ── Computed score (decay-adjusted) ──────────────────────────────
  get score() {
    if (!this._lastActivityAt) return this._peak;
    const elapsed = Date.now() - this._lastActivityAt;
    if (elapsed <= GRACE_MS) return this._peak;
    const decayFraction = Math.min((elapsed - GRACE_MS) / DECAY_MS, 1);
    const floor = this._peak * MIN_RATIO;
    return Math.max(this._peak * (1 - decayFraction * 0.9), floor);
  }

  // ── Register activity on any path ─────────────────────────────────
  async addActivity(type) {
    const baseGain = GAIN[type] ?? 8;
    const current  = this.score;
    // Bonus restores more when momentum is low (encourages re-engagement)
    const bonus    = (100 - current) * 0.12;
    this._peak           = Math.min(current + baseGain + bonus, 100);
    this._lastActivityAt = Date.now();
    this._emit();
    this._schedulePersist();
  }

  _emit() {
    eventBus.emit("momentum:updated", { score: this.score });
  }

  _schedulePersist() {
    clearTimeout(this._writeTimer);
    this._writeTimer = setTimeout(() => this._persist(), 3000);
  }

  async _persist() {
    const user = getUser(); const db = getDb();
    if (!user || !db) return;
    db.collection("users").doc(user.uid).update({
      "momentum.score":          this._peak,
      "momentum.lastActivityAt": this._lastActivityAt,
    }).catch(() => {});
  }
}

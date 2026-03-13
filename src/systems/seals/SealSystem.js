/**
 * Vaultria — SealSystem
 * Awards stage seals when all 14 units of a stage have ≥1 star.
 */

import { eventBus } from "../../utils/eventBus.js";
import { STAGES }   from "../../utils/constants.js";
import { loadProfile, updateProfile } from "../../services/profileStore.js";

export class SealSystem {
  constructor() {
    eventBus.on("progress:stageProgress", ({ langKey, stageKey, unitStars }) => {
      this._checkSealUnlock(langKey, stageKey, unitStars);
    });
  }

  async _checkSealUnlock(langKey, stageKey, unitStars) {
    const stage = STAGES.find(s => s.key === stageKey);
    if (!stage) return;

    // All 14 units must have ≥1 star
    const allDone = Array.from({ length: stage.unitsCount }, (_, i) =>
      (unitStars?.[`${stage.id}_${i + 1}`] ?? 0) >= 1
    ).every(Boolean);
    if (!allDone) return;

    const prof = await loadProfile();
    const existingSeals = prof?.seals?.[langKey] ?? [];
    if (existingSeals.includes(stageKey)) return;

    await updateProfile((p) => {
      p.seals[langKey] = [...new Set([...(p.seals[langKey] || []), stageKey])];
      return p;
    });

    eventBus.emit("seal:awarded", { lang: langKey, stageKey });
    eventBus.emit("ui:sealAwardModal", { lang: langKey, stageKey });
  }

  static async loadSeals(lang) {
    const prof = await loadProfile();
    return prof?.seals?.[lang] ?? [];
  }
}

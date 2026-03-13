/**
 * Vaultria — SealSystem
 * Awards stage seals when all 14 units of a stage have ≥1 star.
 */

import { eventBus } from "../../utils/eventBus.js";
import { getDb }    from "../../firebase/instance.js";
import { getUser }  from "../../auth/authService.js";
import { STAGES }   from "../../utils/constants.js";

export class SealSystem {
  constructor() {
    eventBus.on("progress:unitComplete", ({ lang, stageKey, unitStarsMap }) => {
      this._checkSealUnlock(lang, stageKey, unitStarsMap);
    });
  }

  async _checkSealUnlock(lang, stageKey, unitStarsMap) {
    const stage = STAGES.find(s => s.key === stageKey);
    if (!stage) return;

    // All 14 units must have ≥1 star
    const allDone = Array.from({ length: stage.unitsCount }, (_, i) =>
      (unitStarsMap?.[`${stage.id}_${i + 1}`] ?? 0) >= 1
    ).every(Boolean);
    if (!allDone) return;

    const user = getUser(); const db = getDb();
    if (!user || !db) return;

    const snap = await db.collection("users").doc(user.uid).get().catch(() => null);
    if (!snap) return;
    const existingSeals = snap.data()?.seals?.[lang] ?? [];
    if (existingSeals.includes(stageKey)) return;

    await db.collection("users").doc(user.uid).update({
      [`seals.${lang}`]: window.firebase.firestore.FieldValue.arrayUnion(stageKey),
    }).catch(() => {});

    eventBus.emit("seal:awarded",       { lang, stageKey });
    eventBus.emit("ui:sealAwardModal",  { lang, stageKey });
  }

  static async loadSeals(lang) {
    const user = getUser(); const db = getDb();
    if (!user || !db) return [];
    const snap = await db.collection("users").doc(user.uid).get().catch(() => null);
    return snap?.data()?.seals?.[lang] ?? [];
  }
}

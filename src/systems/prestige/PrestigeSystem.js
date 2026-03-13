/**
 * Vaultria — PrestigeSystem
 * Awards prestige ranks when all 14 units of a stage reach 5 stars.
 * Prestige does NOT reset progress — it upgrades visual identity.
 */

import { eventBus } from "../../utils/eventBus.js";
import { getDb }    from "../../firebase/instance.js";
import { getUser }  from "../../auth/authService.js";
import { STAGES }   from "../../utils/constants.js";

export const PRESTIGE_REWARDS = {
  1: { type: "title",   value: "Scholar",          desc: "Stage card upgrades to gold" },
  2: { type: "familiar",value: "materialTier:1",   desc: "Familiar becomes smoked glass" },
  3: { type: "theme",   value: "void",              desc: "Unlock The Void dark theme" },
  4: { type: "title",   value: "Archivist",         desc: "Archivist title prefix" },
  5: { type: "familiar",value: "materialTier:3",   desc: "Familiar becomes polished jade" },
  6: { type: "frame",   value: "prestige_vi",       desc: "Prestige VI avatar frame" },
  7: { type: "desk",    value: "carbon",             desc: "Unlock Carbon Fiber desk surface" },
  8: { type: "familiar",value: "materialTier:8",   desc: "Familiar becomes celestial silhouette" },
};

export class PrestigeSystem {
  constructor() {
    eventBus.on("progress:unitStarUpdate", ({ lang, stageId, unitId, stars }) => {
      if (stars === 5) this._checkPrestige(lang, stageId);
    });
  }

  async _checkPrestige(lang, stageId) {
    const user = getUser(); const db = getDb();
    if (!user || !db) return;

    const progSnap = await db.collection("users").doc(user.uid)
                             .collection("progress").doc(lang)
                             .get().catch(() => null);
    if (!progSnap) return;
    const data = progSnap.data();
    if (!data) return;

    const stage = STAGES.find(s => s.id === stageId);
    if (!stage) return;

    const allPerfect = Array.from({ length: stage.unitsCount }, (_, i) =>
      (data.unitStars?.[`${stageId}_${i + 1}`] ?? 0) >= 5
    ).every(Boolean);
    if (!allPerfect) return;

    const userSnap = await db.collection("users").doc(user.uid).get().catch(() => null);
    if (!userSnap) return;
    const currentRank = userSnap.data()?.prestige?.[lang]?.rank ?? 0;
    const newRank     = currentRank + 1;

    await db.collection("users").doc(user.uid).update({
      [`prestige.${lang}`]: { rank: newRank, earnedAt: new Date().toISOString() },
    }).catch(() => {});

    const reward = PRESTIGE_REWARDS[newRank];
    if (reward) await this._applyReward(reward, user, db);

    eventBus.emit("prestige:awarded", { lang, rank: newRank, stage: stage.key, reward });
  }

  async _applyReward(reward, user, db) {
    if (reward.type === "familiar") {
      const tier = parseInt(reward.value.split(":")[1]);
      await db.collection("users").doc(user.uid)
              .update({ "familiar.materialTier": tier }).catch(() => {});
    } else if (reward.type === "frame") {
      await db.collection("users").doc(user.uid)
              .update({ "identity.frameId": reward.value }).catch(() => {});
    } else if (reward.type === "desk") {
      await db.collection("users").doc(user.uid)
              .update({ [`rewards.desk_${reward.value}`]: true }).catch(() => {});
    }
  }

  static async getPrestigeRank(lang) {
    const user = getUser(); const db = getDb();
    if (!user || !db) return 0;
    const snap = await db.collection("users").doc(user.uid).get().catch(() => null);
    return snap?.data()?.prestige?.[lang]?.rank ?? 0;
  }
}

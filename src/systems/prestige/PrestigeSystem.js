/**
 * Vaultria — PrestigeSystem
 * Awards prestige ranks when all 14 units of a stage reach 5 stars.
 * Prestige does NOT reset progress — it upgrades visual identity.
 */

import { eventBus } from "../../utils/eventBus.js";
import { STAGES }   from "../../utils/constants.js";
import { loadProfile, updateProfile } from "../../services/profileStore.js";

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
    eventBus.on("progress:stageProgress", ({ langKey, stageKey, stageId, unitStars }) => {
      // Debounce naturally via profile completedStages check.
      this._checkPrestige(langKey, stageKey, stageId, unitStars);
    });
  }

  async _checkPrestige(langKey, stageKey, stageId, unitStars) {
    const stage = STAGES.find((s) => s.key === stageKey) || STAGES.find((s) => s.id === stageId);
    if (!stage) return;

    const allPerfect = Array.from({ length: stage.unitsCount }, (_, i) =>
      (unitStars?.[`${stage.id}_${i + 1}`] ?? 0) >= 5
    ).every(Boolean);
    if (!allPerfect) return;

    const prof = await loadProfile();
    const bucket = prof?.prestige?.[langKey] ?? { rank: 0, completedStages: [] };
    const completed = new Set(bucket.completedStages || []);
    if (completed.has(stage.key)) return;

    const newRank = (bucket.rank || 0) + 1;
    const reward = PRESTIGE_REWARDS[newRank] || null;

    await updateProfile((p) => {
      const prev = p.prestige?.[langKey] || { rank: 0, completedStages: [] };
      const nextCompleted = [...new Set([...(prev.completedStages || []), stage.key])];
      p.prestige[langKey] = { ...prev, rank: newRank, completedStages: nextCompleted, earnedAt: new Date().toISOString() };
      if (reward) this._applyRewardLocal(p, reward);
      return p;
    });

    eventBus.emit("prestige:awarded", { lang: langKey, rank: newRank, stage: stage.key, reward });
  }

  _applyRewardLocal(profile, reward) {
    if (reward.type === "familiar") {
      const tier = parseInt(String(reward.value).split(":")[1] || "0", 10);
      profile.familiar = profile.familiar || {};
      profile.familiar.materialTier = tier;
      return;
    }
    if (reward.type === "frame") {
      profile.identity = profile.identity || {};
      profile.identity.frameId = reward.value;
      return;
    }
    if (reward.type === "desk") {
      profile.rewards = profile.rewards || {};
      profile.rewards[`desk_${reward.value}`] = true;
      return;
    }
    if (reward.type === "theme") {
      profile.uiTheme = reward.value;
      return;
    }
    if (reward.type === "title") {
      profile.identity = profile.identity || {};
      profile.identity.titlePrefix = reward.value;
      return;
    }
  }

  static async getPrestigeRank(lang) {
    const prof = await loadProfile();
    return prof?.prestige?.[lang]?.rank ?? 0;
  }
}

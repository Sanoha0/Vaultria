/**
 * Vaultria — ChronicleSystem
 * Detects level milestones (every 5 levels) and triggers the reward selector.
 */

import { eventBus }          from "../../utils/eventBus.js";
import { xpToLevel }         from "../../utils/textUtils.js";
import { REWARD_EVERY_N_LEVELS } from "../../utils/constants.js";
import { CHRONICLE_REWARDS } from "./REWARD_DEFS.js";
import { loadProfile, updateProfile } from "../../services/profileStore.js";

export class ChronicleSystem {
  constructor() {
    eventBus.on("progress:xpGained", ({ oldXp, newXp }) => {
      const oldLevel = xpToLevel(oldXp ?? 0);
      const newLevel = xpToLevel(newXp ?? 0);
      if (newLevel <= oldLevel) return;
      for (let lv = oldLevel + 1; lv <= newLevel; lv++) {
        if (lv % REWARD_EVERY_N_LEVELS === 0) this._checkMilestone(lv);
      }
    });
  }

  async _checkMilestone(level) {
    if (!CHRONICLE_REWARDS[level]) return;
    const prof = await loadProfile();

    const claimed = prof?.claimedMilestones ?? [];
    if (claimed.includes(level)) return;
    if (prof?.pendingMilestone) return;

    // Mark as pending — the RewardSelector will handle display
    await updateProfile((p) => {
      p.pendingMilestone = level;
      return p;
    });

    eventBus.emit("chronicle:milestoneReady", { level, ...CHRONICLE_REWARDS[level] });
  }

  // ── Called after user picks a reward ─────────────────────────────
  static async claimReward(level, rewardId) {
    await updateProfile((p) => {
      p.rewards = p.rewards || {};
      p.rewards[rewardId] = true;
      p.pendingMilestone = null;
      p.claimedMilestones = [...new Set([...(p.claimedMilestones || []), level])];
      return p;
    });

    eventBus.emit("chronicle:rewardClaimed", { level, rewardId });
    return { ok: true };
  }

  // ── Check for pending milestone on app startup ────────────────────
  static async checkPending() {
    const prof = await loadProfile();
    const level = prof?.pendingMilestone;
    if (level && CHRONICLE_REWARDS[level]) {
      eventBus.emit("chronicle:milestoneReady", { level, ...CHRONICLE_REWARDS[level] });
    }
  }
}

/**
 * Vaultria — ChronicleSystem
 * Detects level milestones (every 5 levels) and triggers the reward selector.
 */

import { eventBus }          from "../../utils/eventBus.js";
import { getDb }             from "../../firebase/instance.js";
import { getUser }           from "../../auth/authService.js";
import { xpToLevel }         from "../../utils/textUtils.js";
import { REWARD_EVERY_N_LEVELS } from "../../utils/constants.js";
import { CHRONICLE_REWARDS } from "./REWARD_DEFS.js";

export class ChronicleSystem {
  constructor() {
    eventBus.on("progress:xpGained", ({ newXp }) => {
      const level = xpToLevel(newXp);
      if (level % REWARD_EVERY_N_LEVELS === 0) this._checkMilestone(level);
    });
  }

  async _checkMilestone(level) {
    if (!CHRONICLE_REWARDS[level]) return;
    const user = getUser(); const db = getDb();
    if (!user || !db) return;

    const snap = await db.collection("users").doc(user.uid).get().catch(() => null);
    if (!snap) return;
    const claimed = snap.data()?.claimedMilestones ?? [];
    if (claimed.includes(level)) return;

    // Mark as pending — the RewardSelector will handle display
    await db.collection("users").doc(user.uid).update({
      pendingMilestone: level,
    }).catch(() => {});

    eventBus.emit("chronicle:milestoneReady", { level, ...CHRONICLE_REWARDS[level] });
  }

  // ── Called after user picks a reward ─────────────────────────────
  static async claimReward(level, rewardId) {
    const user = getUser(); const db = getDb();
    if (!user || !db) return { ok: false };

    await db.collection("users").doc(user.uid).update({
      [`rewards.${rewardId}`]:   true,
      pendingMilestone:          null,
      claimedMilestones:         window.firebase.firestore.FieldValue.arrayUnion(level),
    }).catch(() => {});

    eventBus.emit("chronicle:rewardClaimed", { level, rewardId });
    return { ok: true };
  }

  // ── Check for pending milestone on app startup ────────────────────
  static async checkPending() {
    const user = getUser(); const db = getDb();
    if (!user || !db) return;

    const snap = await db.collection("users").doc(user.uid).get().catch(() => null);
    if (!snap) return;
    const level = snap.data()?.pendingMilestone;
    if (level && CHRONICLE_REWARDS[level]) {
      eventBus.emit("chronicle:milestoneReady", { level, ...CHRONICLE_REWARDS[level] });
    }
  }
}

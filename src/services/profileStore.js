/**
 * Vaultia — Profile Store (Local + Optional Firestore)
 * Stores cosmetic/identity/reward state that spans languages (momentum, seals, desk, familiar, etc.).
 *
 * Local-first: always persists to localStorage. If Firebase is available and the
 * user is a cloud user, also merges into users/{uid}.
 */

import { eventBus } from "../utils/eventBus.js";
import { getUser, isGuest } from "../auth/authService.js";
import { getDb, isFirebaseReady } from "../firebase/instance.js";

const LS_PREFIX = "vaultia_profile_v1";

const DEFAULT_PROFILE = {
  version: 1,
  momentum: { score: 0, lastActivityAt: Date.now() },
  seals: { japanese: [], korean: [], spanish: [] },
  prestige: {
    japanese: { rank: 0, completedStages: [] },
    korean: { rank: 0, completedStages: [] },
    spanish: { rank: 0, completedStages: [] },
  },
  desk: { material: "walnut", artifacts: [] },
  familiar: { enabled: true, species: "fox", materialTier: 0 },
  identity: { frameId: "default", titlePrefix: "" },
  rewards: {},
  trophies: { pinned: [], earned: [] },
  claimedMilestones: [],
  pendingMilestone: null,
  uiTheme: "default",
};

let _cache = null;
let _loadPromise = null;

function _uid() {
  const u = getUser();
  return u?.uid || "local";
}

function _lsKey() {
  return `${LS_PREFIX}_${_uid()}`;
}

function _safeParse(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function _merge(base, extra) {
  if (!extra || typeof extra !== "object") return base;
  // Shallow merge + a couple of known nested merges (keeps file small/fast).
  const out = { ...base, ...extra };
  out.momentum = { ...base.momentum, ...(extra.momentum || {}) };
  out.seals = { ...base.seals, ...(extra.seals || {}) };
  out.prestige = { ...base.prestige, ...(extra.prestige || {}) };
  for (const k of Object.keys(base.prestige || {})) {
    out.prestige[k] = { ...base.prestige[k], ...(extra.prestige?.[k] || {}) };
    out.prestige[k].completedStages = [
      ...(extra.prestige?.[k]?.completedStages || base.prestige[k].completedStages || []),
    ];
  }
  out.desk = { ...base.desk, ...(extra.desk || {}) };
  out.familiar = { ...base.familiar, ...(extra.familiar || {}) };
  out.identity = { ...base.identity, ...(extra.identity || {}) };
  out.rewards  = { ...base.rewards,  ...(extra.rewards  || {}) };
  out.trophies = {
    pinned: extra?.trophies?.pinned ?? base.trophies?.pinned ?? [],
    earned: extra?.trophies?.earned ?? base.trophies?.earned ?? [],
  };
  // Guard scalar/array fields — remote undefined must not overwrite local defaults
  out.claimedMilestones = extra?.claimedMilestones ?? base.claimedMilestones ?? [];
  out.pendingMilestone  = (extra != null && 'pendingMilestone' in extra)
    ? (extra.pendingMilestone ?? null)
    : (base.pendingMilestone ?? null);
  out.uiTheme = extra?.uiTheme ?? base.uiTheme ?? "default";
  return out;
}

export async function loadProfile() {
  if (_cache) return _cache;
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async () => {
    const key = _lsKey();
    const local = _safeParse(localStorage.getItem(key));

    // Local-first base
    let merged = _merge(DEFAULT_PROFILE, local);

    // Optional cloud merge
    const u = getUser();
    const db = getDb();
    const canCloud = !!(isFirebaseReady && db && u && !u._isLocal && !u._isGuest && !isGuest());

    if (canCloud) {
      try {
        const snap = await db.collection("users").doc(u.uid).get();
        const remote = snap?.data() || null;
        // Remote user doc is big; only read the fields we care about if present.
        const remoteProfile = {
          momentum: remote?.momentum,
          seals: remote?.seals,
          prestige: remote?.prestige,
          desk: remote?.desk,
          familiar: remote?.familiar,
          identity: remote?.identity,
          rewards: remote?.rewards,
          claimedMilestones: remote?.claimedMilestones,
          pendingMilestone: remote?.pendingMilestone,
          uiTheme: remote?.uiTheme,
        };
        merged = _merge(merged, remoteProfile);
      } catch {
        // ignore — local remains the source of truth
      }
    }

    // Persist the merged snapshot locally so we stay deterministic offline.
    try {
      localStorage.setItem(key, JSON.stringify(merged));
    } catch {}

    _cache = merged;
    eventBus.emit("profile:loaded", merged);
    return merged;
  })();

  return _loadPromise;
}

export function getProfileCached() {
  return _cache;
}

export async function updateProfile(mutator) {
  const current = await loadProfile();
  const next = mutator ? (mutator(structuredClone(current)) || current) : current;
  _cache = next;

  // Local always.
  try {
    localStorage.setItem(_lsKey(), JSON.stringify(next));
  } catch {}

  // Cloud best-effort (merge).
  const u = getUser();
  const db = getDb();
  const canCloud = !!(isFirebaseReady && db && u && !u._isLocal && !u._isGuest && !isGuest());
  if (canCloud) {
    const patch = {
      momentum: next.momentum ?? null,
      seals: next.seals ?? {},
      prestige: next.prestige ?? {},
      desk: next.desk ?? {},
      familiar: next.familiar ?? {},
      identity: next.identity ?? {},
      rewards: next.rewards ?? {},
      trophies: { pinned: next.trophies?.pinned ?? [], earned: next.trophies?.earned ?? [] },
      claimedMilestones: next.claimedMilestones ?? [],
      pendingMilestone: next.pendingMilestone ?? null,
      uiTheme: next.uiTheme ?? "default",
    };
    console.debug("[ProfileStore] Firestore patch claimedMilestones:", patch.claimedMilestones);
    db.collection("users").doc(u.uid).set(patch, { merge: true }).catch(() => {});
  }

  eventBus.emit("profile:changed", next);
  return next;
}

export async function resetProfile() {
  _cache = null;
  _loadPromise = null;
  try {
    localStorage.removeItem(_lsKey());
  } catch {}
  return loadProfile();
}


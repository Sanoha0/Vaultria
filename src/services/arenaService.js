/**
 * Vaultria — Arena Service
 * Real-time Firestore matchmaking + multiplayer speed translation.
 *
 * Collections:
 *   arena_queue/{docId}    — { uid, username, lang, createdAt, matchId }
 *   arena_matches/{matchId} — { players[], playerNames{}, lang, items[], state, answers{}, scores{}, times{}, winnerId, createdAt, completedAt }
 */

import { getDb } from "../firebase/instance.js";

function _db()  { return getDb(); }
function _now() { return new Date().toISOString(); }

let _queueDocId = null;
let _queueUnsub = null;

// ─── Queue ────────────────────────────────────────────────────────

/**
 * Join the matchmaking queue. Returns the queue doc ID.
 */
export async function joinQueue(uid, username, lang) {
  const db = _db();
  if (!db) return null;

  // Clean up any stale queue entries first
  await leaveQueue(uid);

  const doc = await db.collection("arena_queue").add({
    uid,
    username: username || "Learner",
    lang,
    createdAt: _now(),
    matchId: null,
  });
  _queueDocId = doc.id;
  return doc.id;
}

/**
 * Leave the matchmaking queue (cancel).
 */
export async function leaveQueue(uid) {
  const db = _db();
  if (!db) return;

  // Delete our queue doc
  if (_queueDocId) {
    try { await db.collection("arena_queue").doc(_queueDocId).delete(); } catch (_) {}
    _queueDocId = null;
  }

  // Also clean up any other stale entries for this user
  try {
    const stale = await db.collection("arena_queue")
      .where("uid", "==", uid)
      .get();
    for (const d of stale.docs) {
      await d.ref.delete().catch(() => {});
    }
  } catch (_) {}

  if (_queueUnsub) { _queueUnsub(); _queueUnsub = null; }
}

/**
 * Subscribe to the queue — looks for an opponent. When found, creates a match.
 * @param {string} uid — current user UID
 * @param {string} lang — language to match on
 * @param {Array} items — 10 quiz items for the match (provided by caller)
 * @param {function} onMatch — called with { matchId } when a match is created
 * @returns {function} unsubscribe
 */
export function subscribeQueue(uid, lang, items, onMatch) {
  const db = _db();
  if (!db) return () => {};

  let matched = false;

  const unsub = db.collection("arena_queue")
    .where("lang", "==", lang)
    .orderBy("createdAt", "asc")
    .onSnapshot(async (snap) => {
      if (matched) return;

      // Find waiting players (no matchId yet, not ourselves)
      const waiting = snap.docs
        .filter(d => !d.data().matchId && d.data().uid !== uid)
        .sort((a, b) => a.data().createdAt.localeCompare(b.data().createdAt));

      if (waiting.length === 0) return;

      // Only the first person in queue (by createdAt) initiates the match
      const allWaiting = snap.docs
        .filter(d => !d.data().matchId)
        .sort((a, b) => a.data().createdAt.localeCompare(b.data().createdAt));

      if (allWaiting.length < 2) return;
      if (allWaiting[0].data().uid !== uid) return; // Not our turn to initiate

      matched = true;
      const opponent = waiting[0];
      const oppData = opponent.data();

      try {
        const matchId = await createMatch(
          uid,
          oppData.uid,
          { [uid]: _queueDocId ? "Player 1" : uid, [oppData.uid]: oppData.username },
          lang,
          items
        );

        // Update both queue docs with matchId
        if (_queueDocId) {
          await db.collection("arena_queue").doc(_queueDocId).update({ matchId }).catch(() => {});
        }
        await db.collection("arena_queue").doc(opponent.id).update({ matchId }).catch(() => {});

        onMatch({ matchId });
      } catch (err) {
        console.warn("[Arena] match creation failed:", err);
        matched = false;
      }
    });

  _queueUnsub = unsub;

  // Also watch our own queue doc for matchId (in case opponent created the match)
  let ownUnsub = () => {};
  if (_queueDocId) {
    ownUnsub = db.collection("arena_queue").doc(_queueDocId).onSnapshot((doc) => {
      if (matched) return;
      const data = doc.data();
      if (data?.matchId) {
        matched = true;
        onMatch({ matchId: data.matchId });
      }
    });
  }

  return () => { unsub(); ownUnsub(); };
}

// ─── Matches ──────────────────────────────────────────────────────

/**
 * Create a new match document.
 */
async function createMatch(uid1, uid2, playerNames, lang, items) {
  const db = _db();
  const doc = await db.collection("arena_matches").add({
    players: [uid1, uid2],
    playerNames: playerNames,
    lang,
    items,
    state: "active",
    answers: { [uid1]: [], [uid2]: [] },
    scores: { [uid1]: 0, [uid2]: 0 },
    times: { [uid1]: 0, [uid2]: 0 },
    winnerId: null,
    createdAt: _now(),
    completedAt: null,
  });
  return doc.id;
}

/**
 * Subscribe to a match for real-time updates.
 * @param {string} matchId
 * @param {function} onUpdate — called with match data on every change
 * @returns {function} unsubscribe
 */
export function subscribeMatch(matchId, onUpdate) {
  const db = _db();
  if (!db) return () => {};

  return db.collection("arena_matches").doc(matchId).onSnapshot((doc) => {
    if (doc.exists) {
      onUpdate({ id: doc.id, ...doc.data() });
    }
  });
}

/**
 * Submit an answer for the current item.
 */
export async function submitAnswer(matchId, uid, itemIdx, correct, elapsedMs) {
  const db = _db();
  if (!db) return;

  const ref = db.collection("arena_matches").doc(matchId);
  const doc = await ref.get();
  if (!doc.exists) return;

  const data = doc.data();
  const answers = data.answers?.[uid] || [];
  answers[itemIdx] = { correct, ms: elapsedMs };

  const score = answers.filter(a => a?.correct).length;
  const totalMs = answers.reduce((sum, a) => sum + (a?.ms || 0), 0);

  const updates = {};
  updates[`answers.${uid}`] = answers;
  updates[`scores.${uid}`] = score;
  updates[`times.${uid}`] = totalMs;

  await ref.update(updates);
}

/**
 * Complete the match — compute winner.
 */
export async function completeMatch(matchId, uid) {
  const db = _db();
  if (!db) return;

  const ref = db.collection("arena_matches").doc(matchId);
  const doc = await ref.get();
  if (!doc.exists) return;

  const data = doc.data();
  if (data.state === "complete") return; // Already completed

  const [p1, p2] = data.players;
  const s1 = data.scores?.[p1] || 0;
  const s2 = data.scores?.[p2] || 0;
  const t1 = data.times?.[p1] || Infinity;
  const t2 = data.times?.[p2] || Infinity;

  let winnerId = null;
  if (s1 > s2) winnerId = p1;
  else if (s2 > s1) winnerId = p2;
  else winnerId = t1 <= t2 ? p1 : p2; // Tiebreak by speed

  await ref.update({
    state: "complete",
    winnerId,
    completedAt: _now(),
  });
}

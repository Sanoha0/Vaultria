/**
 * Vaultia — Social Service
 * Real-time Firestore: friends, leaderboards, plaza, activity, presence.
 *
 * Firestore schema:
 *   users/{uid}                         — profile, xp, weeklyXp, online, lastSeenAt
 *   users/{uid}/friends/{otherUid}      — { uid, status, initiator, createdAt }
 *   plaza_posts/{postId}                — { uid, username, lang, question, tags, likeCount, replyCount, likedBy[], createdAt }
 *   plaza_posts/{postId}/replies/{id}   — { uid, username, body, createdAt }
 *   activity/{uid}/feed/{id}            — { type, fromUid, fromUsername, detail, createdAt }
 */

import { getDb, getAuth } from "../firebase/instance.js";

// ─── Firebase accessors ────────────────────────────────────────────
// Use getDb()/getAuth() which always return the live singleton after initFirebase() runs.
// Never call window.firebase.firestore() — that creates a new instance and breaks onSnapshot.
function _db() {
  return getDb();
}

function _auth() {
  return getAuth();
}

function _now() {
  return new Date().toISOString();
}

function _me() {
  const u = _auth()?.currentUser;
  if (!u) throw new Error("Not authenticated");
  return u;
}

// ─── Presence ──────────────────────────────────────────────────────

export async function heartbeat() {
  try {
    const me = _me();
    const db = _db();
    if (!db) return;
    await db.collection("users").doc(me.uid).set({
      online:      true,
      lastSeenAt:  _now(),
      uid:         me.uid,
      username:    me.displayName || me.email?.split("@")[0] || "Learner",
      usernameLower: (me.displayName || me.email?.split("@")[0] || "learner").toLowerCase(),
      email:       me.email || "",
    }, { merge: true });
  } catch (_) {}
}

export async function setOffline() {
  try {
    const me = _me();
    const db = _db();
    if (!db) return;
    await db.collection("users").doc(me.uid).update({ online: false, lastSeenAt: _now() });
  } catch (_) {}
}

// ─── User search ───────────────────────────────────────────────────

export async function searchUsers(query) {
  try {
    const db = _db();
    const me = _me();
    if (!db || !query?.trim()) return [];
    const q = query.toLowerCase().trim();

    // Prefix search
    let results = [];
    try {
      const snap = await db.collection("users")
        .where("usernameLower", ">=", q)
        .where("usernameLower", "<=", q + "\uf8ff")
        .limit(15)
        .get();
      results = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    } catch (_) {}

    // Also scan for partial substring matches (catches mid-string hits)
    if (results.length < 3) {
      try {
        const all = await db.collection("users").limit(200).get();
        const extra = all.docs
          .map(d => ({ uid: d.id, ...d.data() }))
          .filter(u => (u.usernameLower || "").includes(q));
        const seen = new Set(results.map(r => r.uid));
        for (const u of extra) { if (!seen.has(u.uid)) { results.push(u); seen.add(u.uid); } }
      } catch (_) {}
    }

    return results.filter(u => u.uid !== me.uid).slice(0, 15);
  } catch (err) {
    console.warn("[Social] searchUsers:", err.message);
    return [];
  }
}

// ─── Friends ───────────────────────────────────────────────────────

export async function sendFriendRequest(targetUid) {
  try {
    const db  = _db();
    const me  = _me();
    if (!db) return { ok: false, error: "Firebase not ready" };
    const now = _now();
    await db.collection("users").doc(me.uid)
      .collection("friends").doc(targetUid)
      .set({ uid: targetUid, status: "pending", initiator: me.uid, createdAt: now });
    await db.collection("users").doc(targetUid)
      .collection("friends").doc(me.uid)
      .set({ uid: me.uid, status: "pending", initiator: me.uid, createdAt: now });
    await _writeActivity(targetUid, {
      type:          "friend_request",
      fromUid:       me.uid,
      fromUsername:  me.displayName || me.email?.split("@")[0] || "Someone",
      detail:        "sent you a friend request",
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function acceptFriendRequest(fromUid) {
  try {
    const db  = _db();
    const me  = _me();
    if (!db) return { ok: false, error: "Firebase not ready" };
    const now = _now();
    await db.collection("users").doc(me.uid)
      .collection("friends").doc(fromUid)
      .update({ status: "accepted", acceptedAt: now });
    await db.collection("users").doc(fromUid)
      .collection("friends").doc(me.uid)
      .update({ status: "accepted", acceptedAt: now });
    await _writeActivity(fromUid, {
      type:         "friend_accepted",
      fromUid:      me.uid,
      fromUsername: me.displayName || me.email?.split("@")[0] || "Someone",
      detail:       "accepted your friend request",
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function removeFriend(otherUid) {
  try {
    const db = _db();
    const me = _me();
    if (!db) return { ok: false };
    await db.collection("users").doc(me.uid).collection("friends").doc(otherUid).delete();
    await db.collection("users").doc(otherUid).collection("friends").doc(me.uid).delete();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function loadFriends() {
  try {
    const db = _db();
    const me = _me();
    if (!db) return [];
    const snap = await db.collection("users").doc(me.uid).collection("friends").get();
    const rows = snap.docs.map(d => ({ ...d.data(), uid: d.id }));
    const profiles = await Promise.all(
      rows.map(r =>
        db.collection("users").doc(r.uid).get()
          .then(s => s.exists ? { uid: s.id, ...s.data() } : null)
          .catch(() => null)
      )
    );
    return rows.map((r, i) => ({ ...r, profile: profiles[i] })).filter(r => r.profile);
  } catch (err) {
    console.warn("[Social] loadFriends:", err.message);
    return [];
  }
}

export async function getFriendStatus(otherUid) {
  try {
    const db   = _db();
    const me   = _me();
    if (!db) return "none";
    const snap = await db.collection("users").doc(me.uid)
      .collection("friends").doc(otherUid).get();
    if (!snap.exists) return "none";
    const data = snap.data();
    if (data.status === "accepted") return "accepted";
    return data.initiator === me.uid ? "pending_sent" : "pending_received";
  } catch (_) {
    return "none";
  }
}

// ─── Leaderboards ──────────────────────────────────────────────────

export async function loadLeaderboard(type = "alltime", lang = null, limit = 25) {
  try {
    const db = _db();
    const me = _me();
    if (!db) return [];
    const xpField = type === "weekly" ? "weeklyXp" : "xp";

    if (type === "friends") {
      const fSnap = await db.collection("users").doc(me.uid)
        .collection("friends").where("status", "==", "accepted").get();
      const friendUids = [me.uid, ...fSnap.docs.map(d => d.id)];
      if (friendUids.length === 1) return [];
      const chunks = [];
      for (let i = 0; i < friendUids.length; i += 10) chunks.push(friendUids.slice(i, i + 10));
      const results = await Promise.all(
        chunks.map(chunk =>
          db.collection("users").where(firebase.firestore.FieldPath.documentId(), "in", chunk).get()
            .then(s => s.docs.map(d => ({ uid: d.id, ...d.data() })))
            .catch(() => [])
        )
      );
      return results.flat()
        .filter(u => (u.xp || 0) > 0)
        .sort((a, b) => (b.xp || 0) - (a.xp || 0))
        .map((u, i) => ({ ...u, rank: i + 1 }));
    }

    // Fetch all users, sort + filter client-side — zero index requirements
    const snap = await db.collection("users").limit(200).get();
    return snap.docs
      .map(d => ({ uid: d.id, ...d.data() }))
      .filter(u => (u[xpField] || 0) > 0 && (!lang || u.currentLanguage === lang))
      .sort((a, b) => (b[xpField] || 0) - (a[xpField] || 0))
      .slice(0, limit)
      .map((u, i) => ({ ...u, rank: i + 1 }));
  } catch (err) {
    console.warn("[Social] loadLeaderboard:", err.message);
    return [];
  }
}

export async function syncProgressToProfile(lang, progress) {
  try {
    const db = _db();
    const me = _me();
    if (!db) return;
    const xp     = progress?.xp     || 0;
    const streak = progress?.streak || 0;
    // Weekly XP
    const docRef = db.collection("users").doc(me.uid);
    const snap   = await docRef.get();
    const data   = snap.exists ? snap.data() : {};
    const nowWeek = _getWeekStart(new Date()).toISOString();
    let weeklyXp  = data.weeklyXp || 0;
    if (!data.weekStart || data.weekStart < nowWeek) weeklyXp = 0;
    if (xp > (data.xp || 0)) weeklyXp += (xp - (data.xp || 0));

    await docRef.set({
      uid:             me.uid,
      username:        me.displayName || me.email?.split("@")[0] || "Learner",
      usernameLower:   (me.displayName || me.email?.split("@")[0] || "learner").toLowerCase(),
      email:           me.email || "",
      xp,
      streak,
      weeklyXp,
      weekStart:       data.weekStart && data.weekStart >= nowWeek ? data.weekStart : nowWeek,
      currentLanguage: lang,
      online:          true,
      lastSeenAt:      _now(),
    }, { merge: true });
  } catch (_) {}
}

function _getWeekStart(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─── Plaza ─────────────────────────────────────────────────────────

export async function loadPlazaPosts(lang = null, limit = 20) {
  try {
    const db = _db();
    if (!db) return [];
    let q = db.collection("plaza_posts").orderBy("createdAt", "desc").limit(limit);
    if (lang) q = db.collection("plaza_posts")
      .where("lang", "==", lang).orderBy("createdAt", "desc").limit(limit);
    const snap = await q.get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn("[Social] loadPlazaPosts:", err.message);
    return [];
  }
}

export async function createPlazaPost({ question, lang, tags = [] }) {
  try {
    const db = _db();
    const me = _me();
    if (!db) return { ok: false, error: "Firebase not ready" };
    const doc = {
      uid:        me.uid,
      username:   me.displayName || me.email?.split("@")[0] || "Learner",
      lang,
      question,
      tags,
      likeCount:  0,
      replyCount: 0,
      likedBy:    [],
      createdAt:  _now(),
    };
    const ref = await db.collection("plaza_posts").add(doc);
    return { ok: true, id: ref.id, post: { id: ref.id, ...doc } };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function loadReplies(postId) {
  try {
    const db = _db();
    if (!db) return [];
    const snap = await db.collection("plaza_posts").doc(postId)
      .collection("replies").orderBy("createdAt", "asc").get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn("[Social] loadReplies:", err.message);
    return [];
  }
}

export async function replyToPost(postId, body) {
  try {
    const db = _db();
    const me = _me();
    if (!db) return { ok: false, error: "Firebase not ready" };
    const reply = {
      uid:       me.uid,
      username:  me.displayName || me.email?.split("@")[0] || "Learner",
      body,
      createdAt: _now(),
    };
    await db.collection("plaza_posts").doc(postId).collection("replies").add(reply);
    const postSnap = await db.collection("plaza_posts").doc(postId).get();
    await db.collection("plaza_posts").doc(postId)
      .update({ replyCount: (postSnap.data()?.replyCount || 0) + 1 });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function toggleLike(postId) {
  try {
    const db   = _db();
    const me   = _me();
    if (!db) return { ok: false };
    const ref  = db.collection("plaza_posts").doc(postId);
    const snap = await ref.get();
    if (!snap.exists) return { ok: false };
    const data    = snap.data();
    const likedBy = data.likedBy || [];
    const liked   = likedBy.includes(me.uid);
    await ref.update({
      likedBy:   liked ? likedBy.filter(u => u !== me.uid) : [...likedBy, me.uid],
      likeCount: liked ? Math.max((data.likeCount || 1) - 1, 0) : (data.likeCount || 0) + 1,
    });
    return { ok: true, liked: !liked };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ─── Activity feed ─────────────────────────────────────────────────

export async function loadActivity(limit = 20) {
  try {
    const db = _db();
    const me = _me();
    if (!db) return [];
    const snap = await db.collection("activity").doc(me.uid)
      .collection("feed").orderBy("createdAt", "desc").limit(limit).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    return [];
  }
}

async function _writeActivity(targetUid, { type, fromUid, fromUsername, detail }) {
  const db = _db();
  if (!db) return;
  await db.collection("activity").doc(targetUid)
    .collection("feed").add({ type, fromUid, fromUsername, detail, createdAt: _now() })
    .catch(() => {});
}

// ─── Real-time subscriptions ───────────────────────────────────────

export function subscribePlaza(onUpdate, lang = null) {
  const db = _db();
  if (!db) { onUpdate([]); return () => {}; }
  let q = db.collection("plaza_posts").orderBy("createdAt", "desc").limit(20);
  if (lang) q = db.collection("plaza_posts")
    .where("lang", "==", lang).orderBy("createdAt", "desc").limit(20);
  return q.onSnapshot(
    snap => onUpdate(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err  => console.warn("[Social] subscribePlaza:", err.message)
  );
}

export function subscribeFriendRequests(onUpdate) {
  const db = _db();
  try {
    const me = _me();
    if (!db) return () => {};
    return db.collection("users").doc(me.uid).collection("friends")
      .where("status", "==", "pending")
      .onSnapshot(snap => {
        const incoming = snap.docs
          .map(d => ({ uid: d.id, ...d.data() }))
          .filter(r => r.initiator !== me.uid);
        onUpdate(incoming);
      }, () => {});
  } catch (_) { return () => {}; }
}

export function subscribeOnlineFriends(onUpdate) {
  const db = _db();
  try {
    const me = _me();
    if (!db) return () => {};
    // Listen to friend docs, then batch-fetch profiles
    return db.collection("users").doc(me.uid).collection("friends")
      .where("status", "==", "accepted")
      .onSnapshot(async snap => {
        const uids = snap.docs.map(d => d.id);
        if (!uids.length) { onUpdate([]); return; }
        const profiles = await Promise.all(
          uids.map(uid => db.collection("users").doc(uid).get()
            .then(s => s.exists ? { uid: s.id, ...s.data() } : null).catch(() => null))
        );
        onUpdate(profiles.filter(Boolean));
      }, () => {});
  } catch (_) { return () => {}; }
}

// ─── Delete functions ───────────────────────────────────────────────

export async function deletePlazaPost(postId) {
  try {
    const db  = _db();
    const me  = _me();
    if (!db) return { ok: false };
    const snap = await db.collection("plaza_posts").doc(postId).get();
    if (!snap.exists) return { ok: false, error: "Post not found" };
    if (snap.data().uid !== me.uid) return { ok: false, error: "Not your post" };
    // Delete all replies first
    const replies = await db.collection("plaza_posts").doc(postId).collection("replies").get();
    const batch = db.batch();
    replies.docs.forEach(r => batch.delete(r.ref));
    batch.delete(db.collection("plaza_posts").doc(postId));
    await batch.commit();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function deletePlazaReply(postId, replyId) {
  try {
    const db  = _db();
    const me  = _me();
    if (!db) return { ok: false };
    const ref  = db.collection("plaza_posts").doc(postId).collection("replies").doc(replyId);
    const snap = await ref.get();
    if (!snap.exists) return { ok: false, error: "Reply not found" };
    if (snap.data().uid !== me.uid) return { ok: false, error: "Not your reply" };
    await ref.delete();
    // Decrement reply count
    const postSnap = await db.collection("plaza_posts").doc(postId).get();
    if (postSnap.exists) {
      await db.collection("plaza_posts").doc(postId)
        .update({ replyCount: Math.max((postSnap.data()?.replyCount || 1) - 1, 0) });
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ─── Real-time: replies subscription ───────────────────────────────

export function subscribeReplies(postId, onUpdate) {
  const db = _db();
  if (!db) { onUpdate([]); return () => {}; }
  return db.collection("plaza_posts").doc(postId)
    .collection("replies").orderBy("createdAt", "asc")
    .onSnapshot(
      snap => onUpdate(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err  => console.warn("[Social] subscribeReplies:", err.message)
    );
}

// ─── Real-time: leaderboard subscription ───────────────────────────

export function subscribeLeaderboard(onUpdate, lang = null, xpField = "xp", limit = 25) {
  const db = _db();
  if (!db) { onUpdate([]); return () => {}; }
  try {
    // No orderBy — avoids all index requirements. Fetch all users, sort client-side.
    return db.collection("users").limit(200).onSnapshot(
      snap => {
        const rows = snap.docs
          .map(d => ({ uid: d.id, ...d.data() }))
          .filter(u => (u[xpField] || 0) > 0 && (!lang || u.currentLanguage === lang))
          .sort((a, b) => (b[xpField] || 0) - (a[xpField] || 0))
          .slice(0, limit)
          .map((u, i) => ({ ...u, rank: i + 1 }));
        onUpdate(rows);
      },
      err => console.warn("[Social] subscribeLeaderboard:", err.message)
    );
  } catch (_) { onUpdate([]); return () => {}; }
}

// ─── Global activity feed (recent XP events across all users) ──────
// Reads from plaza_posts (recent posts) + users (recent active)
// to synthesize a real community feed without needing a separate collection.
export function subscribeGlobalActivity(onUpdate, limit = 12) {
  const db = _db();
  if (!db) { onUpdate([]); return () => {}; }
  try {
    // Watch recent plaza posts as a proxy for community activity
    return db.collection("plaza_posts")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .onSnapshot(snap => {
        const items = snap.docs.map(d => {
          const p = d.data();
          return {
            uid:      p.uid,
            user:     p.username || "Learner",
            lang:     p.lang,
            action:   "asked",
            detail:   p.question?.slice(0, 50) + (p.question?.length > 50 ? "…" : ""),
            xp:       0,
            time:     p.createdAt,
          };
        });
        onUpdate(items);
      },
      err => console.warn("[Social] subscribeGlobalActivity:", err.message)
    );
  } catch (_) { onUpdate([]); return () => {}; }
}

// ─── Arena: real match history ─────────────────────────────────────
export async function loadMyArenaMatches(limit = 10) {
  try {
    const db = _db();
    const me = _me();
    if (!db) return [];
    const snap = await db.collection("arena_matches")
      .where("players", "array-contains", me.uid)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (_) { return []; }
}

// ─── Update profile (display name + photo URL) ─────────────────────
export async function updateProfile({ displayName, photoURL }) {
  try {
    const db   = _db();
    const auth = _auth();
    const me   = auth?.currentUser;
    if (!me) return { ok: false, error: "Not signed in" };
    const updates = {};
    if (displayName !== undefined) updates.displayName = displayName;
    if (photoURL    !== undefined) updates.photoURL    = photoURL;
    await me.updateProfile(updates);
    if (db) {
      await db.collection("users").doc(me.uid).update({
        ...updates,
        username:      displayName || me.displayName,
        usernameLower: (displayName || me.displayName || "").toLowerCase(),
      }).catch(() => {});
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ─── Plaza typing indicator ────────────────────────────────────────
export function setTyping(postId, isTyping) {
  const db = _db();
  const auth = _auth();
  const me = auth?.currentUser;
  if (!db || !me) return;
  const ref = db.collection("plaza_posts").doc(postId)
    .collection("typing").doc(me.uid);
  if (isTyping) {
    ref.set({ uid: me.uid, username: me.displayName || "Learner", at: _now() }).catch(() => {});
  } else {
    ref.delete().catch(() => {});
  }
}

export function subscribeTyping(postId, onUpdate) {
  const db = _db();
  const auth = _auth();
  const me = auth?.currentUser;
  if (!db) return () => {};
  // Clear stale typing indicators (older than 5s) on client side
  return db.collection("plaza_posts").doc(postId)
    .collection("typing")
    .onSnapshot(snap => {
      const now = Date.now();
      const typists = snap.docs
        .map(d => d.data())
        .filter(t => t.uid !== me?.uid && (now - new Date(t.at).getTime()) < 5000);
      onUpdate(typists);
    }, () => {});
}

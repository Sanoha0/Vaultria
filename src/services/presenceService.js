/**
 * Vaultria — Presence Service (Real-Time)
 * Uses Firebase Realtime Database for instant online/offline status updates
 *
 * How it works:
 * 1. When user opens app → set presence to online with timestamp
 * 2. Register onDisconnect() handler to set offline automatically
 * 3. Listen to visibility changes (when tab hidden → offline; when visible → online)
 * 4. On beforeunload → explicitly set offline
 * 5. Synced presence updates all clients instantly via RTDB listeners
 */

import { getRtdb, getAuth } from "../firebase/instance.js";

// Track presence subscriptions to clean them up
let _presenceRef = null;
let _onlineListeners = new Set(); // Callbacks for presence updates
let _initialized = false;

function _rtdb() {
  return getRtdb();
}

function _auth() {
  return getAuth();
}

function _now() {
  return Date.now();
}

/**
 * Initialize real-time presence system
 * Must be called once per user session
 */
export async function initializePresence() {
  if (_initialized) return;
  _initialized = true;

  try {
    const auth = _auth();
    const rtdb = _rtdb();
    if (!auth?.currentUser || !rtdb) return;

    const uid = auth.currentUser.uid;
    const username = auth.currentUser.displayName || auth.currentUser.email?.split("@")[0] || "Learner";

    // Reference to this user's presence in Realtime Database
    _presenceRef = rtdb.ref(`presence/${uid}`);

    // Ensure presence path exists and is writable
    await _presenceRef.set({
      uid,
      username,
      online: true,
      lastSeen: _now(),
      connectedAt: _now(),
    });

    // Crucial: Register disconnection handler
    // When this client loses connection, Firebase automatically sets offline to true
    _presenceRef.onDisconnect().update({
      online: false,
      lastSeen: _now(),
      disconnectedAt: _now(),
    });

    // Set online when tab becomes visible
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        _setOnline();
      } else {
        _setOffline();
      }
    });

    // Set offline on page unload
    window.addEventListener("beforeunload", () => {
      _setOfflineSync(); // Synchronous operation using transaction
    });

    // Handle losing focus (browser window)
    window.addEventListener("blur", () => {
      // Don't immediately go offline on blur, but mark as away
      // Will go offline on tab hidden or unload
    });

    // Restore online when window gains focus
    window.addEventListener("focus", () => {
      if (!document.hidden) {
        _setOnline();
      }
    });

    // Subscribe to own presence changes for debugging
    _presenceRef.on("value", (snap) => {
      const data = snap.val();
      if (data && data.online !== data.wasNotifiedAbout) {
        data.wasNotifiedAbout = data.online; // Mark as notified
        _notifyListeners();
      }
    });

    console.log("[Presence] Real-time presence initialized for", username);
  } catch (err) {
    console.warn("[Presence] Failed to initialize:", err.message);
  }
}

/**
 * Set current user as online
 */
async function _setOnline() {
  try {
    if (!_presenceRef) return;
    await _presenceRef.update({
      online: true,
      lastSeen: _now(),
    });
    _notifyListeners();
  } catch (err) {
    console.warn("[Presence] Failed to set online:", err.message);
  }
}

/**
 * Set current user as offline (asynchronous)
 */
async function _setOffline() {
  try {
    if (!_presenceRef) return;
    await _presenceRef.update({
      online: false,
      lastSeen: _now(),
    });
    _notifyListeners();
  } catch (err) {
    console.warn("[Presence] Failed to set offline:", err.message);
  }
}

/**
 * Set current user as offline (synchronous, for unload)
 * Uses a transaction to ensure offline is set before navigation
 */
function _setOfflineSync() {
  try {
    if (!_presenceRef) return;
    // Use a transaction to ensure this completes
    _presenceRef.transaction((current) => {
      return {
        ...current,
        online: false,
        lastSeen: _now(),
      };
    });
  } catch (err) {
    // Silent fail on unload
  }
}

/**
 * Subscribe to presence updates for a specific user
 * Returns unsubscribe function
 */
export function subscribeToUserPresence(uid, callback) {
  const rtdb = _rtdb();
  if (!rtdb) return () => {};

  const userPresenceRef = rtdb.ref(`presence/${uid}`);
  const listener = (snap) => {
    const data = snap.val();
    if (data) {
      callback({
        uid,
        online: data.online === true, // Explicit true check
        lastSeen: data.lastSeen || 0,
        username: data.username || "Unknown",
        connectedAt: data.connectedAt,
      });
    }
  };

  userPresenceRef.on("value", listener);

  // Return unsubscribe function
  return () => {
    userPresenceRef.off("value", listener);
  };
}

/**
 * Get current presence status of a user (snapshot)
 */
export async function getUserPresence(uid) {
  const rtdb = _rtdb();
  if (!rtdb) return null;

  try {
    const snap = await rtdb.ref(`presence/${uid}`).once("value");
    const data = snap.val();
    return data
      ? {
          uid,
          online: data.online === true,
          lastSeen: data.lastSeen || 0,
          username: data.username || "Unknown",
          connectedAt: data.connectedAt,
        }
      : {
          uid,
          online: false,
          lastSeen: 0,
          username: "Unknown",
        };
  } catch (err) {
    console.warn("[Presence] Failed to get user presence:", err.message);
    return { uid, online: false, lastSeen: 0, username: "Unknown" };
  }
}

/**
 * Get presence for multiple users at once
 */
export async function getMultiplePresences(uids) {
  if (!uids || uids.length === 0) return {};

  const rtdb = _rtdb();
  if (!rtdb) return {};

  try {
    const results = {};
    const promises = uids.map(async (uid) => {
      const snap = await rtdb.ref(`presence/${uid}`).once("value");
      const data = snap.val();
      results[uid] = data
        ? {
            uid,
            online: data.online === true,
            lastSeen: data.lastSeen || 0,
            username: data.username || "Unknown",
          }
        : {
            uid,
            online: false,
            lastSeen: 0,
            username: "Unknown",
          };
    });
    await Promise.all(promises);
    return results;
  } catch (err) {
    console.warn("[Presence] Failed to get multiple presences:", err.message);
    return {};
  }
}

/**
 * Subscribe to all presence changes in a list of users
 * More efficient than subscribing to each individually
 */
export function subscribeToMultiplePresences(uids, callback) {
  if (!uids || uids.length === 0) return () => {};

  const rtdb = _rtdb();
  if (!rtdb) return () => {};

  const listeners = [];
  const presenceData = {};

  const unsubscribeAll = () => {
    listeners.forEach((unsubscribe) => unsubscribe());
    listeners.length = 0;
  };

  uids.forEach((uid) => {
    const unsubscribe = subscribeToUserPresence(uid, (data) => {
      presenceData[uid] = data;
      callback(presenceData); // Call with all updated presence data
    });
    listeners.push(unsubscribe);
  });

  return unsubscribeAll;
}

/**
 * Register a callback to be notified when presence changes
 */
export function onPresenceChange(callback) {
  _onlineListeners.add(callback);
  return () => _onlineListeners.delete(callback);
}

/**
 * Notify all listeners of presence changes
 */
function _notifyListeners() {
  _onlineListeners.forEach((cb) => {
    try {
      cb();
    } catch (err) {
      console.warn("[Presence] Listener error:", err);
    }
  });
}

/**
 * Get presence connection status (for debugging)
 */
export async function getPresenceConnectionStatus() {
  const rtdb = _rtdb();
  if (!rtdb) return { connected: false };

  try {
    const connectedRef = rtdb.ref(".info/connected");
    const snap = await connectedRef.once("value");
    return {
      connected: snap.val() === true,
      timestamp: _now(),
    };
  } catch (err) {
    return { connected: false };
  }
}

/**
 * Clean up presence data (call on logout)
 */
export async function cleanupPresence() {
  try {
    if (_presenceRef) {
      await _presenceRef.remove();
      _presenceRef = null;
    }
    _onlineListeners.clear();
    _initialized = false;
  } catch (err) {
    console.warn("[Presence] Cleanup error:", err.message);
  }
}

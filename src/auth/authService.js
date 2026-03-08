/**
 * Vaultria — Auth Service
 * Handles all authentication flows with Firebase or local fallback.
 * Legacy-compatible with lingua-ai-language-teacher user documents.
 *
 * Firestore user document path:   users/{uid}
 * Progress subcollection path:    users/{uid}/progress/{langShortKey}
 * Avatar storage path:            pfp/{uid}/avatar.webp
 * LocalStorage fallback key:      lingua_prog_<langShortKey>
 */

import { fbAuth, db, fbStorage, isFirebaseReady } from "../firebase/instance.js";
import { DEV_EMAILS } from "../utils/constants.js";
import { LANG_SHORT } from "../utils/constants.js";
import { eventBus } from "../utils/eventBus.js";

// ─── Current user state ────────────────────────────────────────────
let _currentUser   = null;   // Firebase user object or local user
let _isGuest       = false;
let _isLocalUser   = false;  // Email/pass user not yet synced to Firebase

export const getUser      = ()  => _currentUser;
export const isGuest      = ()  => _isGuest;
export const isLocalUser  = ()  => _isLocalUser;
export const isDevUser    = ()  => _currentUser && DEV_EMAILS.includes(_currentUser.email);

// ─── Error messages ────────────────────────────────────────────────
export function friendlyAuthError(err) {
  const code = err?.code || "";
  if (code === "auth/wrong-password" || code === "auth/user-not-found")
    return "Incorrect email or password.";
  if (code === "auth/email-already-in-use")
    return "An account with this email already exists.";
  if (code === "auth/weak-password")
    return "Password must be at least 6 characters.";
  if (code === "auth/too-many-requests")
    return "Too many attempts. Please wait before trying again.";
  if (code === "auth/network-request-failed")
    return "No network connection. You can continue in local mode.";
  if (code === "permission-denied")
    return "Cloud save is blocked by Firestore rules.";
  if (code === "auth/unauthorized-domain")
    return "This domain is not authorized in Firebase Auth.";
  return err?.message || "An unexpected error occurred.";
}

// ─── Sign Up ───────────────────────────────────────────────────────
export async function signUp(email, password, displayName) {
  if (!isFirebaseReady || !fbAuth) {
    return _createLocalUser(email, password, displayName);
  }
  try {
    const cred = await fbAuth.createUserWithEmailAndPassword(email, password);
    await cred.user.updateProfile({ displayName });
    await _ensureUserDocument(cred.user);
    return { ok: true, user: cred.user };
  } catch (err) {
    return { ok: false, error: friendlyAuthError(err) };
  }
}

// ─── Sign In ───────────────────────────────────────────────────────
export async function signIn(email, password) {
  if (!isFirebaseReady || !fbAuth) {
    return _signInLocalUser(email, password);
  }
  try {
    const cred = await fbAuth.signInWithEmailAndPassword(email, password);
    await _ensureUserDocument(cred.user);
    return { ok: true, user: cred.user };
  } catch (err) {
    return { ok: false, error: friendlyAuthError(err) };
  }
}

// ─── Google Sign In ────────────────────────────────────────────────
export async function signInWithGoogle() {
  if (!isFirebaseReady || !fbAuth) {
    return { ok: false, error: "Google sign-in requires an internet connection." };
  }
  try {
    const provider = new window.firebase.auth.GoogleAuthProvider();
    const cred = await fbAuth.signInWithPopup(provider).catch(async () => {
      return fbAuth.signInWithRedirect(provider);
    });
    if (cred?.user) {
      await _ensureUserDocument(cred.user);
      return { ok: true, user: cred.user };
    }
    return { ok: false, error: "Sign-in cancelled." };
  } catch (err) {
    return { ok: false, error: friendlyAuthError(err) };
  }
}

// ─── Continue as Guest ─────────────────────────────────────────────
export function signInAsGuest() {
  _isGuest = true;
  _currentUser = {
    uid: "guest_" + Date.now(),
    displayName: "Guest",
    email: null,
    _isGuest: true,
  };
  eventBus.emit("auth:changed", { user: _currentUser, isGuest: true });
  return { ok: true, user: _currentUser };
}

// ─── Sign Out ──────────────────────────────────────────────────────
export async function signOut() {
  if (isFirebaseReady && fbAuth) {
    try { await fbAuth.signOut(); } catch (_) {}
  }
  _onSignedOut();
}

// ─── Delete Account ────────────────────────────────────────────────
export async function deleteAccount(password) {
  if (!_currentUser) return { ok: false, error: "Not signed in." };
  if (isFirebaseReady && fbAuth && _currentUser && !_currentUser._isLocal) {
    try {
      if (password) {
        const cred = window.firebase.auth.EmailAuthProvider.credential(
          _currentUser.email, password
        );
        await _currentUser.reauthenticateWithCredential(cred);
      }
      // Delete all progress subcollection docs
      for (const sk of Object.values(LANG_SHORT)) {
        await db.collection("users").doc(_currentUser.uid)
          .collection("progress").doc(sk).delete().catch(() => {});
      }
      await db.collection("users").doc(_currentUser.uid).delete().catch(() => {});
      // Delete avatar from Storage
      if (fbStorage) {
        try {
          await fbStorage.ref(`pfp/${_currentUser.uid}/avatar.webp`).delete();
        } catch (_) {}
      }
      await _currentUser.delete();
    } catch (err) {
      return { ok: false, error: friendlyAuthError(err) };
    }
  }
  // Clear localStorage fallback keys
  for (const k of Object.keys(LANG_SHORT)) {
    try { localStorage.removeItem("lingua_prog_" + k); } catch (_) {}
  }
  _onSignedOut();
  return { ok: true };
}

// ─── Auth state listener ───────────────────────────────────────────
export function listenAuthState(callback) {
  if (isFirebaseReady && fbAuth) {
    fbAuth.onAuthStateChanged((user) => {
      if (user) {
        _currentUser = user;
        _isGuest     = false;
        _isLocalUser = false;
        callback({ user, isGuest: false });
        eventBus.emit("auth:changed", { user, isGuest: false });
      } else {
        _onSignedOut();
        callback({ user: null, isGuest: false });
      }
    });
  } else {
    const stored = _tryRestoreLocalUser();
    if (stored) callback({ user: stored, isGuest: false });
  }
}

function _tryRestoreLocalUser() {
  try {
    const raw = localStorage.getItem("vaultia_local_user");
    if (!raw) return null;
    const stored = JSON.parse(raw);
    if (!stored?.uid) return null;
    const user = { ...stored, _isLocal: true, _isLocalUser: true };
    _currentUser = user;
    _isLocalUser = true;
    return user;
  } catch (_) { return null; }
}

// ─── Update display name ───────────────────────────────────────────
export async function updateDisplayName(name) {
  if (isFirebaseReady && fbAuth && _currentUser && !_currentUser._isLocal) {
    await _currentUser.updateProfile({ displayName: name });
    if (db) {
      await db.collection("users").doc(_currentUser.uid).update({ username: name });
    }
  } else if (_currentUser) {
    _currentUser.displayName = name;
    try { localStorage.setItem("vaultia_local_displayName", name); } catch (_) {}
  }
}

// ─── Upload Avatar ─────────────────────────────────────────────────
export async function uploadAvatar(file) {
  if (!_currentUser || _isGuest || _currentUser._isLocal) {
    return { ok: false, error: "Avatar sync requires a cloud account." };
  }
  if (!isFirebaseReady || !fbStorage) {
    return { ok: false, error: "Storage unavailable." };
  }
  try {
    const ref = fbStorage.ref(`pfp/${_currentUser.uid}/avatar.webp`);
    await ref.put(file);
    const url = await ref.getDownloadURL();
    if (db) {
      await db.collection("users").doc(_currentUser.uid).update({ avatar_url: url });
    }
    return { ok: true, url };
  } catch (err) {
    return { ok: false, error: friendlyAuthError(err) };
  }
}

// ─── Internal helpers ──────────────────────────────────────────────
async function _ensureUserDocument(user) {
  if (!db) return;
  const ref = db.collection("users").doc(user.uid);
  const snap = await ref.get().catch(() => null);
  if (!snap || !snap.exists) {
    await ref.set({
      uid:           user.uid,
      username:      user.displayName || user.email?.split("@")[0],
      email:         user.email,
      provider_ids:  (user.providerData || []).map((p) => p.providerId),
      xp:            0,
      level:         1,
      streak:        0,
      createdAt:     new Date().toISOString(),
      lastLoginAt:   new Date().toISOString(),
    });
  } else {
    await ref.update({
      lastLoginAt:  new Date().toISOString(),
      provider_ids: (user.providerData || []).map((p) => p.providerId),
    }).catch(() => {});
  }
}

function _createLocalUser(email, password, displayName) {
  const uid = "local_" + btoa(email).replace(/=/g, "");
  const user = { uid, email, displayName, _isLocal: true, _isLocalUser: true };
  try {
    localStorage.setItem("vaultia_local_user", JSON.stringify({ uid, email, displayName, password }));
  } catch (_) {}
  _currentUser = user;
  _isLocalUser = true;
  eventBus.emit("auth:changed", { user, isGuest: false });
  return { ok: true, user };
}

function _signInLocalUser(email, password) {
  try {
    const stored = JSON.parse(localStorage.getItem("vaultia_local_user") || "null");
    if (stored && stored.email === email && stored.password === password) {
      const user = { ...stored, _isLocal: true, _isLocalUser: true };
      _currentUser = user;
      _isLocalUser = true;
      eventBus.emit("auth:changed", { user, isGuest: false });
      return { ok: true, user };
    }
  } catch (_) {}
  return { ok: false, error: "Incorrect email or password." };
}

function _onSignedOut() {
  _currentUser = null;
  _isGuest = false;
  _isLocalUser = false;
  eventBus.emit("auth:changed", { user: null, isGuest: false });
}

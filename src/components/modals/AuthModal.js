/**
 * Vaultia — Auth Modal
 * Sign in, sign up, Google sign-in, guest access
 */

import { signIn, signUp, signInWithGoogle, signInAsGuest } from "../../auth/authService.js";
import { eventBus } from "../../utils/eventBus.js";

export class AuthModal {
  constructor({ container, onAuthSuccess }) {
    this.container     = container;
    this.onAuthSuccess = onAuthSuccess;
    this.mode          = "signin"; // "signin" | "signup"
    this.loading       = false;

    this.render();
    this._bindEvents();
  }

  render() {
    const isSignup = this.mode === "signup";
    this.container.innerHTML = `
      <div class="modal-overlay" id="auth-overlay">
        <div class="modal-card" style="max-width:400px;">
          <!-- Logo -->
          <div style="text-align:center;margin-bottom:var(--sp-xl);">
            <h1 class="display-font" style="font-size:2.2rem;font-weight:300;letter-spacing:0.08em;color:var(--text-primary);">
              Vaultia
            </h1>
            <p style="color:var(--text-muted);font-size:0.85rem;margin-top:var(--sp-xs);">
              Professional Language Workstation
            </p>
          </div>

          <!-- Mode tabs -->
          <div style="display:flex;border:1px solid var(--border-normal);border-radius:var(--r-md);overflow:hidden;margin-bottom:var(--sp-xl);">
            <button id="tab-signin" class="btn" style="
              flex:1;border-radius:0;border:none;
              background:${!isSignup ? "var(--bg-active)" : "transparent"};
              color:${!isSignup ? "var(--text-primary)" : "var(--text-muted)"};
              font-size:0.85rem;padding:10px;
            ">Sign In</button>
            <button id="tab-signup" class="btn" style="
              flex:1;border-radius:0;border:none;
              border-left:1px solid var(--border-normal);
              background:${isSignup ? "var(--bg-active)" : "transparent"};
              color:${isSignup ? "var(--text-primary)" : "var(--text-muted)"};
              font-size:0.85rem;padding:10px;
            ">Create Account</button>
          </div>

          <div class="auth-form" id="auth-form">
            ${isSignup ? `
              <div class="input-group">
                <label class="input-label" for="auth-name">Display Name</label>
                <input class="input" id="auth-name" type="text" placeholder="Your name" autocomplete="name">
              </div>
            ` : ""}
            <div class="input-group">
              <label class="input-label" for="auth-email">Email</label>
              <input class="input" id="auth-email" type="email" placeholder="you@example.com" autocomplete="email">
            </div>
            <div class="input-group">
              <label class="input-label" for="auth-password">Password</label>
              <input class="input" id="auth-password" type="password" placeholder="Password" autocomplete="${isSignup ? "new-password" : "current-password"}">
            </div>
            <div id="auth-error" style="display:none;color:var(--error);font-size:0.82rem;padding:8px 12px;background:var(--error-glow);border-radius:var(--r-md);"></div>
            <button class="btn btn-primary" id="auth-submit" style="width:100%;margin-top:var(--sp-xs);">
              ${isSignup ? "Create Account" : "Sign In"}
            </button>
          </div>

          <div class="auth-divider" style="margin:var(--sp-lg) 0;">or</div>

          <button class="btn btn-google" id="auth-google" style="width:100%;margin-bottom:var(--sp-md);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <button class="btn btn-ghost" id="auth-guest" style="width:100%;font-size:0.82rem;color:var(--text-muted);">
            Continue as Guest
          </button>
        </div>
      </div>
    `;
  }

  _bindEvents() {
    const c = this.container;

    c.querySelector("#tab-signin")?.addEventListener("click", () => {
      if (this.mode !== "signin") { this.mode = "signin"; this.render(); this._bindEvents(); }
    });
    c.querySelector("#tab-signup")?.addEventListener("click", () => {
      if (this.mode !== "signup") { this.mode = "signup"; this.render(); this._bindEvents(); }
    });

    c.querySelector("#auth-submit")?.addEventListener("click", () => this._handleSubmit());
    c.querySelector("#auth-google")?.addEventListener("click", () => this._handleGoogle());
    c.querySelector("#auth-guest")?.addEventListener("click",  () => this._handleGuest());

    // Enter key
    c.querySelector("#auth-form")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this._handleSubmit();
    });
  }

  _setError(msg) {
    const el = this.container.querySelector("#auth-error");
    if (!el) return;
    if (msg) {
      el.style.display = "block";
      el.textContent = msg;
    } else {
      el.style.display = "none";
      el.textContent = "";
    }
  }

  _setLoading(loading) {
    this.loading = loading;
    const btn = this.container.querySelector("#auth-submit");
    const gBtn = this.container.querySelector("#auth-google");
    if (btn) btn.disabled = loading;
    if (gBtn) gBtn.disabled = loading;
    if (btn) btn.textContent = loading
      ? "Please wait…"
      : this.mode === "signup" ? "Create Account" : "Sign In";
  }

  async _handleSubmit() {
    if (this.loading) return;
    this._setError("");

    const email    = this.container.querySelector("#auth-email")?.value?.trim();
    const password = this.container.querySelector("#auth-password")?.value;
    const name     = this.container.querySelector("#auth-name")?.value?.trim();

    if (!email || !password) {
      this._setError("Please enter your email and password.");
      return;
    }

    this._setLoading(true);
    let result;
    if (this.mode === "signup") {
      result = await signUp(email, password, name || email.split("@")[0]);
    } else {
      result = await signIn(email, password);
    }
    this._setLoading(false);

    if (result.ok) {
      this.onAuthSuccess?.(result.user);
    } else {
      this._setError(result.error);
    }
  }

  async _handleGoogle() {
    if (this.loading) return;
    this._setLoading(true);
    const result = await signInWithGoogle();
    this._setLoading(false);
    if (result.ok) {
      this.onAuthSuccess?.(result.user);
    } else {
      this._setError(result.error);
    }
  }

  _handleGuest() {
    const result = signInAsGuest();
    if (result.ok) {
      this.onAuthSuccess?.(result.user);
    }
  }
}

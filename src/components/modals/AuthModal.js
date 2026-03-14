/**
 * Vaultria — Auth Modal
 * "Floating Terminal" layout: shards in the void (left) + floating glass slab (center-right)
 */

import { signIn, signUp, signInWithGoogle, signInAsGuest } from "../../auth/authService.js";
import { eventBus } from "../../utils/eventBus.js";

export class AuthModal {
  constructor({ container, onAuthSuccess }) {
    this.container     = container;
    this.onAuthSuccess = onAuthSuccess;
    this.mode          = "signin";
    this.loading       = false;

    this.render();
    this._bindEvents();
    this._spawnParticles();
  }

  render() {
    const isSignup = this.mode === "signup";
    this.container.innerHTML = `
      <div class="auth-screen" id="auth-overlay">

        <!-- ── Full-screen void: shards float freely ── -->
        <div class="auth-showcase">
          <div class="auth-shard auth-shard--jp" data-lang="jp" data-tint="rgba(232,160,184,0.06)" data-accent="#e8a0b8">
            <div class="auth-shard-face">
              <span class="auth-shard-glyph">語</span>
              <span class="auth-shard-label">JAPANESE</span>
            </div>
          </div>
          <div class="auth-shard auth-shard--kr" data-lang="kr" data-tint="rgba(77,184,255,0.06)" data-accent="#4db8ff">
            <div class="auth-shard-face">
              <span class="auth-shard-glyph">한</span>
              <span class="auth-shard-label">KOREAN</span>
            </div>
          </div>
          <div class="auth-shard auth-shard--es" data-lang="es" data-tint="rgba(232,164,74,0.06)" data-accent="#e8a44a">
            <div class="auth-shard-face">
              <span class="auth-shard-glyph">Ñ</span>
              <span class="auth-shard-label">ESPAÑOL</span>
            </div>
          </div>
        </div>

        <!-- ── Floating glass slab at ~70% screen width ── -->
        <div class="auth-panel">

          <div class="auth-panel-header">
            <div class="auth-panel-title">VAULTRIA</div>
            <div class="auth-panel-subtitle">ACCESSING CORE ARCHIVES...</div>
          </div>

          <div style="display:flex;gap:var(--sp-md);border-bottom:1px solid rgba(255,255,255,0.07);margin-bottom:var(--sp-xl);">
            <button id="tab-signin" class="auth-tab${!isSignup ? " active" : ""}">Sign In</button>
            <button id="tab-signup" class="auth-tab${isSignup ? " active" : ""}">New Account</button>
          </div>

          <div id="auth-form">
            ${isSignup ? `
            <div class="auth-field">
              <input class="auth-line-input" id="auth-name" type="text" placeholder="Display name" autocomplete="name">
            </div>
            ` : ""}
            <div class="auth-field">
              <input class="auth-line-input" id="auth-email" type="email" placeholder="Email" autocomplete="email">
            </div>
            <div class="auth-field">
              <input class="auth-line-input" id="auth-password" type="password" placeholder="Password" autocomplete="${isSignup ? "new-password" : "current-password"}">
            </div>
            <div id="auth-error" style="display:none;color:var(--error);font-size:0.78rem;padding:6px 0;"></div>
            <button class="btn btn-primary" id="auth-submit" style="width:100%;margin-top:var(--sp-sm);letter-spacing:0.07em;">
              ${isSignup ? "Initialize Account" : "Enter Vault"}
            </button>
          </div>

          <div style="text-align:center;font-size:0.68rem;color:rgba(255,255,255,0.18);letter-spacing:0.14em;margin:var(--sp-lg) 0;">OR</div>

          <button class="btn btn-google" id="auth-google" style="width:100%;margin-bottom:var(--sp-sm);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <button class="btn btn-ghost" id="auth-guest" style="width:100%;font-size:0.73rem;color:rgba(255,255,255,0.24);letter-spacing:0.07em;">
            Continue as Guest
          </button>

        </div>
      </div>
    `;
  }

  _bindEvents() {
    const c = this.container;

    c.querySelector("#tab-signin")?.addEventListener("click", () => {
      if (this.mode !== "signin") { this.mode = "signin"; this.render(); this._bindEvents(); this._spawnParticles(); }
    });
    c.querySelector("#tab-signup")?.addEventListener("click", () => {
      if (this.mode !== "signup") { this.mode = "signup"; this.render(); this._bindEvents(); this._spawnParticles(); }
    });

    c.querySelector("#auth-submit")?.addEventListener("click", () => this._handleSubmit());
    c.querySelector("#auth-google")?.addEventListener("click", () => this._handleGoogle());
    c.querySelector("#auth-guest")?.addEventListener("click",  () => this._handleGuest());

    c.querySelector("#auth-form")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this._handleSubmit();
    });

    // Shard hover → rim light on panel + tint on background
    const panel = c.querySelector(".auth-panel");
    c.querySelectorAll(".auth-shard").forEach(shard => {
      const lang   = shard.dataset.lang;
      const tint   = shard.dataset.tint;
      const accent = shard.dataset.accent;

      shard.addEventListener("mouseenter", () => {
        // Rim light
        panel?.classList.remove("rim-jp", "rim-kr", "rim-es");
        panel?.classList.add(`rim-${lang}`);
        panel?.style.setProperty("--auth-accent", accent);
        // Background tint
        const tl = document.querySelector(".auth-tint-layer");
        if (tl) tl.style.background = tint;
      });

      shard.addEventListener("mouseleave", () => {
        panel?.classList.remove("rim-jp", "rim-kr", "rim-es");
        panel?.style.removeProperty("--auth-accent");
        const tl = document.querySelector(".auth-tint-layer");
        if (tl) tl.style.background = "";
      });
    });
  }

  // Generate depth particles inside the showcase (two z-layers for 3-D feel)
  _spawnParticles() {
    const showcase = this.container.querySelector(".auth-showcase");
    if (!showcase) return;
    // Remove any previous particle container
    showcase.querySelector(".auth-particles")?.remove();

    const wrap = document.createElement("div");
    wrap.className = "auth-particles";

    const rand = (min, max) => min + Math.random() * (max - min);
    const particles = [];

    // Back layer — drift slowly behind shards
    for (let i = 0; i < 14; i++) {
      particles.push({
        layer: "back",
        x: rand(0, 100), y: rand(0, 100),
        size: rand(0.8, 1.6),
        dur:  rand(9, 16),
        del:  rand(0, 10),
        px:   rand(-18, 18),
        po:   rand(0.18, 0.32),
      });
    }
    // Front layer — faster, brighter, drift in front of shards (behind panel)
    for (let i = 0; i < 20; i++) {
      particles.push({
        layer: "front",
        x: rand(0, 62), y: rand(0, 100), // left 62% so they clear the panel area
        size: rand(0.7, 1.3),
        dur:  rand(6, 11),
        del:  rand(0, 8),
        px:   rand(-22, 22),
        po:   rand(0.3, 0.5),
      });
    }

    wrap.innerHTML = particles.map(p =>
      `<div class="auth-particle auth-particle--${p.layer}" style="
        left:${p.x.toFixed(1)}%;
        top:${p.y.toFixed(1)}%;
        width:${p.size.toFixed(2)}px;
        height:${p.size.toFixed(2)}px;
        animation-duration:${p.dur.toFixed(1)}s;
        animation-delay:-${p.del.toFixed(1)}s;
        --px:${p.px.toFixed(1)}px;
        --po:${p.po.toFixed(2)};
      "></div>`
    ).join("");

    showcase.appendChild(wrap);
  }

  // Dissolve panel + shards, then hand off to the app
  _triggerEntryTransition(user) {
    const c = this.container;
    c.querySelector(".auth-panel")?.classList.add("auth-panel--departing");
    c.querySelector(".auth-shard--jp")?.classList.add("auth-shard--departing");
    c.querySelector(".auth-shard--kr")?.classList.add("auth-shard--departing");
    c.querySelector(".auth-shard--es")?.classList.add("auth-shard--departing");
    setTimeout(() => this.onAuthSuccess?.(user), 650);
  }

  _setError(msg) {
    const el = this.container.querySelector("#auth-error");
    if (!el) return;
    if (msg) { el.style.display = "block"; el.textContent = msg; }
    else      { el.style.display = "none";  el.textContent = ""; }
  }

  _setLoading(loading) {
    this.loading = loading;
    const btn  = this.container.querySelector("#auth-submit");
    const gBtn = this.container.querySelector("#auth-google");
    if (btn)  btn.disabled  = loading;
    if (gBtn) gBtn.disabled = loading;
    if (btn)  btn.textContent = loading
      ? "Please wait…"
      : this.mode === "signup" ? "Initialize Account" : "Enter Vault";
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
    const result = this.mode === "signup"
      ? await signUp(email, password, name || email.split("@")[0])
      : await signIn(email, password);

    if (result.ok) {
      this._triggerEntryTransition(result.user);
    } else {
      this._setLoading(false);
      this._setError(result.error);
    }
  }

  async _handleGoogle() {
    if (this.loading) return;
    this._setLoading(true);
    const result = await signInWithGoogle();
    if (result.ok) {
      this._triggerEntryTransition(result.user);
    } else {
      this._setLoading(false);
      this._setError(result.error);
    }
  }

  _handleGuest() {
    const result = signInAsGuest();
    if (result.ok) this._triggerEntryTransition(result.user);
  }
}

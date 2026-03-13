/**
 * Vaultria — Right Panel Component
 * User identity, XP/Level, friends, performance boards, settings, preferences
 */

import { eventBus } from "../../utils/eventBus.js";
import { getUser, isGuest, isDevUser, signOut } from "../../auth/authService.js";
import { xpToLevel, xpProgressInLevel, xpToNextLevel, formatDate } from "../../utils/textUtils.js";
import { XP_PER_LEVEL } from "../../utils/constants.js";
import { MomentumRing } from "../../systems/momentum/MomentumRing.js";
import { FrameRenderer } from "../../systems/identity/FrameRenderer.js";

const RIGHT_ITEMS = [
  {
    id: "profile",
    label: "Profile",
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  },
  {
    id: "friends",
    label: "Friends",
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  },
  {
    id: "leaderboards",
    label: "Performance Board",
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  },
  {
    id: "plaza",
    label: "The Plaza",
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  },
  {
    id: "settings",
    label: "Settings",
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  },
  {
    id: "preferences",
    label: "Preferences",
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>`,
  },
];

export class RightPanel {
  constructor({ container, onNavigate }) {
    this.container  = container;
    this.onNavigate = onNavigate;
    this.collapsed  = false;
    this.activeId   = null;
    this.progress   = null;
    this._badges    = {};
    this._ring      = null;

    this.render();
    this._bindEvents();

    eventBus.on("auth:changed", () => this._renderUserSummary());
    eventBus.on("progress:update", (prog) => {
      this.progress = prog;
      this._renderUserSummary();
    });
    eventBus.on("momentum:updated", () => this._applyAvatarDecor());
  }

  render() {
    this.container.innerHTML = `
      <div class="panel-header">
        <button class="panel-collapse-btn btn-icon" id="right-collapse-btn" aria-label="Collapse panel">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>

      <!-- User summary mini card -->
      <div class="right-user-summary" id="right-user-summary">
        ${this._userSummaryHTML()}
      </div>

      <nav class="panel-nav" id="right-nav">
        ${RIGHT_ITEMS.map((item) => this._renderNavItem(item)).join("")}
      </nav>

      <div class="panel-footer">
        <button class="nav-item" id="nav-sign-out" data-id="sign-out" style="color: var(--error);">
          <span class="nav-item-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </span>
          <span class="nav-item-label">Sign Out</span>
        </button>
      </div>
    `;
  }

  _renderNavItem(item) {
    const isActive = this.activeId === item.id;
    const badge = this._badges[item.id];
    return `
      <button class="nav-item${isActive ? " active" : ""}" data-id="${item.id}" title="${item.label}" style="position:relative;">
        <span class="nav-item-icon">${item.icon}</span>
        <span class="nav-item-label">${item.label}</span>
        ${badge ? `<span style="position:absolute;top:6px;right:8px;width:7px;height:7px;border-radius:50%;background:#f87171;border:1px solid var(--bg-panel);pointer-events:none;"></span>` : ""}
      </button>
    `;
  }

  setBadge(id, hasBadge) {
    this._badges[id] = hasBadge;
    const btn = this.container.querySelector(`[data-id="${id}"]`);
    if (!btn) return;
    const existing = btn.querySelector("span[style*='border-radius:50%']");
    if (hasBadge && !existing) {
      const dot = document.createElement("span");
      dot.style.cssText = "position:absolute;top:6px;right:8px;width:7px;height:7px;border-radius:50%;background:#f87171;border:1px solid var(--bg-panel);pointer-events:none;";
      btn.appendChild(dot);
    } else if (!hasBadge && existing) {
      existing.remove();
    }
  }

  _userSummaryHTML() {
    const user = getUser();
    if (!user) return "";

    const xp     = this.progress?.xp || 0;
    const level  = xpToLevel(xp);
    const pct    = Math.round((xpProgressInLevel(xp) / XP_PER_LEVEL) * 100);
    const isGuest_ = isGuest();
    const isDev  = isDevUser();

    return `
      <div style="padding: var(--sp-md); display:flex; flex-direction:column; gap: var(--sp-sm);">
        <div style="display:flex; align-items:center; gap: var(--sp-sm);">
          <div class="avatar-wrap" style="width:40px;height:40px;position:relative;overflow:visible;">
            <div class="avatar avatar-sm" style="
              width:40px;height:40px;
              background: var(--accent-dim);
              display:flex;align-items:center;justify-content:center;
              font-size:0.8rem;color:var(--accent-primary);font-weight:600;
              overflow:hidden;
            ">${(user._avatarUrl || user.photoURL)
              ? `<img src="${user._avatarUrl || user.photoURL}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML='${(user.displayName || user.email || "G")[0].toUpperCase()}'" />`
              : (user.displayName || user.email || "G")[0].toUpperCase()
            }</div>
          </div>
          <div style="flex:1;min-width:0;">
            <div class="truncate" style="font-size:0.875rem;font-weight:500;">${user.displayName || user.email || "Guest"}</div>
            <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:2px;">
              ${isDev    ? '<span class="badge badge-dev">DEV</span>' : ""}
              ${isGuest_ ? '<span class="badge badge-local">Guest</span>' : ""}
              ${!isGuest_ && !user._isLocal ? '<span class="badge badge-cloud">Cloud</span>' : ""}
              ${user._isLocal ? '<span class="badge badge-local">Local</span>' : ""}
            </div>
          </div>
          <div class="xp-badge">Lv.${level}</div>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span style="font-size:0.72rem;color:var(--text-muted);font-family:var(--font-mono);">${xp} XP</span>
            <span style="font-size:0.72rem;color:var(--text-muted);font-family:var(--font-mono);">${pct}%</span>
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar-fill" style="width:${pct}%"></div>
          </div>
        </div>
      </div>
    `;
  }

  _renderUserSummary() {
    const el = this.container.querySelector("#right-user-summary");
    if (el) el.innerHTML = this._userSummaryHTML();
    this._applyAvatarDecor();
  }

  _applyAvatarDecor() {
    const wrap = this.container.querySelector(".avatar-wrap");
    if (!wrap) return;

    // Momentum ring
    if (this._ring) {
      this._ring.destroy();
      this._ring = null;
    }
    this._ring = new MomentumRing(wrap);

    // Avatar frame (loads from profile store via applyFromFirestore)
    FrameRenderer.applyFromFirestore(wrap, 40);
  }

  _bindEvents() {
    this.container.addEventListener("click", (e) => {
      const item = e.target.closest("[data-id]");
      if (!item) return;
      const id = item.dataset.id;

      if (id === "sign-out") {
        signOut().then(() => eventBus.emit("nav:showAuth"));
        return;
      }

      this.setActive(id);
      this.onNavigate?.(id);
    });

    const collapseBtn = this.container.querySelector("#right-collapse-btn");
    collapseBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleCollapse();
    });
  }

  setActive(id) {
    this.activeId = id;
    this.container.querySelectorAll(".nav-item").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.id === id);
    });
  }

  toggleCollapse() {
    this.collapsed = !this.collapsed;
    this.container.classList.toggle("collapsed", this.collapsed);
    eventBus.emit("layout:rightPanelCollapsed", this.collapsed);
  }

  updateProgress(prog) {
    this.progress = prog;
    this._renderUserSummary();
  }
}

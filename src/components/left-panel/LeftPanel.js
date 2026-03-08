/**
 * Vaultria — Left Panel Component
 * Tools navigation: Review/Errors, Vault, Phrase Library, Challenges, Support Me
 */

import { eventBus } from "../../utils/eventBus.js";
import { KOFI_URL } from "../../utils/constants.js";

const NAV_ITEMS = [
  {
    id:    "lessons",
    label: "Lessons",
    icon:  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
  },
  {
    id:    "review",
    label: "Review",
    icon:  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>`,
  },
  {
    id:    "vault",
    label: "Vault",
    icon:  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1"/></svg>`,
    requiresStage: 6,
  },
  {
    id:    "phrases",
    label: "Phrase Library",
    icon:  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  },
  {
    id:    "challenges",
    label: "Challenges",
    icon:  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  },
  {
    id:    "arena",
    label: "Arena",
    icon:  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>`,
  },
];

export class LeftPanel {
  constructor({ container, onNavigate }) {
    this.container  = container;
    this.onNavigate = onNavigate;
    this.collapsed  = false;
    this.activeId   = "review";
    this.stageUnlocked = 0;

    this.render();
    this._bindEvents();

    eventBus.on("progress:update", ({ stageUnlocked }) => {
      this.stageUnlocked = stageUnlocked || 0;
      this._refreshVaultItem();
    });
  }

  render() {
    this.container.innerHTML = `
      <div class="panel-header">
        <button class="panel-logo-btn" id="nav-home-btn" style="background:none;border:none;cursor:pointer;font-family:var(--font-display);font-size:1.05rem;font-weight:300;letter-spacing:0.14em;color:var(--text-primary);padding:0;">Vaultria</button>
        <button class="panel-collapse-btn btn-icon" id="left-collapse-btn" aria-label="Collapse panel">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
      </div>

      <nav class="panel-nav" id="left-nav">
        ${NAV_ITEMS.map((item) => this._renderNavItem(item)).join("")}
        <div class="nav-divider"></div>
        <button class="nav-item" id="nav-support" data-id="support">
          <span class="nav-item-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </span>
          <span class="nav-item-label">Support</span>
        </button>
      </nav>

      <div class="panel-footer">
        <button class="nav-item" id="nav-back-lang" data-id="back-lang">
          <span class="nav-item-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </span>
          <span class="nav-item-label">Switch Language</span>
        </button>
      </div>
    `;
  }

  _renderNavItem(item) {
    const isActive = this.activeId === item.id;
    const isLocked = item.requiresStage !== undefined && this.stageUnlocked < item.requiresStage;
    return `
      <button
        class="nav-item${isActive ? " active" : ""}${isLocked ? " locked-item" : ""}"
        data-id="${item.id}"
        title="${item.label}${isLocked ? " (Unlock at Archivist)" : ""}"
        ${isLocked ? 'aria-disabled="true"' : ""}
      >
        <span class="nav-item-icon">${item.icon}</span>
        <span class="nav-item-label">${item.label}</span>
        ${isLocked ? `<span class="nav-item-icon" style="margin-left:auto;opacity:0.4"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>` : ""}
      </button>
    `;
  }

  _bindEvents() {
    this.container.addEventListener("click", (e) => {
      const item = e.target.closest("[data-id]");
      if (!item) return;

      const id = item.dataset.id;

      if (id === "support") {
        this.setActive("support");
        this.onNavigate?.("support");
        return;
      }

      if (id === "back-lang") {
        eventBus.emit("nav:backToLanguages");
        return;
      }

      // Don't navigate to locked items
      if (item.getAttribute("aria-disabled") === "true") return;

      this.setActive(id);
      this.onNavigate?.(id);
    });

    this._bindHomeBtn();
    const collapseBtn = this.container.querySelector("#left-collapse-btn");
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
    eventBus.emit("layout:leftPanelCollapsed", this.collapsed);
  }

  _refreshVaultItem() {
    // Re-render vault item locked/unlocked state
    const vaultBtn = this.container.querySelector('[data-id="vault"]');
    if (vaultBtn) {
      const isLocked = this.stageUnlocked < 6;
      vaultBtn.classList.toggle("locked-item", isLocked);
      if (isLocked) vaultBtn.setAttribute("aria-disabled", "true");
      else vaultBtn.removeAttribute("aria-disabled");
    }
  }

  setLang(lang) {
    this.lang = lang;
  }

  _bindHomeBtn() {
    this.container.querySelector("#nav-home-btn")?.addEventListener("click", () => {
      import("../../utils/eventBus.js").then(({eventBus}) => eventBus.emit("nav:home"));
    });
  }
}

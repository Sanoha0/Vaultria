/**
 * Vaultria — RewardSelector
 * Modal that presents curated Chronicle reward choices to the user.
 * Shown when chronicle:milestoneReady fires.
 */

import { eventBus }         from "../../utils/eventBus.js";
import { ChronicleSystem }  from "./ChronicleSystem.js";

function _icon(type) {
  const stroke = "rgba(255,255,255,0.72)";
  const common = `fill="none" stroke="${stroke}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"`;

  if (type === "soundscape") {
    return `<svg width="22" height="22" viewBox="0 0 24 24" ${common}><path d="M3 12h2l2-6 4 12 3-8 2 2h3"/></svg>`;
  }
  if (type === "frame") {
    return `<svg width="22" height="22" viewBox="0 0 24 24" ${common}><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 15l2-2 2 2 4-4"/></svg>`;
  }
  if (type === "desk") {
    return `<svg width="22" height="22" viewBox="0 0 24 24" ${common}><path d="M4 10h16"/><path d="M6 10v10"/><path d="M18 10v10"/><path d="M9 14h6"/></svg>`;
  }
  if (type === "parallax") {
    return `<svg width="22" height="22" viewBox="0 0 24 24" ${common}><path d="M4 17l4-4 3 3 5-6 4 7"/><path d="M4 7h16"/></svg>`;
  }
  if (type === "cursor") {
    return `<svg width="22" height="22" viewBox="0 0 24 24" ${common}><path d="M4 4l7 17 2-6 6-2z"/></svg>`;
  }

  return `<svg width="22" height="22" viewBox="0 0 24 24" ${common}><path d="M12 3v18"/><path d="M3 12h18"/></svg>`;
}

export class RewardSelector {
  constructor() {
    this._el      = null;
    this._handler = (data) => this._show(data);
    eventBus.on("chronicle:milestoneReady", this._handler);
  }

  _show({ level, title, flavor, choices }) {
    // Only show one at a time
    if (this._el) return;

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay chronicle-overlay";
    overlay.innerHTML = `
      <div class="modal-card chronicle-card" style="max-width:520px;">
        <div style="text-align:center;margin-bottom:var(--sp-md);">
          <div style="font-family:var(--font-display);font-size:0.75rem;
                      letter-spacing:0.12em;text-transform:uppercase;
                      color:var(--text-muted);margin-bottom:6px;">
            Level ${level} Milestone
          </div>
          <div style="font-family:var(--font-display);font-size:1.6rem;font-weight:600;
                      color:var(--text-primary);margin-bottom:4px;">${title}</div>
          <div style="font-size:0.85rem;color:var(--text-muted);">${flavor}</div>
        </div>

        <div style="font-size:0.78rem;color:var(--text-muted);text-align:center;
                    margin-bottom:var(--sp-md);">
          Choose one workspace enhancement:
        </div>

        <div class="chronicle-choices" style="
          display:flex;flex-direction:column;gap:var(--sp-sm);
          margin-bottom:var(--sp-lg);">
          ${choices.map(c => `
            <button class="chronicle-choice" data-id="${c.id}"
                    style="display:flex;align-items:flex-start;gap:var(--sp-md);
                           padding:var(--sp-md);
                           background:var(--bg-glass);
                           border:1px solid var(--border-subtle);
                           border-radius:var(--r-md);
                           text-align:left;cursor:pointer;
                           transition:border-color var(--t-fast),background var(--t-fast);">
              <span style="width:26px;height:26px;flex-shrink:0;display:flex;align-items:center;justify-content:center;opacity:0.9;">${_icon(c.type)}</span>
              <div>
                <div style="font-size:0.875rem;font-weight:600;
                             color:var(--text-primary);margin-bottom:2px;">${c.label}</div>
                <div style="font-size:0.78rem;color:var(--text-muted);">${c.desc}</div>
              </div>
            </button>`).join("")}
        </div>
      </div>`;

    // Choice selection
    overlay.querySelectorAll(".chronicle-choice").forEach(btn => {
      btn.addEventListener("mouseenter", () => {
        btn.style.borderColor = "var(--border-normal)";
        btn.style.background  = "var(--bg-hover)";
      });
      btn.addEventListener("mouseleave", () => {
        if (!btn.classList.contains("selected")) {
          btn.style.borderColor = "";
          btn.style.background  = "";
        }
      });
      btn.addEventListener("click", async () => {
        // Highlight selected
        overlay.querySelectorAll(".chronicle-choice").forEach(b => {
          b.classList.remove("selected");
          b.style.borderColor = "";
          b.style.background  = "";
        });
        btn.classList.add("selected");
        btn.style.borderColor = "var(--accent-primary)";
        btn.style.background  = "var(--accent-dim)";

        // Brief pause so the user sees the selection, then claim + close
        setTimeout(async () => {
          await ChronicleSystem.claimReward(level, btn.dataset.id);
          overlay.remove();
          this._el = null;
        }, 480);
      });
    });

    document.body.appendChild(overlay);
    this._el = overlay;
  }

  destroy() {
    eventBus.off("chronicle:milestoneReady", this._handler);
    this._el?.remove();
    this._el = null;
  }
}

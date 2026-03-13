/**
 * Vaultria — RewardSelector
 * Modal that presents curated Chronicle reward choices to the user.
 * Shown when chronicle:milestoneReady fires.
 */

import { eventBus }         from "../../utils/eventBus.js";
import { ChronicleSystem }  from "./ChronicleSystem.js";

const TYPE_ICONS = {
  soundscape: "🎧",
  frame:      "🖼",
  desk:       "🪵",
  parallax:   "✨",
  cursor:     "✒",
};

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
              <span style="font-size:1.5rem;flex-shrink:0;">${TYPE_ICONS[c.type] ?? "🎁"}</span>
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

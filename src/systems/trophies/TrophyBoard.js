/**
 * Vaultria — TrophyBoard
 * Replaces the Archivist Desk on the Profile page.
 *
 * Features:
 *  • Pinned Trophies row (up to 3, pinnable by owner)
 *  • Earned Trophy grid with hover tooltips
 *  • Companion wander strip at the bottom
 *  • Read-only viewer mode (editable: false)
 *  • Syncs earned+pinned list to profileStore on own profile load
 */

import { TROPHY_DEFS, TIER_STYLE, computeEarned } from "./TROPHY_DEFS.js";
import { updateProfile } from "../../services/profileStore.js";

// ── Companion emoji per familiar species ──────────────────────────
const SPECIES_EMOJI = {
  fox:    "🦊",
  cat:    "🐱",
  slime:  "💚",
  wolf:   "🐺",
  owl:    "🦉",
  rabbit: "🐇",
};

export class TrophyBoard {
  /**
   * @param {HTMLElement} container
   * @param {Object} opts
   * @param {Object}   opts.progress        Current-language progress object
   * @param {Object}   opts.allProgress     All-languages progress map
   * @param {Object}   opts.profile         profileStore data (seals, momentum, trophies, etc.)
   * @param {boolean}  opts.editable        Owner view = true; viewer mode = false
   * @param {string[]|null} opts.earnedOverride  Pre-fetched earned IDs for viewer mode
   */
  constructor(container, opts = {}) {
    this._el             = container;
    this._data           = {
      progress:    opts.progress    || {},
      allProgress: opts.allProgress || {},
      profile:     opts.profile     || {},
    };
    this._editable       = opts.editable !== false;
    this._earnedOverride = opts.earnedOverride || null;
    this._pinned         = Array.isArray(opts.profile?.trophies?.pinned)
      ? [...opts.profile.trophies.pinned]
      : [];
    this._famEmoji = SPECIES_EMOJI[opts.profile?.familiar?.species] || SPECIES_EMOJI.fox;
    this._famX     = 20 + Math.random() * 60;
    this._famDir   = Math.random() > 0.5 ? 1 : -1;
    this._famIdle  = false;
    this._timer    = null;

    this._render();
    this._startWander();
  }

  // ── Compute earned list ───────────────────────────────────────────
  _earned() {
    if (this._earnedOverride) {
      return TROPHY_DEFS.filter(t => this._earnedOverride.includes(t.id));
    }
    return computeEarned(this._data);
  }

  // ── Render ────────────────────────────────────────────────────────
  _render() {
    const earned    = this._earned();
    const earnedSet = new Set(earned.map(t => t.id));
    const pinSet    = new Set(this._pinned);

    // Pinned items (only if actually earned)
    const pinnedItems = this._pinned
      .map(id => TROPHY_DEFS.find(t => t.id === id))
      .filter(t => t && earnedSet.has(t.id));

    // Remaining earned (not pinned)
    const unpinned = earned.filter(t => !pinSet.has(t.id));
    const locked   = TROPHY_DEFS.length - earned.length;

    const cardHTML = (t, isPinned) => {
      const s = TIER_STYLE[t.tier] || TIER_STYLE.bronze;
      const pinBtn = this._editable
        ? `<button class="tb-pin" data-id="${t.id}"
             title="${isPinned ? "Unpin trophy" : "Pin to top row"}"
             style="position:absolute;top:4px;right:4px;background:none;border:none;cursor:pointer;
                    font-size:0.72rem;opacity:${isPinned ? "0.85" : "0.25"};padding:2px;line-height:1;
                    transition:opacity 0.15s;">📌</button>`
        : "";
      return `<div class="tb-card" data-id="${t.id}"
                style="position:relative;display:flex;flex-direction:column;align-items:center;
                       gap:3px;padding:10px 6px 8px;border-radius:10px;
                       border:1px solid ${s.color}28;
                       background:linear-gradient(145deg,${s.color}0a,transparent);
                       cursor:default;min-width:64px;max-width:76px;
                       transition:border-color 0.15s,box-shadow 0.15s;">
          ${pinBtn}
          <div style="font-size:1.55rem;line-height:1;
                      filter:drop-shadow(0 0 5px ${s.color}70);">${t.icon}</div>
          <div style="font-size:0.56rem;font-family:var(--font-mono);color:${s.color};
                      text-align:center;letter-spacing:0.06em;font-weight:600;
                      max-width:62px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            ${t.name}
          </div>
          <div style="width:22px;height:1.5px;border-radius:1px;background:${s.color}40;"></div>
        </div>`;
    };

    const emptySlot = () =>
      `<div style="min-width:64px;height:88px;border-radius:10px;
                   border:1px dashed var(--border-subtle);
                   display:flex;align-items:center;justify-content:center;
                   font-size:1.1rem;color:var(--text-muted);opacity:0.2;">◦</div>`;

    const pinRow = Array.from({ length: 3 }, (_, i) =>
      pinnedItems[i] ? cardHTML(pinnedItems[i], true) : emptySlot()
    ).join("");

    const pinHint = this._editable
      ? "<span style='opacity:0.5;'> · click 📌 to pin</span>"
      : "";

    this._el.innerHTML = `
<div class="trophy-board" style="display:flex;flex-direction:column;">

  <!-- Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
    <div style="display:flex;align-items:center;gap:6px;">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
           stroke="rgba(255,255,255,0.28)" stroke-width="2.2">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
        <path d="M4 22h16"/>
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
      </svg>
      <span style="font-size:0.6rem;letter-spacing:0.14em;text-transform:uppercase;
                   color:var(--text-muted);font-family:var(--font-mono);">Trophy Board</span>
    </div>
    <span style="font-size:0.6rem;color:var(--text-muted);font-family:var(--font-mono);">
      ${earned.length}/${TROPHY_DEFS.length}
    </span>
  </div>

  <!-- Pinned row -->
  <div style="margin-bottom:12px;">
    <div style="font-size:0.54rem;letter-spacing:0.12em;text-transform:uppercase;
                color:var(--text-muted);opacity:0.6;font-family:var(--font-mono);margin-bottom:6px;">
      Pinned${pinHint}
    </div>
    <div id="tb-pinned" style="display:flex;gap:6px;flex-wrap:nowrap;">${pinRow}</div>
  </div>

  <div style="height:1px;background:var(--border-subtle);margin-bottom:10px;"></div>

  <!-- Earned trophy grid -->
  <div id="tb-grid" style="display:flex;flex-wrap:wrap;gap:6px;min-height:20px;">
    ${unpinned.length
      ? unpinned.map(t => cardHTML(t, false)).join("")
      : `<div style="font-size:0.78rem;color:var(--text-muted);padding:6px 0;font-style:italic;">
           ${earned.length === 0
             ? "Complete lessons to earn trophies"
             : "All earned trophies are pinned above"}
         </div>`
    }
  </div>

  ${locked > 0
    ? `<div style="font-size:0.57rem;color:var(--text-muted);font-family:var(--font-mono);
                   margin-top:8px;opacity:0.45;">${locked} more to unlock</div>`
    : ""}

  <!-- Companion wander strip -->
  <div id="tb-companion" style="position:relative;height:52px;margin-top:14px;
                                  overflow:hidden;border-top:1px solid var(--border-subtle);
                                  border-radius:0 0 10px 10px;
                                  background:linear-gradient(transparent,rgba(255,255,255,0.02));">
    <div id="tb-fam"
         style="position:absolute;bottom:5px;left:${this._famX}%;
                transform:translateX(-50%)${this._famDir < 0 ? " scaleX(-1)" : ""};
                font-size:1.4rem;user-select:none;cursor:default;will-change:left;
                transition:left 2.8s cubic-bezier(0.45,0,0.55,1);"
         title="Your companion">
      ${this._famEmoji}
    </div>
  </div>

</div>`;

    this._addTooltips();
    if (this._editable) this._addPinHandlers();

    // Sync earned IDs back to profileStore so viewers can read them
    if (this._editable && !this._earnedOverride) {
      const earnedIds = earned.map(t => t.id);
      updateProfile(p => {
        p.trophies = p.trophies || {};
        // Only write if changed (avoid infinite loops)
        if (JSON.stringify(p.trophies.earned) !== JSON.stringify(earnedIds)) {
          p.trophies.earned = earnedIds;
        }
        return p;
      }).catch(() => {});
    }
  }

  // ── Hover tooltips ────────────────────────────────────────────────
  _addTooltips() {
    this._el.querySelectorAll(".tb-card").forEach(el => {
      const id  = el.dataset.id;
      const def = TROPHY_DEFS.find(t => t.id === id);
      if (!def) return;
      const s   = TIER_STYLE[def.tier] || TIER_STYLE.bronze;
      let tip   = null;

      el.addEventListener("mouseenter", () => {
        tip = document.createElement("div");
        tip.className = "tb-tooltip";
        tip.style.cssText = [
          "position:fixed;z-index:600",
          "background:var(--bg-surface)",
          `border:1px solid ${s.color}35`,
          "border-radius:10px",
          "padding:10px 14px",
          "font-size:0.74rem",
          "max-width:178px",
          `box-shadow:0 8px 32px rgba(0,0,0,0.55),0 0 14px ${s.color}18`,
          "pointer-events:none",
        ].join(";");
        tip.innerHTML = `
          <div style="font-weight:600;color:${s.color};margin-bottom:4px;">${def.icon} ${def.name}</div>
          <div style="color:var(--text-secondary);line-height:1.45;">${def.desc}</div>
          <div style="font-size:0.58rem;color:var(--text-muted);font-family:var(--font-mono);
                      margin-top:5px;text-transform:uppercase;letter-spacing:0.08em;">
            ${s.label} Trophy
          </div>`;
        document.body.appendChild(tip);
        const r     = el.getBoundingClientRect();
        tip.style.left = Math.min(r.left, window.innerWidth - 200) + "px";
        tip.style.top  = (r.bottom + 6) + "px";
      });

      el.addEventListener("mouseleave", () => { tip?.remove(); tip = null; });
    });
  }

  // ── Pin / Unpin handlers ──────────────────────────────────────────
  _addPinHandlers() {
    this._el.querySelectorAll(".tb-pin").forEach(btn => {
      // Hover glow
      btn.addEventListener("mouseenter", () => { btn.style.opacity = "1"; });
      btn.addEventListener("mouseleave", () => {
        btn.style.opacity = this._pinned.includes(btn.dataset.id) ? "0.85" : "0.25";
      });

      btn.addEventListener("click", async e => {
        e.stopPropagation();
        const id       = btn.dataset.id;
        const isPinned = this._pinned.includes(id);
        if (isPinned) {
          this._pinned = this._pinned.filter(p => p !== id);
        } else {
          this._pinned = this._pinned.length >= 3
            ? [...this._pinned.slice(1), id]   // slide window, keep newest 3
            : [...this._pinned, id];
        }
        await updateProfile(p => {
          p.trophies = p.trophies || {};
          p.trophies.pinned = [...this._pinned];
          return p;
        }).catch(() => {});
        this._render();
        this._startWander(); // restart companion after re-render
      });
    });
  }

  // ── Companion wandering animation ─────────────────────────────────
  _startWander() {
    clearTimeout(this._timer);

    const step = () => {
      if (!this._el.isConnected) return;
      const fam = this._el.querySelector("#tb-fam");
      if (!fam) return;

      // Occasional idle pause (25% chance each step)
      if (!this._famIdle && Math.random() < 0.25) {
        this._famIdle = true;
        fam.style.transition = "left 0.1s";
        this._timer = setTimeout(() => {
          this._famIdle = false;
          step();
        }, 1600 + Math.random() * 2600);
        return;
      }
      this._famIdle = false;

      const delta = 10 + Math.random() * 25;
      this._famX += this._famDir * delta;

      // Bounce at edges
      if (this._famX > 88)      { this._famX = 88; this._famDir = -1; }
      else if (this._famX < 8)  { this._famX =  8; this._famDir =  1; }

      fam.style.transition = "left 2.8s cubic-bezier(0.45,0,0.55,1)";
      fam.style.left       = this._famX + "%";
      fam.style.transform  = `translateX(-50%)${this._famDir < 0 ? " scaleX(-1)" : ""}`;

      this._timer = setTimeout(step, 3000 + Math.random() * 2000);
    };

    this._timer = setTimeout(step, 1000 + Math.random() * 800);
  }

  // ── Cleanup ───────────────────────────────────────────────────────
  destroy() {
    clearTimeout(this._timer);
    document.querySelectorAll(".tb-tooltip").forEach(t => t.remove());
    this._el.innerHTML = "";
  }
}

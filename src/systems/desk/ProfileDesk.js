/**
 * Vaultria — ProfileDesk
 * Renders the 3D Archivist Desk surface with draggable artifact grid.
 * Mounts into a container element on the profile page.
 *
 * Usage:
 *   const desk = await ProfileDesk.mount(containerEl);
 *   desk.destroy();
 */

import { DESK_MATERIALS, ARTIFACT_CATALOG, CELL_SIZE, GRID_COLS, GRID_ROWS } from "./DESK_DEFS.js";
import { ArtifactGrid }   from "./ArtifactGrid.js";
import { renderSeal }     from "../seals/SealRenderer.js";
import { eventBus }       from "../../utils/eventBus.js";
import { getDb }          from "../../firebase/instance.js";
import { getUser }        from "../../auth/authService.js";

export class ProfileDesk {
  constructor(container, { material = "walnut", artifacts = [] } = {}) {
    this.container    = container;
    this._material    = material;
    this._artifacts   = artifacts;
    this._grid        = null;
    this._inspectEl   = null;
    this._inspectHandler = ({ id, x, y }) => this._showInspect(id, x, y);
    eventBus.on("desk:inspectArtifact", this._inspectHandler);
    this._render();
  }

  // ── Static factory: load from Firestore then mount ────────────────
  static async mount(container) {
    const user = getUser(); const db = getDb();
    let material  = "walnut";
    let artifacts = [];

    if (user && db) {
      try {
        const snap = await db.collection("users").doc(user.uid).get();
        const desk = snap.data()?.desk;
        if (desk) {
          material  = desk.material   ?? "walnut";
          artifacts = desk.artifacts  ?? [];
        }
      } catch (_) {}
    }
    return new ProfileDesk(container, { material, artifacts });
  }

  // ── Render ────────────────────────────────────────────────────────
  _render() {
    const mat = DESK_MATERIALS[this._material] ?? DESK_MATERIALS.walnut;
    const W   = GRID_COLS * CELL_SIZE;
    const H   = GRID_ROWS * CELL_SIZE;

    this.container.innerHTML = `
      <div class="profile-desk" style="
        width:${W}px;height:${H}px;
        background:${mat.surface};
        border:1px solid ${mat.edgeColor}88;
      ">
        <div class="profile-desk-grid" id="desk-grid" style="
          position:relative;width:100%;height:100%;overflow:hidden;
        ">
          <!-- Artifacts injected below -->
        </div>
        <div class="desk-material-label" style="color:${mat.textColor}">
          ${mat.label}
        </div>
      </div>`;

    const gridEl = this.container.querySelector("#desk-grid");

    // Inject artifact elements
    for (const a of this._artifacts) {
      const el = this._buildArtifactEl(a.id);
      if (el) gridEl.appendChild(el);
    }

    // Wire up the drag grid
    this._grid = new ArtifactGrid(gridEl, (layout) => this._persistLayout(layout));
    this._grid.loadLayout(this._artifacts);

    // Listen for new seals being awarded
    this._sealHandler = ({ lang, stageKey }) => {
      const id = `seal_${lang.slice(0,2)}_${stageKey}`;
      const el = this._buildArtifactEl(id);
      if (el) {
        gridEl.appendChild(el);
        this._grid.addArtifact(id);
      }
    };
    eventBus.on("seal:awarded", this._sealHandler);
  }

  // ── Build one artifact DOM element ────────────────────────────────
  _buildArtifactEl(id) {
    const def = ARTIFACT_CATALOG[id];
    if (!def) return null;

    const el = document.createElement("div");
    el.className          = "desk-artifact";
    el.dataset.artifact   = id;
    el.title              = def.label;

    if (def.type === "seal") {
      el.innerHTML = renderSeal(def.stage, 56, true);
    } else {
      // Placeholder for trophies/items — simple icon block
      el.innerHTML = `
        <div style="
          width:100%;height:100%;display:flex;flex-direction:column;
          align-items:center;justify-content:center;gap:4px;
          background:rgba(255,255,255,0.06);border-radius:10px;
          border:1px solid rgba(255,255,255,0.1);
        ">
          <span style="font-size:1.6rem;">${_iconFor(def.icon)}</span>
          <span style="font-size:0.6rem;color:rgba(255,255,255,0.4);
                       text-align:center;padding:0 4px;">${def.label}</span>
        </div>`;
    }
    return el;
  }

  // ── Inspect panel ─────────────────────────────────────────────────
  _showInspect(id, x, y) {
    this._inspectEl?.remove();
    const def = ARTIFACT_CATALOG[id];
    if (!def) return;

    const panel = document.createElement("div");
    panel.className = "desk-inspect-panel";
    panel.style.cssText = `
      position:fixed;left:${x + 12}px;top:${y - 8}px;z-index:200;
      background:var(--bg-surface);border:1px solid var(--border-normal);
      border-radius:var(--r-md);padding:12px 16px;
      min-width:160px;max-width:220px;
      box-shadow:0 8px 32px rgba(0,0,0,0.5);
      font-size:0.8rem;color:var(--text-secondary);
      animation:fadeIn 0.15s ease;pointer-events:auto;`;
    panel.innerHTML = `
      <div style="font-size:0.875rem;font-weight:600;color:var(--text-primary);
                  margin-bottom:6px;">${def.label}</div>
      <div style="font-size:0.75rem;color:var(--text-muted);text-transform:capitalize;">
        ${def.type}${def.lang ? ` · ${def.lang}` : ""}${def.stage ? ` · ${def.stage}` : ""}
      </div>`;

    const dismiss = (e) => {
      if (!panel.contains(e.target)) { panel.remove(); document.removeEventListener("mousedown", dismiss); }
    };
    document.body.appendChild(panel);
    this._inspectEl = panel;
    setTimeout(() => document.addEventListener("mousedown", dismiss), 50);
  }

  // ── Persist layout ────────────────────────────────────────────────
  async _persistLayout(layout) {
    const user = getUser(); const db = getDb();
    if (!user || !db) return;
    db.collection("users").doc(user.uid).update({
      "desk.artifacts": layout,
    }).catch(() => {});
  }

  destroy() {
    eventBus.off("desk:inspectArtifact", this._inspectHandler);
    if (this._sealHandler) eventBus.off("seal:awarded", this._sealHandler);
    this._inspectEl?.remove();
  }
}

function _iconFor(type) {
  const MAP = { arena:"🏟", scroll:"📜", people:"👥", pen:"✒", waves:"🌊" };
  return MAP[type] ?? "📦";
}

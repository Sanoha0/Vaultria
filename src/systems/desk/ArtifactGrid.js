/**
 * Vaultria — ArtifactGrid
 * Snap-to-grid drag-and-drop for Profile Board artifacts.
 * All artifacts are position:absolute inside a fixed-size container.
 */

import { GRID_COLS, GRID_ROWS, CELL_SIZE } from "./DESK_DEFS.js";
import { eventBus } from "../../utils/eventBus.js";

export class ArtifactGrid {
  constructor(deskEl, onLayoutChange) {
    this._desk      = deskEl;
    this._layout    = {};   // { artifactId: { col, row } }
    this._onChange  = onLayoutChange;
    this._bindEvents();
  }

  // ── Load saved layout ─────────────────────────────────────────────
  loadLayout(artifacts = []) {
    this._layout = {};
    for (const a of artifacts) {
      this._layout[a.id] = { col: a.col ?? 0, row: a.row ?? 0 };
    }
    this._syncPositions();
  }

  // ── Add a new artifact at next available cell ─────────────────────
  addArtifact(id) {
    if (this._layout[id]) return;
    const occupied = new Set(Object.values(this._layout).map(p => `${p.col},${p.row}`));
    let placed = false;
    outer: for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        if (!occupied.has(`${col},${row}`)) {
          this._layout[id] = { col, row };
          placed = true;
          break outer;
        }
      }
    }
    if (!placed) this._layout[id] = { col: 0, row: 0 };
    this._syncPositions();
    this._onChange(this._serialize());
  }

  // ── Sync DOM positions from layout ───────────────────────────────
  _syncPositions() {
    for (const [id, pos] of Object.entries(this._layout)) {
      const el = this._desk.querySelector(`[data-artifact="${id}"]`);
      if (!el) continue;
      el.style.left   = `${pos.col * CELL_SIZE}px`;
      el.style.top    = `${pos.row * CELL_SIZE}px`;
      el.style.width  = `${CELL_SIZE - 8}px`;
      el.style.height = `${CELL_SIZE - 8}px`;
    }
  }

  // ── Drag-and-drop ─────────────────────────────────────────────────
  _bindEvents() {
    this._desk.addEventListener("mousedown", (e) => {
      const artifact = e.target.closest("[data-artifact]");
      if (!artifact) return;
      e.preventDefault();

      const id      = artifact.dataset.artifact;
      const origPos = { ...this._layout[id] };
      const startX  = e.clientX;
      const startY  = e.clientY;

      artifact.classList.add("dragging");
      artifact.style.zIndex = "10";
      artifact.style.transition = "none";

      const onMove = (e) => {
        const dx  = e.clientX - startX;
        const dy  = e.clientY - startY;
        const col = Math.max(0, Math.min(Math.round(origPos.col + dx / CELL_SIZE), GRID_COLS - 1));
        const row = Math.max(0, Math.min(Math.round(origPos.row + dy / CELL_SIZE), GRID_ROWS - 1));
        artifact.style.left = `${col * CELL_SIZE}px`;
        artifact.style.top  = `${row * CELL_SIZE}px`;
      };

      const onUp = (e) => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup",   onUp);
        artifact.classList.remove("dragging");
        artifact.style.zIndex    = "";
        artifact.style.transition = "";

        const dx  = e.clientX - startX;
        const dy  = e.clientY - startY;
        const col = Math.max(0, Math.min(Math.round(origPos.col + dx / CELL_SIZE), GRID_COLS - 1));
        const row = Math.max(0, Math.min(Math.round(origPos.row + dy / CELL_SIZE), GRID_ROWS - 1));

        this._layout[id] = { col, row };
        this._syncPositions();
        this._onChange(this._serialize());
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup",   onUp);
    });

    // Right-click: inspect panel
    this._desk.addEventListener("contextmenu", (e) => {
      const artifact = e.target.closest("[data-artifact]");
      if (!artifact) return;
      e.preventDefault();
      eventBus.emit("desk:inspectArtifact", {
        id: artifact.dataset.artifact,
        x:  e.clientX,
        y:  e.clientY,
      });
    });
  }

  _serialize() {
    return Object.entries(this._layout).map(([id, pos]) => ({ id, ...pos }));
  }
}

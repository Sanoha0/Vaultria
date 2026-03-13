/**
 * Vaultria — FrameRenderer
 * Injects the active avatar frame SVG overlay into any avatar wrapper element.
 *
 * Usage:
 *   FrameRenderer.apply(avatarWrapperEl, "ink", 40);
 *   FrameRenderer.clear(avatarWrapperEl);
 */

import { FRAME_DEFS } from "./FRAME_DEFS.js";

export class FrameRenderer {
  static apply(container, frameId = "default", size = 40) {
    // Remove any existing frame
    FrameRenderer.clear(container);
    const def = FRAME_DEFS[frameId];
    if (!def || !def.build) return;
    const svgStr = def.build(size);
    if (!svgStr) return;

    container.style.position = "relative";
    const wrap = document.createElement("span");
    wrap.className   = "avatar-frame-wrap";
    wrap.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:3;";
    wrap.innerHTML   = svgStr;
    container.appendChild(wrap);
  }

  static clear(container) {
    container.querySelector(".avatar-frame-wrap")?.remove();
  }

  // ── Load from Firestore and apply ─────────────────────────────────
  static async applyFromFirestore(container, size = 40) {
    try {
      const { loadProfile } = await import("../../services/profileStore.js");
      const prof = await loadProfile();
      const frameId = prof?.identity?.frameId ?? "default";
      FrameRenderer.apply(container, frameId, size);
    } catch (_) {}
  }
}

/**
 * Vaultia — Toast & Reward Notifications
 * Regular toasts + cinematic XP / level-up / prestige popups
 */

let _container = null;

function getContainer() {
  if (!_container) {
    _container = document.createElement("div");
    _container.id = "toast-container";
    document.body.appendChild(_container);
  }
  return _container;
}

/**
 * Regular toast notification.
 */
export function showToast(message, type = "info", duration = 3000) {
  const container = getContainer();
  const toast = document.createElement("div");
  toast.className = `toast${type !== "info" ? ` toast-${type}` : ""}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px) scale(0.95)";
    toast.style.transition = "opacity 0.25s ease, transform 0.25s ease";
    setTimeout(() => toast.remove(), 280);
  }, duration);
}

function _injectStyles() {
  if (document.getElementById("vaultia-reward-styles")) return;
  const style = document.createElement("style");
  style.id = "vaultia-reward-styles";
  style.textContent = `
    @keyframes xp-slam {
      0%   { transform: scale(0.3) translateY(40px); opacity: 0; filter: blur(6px); }
      55%  { transform: scale(1.18) translateY(-8px); opacity: 1; filter: blur(0); }
      75%  { transform: scale(0.94) translateY(2px); }
      100% { transform: scale(1) translateY(0); opacity: 1; }
    }
    @keyframes xp-exit {
      0%   { transform: scale(1) translateY(0); opacity: 1; }
      100% { transform: scale(0.8) translateY(-30px); opacity: 0; }
    }
    @keyframes xp-shine {
      0%,100% { background-position: -200% center; }
      50%     { background-position: 200% center; }
    }
    @keyframes star-pop {
      0%   { transform: scale(0) rotate(-20deg); opacity: 0; }
      60%  { transform: scale(1.3) rotate(5deg); opacity: 1; }
      100% { transform: scale(1) rotate(0deg); opacity: 1; }
    }
    @keyframes level-flash {
      0%,100% { box-shadow: 0 0 0px transparent; }
      40%     { box-shadow: 0 0 60px 20px var(--xp-color, #a78bfa); }
    }
    @keyframes particle-burst {
      0%   { transform: translate(0,0) scale(1); opacity: 1; }
      100% { transform: translate(var(--px), var(--py)) scale(0); opacity: 0; }
    }
    @keyframes xp-number-bounce {
      0%  { transform: scale(1); }
      30% { transform: scale(1.35); }
      60% { transform: scale(0.9); }
      100%{ transform: scale(1); }
    }
    @keyframes prestige-ring {
      0%   { transform: scale(0.5); opacity: 0.8; }
      100% { transform: scale(2.5); opacity: 0; }
    }
    .xp-reward-overlay {
      position: fixed; inset: 0; z-index: 9000;
      display: flex; align-items: center; justify-content: center;
      pointer-events: none;
    }
    .xp-reward-card {
      pointer-events: all;
      animation: xp-slam 0.55s cubic-bezier(0.22,1,0.36,1) both;
      will-change: transform, opacity;
    }
    .xp-reward-card.exiting {
      animation: xp-exit 0.35s ease-in both;
    }
  `;
  document.head.appendChild(style);
}

function _detectAccent() {
  return getComputedStyle(document.documentElement)
    .getPropertyValue("--accent-primary")?.trim() || "#a78bfa";
}

function _burstParticles(overlay, accent, count = 14) {
  const colors = [accent, "#fff", accent + "bb", "#fbbf24", "#4ade80"];
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    const angle = (i / count) * 360;
    const dist  = 80 + Math.random() * 120;
    const px    = Math.round(Math.cos((angle * Math.PI) / 180) * dist) + "px";
    const py    = Math.round(Math.sin((angle * Math.PI) / 180) * dist) + "px";
    p.style.cssText = `
      position:absolute;top:50%;left:50%;
      width:${4 + Math.random() * 6}px;height:${4 + Math.random() * 6}px;
      border-radius:50%;background:${colors[i % colors.length]};
      --px:${px};--py:${py};
      animation:particle-burst ${0.6 + Math.random() * 0.4}s ease-out ${Math.random() * 0.15}s both;
      pointer-events:none;
    `;
    overlay.appendChild(p);
  }
}

/**
 * Cinematic XP popup — shown after every lesson.
 * @param {number} xpEarned
 * @param {number} stars  0-5
 * @param {{ oldLevel:number, newLevel:number }|null} levelUp
 */
export function showXpPopup(xpEarned, stars = 0, levelUp = null) {
  _injectStyles();
  const accent = _detectAccent();
  const overlay = document.createElement("div");
  overlay.className = "xp-reward-overlay";

  const starsHtml = stars > 0
    ? Array.from({ length: 5 }, (_, i) =>
        `<span style="display:inline-block;font-size:1.5rem;
          animation:star-pop 0.35s cubic-bezier(0.34,1.56,0.64,1) ${0.18 + i * 0.07}s both;
          filter:${i < stars ? "none" : "grayscale(1) opacity(0.25)"};"
        >${i < stars ? "⭐" : "☆"}</span>`
      ).join("")
    : "";

  const levelHtml = levelUp
    ? `<div style="margin-top:16px;padding:10px 22px;
        background:linear-gradient(135deg,${accent}30,${accent}15);
        border:1px solid ${accent}60;border-radius:50px;
        animation:level-flash 1s ease 0.4s both;--xp-color:${accent};">
        <span style="font-size:0.65rem;letter-spacing:0.2em;text-transform:uppercase;
          color:${accent};font-family:var(--font-mono);">LEVEL UP</span>
        <div style="font-size:1.5rem;font-weight:700;color:var(--text-primary);margin-top:2px;">
          ${levelUp.oldLevel} → <span style="color:${accent};">${levelUp.newLevel}</span>
        </div>
      </div>`
    : "";

  overlay.innerHTML = `
    <div class="xp-reward-card" style="
      background:var(--bg-surface);
      border:1px solid ${accent}50;border-radius:20px;
      padding:32px 40px;text-align:center;min-width:260px;
      box-shadow:0 0 0 1px ${accent}20,0 30px 80px rgba(0,0,0,0.6),0 0 40px ${accent}20;
      position:relative;overflow:hidden;cursor:pointer;
    ">
      <div style="position:absolute;inset:0;border-radius:20px;
        background:linear-gradient(105deg,transparent 30%,${accent}15 50%,transparent 70%);
        background-size:200% auto;animation:xp-shine 1.8s linear infinite;pointer-events:none;"></div>
      <div style="
        font-size:3.5rem;font-weight:800;font-family:var(--font-display);
        background:linear-gradient(135deg,${accent},#fff 60%,${accent});
        -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
        line-height:1;animation:xp-number-bounce 0.6s ease 0.3s both;letter-spacing:-0.02em;
      ">+${xpEarned}</div>
      <div style="font-size:0.65rem;letter-spacing:0.25em;text-transform:uppercase;
        color:${accent};font-family:var(--font-mono);margin-top:4px;
        margin-bottom:${starsHtml ? "14px" : "0"};">XP EARNED</div>
      ${starsHtml ? `<div style="margin-bottom:4px;">${starsHtml}</div>` : ""}
      ${levelHtml}
      <div style="margin-top:14px;font-size:0.65rem;color:var(--text-muted);opacity:0.6;">tap to continue</div>
    </div>`;

  _burstParticles(overlay, accent);
  document.body.appendChild(overlay);

  const dismiss = () => {
    const card = overlay.querySelector(".xp-reward-card");
    if (card) { card.classList.add("exiting"); setTimeout(() => overlay.remove(), 380); }
    else overlay.remove();
  };
  overlay.addEventListener("click", dismiss);
  setTimeout(dismiss, levelUp ? 4500 : 3000);
}

/**
 * Cinematic Prestige / Stage unlock popup.
 * @param {string} title
 * @param {string} sub
 * @param {string} icon
 */
export function showPrestigePopup(title, sub = "", icon = "🏆") {
  _injectStyles();
  const accent = _detectAccent();
  const overlay = document.createElement("div");
  overlay.className = "xp-reward-overlay";
  overlay.style.cssText = "background:rgba(0,0,0,0.75);pointer-events:all;backdrop-filter:blur(4px);";

  overlay.innerHTML = `
    <div class="xp-reward-card" style="
      background:linear-gradient(145deg,var(--bg-surface),var(--bg-panel));
      border:1px solid ${accent}60;border-radius:24px;
      padding:44px 52px;text-align:center;min-width:300px;max-width:380px;cursor:pointer;
      box-shadow:0 0 0 1px ${accent}30,0 40px 100px rgba(0,0,0,0.7),0 0 80px ${accent}25;
      position:relative;overflow:hidden;
    ">
      <!-- Pulse rings -->
      <div style="position:absolute;inset:0;border-radius:24px;
        background:radial-gradient(ellipse at 50% 0%,${accent}18 0%,transparent 70%);
        pointer-events:none;"></div>
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;">
        <div style="width:160px;height:160px;border-radius:50%;border:2px solid ${accent}40;
          animation:prestige-ring 1.4s ease-out 0.1s infinite;"></div>
        <div style="position:absolute;width:200px;height:200px;border-radius:50%;border:1px solid ${accent}25;
          animation:prestige-ring 1.4s ease-out 0.4s infinite;"></div>
      </div>
      <!-- Icon -->
      <div style="position:relative;display:inline-block;margin-bottom:18px;">
        <div style="position:absolute;inset:-12px;border-radius:50%;
          border:2px solid ${accent}40;animation:level-flash 1.5s ease infinite;--xp-color:${accent};"></div>
        <div style="font-size:3.2rem;animation:star-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.1s both;">${icon}</div>
      </div>
      <!-- Title -->
      <div style="font-size:1.6rem;font-weight:700;font-family:var(--font-display);
        background:linear-gradient(135deg,#fff 30%,${accent});
        -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
        line-height:1.15;margin-bottom:8px;animation:xp-number-bounce 0.6s ease 0.25s both;">${title}</div>
      ${sub ? `<div style="font-size:0.82rem;color:${accent};font-family:var(--font-mono);
        letter-spacing:0.12em;text-transform:uppercase;margin-bottom:20px;opacity:0.9;">${sub}</div>` : ""}
      <div style="font-size:0.65rem;color:var(--text-muted);opacity:0.5;letter-spacing:0.1em;">TAP TO CONTINUE</div>
    </div>`;

  _burstParticles(overlay, accent, 20);
  document.body.appendChild(overlay);

  const dismiss = () => {
    const card = overlay.querySelector(".xp-reward-card");
    if (card) { card.classList.add("exiting"); setTimeout(() => overlay.remove(), 380); }
    else overlay.remove();
  };
  overlay.addEventListener("click", dismiss);
  setTimeout(dismiss, 5500);
}

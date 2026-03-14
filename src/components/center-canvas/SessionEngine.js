/**
 * Vaultia — Session Engine v3
 * Drives vocabulary, typing_drill, script_recognition, checkpoint sessions.
 *
 * TTS integration (static-first):
 *  - preload() tells the browser to buffer static audio files before rendering
 *  - Auto-plays target word/phrase ONCE per item via _lastAutoplayKey guard
 *  - No noticeable delay: static files are already buffered by preload()
 *  - Play / Slow / Shadow buttons guarded by _speakWithGuard (no tap-spam)
 *  - Kana/script drills: all items preloaded at concur=8 immediately on open
 *  - Normal sessions: first 8 items preloaded before render, rest in background
 *  - Word-tap fires speak(); dedup handled by ttsService
 *  - Wrong answer → plays correct form after 400 ms
 *  - Correct typing drill → plays word back as positive reinforcement
 *  - stop() called on item advance and session complete only
 */

import { generateWhyCard, generateHint, semanticEval } from "../../services/tutorEngine.js";
import { fuzzyMatch }         from "../../utils/textUtils.js";
import { calculateStars }     from "../../utils/textUtils.js";
import { recordWeakWord, markWordCorrect } from "../../services/progressService.js";
import { eventBus }           from "../../utils/eventBus.js";
import {
  speak,
  stop,
  attachWordTap,
  startItemTimer,
  preload,
} from "../../services/ttsService.js";

export class SessionEngine {
  /**
   * @param {object}      opts
   * @param {HTMLElement} opts.container
   * @param {object}      opts.session
   * @param {string}      opts.langKey      "japanese" | "korean" | "spanish"
   * @param {object}      opts.progress
   * @param {string}      opts.register
   * @param {string}      opts.immersion
   * @param {function}    opts.onComplete({ stars, weakWords, xpEarned, accuracy })
   */
  constructor({ container, session, langKey, progress, register, immersion, onComplete }) {
    this.container  = container;
    this.session    = session;
    this.langKey    = langKey;
    this.progress   = progress;
    this.register   = register  || "natural";
    this.immersion  = immersion || "partial";
    this.onComplete = onComplete;

    this.items      = [...(session.items || [])];
    this.currentIdx = 0;
    this.hintLevel  = 0;
    this.hintsUsed  = 0;
    this.retries    = 0;
    this.mistakes   = 0;
    this.startTime  = Date.now();
    this.weakWords  = [...(progress.weakWords || [])];
    this.answered   = false;

    this._itemTimer = null;
    this._shadowMode = false;

    /**
     * Tracks which item has already had autoplay triggered.
     * Format: "idx::text"
     * Prevents double-play if _renderCurrentItem is called more than once
     * for the same item (e.g. after a hint, focus change, etc.).
     */
    this._lastAutoplayKey = null;

    /**
     * True while a speak() is in-flight.
     * Blocks repeated button taps while the audio is loading/playing.
     * Use force:true to bypass (correct/incorrect feedback).
     */
    this._speaking = false;

    this._preloadAndRender();
  }

  // ── Bootstrap ─────────────────────────────────────────────────────

  async _preloadAndRender() {
    const isScript = this._isScriptDrill();

    if (isScript) {
      // Kana/script drills: all items are short symbols.
      // Preload everything at once — static files buffer instantly.
      preload(this.items, this.langKey, 8);
    } else {
      // Standard sessions: preload first 8 before render (instant first cards),
      // continue the rest in the background after render.
      await preload(this.items.slice(0, 8), this.langKey);
    }

    this.render();

    if (!isScript && this.items.length > 8) {
      preload(this.items.slice(8), this.langKey);
    }
  }

  _isScriptDrill() {
    return (
      this.session.type === "script_recognition" ||
      this.items.every(it => {
        const t = it.target || it.phrase || "";
        return it.audio === false || t.length <= 3;
      })
    );
  }

  // ── Shell ─────────────────────────────────────────────────────────

  render() {
    this.container.innerHTML = `
      <div class="canvas-content session-wrapper">

        <div style="margin-bottom:var(--sp-lg);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-sm);">
            <span style="font-size:0.78rem;color:var(--text-muted);font-family:var(--font-mono);">
              ${this.session.title}
            </span>
            <span id="sess-counter" style="font-size:0.78rem;color:var(--text-muted);font-family:var(--font-mono);">
              1 / ${this.items.length}
            </span>
          </div>
          <div class="progress-bar-container">
            <div id="sess-progress-fill" class="progress-bar-fill" style="width:0%"></div>
          </div>
        </div>

        <div id="exercise-card" class="exercise-card"></div>
        <div id="input-area" style="margin-top:var(--sp-lg);"></div>
        <div id="why-card-area" style="margin-top:var(--sp-md);"></div>
        <div id="action-buttons" style="
          display:flex;gap:var(--sp-md);justify-content:center;
          margin-top:var(--sp-lg);flex-wrap:wrap;
        "></div>

      </div>
    `;
    this._renderCurrentItem();
  }

  // ── Item cycle ────────────────────────────────────────────────────

  _renderCurrentItem() {
    const item = this.items[this.currentIdx];
    if (!item) { this._complete(); return; }

    stop();   // silence previous item; never cancel in-flight fetches

    this.answered  = false;
    this.hintLevel = 0;
    this._speaking = false;

    this._updateProgress();
    this._renderExercise(item);
    this._renderInputArea(item);
    this._clearWhyCard();
    this._renderActionButtons(item, false);

    this._itemTimer = startItemTimer(item, this.langKey);

    // ── Autoplay — fires ONCE per item ──
    // ttsText: the spoken form (item.audioText when display text differs from audio, e.g. kanji → reading)
    const ttsText     = item.audioText || item.target || item.phrase || item.prompt || "";
    const autoplayKey = `${this.currentIdx}::${ttsText}`;

    if (item.audio !== false && ttsText && this._lastAutoplayKey !== autoplayKey) {
      this._lastAutoplayKey = autoplayKey;
      // Static files are already buffered by preload — no perceptible delay.
      // The 60 ms pause lets the card paint before audio fires, which avoids
      // Chrome's autoplay policy edge cases on first interaction.
      setTimeout(() => {
        if (this._lastAutoplayKey === autoplayKey) {
          this._speakWithGuard(ttsText, this.langKey);
        }
      }, 60);
    }

    const card = this.container.querySelector("#exercise-card");
    if (card) attachWordTap(card);
  }

  /**
   * speak() wrapper that blocks duplicate calls while audio is loading/playing.
   * @param {boolean} [opts.force]  Bypass guard (feedback playback)
   */
  async _speakWithGuard(text, langKey, opts = {}) {
    if (opts.interrupt) { stop(); this._speaking = false; }
    if (this._speaking && !opts.force) return;
    this._speaking = true;
    try {
      await speak(text, langKey, opts);
    } finally {
      this._speaking = false;
    }
  }

  _updateProgress() {
    const pct     = Math.round((this.currentIdx / this.items.length) * 100);
    const fill    = this.container.querySelector("#sess-progress-fill");
    const counter = this.container.querySelector("#sess-counter");
    if (fill)    fill.style.width = pct + "%";
    if (counter) counter.textContent = `${this.currentIdx + 1} / ${this.items.length}`;
  }

  // ── Exercise card ─────────────────────────────────────────────────

  _renderExercise(item) {
    const card = this.container.querySelector("#exercise-card");
    if (!card) return;
    card.className = "exercise-card";

    const hasAudio    = item.audio !== false;
    // displayText: what is shown on the card (kanji, word, phrase as written)
    // ttsText: the spoken form — use item.audioText when display text differs (e.g. kanji reading)
    const displayText  = item.target || item.phrase || item.prompt || "";
    const ttsText      = item.audioText || displayText;
    const isCJK        = this.langKey === "japanese" || this.langKey === "korean";
    const targetDisplay = displayText ? this._wrapTappable(displayText, isCJK) : "";

    card.innerHTML = `
      <div class="exercise-target"
           style="cursor:${hasAudio ? "pointer" : "default"};"
           ${hasAudio
             ? `data-tts="${_esc(ttsText)}" data-lang="${this.langKey}" title="Tap to hear"`
             : ""}>
        ${targetDisplay}
      </div>

      ${item.romanji
        ? `<div class="exercise-romanji sess-hint-hidden" id="sess-romanji">${item.romanji}</div>`
        : ""}

      ${item.meaning
        ? `<div class="exercise-meaning sess-hint-hidden" id="sess-meaning">${item.meaning}</div>`
        : ""}

      ${item.context ? `
        <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:center;margin-top:4px;">
          ${item.context.split(" ").map(t =>
            `<span style="font-size:0.7rem;color:var(--text-muted);font-family:var(--font-mono);">${t}</span>`
          ).join("")}
        </div>` : ""}

      ${item.notes && this.immersion !== "full_immersion" ? `
        <div style="font-size:0.78rem;color:var(--text-muted);max-width:380px;text-align:center;font-style:italic;">
          ${item.notes}
        </div>` : ""}

      ${hasAudio ? `
        <div class="sess-audio-row" style="
          display:flex;gap:8px;justify-content:center;
          margin-top:12px;flex-wrap:wrap;
        ">
          <button class="btn btn-ghost btn-sm sess-tts-play" title="Play at normal speed">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Play
          </button>
          <button class="btn btn-ghost btn-sm sess-tts-slow" title="Play slowly">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            Slow
          </button>
          <button class="btn btn-ghost btn-sm sess-tts-shadow${this._shadowMode ? " active" : ""}"
                  title="Shadow mode: hear phrase → repeat aloud → hear again">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 18a5 5 0 0 0-10 0"/><line x1="12" y1="2" x2="12" y2="9"/>
            </svg>
            Shadow
          </button>
        </div>` : ""}
    `;

    if (hasAudio && ttsText) {
      card.querySelector(".exercise-target")?.addEventListener("click", () => {
        this._speakWithGuard(ttsText, this.langKey, { shadowing: this._shadowMode });
      });
      card.querySelector(".sess-tts-play")?.addEventListener("click", e => {
        e.stopPropagation();
        this._speakWithGuard(ttsText, this.langKey, { interrupt: true });
      });
      card.querySelector(".sess-tts-slow")?.addEventListener("click", e => {
        e.stopPropagation();
        this._speakWithGuard(ttsText, this.langKey, { slow: true, interrupt: true });
      });
      card.querySelector(".sess-tts-shadow")?.addEventListener("click", e => {
        e.stopPropagation();
        this._shadowMode = !this._shadowMode;
        e.currentTarget.classList.toggle("active", this._shadowMode);
        if (this._shadowMode) this._speakWithGuard(ttsText, this.langKey, { shadowing: true, interrupt: true });
      });
    }
  }

  _wrapTappable(text, isCJK) {
    if (isCJK) return _esc(text);
    return text.split(/\s+/).filter(Boolean).map(word =>
      `<span
        class="tts-word"
        data-tts="${_esc(word)}"
        data-lang="${this.langKey}"
        title="Tap to hear"
        style="cursor:pointer;border-bottom:1px dotted currentColor;opacity:0.85;transition:opacity 0.15s;"
        onmouseenter="this.style.opacity='1'"
        onmouseleave="this.style.opacity='0.85'"
      >${_esc(word)}</span>`
    ).join(" ");
  }

  // ── Input area ────────────────────────────────────────────────────

  _renderInputArea(item) {
    const area = this.container.querySelector("#input-area");
    if (!area) return;

    if (this.session.type === "typing_drill" || item.answer) {
      area.innerHTML = `
        <div style="max-width:440px;margin:0 auto;">
          <input
            class="input" id="sess-input" type="text"
            placeholder="Type your answer…"
            autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
            style="text-align:center;font-size:1.1rem;padding:14px var(--sp-lg);"
          >
          <div id="hint-text" class="hint-text"
               style="margin-top:var(--sp-sm);text-align:center;min-height:20px;"></div>
        </div>
      `;
      const input = area.querySelector("#sess-input");
      input?.focus();
      input?.addEventListener("keydown", e => {
        if (e.key === "Enter" && !this.answered) this._checkAnswer();
      });
    } else {
      area.innerHTML = "";
    }
  }

  // ── Action buttons ────────────────────────────────────────────────

  _renderActionButtons(item, isAnswered) {
    const area = this.container.querySelector("#action-buttons");
    if (!area) return;

    if (!isAnswered) {
      const hasInput = !!(this.container.querySelector("#sess-input"));
      area.innerHTML = `
        ${hasInput
          ? `<button class="btn btn-primary" id="btn-check">Check</button>`
          : `<button class="btn btn-primary" id="btn-got">Got It</button>`}
        <button class="btn btn-ghost btn-sm" id="btn-hint">Hint</button>
      `;
      area.querySelector("#btn-check")?.addEventListener("click", () => this._checkAnswer());
      area.querySelector("#btn-got")?.addEventListener("click",   () => this._markCorrect());
      area.querySelector("#btn-hint")?.addEventListener("click",  () => this._showHint(item));
    } else {
      area.innerHTML = `<button class="btn btn-primary" id="btn-next">Continue →</button>`;
      area.querySelector("#btn-next")?.addEventListener("click", () => {
        this.currentIdx++;
        this._renderCurrentItem();
      });
    }
  }

  // ── Answer checking ───────────────────────────────────────────────

  _checkAnswer() {
    if (this.answered) return;

    const input         = this.container.querySelector("#sess-input");
    const userAnswer    = input?.value?.trim() || "";
    const item          = this.items[this.currentIdx];
    const correctAnswer = item.answer || item.target || "";

    let correct = fuzzyMatch(userAnswer, correctAnswer);
    if (!correct && item.acceptedAnswers) {
      const { pass } = semanticEval(userAnswer, item.acceptedAnswers);
      correct = pass;
    }

    this.answered = true;
    this._itemTimer?.resolve(correct);

    if (correct) this._onCorrect(item);
    else         this._onIncorrect(item, userAnswer, correctAnswer);
  }

  _markCorrect() {
    if (this.answered) return;
    this.answered = true;
    this._itemTimer?.resolve(true);
    this._onCorrect(this.items[this.currentIdx]);
  }

  // ── Outcome handlers ──────────────────────────────────────────────

  _onCorrect(item) {
    this.weakWords = markWordCorrect(
      this.weakWords, item.target || item.word || "", this.langKey
    );

    const card = this.container.querySelector("#exercise-card");
    card?.classList.add("correct");
    setTimeout(() => card?.classList.remove("correct"), 800);

    eventBus.emit("session:correct");

    const isTypingDrill = !!(this.container.querySelector("#sess-input"));
    if (!isTypingDrill) {
      setTimeout(() => { this.currentIdx++; this._renderCurrentItem(); }, 700);
    } else {
      const text = item.target || item.phrase || "";
      if (text && item.audio !== false) {
        this._speakWithGuard(text, this.langKey, { force: true });
      }
      this._renderActionButtons(item, true);
    }
  }

  _onIncorrect(item, userAnswer, correctAnswer) {
    this.mistakes++;
    this.retries++;

    this.weakWords = recordWeakWord(
      this.weakWords, item.target || item.word || "", this.langKey
    );

    const card = this.container.querySelector("#exercise-card");
    card?.classList.add("incorrect");
    setTimeout(() => card?.classList.remove("incorrect"), 800);

    eventBus.emit("session:incorrect");

    const text = item.target || item.phrase || "";
    if (text && item.audio !== false) {
      setTimeout(() => this._speakWithGuard(text, this.langKey, { force: true }), 400);
    }

    const why = generateWhyCard(userAnswer, correctAnswer, {
      grammar:     item.grammar,
      register:    item.register,
      explanation: item.explanation,
      notes:       item.notes,
      grammarNote: item.grammarNote,
    });
    this._showWhyCard(why, correctAnswer);
    this._renderActionButtons(item, true);
  }

  // ── Hints ─────────────────────────────────────────────────────────

  _showHint(item) {
    this.hintsUsed++;
    const hintEl = this.container.querySelector("#hint-text");
    const isTypingDrill = !!(this.container.querySelector("#sess-input"));

    // Level 0 → reveal romanji on the exercise card
    if (this.hintLevel === 0 && (item.romanji || item.reading)) {
      const romEl = this.container.querySelector("#sess-romanji");
      if (romEl) {
        romEl.classList.remove("sess-hint-hidden");
        romEl.classList.add("sess-hint-reveal");
      }
      this.hintLevel = 1;
      return;
    }

    // Level 1 → reveal meaning on the exercise card
    if (this.hintLevel <= 1 && item.meaning) {
      const meanEl = this.container.querySelector("#sess-meaning");
      if (meanEl) {
        meanEl.classList.remove("sess-hint-hidden");
        meanEl.classList.add("sess-hint-reveal");
      }
      this.hintLevel = 2;
      return;
    }

    // Level 2+ → progressive character hints (typing drills)
    if (isTypingDrill && hintEl && this.hintLevel >= 2) {
      const hint = generateHint(item.answer || item.target || "", this.hintLevel - 2);
      hintEl.innerHTML = `<span style="font-family:var(--font-mono);">${hint}</span>`;
      this.hintLevel = Math.min(this.hintLevel + 1, 5);
      return;
    }

    // Fallback: show notes
    if (item.notes && hintEl) {
      hintEl.innerHTML = `<span style="color:var(--text-muted);font-style:italic;">${item.notes}</span>`;
      this.hintLevel++;
    }
  }

  // ── Why card ──────────────────────────────────────────────────────

  _showWhyCard({ errorType, whyCorrect, whyWrong }, correctAnswer) {
    const area = this.container.querySelector("#why-card-area");
    if (!area) return;
    area.innerHTML = `
      <div class="why-card error-card">
        <div class="why-card-header">
          Why this answer
          <span class="why-card-error-type">${errorType.replace("_", " ")}</span>
        </div>
        <div class="why-card-correct">✓ Correct: <strong>${correctAnswer}</strong></div>
        <div class="why-card-wrong">${whyWrong}</div>
        <div style="margin-top:var(--sp-sm);color:var(--text-muted);font-size:0.82rem;">${whyCorrect}</div>
      </div>
    `;
  }

  _clearWhyCard() {
    const area = this.container.querySelector("#why-card-area");
    if (area) area.innerHTML = "";
  }

  // ── Session complete ──────────────────────────────────────────────

  _complete() {
    stop();

    const totalItems = this.items.length || 1;
    const accuracy   = 1 - this.mistakes / totalItems;
    const speedMs    = Date.now() - this.startTime;
    const stars      = calculateStars({
      accuracy, speedMs, hintsUsed: this.hintsUsed, retries: this.retries,
    });
    const xpEarned = Math.round(50 * (0.4 + 0.6 * accuracy));

    this.container.querySelector(".session-wrapper")?.remove();
    this.container.innerHTML = `
      <div class="canvas-content" style="
        display:flex;flex-direction:column;align-items:center;
        justify-content:center;min-height:60vh;gap:var(--sp-xl);text-align:center;
      ">
        <div>
          <div style="font-size:3rem;margin-bottom:var(--sp-md);">✓</div>
          <h2 class="display-font" style="font-size:2rem;font-weight:300;margin-bottom:var(--sp-sm);">
            Session Complete
          </h2>
          <p style="color:var(--text-secondary);">${this.session.title}</p>
        </div>
        <div style="display:flex;gap:var(--sp-xl);flex-wrap:wrap;justify-content:center;">
          <div>
            <div class="stars" style="justify-content:center;gap:4px;margin-bottom:4px;">
              ${[1,2,3,4,5].map(i => `
                <svg class="star${i <= stars ? " filled" : ""}" width="24" height="24"
                     viewBox="0 0 24 24"
                     fill="${i <= stars ? "currentColor" : "none"}"
                     stroke="currentColor" stroke-width="1.5">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>`).join("")}
            </div>
            <div style="font-size:0.78rem;color:var(--text-muted);">${stars} / 5 stars</div>
          </div>
          <div>
            <div class="xp-badge" style="font-size:1.1rem;padding:6px 16px;">+${xpEarned} XP</div>
          </div>
          <div style="font-family:var(--font-mono);font-size:0.85rem;color:var(--text-secondary);">
            ${Math.round(accuracy * 100)}% accuracy
          </div>
        </div>
        <button class="btn btn-primary btn-lg" id="btn-done">Continue</button>
      </div>
    `;

    this.container.querySelector("#btn-done")?.addEventListener("click", () => {
      this.onComplete?.({ stars, weakWords: this.weakWords, xpEarned, accuracy, speedMs, hintsUsed: this.hintsUsed });
    });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function _esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Vaultia — Session Engine v2
 * Drives any session type: vocabulary, typing_drill, script_recognition, checkpoint.
 *
 * TTS integration:
 *  - Auto-plays target word/phrase ONCE per item (never on re-render of the same item)
 *  - Play / Slow / Shadow buttons debounced — tapping while loading is ignored
 *  - Kana/script drills: all visible symbols preloaded immediately on open
 *  - First 8 items preloaded before session renders; rest in background
 *  - Word-tap fires speak(); in-flight deduplication handled by ttsService
 *  - Wrong answer → plays correct form after 400 ms delay
 *  - Correct typing drill → plays word back as positive reinforcement
 *  - stop() called on item advance, never mid-item (avoids refetch cascade)
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
   * @param {string}      opts.langKey     "japanese" | "spanish" | "korean"
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
    this.register   = register   || "natural";
    this.immersion  = immersion  || "partial";
    this.onComplete = onComplete;

    this.items       = [...(session.items || [])];
    this.currentIdx  = 0;
    this.hintLevel   = 0;
    this.hintsUsed   = 0;
    this.retries     = 0;
    this.mistakes    = 0;
    this.startTime   = Date.now();
    this.weakWords   = [...(progress.weakWords || [])];
    this.answered    = false;

    this._itemTimer    = null;
    this._shadowMode   = false;

    /**
     * Key of the item whose autoplay has already been triggered.
     * Format: "idx::text" — prevents double-play if _renderCurrentItem is
     * called more than once for the same item (e.g. after hint, after focus).
     */
    this._lastAutoplayKey = null;

    /**
     * True while a speak() call is in-flight for a manual button tap.
     * Blocks duplicate taps while loading.
     */
    this._speaking = false;

    this._preloadAndRender();
  }

  // ── Bootstrap ─────────────────────────────────────────────────────

  async _preloadAndRender() {
    const isScript = this._isScriptDrill();

    if (isScript) {
      // Script/kana drills: preload ALL items immediately — they're short symbols
      // and we want zero latency on every card.
      preload(this.items, this.langKey, 6);
    } else {
      // Vocabulary / typing: preload the first 8 before rendering so the first
      // cards feel instant; continue the rest in the background after render.
      await preload(this.items.slice(0, 8), this.langKey);
    }

    this.render();

    if (!isScript && this.items.length > 8) {
      preload(this.items.slice(8), this.langKey);
    }
  }

  /** Returns true if this is a kana/script recognition drill. */
  _isScriptDrill() {
    return (
      this.session.type === "script_recognition" ||
      this.items.every(it => {
        const t = it.target || it.phrase || "";
        // Kana/hangul/single characters are short (≤ 3 chars) and audio:false
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
          display:flex;
          gap:var(--sp-md);
          justify-content:center;
          margin-top:var(--sp-lg);
          flex-wrap:wrap;
        "></div>

      </div>
    `;
    this._renderCurrentItem();
  }

  // ── Item cycle ────────────────────────────────────────────────────

  _renderCurrentItem() {
    const item = this.items[this.currentIdx];
    if (!item) { this._complete(); return; }

    // Stop prior item's audio on item advance
    stop();

    this.answered    = false;
    this.hintLevel   = 0;
    this._speaking   = false;

    this._updateProgress();
    this._renderExercise(item);
    this._renderInputArea(item);
    this._clearWhyCard();
    this._renderActionButtons(item, false);

    this._itemTimer = startItemTimer(item, this.langKey);

    // ── Autoplay guard ──
    // Fires ONCE per item. If _renderCurrentItem is called again for the same
    // item (shouldn't happen, but defensively), we skip the second play.
    const audioText = item.target || item.phrase || item.prompt || "";
    const autoplayKey = `${this.currentIdx}::${audioText}`;

    if (item.audio !== false && audioText && this._lastAutoplayKey !== autoplayKey) {
      this._lastAutoplayKey = autoplayKey;
      // Small delay so the card is painted before audio fires.
      // 80 ms is imperceptible to the learner but prevents Chrome audio-unlock issues.
      setTimeout(() => {
        // Only autoplay if we're still on the same item
        if (this._lastAutoplayKey === autoplayKey) {
          this._speakWithGuard(audioText, this.langKey);
        }
      }, 80);
    }

    const card = this.container.querySelector("#exercise-card");
    if (card) attachWordTap(card);
  }

  /**
   * Wrapper around speak() that:
   *  - Sets _speaking = true while the fetch + play is in progress
   *  - Resets _speaking on completion/failure
   *  - Blocks concurrent calls for the same or a new tap while loading
   *
   * @param {string}  text
   * @param {string}  langKey
   * @param {object}  [opts]
   * @param {boolean} [opts.force]  Skip the _speaking guard (for correct/incorrect feedback)
   */
  async _speakWithGuard(text, langKey, opts = {}) {
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

    const showTranslation = this.immersion !== "full_immersion";
    const showRomanji     = this.immersion === "full_translation" ||
                            (this.immersion === "partial" && this.langKey === "japanese");

    const hasAudio  = item.audio !== false;
    const audioText = item.target || item.phrase || item.prompt || "";
    const isCJK     = this.langKey === "japanese" || this.langKey === "korean";
    const targetDisplay = audioText ? this._wrapTappable(audioText, isCJK) : "";

    card.innerHTML = `
      <div class="exercise-target"
           style="cursor:${hasAudio ? "pointer" : "default"};"
           ${hasAudio
             ? `data-tts="${_esc(audioText)}" data-lang="${this.langKey}" title="Tap to hear"`
             : ""}>
        ${targetDisplay}
      </div>

      ${showRomanji && item.romanji
        ? `<div class="exercise-romanji">${item.romanji}</div>`
        : ""}

      ${showTranslation && item.meaning
        ? `<div class="exercise-meaning">${item.meaning}</div>`
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

    if (hasAudio && audioText) {
      // Tap target text → play (respects shadow mode, guarded against spam)
      card.querySelector(".exercise-target")?.addEventListener("click", () => {
        this._speakWithGuard(audioText, this.langKey, { shadowing: this._shadowMode });
      });

      // Play button — guarded
      card.querySelector(".sess-tts-play")?.addEventListener("click", (e) => {
        e.stopPropagation();
        this._speakWithGuard(audioText, this.langKey);
      });

      // Slow button — guarded
      card.querySelector(".sess-tts-slow")?.addEventListener("click", (e) => {
        e.stopPropagation();
        this._speakWithGuard(audioText, this.langKey, { slow: true });
      });

      // Shadow toggle — not guarded (toggle is instant, play is guarded inside)
      card.querySelector(".sess-tts-shadow")?.addEventListener("click", (e) => {
        e.stopPropagation();
        this._shadowMode = !this._shadowMode;
        e.currentTarget.classList.toggle("active", this._shadowMode);
        if (this._shadowMode) {
          this._speakWithGuard(audioText, this.langKey, { shadowing: true });
        }
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
        style="
          cursor:pointer;
          border-bottom:1px dotted currentColor;
          opacity:0.85;
          transition:opacity 0.15s;
        "
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
            class="input"
            id="sess-input"
            type="text"
            placeholder="Type your answer…"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
            style="text-align:center;font-size:1.1rem;padding:14px var(--sp-lg);"
          >
          <div id="hint-text" class="hint-text"
               style="margin-top:var(--sp-sm);text-align:center;min-height:20px;"></div>
        </div>
      `;
      const input = area.querySelector("#sess-input");
      input?.focus();
      input?.addEventListener("keydown", (e) => {
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
      // Use force:true — this is explicit positive reinforcement, not autoplay
      if (text && item.audio !== false) this._speakWithGuard(text, this.langKey, { force: true });
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
      // Delay so the red flash is visible before the word plays
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
    if (!hintEl) return;

    const isTypingDrill = !!(this.container.querySelector("#sess-input"));

    if (this.hintLevel === 0 && (item.romanji || item.reading)) {
      hintEl.innerHTML = `
        <span style="font-family:var(--font-mono);opacity:0.85;">
          ${item.romanji || item.reading}
        </span>`;
      this.hintLevel = 1;
    } else if (this.hintLevel <= 1 && item.meaning) {
      hintEl.innerHTML = `<span style="color:var(--text-secondary);">${item.meaning}</span>`;
      this.hintLevel = 2;
    } else if (isTypingDrill && this.hintLevel >= 2) {
      const correctAnswer = item.answer || item.target || "";
      const hint = generateHint(correctAnswer, this.hintLevel - 2);
      hintEl.innerHTML = `<span style="font-family:var(--font-mono);">${hint}</span>`;
      this.hintLevel = Math.min(this.hintLevel + 1, 5);
    } else if (item.notes) {
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
        <div class="why-card-correct">
          ✓ Correct: <strong>${correctAnswer}</strong>
        </div>
        <div class="why-card-wrong">${whyWrong}</div>
        <div style="margin-top:var(--sp-sm);color:var(--text-muted);font-size:0.82rem;">
          ${whyCorrect}
        </div>
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
      this.onComplete?.({ stars, weakWords: this.weakWords, xpEarned, accuracy });
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

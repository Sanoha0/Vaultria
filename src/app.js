/**
 * Vaultia — App Orchestrator v3 (Production Demo)
 * Full workstation: workspace, all pages, skill tree, social feed, dev panel.
 */

import { initFirebase, getDb }  from "./firebase/instance.js";
import { listenAuthState, getUser, isDevUser, isGuest } from "./auth/authService.js";
import { loadAllProgress, saveProgress, loadProgress, defaultProgress } from "./services/progressService.js";
import { buildReviewQueue }    from "./services/tutorEngine.js";
import { eventBus }            from "./utils/eventBus.js";
import { showToast, showXpPopup, showPrestigePopup } from "./components/ui/Toast.js";
import { LeftPanel }           from "./components/left-panel/LeftPanel.js";
import { RightPanel }          from "./components/right-panel/RightPanel.js";
import { AuthModal }           from "./components/modals/AuthModal.js";
import { LanguageHub }         from "./pages/LanguageHub.js";
import { SessionEngine }       from "./components/center-canvas/SessionEngine.js";
import { speak as ttsSpeak }  from "./services/ttsService.js";
import { xpToLevel, xpProgressInLevel } from "./utils/textUtils.js";
import { XP_PER_LEVEL, KOFI_URL } from "./utils/constants.js";
import {
  heartbeat, setOffline, syncProgressToProfile,
  loadLeaderboard, loadReplies, createPlazaPost, replyToPost, toggleLike,
  loadFriends, sendFriendRequest, acceptFriendRequest, removeFriend,
  getFriendStatus, searchUsers, subscribePlaza, subscribeFriendRequests,
  subscribeOnlineFriends, subscribeLeaderboard, subscribeReplies,
  deletePlazaPost, deletePlazaReply, subscribeGlobalActivity,
  updateProfile, setTyping, subscribeTyping, loadMyArenaMatches,
} from "./services/socialService.js";


// ── Accent colors per language ────────────────────────────────────
const ACCENT = { japanese:"#e8a0b8", korean:"#4db8ff", spanish:"#e8a44a" };
const LABEL  = { japanese:"Japanese", korean:"Korean", spanish:"Spanish" };

// ── Language backgrounds (Unsplash free-to-use photos) ─────────────
const LANG_BG = {
  japanese: "https://images.unsplash.com/photo-1522383225653-ed111181a951?w=1600&q=80&fit=crop", // Fushimi Inari torii gates
  korean:   "https://images.unsplash.com/photo-1549633030-89d2b9e2a4b7?w=1600&q=80&fit=crop", // Seoul city neon night
  spanish:  "https://images.unsplash.com/photo-1543783207-ec64e4d95325?w=1600&q=80&fit=crop", // Colorful Mexican street
};
const LANG_BG_ALT = {
  japanese: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1600&q=80&fit=crop", // Tokyo night
  korean:   "https://images.unsplash.com/photo-1601046668428-94ea13437736?w=1600&q=80&fit=crop", // Gyeongbokgung palace
  spanish:  "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=80&fit=crop", // Spain architecture
};

// ── Plaza post categories ──────────────────────────────────────────
const PLAZA_CATEGORIES = [
  { id:"question",    label:"Question",    icon:"❓", color:"#a78bfa" },
  { id:"discussion",  label:"Discussion",  icon:"💬", color:"#4db8ff" },
  { id:"tip",         label:"Tip",         icon:"💡", color:"#fbbf24" },
  { id:"meme",        label:"Meme/Humor",  icon:"😂", color:"#4ade80" },
  { id:"progress",    label:"Progress",    icon:"🏆", color:"#f472b6" },
  { id:"resource",    label:"Resource",    icon:"📚", color:"#e8a44a" },
];

// ── Profanity filter (basic — expandable) ─────────────────────────
const BAD_WORDS = ["fuck","shit","ass","bitch","cunt","dick","cock","pussy","nigger","nigga","fag","faggot","whore","slut","bastard","damn","hell","crap","piss","twat","wanker","bollocks","motherfucker","asshole","bullshit"];
function _filterContent(text) {
  if (!text) return { clean: text, blocked: false };
  const lower = text.toLowerCase();
  const found = BAD_WORDS.filter(w => {
    const re = new RegExp(`\\b${w}\\b`, "i");
    return re.test(lower);
  });
  if (!found.length) return { clean: text, blocked: false };
  let clean = text;
  found.forEach(w => {
    clean = clean.replace(new RegExp(`\\b${w}\\b`, "gi"), m => m[0] + "*".repeat(m.length - 1));
  });
  return { clean, blocked: false }; // censor but don't block entirely
}
function _isBlocked(text) {
  // Block only the most severe — everything else is censored
  const severe = ["nigger","cunt","faggot","motherfucker"];
  const lower = (text||"").toLowerCase();
  return severe.some(w => new RegExp(`\\b${w}\\b`,"i").test(lower));
}
const NATIVE = { japanese:"日本語", korean:"한국어", spanish:"Español" };

// ── Simulated social activity (removed — using real Firestore feed) ─

// ── Phrase of the day bank ─────────────────────────────────────────
const PHRASES = {
  japanese:[
    { phrase:"今日もよろしくお願いします", romanji:"Kyou mo yoroshiku onegaishimasu", meaning:"I'm in your care again today", register:"Formal", context:"Work / Daily greeting" },
    { phrase:"もう一度言ってください", romanji:"Mou ichido itte kudasai", meaning:"Please say that one more time", register:"Polite", context:"Learning / Conversation" },
    { phrase:"少し待ってください", romanji:"Sukoshi matte kudasai", meaning:"Please wait just a moment", register:"Polite", context:"Everyday" },
    { phrase:"ありがとうございます", romanji:"Arigatou gozaimasu", meaning:"Thank you very much", register:"Formal", context:"Universal" },
    { phrase:"どうぞよろしく", romanji:"Douzo yoroshiku", meaning:"Please treat me kindly", register:"Natural", context:"Introductions" },
  ],
  spanish:[
    { phrase:"¿Me podría repetir eso?", romanji:"", meaning:"Could you repeat that for me?", register:"Polite", context:"Conversation" },
    { phrase:"Con mucho gusto", romanji:"", meaning:"With pleasure / Gladly", register:"Polite", context:"Social" },
    { phrase:"¿A qué hora cierra?", romanji:"", meaning:"What time does it close?", register:"Natural", context:"Shopping / Travel" },
    { phrase:"¿Dónde está el baño?", romanji:"", meaning:"Where is the bathroom?", register:"Natural", context:"Travel essential" },
    { phrase:"No entiendo, ¿puede hablar más despacio?", romanji:"", meaning:"I don't understand — can you speak more slowly?", register:"Polite", context:"Learning" },
  ],
  korean:[
    { phrase:"잠깐만요", romanji:"Jamkkanman-yo", meaning:"Just a moment, please", register:"Polite", context:"Everyday" },
    { phrase:"한 번만 더 말씀해 주세요", romanji:"Han beonman deo malsseum-hae juseyo", meaning:"Please say it one more time", register:"Formal", context:"Learning" },
    { phrase:"어디에 있어요?", romanji:"Eodi-e isseoyo?", meaning:"Where is it?", register:"Natural", context:"Navigation" },
    { phrase:"얼마예요?", romanji:"Eolmayeyo?", meaning:"How much is this?", register:"Natural", context:"Shopping" },
    { phrase:"천천히 말해 주세요", romanji:"Cheoncheonhi malhae juseyo", meaning:"Please speak slowly", register:"Polite", context:"Learning" },
  ],
};

// ── Cultural notes ────────────────────────────────────────────────
const CULTURAL = {
  japanese: {
    title: "間 (Ma) — The Space Between",
    note: "In Japan, silence is not emptiness — it carries meaning. The concept of 間 (ma) describes the pause between words, the space between objects, the breath before a response. In conversation, a thoughtful pause signals respect and reflection, not awkwardness.",
  },
  spanish: {
    title: "Tú vs. Usted — Social Distance in Language",
    note: "Spanish encodes social relationships directly into grammar. Tú (informal) and Usted (formal) aren't just politeness levels — they signal perceived social distance, respect for age, and professional context. In Latin America, Usted can even be used affectionately with close family.",
  },
  korean: {
    title: "존댓말 (Jondaemal) — Speech Levels",
    note: "Korean has a built-in social hierarchy embedded in verb endings. Using 반말 (informal speech) with someone older or in a professional setting is considered quite rude. When unsure, always default to formal speech. Koreans will appreciate the respect.",
  },
};

// ── Skill trees per language ───────────────────────────────────────
const SKILL_TREES = {
  japanese:[
    { id:"scripts",   label:"Writing Systems", kanji:"字",  x:50, y:8,  unlocked:true,  completed:false, children:["hiragana","phonetics"] },
    { id:"hiragana",  label:"Hiragana",        kanji:"あ",  x:24, y:22, unlocked:true,  completed:true,  children:["katakana","greet"] },
    { id:"phonetics", label:"Phonetics",       kanji:"音",  x:74, y:22, unlocked:true,  completed:false, children:["numbers","tones"] },
    { id:"greet",     label:"Greetings",       kanji:"挨",  x:12, y:38, unlocked:true,  completed:true,  children:["intro"] },
    { id:"katakana",  label:"Katakana",        kanji:"カ",  x:36, y:38, unlocked:true,  completed:false, children:["vocab"] },
    { id:"numbers",   label:"Numbers",         kanji:"数",  x:62, y:38, unlocked:true,  completed:true,  children:["money","counting"] },
    { id:"tones",     label:"Pitch Accent",    kanji:"調",  x:86, y:38, unlocked:false, completed:false, children:[] },
    { id:"intro",     label:"Introductions",   kanji:"自",  x:12, y:54, unlocked:true,  completed:false, children:["family"] },
    { id:"vocab",     label:"Core Vocabulary", kanji:"語",  x:36, y:54, unlocked:false, completed:false, children:["adjectives"] },
    { id:"money",     label:"Money & Prices",  kanji:"金",  x:56, y:54, unlocked:false, completed:false, children:["shopping"] },
    { id:"counting",  label:"Counters",        kanji:"個",  x:74, y:54, unlocked:false, completed:false, children:[] },
    { id:"family",    label:"Family Terms",    kanji:"家",  x:18, y:70, unlocked:false, completed:false, children:["relationships"] },
    { id:"adjectives",label:"Adjectives",      kanji:"形",  x:38, y:70, unlocked:false, completed:false, children:[] },
    { id:"shopping",  label:"Shopping",        kanji:"買",  x:58, y:70, unlocked:false, completed:false, children:["restaurant"] },
    { id:"restaurant",label:"Restaurant",      kanji:"食",  x:46, y:86, unlocked:false, completed:false, children:[] },
    { id:"relationships",label:"Relationships",kanji:"人",  x:68, y:86, unlocked:false, completed:false, children:[] },
  ],
  spanish:[
    { id:"alphabet",   label:"Alphabet & Sounds", kanji:"A", x:50, y:8,  unlocked:true,  completed:true,  children:["greet","verbs"] },
    { id:"greet",      label:"Greetings",          kanji:"¡", x:22, y:24, unlocked:true,  completed:true,  children:["social","intro"] },
    { id:"verbs",      label:"Ser vs Estar",       kanji:"V", x:76, y:24, unlocked:true,  completed:false, children:["adjectives","present"] },
    { id:"social",     label:"Social Phrases",     kanji:"S", x:10, y:42, unlocked:true,  completed:false, children:["restaurant"] },
    { id:"intro",      label:"Introductions",      kanji:"I", x:32, y:42, unlocked:true,  completed:false, children:["family"] },
    { id:"adjectives", label:"Adjectives",         kanji:"A", x:64, y:42, unlocked:false, completed:false, children:[] },
    { id:"present",    label:"Present Tense",      kanji:"P", x:86, y:42, unlocked:false, completed:false, children:["past"] },
    { id:"family",     label:"Family",             kanji:"F", x:32, y:60, unlocked:false, completed:false, children:[] },
    { id:"restaurant", label:"Restaurant",         kanji:"R", x:14, y:60, unlocked:false, completed:false, children:["shopping"] },
    { id:"past",       label:"Past Tense",         kanji:"P", x:80, y:60, unlocked:false, completed:false, children:[] },
    { id:"shopping",   label:"Shopping",           kanji:"€", x:22, y:78, unlocked:false, completed:false, children:[] },
    { id:"numbers",    label:"Numbers",            kanji:"N", x:50, y:60, unlocked:true,  completed:true,  children:["time"] },
    { id:"time",       label:"Time & Dates",       kanji:"T", x:50, y:78, unlocked:false, completed:false, children:[] },
  ],
  korean:[
    { id:"hangul",     label:"Hangul Script",      kanji:"한", x:50, y:8,  unlocked:true,  completed:true,  children:["vowels","consonants"] },
    { id:"vowels",     label:"Vowels",             kanji:"ㅏ", x:26, y:24, unlocked:true,  completed:true,  children:["phonics","greet"] },
    { id:"consonants", label:"Consonants",         kanji:"ㄱ", x:72, y:24, unlocked:true,  completed:false, children:["batchim"] },
    { id:"greet",      label:"Greetings",          kanji:"안", x:12, y:42, unlocked:true,  completed:false, children:["formal","casual"] },
    { id:"phonics",    label:"Phonics Rules",      kanji:"발", x:36, y:42, unlocked:false, completed:false, children:[] },
    { id:"batchim",    label:"받침 Endings",       kanji:"받", x:62, y:42, unlocked:false, completed:false, children:[] },
    { id:"formal",     label:"Formal Speech",      kanji:"존", x:14, y:60, unlocked:false, completed:false, children:["workplace"] },
    { id:"casual",     label:"Casual Speech",      kanji:"반", x:36, y:60, unlocked:false, completed:false, children:[] },
    { id:"numbers",    label:"Numbers (두 체계)",  kanji:"수", x:58, y:60, unlocked:true,  completed:false, children:["money","time"] },
    { id:"workplace",  label:"Workplace",          kanji:"직", x:20, y:78, unlocked:false, completed:false, children:[] },
    { id:"money",      label:"Money & Shopping",   kanji:"원", x:48, y:78, unlocked:false, completed:false, children:["restaurant"] },
    { id:"time",       label:"Time & Dates",       kanji:"시", x:70, y:78, unlocked:false, completed:false, children:[] },
    { id:"restaurant", label:"Restaurant",         kanji:"식", x:48, y:94, unlocked:false, completed:false, children:[] },
  ],
};

// ────────────────────────────────────────────────────────────────────
class VaultiaApp {
  constructor() {
    this.currentLang     = null;
    this.currentProgress = null;
    this.allProgress     = {};
    this.leftPanel       = null;
    this.rightPanel      = null;
    this._fbReady        = false;
    this._langDataCache  = {};
    this._navHistory     = [];
    this._navFuture      = [];
    this._registerGlobalEvents();
  }

  // ── Boot ──────────────────────────────────────────────────────────
  async boot() {

    // Mouse button 4 (back) / 5 (forward) navigation
    document.addEventListener("mousedown", (e) => {
      if (e.button === 3) { e.preventDefault(); this._navBack(); }
      if (e.button === 4) { e.preventDefault(); this._navForward(); }
    });
    // Also handle browser back/forward via keyboard (Alt+Left / Alt+Right)
    document.addEventListener("keydown", (e) => {
      if (e.altKey && e.key === "ArrowLeft")  { e.preventDefault(); this._navBack(); }
      if (e.altKey && e.key === "ArrowRight") { e.preventDefault(); this._navForward(); }
    });
    this._fbReady = await initFirebase();
    if (!this._fbReady) showToast("Running in local mode — no cloud sync", "info", 4000);
    let authResolved = false;
    listenAuthState(({ user }) => {
      authResolved = true;
      if (user) this._onAuthenticated(user);
      else      this._showAuth();
    });
    if (!this._fbReady) { this._showAuth(); return; }
    setTimeout(() => { if (!authResolved) this._showAuth(); }, 3000);
  }

  // ── Auth ──────────────────────────────────────────────────────────
  _showAuth() {
    const app = document.getElementById("app");
    if (!app) return;
    app.innerHTML = "";
    app.style.background = "#080408";
    const wrap = document.createElement("div");
    wrap.style.cssText = "position:fixed;inset:0;z-index:200;";
    app.appendChild(wrap);
    new AuthModal({ container: wrap, onAuthSuccess: (user) => { wrap.remove(); this._onAuthenticated(user); } });
  }

  async _onAuthenticated(user) {
    this.allProgress = await loadAllProgress();
    this._buildShell();
    this._showHub();
    heartbeat();
    this._heartbeatInterval = setInterval(() => heartbeat(), 60000);
    window.addEventListener("beforeunload", () => setOffline(), { once: true });
    this._unsubFriendReqs = subscribeFriendRequests((reqs) => {
      this.rightPanel?.setBadge?.("friends", reqs.length > 0);
    });
  }

  // ── Shell ─────────────────────────────────────────────────────────
  _buildShell() {
    const app = document.getElementById("app");
    if (!app) return;
    this.leftPanel  = null;
    this.rightPanel = null;
    app.innerHTML = `
      <div class="env-canvas" id="env-canvas"></div>
      <aside class="left-panel"  id="left-panel"   style="display:none;"></aside>
      <main  class="center-canvas" id="center-canvas"></main>
      <aside class="right-panel" id="right-panel"  style="display:none;"></aside>
    `;
  }

  _showPanels() {
    const lp = document.getElementById("left-panel");
    const rp = document.getElementById("right-panel");
    if (lp) lp.style.display = "";
    if (rp) rp.style.display = "";
    if (!this.leftPanel) {
      this.leftPanel = new LeftPanel({ container: lp, onNavigate: id => this._onLeftNav(id) });
    }
    if (!this.rightPanel) {
      this.rightPanel = new RightPanel({ container: rp, onNavigate: id => this._onRightNav(id), progress: this.currentProgress });
    }
  }

  _hidePanels() {
    document.getElementById("left-panel")?.style?.setProperty("display", "none");
    document.getElementById("right-panel")?.style?.setProperty("display", "none");
  }

  // ── Language Hub ──────────────────────────────────────────────────
  _showHub() {
    this._hidePanels();
    this._setEnv(null);
    const canvas = document.getElementById("center-canvas");
    if (!canvas) return;
    canvas.style.cssText = "width:100%;";
    new LanguageHub({ container: canvas, allProgress: this.allProgress, onSelectLanguage: l => this._enterLang(l) });
  }

  // ── Enter workspace ───────────────────────────────────────────────
  async _enterLang(lang) {
    this.currentLang     = lang;
    this.currentProgress = await loadProgress(lang);
    this._setEnv(lang);
    this._showPanels();
    if (this.leftPanel)  this.leftPanel.setLang(lang);
    if (this.rightPanel) this.rightPanel.updateProgress(this.currentProgress);
    eventBus.emit("progress:update", this.currentProgress);
    this._spawnEnvEffects(lang);
    this._showWorkspace();
  }

  _setEnv(lang) {
    document.documentElement.setAttribute("data-lang", lang || "");
  }

  _spawnEnvEffects(lang) {
    // Remove existing layers
    document.getElementById("petal-layer")?.remove();
    document.getElementById("lang-bg-layer")?.remove();

    if (!lang) return;

    // ── Real photo background ──────────────────────────────────────
    const bgContainer = document.getElementById("env-canvas");
    if (bgContainer) {
      const bgLayer = document.createElement("div");
      bgLayer.id = "lang-bg-layer";
      bgLayer.style.cssText = `
        position:absolute;inset:0;z-index:0;pointer-events:none;
        background-image:url(${LANG_BG[lang]});
        background-size:cover;background-position:center;
        opacity:0;transition:opacity 1.2s ease;
      `;
      // Dark overlay so content stays readable
      const overlay = document.createElement("div");
      overlay.style.cssText = `position:absolute;inset:0;background:linear-gradient(
        135deg, rgba(8,4,8,0.92) 0%, rgba(8,4,8,0.78) 50%, rgba(8,4,8,0.94) 100%
      );`;
      bgLayer.appendChild(overlay);
      bgContainer.insertBefore(bgLayer, bgContainer.firstChild);
      // Fade in
      requestAnimationFrame(() => { bgLayer.style.opacity = "1"; });
    }

    // ── Per-language overlay effects ───────────────────────────────
    if (lang === "japanese") {
      const layer = document.createElement("div");
      layer.id = "petal-layer";
      layer.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:1;overflow:hidden;";
      bgContainer?.appendChild(layer);
      // Sakura petals
      for (let i = 0; i < 18; i++) {
        const p = document.createElement("div");
        p.className = "sakura-petal";
        p.style.cssText = `left:${Math.random()*105}%;animation-duration:${7+Math.random()*9}s;animation-delay:${Math.random()*12}s;width:${4+Math.random()*5}px;height:${4+Math.random()*5}px;opacity:${0.35+Math.random()*0.45};`;
        layer.appendChild(p);
      }
    } else if (lang === "korean") {
      // Neon glow pulses
      const layer = document.createElement("div");
      layer.id = "petal-layer";
      layer.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:1;overflow:hidden;";
      bgContainer?.appendChild(layer);
      const neonColors = ["#4db8ff","#f472b6","#a78bfa","#00ffcc"];
      for (let i = 0; i < 6; i++) {
        const p = document.createElement("div");
        const c = neonColors[i % neonColors.length];
        p.style.cssText = `
          position:absolute;
          width:${60+Math.random()*120}px;height:${60+Math.random()*120}px;
          border-radius:50%;
          background:radial-gradient(circle, ${c}18 0%, transparent 70%);
          left:${Math.random()*100}%;top:${Math.random()*100}%;
          animation:neon-pulse ${3+Math.random()*4}s ease-in-out ${Math.random()*3}s infinite alternate;
          pointer-events:none;
        `;
        layer.appendChild(p);
      }
      // Inject neon pulse keyframe once
      if (!document.getElementById("neon-pulse-style")) {
        const s = document.createElement("style");
        s.id = "neon-pulse-style";
        s.textContent = `@keyframes neon-pulse { 0%{opacity:0.3;transform:scale(0.9)} 100%{opacity:0.8;transform:scale(1.2)} }`;
        document.head.appendChild(s);
      }
    } else if (lang === "spanish") {
      // Warm color dust particles
      const layer = document.createElement("div");
      layer.id = "petal-layer";
      layer.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:1;overflow:hidden;";
      bgContainer?.appendChild(layer);
      const colors = ["#e8a44a","#f472b6","#f87171","#fbbf24","#fb923c"];
      for (let i = 0; i < 14; i++) {
        const p = document.createElement("div");
        const c = colors[i % colors.length];
        p.style.cssText = `
          position:absolute;
          width:${3+Math.random()*5}px;height:${3+Math.random()*5}px;
          border-radius:50%;background:${c};
          left:${Math.random()*100}%;top:${Math.random()*100}%;
          animation:dust-float ${5+Math.random()*8}s ease-in-out ${Math.random()*6}s infinite alternate;
          opacity:${0.2+Math.random()*0.5};
          pointer-events:none;
        `;
        layer.appendChild(p);
      }
      if (!document.getElementById("dust-float-style")) {
        const s = document.createElement("style");
        s.id = "dust-float-style";
        s.textContent = `@keyframes dust-float { 0%{transform:translateY(0) rotate(0deg)} 100%{transform:translateY(-${20+Math.random()*30}px) rotate(180deg)} }`;
        document.head.appendChild(s);
      }
    }
  }

  // ── Workspace dashboard ───────────────────────────────────────────
  async _showWorkspace() {
    this._navHistory = [];
    this._navFuture  = [];
    const canvas = document.getElementById("center-canvas");
    if (!canvas) return;
    canvas.style.cssText = "";
    this.leftPanel?.setActive(null);
    this.rightPanel?.setActive(null);

    const lang   = this.currentLang;
    const prog   = this.currentProgress;
    const accent = ACCENT[lang];
    const xp     = prog?.xp || 0;
    const level  = xpToLevel(xp);
    const xpProg = xpProgressInLevel(xp);
    const xpPct  = Math.round(xpProg / XP_PER_LEVEL * 100);
    const streak = prog?.streak || 0;
    const completed = (prog?.completed || []).length;
    const stageNames = ["Starter","Beginner","Explorer","Speaker","Scholar","Specialist","Archivist"];
    const stage = stageNames[prog?.stageUnlocked || 0] || "Starter";

    // Pull phrase of the day deterministically
    const phraseBank = PHRASES[lang] || [];
    const dayIndex   = Math.floor(Date.now() / 86400000) % phraseBank.length;
    const todayPhrase = phraseBank[dayIndex];
    const cult = CULTURAL[lang];

    // Load real lesson data
    const langData = await this._fetchLangData(lang);
    const nextSession = this._getNextSession(langData, prog);

    canvas.innerHTML = `
<div class="workspace-root page-enter">

  <!-- ── Header ── -->
  <div class="ws-header">
    <div class="ws-header-left">
      <h1 class="ws-lang-title">${LABEL[lang]} <span class="ws-lang-native">${NATIVE[lang]}</span></h1>
      <div class="ws-breadcrumb">${stage} · Level ${level} · ${completed} lessons</div>
    </div>
    <div class="ws-header-stats">
      <div class="ws-stat-chip">
        <span class="ws-stat-val" style="color:${accent};">${xp.toLocaleString()}</span>
        <span class="ws-stat-label">XP Total</span>
      </div>
      <div class="ws-stat-chip">
        <span class="ws-stat-val" style="color:${streak>0?'#fbbf24':'var(--text-muted)'};">${streak}</span>
        <span class="ws-stat-label">Commit Score</span>
      </div>
    </div>
  </div>

  <!-- ── XP bar ── -->
  <div class="ws-xp-bar-wrap">
    <div class="ws-xp-bar-labels">
      <span>Level ${level}</span>
      <span>${xpProg} / ${XP_PER_LEVEL} XP</span>
    </div>
    <div class="ws-xp-bar-track">
      <div class="ws-xp-bar-fill" data-pct="${xpPct}" style="width:0%;background:${accent};box-shadow:0 0 12px ${accent}50;"></div>
    </div>
  </div>

  <!-- ── Main grid ── -->
  <div class="ws-grid">

    <!-- Phrase of the day (wide) -->
    <div class="ws-card ws-card-wide ws-phrase-card" style="border-left:3px solid ${accent};">
      <div class="ws-card-eyebrow">Phrase of the Day</div>
      <div class="ws-phrase-main">${todayPhrase.phrase}</div>
      ${todayPhrase.romanji ? `<div class="ws-phrase-romanji">${todayPhrase.romanji}</div>` : ""}
      <div class="ws-phrase-meaning">${todayPhrase.meaning}</div>
      <div class="ws-phrase-footer">
        <span class="ws-tag" style="color:${accent};border-color:${accent}40;background:${accent}10;">${todayPhrase.register}</span>
        <span class="ws-tag-plain">${todayPhrase.context}</span>
        <button id="ws-phrase-play" style="background:none;border:none;cursor:pointer;color:${accent};opacity:0.8;padding:2px 6px;font-size:0.8rem;display:inline-flex;align-items:center;gap:4px;" title="Hear this phrase">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </button>
      </div>
    </div>

    <!-- Quick practice -->
    <div class="ws-card ws-quick-card">
      <div class="ws-card-eyebrow">Quick Practice</div>
      <div class="ws-quick-list">
        <button class="ws-quick-item ws-quick-primary" data-action="lesson" style="border-color:${accent}30;background:${accent}0a;">
          <div class="ws-quick-item-title" style="color:${accent};">→ Continue Lesson</div>
          <div class="ws-quick-item-sub">${nextSession ? nextSession.title : `${stage} · Unit ${Math.min(completed+1,14)}`}</div>
        </button>
        <button class="ws-quick-item" data-action="review">
          <div class="ws-quick-item-title">⟳ Review Queue</div>
          <div class="ws-quick-item-sub">${(prog?.reviewQueue||[]).length} items due</div>
        </button>
        <button class="ws-quick-item" data-action="phrases">
          <div class="ws-quick-item-title">⊞ Phrase Library</div>
          <div class="ws-quick-item-sub">Browse expressions</div>
        </button>
        <button class="ws-quick-item" data-action="challenges">
          <div class="ws-quick-item-title">★ Challenges</div>
          <div class="ws-quick-item-sub">Daily & weekly goals</div>
        </button>
      </div>
    </div>

    <!-- Cultural note -->
    <div class="ws-card ws-cultural-card">
      <div class="ws-card-eyebrow">Cultural Note</div>
      <div class="ws-cultural-title">${cult.title}</div>
      <div class="ws-cultural-body">${cult.note}</div>
    </div>

    <!-- Knowledge map preview -->
    <div class="ws-card ws-card-wide ws-map-card">
      <div class="ws-map-header">
        <div class="ws-card-eyebrow">Knowledge Map</div>
        <button id="ws-toggle-tree" class="ws-link-btn" style="color:${accent};">Expand full map →</button>
      </div>
      <div id="ws-mini-tree">${this._miniTree(lang, accent)}</div>
    </div>

    <!-- Activity feed -->
    <div class="ws-card ws-feed-card">
      <div class="ws-card-eyebrow">Community Activity</div>
      <div class="ws-feed" id="ws-community-feed">
        <div style="padding:12px 0;text-align:center;color:var(--text-muted);font-size:0.75rem;font-family:var(--font-mono);">Connecting…</div>
      </div>
    </div>

    <!-- Progress stats -->
    <div class="ws-card ws-stats-card">
      <div class="ws-card-eyebrow">Your Progress</div>
      <div class="ws-stats-list">
        ${[
          { label:"Lessons",    val: completed,                                                                     max: 14,  color: accent },
          { label:"Accuracy",   val: prog?.accuracy != null ? Math.round(prog.accuracy*100) : null,                 max: 100, color:"#4ade80", suf:"%" },
          { label:"Vocabulary", val: (prog?.vocabSeen||[]).length || ((prog?.weakWords||[]).length ? (prog?.weakWords||[]).length : null), max: 200, color: accent },
          { label:"Commit Score",     val: Math.min(streak, 30),                                                          max: 30,  color:"#fbbf24" },
        ].map(s => `
          <div class="ws-stat-row">
            <div class="ws-stat-row-labels">
              <span>${s.label}</span>
              <span>${s.val != null ? s.val+(s.suf||"") : "--"}/${s.max}${s.suf||""}</span>
            </div>
            <div class="ws-stat-track">
              <div class="ws-stat-fill" style="width:${s.val != null ? Math.round(s.val/s.max*100) : 0}%;background:${s.color};"></div>
            </div>
          </div>
        `).join("")}
      </div>
    </div>

  </div><!-- /ws-grid -->

  <!-- Full skill tree (hidden) -->
  <div id="ws-full-tree" style="display:none;margin:0 var(--sp-lg) var(--sp-lg);"></div>

</div>`;

    // Animate XP bar
    requestAnimationFrame(() => {
      const fill = canvas.querySelector(".ws-xp-bar-fill");
      if (fill) fill.style.width = fill.dataset.pct + "%";
    });

    // Phrase play

    // Real-time community feed
    const feedEl = canvas.querySelector("#ws-community-feed");
    if (feedEl) {
      const timeAgoShort = iso => {
        if (!iso) return "";
        const s = (Date.now() - new Date(iso)) / 1000;
        if (s < 60)   return "now";
        if (s < 3600) return Math.floor(s/60) + "m";
        if (s < 86400) return Math.floor(s/3600) + "h";
        return Math.floor(s/86400) + "d";
      };
      const unsubFeed = subscribeGlobalActivity(items => {
        if (!feedEl.isConnected) { unsubFeed(); return; }
        if (!items.length) {
          feedEl.innerHTML = `<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:0.75rem;">No activity yet — be the first!</div>`;
          return;
        }
        feedEl.innerHTML = items.slice(0, 6).map(a => {
          const fa = ACCENT[a.lang] || accent;
          return `<div class="ws-feed-item">
            <div class="ws-feed-avatar" style="background:${fa}1a;color:${fa};border-color:${fa}30;">${(a.user||"?")[0].toUpperCase()}</div>
            <div class="ws-feed-content">
              <div class="ws-feed-text"><strong>${a.user}</strong> ${a.action} <em>${a.detail}</em></div>
              <div class="ws-feed-meta">${LABEL[a.lang]||a.lang||""} · ${timeAgoShort(a.time)} ago</div>
            </div>
          </div>`;
        }).join("");
      });
      // Cleanup when navigating away
      const obs = new MutationObserver(() => {
        if (!canvas.querySelector("#ws-community-feed")) { obs.disconnect(); unsubFeed(); }
      });
      obs.observe(canvas, { childList: true });
    }

    // Phrase of the day: play button
    canvas.querySelector("#ws-phrase-play")?.addEventListener("click", () => {
      if (todayPhrase) ttsSpeak(todayPhrase.phrase, lang);
    });

    // Quick actions
    canvas.querySelectorAll(".ws-quick-item").forEach(btn => {
      btn.addEventListener("click", () => {
        const a = btn.dataset.action;
        if (a === "review")     this._onLeftNav("review");
        if (a === "phrases")    this._onLeftNav("phrases");
        if (a === "challenges") this._onLeftNav("challenges");
        if (a === "lesson")     this._startNextLesson();
      });
    });

    // Skill tree toggle
    let treeOpen = false;
    canvas.querySelector("#ws-toggle-tree")?.addEventListener("click", () => {
      treeOpen = !treeOpen;
      const el = canvas.querySelector("#ws-full-tree");
      const btn = canvas.querySelector("#ws-toggle-tree");
      if (treeOpen) {
        el.style.display = "block";
        this._renderFullTree(lang, el, accent);
        el.scrollIntoView({ behavior:"smooth", block:"start" });
        btn.textContent = "Close map ←";
      } else {
        el.style.display = "none";
        btn.textContent = "Expand full map →";
      }
    });
  }

  // ── Mini tree (compact row) ────────────────────────────────────────
  _miniTree(lang, accent) {
    const nodes = (SKILL_TREES[lang] || []).slice(0, 8);
    return `
      <div class="mini-tree-row">
        ${nodes.map((n, i) => `
          <div class="mini-tree-node ${n.completed?"completed":""} ${n.unlocked?"unlocked":"locked"}"
               title="${n.label}"
               style="${n.completed?`border-color:${accent}55;background:${accent}18;`:''}">
            <span class="mini-tree-kanji" style="${n.completed?`color:${accent};`:''}">${n.kanji}</span>
            ${n.completed ? `<span class="mini-tree-dot" style="background:${accent};"></span>` : ""}
          </div>
          ${i < nodes.length-1 ? `<div class="mini-tree-line"></div>` : ""}
        `).join("")}
        <span class="mini-tree-more">+ more</span>
      </div>`;
  }

  // ── Full skill tree ────────────────────────────────────────────────
  _renderFullTree(lang, container, accent) {
    const nodes = SKILL_TREES[lang] || [];
    const W = 660, H = 500;

    let svgLines = "";
    nodes.forEach(n => {
      (n.children || []).forEach(cid => {
        const child = nodes.find(x => x.id === cid);
        if (!child) return;
        const x1 = n.x/100*W + 28, y1 = n.y/100*H + 28;
        const x2 = child.x/100*W + 28, y2 = child.y/100*H + 28;
        const active = n.unlocked && child.unlocked;
        svgLines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${active?accent+'45':'rgba(255,255,255,0.06)'}" stroke-width="1.5" stroke-dasharray="${child.unlocked?'none':'5,4'}"/>`;
      });
    });

    let nodesHtml = "";
    nodes.forEach(n => {
      const cx = n.x/100*W, cy = n.y/100*H;
      const bg  = n.completed ? `${accent}1a` : n.unlocked ? "var(--bg-hover)" : "var(--bg-glass)";
      const br  = n.completed ? `${accent}55` : n.unlocked ? "var(--border-normal)" : "var(--border-subtle)";
      const col = n.completed ? accent : "var(--text-secondary)";
      nodesHtml += `
        <div class="skill-tree-node ${n.unlocked?"unlocked":""} ${n.completed?"completed":""}"
             title="${n.label}${n.unlocked?"":" — Locked"}"
             style="position:absolute;left:${cx}px;top:${cy}px;transform:translate(-50%,-50%);width:76px;text-align:center;">
          <div class="skill-tree-icon" style="background:${bg};border-color:${br};opacity:${n.unlocked?1:0.38};">
            <span style="font-size:1.2rem;color:${col};">${n.kanji}</span>
            ${n.completed ? `<span class="skill-dot" style="background:${accent};"></span>` : ""}
          </div>
          <div class="skill-tree-label">${n.label}</div>
        </div>`;
    });

    container.innerHTML = `
      <div class="ws-card" style="padding:24px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <div class="ws-card-eyebrow">Full Knowledge Map · ${LABEL[lang]}</div>
          <div style="display:flex;gap:12px;font-family:var(--font-mono);font-size:0.68rem;color:var(--text-muted);">
            <span><span style="color:${accent}">●</span> Completed</span>
            <span><span style="color:var(--text-secondary)">●</span> Unlocked</span>
            <span style="opacity:0.4"><span>●</span> Locked</span>
          </div>
        </div>
        <div style="position:relative;overflow:auto;-webkit-overflow-scrolling:touch;">
          <div style="position:relative;width:${W+60}px;height:${H+60}px;">
            <svg style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;"
                 viewBox="0 0 ${W+60} ${H+60}">${svgLines}</svg>
            ${nodesHtml}
          </div>
        </div>
      </div>`;

    container.querySelectorAll(".skill-tree-node.unlocked").forEach(node => {
      node.addEventListener("mouseenter", () => {
        const icon = node.querySelector(".skill-tree-icon");
        if (icon) { icon.style.transform = "scale(1.15)"; icon.style.boxShadow = `0 0 18px ${accent}40`; }
      });
      node.addEventListener("mouseleave", () => {
        const icon = node.querySelector(".skill-tree-icon");
        if (icon) { icon.style.transform = ""; icon.style.boxShadow = ""; }
      });
    });
  }

  // ── Left nav dispatch ──────────────────────────────────────────────
  _onLeftNav(id) {
    const canvas = document.getElementById("center-canvas");
    if (!canvas) return;
    this.leftPanel?.setActive(id);
    canvas.style.cssText = "";
    this._pushHistory(id);
    this._renderPage(id, canvas);
  }

  _renderPage(id, canvas) {
    this._showPanels(); // always ensure panels visible when navigating
    switch(id) {
      case "lessons":    this._pageLessons(canvas); break;
      case "review":     this._pageReview(canvas); break;
      case "vault":      this._pageVault(canvas); break;
      case "phrases":    this._pagePhraseLib(canvas); break;
      case "challenges": this._pageChallenges(canvas); break;
      case "arena":      this._pageArena(canvas); break;
      case "support":    this._pageSupport(canvas); break;
    }
    this._injectNavBar(canvas);
  }

  _pushHistory(id) {
    if (this._navHistory[this._navHistory.length - 1] === id) return;
    this._navHistory.push(id);
    this._navFuture = [];
  }

  _navBack() {
    if (this._navHistory.length < 2) {
      this._navHistory = []; this._navFuture = [];
      this._showWorkspace(); this.leftPanel?.setActive(null); return;
    }
    const current = this._navHistory.pop();
    this._navFuture.unshift(current);
    const prev = this._navHistory[this._navHistory.length - 1];
    const canvas = document.getElementById("center-canvas");
    if (!canvas) return;
    canvas.style.cssText = "";
    this.leftPanel?.setActive(prev);
    this._renderPage(prev, canvas);
  }

  _navForward() {
    if (!this._navFuture.length) return;
    const next = this._navFuture.shift();
    this._navHistory.push(next);
    const canvas = document.getElementById("center-canvas");
    if (!canvas) return;
    canvas.style.cssText = "";
    this.leftPanel?.setActive(next);
    this._renderPage(next, canvas);
  }

  _injectNavBar(canvas) {
    canvas.querySelector(".canvas-nav-bar")?.remove();
    const bar = document.createElement("div");
    bar.className = "canvas-nav-bar";
    bar.style.cssText = "display:flex;align-items:center;gap:6px;padding:12px 20px 0;";
    const canBack = this._navHistory.length >= 1;
    const canFwd  = this._navFuture.length > 0;
    bar.innerHTML = `
      <button class="btn-icon btn-ghost canvas-nav-back" title="Back" ${canBack?"":"disabled"} style="opacity:${canBack?1:0.28};">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
      </button>
      <button class="btn-icon btn-ghost canvas-nav-fwd" title="Forward" ${canFwd?"":"disabled"} style="opacity:${canFwd?1:0.28};">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </button>`;
    bar.querySelector(".canvas-nav-back")?.addEventListener("click", () => this._navBack());
    bar.querySelector(".canvas-nav-fwd")?.addEventListener("click",  () => this._navForward());
    canvas.prepend(bar);
  }

  _onRightNav(id) {
    const canvas = document.getElementById("center-canvas");
    if (!canvas) return;
    this._showPanels(); // ensure panels always visible
    this.rightPanel?.setActive(id);
    canvas.style.cssText = "";
    this._pushHistory(id);
    switch(id) {
      case "profile":      this._pageProfile(canvas); break;
      case "friends":      this._pageFriends(canvas); break;
      case "leaderboards": this._pageLeaderboards(canvas); break;
      case "plaza":        this._pagePlaza(canvas); break;
      case "settings":     this._pageSettings(canvas); break;
      case "preferences":  this._pagePreferences(canvas); break;
    }
    this._injectNavBar(canvas);
  }

  // ── Start next lesson ──────────────────────────────────────────────
  async _startNextLesson() {
    const langData = await this._fetchLangData(this.currentLang);
    const session  = this._getNextSession(langData, this.currentProgress);
    if (!session) { showToast("All lessons complete for this stage!", "success"); return; }
    this._runSession(session);
  }

  _getNextSession(langData, prog) {
    if (!langData) return null;
    const completed = (prog?.completed || []);
    for (const stage of (langData.stages || [])) {
      for (const unit of (stage.units || [])) {
        for (const sess of (unit.sessions || [])) {
          if (!completed.includes(sess.id)) return sess;
        }
      }
    }
    return null;
  }

  _runSession(session) {
    const canvas = document.getElementById("center-canvas");
    if (!canvas) return;
    canvas.innerHTML = "";
    new SessionEngine({
      container: canvas,
      session,
      langKey:   this.currentLang,
      progress:  this.currentProgress,
      register:  this.currentProgress?.register || "natural",
      immersion: this.currentProgress?.immersionMode || "partial",
      onComplete: r => this._onSessionDone(r, session),
    });
  }

  async _onSessionDone({ stars, weakWords, xpEarned, accuracy }, session) {
    const prog     = this.currentProgress;
    const oldXp    = prog.xp || 0;
    const oldLevel = xpToLevel(oldXp);

    // Rolling accuracy average (weighted toward recent sessions)
    const prevAcc  = prog.accuracy != null ? prog.accuracy : null;
    prog.accuracy  = prevAcc != null
      ? Math.round((prevAcc * 0.7 + accuracy * 0.3) * 100) / 100
      : Math.round(accuracy * 100) / 100;

    // Vocab: count unique target words ever seen across weakWords entries
    const prevVocab = new Set(prog.vocabSeen || []);
    (weakWords || []).forEach(w => { if (w.word) prevVocab.add(w.word); });
    prog.vocabSeen = [...prevVocab];

    prog.xp        = oldXp + xpEarned;
    prog.stars     = { ...(prog.stars||{}), [session.id]: stars };
    prog.completed = [...new Set([...(prog.completed||[]), session.id])];
    prog.weakWords = weakWords;
    prog.reviewQueue = buildReviewQueue(prog);
    await saveProgress(this.currentLang, prog);
    this.allProgress[this.currentLang] = prog;
    this.currentProgress = prog;
    syncProgressToProfile(this.currentLang, prog);
    eventBus.emit("progress:update", prog);
    if (this.rightPanel) this.rightPanel.updateProgress(prog);

    const newLevel = xpToLevel(prog.xp);
    const levelUp  = newLevel > oldLevel ? { oldLevel, newLevel } : null;

    // Cinematic XP popup
    showXpPopup(xpEarned, stars, levelUp);

    // Prestige popup on level-up
    if (levelUp) {
      setTimeout(() => showPrestigePopup(`Level ${newLevel} Reached!`, `Keep climbing the vault`, "⚡"), 3200);
    }

    setTimeout(() => this._showWorkspace(), 350);
  }

  // ══════════════════════════════════════════════════════════════════
  // PAGES
  // ══════════════════════════════════════════════════════════════════

  // ── Lessons ────────────────────────────────────────────────────────
  _pageLessons(canvas) {
    const accent = ACCENT[this.currentLang] || "#8b7cff";
    const prog   = this.currentProgress;
    const completed = new Set(prog?.completed || []);

    // Pull curriculum from cached lang data if available
    const langData = this._langDataCache?.[this.currentLang];
    const stages   = langData?.stages || [];

    if (!stages.length) {
      canvas.innerHTML = `
<div class="canvas-content page-enter" style="max-width:680px;">
  <div class="section-header">
    <h2 class="section-title">Lessons</h2>
    <p class="section-subtitle">Your full curriculum for ${LABEL[this.currentLang]||this.currentLang}</p>
  </div>
  <div class="card" style="padding:40px;text-align:center;">
    <div style="font-size:2rem;margin-bottom:16px;">📚</div>
    <div style="color:var(--text-muted);">Select a language from the hub to see lessons.</div>
  </div>
</div>`;
      return;
    }

    const stageHTML = stages.map((stage, si) => {
      const units = stage.units || [];
      const stageXp = units.flatMap(u => u.sessions||[]).filter(s => completed.has(s.id)).length;
      const stageTot = units.flatMap(u => u.sessions||[]).length;
      const stageComplete = stageTot > 0 && stageXp === stageTot;
      return `
        <div class="card-elevated" style="margin-bottom:18px;overflow:hidden;">
          <div style="padding:16px 20px;border-bottom:1px solid var(--border-subtle);display:flex;align-items:center;gap:12px;">
            <div style="width:32px;height:32px;border-radius:50%;background:${accent}20;border:1px solid ${accent}35;display:flex;align-items:center;justify-content:center;font-weight:600;color:${accent};font-size:0.85rem;">${si+1}</div>
            <div style="flex:1;">
              <div style="font-size:1rem;font-weight:500;color:var(--text-primary);">${stage.name||("Stage "+(si+1))}</div>
              <div style="font-size:0.72rem;color:var(--text-muted);font-family:var(--font-mono);">${stageXp}/${stageTot} complete</div>
            </div>
            ${stageComplete ? `<span style="font-size:0.72rem;color:#4ade80;font-family:var(--font-mono);">✓ Mastered</span>` : ""}
          </div>
          ${units.map((unit, ui) => {
            const sessions = unit.sessions || [];
            const done = sessions.filter(s => completed.has(s.id)).length;
            return `
              <div style="padding:12px 20px;${ui<units.length-1?"border-bottom:1px solid var(--border-subtle)":""}">
                <div style="font-size:0.78rem;font-weight:500;color:var(--text-secondary);margin-bottom:8px;">${unit.name||("Unit "+(ui+1))}</div>
                <div style="display:flex;flex-wrap:wrap;gap:6px;">
                  ${sessions.map(s => {
                    const isDone = completed.has(s.id);
                    return `<div title="${s.title||s.id}" style="padding:5px 10px;border-radius:6px;font-size:0.72rem;font-family:var(--font-mono);border:1px solid ${isDone?accent+"40":"var(--border-subtle)"};background:${isDone?accent+"10":"transparent"};color:${isDone?accent:"var(--text-muted)"};">
                      ${isDone?"✓ ":""}${s.title||s.id}
                    </div>`;
                  }).join("")}
                </div>
                <div style="font-size:0.65rem;color:var(--text-muted);margin-top:8px;font-family:var(--font-mono);">${done}/${sessions.length} sessions</div>
              </div>`;
          }).join("")}
        </div>`;
    }).join("");

    canvas.innerHTML = `
<div class="canvas-content page-enter" style="max-width:720px;">
  <div class="section-header">
    <h2 class="section-title">Lessons</h2>
    <p class="section-subtitle">Full curriculum for ${LABEL[this.currentLang]||this.currentLang}</p>
  </div>
  ${stageHTML}
</div>`;
  }

  // ── Review ────────────────────────────────────────────────────────
  _pageReview(canvas) {
    const accent = ACCENT[this.currentLang];
    const queue  = this.currentProgress?.reviewQueue || [];
    const typeColor = { word_review:"#fbbf24", session_review: accent };

    canvas.innerHTML = `
<div class="canvas-content page-enter">
  <div class="section-header">
    <div>
      <h2 class="section-title">Review Queue</h2>
      <p class="section-subtitle">${queue.length} item${queue.length!==1?"s":""} prioritized by memory decay and accuracy</p>
    </div>
    ${queue.length > 0 ? `<button id="start-review" class="btn btn-primary">Start Review Session →</button>` : ""}
  </div>

  ${queue.length === 0 ? `
    <div class="empty-state card" style="min-height:300px;">
      <div class="empty-state-icon">✓</div>
      <h3 style="font-family:var(--font-display);font-size:1.5rem;font-weight:300;color:var(--text-primary);">Queue Clear</h3>
      <p class="empty-state-text">All caught up — keep learning to build your review queue.</p>
      <button class="btn btn-primary" id="review-continue-lesson">Continue a Lesson →</button>
    </div>` : `
    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:28px;">
      ${queue.map(item => `
        <div class="card review-item" style="display:flex;align-items:center;gap:14px;">
          <div style="width:38px;height:38px;border-radius:10px;background:${(typeColor[item.type]||accent)}1a;border:1px solid ${(typeColor[item.type]||accent)}30;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <span style="font-size:0.72rem;color:${typeColor[item.type]||accent};font-family:var(--font-mono);">${item.type==="word_review"?"W":"S"}</span>
          </div>
          <div style="flex:1;">
            <div style="font-size:0.9rem;color:var(--text-primary);">${item.word || "Session: " + (item.sessionId||"").split("-").slice(-1)[0]}</div>
            <div style="font-size:0.7rem;color:var(--text-muted);font-family:var(--font-mono);margin-top:2px;">Priority ${item.priority} · ${item.type.replace("_"," ")}</div>
          </div>
          <div style="font-size:0.72rem;font-family:var(--font-mono);color:${accent};">Due</div>
        </div>
      `).join("")}
    </div>
  `}

  ${queue.length > 0 ? `
  <div class="card" style="background:${accent}08;border-color:${accent}20;padding:20px 24px;">
    <div style="font-size:0.75rem;color:${accent};font-family:var(--font-mono);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px;">How Review Works</div>
    <p style="font-size:0.85rem;color:var(--text-secondary);line-height:1.65;">Vaultia uses spaced repetition — items with lower accuracy or longer gaps since last review are prioritized. Each correct answer strengthens the memory trace and pushes the next review further into the future.</p>
  </div>` : ""}
</div>`;

    canvas.querySelector("#start-review")?.addEventListener("click", () => {
      showToast("Preparing review session…", "info", 2000);
      setTimeout(() => showToast("Review sessions coming soon — use lessons for now!", "info", 3000), 500);
    });
    // "Continue a Lesson" from empty state should go directly to next lesson
    canvas.querySelector("#review-continue-lesson")?.addEventListener("click", () => {
      this._startNextLesson();
    });
  }

  // ── Vault ─────────────────────────────────────────────────────────
  _pageVault(canvas) {
    const accent   = ACCENT[this.currentLang];
    const stage    = this.currentProgress?.stageUnlocked || 0;
    const isOpen   = stage >= 6;
    const vaultContent = [
      { title:"Ancient Texts",      desc:"Classical literature and historical documents with line-by-line annotation.",           icon:"📜" },
      { title:"Idioms & Proverbs",  desc:"Native expressions that don't translate directly — with origin stories.",               icon:"🌿" },
      { title:"Formal Writing",     desc:"Business letters, academic writing, and professional correspondence templates.",        icon:"✒️" },
      { title:"Cultural Deep-Dives",desc:"Regional dialects, subcultures, and how language reflects society.",                   icon:"🏛️" },
      { title:"Master Grammar",     desc:"Advanced grammatical patterns used by fluent native speakers.",                         icon:"⚗️" },
      { title:"Poetry & Literature",desc:"Song lyrics, poetry, and prose — language in its most expressive form.",               icon:"🎭" },
    ];

    canvas.innerHTML = `
<div class="canvas-content page-enter">
  <div class="section-header">
    <div>
      <h2 class="section-title">The Vault</h2>
      <p class="section-subtitle">Advanced cultural content unlocked at Archivist stage</p>
    </div>
    ${isOpen ? `<span style="padding:4px 14px;border-radius:999px;font-size:0.72rem;font-family:var(--font-mono);color:${accent};border:1px solid ${accent}40;background:${accent}10;">Unlocked</span>` : ""}
  </div>

  ${!isOpen ? `
  <div class="vault-lock-overlay card-elevated" style="position:relative;overflow:hidden;min-height:400px;">
    <div style="position:absolute;inset:0;background:repeating-linear-gradient(45deg,transparent,transparent 12px,rgba(255,255,255,0.008) 12px,rgba(255,255,255,0.008) 24px);pointer-events:none;"></div>
    <div class="vault-lock-icon">🔒</div>
    <h3 class="vault-lock-title">The Vault is Sealed</h3>
    <p style="font-size:0.88rem;color:var(--text-muted);max-width:400px;text-align:center;line-height:1.65;">Complete all 7 stages to reach <strong style="color:${accent};">Archivist</strong> level and unlock master-tier content from your target culture.</p>
    <div class="progress-bar-container" style="width:280px;margin-top:16px;">
      <div class="progress-bar-fill" style="width:${Math.round((stage/6)*100)}%;background:${accent};"></div>
    </div>
    <div style="font-family:var(--font-mono);font-size:0.72rem;color:var(--text-muted);margin-top:6px;">Stage ${stage+1} of 7</div>
  </div>` : `
  <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px;">
    ${vaultContent.map(v => `
      <div class="card" style="cursor:pointer;transition:all var(--t-base);" onmouseenter="this.style.borderColor='${accent}40'" onmouseleave="this.style.borderColor=''">
        <div style="font-size:1.8rem;margin-bottom:12px;">${v.icon}</div>
        <h4 style="font-size:0.95rem;font-weight:500;color:var(--text-primary);margin-bottom:6px;">${v.title}</h4>
        <p style="font-size:0.82rem;color:var(--text-muted);line-height:1.55;">${v.desc}</p>
      </div>
    `).join("")}
  </div>`}

  <!-- Teaser grid always shown when locked -->
  ${!isOpen ? `
  <div style="margin-top:28px;">
    <div style="font-size:0.65rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--text-muted);font-family:var(--font-mono);margin-bottom:14px;">Coming when you unlock…</div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;">
      ${vaultContent.map(v => `
        <div class="card" style="opacity:0.4;filter:blur(0.5px);">
          <div style="font-size:1.5rem;margin-bottom:10px;filter:grayscale(1);">${v.icon}</div>
          <h4 style="font-size:0.88rem;font-weight:500;color:var(--text-secondary);">${v.title}</h4>
        </div>
      `).join("")}
    </div>
  </div>` : ""}
</div>`;
  }

  // ── Phrase Library ────────────────────────────────────────────────
  async _pagePhraseLib(canvas) {
    const accent = ACCENT[this.currentLang];
    const data   = await this._fetchLangData(this.currentLang);
    const dbPhrases = data?.phraseLibrary || [];
    const extraPhrases = (PHRASES[this.currentLang] || []).map((p,i) => ({
      id: `extra-${i}`, phrase: p.phrase, romanji: p.romanji,
      translation: p.meaning, contextTags: [p.register, p.context], register: p.register.toLowerCase()
    }));
    const allPhrases = [...dbPhrases, ...extraPhrases];
    const tags = ["All","Polite","Casual","Travel","Business","Social","Learning"];

    canvas.innerHTML = `
<div class="canvas-content page-enter">
  <div class="section-header">
    <div>
      <h2 class="section-title">Phrase Library</h2>
      <p class="section-subtitle">${allPhrases.length} expressions with grammar notes and audio</p>
    </div>
  </div>
  <div class="phrase-filter-row" style="margin-bottom:20px;display:flex;gap:6px;flex-wrap:wrap;">
    ${tags.map(t => `<button class="select-pill ${t==="All"?"active":""}" data-tag="${t}">${t}</button>`).join("")}
  </div>
  <div id="phrase-list" style="display:flex;flex-direction:column;gap:12px;">
    ${allPhrases.map(p => `
      <div class="card phrase-card" data-tags="${(p.contextTags||[p.register||"general"]).join(",").toLowerCase()}">
        <div style="display:flex;align-items:flex-start;gap:14px;">
          <div style="flex:1;">
            <div style="font-family:var(--font-display);font-size:1.45rem;font-weight:300;color:var(--text-primary);margin-bottom:4px;">${p.phrase}</div>
            ${p.romanji ? `<div style="font-family:var(--font-mono);font-size:0.78rem;color:var(--text-muted);margin-bottom:6px;">${p.romanji}</div>` : ""}
            <div style="font-size:0.9rem;color:var(--text-secondary);margin-bottom:${p.grammarNote?"10px":"0"};">${p.translation||""}</div>
            ${p.grammarNote ? `<div style="font-size:0.78rem;color:var(--text-muted);font-style:italic;padding:8px 12px;background:var(--bg-glass);border-left:2px solid ${accent}40;border-radius:0 6px 6px 0;">${p.grammarNote}</div>` : ""}
          </div>
          <button class="phrase-play" data-phrase="${encodeURIComponent(p.phrase)}" title="Play audio" style="flex-shrink:0;width:36px;height:36px;border-radius:50%;border:1px solid ${accent}35;background:${accent}0d;color:${accent};cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background 0.15s;" onmouseenter="this.style.background='${accent}20'" onmouseleave="this.style.background='${accent}0d'">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </button>
        </div>
        <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;">
          ${(p.contextTags||[]).map(t => `<span class="ws-tag-plain">${t}</span>`).join("")}
        </div>
      </div>
    `).join("")}
  </div>
</div>`;

    canvas.querySelectorAll(".phrase-play").forEach(btn => {
      btn.addEventListener("click", () => {
        const phrase = decodeURIComponent(btn.dataset.phrase || "");
        if (phrase) ttsSpeak(phrase, this.currentLang);
      });
    });
    canvas.querySelectorAll(".select-pill[data-tag]").forEach(btn => {
      btn.addEventListener("click", () => {
        canvas.querySelectorAll(".select-pill").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const tag = btn.dataset.tag.toLowerCase();
        canvas.querySelectorAll(".phrase-card").forEach(card => {
          if (tag === "all") card.style.display = "";
          else card.style.display = card.dataset.tags.includes(tag) ? "" : "none";
        });
      });
    });
  }

  // ── Challenges ────────────────────────────────────────────────────
  _pageChallenges(canvas) {
    const accent  = ACCENT[this.currentLang];
    const prog    = this.currentProgress || {};
    const done    = (prog.completed || []).length;
    const streak  = prog.streak || 0;
    const xp      = prog.xp || 0;
    const stars5  = Object.values(prog.stars || {}).filter(s => s >= 5).length;
    const challenges = [
      { icon:"🔥", title:"Daily Commit",        desc:"Complete 1 session today",          xp:50,  type:"Daily",    progress:Math.min(done>0?1:0,1), goal:1 },
      { icon:"📖", title:"Vocabulary Builder",  desc:"Complete 10 sessions",              xp:100, type:"Weekly",   progress:Math.min(done,10),      goal:10 },
      { icon:"⭐", title:"Perfect Session",     desc:"Earn 5 stars on any session",       xp:150, type:"Challenge",progress:Math.min(stars5,1),     goal:1 },
      { icon:"⚔️", title:"Week Warrior",       desc:"Stay committed 7 days straight",           xp:300, type:"Monthly",  progress:Math.min(streak,7),     goal:7 },
      { icon:"🔄", title:"Error Recovery",     desc:"Complete 5+ sessions",              xp:80,  type:"Weekly",   progress:Math.min(done,5),       goal:5 },
      { icon:"🏆", title:"Century Club",       desc:"Reach 100 completed sessions",      xp:500, type:"Lifetime", progress:Math.min(done,100),     goal:100 },
      { icon:"🌟", title:"Stage Clear",        desc:"Complete all 14 units in a stage",  xp:250, type:"Stage",    progress:Math.min(done%14||done,14), goal:14 },
      { icon:"💎", title:"XP Collector",       desc:"Earn 1,000 total XP",               xp:200, type:"Lifetime", progress:Math.min(xp,1000),      goal:1000 },
    ];
    const typeColors = { Daily:accent, Weekly:"#a78bfa", Monthly:"#f472b6", Challenge:"#fbbf24", Lifetime:"#34d399", Stage:accent };

    canvas.innerHTML = `
<div class="canvas-content page-enter">
  <div class="section-header">
    <div>
      <h2 class="section-title">Challenges</h2>
      <p class="section-subtitle">Complete challenges to earn bonus XP and unlock rewards</p>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
    ${challenges.map(c => `
      <div class="card challenge-card" style="cursor:pointer;transition:transform var(--t-base),border-color var(--t-base);">
        <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:14px;">
          <div style="font-size:1.6rem;flex-shrink:0;">${c.icon}</div>
          <div style="flex:1;">
            <div style="font-size:0.92rem;font-weight:500;color:var(--text-primary);margin-bottom:3px;">${c.title}</div>
            <div style="font-size:0.78rem;color:var(--text-muted);line-height:1.45;">${c.desc}</div>
          </div>
          <span style="padding:2px 9px;border-radius:999px;font-size:0.6rem;font-family:var(--font-mono);letter-spacing:0.08em;text-transform:uppercase;background:${(typeColors[c.type]||accent)}15;color:${typeColors[c.type]||accent};border:1px solid ${(typeColors[c.type]||accent)}30;flex-shrink:0;">${c.type}</span>
        </div>
        <div class="progress-bar-container" style="margin-bottom:8px;">
          <div class="progress-bar-fill" style="width:${Math.round(c.progress/c.goal*100)}%;background:${typeColors[c.type]||accent};"></div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:0.68rem;color:var(--text-muted);font-family:var(--font-mono);">${c.progress}/${c.goal}</span>
          <span style="font-size:0.72rem;font-family:var(--font-mono);color:${typeColors[c.type]||accent};">+${c.xp} XP</span>
        </div>
      </div>
    `).join("")}
  </div>
</div>`;

    canvas.querySelectorAll(".challenge-card").forEach(c => {
      c.addEventListener("mouseenter", () => { c.style.transform="translateY(-2px)"; c.style.borderColor="var(--border-normal)"; });
      c.addEventListener("mouseleave", () => { c.style.transform=""; c.style.borderColor=""; });
    });
  }

  // ── Arena ─────────────────────────────────────────────────────────
  async _pageArena(canvas) {
    const me     = getUser();
    const accent = ACCENT[this.currentLang];

    canvas.innerHTML = `
<div class="canvas-content page-enter">
  <div class="section-header">
    <div>
      <h2 class="section-title">Arena</h2>
      <p class="section-subtitle">Compete in live translation races and pronunciation duels</p>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:24px;">
    <div class="card-elevated" style="text-align:center;padding:28px 20px;">
      <div style="font-size:2.2rem;margin-bottom:12px;">⚡</div>
      <h3 style="font-family:var(--font-display);font-size:1.3rem;font-weight:300;color:var(--text-primary);margin-bottom:8px;">Speed Translation</h3>
      <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:20px;line-height:1.55;">Race against yourself or wait for a live opponent. Translate 10 phrases as fast and accurately as possible.</p>
      <div style="display:flex;justify-content:center;gap:8px;margin-bottom:16px;">
        <span style="font-size:0.72rem;font-family:var(--font-mono);color:var(--text-muted);">~3 min</span>
        <span style="font-size:0.72rem;font-family:var(--font-mono);color:var(--text-muted);">·</span>
        <span style="font-size:0.72rem;font-family:var(--font-mono);color:${accent};">Solo or 1v1</span>
      </div>
      <button class="btn btn-primary" id="arena-find-match">▶ Start Solo Run</button>
    </div>
    <div class="card-elevated" style="text-align:center;padding:28px 20px;opacity:0.65;">
      <div style="font-size:2.2rem;margin-bottom:12px;filter:grayscale(0.5);">🎙️</div>
      <h3 style="font-family:var(--font-display);font-size:1.3rem;font-weight:300;color:var(--text-primary);margin-bottom:8px;">Dictation Race</h3>
      <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:20px;line-height:1.55;">Listen and transcribe native audio. Compete for accuracy and speed across increasing difficulty.</p>
      <div style="margin-bottom:16px;font-size:0.72rem;font-family:var(--font-mono);color:var(--text-muted);">Launching Stage 3+</div>
      <button class="btn btn-ghost" disabled>Requires Stage 3</button>
    </div>
  </div>

  <div class="card">
    <div style="font-size:0.65rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--text-muted);font-family:var(--font-mono);margin-bottom:16px;">Your Recent Matches</div>
    <div id="arena-matches-list">
      <div style="padding:20px 0;text-align:center;color:var(--text-muted);font-size:0.82rem;font-family:var(--font-mono);">Loading…</div>
    </div>
  </div>
</div>`;

    // Load real matches
    const matchList = canvas.querySelector("#arena-matches-list");
    if (matchList && me) {
      loadMyArenaMatches(8).then(matches => {
        if (!matchList.isConnected) return;
        if (!matches.length) {
          matchList.innerHTML = `<div style="padding:20px 0;text-align:center;color:var(--text-muted);font-size:0.85rem;">No matches yet — play your first!</div>`;
          return;
        }
        matchList.innerHTML = matches.map((m, i) => {
          const isWin  = m.winnerId === me.uid;
          const oppName = (m.players||[]).filter(p => p !== me.uid)[0] || "Unknown";
          return `<div style="display:grid;grid-template-columns:auto 1fr auto auto auto;gap:14px;align-items:center;padding:12px 0;${i<matches.length-1?"border-bottom:1px solid var(--border-subtle)":""}">
            <div style="width:8px;height:8px;border-radius:50%;background:${isWin?"#4ade80":"var(--error)"};"></div>
            <div>
              <span style="font-size:0.88rem;color:var(--text-primary);">${m.opponentName || oppName}</span>
              <span style="font-size:0.72rem;color:var(--text-muted);font-family:var(--font-mono);margin-left:10px;">${m.score||""}</span>
            </div>
            <div style="font-size:0.78rem;color:var(--text-muted);font-family:var(--font-mono);">${m.time||""}</div>
            <div style="font-size:0.78rem;font-family:var(--font-mono);color:${accent};">${m.xp?"+"+m.xp+" XP":""}</div>
            <div style="padding:2px 8px;border-radius:4px;font-size:0.68rem;font-family:var(--font-mono);background:${isWin?"rgba(74,222,128,0.1)":"rgba(248,113,113,0.1)"};color:${isWin?"#4ade80":"var(--error)"};">${isWin?"Win":"Loss"}</div>
          </div>`;
        }).join("");
      });
    } else if (matchList) {
      matchList.innerHTML = `<div style="padding:20px 0;text-align:center;color:var(--text-muted);font-size:0.85rem;">Sign in to see your match history.</div>`;
    }

    // Solo speed run
    canvas.querySelector("#arena-find-match")?.addEventListener("click", () => this._startArenaRun());
  }

  async _startArenaRun() {
    const lang    = this.currentLang;
    const canvas  = document.getElementById("center-canvas");
    const accent  = ACCENT[lang];
    const langData = await this._fetchLangData(lang);
    // Pick 10 random items from current stage
    const pool = [];
    const stage = this.currentProgress?.stageUnlocked || 0;
    (langData?.stages?.[stage]?.units || []).forEach(u => (u.items||[]).forEach(i => pool.push(i)));
    const items = pool.sort(() => Math.random() - 0.5).slice(0, 10);
    if (!items.length) { showToast("No content available for arena yet", "info"); return; }

    let idx = 0, correct = 0, startTime = Date.now();

    const renderQ = () => {
      if (idx >= items.length) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const xp = correct * 12;
        canvas.innerHTML = `<div class="canvas-content page-enter" style="text-align:center;padding:60px 40px;">
          <div style="font-size:3rem;margin-bottom:16px;">${correct>=8?"🏆":correct>=5?"⭐":"💪"}</div>
          <h2 style="font-family:var(--font-display);font-size:2rem;font-weight:300;color:var(--text-primary);margin-bottom:8px;">Run Complete</h2>
          <div style="font-size:1.1rem;color:${accent};font-family:var(--font-mono);margin-bottom:24px;">${correct}/10 correct · ${elapsed}s · +${xp} XP</div>
          <button class="btn btn-primary" id="arena-play-again">Play Again</button>
          <button class="btn btn-ghost" id="arena-back" style="margin-left:10px;">Back to Arena</button>
        </div>`;
        this._injectNavBar(canvas);
        canvas.querySelector("#arena-play-again")?.addEventListener("click", () => this._startArenaRun());
        canvas.querySelector("#arena-back")?.addEventListener("click", () => this._pageArena(canvas));
        if (xp > 0) {
          this.currentProgress.xp = (this.currentProgress.xp || 0) + xp;
          saveProgress(lang, this.currentProgress);
          showXpPopup(xp, correct >= 8 ? 5 : correct >= 5 ? 3 : 1, null);
        }
        return;
      }
      const item = items[idx];
      canvas.innerHTML = `<div class="canvas-content page-enter" style="max-width:500px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">
          <span style="font-size:0.75rem;font-family:var(--font-mono);color:var(--text-muted);">${idx+1} / 10</span>
          <span style="font-size:0.75rem;font-family:var(--font-mono);color:${accent};">${correct} correct</span>
        </div>
        <div class="card-elevated" style="padding:32px;text-align:center;margin-bottom:20px;">
          <div style="font-size:0.65rem;letter-spacing:0.2em;text-transform:uppercase;color:var(--text-muted);font-family:var(--font-mono);margin-bottom:12px;">Translate to ${LABEL[lang]}</div>
          <div style="font-size:1.5rem;font-weight:500;color:var(--text-primary);">${item.english || item.meaning || item.back || ""}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;" id="arena-options"></div>
      </div>`;
      this._injectNavBar(canvas);

      // Build options: 1 correct + 3 wrong
      const correct_ans = item.front || item.phrase || item.target || item.kanji || "";
      const all = pool.filter(p => p !== item).map(p => p.front || p.phrase || p.target || p.kanji || "").filter(Boolean);
      const wrongs = all.sort(() => Math.random() - 0.5).slice(0, 3);
      const options = [correct_ans, ...wrongs].sort(() => Math.random() - 0.5);

      const optContainer = canvas.querySelector("#arena-options");
      options.forEach(opt => {
        const btn = document.createElement("button");
        btn.className = "btn btn-ghost";
        btn.style.cssText = "text-align:left;padding:14px 18px;font-size:0.95rem;justify-content:flex-start;";
        btn.textContent = opt;
        btn.addEventListener("click", () => {
          const isRight = opt === correct_ans;
          if (isRight) correct++;
          btn.style.background = isRight ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)";
          btn.style.borderColor = isRight ? "#4ade80" : "var(--error)";
          optContainer.querySelectorAll("button").forEach(b => { b.disabled = true; });
          if (!isRight) {
            // Show correct
            optContainer.querySelectorAll("button").forEach(b => {
              if (b.textContent === correct_ans) { b.style.background = "rgba(74,222,128,0.15)"; b.style.borderColor = "#4ade80"; }
            });
          }
          setTimeout(() => { idx++; renderQ(); }, 900);
        });
        optContainer.appendChild(btn);
      });
    };
    renderQ();
  }

  // ── Support ───────────────────────────────────────────────────────
  _pageSupport(canvas) {
    const accent = ACCENT[this.currentLang] || "#8b7cff";
    canvas.innerHTML = `
<div class="canvas-content page-enter" style="max-width:620px;">
  <div style="margin-bottom:32px;">
    <h2 class="section-title">Support Vaultia</h2>
    <p class="section-subtitle">Keeping language learning independent and ad-free</p>
  </div>

  <div class="card-elevated" style="padding:32px;margin-bottom:20px;border-color:${accent}25;">
    <div style="font-size:2rem;margin-bottom:16px;">🌱</div>
    <h3 style="font-family:var(--font-display);font-size:1.5rem;font-weight:300;color:var(--text-primary);margin-bottom:14px;">Made with care</h3>
    <p style="font-size:0.9rem;color:var(--text-secondary);line-height:1.75;margin-bottom:14px;">Vaultia is an independent project — no venture capital, no advertisers, no data brokers. Just a genuine attempt to make language learning feel meaningful, beautiful, and worth your time.</p>
    <p style="font-size:0.9rem;color:var(--text-secondary);line-height:1.75;margin-bottom:20px;">If Vaultia has helped you, a small contribution on Ko-fi keeps the servers running, the content growing, and the team caffeinated.</p>
    <a href="${KOFI_URL}" target="_blank" rel="noopener" class="btn btn-primary" style="display:inline-flex;align-items:center;gap:8px;text-decoration:none;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
      Support on Ko-fi
    </a>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px;">
    ${[
      { icon:"🚫", title:"No Ads",         desc:"Your learning experience is never interrupted by advertising." },
      { icon:"🔒", title:"No Data Sales",  desc:"Your progress and usage is never sold to third parties." },
      { icon:"🌐", title:"Always Free",    desc:"Core features remain free — paying is entirely optional." },
      { icon:"💬", title:"Community First",desc:"Feature decisions are driven by learner feedback." },
    ].map(f => `
      <div class="card" style="padding:18px;">
        <div style="font-size:1.4rem;margin-bottom:8px;">${f.icon}</div>
        <div style="font-size:0.88rem;font-weight:500;color:var(--text-primary);margin-bottom:4px;">${f.title}</div>
        <div style="font-size:0.78rem;color:var(--text-muted);line-height:1.5;">${f.desc}</div>
      </div>
    `).join("")}
  </div>

  <div class="card" style="padding:20px 24px;text-align:center;">
    <div style="font-size:0.75rem;color:var(--text-muted);font-family:var(--font-mono);margin-bottom:8px;">Thank you for being here.</div>
    <div style="font-family:var(--font-display);font-size:1.2rem;font-weight:300;color:var(--text-secondary);">Every contribution makes a real difference.</div>
  </div>
</div>`;
  }

  // ── Profile ───────────────────────────────────────────────────────
  _pageProfile(canvas) {
    const user   = getUser();
    const accent = ACCENT[this.currentLang] || "#8b7cff";
    const xp     = this.currentProgress?.xp || 0;
    const level  = xpToLevel(xp);
    const dev    = isDevUser();

    canvas.innerHTML = `
<div class="canvas-content page-enter">
  <div class="section-header">
    <h2 class="section-title">Profile</h2>
  </div>
  <div style="display:grid;grid-template-columns:260px 1fr;gap:20px;align-items:start;">

    <!-- Avatar card -->
    <div class="card-elevated" style="text-align:center;padding:28px 20px;">
      <div style="width:72px;height:72px;border-radius:50%;background:${accent}20;border:2px solid ${accent}40;display:flex;align-items:center;justify-content:center;font-size:1.8rem;font-weight:600;color:${accent};margin:0 auto 16px;font-family:var(--font-display);overflow:hidden;">
        ${user?.photoURL
          ? `<img src="${user.photoURL}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'" />`
          : (user?.displayName || user?.email || "G")[0].toUpperCase()
        }
      </div>
      <div style="font-size:1.1rem;font-weight:500;color:var(--text-primary);margin-bottom:4px;">${user?.displayName || "Learner"}</div>
      <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:16px;word-break:break-all;">${user?.email || "Guest session"}</div>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:center;">
        ${dev ? `<span class="ws-tag" style="color:#a08fff;border-color:rgba(139,124,255,0.3);background:rgba(139,124,255,0.1);">Developer</span>` : ""}
        ${!user?._isLocal && !user?._isGuest ? `<span class="ws-tag" style="color:#4db8ff;border-color:rgba(77,184,255,0.25);background:rgba(77,184,255,0.1);">Cloud Synced</span>` : `<span class="ws-tag" style="color:#fbbf24;border-color:rgba(251,191,36,0.25);background:rgba(251,191,36,0.08);">Local Save</span>`}
      </div>
    </div>

    <!-- Stats -->
    <div style="display:flex;flex-direction:column;gap:16px;">
      <!-- Per-language summary -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
        ${Object.entries(this.allProgress).map(([l, p]) => `
          <div class="card" style="text-align:center;padding:14px;">
            <div style="font-size:0.65rem;color:var(--text-muted);text-transform:capitalize;font-family:var(--font-mono);margin-bottom:6px;">${l}</div>
            <div style="font-size:1.3rem;font-weight:600;font-family:var(--font-mono);color:${ACCENT[l]||accent};">${p.xp||0}</div>
            <div style="font-size:0.65rem;color:var(--text-muted);margin-top:2px;">XP · Lv.${xpToLevel(p.xp||0)}</div>
          </div>
        `).join("")}
      </div>

      <!-- Profile stats grid -->
      <div class="card profile-stat-grid">
        <div>
          <span class="profile-stat-value">${(this.currentProgress?.completed||[]).length}</span>
          <span class="profile-stat-label">Lessons</span>
        </div>
        <div>
          <span class="profile-stat-value">${this.currentProgress?.streak||0}</span>
          <span class="profile-stat-label">Commit</span>
        </div>
        <div>
          <span class="profile-stat-value">${level}</span>
          <span class="profile-stat-label">Level</span>
        </div>
      </div>

      <!-- Dev panel (dev users only) -->
      ${dev ? `
      <div class="card" style="background:rgba(139,124,255,0.04);border-color:rgba(139,124,255,0.18);">
        <div style="font-size:0.65rem;letter-spacing:0.14em;text-transform:uppercase;color:rgba(160,143,255,0.7);font-family:var(--font-mono);margin-bottom:14px;">Developer Tools</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.78rem;font-family:var(--font-mono);margin-bottom:12px;">
          <div class="card" style="padding:8px 12px;color:var(--text-secondary);">Firebase: ${this._fbReady ? "✓ Connected" : "✗ Local mode"}</div>
          <div class="card" style="padding:8px 12px;color:var(--text-secondary);">Auth: ${user?._isGuest ? "Guest" : user?._isLocal ? "Local" : "Firebase"}</div>
          <div class="card" style="padding:8px 12px;color:var(--text-secondary);">Active lang: ${this.currentLang||"none"}</div>
          <div class="card" style="padding:8px 12px;color:var(--text-secondary);">UID: ${(user?.uid||"").slice(0,14)}…</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button id="dev-add-xp" class="btn btn-sm btn-ghost" style="font-family:var(--font-mono);">Add 200 XP</button>
          <button id="dev-reset" class="btn btn-sm btn-danger" style="font-family:var(--font-mono);">Reset Progress</button>
        </div>
      </div>` : ""}
    </div>
  </div>
</div>`;

    canvas.querySelector("#dev-add-xp")?.addEventListener("click", async () => {
      this.currentProgress.xp = (this.currentProgress.xp || 0) + 200;
      await saveProgress(this.currentLang, this.currentProgress);
      eventBus.emit("progress:update", this.currentProgress);
      this.rightPanel?.updateProgress(this.currentProgress);
      showToast("+200 XP added (dev)", "info");
      this._pageProfile(canvas);
    });
    canvas.querySelector("#dev-reset")?.addEventListener("click", async () => {
      if (!confirm("Reset all progress for current language? This cannot be undone.\n\nLanguage: " + (LABEL[this.currentLang] || this.currentLang))) return;
      this.currentProgress = defaultProgress(this.currentLang);
      this.currentProgress.xp = 0;
      this.currentProgress.streak = 0;
      this.currentProgress.completed = [];
      this.currentProgress.stars = {};
      this.currentProgress.stageUnlocked = 0;
      this.currentProgress.accuracy = null;
      this.currentProgress.vocabSeen = [];
      await saveProgress(this.currentLang, this.currentProgress);
      this.allProgress[this.currentLang] = this.currentProgress;
      eventBus.emit("progress:update", this.currentProgress);
      this.rightPanel?.updateProgress(this.currentProgress);
      syncProgressToProfile(this.currentLang, this.currentProgress);
      showToast(`Progress reset for ${LABEL[this.currentLang] || this.currentLang}`, "success");
      this._pageProfile(canvas);
    });
  }

  // ── Leaderboards (live Firestore) ───────────────────────────────
  async _pageLeaderboards(canvas) {
    const me     = getUser();
    const accent = ACCENT[this.currentLang];
    let   mode   = "alltime";
    let   lang   = null;
    let   unsubLb = null;
    const STAGES = ["Starter","Beginner","Explorer","Speaker","Scholar","Specialist","Archivist"];

    const timeAgo = iso => {
      if (!iso) return "";
      const s = (Date.now() - new Date(iso)) / 1000;
      if (s < 120)   return "just now";
      if (s < 3600)  return Math.floor(s/60) + "m ago";
      if (s < 86400) return Math.floor(s/3600) + "h ago";
      return Math.floor(s/86400) + "d ago";
    };

    const renderRows = (rows) => {
      const body = canvas.querySelector("#lb-body");
      if (!body) return;
      if (!rows.length) {
        const msg = mode === "friends"
          ? "Add some friends first to see their scores here."
          : "No active learners yet — be the first on the board!";
        body.innerHTML = `<div style="padding:48px;text-align:center;color:var(--text-muted);font-size:0.9rem;">${msg}</div>`;
        return;
      }
      body.innerHTML = rows.map((u, idx) => {
        const rank  = idx + 1;
        const isMe  = u.uid === me?.uid;
        const xpVal = mode === "weekly" ? (u.weeklyXp || 0) : (u.xp || 0);
        const name  = u.username || u.email?.split("@")[0] || "Learner";
        const init  = name[0]?.toUpperCase() || "?";
        const ua    = ACCENT[u.currentLanguage] || accent || "#8b7cff";
        const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank;
        const mc    = rank === 1 ? "#fbbf24" : rank === 2 ? "#94a3b8" : rank === 3 ? "#cd7c2f" : "var(--text-muted)";
        return `<div class="lb-row" data-uid="${u.uid}" style="padding:13px 20px;border-bottom:1px solid var(--border-subtle);display:grid;grid-template-columns:42px 1fr 80px 70px 90px 90px;gap:8px;align-items:center;background:${isMe ? (ua)+"0d" : "transparent"};transition:background 0.15s;">
          <div style="font-size:${rank<=3?"1.05rem":"0.84rem"};font-weight:600;color:${mc};font-family:var(--font-mono);">${medal}</div>
          <div style="display:flex;align-items:center;gap:9px;cursor:pointer;" class="lb-name">
            <div style="position:relative;flex-shrink:0;">
              <div style="width:28px;height:28px;border-radius:50%;background:${ua}20;border:1px solid ${ua}40;display:flex;align-items:center;justify-content:center;font-size:0.74rem;font-weight:600;color:${ua};">${init}</div>
              ${u.online ? `<div style="position:absolute;bottom:0;right:0;width:8px;height:8px;border-radius:50%;background:#4ade80;border:1px solid var(--bg-surface);"></div>` : ""}
            </div>
            <div>
              <div style="font-size:0.87rem;font-weight:${isMe?600:400};color:${isMe?(ua):"var(--text-primary)"};">${name}${isMe?" (you)":""}</div>
              ${u.online ? `<div style="font-size:0.62rem;color:#4ade80;">online now</div>` : u.lastSeenAt ? `<div style="font-size:0.62rem;color:var(--text-muted);">${timeAgo(u.lastSeenAt)}</div>` : ""}
            </div>
          </div>
          <div style="font-family:var(--font-mono);font-size:0.87rem;color:${ua};">${xpVal.toLocaleString()}</div>
          <div style="font-size:0.82rem;color:var(--text-secondary);">${u.streak||0}d 🔥</div>
          <div style="font-size:0.7rem;font-family:var(--font-mono);color:var(--text-muted);">${STAGES[u.stageUnlocked||0]||"Starter"}</div>
          ${!isMe && me && !isGuest?.() ? `<button class="btn btn-sm btn-ghost lb-add-friend" data-uid="${u.uid}" style="font-size:0.7rem;padding:4px 8px;">+ Friend</button>` : `<div></div>`}
        </div>`;
      }).join("");

      body.querySelectorAll(".lb-name").forEach(el => {
        const uid = el.closest(".lb-row")?.dataset.uid;
        if (uid && uid !== me?.uid) {
          el.addEventListener("click", () => this._showUserCard(uid, canvas));
          el.style.cursor = "pointer";
        }
      });

      body.querySelectorAll(".lb-add-friend").forEach(btn => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          btn.disabled = true; btn.textContent = "…";
          const res = await sendFriendRequest(btn.dataset.uid);
          if (res.ok) { btn.textContent = "Sent ✓"; showToast("Friend request sent!", "success"); }
          else { btn.disabled = false; btn.textContent = "+ Friend"; showToast(res.error || "Failed", "error"); }
        });
      });
    };

    const startSub = () => {
      if (unsubLb) { unsubLb(); unsubLb = null; }
      if (mode === "friends") {
        // Friends leaderboard is static load (can't easily subscribe per-chunk)
        renderRows([]);
        loadLeaderboard("friends", lang).then(renderRows);
        return;
      }
      const xpField = mode === "weekly" ? "weeklyXp" : "xp";
      unsubLb = subscribeLeaderboard(renderRows, lang, xpField);
    };

    canvas.innerHTML = `
<div class="canvas-content page-enter">
  <div class="section-header">
    <div>
      <h2 class="section-title">Performance Board</h2>
      <p class="section-subtitle">Live rankings · only active learners · updates in real-time</p>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;">
      <button class="select-pill lb-mode active" data-m="alltime">All Time</button>
      <button class="select-pill lb-mode" data-m="weekly">This Week</button>
      <button class="select-pill lb-mode" data-m="friends">Friends</button>
    </div>
  </div>
  <div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap;">
    <button class="select-pill lb-lang active" data-l="">All Languages</button>
    <button class="select-pill lb-lang" data-l="japanese" style="color:${ACCENT.japanese};">Japanese</button>
    <button class="select-pill lb-lang" data-l="spanish" style="color:${ACCENT.spanish};">Spanish</button>
    <button class="select-pill lb-lang" data-l="korean" style="color:${ACCENT.korean};">Korean</button>
  </div>
  <div class="card-elevated" style="overflow:hidden;padding:0;">
    <div style="padding:10px 20px;border-bottom:1px solid var(--border-subtle);display:grid;grid-template-columns:42px 1fr 80px 70px 90px 90px;gap:8px;font-size:0.6rem;font-family:var(--font-mono);letter-spacing:0.1em;text-transform:uppercase;color:var(--text-muted);">
      <div>#</div><div>Learner</div><div>XP</div><div>Commit</div><div>Stage</div><div></div>
    </div>
    <div id="lb-body"><div style="padding:40px;text-align:center;color:var(--text-muted);font-size:0.82rem;font-family:var(--font-mono);">Connecting…</div></div>
  </div>
</div>`;

    canvas.querySelectorAll(".lb-mode").forEach(b => b.addEventListener("click", () => {
      canvas.querySelectorAll(".lb-mode").forEach(x => x.classList.remove("active"));
      b.classList.add("active"); mode = b.dataset.m; startSub();
    }));
    canvas.querySelectorAll(".lb-lang").forEach(b => b.addEventListener("click", () => {
      canvas.querySelectorAll(".lb-lang").forEach(x => x.classList.remove("active"));
      b.classList.add("active"); lang = b.dataset.l || null; startSub();
    }));

    startSub();

    // Cleanup on navigate
    const obs = new MutationObserver(() => {
      if (!canvas.querySelector("#lb-body")) { obs.disconnect(); if (unsubLb) { unsubLb(); unsubLb = null; } }
    });
    obs.observe(canvas, { childList: true });
  }

  // ── User card popup ────────────────────────────────────────────────
  async _showUserCard(uid, canvas) {
    const db  = getDb();
    const me  = getUser();
    if (!db) return;
    // Don't show card for yourself
    if (uid === me?.uid) return;
    const snap   = await db.collection("users").doc(uid).get().catch(() => null);
    if (!snap?.exists) return;
    const u      = { uid, ...snap.data() };
    const status = await getFriendStatus(uid);
    const accent = ACCENT[u.currentLanguage] || "#8b7cff";
    const name   = u.username || "Learner";
    const STAGE_NAMES = ["Starter","Beginner","Explorer","Speaker","Scholar","Specialist","Archivist"];
    const stage  = STAGE_NAMES[u.stageUnlocked||0] || "Starter";
    const xp     = u.xp || 0;
    const level  = Math.floor(xp / 200) + 1;

    const btnLabel = status==="accepted" ? "Friends ✓" : status==="pending_sent" ? "Request Sent" : status==="pending_received" ? "Accept Request" : "+ Add Friend";
    const btnStyle = status==="accepted" ? "background:rgba(74,222,128,0.1);color:#4ade80;border-color:rgba(74,222,128,0.3);" : "";

    // Build language progress bars
    const langs = ["japanese","spanish","korean"];
    const langBars = langs.map(l => {
      const lxp = u[`xp_${l}`] || (u.currentLanguage === l ? xp : 0);
      if (!lxp) return "";
      const lv = Math.floor(lxp / 200) + 1;
      const la = ACCENT[l];
      return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;">
        <div style="font-size:0.75rem;color:${la};width:60px;font-family:var(--font-mono);">${LABEL[l]}</div>
        <div style="flex:1;height:4px;background:var(--bg-hover);border-radius:2px;">
          <div style="width:${Math.min((lxp%200)/200*100,100)}%;height:100%;background:${la};border-radius:2px;"></div>
        </div>
        <div style="font-size:0.7rem;color:var(--text-muted);font-family:var(--font-mono);">Lv.${lv}</div>
      </div>`;
    }).filter(Boolean).join("");

    const modal = document.createElement("div");
    modal.style.cssText = "position:fixed;inset:0;z-index:400;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;padding:20px;";
    modal.innerHTML = `
      <div style="background:var(--bg-surface);border:1px solid var(--border-normal);border-radius:18px;width:100%;max-width:420px;overflow:hidden;">
        <!-- Header banner -->
        <div style="height:72px;background:linear-gradient(135deg,${accent}30,${accent}10);border-bottom:1px solid ${accent}20;position:relative;">
          <button id="uc-close" style="position:absolute;top:12px;right:14px;background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:1.3rem;line-height:1;">×</button>
        </div>
        <!-- Avatar -->
        <div style="padding:0 24px;margin-top:-36px;margin-bottom:0;">
          <div style="width:72px;height:72px;border-radius:50%;border:3px solid var(--bg-surface);overflow:hidden;background:${accent}20;display:flex;align-items:center;justify-content:center;font-size:1.6rem;font-weight:600;color:${accent};">
            ${u.photoURL ? `<img src="${u.photoURL}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'"/>` : name[0]?.toUpperCase()}
          </div>
        </div>
        <!-- Info -->
        <div style="padding:10px 24px 0;">
          <div style="font-size:1.1rem;font-weight:600;color:var(--text-primary);">${name}</div>
          <div style="font-size:0.75rem;color:${u.online?"#4ade80":"var(--text-muted)"};margin-bottom:12px;">${u.online?"● Online now":"Offline"}</div>
          <!-- Stats row -->
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;">
            ${[
              {v:xp.toLocaleString(), l:"XP"},
              {v:"Lv."+level, l:"Level"},
              {v:(u.streak||0)+"d", l:"Commit"},
              {v:stage, l:"Stage"},
            ].map(s=>`<div style="background:var(--bg-hover);border-radius:8px;padding:10px 6px;text-align:center;">
              <div style="font-size:0.88rem;font-weight:600;font-family:var(--font-mono);color:var(--text-primary);">${s.v}</div>
              <div style="font-size:0.6rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;">${s.l}</div>
            </div>`).join("")}
          </div>
          ${langBars ? `<div style="margin-bottom:12px;border-top:1px solid var(--border-subtle);padding-top:10px;"><div style="font-size:0.6rem;color:var(--text-muted);font-family:var(--font-mono);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">Languages</div>${langBars}</div>` : ""}
        </div>
        <!-- Actions -->
        <div style="padding:14px 24px 20px;display:flex;gap:8px;">
          <button id="uc-friend-btn" class="btn btn-primary" style="flex:1;${btnStyle}" ${status==="pending_sent"||status==="accepted"?"disabled":""}>${btnLabel}</button>
          <button id="uc-close2" class="btn btn-ghost">Close</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.addEventListener("click", e => { if(e.target===modal) close(); });
    modal.querySelector("#uc-close").addEventListener("click", close);
    modal.querySelector("#uc-close2").addEventListener("click", close);
    modal.querySelector("#uc-friend-btn").addEventListener("click", async () => {
      const btn = modal.querySelector("#uc-friend-btn");
      if (status === "accepted") return;
      if (status === "pending_received") {
        btn.textContent = "Accepting…"; btn.disabled = true;
        const res = await acceptFriendRequest(uid);
        if (res.ok) { showToast("Friends! 🎉", "success"); close(); }
        else showToast("Failed: " + res.error, "error");
      } else {
        btn.textContent = "Sending…"; btn.disabled = true;
        const res = await sendFriendRequest(uid);
        if (res.ok) { btn.textContent = "Request Sent"; showToast("Friend request sent!", "success"); }
        else { btn.disabled = false; btn.textContent = "+ Add Friend"; showToast("Failed: " + res.error, "error"); }
      }
    });
  }

  // ── Friends page ───────────────────────────────────────────────────
  async _pageFriends(canvas) {
    const me     = getUser();
    const accent = ACCENT[this.currentLang] || "#8b7cff";
    let   searchTimeout = null;
    let   unsubOnline   = null;

    const timeAgo = iso => {
      if (!iso) return "";
      const s = (Date.now() - new Date(iso)) / 1000;
      if (s < 120)   return "just now";
      if (s < 3600)  return Math.floor(s/60) + "m ago";
      if (s < 86400) return Math.floor(s/3600) + "h ago";
      return Math.floor(s/86400) + "d ago";
    };

    const renderFriends = async () => {
      const list = canvas.querySelector("#friends-list");
      if (!list) return;
      list.innerHTML = `<div style="padding:30px;text-align:center;color:var(--text-muted);font-size:0.82rem;font-family:var(--font-mono);">Loading…</div>`;
      const friends = await loadFriends();
      const pending = friends.filter(f => f.status === "pending" && f.initiator !== me?.uid);
      const accepted = friends.filter(f => f.status === "accepted");
      if (!friends.length) {
        list.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-muted);font-size:0.9rem;">No friends yet — search for learners above!</div>`;
        return;
      }
      let html = "";
      if (pending.length) {
        html += `<div style="font-size:0.62rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--text-muted);font-family:var(--font-mono);padding:14px 0 8px;">Pending Requests (${pending.length})</div>`;
        html += pending.map(f => {
          const p = f.profile;
          const fa = ACCENT[p.currentLanguage] || accent;
          const n  = p.username || "Learner";
          return `<div class="card" style="display:flex;align-items:center;gap:12px;padding:14px;margin-bottom:8px;">
            <div style="width:36px;height:36px;border-radius:50%;background:${fa}20;border:1px solid ${fa}35;display:flex;align-items:center;justify-content:center;font-size:0.85rem;font-weight:600;color:${fa};flex-shrink:0;">${n[0].toUpperCase()}</div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:0.9rem;font-weight:500;color:var(--text-primary);">${n}</div>
              <div style="font-size:0.72rem;color:var(--text-muted);">wants to be friends</div>
            </div>
            <button class="btn btn-sm btn-primary accept-req" data-uid="${p.uid}">Accept</button>
            <button class="btn btn-sm btn-ghost decline-req" data-uid="${p.uid}">Decline</button>
          </div>`;
        }).join("");
      }
      if (accepted.length) {
        html += `<div style="font-size:0.62rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--text-muted);font-family:var(--font-mono);padding:14px 0 8px;">Friends (${accepted.length})</div>`;
        html += accepted.map(f => {
          const p  = f.profile;
          const fa = ACCENT[p.currentLanguage] || accent;
          const n  = p.username || "Learner";
          return `<div class="card friend-row" data-uid="${p.uid}" style="display:flex;align-items:center;gap:12px;padding:14px;margin-bottom:8px;cursor:pointer;transition:border-color 0.15s;">
            <div style="position:relative;flex-shrink:0;">
              <div style="width:36px;height:36px;border-radius:50%;background:${fa}20;border:1px solid ${fa}35;display:flex;align-items:center;justify-content:center;font-size:0.85rem;font-weight:600;color:${fa};">${n[0].toUpperCase()}</div>
              ${p.online ? `<div style="position:absolute;bottom:0;right:0;width:10px;height:10px;border-radius:50%;background:#4ade80;border:2px solid var(--bg-surface);"></div>` : ""}
            </div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:0.9rem;font-weight:500;color:var(--text-primary);">${n}</div>
              <div style="font-size:0.72rem;color:${p.online?"#4ade80":"var(--text-muted)"};">${p.online ? "Online now" : (p.lastSeenAt ? "Last seen " + timeAgo(p.lastSeenAt) : "Offline")}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:0.82rem;font-family:var(--font-mono);color:${fa};">${(p.xp||0).toLocaleString()} XP</div>
              <div style="font-size:0.68rem;color:var(--text-muted);">${p.streak||0}d commit 🔥</div>
            </div>
            <button class="btn btn-sm btn-ghost remove-friend" data-uid="${p.uid}" title="Remove friend" style="flex-shrink:0;opacity:0.5;">✕</button>
          </div>`;
        }).join("");
      }
      list.innerHTML = html;

      list.querySelectorAll(".accept-req").forEach(btn => btn.addEventListener("click", async () => {
        btn.disabled = true; btn.textContent = "…";
        const res = await acceptFriendRequest(btn.dataset.uid);
        if (res.ok) { showToast("Friends! 🎉","success"); renderFriends(); }
        else showToast(res.error||"Failed","error");
      }));
      list.querySelectorAll(".decline-req").forEach(btn => btn.addEventListener("click", async () => {
        await removeFriend(btn.dataset.uid); renderFriends();
      }));
      list.querySelectorAll(".friend-row").forEach(row => {
        row.addEventListener("mouseenter", () => row.style.borderColor = "var(--border-normal)");
        row.addEventListener("mouseleave", () => row.style.borderColor = "");
        row.addEventListener("click", e => {
          if (e.target.closest(".remove-friend")) return;
          this._showUserCard(row.dataset.uid, canvas);
        });
      });
      list.querySelectorAll(".remove-friend").forEach(btn => btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!confirm("Remove this friend?")) return;
        await removeFriend(btn.dataset.uid);
        showToast("Removed","info"); renderFriends();
      }));
    };

    const doSearch = async (q) => {
      const res = canvas.querySelector("#search-results");
      if (!res) return;
      if (!q.trim()) { res.innerHTML = ""; return; }
      res.innerHTML = `<div style="padding:12px;color:var(--text-muted);font-size:0.82rem;font-family:var(--font-mono);">Searching…</div>`;
      const users = await searchUsers(q);
      if (!users.length) { res.innerHTML = `<div style="padding:12px;color:var(--text-muted);font-size:0.85rem;">No users found for "${q}"</div>`; return; }
      res.innerHTML = users.map(u => {
        const ua = ACCENT[u.currentLanguage] || accent;
        const n  = u.username || "Learner";
        return `<div class="card" style="display:flex;align-items:center;gap:10px;padding:12px;margin-bottom:6px;">
          <div style="position:relative;flex-shrink:0;">
            <div style="width:32px;height:32px;border-radius:50%;background:${ua}20;border:1px solid ${ua}35;display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:600;color:${ua};">${n[0].toUpperCase()}</div>
            ${u.online ? `<div style="position:absolute;bottom:0;right:0;width:8px;height:8px;border-radius:50%;background:#4ade80;border:1px solid var(--bg-surface);"></div>` : ""}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:0.88rem;font-weight:500;color:var(--text-primary);">${n}${u.online?` <span style="font-size:0.62rem;color:#4ade80;">● online</span>`:""}</div>
            <div style="font-size:0.7rem;color:var(--text-muted);">${(u.xp||0).toLocaleString()} XP · ${u.streak||0}d commit</div>
          </div>
          <button class="btn btn-sm btn-primary add-friend-btn" data-uid="${u.uid}">+ Add</button>
        </div>`;
      }).join("");
      res.querySelectorAll(".add-friend-btn").forEach(btn => btn.addEventListener("click", async () => {
        btn.disabled = true; btn.textContent = "Sending…";
        const result = await sendFriendRequest(btn.dataset.uid);
        if (result.ok) { btn.textContent = "Sent ✓"; showToast("Friend request sent!","success"); }
        else { btn.disabled = false; btn.textContent = "+ Add"; showToast(result.error||"Failed","error"); }
      }));
    };

    canvas.innerHTML = `
<div class="canvas-content page-enter">
  <div class="section-header">
    <div>
      <h2 class="section-title">Friends</h2>
      <p class="section-subtitle">Connect with real learners • see who's online</p>
    </div>
  </div>

  <div class="card" style="margin-bottom:20px;padding:14px 16px;">
    <div style="font-size:0.65rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--text-muted);font-family:var(--font-mono);margin-bottom:8px;">Find Learners</div>
    <input id="friend-search" class="input" placeholder="Search by username…" style="width:100%;font-size:0.9rem;" />
    <div id="search-results" style="margin-top:8px;"></div>
  </div>

  <div id="friends-list">
    <div style="padding:30px;text-align:center;color:var(--text-muted);font-size:0.82rem;">Loading…</div>
  </div>
</div>`;

    canvas.querySelector("#friend-search")?.addEventListener("input", e => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => doSearch(e.target.value), 350);
    });

    renderFriends();

    // Live-update online status
    unsubOnline = subscribeOnlineFriends(() => renderFriends());
    // Cleanup
    canvas.addEventListener("friends:cleanup", () => { if (unsubOnline) unsubOnline(); });
  }

  // ── Plaza (live Firestore) ─────────────────────────────────────────
  _pagePlaza(canvas) {
    const me     = getUser();
    const accent = ACCENT[this.currentLang];
    let   langFilter = null;
    let   unsubPlaza = null;

    const timeAgo = iso => {
      if (!iso) return "";
      const s = (Date.now() - new Date(iso)) / 1000;
      if (s < 60)    return "just now";
      if (s < 3600)  return Math.floor(s/60) + "m ago";
      if (s < 86400) return Math.floor(s/3600) + "h ago";
      return Math.floor(s/86400) + "d ago";
    };

    const renderPosts = (posts) => {
      const list = canvas.querySelector("#plaza-list");
      if (!list) return;
      if (!posts.length) {
        list.innerHTML = `<div style="padding:48px;text-align:center;color:var(--text-muted);font-size:0.9rem;">No posts yet — be the first to ask something!</div>`;
        return;
      }
      list.innerHTML = posts.map(p => {
        const pa    = ACCENT[p.lang] || accent;
        const liked = (p.likedBy||[]).includes(me?.uid);
        const init  = (p.username||"?")[0].toUpperCase();
        const isMyPost = p.uid === me?.uid;
        const cat   = PLAZA_CATEGORIES.find(c => c.id === p.category) || PLAZA_CATEGORIES[0];
        return `<div class="card" style="margin-bottom:14px;transition:border-color 0.15s;" data-post-id="${p.id}">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
            <div class="plaza-avatar-btn" data-uid="${p.uid}" style="width:30px;height:30px;border-radius:50%;background:${pa}1a;border:1px solid ${pa}30;display:flex;align-items:center;justify-content:center;font-size:0.78rem;font-weight:600;color:${pa};flex-shrink:0;cursor:${p.uid!==me?.uid&&me&&!isGuest?.()?"pointer":"default"};">${init}</div>
            <span style="font-size:0.85rem;font-weight:500;color:var(--text-primary);">${p.username||"Learner"}</span>
            ${p.uid !== me?.uid && me && !isGuest?.() ? `<button class="btn btn-sm btn-ghost plaza-add-friend" data-uid="${p.uid}" style="font-size:0.65rem;padding:2px 7px;">+ Friend</button>` : ""}
            <span style="font-size:0.72rem;color:var(--text-muted);margin-left:auto;">${timeAgo(p.createdAt)}</span>
            <span style="font-size:0.68rem;padding:2px 7px;border-radius:4px;background:${cat.color}18;color:${cat.color};font-family:var(--font-mono);">${cat.icon} ${cat.label}</span>
            <span style="font-size:0.68rem;padding:2px 7px;border-radius:4px;background:${pa}12;color:${pa};font-family:var(--font-mono);">${LABEL[p.lang]||p.lang||""}</span>
          </div>
          <div style="font-size:0.9rem;color:var(--text-primary);line-height:1.6;margin-bottom:10px;cursor:pointer;" class="plaza-open" data-post-id="${p.id}">${p.question}</div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            ${(p.tags||[]).map(t=>`<span style="font-size:0.65rem;font-family:var(--font-mono);padding:2px 8px;border-radius:4px;background:var(--bg-glass);color:var(--text-muted);">${t}</span>`).join("")}
            <div style="margin-left:auto;display:flex;align-items:center;gap:12px;">
              <button class="plaza-like" data-post-id="${p.id}" style="background:none;border:none;cursor:pointer;font-size:0.75rem;color:${liked?"#f87171":"var(--text-muted)"};display:flex;align-items:center;gap:4px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="${liked?"currentColor":"none"}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                ${p.likeCount||0}
              </button>
              <span style="font-size:0.72rem;color:var(--text-muted);font-family:var(--font-mono);">💬 ${p.replyCount||0}</span>
              ${isMyPost ? `<button class="plaza-delete-post btn btn-sm btn-ghost" data-post-id="${p.id}" style="color:var(--text-muted);font-size:0.7rem;">🗑</button>` : ""}
              <button class="btn btn-sm btn-ghost plaza-open" data-post-id="${p.id}">View →</button>
            </div>
          </div>
        </div>`;
      }).join("");

      list.querySelectorAll(".plaza-like").forEach(btn => btn.addEventListener("click", async e => {
        e.stopPropagation();
        if (!me || isGuest?.()) { showToast("Sign in to like posts","info"); return; }
        const r = await toggleLike(btn.dataset.postId);
        if (r.ok) showToast(r.liked ? "❤️ Liked" : "Unliked","info",1500);
      }));

      list.querySelectorAll(".plaza-delete-post").forEach(btn => btn.addEventListener("click", async e => {
        e.stopPropagation();
        if (!confirm("Delete this post and all its replies?")) return;
        btn.textContent = "…"; btn.disabled = true;
        const res = await deletePlazaPost(btn.dataset.postId);
        if (!res.ok) { showToast(res.error || "Failed to delete", "error"); btn.textContent = "🗑"; btn.disabled = false; }
        // Real-time subscribePlaza will remove it from the list automatically
      }));

      list.querySelectorAll(".plaza-add-friend").forEach(btn => btn.addEventListener("click", async e => {
        e.stopPropagation();
        btn.disabled = true; btn.textContent = "…";
        const res = await sendFriendRequest(btn.dataset.uid);
        if (res.ok) { btn.textContent = "Sent ✓"; showToast("Friend request sent!", "success"); }
        else { btn.disabled = false; btn.textContent = "+ Friend"; showToast(res.error || "Failed", "error"); }
      }));

      list.querySelectorAll(".plaza-open").forEach(el => {
        el.addEventListener("click", e => {
          e.stopPropagation();
          const id = el.dataset.postId;
          if (id) openPost(id);
        });
      });
    };

    const openPost = async (postId) => {
      const db    = getDb();
      const pSnap = db ? await db.collection("plaza_posts").doc(postId).get().catch(()=>null) : null;
      const post  = pSnap?.exists ? { id: pSnap.id, ...pSnap.data() } : null;

      const timeAgo2 = iso => {
        const s = (Date.now() - new Date(iso)) / 1000;
        if (s < 60) return "just now";
        if (s < 3600) return Math.floor(s/60) + "m ago";
        return Math.floor(s/3600) + "h ago";
      };

      const modal = document.createElement("div");
      modal.style.cssText = "position:fixed;inset:0;z-index:400;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:20px;";

      const isMyPost = post?.uid === me?.uid;

      modal.innerHTML = `
        <div style="background:var(--bg-surface);border:1px solid var(--border-normal);border-radius:14px;width:100%;max-width:580px;max-height:82vh;overflow:hidden;display:flex;flex-direction:column;">
          <div style="padding:16px 20px;border-bottom:1px solid var(--border-subtle);display:flex;align-items:center;gap:10px;">
            <h3 style="font-family:var(--font-display);font-size:1rem;font-weight:400;color:var(--text-primary);flex:1;">Discussion</h3>
            ${isMyPost ? `<button id="delete-post-btn" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:0.75rem;font-family:var(--font-mono);padding:4px 8px;border-radius:4px;transition:color 0.15s;" title="Delete post">🗑 Delete</button>` : ""}
            <button id="close-modal" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:1.3rem;line-height:1;">×</button>
          </div>
          <div style="overflow-y:auto;flex:1;padding:16px 20px;">
            ${post ? `
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
                <div class="plaza-avatar-btn" data-uid="${post.uid}" style="width:26px;height:26px;border-radius:50%;background:${ACCENT[post.lang]||accent}20;border:1px solid ${ACCENT[post.lang]||accent}30;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:600;color:${ACCENT[post.lang]||accent};cursor:${post.uid!==me?.uid?"pointer":"default"};flex-shrink:0;">${(post.username||"?")[0].toUpperCase()}</div>
                <span style="font-size:0.8rem;color:var(--text-secondary);">${post.username||"Learner"}</span>
                ${post.uid !== me?.uid && me && !isGuest?.() ? `<button class="btn btn-sm btn-ghost plaza-add-friend" data-uid="${post.uid}" style="font-size:0.68rem;padding:2px 7px;margin-left:4px;">+ Friend</button>` : ""}
                <span style="font-size:0.7rem;color:var(--text-muted);margin-left:auto;">${timeAgo2(post.createdAt)}</span>
              </div>
              <div style="font-size:0.95rem;color:var(--text-primary);line-height:1.65;padding-bottom:16px;margin-bottom:16px;border-bottom:1px solid var(--border-subtle);">${post.question}</div>` : ""}
            <div id="reply-list" style="display:flex;flex-direction:column;gap:12px;margin-bottom:16px;">
              <div style="color:var(--text-muted);font-size:0.82rem;font-family:var(--font-mono);">Loading replies…</div>
            </div>
          </div>
          ${me && !isGuest?.() ? `
          <div id="typing-indicator" style="display:none;padding:4px 20px;font-size:0.72rem;color:var(--text-muted);font-style:italic;font-family:var(--font-mono);border-top:1px solid var(--border-subtle);"></div>
          <div style="padding:12px 20px;border-top:1px solid var(--border-subtle);display:flex;gap:8px;">
            <input id="reply-input" class="input" placeholder="Write a reply…" style="flex:1;font-size:0.87rem;" />
            <button id="send-reply" class="btn btn-primary">Reply</button>
          </div>` : `<div style="padding:12px 20px;border-top:1px solid var(--border-subtle);font-size:0.82rem;color:var(--text-muted);">Sign in to reply</div>`}
        </div>`;

      document.body.appendChild(modal);

      // Real-time replies
      const renderReplies = (replies) => {
        const list = modal.querySelector("#reply-list");
        if (!list) return;
        if (!replies.length) {
          list.innerHTML = `<div style="color:var(--text-muted);font-size:0.85rem;">No replies yet. Be the first!</div>`;
          return;
        }
        list.innerHTML = replies.map(r => {
          const isMyReply = r.uid === me?.uid;
          const ra = ACCENT[r.lang] || accent;
          return `<div style="display:flex;gap:10px;align-items:flex-start;" data-reply-id="${r.id}">
            <div class="plaza-avatar-btn" data-uid="${r.uid}" style="width:26px;height:26px;border-radius:50%;background:${ra}20;border:1px solid ${ra}30;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:600;color:${ra};flex-shrink:0;cursor:${r.uid!==me?.uid?"pointer":"default"};">${(r.username||"?")[0].toUpperCase()}</div>
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;flex-wrap:wrap;">
                <span style="font-size:0.78rem;font-weight:500;color:var(--text-secondary);">${r.username||"Learner"}</span>
                ${r.uid !== me?.uid && me && !isGuest?.() ? `<span class="plaza-friend-tag" data-uid="${r.uid}" style="font-size:0.62rem;padding:1px 6px;cursor:pointer;color:var(--text-muted);border:1px solid var(--border-subtle);border-radius:4px;">+ Friend</span>` : ""}
                <span style="font-size:0.68rem;color:var(--text-muted);margin-left:auto;">${timeAgo2(r.createdAt)}</span>
                ${isMyReply ? `<button class="delete-reply-btn" data-reply-id="${r.id}" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:0.68rem;font-family:var(--font-mono);padding:0 4px;" title="Delete reply">🗑</button>` : ""}
              </div>
              <div style="font-size:0.88rem;color:var(--text-primary);line-height:1.55;">${r.body}</div>
            </div>
          </div>`;
        }).join("");

        // Delete reply buttons
        list.querySelectorAll(".delete-reply-btn").forEach(btn => {
          btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            if (!confirm("Delete this reply?")) return;
            const res = await deletePlazaReply(postId, btn.dataset.replyId);
            if (!res.ok) showToast(res.error || "Failed to delete", "error");
            // Real-time subscription will update the list automatically
          });
        });

        // Friend buttons inside replies
        list.querySelectorAll(".plaza-add-friend").forEach(btn => {
          btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            btn.disabled = true; btn.textContent = "…";
            const res = await sendFriendRequest(btn.dataset.uid);
            if (res.ok) { btn.textContent = "Sent ✓"; showToast("Friend request sent!", "success"); }
            else { btn.disabled = false; btn.textContent = "+ Friend"; showToast(res.error || "Failed", "error"); }
          });
        });
      };

      // Subscribe real-time
      const unsubReplies = subscribeReplies(postId, renderReplies);

      // Delete post
      modal.querySelector("#delete-post-btn")?.addEventListener("click", async () => {
        if (!confirm("Delete this post and all its replies?")) return;
        const res = await deletePlazaPost(postId);
        if (res.ok) { showToast("Post deleted", "success"); modal.remove(); }
        else showToast(res.error || "Failed to delete", "error");
      });

      // Friend button on post author
      modal.querySelector(".plaza-add-friend")?.addEventListener("click", async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true; btn.textContent = "…";
        const res = await sendFriendRequest(btn.dataset.uid);
        if (res.ok) { btn.textContent = "Sent ✓"; showToast("Friend request sent!", "success"); }
        else { btn.disabled = false; btn.textContent = "+ Friend"; showToast(res.error || "Failed", "error"); }
      });

      const close = () => { unsubReplies(); modal.remove(); };
      modal.querySelector("#close-modal")?.addEventListener("click", close);
      modal.addEventListener("click", e => { if (e.target === modal) close(); });

      modal.querySelector("#send-reply")?.addEventListener("click", async () => {
        const input = modal.querySelector("#reply-input");
        const body  = input?.value?.trim();
        if (!body) return;
        if (_isBlocked(body)) { showToast("That content violates community guidelines.", "error"); return; }
        const { clean } = _filterContent(body);
        input.value = ""; input.disabled = true;
        setTyping(postId, false);
        const res = await replyToPost(postId, clean);
        input.disabled = false;
        if (!res.ok) showToast(res.error || "Failed to reply", "error");
      });

      // Typing indicator: show/broadcast when user types
      let typingTimer = null;
      modal.querySelector("#reply-input")?.addEventListener("input", () => {
        setTyping(postId, true);
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => setTyping(postId, false), 2500);
      });
      // Subscribe to others typing
      const unsubTyping = subscribeTyping(postId, typists => {
        const el = modal.querySelector("#typing-indicator");
        if (!el) return;
        if (!typists.length) { el.style.display = "none"; return; }
        el.style.display = "block";
        el.textContent = typists.length === 1
          ? `${typists[0].username} is typing…`
          : `${typists.map(t=>t.username).join(", ")} are typing…`;
      });
      const origClose = close;
      // Wrap close to also unsub typing
      modal.querySelector("#close-modal")?.addEventListener("click", () => { unsubTyping(); origClose(); });

      modal.querySelector("#reply-input")?.addEventListener("keydown", e => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); modal.querySelector("#send-reply")?.click(); }
      });
    };

    const showNewPostModal = () => {
      if (!me || isGuest?.()) { showToast("Sign in to post questions","info"); return; }
      let selLang = this.currentLang;
    let selCategory = "question";
      const modal = document.createElement("div");
      modal.style.cssText = "position:fixed;inset:0;z-index:400;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:20px;";
      modal.innerHTML = `
        <div style="background:var(--bg-surface);border:1px solid var(--border-normal);border-radius:14px;width:100%;max-width:500px;">
          <div style="padding:16px 20px;border-bottom:1px solid var(--border-subtle);display:flex;align-items:center;">
            <h3 style="font-family:var(--font-display);font-size:1rem;font-weight:400;flex:1;color:var(--text-primary);">Post to the Plaza</h3>
            <button id="close-form" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:1.3rem;line-height:1;">×</button>
          </div>
          <div style="padding:20px;display:flex;flex-direction:column;gap:14px;">
            <div>
              <label style="font-size:0.65rem;color:var(--text-muted);font-family:var(--font-mono);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px;">Category</label>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                ${PLAZA_CATEGORIES.map(c => `<button class="select-pill np-cat${c.id==="question"?" active":""}" data-c="${c.id}" style="color:${c.color};">${c.icon} ${c.label}</button>`).join("")}
              </div>
            </div>
            <div>
              <label style="font-size:0.65rem;color:var(--text-muted);font-family:var(--font-mono);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px;">Language</label>
              <div style="display:flex;gap:6px;">
                ${["japanese","spanish","korean"].map(l => `<button class="select-pill np-lang${l===selLang?" active":""}" data-l="${l}" style="color:${ACCENT[l]};">${LABEL[l]}</button>`).join("")}
              </div>
            </div>
            <div>
              <label style="font-size:0.65rem;color:var(--text-muted);font-family:var(--font-mono);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px;">Your Post</label>
              <textarea id="np-q" class="input" placeholder="Share a question, discussion, tip, meme…" style="width:100%;height:90px;resize:vertical;font-size:0.88rem;line-height:1.5;"></textarea>
            </div>
            <div>
              <label style="font-size:0.65rem;color:var(--text-muted);font-family:var(--font-mono);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px;">Tags (comma separated, optional)</label>
              <input id="np-tags" class="input" placeholder="Grammar, Vocabulary…" style="font-size:0.87rem;width:100%;" />
            </div>
            <div id="np-err" style="display:none;color:var(--error);font-size:0.82rem;"></div>
            <button id="np-submit" class="btn btn-primary">Post</button>
          </div>
        </div>`;
      modal.querySelectorAll(".np-cat").forEach(b => b.addEventListener("click", () => {
        modal.querySelectorAll(".np-cat").forEach(x => x.classList.remove("active"));
        b.classList.add("active"); selCategory = b.dataset.c;
      }));
      modal.querySelectorAll(".np-lang").forEach(b => b.addEventListener("click", () => {
        modal.querySelectorAll(".np-lang").forEach(x => x.classList.remove("active"));
        b.classList.add("active"); selLang = b.dataset.l;
      }));
      document.body.appendChild(modal);
      modal.querySelector("#close-form").addEventListener("click",     () => modal.remove());
      modal.addEventListener("click", e => { if(e.target===modal) modal.remove(); });
      modal.querySelector("#np-submit").addEventListener("click", async () => {
        const q    = modal.querySelector("#np-q")?.value?.trim();
        const tags = (modal.querySelector("#np-tags")?.value||"").split(",").map(t=>t.trim()).filter(Boolean);
        const err  = modal.querySelector("#np-err");
        if (!q) { err.style.display="block"; err.textContent="Please enter a question."; return; }
        if (!selLang) { err.style.display="block"; err.textContent="Please select a language."; return; }
        err.style.display = "none";
        modal.querySelector("#np-submit").textContent = "Posting…";
        modal.querySelector("#np-submit").disabled    = true;
        // Profanity check
        if (_isBlocked(q)) { err.style.display="block"; err.textContent="That content violates our community guidelines."; modal.querySelector("#np-submit").disabled=false; modal.querySelector("#np-submit").textContent="Post Question"; return; }
        const { clean: cleanQ } = _filterContent(q);
        const res = await createPlazaPost({ question: cleanQ, lang: selLang, tags, category: selCategory });
        if (res.ok) { modal.remove(); showToast("Question posted! 🎉","success"); }
        else {
          const msg = (res.error || "").toLowerCase().includes("permission")
            ? "Firestore rules not deployed yet. Go to Firebase Console → Firestore → Rules and publish the rules from firestore.rules."
            : res.error || "Failed to post.";
          err.style.display="block";
          err.textContent = msg;
          modal.querySelector("#np-submit").disabled=false;
          modal.querySelector("#np-submit").textContent="Post Question";
        }
      });
    };

    canvas.innerHTML = `
<div class="canvas-content page-enter">
  <div class="section-header">
    <div>
      <h2 class="section-title">The Plaza</h2>
      <p class="section-subtitle">Live community board · real questions from real learners</p>
    </div>
    ${me && !isGuest?.() ? `<button id="plaza-post-btn" class="btn btn-primary">+ Ask Question</button>` : ""}
  </div>
  <div style="display:flex;gap:6px;margin-bottom:20px;flex-wrap:wrap;">
    <button class="select-pill plaza-lang active" data-l="">All Languages</button>
    <button class="select-pill plaza-lang" data-l="japanese" style="color:${ACCENT.japanese};">Japanese</button>
    <button class="select-pill plaza-lang" data-l="spanish"  style="color:${ACCENT.spanish};">Spanish</button>
    <button class="select-pill plaza-lang" data-l="korean"   style="color:${ACCENT.korean};">Korean</button>
  </div>
  <div id="plaza-list">
    <div style="padding:40px;text-align:center;color:var(--text-muted);font-size:0.82rem;font-family:var(--font-mono);">Connecting to live feed…</div>
  </div>
</div>`;

    canvas.querySelector("#plaza-post-btn")?.addEventListener("click", showNewPostModal);
    canvas.querySelectorAll(".plaza-lang").forEach(b => b.addEventListener("click", () => {
      canvas.querySelectorAll(".plaza-lang").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      langFilter = b.dataset.l || null;
      if (unsubPlaza) unsubPlaza();
      unsubPlaza = subscribePlaza(renderPosts, langFilter);
    }));

    unsubPlaza = subscribePlaza(renderPosts, null);

    // Cleanup listener when navigating away
    const origInner = canvas.innerHTML;
    const obs = new MutationObserver(() => {
      if (!canvas.querySelector("#plaza-list")) { obs.disconnect(); if (unsubPlaza) { unsubPlaza(); unsubPlaza = null; } }
    });
    obs.observe(canvas, { childList: true });
  }

  // ── Settings ──────────────────────────────────────────────────────
  _pageSettings(canvas) {
    const user = getUser();
    const prefs = JSON.parse(localStorage.getItem("vaultia_prefs") || "{}");

    const defaults = {
      daily_reminder:    true,
      streak_alerts:     true,
      community_replies: false,
      xp_milestones:     true,
      lang_effects:      true,
      animated_bg:       true,
      reduced_motion:    false,
      cloud_sync:        !user?._isLocal,
      usage_analytics:   false,
    };
    const get = k => prefs[k] !== undefined ? prefs[k] : defaults[k];

    canvas.innerHTML = `
<div class="canvas-content page-enter" style="max-width:560px;">
  <div class="section-header">
    <h2 class="section-title">Settings</h2>
  </div>

  <!-- Profile section -->
  <div class="settings-section">
    <div class="settings-section-title">Profile</div>
    <div class="card-elevated" style="padding:20px;display:flex;align-items:center;gap:16px;">
      <div style="position:relative;flex-shrink:0;">
        <div id="pfp-preview" style="width:56px;height:56px;border-radius:50%;background:var(--accent-primary,#8b7cff)20;border:2px solid var(--accent-primary,#8b7cff)40;display:flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:600;color:var(--accent-primary,#8b7cff);overflow:hidden;">
          ${user?.photoURL ? `<img src="${user.photoURL}" style="width:100%;height:100%;object-fit:cover;" />` : (user?.displayName||user?.email||"G")[0].toUpperCase()}
        </div>
        <label for="pfp-input" style="position:absolute;bottom:-2px;right:-2px;width:18px;height:18px;border-radius:50%;background:var(--bg-panel);border:1px solid var(--border-normal);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:0.6rem;" title="Change photo">✏️</label>
        <input id="pfp-input" type="file" accept="image/*" style="display:none;" />
      </div>
      <div style="flex:1;display:flex;flex-direction:column;gap:8px;">
        <input id="display-name-input" class="input" value="${user?.displayName||""}" placeholder="Display name" style="font-size:0.9rem;" />
        <div style="font-size:0.75rem;color:var(--text-muted);">${user?.email||"Guest"}</div>
      </div>
      <button id="save-profile-btn" class="btn btn-sm btn-primary">Save</button>
    </div>
  </div>

  ${[
    { label:"Notifications", rows:[
      { key:"daily_reminder",    name:"Daily reminder",     hint:"" },
      { key:"streak_alerts",     name:"Commit alerts",      hint:"" },
      { key:"community_replies", name:"Community replies",  hint:"" },
      { key:"xp_milestones",     name:"XP milestones",      hint:"" },
    ]},
    { label:"Appearance", rows:[
      { key:"lang_effects",    name:"Language environment effects", hint:"Sakura petals, neon glows, and more" },
      { key:"animated_bg",     name:"Real photo backgrounds",       hint:"Language-themed background images" },
      { key:"reduced_motion",  name:"Reduced motion",               hint:"Disables animations for accessibility" },
    ]},
    { label:"Data & Privacy", rows:[
      { key:"cloud_sync",       name:"Cloud sync",          hint:"Save progress to Firestore" },
      { key:"usage_analytics",  name:"Usage analytics",     hint:"Anonymous app usage data" },
    ]},
  ].map(section => `
    <div class="settings-section">
      <div class="settings-section-title">${section.label}</div>
      <div class="card-elevated" style="padding:0;overflow:hidden;">
        ${section.rows.map((row, i) => `
          <div class="settings-row">
            <div>
              <div class="settings-row-label">${row.name}</div>
              ${row.hint ? `<div class="settings-row-desc">${row.hint}</div>` : ""}
            </div>
            <div class="toggle${get(row.key)?" on":""}" data-pref="${row.key}" role="switch" aria-checked="${get(row.key)}"></div>
          </div>
        `).join("")}
      </div>
    </div>
  `).join("")}

  <div style="padding-top:20px;border-top:1px solid var(--border-subtle);margin-top:8px;display:flex;gap:10px;">
    <button class="btn btn-danger" id="delete-account-btn">Delete Account</button>
  </div>
</div>`;

    // Toggle prefs and apply immediately
    canvas.querySelectorAll(".toggle[data-pref]").forEach(t => {
      t.addEventListener("click", () => {
        t.classList.toggle("on");
        const key = t.dataset.pref;
        const val = t.classList.contains("on");
        prefs[key] = val;
        localStorage.setItem("vaultia_prefs", JSON.stringify(prefs));

        // Apply effects immediately
        if (key === "reduced_motion") {
          document.documentElement.style.setProperty("--t-base", val ? "0ms" : "160ms");
          document.documentElement.style.setProperty("--t-slow", val ? "0ms" : "300ms");
        }
        if (key === "lang_effects") {
          if (!val) { document.getElementById("petal-layer")?.remove(); }
          else if (this.currentLang) this._spawnEnvEffects(this.currentLang);
        }
        if (key === "animated_bg") {
          const bgLayer = document.getElementById("lang-bg-layer");
          if (bgLayer) bgLayer.style.opacity = val ? "1" : "0";
        }
        showToast(`${val ? "Enabled" : "Disabled"}: ${t.closest(".settings-row").querySelector(".settings-row-label").textContent}`, "info", 1500);
      });
    });

    // Profile pic upload (convert to base64 data URL for now)
    canvas.querySelector("#pfp-input")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      // Resize to 128x128 before saving — Firebase Auth photoURL has a size limit
      const img = new Image();
      const objectURL = URL.createObjectURL(file);
      img.onload = async () => {
        URL.revokeObjectURL(objectURL);
        const SIZE = 128;
        const cvs = document.createElement("canvas");
        cvs.width = SIZE; cvs.height = SIZE;
        const ctx = cvs.getContext("2d");
        // Center-crop
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2, sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, SIZE, SIZE);
        const dataURL = cvs.toDataURL("image/jpeg", 0.82);
        const preview = canvas.querySelector("#pfp-preview");
        if (preview) preview.innerHTML = `<img src="${dataURL}" style="width:100%;height:100%;object-fit:cover;" />`;
        const res = await updateProfile({ photoURL: dataURL });
        if (res.ok) showToast("Profile photo updated!", "success");
        else showToast(res.error || "Failed to update photo", "error");
      };
      img.src = objectURL;
    });

    // Save display name
    canvas.querySelector("#save-profile-btn")?.addEventListener("click", async () => {
      const name = canvas.querySelector("#display-name-input")?.value?.trim();
      if (!name) { showToast("Enter a display name", "error"); return; }
      const btn = canvas.querySelector("#save-profile-btn");
      btn.disabled = true; btn.textContent = "Saving…";
      const res = await updateProfile({ displayName: name });
      btn.disabled = false; btn.textContent = "Save";
      if (res.ok) showToast("Profile updated!", "success");
      else showToast(res.error || "Failed to save", "error");
    });

    canvas.querySelector("#delete-account-btn")?.addEventListener("click", () => {
      showToast("Account deletion — please contact support.", "info", 4000);
    });
  }

  // ── Preferences ───────────────────────────────────────────────────
  _pagePreferences(canvas) {
    const accent = ACCENT[this.currentLang];
    const prog   = this.currentProgress || {};

    canvas.innerHTML = `
<div class="canvas-content page-enter" style="max-width:580px;">
  <div class="section-header">
    <h2 class="section-title">Preferences</h2>
    <p class="section-subtitle" style="display:block;">Customize your ${LABEL[this.currentLang]} learning experience</p>
  </div>

  ${[
    {
      label: "Speech Register",
      key: "register",
      current: prog.register || "natural",
      desc: "Controls the formality level of vocabulary and example sentences.",
      options: [
        { val:"formal",  label:"Formal",  desc:"Business & academic — polished, textbook speech" },
        { val:"natural", label:"Natural", desc:"Everyday native speech — the most versatile choice" },
        { val:"slang",   label:"Slang",   desc:"Informal youth speech — casual, colloquial contexts" },
        { val:"mixed",   label:"Mixed",   desc:"Adapts automatically to the scenario being studied" },
      ]
    },
    {
      label: "Immersion Mode",
      key: "immersionMode",
      current: prog.immersionMode || "partial",
      desc: "How much your native language appears during sessions.",
      options: [
        { val:"full_translation", label:"Full Translation", desc:"Translation always visible — ideal for beginners" },
        { val:"partial",          label:"Partial",          desc:"Translation available on request — recommended" },
        { val:"full_immersion",   label:"Full Immersion",   desc:"Target language only — for advanced learners" },
      ]
    },
  ].map(sec => `
    <div class="settings-section">
      <div class="settings-section-title">${sec.label}</div>
      <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:12px;">${sec.desc}</p>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${sec.options.map(o => `
          <label class="pref-option ${o.val===sec.current?"selected":""}" data-key="${sec.key}" data-val="${o.val}"
                 style="${o.val===sec.current?`background:${accent}0d;border-color:${accent}40;`:""}">
            <div class="pref-radio ${o.val===sec.current?"active":""}" style="${o.val===sec.current?`border-color:${accent};background:${accent};`:""}">
              ${o.val===sec.current?"<div style='width:6px;height:6px;border-radius:50%;background:#000;'></div>":""}
            </div>
            <div>
              <div style="font-size:0.9rem;font-weight:500;color:var(--text-primary);margin-bottom:2px;">${o.label}</div>
              <div style="font-size:0.78rem;color:var(--text-muted);">${o.desc}</div>
            </div>
          </label>
        `).join("")}
      </div>
    </div>
  `).join("")}
  <button id="save-prefs" class="btn btn-primary">Save Preferences</button>

</div>`;

    // Pref selection
    canvas.querySelectorAll(".pref-option").forEach(opt => {
      opt.addEventListener("click", () => {
        const key = opt.dataset.key;
        canvas.querySelectorAll(`.pref-option[data-key="${key}"]`).forEach(o => {
          const active = o.dataset.val === opt.dataset.val;
          o.classList.toggle("selected", active);
          o.style.background = active ? `${accent}0d` : "";
          o.style.borderColor = active ? `${accent}40` : "";
          const radio = o.querySelector(".pref-radio");
          if (radio) { radio.classList.toggle("active", active); radio.style.borderColor = active ? accent : ""; radio.style.background = active ? accent : ""; radio.innerHTML = active ? "<div style='width:6px;height:6px;border-radius:50%;background:#000;'></div>" : ""; }
        });
      });
    });

    canvas.querySelector("#save-prefs")?.addEventListener("click", async () => {
      canvas.querySelectorAll(".pref-option.selected").forEach(o => {
        if (this.currentProgress) this.currentProgress[o.dataset.key] = o.dataset.val;
      });
      if (this.currentLang && this.currentProgress) {
        await saveProgress(this.currentLang, this.currentProgress);
        showToast("Preferences saved", "success");
      }
    });


  }

  // ── Helpers ───────────────────────────────────────────────────────
  async _fetchLangData(lang) {
    if (this._langDataCache[lang]) return this._langDataCache[lang];
    try {
      const d = await (await fetch(`./data/${lang}.json`)).json();
      this._langDataCache[lang] = d;
      return d;
    } catch { return null; }
  }

  _registerGlobalEvents() {
    eventBus.on("session:correct",     () => { document.getElementById("env-canvas")?.classList.add("glow-correct");   setTimeout(()=>document.getElementById("env-canvas")?.classList.remove("glow-correct"),1400); });
    eventBus.on("session:incorrect",   () => { document.getElementById("env-canvas")?.classList.add("glow-error");     setTimeout(()=>document.getElementById("env-canvas")?.classList.remove("glow-error"),900); });
    eventBus.on("nav:backToLanguages", () => { this.currentLang=null; this._setEnv(null); this._buildShell(); this._showHub(); });
    eventBus.on("nav:home",            () => { if (this.currentLang) this._showWorkspace(); });
    eventBus.on("nav:showAuth",        () => this._showAuth());
    eventBus.on("nav:support",         () => { const c=document.getElementById("center-canvas"); if(c) this._pageSupport(c); });
  }
}

const app = new VaultiaApp();
app.boot();

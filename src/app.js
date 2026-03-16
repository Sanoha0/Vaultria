/**
 * Vaultria — App Orchestrator v3 (Production Demo)
 * Full workstation: workspace, all pages, skill tree, social feed, dev panel.
 */

import { initFirebase, getDb }  from "./firebase/instance.js";
import { listenAuthState, getUser, isDevUser, isGuest, setAvatarUrl, signOut, deleteAccount } from "./auth/authService.js";
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
import { loadProfile, updateProfile } from "./services/profileStore.js";

import { MomentumSystem } from "./systems/momentum/MomentumSystem.js";
import { SealSystem }     from "./systems/seals/SealSystem.js";
import { PrestigeSystem } from "./systems/prestige/PrestigeSystem.js";
import { ChronicleSystem } from "./systems/chronicle/ChronicleSystem.js";
import { RewardSelector }  from "./systems/chronicle/RewardSelector.js";
import { TrophyBoard }   from "./systems/trophies/TrophyBoard.js";
import { Familiar }       from "./systems/familiar/Familiar.js";
import { MomentumRing }   from "./systems/momentum/MomentumRing.js";
import { FrameRenderer }  from "./systems/identity/FrameRenderer.js";
import { mountSealFilters, renderSeal } from "./systems/seals/SealRenderer.js";
import { renderGlyphBadge }             from "./systems/identity/GlyphBadge.js";
import { ProfileDesk }                  from "./systems/desk/ProfileDesk.js";
import { computeEarned }                from "./systems/trophies/TROPHY_DEFS.js";
import { joinQueue, leaveQueue, subscribeQueue, subscribeMatch, submitAnswer, completeMatch } from "./services/arenaService.js";
import { XP_PER_LEVEL, KOFI_URL, STAGES } from "./utils/constants.js";
import {
  startPresence, endPresence, watchUserPresence, checkUserPresence, checkMultiplePresences, isUserOnlineRealtime,
  syncProgressToProfile,
  loadLeaderboard, loadReplies, createPlazaPost, replyToPost, toggleLike,
  loadFriends, sendFriendRequest, acceptFriendRequest, removeFriend,
  getFriendStatus, searchUsers, subscribePlaza, subscribeFriendRequests,
  subscribeOnlineFriends, subscribeLeaderboard, subscribeReplies,
  deletePlazaPost, deletePlazaReply, subscribeGlobalActivity,
  updateProfile as updateSocialProfile, setTyping, subscribeTyping, loadMyArenaMatches,
} from "./services/socialService.js";


// ── Accent colors per language ────────────────────────────────────
const ACCENT = { japanese:"#e8a0b8", korean:"#4db8ff", spanish:"#e8a44a" };
const LABEL  = { japanese:"Japanese", korean:"Korean", spanish:"Spanish" };

// ── Language backgrounds (Unsplash free-to-use photos) ─────────────
const LANG_BG = {
  japanese: "https://images.unsplash.com/photo-1522383225653-ed111181a951?w=1600&q=80&fit=crop", // Fushimi Inari torii gates
  korean:   "./Korean-Background.jpg", // Korean immersive background
  spanish:  "https://images.unsplash.com/photo-1543783207-ec64e4d95325?w=1600&q=80&fit=crop", // Colorful Mexican street
};
const LANG_BG_ALT = {
  japanese: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1600&q=80&fit=crop", // Tokyo night
  korean:   "./Korean-Background.jpg", // Korean immersive background
  spanish:  "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=80&fit=crop", // Spain architecture
};

// ── Plaza post categories ──────────────────────────────────────────
const PLAZA_CATEGORIES = [
  { id:"question",    label:"Question",    icon:"help",     color:"#a78bfa" },
  { id:"discussion",  label:"Discussion",  icon:"chat",     color:"#4db8ff" },
  { id:"tip",         label:"Tip",         icon:"spark",    color:"#fbbf24" },
  { id:"meme",        label:"Humor",       icon:"smile",    color:"#4ade80" },
  { id:"progress",    label:"Progress",    icon:"medal",    color:"#f472b6" },
  { id:"resource",    label:"Resource",    icon:"book",     color:"#e8a44a" },
];

function _plazaIconSvg(kind, color) {
  const common = `fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
  if (kind === "help")  return `<svg width="14" height="14" viewBox="0 0 24 24" ${common}><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg>`;
  if (kind === "chat")  return `<svg width="14" height="14" viewBox="0 0 24 24" ${common}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>`;
  if (kind === "spark") return `<svg width="14" height="14" viewBox="0 0 24 24" ${common}><path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z"/></svg>`;
  if (kind === "smile") return `<svg width="14" height="14" viewBox="0 0 24 24" ${common}><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01"/><path d="M15 9h.01"/></svg>`;
  if (kind === "medal") return `<svg width="14" height="14" viewBox="0 0 24 24" ${common}><path d="M7 2h10l-2 7H9z"/><circle cx="12" cy="14" r="5"/><path d="M12 11v3"/><path d="M10.5 13.5h3"/></svg>`;
  if (kind === "book")  return `<svg width="14" height="14" viewBox="0 0 24 24" ${common}><path d="M4 19a2 2 0 0 0 2 2h14"/><path d="M6 17V5a2 2 0 0 1 2-2h12v18H8a2 2 0 0 1-2-2z"/></svg>`;
  return "";
}

function _uiIconSvg(kind, size = 18, color = "currentColor") {
  const common = `fill="none" stroke="${color}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"`;
  const box = `width="${size}" height="${size}" viewBox="0 0 24 24"`;

  if (kind === "books") {
    return `<svg ${box} ${common} aria-hidden="true"><path d="M4 19a2 2 0 0 0 2 2h14"/><path d="M6 17V5a2 2 0 0 1 2-2h12v18H8a2 2 0 0 1-2-2z"/><path d="M10 7h6"/></svg>`;
  }
  if (kind === "scroll") {
    return `<svg ${box} ${common} aria-hidden="true"><path d="M7 4h10v14a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3"/><path d="M7 8h6"/><path d="M7 12h6"/></svg>`;
  }
  if (kind === "leaf") {
    return `<svg ${box} ${common} aria-hidden="true"><path d="M20 4c-7 0-12 4-14 10"/><path d="M6 14c0 4 3 7 7 7 6 0 7-7 7-17-8 0-14 3-14 10z"/></svg>`;
  }
  if (kind === "pen") {
    return `<svg ${box} ${common} aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/></svg>`;
  }
  if (kind === "museum") {
    return `<svg ${box} ${common} aria-hidden="true"><path d="M3 10l9-6 9 6"/><path d="M4 10v10"/><path d="M20 10v10"/><path d="M8 10v10"/><path d="M12 10v10"/><path d="M16 10v10"/><path d="M3 20h18"/></svg>`;
  }
  if (kind === "flask") {
    return `<svg ${box} ${common} aria-hidden="true"><path d="M10 2v6L5 19a3 3 0 0 0 2.6 4h8.8A3 3 0 0 0 19 19L14 8V2"/><path d="M8 12h8"/></svg>`;
  }
  if (kind === "mask") {
    return `<svg ${box} ${common} aria-hidden="true"><path d="M4 7c2-2 6-3 8-3s6 1 8 3"/><path d="M6 7v6c0 3 3 7 6 7s6-4 6-7V7"/><path d="M9 12h.01"/><path d="M15 12h.01"/><path d="M10 16c1 .8 3 .8 4 0"/></svg>`;
  }
  if (kind === "lock") {
    return `<svg ${box} ${common} aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`;
  }
  if (kind === "bolt") {
    return `<svg ${box} ${common} aria-hidden="true"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>`;
  }
  if (kind === "play") {
    return `<svg ${box} ${common} aria-hidden="true"><path d="M8 5v14l12-7z"/></svg>`;
  }
  if (kind === "mic") {
    return `<svg ${box} ${common} aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z"/><path d="M19 11a7 7 0 0 1-14 0"/><path d="M12 18v4"/></svg>`;
  }
  if (kind === "trophy") {
    return `<svg ${box} ${common} aria-hidden="true"><path d="M8 4h8v3a4 4 0 0 1-8 0V4z"/><path d="M6 4H4v2a5 5 0 0 0 5 5"/><path d="M18 11a5 5 0 0 0 5-5V4h-2"/><path d="M12 11v5"/><path d="M9 21h6"/><path d="M10 16h4"/></svg>`;
  }
  if (kind === "chat") {
    return `<svg ${box} ${common} aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>`;
  }
  if (kind === "ban") {
    return `<svg ${box} ${common} aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M4.9 4.9l14.2 14.2"/></svg>`;
  }
  if (kind === "key") {
    return `<svg ${box} ${common} aria-hidden="true"><circle cx="7.5" cy="14.5" r="3.5"/><path d="M11 14.5h10"/><path d="M18 14.5v3"/><path d="M15 14.5v2"/></svg>`;
  }
  if (kind === "card") {
    return `<svg ${box} ${common} aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/></svg>`;
  }
  if (kind === "trash") {
    return `<svg ${box} ${common} aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 16h10l1-16"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>`;
  }

  return "";
}


// ── Arena option flash helper ─────────────────────────────────────
function _arenaFlashBtn(btn, isCorrect) {
  btn.style.background  = isCorrect ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.12)";
  btn.style.borderColor = isCorrect ? "#4ade80"               : "var(--error)";
  btn.style.color       = isCorrect ? "#4ade80"               : "var(--error)";
}

// ── Plaza moderation (strict text-only safety rails) ───────────────
const BLOCKED_PROFANITY_RE = /\b(fuck|shit|bitch|cunt|dick|cock|pussy|nigger|nigga|fag|faggot|whore|slut|bastard|damn|hell|crap|piss|twat|wanker|bollocks|motherfucker|asshole|bullshit)\b/i;
const BLOCKED_LINK_RE = /(https?:\/\/|www\.|discord\.gg|discordapp\.com\/invite|t\.me\/|bit\.ly|tinyurl\.com|linktr\.ee|mailto:|@everyone|@here|\b(?:[a-z0-9-]+\.)+(?:com|net|org|gg|io|co|tv|app|dev|ly|me)\b)/i;
const BLOCKED_NSFW_RE = /\b(nude|nudes|nsfw|porn|sex|sext|sexy|onlyfans|boobs?|tits?|penis|vagina|blowjob|cum|dildo|fetish|hentai)\b/i;
const BLOCKED_CONTACT_RE = /\b(snapchat|telegram|whatsapp|kik|instagram|insta|signal)\b/i;

function _normalizeCommunityText(text) {
  return String(text || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function _moderationResult(text) {
  const clean = _normalizeCommunityText(text);
  if (!clean) return { blocked: true, clean: "", reason: "Please write something first." };
  if (BLOCKED_LINK_RE.test(clean)) return { blocked: true, clean, reason: "Links, invites, and handles are not allowed in Plaza posts." };
  if (BLOCKED_NSFW_RE.test(clean)) return { blocked: true, clean, reason: "Sexual or NSFW content is not allowed in the Plaza." };
  if (BLOCKED_CONTACT_RE.test(clean)) return { blocked: true, clean, reason: "Contact-sharing is not allowed in the Plaza." };
  if (BLOCKED_PROFANITY_RE.test(clean)) return { blocked: true, clean, reason: "Keep the Plaza clean — no cursing." };
  return { blocked: false, clean, reason: "" };
}

function _filterContent(text) {
  return _moderationResult(text);
}

function _isBlocked(text) {
  return _moderationResult(text).blocked;
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
// Global helper for presence (used in template strings throughout this file)
// This will be set once app is initialized
let _appInstance = null;

function isUserOnline(user) {
  if (!user || !user.uid) return false;
  // Try to get from app presence cache first (real-time)
  if (_appInstance) {
    _appInstance._subscribeToPresence(user.uid); // Start subscription if not already done
    return _appInstance._isUserOnlineFromCache(user.uid);
  }
  // Fallback: no app instance yet
  return false;
}

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
    this._presenceCache  = {}; // Real-time presence data { uid -> { online, lastSeen, username } }
    this._presenceSubs   = new Map(); // Unsubscribe functions for presence listeners
    this._sessionIndex   = {}; // { langKey: Map(sessionId -> { stageKey, stageId, unitIndex, unitId }) }

    // Workstation reward/identity systems
    this.profile         = null;
    this._systems        = null;
    this._profileDesk    = null;
    this._profileFam     = null;
    this._profileRing    = null;
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
    if (!this._fbReady) { this._showAuth(); }
    setTimeout(() => { if (!authResolved) this._showAuth(); }, 3000);
  }

  // ── Auth ──────────────────────────────────────────────────────────
  _showAuth() {
    endPresence(); // Clean up real-time presence on logout
    const app = document.getElementById("app");
    if (!app) return;
    app.innerHTML = "";
    app.style.background = "";

    // ── Background: dark void with film grain + reactive tint layer ──
    const bg = document.createElement("div");
    bg.id = "auth-bg";
    bg.innerHTML = `
      <div class="auth-tint-layer"></div>
      <div class="auth-vignette"></div>
    `;
    app.appendChild(bg);

    const wrap = document.createElement("div");
    wrap.style.cssText = "position:fixed;inset:0;z-index:200;";
    app.appendChild(wrap);
    new AuthModal({ container: wrap, onAuthSuccess: (user) => { wrap.remove(); bg.remove(); this._onAuthenticated(user); } });
  }

  async _onAuthenticated(user) {
    this.allProgress = await loadAllProgress();
    this.profile = await loadProfile();
    this._applyThemeFromProfile(this.profile);
    await this._initSystemsOnce();
    this._buildShell();
    this._showHub();
    // Initialize real-time presence system (replaces old heartbeat)
    if (this._fbReady) startPresence();
    this._unsubFriendReqs = subscribeFriendRequests((reqs) => {
      this.rightPanel?.setBadge?.("friends", reqs.length > 0);
    });
    // First-time display name nudge (once per cloud account)
    if (user && !user._isGuest && !user._isLocal && user.uid) {
      const setupKey = `vaultria_setup_prompted_${user.uid}`;
      if (!localStorage.getItem(setupKey)) {
        localStorage.setItem(setupKey, "1");
        const looksAutoGenerated = user.email && user.displayName === user.email.split("@")[0];
        if (looksAutoGenerated || !user.displayName) {
          setTimeout(() => {
            showToast("Welcome to Vaultria! Set your display name so friends can find you.", "info", 5000);
          }, 1800);
        }
      }
    }
  }

  async _initSystemsOnce() {
    if (this._systems) return;

    // Shared SVG filters for seals (call once).
    mountSealFilters();

    this._systems = {
      momentum: new MomentumSystem(),
      seals: new SealSystem(),
      prestige: new PrestigeSystem(),
      chronicle: new ChronicleSystem(),
      rewardSelector: new RewardSelector(),
    };

    await this._systems.momentum.load();
    await ChronicleSystem.checkPending();

    eventBus.on("seal:awarded", ({ lang, stageKey }) => {
      // Quiet, artifact-like acknowledgement.
      showPrestigePopup(
        "Stage Seal Awarded",
        `${LABEL[lang] || lang} · ${stageKey}`,
        renderSeal(stageKey, 64, true)
      );
    });

    eventBus.on("prestige:awarded", ({ lang, rank, stage, reward }) => {
      const rewardLine = reward?.desc ? `Rank ${rank} · ${reward.desc}` : `Rank ${rank}`;
      showPrestigePopup(
        "Prestige Unlocked",
        `${LABEL[lang] || lang} · ${rewardLine}`,
        renderSeal(stage, 64, true)
      );
      // Refresh local cached profile (theme/material changes).
      loadProfile().then((p) => {
        this.profile = p;
        this._applyThemeFromProfile(p);
      });
    });

    eventBus.on("profile:changed", (p) => {
      this.profile = p;
      this._applyThemeFromProfile(p);
    });
  }

  _applyThemeFromProfile(profile) {
    const theme = profile?.uiTheme || "default";
    document.body.classList.toggle("theme-void", theme === "void");
  }

  /**
   * Subscribe to presence for a user and get real-time updates
   * Returns whether the user is currently online
   */
  _subscribeToPresence(uid) {
    if (!uid) return false;
    if (this._presenceSubs.has(uid)) return this._presenceCache[uid]?.online ?? false;

    const unsub = watchUserPresence(uid, (presenceData) => {
      this._presenceCache[uid] = presenceData;
      // Trigger UI update for any visible elements showing this user
      this._updatePresenceUI(uid);
    });
    this._presenceSubs.set(uid, unsub);
    return this._presenceCache[uid]?.online ?? false;
  }

  /**
   * Check if a user is online from cached presence data
   */
  _isUserOnlineFromCache(uid) {
    return this._presenceCache[uid]?.online ?? false;
  }

  /**
   * Update UI elements showing presence for a user
   */
  _updatePresenceUI(uid) {
    // Find all elements that show this user's presence indicator
    const isOnline = this._isUserOnlineFromCache(uid);
    const elements = document.querySelectorAll(`[data-presence-uid="${uid}"]`);
    elements.forEach((el) => {
      if (isOnline) {
        el.classList.add("online");
        el.classList.remove("offline");
      } else {
        el.classList.remove("online");
        el.classList.add("offline");
      }
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
      this.leftPanel = new LeftPanel({
        container:    lp,
        onNavigate:   id => this._onLeftNav(id),
        unlockedTabs: this._computeTutorialUnlocks(this.currentProgress),
      });
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
    const langData       = await this._fetchLangData(lang);

    if (langData && this.currentProgress) {
      const derivedStage = this._computeStageUnlock(langData, this.currentProgress);
      if ((this.currentProgress.stageUnlocked || 0) !== derivedStage) {
        this.currentProgress.stageUnlocked = derivedStage;
        await saveProgress(lang, this.currentProgress);
      }
      this.allProgress[lang] = this.currentProgress;
    }

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
    const momentumScore = this.profile?.momentum?.score ?? 0;
    const momentumPct = Math.round(
      (Math.log10(1 + Math.max(0, momentumScore)) / Math.log10(1001)) * 100
    );
    const stageNames = ["Starter","Beginner","Explorer","Speaker","Scholar","Specialist","Archivist"];
    const stage = stageNames[prog?.stageUnlocked || 0] || "Starter";

    // Phrase of the day
    const phraseBank  = PHRASES[lang] || [];
    const dayIndex    = Math.floor(Date.now() / 86400000) % (phraseBank.length || 1);
    const todayPhrase = phraseBank[dayIndex];
    const cult        = CULTURAL[lang];

    // Lesson data
    const langData   = await this._fetchLangData(lang);
    const nextSession = this._getNextSession(langData, prog);
    const summary    = this._summarizeCurriculum(langData, prog);

    // Stage progress pct for hero bar
    const stageDone  = summary.currentStageUnitsDone  || 0;
    const stageTotal = summary.currentStageUnitsTotal || 1;
    const stagePct   = Math.min(100, Math.round((stageDone / stageTotal) * 100));

    // Review item count (real pool, not old queue)
    const reviewItems = this._buildReviewItems(prog);
    const reviewCount = reviewItems.length;

    // Phrase library count
    const phraseLibCount = (prog?.phraseLibrary || []).length;

    // Tutorial-aware locked check
    const unlockedTabs = prog?.tutorialState?.unlockedTabs ?? null;
    const isTabUnlocked = (id) => unlockedTabs === null || (unlockedTabs || []).includes(id);

    // Vocabulary seen
    const vocabCount = (prog?.vocabSeen || []).length || (prog?.weakWords || []).length || 0;

    canvas.innerHTML = `
<div class="workspace-root page-enter">

  <!-- ── Header ── -->
  <div class="ws-header">
    <div class="ws-header-left">
      <h1 class="ws-lang-title">${LABEL[lang]} <span class="ws-lang-native">${NATIVE[lang]}</span></h1>
      <div class="ws-breadcrumb">${stage} · Level ${level} · ${summary.completedUnits}/${summary.totalUnits} units</div>
    </div>
    <div class="ws-header-stats">
      <div class="ws-stat-chip">
        <span class="ws-stat-val" style="color:${accent};">${xp.toLocaleString()}</span>
        <span class="ws-stat-label">XP Total</span>
      </div>
      <div class="ws-stat-chip">
        <span class="ws-stat-val" style="color:${momentumPct > 55 ? "#fbbf24" : "var(--text-muted)"};">${momentumPct}%</span>
        <span class="ws-stat-label">Momentum</span>
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

  <!-- ══ 1. HERO — Continue Lesson ══ -->
  <div class="ws-hero-card ws-card" style="border-color:${accent}28;background:linear-gradient(135deg,${accent}07 0%,transparent 60%);">
    <div class="ws-card-eyebrow" style="color:${accent};margin-bottom:14px;">Your Daily Loop · Lesson</div>
    <div class="ws-hero-body">
      <div class="ws-hero-text">
        <div class="ws-hero-title">${nextSession ? nextSession.title : "All caught up for this stage"}</div>
        <div class="ws-hero-sub">${stage} · ${stageDone} of ${stageTotal} units complete</div>
      </div>
      <button id="ws-continue-lesson" class="btn btn-primary ws-hero-btn" style="background:${accent};border-color:${accent};color:#0a0a0e;flex-shrink:0;">
        Continue →
      </button>
    </div>
    <div class="ws-hero-stage-bar-track">
      <div class="ws-hero-stage-bar-fill" data-pct="${stagePct}" style="width:0%;background:${accent}80;"></div>
    </div>
    <div style="font-size:0.65rem;color:var(--text-muted);font-family:var(--font-mono);margin-top:5px;">${stagePct}% of ${stage} stage · ${stageTotal - stageDone} unit${(stageTotal - stageDone) !== 1 ? "s" : ""} remaining</div>
  </div>

  <!-- ══ 2. SECONDARY ROW — Review + Stats ══ -->
  <div class="ws-secondary-row">

    <!-- Review -->
    <div class="ws-card ws-review-hub-card">
      <div class="ws-card-eyebrow" style="margin-bottom:10px;">Daily Loop · Review</div>
      ${!isTabUnlocked("review") ? `
        <div class="ws-locked-hint">
          ${_uiIconSvg("lock", 15, "var(--text-muted)")}
          <span>Unlocks after your first lesson</span>
        </div>` :
      reviewCount === 0 ? `
        <div class="ws-review-empty">
          <div class="ws-review-empty-icon">✓</div>
          <div>
            <div style="font-size:0.88rem;color:var(--text-primary);font-weight:500;">Queue clear</div>
            <div style="font-size:0.72rem;color:var(--text-muted);font-family:var(--font-mono);margin-top:2px;">Keep learning to build your review library</div>
          </div>
        </div>` : `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div>
            <div style="font-size:1.55rem;font-weight:600;font-family:var(--font-mono);color:var(--text-primary);line-height:1;">${reviewCount}</div>
            <div style="font-size:0.7rem;color:var(--text-muted);font-family:var(--font-mono);margin-top:3px;">item${reviewCount !== 1 ? "s" : ""} to review</div>
          </div>
          <button id="ws-start-review" class="btn ws-review-btn" style="border-color:${accent}40;color:${accent};">
            Start Review →
          </button>
        </div>
        <div style="margin-top:12px;display:flex;flex-direction:column;gap:5px;">
          ${reviewItems.slice(0, 3).map(it => `
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:0.9rem;color:var(--text-primary);">${it.target}</span>
              ${it.romanji ? `<span style="font-size:0.65rem;color:var(--text-muted);font-family:var(--font-mono);">${it.romanji}</span>` : ""}
            </div>`).join("")}
          ${reviewCount > 3 ? `<div style="font-size:0.65rem;color:var(--text-muted);font-family:var(--font-mono);margin-top:2px;">+${reviewCount - 3} more</div>` : ""}
        </div>`}
    </div>

    <!-- Stats -->
    <div class="ws-card">
      <div class="ws-card-eyebrow" style="margin-bottom:10px;">Progress</div>
      <div class="ws-stats-list">
        ${[
          { label:"Sessions",   val: summary.completedSessions, max: Math.max(summary.totalSessions, 1), color: accent },
          { label:"Accuracy",   val: prog?.accuracy != null ? Math.round(prog.accuracy * 100) : null, max: 100, color:"#4ade80", suf:"%" },
          { label:"Vocabulary", val: vocabCount || null, max: 300, color: accent },
          { label:"Momentum",   val: momentumPct, max: 100, color:"#fbbf24", suf:"%" },
        ].map(s => `
          <div class="ws-stat-row">
            <div class="ws-stat-row-labels">
              <span>${s.label}</span>
              <span>${s.val != null ? s.val + (s.suf || "") : "—"}</span>
            </div>
            <div class="ws-stat-track">
              <div class="ws-stat-fill" style="width:${s.val != null ? Math.min(100, Math.round(s.val / s.max * 100)) : 0}%;background:${s.color};"></div>
            </div>
          </div>`).join("")}
      </div>
    </div>

  </div><!-- /ws-secondary-row -->

  <!-- ══ 3. AMBIENT ROW — Phrase of day + Cultural note ══ -->
  <div class="ws-ambient-row">

    <!-- Phrase of the day -->
    ${todayPhrase ? `
    <div class="ws-card ws-phrase-card" style="border-left:2px solid ${accent}50;">
      <div class="ws-card-eyebrow">Phrase of the Day</div>
      <div class="ws-phrase-main">${todayPhrase.phrase}</div>
      ${todayPhrase.romanji ? `<div class="ws-phrase-romanji">${todayPhrase.romanji}</div>` : ""}
      <div class="ws-phrase-meaning">${todayPhrase.meaning}</div>
      <div class="ws-phrase-footer">
        <span class="ws-tag" style="color:${accent};border-color:${accent}40;background:${accent}10;">${todayPhrase.register}</span>
        <span class="ws-tag-plain">${todayPhrase.context}</span>
        <button id="ws-phrase-play" style="background:none;border:none;cursor:pointer;color:${accent};opacity:0.75;padding:2px 6px;font-size:0.8rem;display:inline-flex;align-items:center;gap:4px;margin-left:auto;" title="Hear this phrase">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </button>
      </div>
    </div>` : ""}

    <!-- Cultural note -->
    ${cult ? `
    <div class="ws-card ws-cultural-card">
      <div class="ws-card-eyebrow">Cultural Note</div>
      <div class="ws-cultural-title">${cult.title}</div>
      <div class="ws-cultural-body">${cult.note}</div>
    </div>` : ""}

  </div><!-- /ws-ambient-row -->

  <!-- ══ 4. EXTRAS — compact tool tiles ══ -->
  <div class="ws-extras-section">
    <div class="ws-extras-eyebrow">Explore</div>
    <div class="ws-extras-row">

      ${[
        {
          id: "phrases",
          label: "Phrase Library",
          sub: phraseLibCount > 0 ? `${phraseLibCount} saved` : "Browse expressions",
          icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
        },
        {
          id: "challenges",
          label: "Chronicle",
          sub: "Milestones & rewards",
          icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
        },
        {
          id: "arena",
          label: "Arena",
          sub: "Speed translation",
          icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>`,
        },
        {
          id: "vault",
          label: "The Vault",
          sub: (prog?.stageUnlocked || 0) >= 6 ? "Unlocked" : "Unlock at Archivist",
          icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1"/></svg>`,
        },
      ].map(tool => {
        const unlocked = isTabUnlocked(tool.id) && (tool.id !== "vault" || (prog?.stageUnlocked || 0) >= 6);
        return `
          <button class="ws-extra-tile${unlocked ? "" : " ws-extra-tile--locked"}" data-nav="${tool.id}" ${unlocked ? "" : 'aria-disabled="true"'}>
            <span class="ws-extra-tile-icon" style="color:${unlocked ? accent : "var(--text-muted)"};">${tool.icon}</span>
            <span class="ws-extra-tile-label">${tool.label}</span>
            <span class="ws-extra-tile-sub">${unlocked ? tool.sub : "Locked"}</span>
          </button>`;
      }).join("")}

    </div>
  </div><!-- /ws-extras-section -->

  <!-- ══ 5. KNOWLEDGE MAP (collapsible) ══ -->
  <div class="ws-card">
    <div class="ws-map-header">
      <div class="ws-card-eyebrow" style="margin-bottom:0;">Knowledge Map</div>
      <button id="ws-toggle-tree" class="ws-link-btn" style="color:${accent};">Expand full map →</button>
    </div>
    <div id="ws-mini-tree" style="margin-top:14px;">${this._miniTree(lang, accent)}</div>
  </div>
  <div id="ws-full-tree" style="display:none;"></div>

  <!-- ══ 6. COMMUNITY ACTIVITY (compact) ══ -->
  <div class="ws-card">
    <div class="ws-card-eyebrow" style="margin-bottom:10px;">Community Activity</div>
    <div class="ws-feed" id="ws-community-feed">
      <div style="padding:8px 0;text-align:center;color:var(--text-muted);font-size:0.75rem;font-family:var(--font-mono);">Connecting…</div>
    </div>
  </div>

</div>`;

    // Animate XP bar + stage hero bar
    requestAnimationFrame(() => {
      const xpFill = canvas.querySelector(".ws-xp-bar-fill");
      if (xpFill) xpFill.style.width = xpFill.dataset.pct + "%";
      const stageFill = canvas.querySelector(".ws-hero-stage-bar-fill");
      if (stageFill) stageFill.style.width = stageFill.dataset.pct + "%";
    });

    // Hero: continue lesson
    canvas.querySelector("#ws-continue-lesson")?.addEventListener("click", () => {
      this._startNextLesson();
    });

    // Secondary: start review
    canvas.querySelector("#ws-start-review")?.addEventListener("click", () => {
      this._startReviewSession();
    });

    // Extras row tiles
    canvas.querySelectorAll(".ws-extra-tile:not([aria-disabled])").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.nav;
        if (id) this._onLeftNav(id);
      });
    });

    // Phrase of the day: play button
    canvas.querySelector("#ws-phrase-play")?.addEventListener("click", async (e) => {
      if (!todayPhrase) return;
      const btn = e.currentTarget;
      const result = await ttsSpeak(todayPhrase.phrase, lang);
      if (!result) {
        btn.style.opacity = "0.3";
        btn.title = "Audio not available for this phrase";
        setTimeout(() => { btn.style.opacity = "0.75"; }, 1200);
      }
    });

    // Knowledge map toggle
    let treeOpen = false;
    canvas.querySelector("#ws-toggle-tree")?.addEventListener("click", () => {
      treeOpen = !treeOpen;
      const el  = canvas.querySelector("#ws-full-tree");
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

    // Real-time community feed
    const feedEl = canvas.querySelector("#ws-community-feed");
    if (feedEl) {
      const timeAgoShort = iso => {
        if (!iso) return "";
        const s = (Date.now() - new Date(iso)) / 1000;
        if (s < 60)    return "now";
        if (s < 3600)  return Math.floor(s / 60) + "m";
        if (s < 86400) return Math.floor(s / 3600) + "h";
        return Math.floor(s / 86400) + "d";
      };
      const unsubFeed = subscribeGlobalActivity(items => {
        if (!feedEl.isConnected) { unsubFeed(); return; }
        if (!items.length) {
          feedEl.innerHTML = `<div style="padding:10px;text-align:center;color:var(--text-muted);font-size:0.75rem;">No activity yet — be the first!</div>`;
          return;
        }
        feedEl.innerHTML = items.slice(0, 5).map(a => {
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
      const obs = new MutationObserver(() => {
        if (!canvas.querySelector("#ws-community-feed")) { obs.disconnect(); unsubFeed(); }
      });
      obs.observe(canvas, { childList: true });
    }

    // ── First-run welcome modal ──────────────────────────────────────
    if ((prog?.tutorialState?.step ?? 0) === 0 && !(prog?.completed?.length)) {
      this._showWelcomeModal(lang, accent);
    }
  }

  // ── First-run welcome modal ──────────────────────────────────────
  _showWelcomeModal(lang, accent) {
    // Mark the modal as seen immediately so it won't re-appear on navigation
    const prog = this.currentProgress;
    if (!prog) return;
    if (!prog.tutorialState) prog.tutorialState = { step: 0, unlockedTabs: ["lessons"] };
    prog.tutorialState.step = 1;
    this.currentProgress = prog;
    saveProgress(lang, prog).catch(() => {});

    const overlay = document.createElement("div");
    overlay.className = "welcome-overlay";
    overlay.innerHTML = `
      <div class="welcome-modal">
        <div class="welcome-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="${accent}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            <circle cx="12" cy="16" r="1" fill="${accent}" stroke="none"/>
          </svg>
        </div>
        <h2 class="welcome-title">Welcome to Vaultria</h2>
        <p class="welcome-body">
          Your vault awaits. Start with your first lesson —
          more of the workspace will reveal itself as you progress.
        </p>
        <button class="btn btn-primary welcome-start-btn">Begin First Lesson →</button>
        <button class="btn btn-ghost welcome-dismiss-btn" style="margin-top:var(--sp-sm)">Explore first</button>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector(".welcome-start-btn")?.addEventListener("click", () => {
      overlay.classList.add("welcome-overlay--out");
      overlay.addEventListener("animationend", () => overlay.remove(), { once: true });
      this._startNextLesson?.();
    });
    overlay.querySelector(".welcome-dismiss-btn")?.addEventListener("click", () => {
      overlay.classList.add("welcome-overlay--out");
      overlay.addEventListener("animationend", () => overlay.remove(), { once: true });
    });
    // Also close on backdrop click
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.classList.add("welcome-overlay--out");
        overlay.addEventListener("animationend", () => overlay.remove(), { once: true });
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
      case "edit-profile": this._pageEditProfile(canvas); break;
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
    const completed = new Set(prog?.completed || []);
    const unlockedStage = Math.min(prog?.stageUnlocked || 0, Math.max((langData.stages || []).length - 1, 0));

    for (let si = 0; si <= unlockedStage; si++) {
      const stage = langData.stages?.[si];
      if (!stage) continue;
      for (const unit of (stage.units || [])) {
        if (unit.path === "branch") continue; // branch units are optional; skip in auto-progression
        for (const sess of (unit.sessions || [])) {
          if (!completed.has(sess.id)) return sess;
        }
      }
    }
    return null;
  }

  _computeStageUnlock(langData, prog) {
    const stages = langData?.stages || [];
    if (!stages.length) return 0;

    const checkpointsPassed = new Set(prog?.checkpointsPassed || []);
    const completed         = new Set(prog?.completed || []);

    let unlocked = 0;
    for (let i = 0; i < stages.length - 1; i++) {
      const stage = stages[i];
      // Branch units are optional — they must not contribute to stage-unlock gating
      const units = (stage.units || []).filter(u => u.path !== "branch");

      // Find the key of the last checkpoint session in this stage (last unit wins)
      let finalCheckpointKey = null;
      for (let ui = 0; ui < units.length; ui++) {
        for (const sess of (units[ui].sessions || [])) {
          if (sess.type === "checkpoint") {
            finalCheckpointKey = `${stage.id}_${ui + 1}`;
          }
        }
      }

      if (finalCheckpointKey) {
        // Checkpoint-gated: stage N+1 requires the final checkpoint of stage N to be passed
        if (checkpointsPassed.has(finalCheckpointKey)) {
          unlocked = i + 1;
        } else {
          break;
        }
      } else {
        // Legacy fallback: stage has no checkpoint sessions — require all sessions complete
        const sessions = units.flatMap(u => u.sessions || []);
        if (sessions.length && sessions.every(s => completed.has(s.id))) {
          unlocked = i + 1;
        } else {
          break;
        }
      }
    }
    return Math.min(unlocked, stages.length - 1);
  }

  // ── Tutorial progressive unlock ────────────────────────────────────
  // Returns the ordered list of nav tab IDs the learner has earned access to
  // based on sessions completed.  Existing users auto-unlock everything up to
  // their completion level; brand-new users start with only "lessons".
  // Vault is always included here (tutorial-unlocked) since its access is
  // independently controlled by requiresStage: 6 in LeftPanel.
  _computeTutorialUnlocks(prog) {
    const count = (prog?.completed || []).length;
    const tabs  = ["lessons"];
    if (count >= 1)  tabs.push("review");
    if (count >= 3)  tabs.push("phrases");
    if (count >= 5)  tabs.push("challenges");
    if (count >= 10) tabs.push("arena");
    // Vault is separately gated by requiresStage (Archivist level) in LeftPanel,
    // so always include it here — the stage gate alone handles when it unlocks.
    // Without this, the tutorial gate would permanently block vault even at stage 6.
    tabs.push("vault");
    return tabs;
  }

  // ── Branch unit unlock computation ────────────────────────────────
  // A branch unit unlocks when the unit whose id matches `unit.unlocksAfter`
  // has all its sessions completed.  Units with no `unlocksAfter` field are
  // always unlocked (available from the start of the stage).
  // Returns the full array of unlocked branch unit IDs (superset of existing
  // branchUnlocked — once unlocked, always unlocked).
  _computeBranchUnlocks(langData, prog) {
    const completed = new Set(prog?.completed || []);
    const unlocked  = new Set(prog?.branchUnlocked || []);

    // Build a flat lookup of unit id → sessions for the whole curriculum
    const unitSessionsById = new Map();
    for (const stage of (langData?.stages || [])) {
      for (const unit of (stage.units || [])) {
        if (unit.id) unitSessionsById.set(unit.id, unit.sessions || []);
      }
    }

    for (const stage of (langData?.stages || [])) {
      for (const unit of (stage.units || [])) {
        if (unit.path !== "branch") continue;
        if (unlocked.has(unit.id)) continue; // already unlocked; keep it

        if (!unit.unlocksAfter) {
          // No prerequisite declared → available from the start
          unlocked.add(unit.id);
          continue;
        }

        // Check that every session in the prerequisite unit is complete
        const parentSessions = unitSessionsById.get(unit.unlocksAfter) || [];
        if (parentSessions.length && parentSessions.every(s => completed.has(s.id))) {
          unlocked.add(unit.id);
        }
      }
    }

    return [...unlocked];
  }

  _summarizeCurriculum(langData, prog) {
    const stages = langData?.stages || [];
    const completed = new Set(prog?.completed || []);
    const unlockedStage = Math.min(prog?.stageUnlocked || 0, Math.max(stages.length - 1, 0));

    let totalSessions = 0;
    let completedSessions = 0;
    let totalUnits = 0;
    let completedUnits = 0;

    stages.forEach(stage => {
      (stage.units || []).forEach(unit => {
        if (unit.path === "branch") return; // branch units are optional — excluded from primary totals
        totalUnits += 1;
        const sessions = unit.sessions || [];
        totalSessions += sessions.length;
        const done = sessions.filter(s => completed.has(s.id)).length;
        completedSessions += done;
        if (sessions.length && done === sessions.length) completedUnits += 1;
      });
    });

    const currentStage = stages[unlockedStage] || null;
    // Exclude branch units from current-stage progress bars so they don't inflate the totals
    const currentUnits = (currentStage?.units || []).filter(u => u.path !== "branch");
    const currentStageSessions = currentUnits.flatMap(u => u.sessions || []);
    const currentStageUnitsDone = currentUnits.filter(u => {
      const sessions = u.sessions || [];
      return sessions.length && sessions.every(s => completed.has(s.id));
    }).length;

    return {
      totalSessions,
      completedSessions,
      totalUnits,
      completedUnits,
      unlockedStage,
      currentStage,
      currentStageLabel: currentStage?.label || "Starter",
      currentStageUnitsTotal: currentUnits.length,
      currentStageUnitsDone,
      currentStageSessionsTotal: currentStageSessions.length,
      currentStageSessionsDone: currentStageSessions.filter(s => completed.has(s.id)).length,
    };
  }

  _getNextSessionForStage(stage, prog) {
    const completed = new Set(prog?.completed || []);
    for (const unit of (stage?.units || [])) {
      if (unit.path === "branch") continue; // branch units are optional; skip in stage resume
      for (const sess of (unit.sessions || [])) {
        if (!completed.has(sess.id)) return sess;
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

  async _onSessionDone({ stars, weakWords, xpEarned, accuracy, speedMs, hintsUsed }, session) {
    const prog = this.currentProgress;

    // ── Checkpoint fail guard ───────────────────────────────────────────
    // If the session is a checkpoint and the learner did not reach the pass
    // threshold, bail out without mutating progress and show the retry screen.
    if (session.type === "checkpoint") {
      const passThreshold = session.passThreshold || 0.80;
      if (accuracy < passThreshold) {
        this._showCheckpointRetry(session, accuracy, passThreshold);
        return;
      }
    }

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
    const langData = await this._fetchLangData(this.currentLang);
    if (langData) {
      prog.stageUnlocked  = this._computeStageUnlock(langData, prog);
      prog.branchUnlocked = this._computeBranchUnlocks(langData, prog);
    }

    // Stage/unit star bookkeeping (powers seals + prestige)
    prog.unitStars = prog.unitStars || {};
    const idx = this._sessionIndex?.[this.currentLang]?.get(session.id);
    if (idx && typeof idx.stageId === "number" && idx.unitIndex) {
      const stageKey = idx.stageKey || STAGES[idx.stageId]?.key;
      const k = `${idx.stageId}_${idx.unitIndex}`;
      prog.unitStars[k] = Math.max(prog.unitStars[k] || 0, stars || 0);
      eventBus.emit("progress:stageProgress", {
        langKey: this.currentLang,
        stageKey,
        stageId: idx.stageId,
        unitIndex: idx.unitIndex,
        unitId: idx.unitId,
        unitStars: prog.unitStars,
      });
      // Record a passed checkpoint so _computeStageUnlock can gate stage advancement
      if (session.type === "checkpoint") {
        prog.checkpointsPassed = [...new Set([
          ...(prog.checkpointsPassed || []),
          `${idx.stageId}_${idx.unitIndex}`,
        ])];
      }
    }

    // ── Phrase library ────────────────────────────────────────────────
    // Add vocabulary-type items from this session to the learner's personal
    // phrase library.  Criteria: item must have both target and meaning, and
    // must not already be stored (dedup by target string).  Skip session
    // types that don't produce vocabulary (script_recognition = kana drills;
    // checkpoint = mixed review; sentence_build / grammar_drill items don't
    // carry a standalone meaning on the item itself).
    if (session.type !== "script_recognition" &&
        session.type !== "checkpoint" &&
        session.type !== "sentence_build" &&
        session.type !== "grammar_drill") {
      const existingTargets = new Set((prog.phraseLibrary || []).map(e => e.target));
      const newPhrases = (session.items || [])
        .filter(item => item.target && item.meaning && !existingTargets.has(item.target))
        .map(item => ({
          target:    item.target,
          romanji:   item.romanji  || null,
          meaning:   item.meaning,
          learnedAt: Date.now(),
          langKey:   this.currentLang,
        }));
      if (newPhrases.length) {
        prog.phraseLibrary = [...(prog.phraseLibrary || []), ...newPhrases];
      }
    }

    // ── Tutorial unlock ────────────────────────────────────────────────
    // Recompute which tabs are accessible and store in tutorialState so that
    // LeftPanel can refresh lock state when it receives the progress:update
    // event.  step 0 = never seen welcome modal; step >= 1 = modal seen.
    prog.tutorialState = prog.tutorialState || { step: 0, unlockedTabs: ["lessons"] };
    prog.tutorialState.unlockedTabs = this._computeTutorialUnlocks(prog);
    if (prog.tutorialState.step < 1) prog.tutorialState.step = 1;

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

    // System triggers (momentum + chronicle + familiar reactions)
    eventBus.emit("progress:xpGained", {
      langKey: this.currentLang,
      oldXp,
      newXp: prog.xp,
      delta: xpEarned,
    });
    eventBus.emit("progress:sessionComplete", {
      langKey: this.currentLang,
      sessionId: session.id,
      stars,
      xpEarned,
      accuracy,
      speedMs,
      hintsUsed,
    });
    if (typeof speedMs === "number" && speedMs <= 90_000) {
      eventBus.emit("progress:sessionFast", { langKey: this.currentLang, speedMs });
    }
    if (typeof accuracy === "number" && accuracy >= 0.93) {
      eventBus.emit("progress:sessionAccurate", { langKey: this.currentLang, accuracy });
    }

    // Prestige popup on level-up
    if (levelUp) {
      const icon = `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h7l-1 8 11-14h-7z"/></svg>`;
      setTimeout(() => showPrestigePopup(`Level ${newLevel} Reached`, `Keep climbing the vault`, icon), 3200);
    }

    setTimeout(() => this._showWorkspace(), 350);
  }

  _showCheckpointRetry(session, accuracy, passThreshold) {
    const canvas = document.getElementById("center-canvas");
    if (!canvas) return;
    const pct    = Math.round((accuracy || 0) * 100);
    const needed = Math.round((passThreshold || 0.80) * 100);
    const icon   = _uiIconSvg("ban", 40, "rgba(255,255,255,0.55)");
    canvas.innerHTML = `
<div class="canvas-content page-enter" style="max-width:520px;display:flex;flex-direction:column;align-items:center;gap:28px;padding-top:72px;text-align:center;">
  <div style="display:flex;justify-content:center;opacity:0.7;">${icon}</div>
  <div>
    <h2 style="margin:0 0 10px;font-size:1.3rem;font-weight:600;color:var(--text-primary);">Checkpoint Not Passed</h2>
    <p style="color:var(--text-muted);margin:0;line-height:1.6;">
      You scored <strong style="color:var(--text-primary);">${pct}%</strong> —
      a score of <strong style="color:var(--text-primary);">${needed}%</strong> or higher is needed to advance.
    </p>
  </div>
  <div style="display:flex;gap:12px;">
    <button class="btn btn-primary" id="checkpoint-retry-btn">Try Again</button>
    <button class="btn btn-ghost" id="checkpoint-back-btn">Back to Lessons</button>
  </div>
</div>`;
    document.getElementById("checkpoint-retry-btn")
      ?.addEventListener("click", () => this._runSession(session));
    document.getElementById("checkpoint-back-btn")
      ?.addEventListener("click", () => this._showWorkspace());
  }

  // ══════════════════════════════════════════════════════════════════
  // PAGES
  // ══════════════════════════════════════════════════════════════════

  // ── Lessons ────────────────────────────────────────────────────────
  _pageLessons(canvas) {
    const accent = ACCENT[this.currentLang] || "#8b7cff";
    const prog = this.currentProgress || {};
    const completed = new Set(prog.completed || []);
    const langData = this._langDataCache?.[this.currentLang];
    const stages = langData?.stages || [];

    if (!stages.length) {
      canvas.innerHTML = `
<div class="canvas-content page-enter" style="max-width:680px;">
  <div class="section-header">
    <h2 class="section-title">Lessons</h2>
    <p class="section-subtitle">Your full curriculum for ${LABEL[this.currentLang]||this.currentLang}</p>
  </div>
  <div class="card" style="padding:40px;text-align:center;">
    <div style="margin-bottom:16px;display:flex;justify-content:center;opacity:0.75;">${_uiIconSvg("books", 34, "rgba(255,255,255,0.55)")}</div>
    <div style="color:var(--text-muted);">Select a language from the hub to see lessons.</div>
  </div>
</div>`;
      return;
    }

    const summary = this._summarizeCurriculum(langData, prog);
    const unlockedStage = summary.unlockedStage;
    const sessionIndex = new Map();

    const stageHTML = stages.map((stage, si) => {
      const units = stage.units || [];
      const stageSessions = units.flatMap(u => u.sessions || []);
      const stageDone = stageSessions.filter(s => completed.has(s.id)).length;
      const stageTotal = stageSessions.length;
      const mastered = stageTotal > 0 && stageDone === stageTotal;
      const locked = si > unlockedStage;
      const current = si === unlockedStage;
      const nextInStage = locked ? null : this._getNextSessionForStage(stage, prog);
      const unitDone = units.filter(u => {
        const sessions = u.sessions || [];
        return sessions.length && sessions.every(s => completed.has(s.id));
      }).length;
      const registerPills = (stage.registerAvailable || []).map(r => `<span style="padding:3px 8px;border-radius:999px;border:1px solid ${accent}22;background:${accent}10;color:${accent};font-size:0.62rem;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:0.08em;">${r}</span>`).join("");

      return `
        <div class="card-elevated" style="margin-bottom:18px;overflow:hidden;opacity:${locked?0.58:1};border-color:${current?accent+'40':'var(--border-subtle)'};box-shadow:${current?`0 0 0 1px ${accent}18 inset`:''};">
          <div style="padding:18px 20px;border-bottom:1px solid var(--border-subtle);display:flex;align-items:flex-start;gap:14px;">
            <div style="width:38px;height:38px;border-radius:50%;background:${accent}20;border:1px solid ${accent}35;display:flex;align-items:center;justify-content:center;font-weight:600;color:${accent};font-size:0.85rem;flex-shrink:0;">${si+1}</div>
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px;">
                <div style="font-size:1rem;font-weight:500;color:var(--text-primary);">${stage.label || stage.name || `Stage ${si+1}`}</div>
                ${stage.labelNative ? `<div style="font-size:0.82rem;color:var(--text-muted);font-family:var(--font-mono);">${stage.labelNative}</div>` : ''}
                <span style="padding:3px 10px;border-radius:999px;border:1px solid ${current?accent+'35':'var(--border-subtle)'};background:${current?accent+'12':'var(--bg-panel)'};color:${current?accent:'var(--text-secondary)'};font-size:0.66rem;font-family:var(--font-mono);letter-spacing:0.08em;text-transform:uppercase;">${locked?'Locked':mastered?'Mastered':current?'Current':'Open'}</span>
              </div>
              <div style="font-size:0.8rem;color:var(--text-secondary);line-height:1.65;max-width:760px;">${stage.description || ''}</div>
              ${registerPills ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;">${registerPills}</div>` : ''}
            </div>
            <div style="text-align:right;min-width:132px;align-self:center;">
              <div style="font-size:0.88rem;font-family:var(--font-mono);color:${accent};">${stageDone}/${stageTotal}</div>
              <div style="font-size:0.68rem;color:var(--text-muted);font-family:var(--font-mono);">sessions</div>
              <div style="font-size:0.72rem;color:var(--text-secondary);margin-top:8px;">${unitDone}/${units.length} units</div>
            </div>
          </div>

          ${!locked && nextInStage ? `
            <div style="padding:12px 20px;border-bottom:1px solid var(--border-subtle);display:flex;align-items:center;justify-content:space-between;gap:12px;background:${accent}08;">
              <div>
                <div style="font-size:0.68rem;color:${accent};font-family:var(--font-mono);letter-spacing:0.12em;text-transform:uppercase;">Next climb</div>
                <div style="font-size:0.86rem;color:var(--text-primary);margin-top:4px;">${nextInStage.title || nextInStage.id}</div>
              </div>
              <button class="btn btn-primary lesson-launch" data-session-id="${nextInStage.id}" style="white-space:nowrap;">Resume Stage →</button>
            </div>` : ''}

          ${units.map((unit, ui) => {
            const isBranch      = unit.path === "branch";
            const sessions      = unit.sessions || [];
            const unitDoneCount = sessions.filter(s => completed.has(s.id)).length;
            const unitDone      = sessions.length && unitDoneCount === sessions.length;
            const notLast       = ui < units.length - 1;

            // ── Branch / optional unit ───────────────────────────────
            if (isBranch) {
              const branchIsUnlocked = !locked && (prog.branchUnlocked || []).includes(unit.id);
              const branchLabel = ({
                listening_reinforcement: "Listening Lab",
                script_mastery:          "Script Mastery",
                grammar_focus:           "Grammar Focus",
                cultural:                "Culture",
                vocabulary_boost:        "Vocab Boost",
                conversation_practice:   "Conversation",
              })[unit.branchType] || "Optional";
              return `
                <div class="branch-unit-row" style="padding:12px 20px 12px 28px;${notLast?"border-bottom:1px dashed rgba(255,255,255,0.06)":""}${branchIsUnlocked?"":" opacity:0.52;"}">
                  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:${branchIsUnlocked?8:0}px;">
                    <span style="color:var(--text-muted);font-size:0.78rem;line-height:1;">⤷</span>
                    <div style="font-size:0.78rem;font-weight:500;color:var(--text-secondary);">${unit.title || unit.name || 'Branch Unit'}</div>
                    <span class="branch-badge">${branchLabel}</span>
                    ${unitDone ? '<span style="font-size:0.68rem;color:#4ade80;font-family:var(--font-mono);">✓ Cleared</span>' : ''}
                  </div>
                  ${!branchIsUnlocked
                    ? `<div style="font-size:0.7rem;color:var(--text-muted);font-family:var(--font-mono);padding-left:16px;">${locked ? 'Stage locked' : 'Unlocks after completing the required unit'}</div>`
                    : `<div style="display:flex;flex-wrap:wrap;gap:8px;">${sessions.map(sess => {
                        sessionIndex.set(sess.id, sess);
                        const isDone = completed.has(sess.id);
                        return `<button class="lesson-chip branch-chip lesson-launch" data-session-id="${sess.id}" style="padding:6px 10px;border-radius:8px;font-size:0.7rem;font-family:var(--font-mono);border:1px dashed ${isDone?accent+'35':'rgba(255,255,255,0.14)'};background:${isDone?accent+'0d':'transparent'};color:${isDone?accent:'var(--text-secondary)'};cursor:pointer;">${isDone?'✓ ':''}${sess.title || sess.id}</button>`;
                      }).join('')}</div>`
                  }
                </div>`;
            }

            // ── Primary unit ─────────────────────────────────────────
            const isCheckpoint = !!unit.isCheckpoint;
            return `
              <div style="padding:14px 20px;${notLast?"border-bottom:1px solid var(--border-subtle)":""}">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px;">
                  <div>
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                      <div style="font-size:0.82rem;font-weight:600;color:var(--text-secondary);">${unit.title || unit.name || `Unit ${ui+1}`}</div>
                      ${isCheckpoint ? `<span style="padding:2px 8px;border-radius:999px;background:rgba(251,191,36,0.12);border:1px solid rgba(251,191,36,0.22);color:#fbbf24;font-size:0.62rem;font-family:var(--font-mono);letter-spacing:0.08em;text-transform:uppercase;">${ui===6 || ui===13 ? 'Assessment' : 'Checkpoint'}</span>` : ''}
                    </div>
                    <div style="font-size:0.68rem;color:var(--text-muted);font-family:var(--font-mono);margin-top:4px;">${unitDoneCount}/${sessions.length} sessions complete</div>
                  </div>
                  ${unitDone ? `<span style="font-size:0.68rem;color:#4ade80;font-family:var(--font-mono);">✓ Cleared</span>` : ''}
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:8px;">
                  ${sessions.map(sess => {
                    sessionIndex.set(sess.id, sess);
                    const isDone = completed.has(sess.id);
                    const isNext = nextInStage && nextInStage.id === sess.id;
                    return `<button class="lesson-chip lesson-launch" data-session-id="${sess.id}" ${locked?'disabled':''} style="padding:7px 11px;border-radius:9px;font-size:0.72rem;font-family:var(--font-mono);border:1px solid ${isNext?accent+'50':isDone?accent+'35':'var(--border-subtle)'};background:${isNext?accent+'18':isDone?accent+'0f':'transparent'};color:${isDone||isNext?accent:'var(--text-secondary)'};cursor:${locked?'not-allowed':'pointer'};opacity:${locked?0.5:1};">
                      ${isDone?'✓ ':isNext?'→ ':''}${sess.title || sess.id}
                    </button>`;
                  }).join('')}
                </div>
              </div>`;
          }).join('')}
        </div>`;
    }).join('');

    canvas.innerHTML = `
<div class="canvas-content page-enter" style="max-width:920px;">
  <div class="section-header">
    <div>
      <h2 class="section-title">Curriculum Atlas</h2>
      <p class="section-subtitle">${LABEL[this.currentLang]||this.currentLang} · ${summary.completedSessions}/${summary.totalSessions} sessions · ${summary.completedUnits}/${summary.totalUnits} units cleared</p>
    </div>
    <button class="btn btn-primary" id="atlas-resume">Continue Ascent →</button>
  </div>

  <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:18px;">
    <div class="card" style="padding:14px 16px;">
      <div style="font-size:0.68rem;color:var(--text-muted);font-family:var(--font-mono);text-transform:uppercase;letter-spacing:0.1em;">Stages Open</div>
      <div style="margin-top:6px;font-size:1.2rem;color:${accent};font-weight:600;">${summary.unlockedStage + 1}/${stages.length}</div>
    </div>
    <div class="card" style="padding:14px 16px;">
      <div style="font-size:0.68rem;color:var(--text-muted);font-family:var(--font-mono);text-transform:uppercase;letter-spacing:0.1em;">Current Stage</div>
      <div style="margin-top:6px;font-size:1.05rem;color:var(--text-primary);font-weight:500;">${summary.currentStage?.label || 'Starter'}</div>
    </div>
    <div class="card" style="padding:14px 16px;">
      <div style="font-size:0.68rem;color:var(--text-muted);font-family:var(--font-mono);text-transform:uppercase;letter-spacing:0.1em;">Current Units</div>
      <div style="margin-top:6px;font-size:1.2rem;color:${accent};font-weight:600;">${summary.currentStageUnitsDone}/${summary.currentStageUnitsTotal}</div>
    </div>
    <div class="card" style="padding:14px 16px;">
      <div style="font-size:0.68rem;color:var(--text-muted);font-family:var(--font-mono);text-transform:uppercase;letter-spacing:0.1em;">Current Sessions</div>
      <div style="margin-top:6px;font-size:1.2rem;color:${accent};font-weight:600;">${summary.currentStageSessionsDone}/${summary.currentStageSessionsTotal}</div>
    </div>
  </div>

  ${stageHTML}
</div>`;

    canvas.querySelector('#atlas-resume')?.addEventListener('click', () => this._startNextLesson());
    canvas.querySelectorAll('.lesson-launch').forEach(btn => {
      btn.addEventListener('click', () => {
        const sess = sessionIndex.get(btn.dataset.sessionId);
        if (sess) this._runSession(sess);
      });
    });
  }


  // ── Review ────────────────────────────────────────────────────────
  _pageReview(canvas) {
    const accent = ACCENT[this.currentLang];
    const prog   = this.currentProgress || {};
    const items  = this._buildReviewItems(prog);
    const preview = items.slice(0, 6);

    canvas.innerHTML = `
<div class="canvas-content page-enter">
  <div class="section-header">
    <div>
      <h2 class="section-title">Review</h2>
      <p class="section-subtitle">${items.length} item${items.length !== 1 ? "s" : ""} from your phrase library, prioritized by age and accuracy</p>
    </div>
    ${items.length > 0 ? `<button id="start-review" class="btn btn-primary">Start Review →</button>` : ""}
  </div>

  ${items.length === 0 ? `
    <div class="empty-state card" style="min-height:300px;">
      <div class="empty-state-icon">✓</div>
      <h3 style="font-family:var(--font-display);font-size:1.5rem;font-weight:300;color:var(--text-primary);">Nothing to Review</h3>
      <p class="empty-state-text">Complete a few lessons to build your review library.</p>
      <button class="btn btn-primary" id="review-continue-lesson">Go to Lessons →</button>
    </div>` : `
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:28px;">
      ${preview.map(item => `
        <div class="card review-item" style="display:flex;align-items:center;gap:14px;padding:14px 18px;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:1rem;color:var(--text-primary);letter-spacing:0.03em;">${item.target}</div>
            ${item.romanji ? `<div style="font-size:0.72rem;color:var(--text-muted);font-family:var(--font-mono);margin-top:2px;">${item.romanji}</div>` : ""}
          </div>
          <div style="font-size:0.72rem;font-family:var(--font-mono);color:${accent};opacity:0.7;white-space:nowrap;">due</div>
        </div>
      `).join("")}
      ${items.length > 6 ? `<div style="font-size:0.75rem;color:var(--text-muted);font-family:var(--font-mono);padding:6px 4px;">+${items.length - 6} more items</div>` : ""}
    </div>
    <div class="card" style="background:${accent}08;border-color:${accent}20;padding:18px 22px;">
      <div style="font-size:0.72rem;color:${accent};font-family:var(--font-mono);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px;">How Review Works</div>
      <p style="font-size:0.82rem;color:var(--text-secondary);line-height:1.65;margin:0;">You'll see each word in its native script. Type the meaning from memory. Older and weaker items appear first. Each session awards XP and strengthens your retention.</p>
    </div>
  `}
</div>`;

    canvas.querySelector("#start-review")?.addEventListener("click", () => {
      this._startReviewSession();
    });
    canvas.querySelector("#review-continue-lesson")?.addEventListener("click", () => {
      this._onLeftNav("lessons");
    });
  }

  _buildReviewItems(prog) {
    const phrases   = prog?.phraseLibrary || [];
    const weakWords = prog?.weakWords     || [];

    if (!phrases.length) return [];

    // Build a quick lookup: target → memoryWeight from weakWords
    const weakMap = new Map();
    weakWords.forEach(w => {
      if (w.word) weakMap.set(w.word, w.memoryWeight || 0);
    });

    const now = Date.now();
    const scored = phrases.map((phrase, i) => {
      const ageDays   = ((now - (phrase.learnedAt || 0)) / 86_400_000);
      const weakBoost = (weakMap.get(phrase.target) || 0) * 10;
      const score     = ageDays + weakBoost;
      return { phrase, score, i };
    });

    // Sort highest priority first (oldest + weakest)
    scored.sort((a, b) => b.score - a.score);

    // Return up to 20 items shaped for SessionEngine
    return scored.slice(0, 20).map(({ phrase, i }) => ({
      id:      `rev_${i}_${phrase.target}`,
      target:  phrase.target,
      romanji: phrase.romanji || null,
      // item.answer triggers the text-input in SessionEngine;
      // we deliberately do NOT set item.meaning here so it's not shown on the card.
      answer:  phrase.meaning,
      audio:   true,
    }));
  }

  _startReviewSession() {
    const canvas = document.getElementById("center-canvas");
    if (!canvas) return;

    const prog  = this.currentProgress || {};
    const items = this._buildReviewItems(prog);
    if (!items.length) {
      showToast("Nothing to review yet — complete a lesson first.", "info", 3000);
      return;
    }

    const session = {
      id:        `review_${Date.now()}`,
      title:     "Review Session",
      type:      "vocabulary",
      items,
      _isReview: true,
    };

    canvas.innerHTML = "";
    new SessionEngine({
      container: canvas,
      session,
      langKey:   this.currentLang,
      progress:  prog,
      register:  prog.register  || "natural",
      immersion: prog.immersionMode || "partial",
      onComplete: r => this._onReviewDone(r, session),
    });
  }

  async _onReviewDone({ stars, weakWords, xpEarned, accuracy }, session) {
    const prog = this.currentProgress;

    // Rolling accuracy average (same weighting as _onSessionDone)
    const prevAcc = prog.accuracy != null ? prog.accuracy : null;
    prog.accuracy = prevAcc != null
      ? Math.round((prevAcc * 0.7 + accuracy * 0.3) * 100) / 100
      : Math.round(accuracy * 100) / 100;

    // Merge weak words but DON'T add to completed[]
    if (weakWords?.length) prog.weakWords = weakWords;

    // Rebuild review queue based on updated weak words
    prog.reviewQueue = buildReviewQueue(prog);

    // Award 70% XP (review is lighter than a full lesson)
    const oldXp   = prog.xp || 0;
    const oldLevel = xpToLevel(oldXp);
    const reviewXp = Math.round((xpEarned || 0) * 0.7);
    prog.xp = oldXp + reviewXp;

    await saveProgress(this.currentLang, prog);
    this.allProgress[this.currentLang] = prog;
    this.currentProgress = prog;
    syncProgressToProfile(this.currentLang, prog);
    eventBus.emit("progress:update", prog);
    if (this.rightPanel) this.rightPanel.updateProgress(prog);

    const newLevel = xpToLevel(prog.xp);
    const levelUp  = newLevel > oldLevel ? { oldLevel, newLevel } : null;
    showXpPopup(reviewXp, stars, levelUp);

    eventBus.emit("progress:xpGained", {
      langKey: this.currentLang,
      oldXp,
      newXp: prog.xp,
      delta: reviewXp,
    });

    // Return to review page so the learner sees updated item count
    setTimeout(() => this._onLeftNav("review"), 350);
  }

  // ── Vault ─────────────────────────────────────────────────────────
  _pageVault(canvas) {
    const accent   = ACCENT[this.currentLang];
    const stage    = this.currentProgress?.stageUnlocked || 0;
    const isOpen   = stage >= 6;
    const vaultContent = [
      { title:"Ancient Texts",      desc:"Classical literature and historical documents with line-by-line annotation.",           icon:_uiIconSvg("scroll", 26, "rgba(255,255,255,0.86)") },
      { title:"Idioms & Proverbs",  desc:"Native expressions that don't translate directly — with origin stories.",               icon:_uiIconSvg("leaf", 26, "rgba(255,255,255,0.86)") },
      { title:"Formal Writing",     desc:"Business letters, academic writing, and professional correspondence templates.",        icon:_uiIconSvg("pen", 26, "rgba(255,255,255,0.86)") },
      { title:"Cultural Deep-Dives",desc:"Regional dialects, subcultures, and how language reflects society.",                   icon:_uiIconSvg("museum", 26, "rgba(255,255,255,0.86)") },
      { title:"Master Grammar",     desc:"Advanced grammatical patterns used by fluent native speakers.",                         icon:_uiIconSvg("flask", 26, "rgba(255,255,255,0.86)") },
      { title:"Poetry & Literature",desc:"Song lyrics, poetry, and prose — language in its most expressive form.",               icon:_uiIconSvg("mask", 26, "rgba(255,255,255,0.86)") },
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
    <div class="vault-lock-icon" style="display:flex;align-items:center;justify-content:center;">${_uiIconSvg("lock", 46, "rgba(255,255,255,0.78)")}</div>
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
        <div style="margin-bottom:12px;opacity:0.92;">${v.icon}</div>
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
          <div style="margin-bottom:10px;filter:grayscale(1);opacity:0.85;">${v.icon}</div>
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
    const prog   = this.currentProgress || {};

    // ── User-learned phrases (populated by _onSessionDone) ───────────
    // Filter to current language; map stored shape → display shape.
    const userPhrases = (prog.phraseLibrary || [])
      .filter(p => !p.langKey || p.langKey === this.currentLang)
      .map((p, i) => ({
        id:          `learned-${i}`,
        phrase:      p.target,
        romanji:     p.romanji  || null,
        translation: p.meaning,
        contextTags: ["Learned"],
        register:    "learned",
        learnedAt:   p.learnedAt,
      }));

    // ── Static curated phrases from the language data JSON ───────────
    const dbPhrases = data?.phraseLibrary || [];

    // Drop user-learned entries that duplicate a static curated phrase
    // (same display text) — avoids showing the same word/phrase twice.
    const staticPhraseTexts = new Set(dbPhrases.map(p => p.phrase));
    const dedupedUserPhrases = userPhrases.filter(p => !staticPhraseTexts.has(p.phrase));

    // ── Hardcoded supplementary phrases (PHRASES constant) ───────────
    const extraPhrases = (PHRASES[this.currentLang] || []).map((p,i) => ({
      id: `extra-${i}`, phrase: p.phrase, romanji: p.romanji,
      translation: p.meaning, contextTags: [p.register, p.context], register: p.register.toLowerCase()
    }));

    // Learned phrases first, then curated static library, then extras.
    const allPhrases  = [...dedupedUserPhrases, ...dbPhrases, ...extraPhrases];
    const learnedCount = dedupedUserPhrases.length;
    const tags = ["All", "Learned", "Polite","Casual","Travel","Business","Social","Learning"];

    canvas.innerHTML = `
<div class="canvas-content page-enter">
  <div class="section-header">
    <div>
      <h2 class="section-title">Phrase Library</h2>
      <p class="section-subtitle">${allPhrases.length} expression${allPhrases.length !== 1 ? "s" : ""}${learnedCount ? ` &middot; <span style="color:var(--accent-primary);font-weight:500;">${learnedCount} learned</span>` : " with grammar notes and audio"}</p>
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
    const accent = ACCENT[this.currentLang];
    const prog   = this.currentProgress || {};
    const xp     = prog.xp || 0;
    const level  = xpToLevel(xp);

    const profile = this.profile || {};
    const pending = profile.pendingMilestone || null;
    const rewards = profile.rewards || {};
    const unlocked = Object.keys(rewards).filter((k) => rewards[k]);

    const nextMilestone = pending ? pending : (Math.floor(level / 5) + 1) * 5;
    const lvStart = Math.floor(level / 5) * 5;
    const pct = Math.round((Math.max(0, Math.min(level - lvStart, 5)) / 5) * 100);

    const icon = (type) => {
      const stroke = "rgba(255,255,255,0.72)";
      const common = `fill="none" stroke="${stroke}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"`;
      if (type === "soundscape") return `<svg width="18" height="18" viewBox="0 0 24 24" ${common}><path d="M3 12h2l2-6 4 12 3-8 2 2h3"/></svg>`;
      if (type === "frame")     return `<svg width="18" height="18" viewBox="0 0 24 24" ${common}><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 15l2-2 2 2 4-4"/></svg>`;
      if (type === "desk")      return `<svg width="18" height="18" viewBox="0 0 24 24" ${common}><path d="M4 10h16"/><path d="M6 10v10"/><path d="M18 10v10"/><path d="M9 14h6"/></svg>`;
      if (type === "parallax")  return `<svg width="18" height="18" viewBox="0 0 24 24" ${common}><path d="M4 17l4-4 3 3 5-6 4 7"/><path d="M4 7h16"/></svg>`;
      if (type === "cursor")    return `<svg width="18" height="18" viewBox="0 0 24 24" ${common}><path d="M4 4l7 17 2-6 6-2z"/></svg>`;
      return `<svg width="18" height="18" viewBox="0 0 24 24" ${common}><path d="M12 3v18"/><path d="M3 12h18"/></svg>`;
    };

    const classify = (id) => {
      if (id.startsWith("soundscapes_")) return { type: "soundscape", label: id.replace("soundscapes_", "Soundscape: ").replaceAll("_", " ") };
      if (id.startsWith("frame_"))       return { type: "frame",      label: id.replace("frame_", "Frame: ").replaceAll("_", " ") };
      if (id.startsWith("desk_"))        return { type: "desk",       label: id.replace("desk_", "Desk: ").replaceAll("_", " ") };
      if (id.startsWith("parallax_"))    return { type: "parallax",   label: id.replace("parallax_", "Parallax: ").replaceAll("_", " ") };
      if (id.startsWith("cursor_"))      return { type: "cursor",     label: id.replace("cursor_", "Cursor: ").replaceAll("_", " ") };
      return { type: "item", label: id.replaceAll("_", " ") };
    };

    canvas.innerHTML = `
<div class="canvas-content page-enter">
  <div class="section-header">
    <div>
      <h2 class="section-title">Chronicle</h2>
      <p class="section-subtitle">Workspace upgrades appear every 5 levels. No penalties, no randomness.</p>
    </div>
    <div style="display:flex;gap:10px;align-items:center;">
      <button class="btn btn-ghost" id="chronicle-open-profile" style="border-color:${accent}30;color:${accent};">Open Profile Desk</button>
      ${pending ? `<button class="btn" id="chronicle-pending" style="background:${accent};border-color:${accent};color:#0b0b0c;">Choose Level ${pending} Reward</button>` : ""}
    </div>
  </div>

  <div class="card" style="padding:18px 18px 16px;margin-bottom:14px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
      <div style="font-size:0.78rem;color:var(--text-muted);font-family:var(--font-mono);">LEVEL ${level} - NEXT MILESTONE: ${nextMilestone}</div>
      <div style="font-size:0.78rem;color:var(--text-muted);font-family:var(--font-mono);">${pct}%</div>
    </div>
    <div class="progress-bar-container" style="margin-bottom:0;">
      <div class="progress-bar-fill" style="width:${pct}%;background:${accent};"></div>
    </div>
  </div>

  <div class="card" style="padding:18px;margin-bottom:14px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <div style="font-size:0.92rem;font-weight:600;color:var(--text-primary);">Unlocked Workspace Upgrades</div>
      <div style="font-size:0.75rem;color:var(--text-muted);">${unlocked.length} unlocked</div>
    </div>
    ${unlocked.length ? `
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">
        ${unlocked.slice(0, 10).map((id) => {
          const meta = classify(id);
          return `
            <div class="card" style="padding:12px;background:var(--bg-glass);border-color:var(--border-subtle);">
              <div style="display:flex;align-items:flex-start;gap:10px;">
                <div style="width:26px;height:26px;display:flex;align-items:center;justify-content:center;opacity:0.9;">${icon(meta.type)}</div>
                <div>
                  <div style="font-size:0.86rem;font-weight:600;color:var(--text-primary);">${meta.label}</div>
                  <div style="font-size:0.75rem;color:var(--text-muted);text-transform:capitalize;">${meta.type}</div>
                </div>
              </div>
            </div>`;
        }).join("")}
      </div>
    ` : `
      <div style="padding:8px 0;color:var(--text-muted);font-size:0.85rem;">No upgrades unlocked yet. Reach level 10 for your first Chronicle choice.</div>
    `}
  </div>

  <div class="card" style="padding:18px;">
    <div style="font-size:0.92rem;font-weight:600;color:var(--text-primary);margin-bottom:8px;">What This Is</div>
    <div style="font-size:0.85rem;color:var(--text-secondary);line-height:1.6;max-width:70ch;">
      Chronicle milestones are cosmetic and identity-based. They improve your workspace atmosphere without changing learning difficulty or locking you into streaks.
    </div>
  </div>
</div>
`;

    canvas.querySelector("#chronicle-open-profile")?.addEventListener("click", () => this._onRightNav("profile"));
    canvas.querySelector("#chronicle-pending")?.addEventListener("click", () => {
      ChronicleSystem.checkPending();
    });
  }

  async _pageArena(canvas) {
    const me     = getUser();
    const accent = ACCENT[this.currentLang];

    const modes = [
      {
        id:    "speed",
        title: "Speed Translation",
        desc:  "See the meaning — pick the native form as fast as possible. Race solo or find a live opponent.",
        time:  "~3 min · 10 questions",
        type:  "Solo or 1v1",
        icon:  _uiIconSvg("bolt", 30, accent),
        soloLabel: "Solo Run",
        soloAction: "solo",
        altLabel: "Find Match",
        altAction: "1v1",
      },
      {
        id:    "reading",
        title: "Reading Sprint",
        desc:  "See the native script — identify the correct meaning under time pressure. Tests reading comprehension.",
        time:  "~2 min · 8 questions",
        type:  "Solo",
        icon:  _uiIconSvg("books", 30, accent),
        soloLabel: "Start →",
        soloAction: "reading",
      },
      {
        id:    "dictation",
        title: "Dictation Race",
        desc:  "Listen to native audio and type exactly what you hear. Accuracy and speed both count.",
        time:  "~3 min · 8 questions",
        type:  "Solo",
        icon:  _uiIconSvg("mic", 30, accent),
        soloLabel: "Start →",
        soloAction: "dictation",
      },
      {
        id:    "forge",
        title: "Sentence Forge",
        desc:  "Reconstruct a scrambled sentence by placing word tiles in the correct order.",
        time:  "~4 min · 8 questions",
        type:  "Solo",
        icon:  `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="${accent}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 17h7M17 14v7"/></svg>`,
        soloLabel: "Start →",
        soloAction: "forge",
      },
    ];

    canvas.innerHTML = `
<div class="canvas-content page-enter">
  <div class="section-header">
    <div>
      <h2 class="section-title">Arena</h2>
      <p class="section-subtitle">Optional skill training — test speed, listening, and comprehension</p>
    </div>
  </div>

  <div class="arena-mode-grid">
    ${modes.map(m => `
      <div class="arena-mode-card">
        <div class="arena-mode-icon">${m.icon}</div>
        <div class="arena-mode-content">
          <div class="arena-mode-title">${m.title}</div>
          <div class="arena-mode-desc">${m.desc}</div>
          <div class="arena-mode-meta">
            <span class="arena-mode-badge">${m.time}</span>
            <span class="arena-mode-badge" style="color:${accent};border-color:${accent}40;background:${accent}0d;">${m.type}</span>
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:2px;">
          <button class="btn btn-ghost arena-mode-btn" data-action="${m.soloAction}"
            style="font-size:0.81rem;padding:8px 16px;border-color:${accent}40;color:${accent};">${m.soloLabel}</button>
          ${m.altAction ? `<button class="btn btn-ghost arena-mode-btn" data-action="${m.altAction}"
            style="font-size:0.81rem;padding:8px 14px;border-color:var(--border-normal);">${m.altLabel}</button>` : ""}
        </div>
      </div>
    `).join("")}
  </div>

  <div class="card" style="margin-top:8px;">
    <div style="font-size:0.62rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--text-muted);font-family:var(--font-mono);margin-bottom:16px;">Recent Speed Translation Matches</div>
    <div id="arena-matches-list">
      <div style="padding:16px 0;text-align:center;color:var(--text-muted);font-size:0.82rem;font-family:var(--font-mono);">Loading…</div>
    </div>
  </div>
</div>`;

    // Match history
    const matchList = canvas.querySelector("#arena-matches-list");
    if (matchList && me) {
      loadMyArenaMatches(6).then(matches => {
        if (!matchList.isConnected) return;
        if (!matches.length) {
          matchList.innerHTML = `<div style="padding:16px 0;text-align:center;color:var(--text-muted);font-size:0.85rem;">No matches yet — play your first!</div>`;
          return;
        }
        matchList.innerHTML = matches.map((m, i) => {
          const isWin   = m.winnerId === me.uid;
          const oppName = (m.players||[]).filter(p => p !== me.uid)[0] || "Unknown";
          return `<div style="display:grid;grid-template-columns:auto 1fr auto auto auto;gap:14px;align-items:center;padding:10px 0;${i < matches.length - 1 ? "border-bottom:1px solid var(--border-subtle)" : ""}">
            <div style="width:7px;height:7px;border-radius:50%;background:${isWin ? "#4ade80" : "var(--error)"};flex-shrink:0;"></div>
            <div>
              <span style="font-size:0.86rem;color:var(--text-primary);">${m.opponentName || oppName}</span>
              <span style="font-size:0.7rem;color:var(--text-muted);font-family:var(--font-mono);margin-left:10px;">${m.score || ""}</span>
            </div>
            <div style="font-size:0.75rem;color:var(--text-muted);font-family:var(--font-mono);">${m.time || ""}</div>
            <div style="font-size:0.75rem;font-family:var(--font-mono);color:${accent};">${m.xp ? "+" + m.xp + " XP" : ""}</div>
            <div style="padding:2px 8px;border-radius:4px;font-size:0.67rem;font-family:var(--font-mono);background:${isWin ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)"};color:${isWin ? "#4ade80" : "var(--error)"};">${isWin ? "Win" : "Loss"}</div>
          </div>`;
        }).join("");
      });
    } else if (matchList) {
      matchList.innerHTML = `<div style="padding:16px 0;text-align:center;color:var(--text-muted);font-size:0.85rem;">Sign in to see your match history.</div>`;
    }

    canvas.querySelectorAll(".arena-mode-btn").forEach(btn => {
      const action = btn.dataset.action;
      btn.addEventListener("click", () => {
        if (action === "solo")      this._startArenaRun();
        if (action === "1v1")       this._startArenaMatchmaking();
        if (action === "reading")   this._startArenaReadingSprint();
        if (action === "dictation") this._startArenaDictation();
        if (action === "forge")     this._startArenaSentenceForge();
      });
    });
  }

  async _startArenaRun() {
    const lang    = this.currentLang;
    const canvas  = document.getElementById("center-canvas");
    const accent  = ACCENT[lang];
    const langData = await this._fetchLangData(lang);
    const pool    = this._arenaPoolFromLangData(langData, this.currentProgress);
    if (pool.length < 4) { showToast("Complete some lessons first to unlock arena content.", "info", 3500); return; }

    const items = [...pool].sort(() => Math.random() - 0.5).slice(0, 10);
    let idx = 0, score = 0;
    const startTime = Date.now();
    let stopTimer = () => {};

    const renderQ = () => {
      stopTimer();
      if (idx >= items.length) {
        this._arenaFinishScreen(canvas,
          { modeLabel: "Speed Translation", correct: score, total: items.length, elapsedMs: Date.now() - startTime, xp: score * 12, lang, accent },
          () => this._startArenaRun());
        return;
      }
      const item       = items[idx];
      const correctAns = item.target;
      const wrongs     = pool.filter(p => p.target !== correctAns).sort(() => Math.random() - 0.5).slice(0, 3).map(p => p.target);
      const options    = [correctAns, ...wrongs].sort(() => Math.random() - 0.5);

      canvas.innerHTML = `
<div class="canvas-content page-enter" style="max-width:520px;">
  <div class="arena-hud">
    <span class="arena-hud-q">${idx + 1} / ${items.length}</span>
    <div class="arena-timer-bar-wrap"><div class="arena-timer-fill"></div></div>
    <span class="arena-hud-score">${score} correct</span>
  </div>
  <div class="arena-hud-timer-label"><span class="arena-timer-label">8</span>s</div>
  <div class="card-elevated" style="padding:28px 32px;text-align:center;margin-bottom:20px;">
    <div style="font-size:0.62rem;letter-spacing:0.2em;text-transform:uppercase;color:var(--text-muted);font-family:var(--font-mono);margin-bottom:10px;">What is the ${LABEL[lang]} for…</div>
    <div style="font-size:1.45rem;font-weight:500;color:var(--text-primary);line-height:1.35;">${item.meaning}</div>
  </div>
  <div style="display:flex;flex-direction:column;gap:10px;" id="arena-options"></div>
</div>`;
      this._injectNavBar(canvas);

      const optEl = canvas.querySelector("#arena-options");
      options.forEach(opt => {
        const btn = document.createElement("button");
        btn.className = "btn btn-ghost arena-opt-btn";
        btn.style.cssText = "text-align:left;padding:14px 18px;font-size:1rem;justify-content:flex-start;font-family:var(--font-display);letter-spacing:0.03em;";
        btn.textContent = opt;
        btn.addEventListener("click", () => {
          stopTimer();
          const isRight = opt === correctAns;
          if (isRight) score++;
          _arenaFlashBtn(btn, isRight);
          if (!isRight) optEl.querySelectorAll(".arena-opt-btn").forEach(b => { if (b.textContent === correctAns) _arenaFlashBtn(b, true); });
          optEl.querySelectorAll("button").forEach(b => b.disabled = true);
          setTimeout(() => { idx++; renderQ(); }, 850);
        });
        optEl.appendChild(btn);
      });

      stopTimer = this._arenaStartTimer(canvas, 8, accent, () => {
        optEl.querySelectorAll(".arena-opt-btn").forEach(b => { if (b.textContent === correctAns) _arenaFlashBtn(b, true); });
        optEl.querySelectorAll("button").forEach(b => b.disabled = true);
        setTimeout(() => { idx++; renderQ(); }, 850);
      });
    };
    renderQ();
  }

  async _startArenaMatchmaking() {
    const lang   = this.currentLang;
    const canvas = document.getElementById("center-canvas");
    const accent = ACCENT[lang];
    const me     = getUser();
    if (!me || isGuest?.()) { showToast("Sign in to play 1v1", "info"); return; }

    // Prepare items for the match
    const langData = await this._fetchLangData(lang);
    const pool  = this._arenaPoolFromLangData(langData, this.currentProgress);
    const items = [...pool].sort(() => Math.random() - 0.5).slice(0, 10);
    if (!items.length) { showToast("Complete some lessons first to unlock arena content.", "info", 3500); return; }

    // Show waiting screen
    canvas.innerHTML = `<div class="canvas-content page-enter" style="text-align:center;padding:80px 40px;">
        <div style="margin-bottom:20px;opacity:0.85;">
          <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5.5l4 4"/><path d="M12 8l7-7"/><path d="M7 17l-4 4"/><path d="M8 12l-7 7"/><path d="M16 12l-4 4"/><path d="M12 16l4 4"/></svg>
        </div>
      <h2 style="font-family:var(--font-display);font-size:1.8rem;font-weight:300;color:var(--text-primary);margin-bottom:12px;">Finding Opponent…</h2>
      <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:32px;">Waiting for another player in ${LABEL[lang]}…</p>
      <div id="arena-queue-spinner" style="width:40px;height:40px;border:3px solid var(--border-subtle);border-top-color:${accent};border-radius:50%;margin:0 auto 32px;animation:spin 1s linear infinite;"></div>
      <style>@keyframes spin{to{transform:rotate(360deg);}}</style>
      <button class="btn btn-ghost" id="arena-cancel">Cancel</button>
    </div>`;
    this._injectNavBar(canvas);

    // Join queue
    await joinQueue(me.uid, me.displayName || "Learner", lang);

    let unsubQueue = null;
    let cancelled = false;

    canvas.querySelector("#arena-cancel")?.addEventListener("click", async () => {
      cancelled = true;
      if (unsubQueue) unsubQueue();
      await leaveQueue(me.uid);
      this._pageArena(canvas);
    });

    // Subscribe to queue — wait for match
    unsubQueue = subscribeQueue(me.uid, lang, items, async ({ matchId }) => {
      if (cancelled) return;
      if (unsubQueue) unsubQueue();
      await leaveQueue(me.uid);
      this._startArenaMultiplayer(matchId, items, pool);
    });
  }

  _startArenaMultiplayer(matchId, items, pool) {
    const lang   = this.currentLang;
    const canvas = document.getElementById("center-canvas");
    const accent = ACCENT[lang];
    const me     = getUser();
    let idx = 0, myCorrect = 0, startTime = Date.now();
    let unsubMatch = null;
    let oppProgress = 0, oppScore = 0;

    // Subscribe to match updates for opponent progress
    unsubMatch = subscribeMatch(matchId, (match) => {
      const oppUid = match.players.find(p => p !== me.uid);
      oppProgress = (match.answers?.[oppUid] || []).filter(a => a != null).length;
      oppScore = match.scores?.[oppUid] || 0;

      // Update opponent display if visible
      const oppEl = canvas.querySelector("#arena-opp-progress");
      if (oppEl) oppEl.textContent = `Opponent: ${oppProgress}/10 (${oppScore} correct)`;

      // Check if match is complete
      if (match.state === "complete" && idx >= items.length) {
        if (unsubMatch) unsubMatch();
        const isWin = match.winnerId === me.uid;
        const myScore = match.scores?.[me.uid] || 0;
        const myTime = ((match.times?.[me.uid] || 0) / 1000).toFixed(1);
        const xp = isWin ? myScore * 18 : myScore * 10;

        canvas.innerHTML = `<div class="canvas-content page-enter" style="text-align:center;padding:60px 40px;">
          <div style="margin-bottom:16px;display:flex;justify-content:center;opacity:0.9;">
            ${isWin ? _uiIconSvg("trophy", 52, accent) : _uiIconSvg("books", 52, "rgba(255,255,255,0.72)")}
          </div>
          <h2 style="font-family:var(--font-display);font-size:2rem;font-weight:300;color:var(--text-primary);margin-bottom:8px;">${isWin ? "Victory!" : "Defeat"}</h2>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;max-width:340px;margin:24px auto;">
            <div class="card" style="padding:16px;text-align:center;">
              <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:4px;">You</div>
              <div style="font-size:1.3rem;font-weight:600;color:${accent};">${myScore}/10</div>
              <div style="font-size:0.75rem;color:var(--text-muted);">${myTime}s</div>
            </div>
            <div class="card" style="padding:16px;text-align:center;">
              <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:4px;">Opponent</div>
              <div style="font-size:1.3rem;font-weight:600;color:var(--text-secondary);">${oppScore}/10</div>
            </div>
          </div>
          <div style="font-size:1.1rem;color:${accent};font-family:var(--font-mono);margin-bottom:24px;">+${xp} XP</div>
          <button class="btn btn-primary" id="arena-back">Back to Arena</button>
        </div>`;
        this._injectNavBar(canvas);
        canvas.querySelector("#arena-back")?.addEventListener("click", () => this._pageArena(canvas));
        if (xp > 0) {
          this.currentProgress.xp = (this.currentProgress.xp || 0) + xp;
          saveProgress(lang, this.currentProgress);
          showXpPopup(xp, isWin ? 5 : 2, null);
        }
      }
    });

    const renderQ = () => {
      if (idx >= items.length) {
        // Submit completion
        completeMatch(matchId, me.uid);
        canvas.innerHTML = `<div class="canvas-content page-enter" style="text-align:center;padding:80px 40px;">
          <div style="margin-bottom:16px;display:flex;justify-content:center;opacity:0.8;">${_uiIconSvg("chat", 34, "rgba(255,255,255,0.72)")}</div>
          <h2 style="font-family:var(--font-display);font-size:1.5rem;font-weight:300;color:var(--text-primary);margin-bottom:8px;">Waiting for opponent…</h2>
          <p style="font-size:0.85rem;color:var(--text-muted);">You scored ${myCorrect}/10. Waiting for results…</p>
        </div>`;
        this._injectNavBar(canvas);
        return;
      }
      const item = items[idx];
      const itemStart = Date.now();
      canvas.innerHTML = `<div class="canvas-content page-enter" style="max-width:500px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <span style="font-size:0.75rem;font-family:var(--font-mono);color:var(--text-muted);">${idx+1} / 10</span>
          <span style="font-size:0.75rem;font-family:var(--font-mono);color:${accent};">${myCorrect} correct</span>
        </div>
        <div id="arena-opp-progress" style="font-size:0.7rem;font-family:var(--font-mono);color:var(--text-muted);text-align:right;margin-bottom:16px;">Opponent: ${oppProgress}/10 (${oppScore} correct)</div>
        <div class="card-elevated" style="padding:32px;text-align:center;margin-bottom:20px;">
          <div style="font-size:0.65rem;letter-spacing:0.2em;text-transform:uppercase;color:var(--text-muted);font-family:var(--font-mono);margin-bottom:12px;">Translate to ${LABEL[lang]}</div>
          <div style="font-size:1.5rem;font-weight:500;color:var(--text-primary);">${item.english || item.meaning || item.back || ""}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;" id="arena-options"></div>
      </div>`;
      this._injectNavBar(canvas);

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
        btn.addEventListener("click", async () => {
          const isRight = opt === correct_ans;
          if (isRight) myCorrect++;
          btn.style.background = isRight ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)";
          btn.style.borderColor = isRight ? "#4ade80" : "var(--error)";
          optContainer.querySelectorAll("button").forEach(b => { b.disabled = true; });
          if (!isRight) {
            optContainer.querySelectorAll("button").forEach(b => {
              if (b.textContent === correct_ans) { b.style.background = "rgba(74,222,128,0.15)"; b.style.borderColor = "#4ade80"; }
            });
          }
          // Submit answer to Firestore
          const elapsedMs = Date.now() - itemStart;
          await submitAnswer(matchId, me.uid, idx, isRight, elapsedMs);
          setTimeout(() => { idx++; renderQ(); }, 700);
        });
        optContainer.appendChild(btn);
      });
    };

    // Countdown before starting
    let count = 3;
    canvas.innerHTML = `<div class="canvas-content page-enter" style="text-align:center;padding:100px 40px;">
      <div style="font-size:4rem;font-weight:300;color:${accent};" id="arena-countdown">${count}</div>
      <p style="font-size:0.85rem;color:var(--text-muted);margin-top:16px;">Match starting…</p>
    </div>`;
    const countdownEl = canvas.querySelector("#arena-countdown");
    const countdownTimer = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(countdownTimer);
        startTime = Date.now();
        renderQ();
      } else if (countdownEl) {
        countdownEl.textContent = count;
      }
    }, 1000);
  }

  // ── Arena shared: pool builder ────────────────────────────────────
  // Correct pool construction: walks unit.sessions[].items[] (not the old u.items).
  // Scans from current stage downward, then merges phraseLibrary.
  _arenaPoolFromLangData(langData, prog) {
    const pool    = [];
    const seen    = new Set();
    const stage   = prog?.stageUnlocked || 0;
    for (let s = stage; s >= 0 && pool.length < 50; s--) {
      const sd = langData?.stages?.[s];
      if (!sd) continue;
      for (const unit of (sd.units || [])) {
        if (unit.path === "branch") continue;
        for (const sess of (unit.sessions || [])) {
          for (const item of (sess.items || [])) {
            if (!item.target || !(item.meaning || item.answer)) continue;
            if (seen.has(item.target)) continue;
            seen.add(item.target);
            pool.push({
              target:  item.target,
              romanji: item.romanji || null,
              meaning: item.meaning || item.answer,
              audio:   !!item.audio,
            });
          }
        }
      }
    }
    // Merge phraseLibrary (words the learner has actually completed lessons for)
    for (const ph of (prog?.phraseLibrary || [])) {
      if (!ph.target || !ph.meaning || seen.has(ph.target)) continue;
      seen.add(ph.target);
      pool.push({ target: ph.target, romanji: ph.romanji || null, meaning: ph.meaning, audio: true });
    }
    return pool;
  }

  // ── Arena shared: finish screen ───────────────────────────────────
  _arenaFinishScreen(canvas, { modeLabel, correct, total, elapsedMs, xp, lang, accent }, onPlayAgain) {
    const pct     = total > 0 ? Math.round((correct / total) * 100) : 0;
    const elapsed = (elapsedMs / 1000).toFixed(1);
    const icon    = pct >= 80 ? _uiIconSvg("trophy", 52, accent)
                  : pct >= 50 ? _uiIconSvg("bolt",   52, accent)
                  :             _uiIconSvg("books",   52, "rgba(255,255,255,0.68)");
    const grade   = pct >= 80 ? "Excellent" : pct >= 60 ? "Good effort" : "Keep training";
    canvas.innerHTML = `
<div class="canvas-content page-enter" style="max-width:480px;text-align:center;padding:60px 32px;">
  <div style="margin-bottom:16px;display:flex;justify-content:center;">${icon}</div>
  <h2 style="font-family:var(--font-display);font-size:1.9rem;font-weight:300;color:var(--text-primary);margin-bottom:6px;">${grade}</h2>
  <div style="font-size:0.7rem;color:var(--text-muted);font-family:var(--font-mono);margin-bottom:28px;letter-spacing:0.1em;text-transform:uppercase;">${modeLabel}</div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;max-width:360px;margin:0 auto 28px;">
    <div class="card" style="padding:16px 12px;text-align:center;">
      <div style="font-size:1.35rem;font-weight:600;color:${accent};font-family:var(--font-mono);">${correct}/${total}</div>
      <div style="font-size:0.62rem;color:var(--text-muted);margin-top:3px;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:0.1em;">Score</div>
    </div>
    <div class="card" style="padding:16px 12px;text-align:center;">
      <div style="font-size:1.35rem;font-weight:600;color:var(--text-primary);font-family:var(--font-mono);">${elapsed}s</div>
      <div style="font-size:0.62rem;color:var(--text-muted);margin-top:3px;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:0.1em;">Time</div>
    </div>
    <div class="card" style="padding:16px 12px;text-align:center;">
      <div style="font-size:1.35rem;font-weight:600;color:#4ade80;font-family:var(--font-mono);">+${xp}</div>
      <div style="font-size:0.62rem;color:var(--text-muted);margin-top:3px;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:0.1em;">XP</div>
    </div>
  </div>
  <div style="display:flex;justify-content:center;gap:10px;">
    <button class="btn btn-primary" id="arena-play-again">Play Again</button>
    <button class="btn btn-ghost" id="arena-back">Back to Arena</button>
  </div>
</div>`;
    this._injectNavBar(canvas);
    canvas.querySelector("#arena-play-again")?.addEventListener("click", () => onPlayAgain());
    canvas.querySelector("#arena-back")?.addEventListener("click", () => this._pageArena(canvas));
    if (xp > 0) {
      this.currentProgress.xp = (this.currentProgress.xp || 0) + xp;
      this.allProgress[this.currentLang] = this.currentProgress;
      saveProgress(this.currentLang, this.currentProgress).catch(() => {});
      if (this.rightPanel) this.rightPanel.updateProgress(this.currentProgress);
      eventBus.emit("progress:update", this.currentProgress);
      showXpPopup(xp, pct >= 80 ? 5 : pct >= 60 ? 3 : 1, null);
    }
  }

  // ── Arena shared: per-question countdown bar ──────────────────────
  // Returns a stop() function. Call it before rendering the next question.
  _arenaStartTimer(canvas, seconds, accent, onExpire) {
    const fill  = canvas.querySelector(".arena-timer-fill");
    const label = canvas.querySelector(".arena-timer-label");
    if (!fill) return () => {};

    fill.style.transition = "none";
    fill.style.width      = "100%";
    fill.style.background = accent;
    // Force reflow then start linear animation
    fill.getBoundingClientRect();
    fill.style.transition = `width ${seconds}s linear`;
    fill.style.width      = "0%";

    const endTime = Date.now() + seconds * 1000;
    let expired = false;
    const iv = setInterval(() => {
      const remaining = Math.ceil((endTime - Date.now()) / 1000);
      if (label) label.textContent = Math.max(0, remaining);
      if (remaining <= 3) fill.style.background = "var(--error)";
      if (remaining <= 0 && !expired) {
        expired = true;
        clearInterval(iv);
        onExpire();
      }
    }, 200);
    return () => { clearInterval(iv); expired = true; };
  }

  // ── Dictation Race ────────────────────────────────────────────────
  async _startArenaDictation() {
    const lang    = this.currentLang;
    const canvas  = document.getElementById("center-canvas");
    const accent  = ACCENT[lang];
    const langData = await this._fetchLangData(lang);
    const pool    = this._arenaPoolFromLangData(langData, this.currentProgress);
    if (pool.length < 3) { showToast("Complete some lessons first.", "info", 3000); return; }

    const items = [...pool].sort(() => Math.random() - 0.5).slice(0, 8);
    let idx = 0, score = 0, totalPts = 0;
    const startTime = Date.now();
    let stopTimer = () => {};

    // Levenshtein distance for fuzzy matching (handles minor typos)
    const levenshtein = (a, b) => {
      const m = a.length, n = b.length;
      const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
      for (let i = 1; i <= m; i++)
        for (let j = 1; j <= n; j++)
          dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
      return dp[m][n];
    };

    const renderQ = () => {
      stopTimer();
      if (idx >= items.length) {
        this._arenaFinishScreen(canvas,
          { modeLabel: "Dictation Race", correct: score, total: items.length, elapsedMs: Date.now() - startTime, xp: totalPts * 14, lang, accent },
          () => this._startArenaDictation());
        return;
      }
      const item = items[idx];

      canvas.innerHTML = `
<div class="canvas-content page-enter" style="max-width:520px;">
  <div class="arena-hud">
    <span class="arena-hud-q">${idx + 1} / ${items.length}</span>
    <div class="arena-timer-bar-wrap"><div class="arena-timer-fill"></div></div>
    <span class="arena-hud-score">${score} correct</span>
  </div>
  <div class="arena-hud-timer-label"><span class="arena-timer-label">20</span>s</div>
  <div class="card-elevated" style="padding:28px 32px;text-align:center;margin-bottom:20px;">
    <div style="font-size:0.62rem;letter-spacing:0.2em;text-transform:uppercase;color:var(--text-muted);font-family:var(--font-mono);margin-bottom:16px;">Listen and type what you hear</div>
    <button id="dictation-play" class="btn btn-ghost" style="display:inline-flex;align-items:center;gap:8px;border-color:${accent}40;color:${accent};font-size:0.85rem;padding:10px 22px;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      Play Audio
    </button>
    <div style="font-size:0.72rem;color:var(--text-muted);font-family:var(--font-mono);margin-top:10px;opacity:0.7;">${item.meaning}</div>
  </div>
  <div style="display:flex;gap:10px;align-items:stretch;">
    <input id="dictation-input" class="arena-text-input" type="text"
      placeholder="Type in ${LABEL[lang]}…" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" style="flex:1;" />
    <button id="dictation-submit" class="btn btn-primary" style="padding:0 20px;flex-shrink:0;">Check</button>
  </div>
  <div id="dictation-feedback" style="min-height:26px;margin-top:12px;font-size:0.85rem;font-family:var(--font-mono);text-align:center;"></div>
</div>`;
      this._injectNavBar(canvas);

      // Auto-play audio on question load
      ttsSpeak(item.target, lang).catch(() => {});
      canvas.querySelector("#dictation-play")?.addEventListener("click", () => {
        ttsSpeak(item.target, lang).catch(() => {});
      });

      const inputEl = canvas.querySelector("#dictation-input");
      inputEl?.focus();

      const TIMER_SECS   = 20;
      const questionStart = Date.now();

      const submitAnswer = () => {
        stopTimer();
        const raw      = (inputEl?.value || "").trim();
        const correct  = item.target.trim();
        const dist     = levenshtein(raw.toLowerCase(), correct.toLowerCase());
        const isExact  = dist === 0;
        const isClose  = !isExact && dist <= 2;
        const speedMs  = Date.now() - questionStart;
        const pts      = isExact ? 2 : isClose ? 1 : 0;
        const speedBonus = pts > 0 && speedMs < 8000 ? 1 : 0;
        totalPts += pts + speedBonus;
        if (pts > 0) score++;

        const fb = canvas.querySelector("#dictation-feedback");
        if (fb) {
          if (isExact)
            fb.innerHTML = `<span style="color:#4ade80;">✓ Correct${speedBonus ? " · +1 speed bonus" : ""}</span>`;
          else if (isClose)
            fb.innerHTML = `<span style="color:#fbbf24;">≈ Close — <span style="font-family:var(--font-display);color:var(--text-primary);">${correct}</span></span>`;
          else
            fb.innerHTML = `<span style="color:var(--error);">✗ — <span style="font-family:var(--font-display);color:var(--text-primary);">${correct}</span></span>`;
        }
        if (inputEl) {
          inputEl.disabled = true;
          inputEl.style.borderColor = isExact ? "#4ade80" : isClose ? "#fbbf24" : "var(--error)";
        }
        const submitBtn = canvas.querySelector("#dictation-submit");
        if (submitBtn) submitBtn.disabled = true;
        setTimeout(() => { idx++; renderQ(); }, 1300);
      };

      canvas.querySelector("#dictation-submit")?.addEventListener("click", submitAnswer);
      inputEl?.addEventListener("keydown", e => { if (e.key === "Enter") submitAnswer(); });

      stopTimer = this._arenaStartTimer(canvas, TIMER_SECS, accent, () => {
        const fb = canvas.querySelector("#dictation-feedback");
        if (fb) fb.innerHTML = `<span style="color:var(--text-muted);">Time — <span style="font-family:var(--font-display);color:var(--text-primary);">${item.target}</span></span>`;
        if (inputEl) inputEl.disabled = true;
        const submitBtn = canvas.querySelector("#dictation-submit");
        if (submitBtn) submitBtn.disabled = true;
        setTimeout(() => { idx++; renderQ(); }, 1300);
      });
    };
    renderQ();
  }

  // ── Reading Sprint ─────────────────────────────────────────────────
  async _startArenaReadingSprint() {
    const lang    = this.currentLang;
    const canvas  = document.getElementById("center-canvas");
    const accent  = ACCENT[lang];
    const langData = await this._fetchLangData(lang);
    const pool    = this._arenaPoolFromLangData(langData, this.currentProgress);
    if (pool.length < 4) { showToast("Complete some lessons first.", "info", 3000); return; }

    const items = [...pool].sort(() => Math.random() - 0.5).slice(0, 8);
    let idx = 0, score = 0, totalPts = 0;
    const startTime = Date.now();
    let stopTimer = () => {};

    const renderQ = () => {
      stopTimer();
      if (idx >= items.length) {
        this._arenaFinishScreen(canvas,
          { modeLabel: "Reading Sprint", correct: score, total: items.length, elapsedMs: Date.now() - startTime, xp: totalPts * 12, lang, accent },
          () => this._startArenaReadingSprint());
        return;
      }
      const item           = items[idx];
      const correctMeaning = item.meaning;
      const wrongs         = pool
        .filter(p => p.meaning !== correctMeaning)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(p => p.meaning);
      const options        = [correctMeaning, ...wrongs].sort(() => Math.random() - 0.5);
      const TIMER_SECS     = 15;
      const questionStart  = Date.now();

      canvas.innerHTML = `
<div class="canvas-content page-enter" style="max-width:520px;">
  <div class="arena-hud">
    <span class="arena-hud-q">${idx + 1} / ${items.length}</span>
    <div class="arena-timer-bar-wrap"><div class="arena-timer-fill"></div></div>
    <span class="arena-hud-score">${score} correct</span>
  </div>
  <div class="arena-hud-timer-label"><span class="arena-timer-label">${TIMER_SECS}</span>s</div>
  <div class="card-elevated" style="padding:28px 32px;text-align:center;margin-bottom:20px;">
    <div style="font-size:0.62rem;letter-spacing:0.2em;text-transform:uppercase;color:var(--text-muted);font-family:var(--font-mono);margin-bottom:14px;">What does this mean?</div>
    <div style="font-family:var(--font-display);font-size:clamp(1.6rem,4vw,2.2rem);font-weight:300;color:var(--text-primary);letter-spacing:0.04em;line-height:1.25;">${item.target}</div>
    ${item.romanji ? `<div style="font-size:0.72rem;color:var(--text-muted);font-family:var(--font-mono);margin-top:8px;">${item.romanji}</div>` : ""}
  </div>
  <div style="display:flex;flex-direction:column;gap:10px;" id="arena-options"></div>
</div>`;
      this._injectNavBar(canvas);

      const optEl = canvas.querySelector("#arena-options");
      options.forEach(opt => {
        const btn = document.createElement("button");
        btn.className = "btn btn-ghost arena-opt-btn";
        btn.style.cssText = "text-align:left;padding:13px 18px;font-size:0.88rem;justify-content:flex-start;";
        btn.textContent = opt;
        btn.addEventListener("click", () => {
          stopTimer();
          const speedMs = Date.now() - questionStart;
          const isRight = opt === correctMeaning;
          // Speed bonus: 3pts if answered within 5s, 2pts otherwise
          const pts = isRight ? (speedMs < 5000 ? 3 : 2) : 0;
          totalPts += pts;
          if (isRight) score++;
          _arenaFlashBtn(btn, isRight);
          if (!isRight) optEl.querySelectorAll(".arena-opt-btn").forEach(b => { if (b.textContent === correctMeaning) _arenaFlashBtn(b, true); });
          optEl.querySelectorAll("button").forEach(b => b.disabled = true);
          setTimeout(() => { idx++; renderQ(); }, 850);
        });
        optEl.appendChild(btn);
      });

      stopTimer = this._arenaStartTimer(canvas, TIMER_SECS, accent, () => {
        optEl.querySelectorAll(".arena-opt-btn").forEach(b => { if (b.textContent === correctMeaning) _arenaFlashBtn(b, true); });
        optEl.querySelectorAll("button").forEach(b => b.disabled = true);
        setTimeout(() => { idx++; renderQ(); }, 850);
      });
    };
    renderQ();
  }

  // ── Sentence Forge ────────────────────────────────────────────────
  async _startArenaSentenceForge() {
    const lang    = this.currentLang;
    const canvas  = document.getElementById("center-canvas");
    const accent  = ACCENT[lang];
    const langData = await this._fetchLangData(lang);
    const pool    = this._arenaPoolFromLangData(langData, this.currentProgress);

    // Prefer items where romanji has 2+ space-separated tokens
    let forgeItems = pool.filter(p => (p.romanji || "").trim().split(/\s+/).filter(Boolean).length >= 2);
    let field = "romanji"; // what gets scrambled

    // Fallback: scramble the English meaning (3+ words) if not enough romanji items
    if (forgeItems.length < 3) {
      forgeItems = pool.filter(p => (p.meaning || "").trim().split(/\s+/).filter(Boolean).length >= 3);
      field = "meaning";
    }

    if (forgeItems.length < 3) {
      showToast("Not enough multi-word phrases yet — try other modes.", "info", 3500);
      return;
    }

    const items = [...forgeItems].sort(() => Math.random() - 0.5).slice(0, 8);
    let idx = 0, score = 0;
    const startTime = Date.now();
    let stopTimer = () => {};

    const renderQ = () => {
      stopTimer();
      if (idx >= items.length) {
        this._arenaFinishScreen(canvas,
          { modeLabel: "Sentence Forge", correct: score, total: items.length, elapsedMs: Date.now() - startTime, xp: score * 16, lang, accent },
          () => this._startArenaSentenceForge());
        return;
      }
      const item      = items[idx];
      const targetStr = (field === "meaning" ? item.meaning : item.romanji || item.target).trim();
      const tokens    = targetStr.split(/\s+/).filter(Boolean);
      // Shuffle until order differs from original (for any multi-token item)
      const shuffled  = [...tokens].sort(() => Math.random() - 0.5);
      if (tokens.length > 1 && shuffled.join(" ") === targetStr) shuffled.reverse();

      let placed = [];

      // Re-render the forge area (slots + token bank) on every interaction
      const renderForge = () => {
        const slotsEl  = canvas.querySelector("#forge-slots");
        const tokensEl = canvas.querySelector("#forge-tokens");
        if (!slotsEl || !tokensEl) return;

        // Slots — placed tokens (click to remove)
        slotsEl.innerHTML = placed.length
          ? placed.map((t, i) => `<button class="arena-token arena-token--placed" data-pi="${i}">${t}</button>`).join("")
          : `<span style="font-size:0.78rem;color:var(--text-muted);font-family:var(--font-mono);padding:4px 2px;">Place words here…</span>`;

        // Compute which shuffled indices are consumed
        const usedIdx = new Set();
        for (const p of placed) {
          const i = shuffled.findIndex((t, si) => t === p && !usedIdx.has(si));
          if (i !== -1) usedIdx.add(i);
        }

        // Token bank — unplaced tokens
        tokensEl.innerHTML = shuffled.map((t, i) =>
          usedIdx.has(i)
            ? `<button class="arena-token arena-token--used" disabled>${t}</button>`
            : `<button class="arena-token" data-ti="${i}">${t}</button>`
        ).join("");

        // Bind placed token removal
        slotsEl.querySelectorAll(".arena-token--placed").forEach(btn => {
          btn.addEventListener("click", () => {
            placed.splice(parseInt(btn.dataset.pi), 1);
            renderForge();
          });
        });

        // Bind unplaced token selection
        tokensEl.querySelectorAll(".arena-token:not([disabled])").forEach(btn => {
          btn.addEventListener("click", () => {
            placed.push(btn.textContent);
            renderForge();
          });
        });
      };

      const TIMER_SECS = 30;
      canvas.innerHTML = `
<div class="canvas-content page-enter" style="max-width:560px;">
  <div class="arena-hud">
    <span class="arena-hud-q">${idx + 1} / ${items.length}</span>
    <div class="arena-timer-bar-wrap"><div class="arena-timer-fill"></div></div>
    <span class="arena-hud-score">${score} correct</span>
  </div>
  <div class="arena-hud-timer-label"><span class="arena-timer-label">${TIMER_SECS}</span>s</div>
  <div class="card-elevated" style="padding:22px 28px;margin-bottom:16px;">
    <div style="font-size:0.62rem;letter-spacing:0.2em;text-transform:uppercase;color:var(--text-muted);font-family:var(--font-mono);margin-bottom:8px;">
      ${field === "meaning" ? "Arrange the English words in correct order" : `Rebuild the ${LABEL[lang]} phrase in order`}
    </div>
    <div style="font-size:${field === "meaning" ? "1rem" : "1.15rem"};color:var(--text-primary);font-weight:500;font-family:${field === "meaning" ? "inherit" : "var(--font-display)"};">
      ${field === "meaning" ? item.target : item.meaning}
    </div>
  </div>
  <div id="forge-slots" class="arena-forge-slots"></div>
  <div id="forge-tokens" class="arena-tokens-area" style="margin-top:14px;"></div>
  <div style="display:flex;gap:10px;margin-top:16px;align-items:center;">
    <button id="forge-submit" class="btn btn-primary" style="padding:9px 22px;font-size:0.85rem;">Submit</button>
    <button id="forge-clear" class="btn btn-ghost" style="padding:9px 16px;font-size:0.82rem;">Clear</button>
    <div id="forge-feedback" style="flex:1;font-size:0.82rem;font-family:var(--font-mono);text-align:right;min-height:20px;"></div>
  </div>
</div>`;
      this._injectNavBar(canvas);
      renderForge();

      canvas.querySelector("#forge-clear")?.addEventListener("click", () => { placed = []; renderForge(); });

      canvas.querySelector("#forge-submit")?.addEventListener("click", () => {
        stopTimer();
        const answer   = placed.join(" ").trim().toLowerCase();
        const expected = targetStr.toLowerCase();
        const isRight  = answer === expected;
        if (isRight) score++;

        const fb = canvas.querySelector("#forge-feedback");
        if (fb) {
          fb.innerHTML = isRight
            ? `<span style="color:#4ade80;">✓ Correct</span>`
            : `<span style="color:var(--error);">✗ — <em style="color:var(--text-secondary);">${targetStr}</em></span>`;
        }
        canvas.querySelectorAll("#forge-submit,#forge-clear").forEach(b => b.setAttribute("disabled", ""));
        canvas.querySelectorAll(".arena-token:not([disabled])").forEach(b => b.setAttribute("disabled", ""));
        setTimeout(() => { idx++; renderQ(); }, 1350);
      });

      stopTimer = this._arenaStartTimer(canvas, TIMER_SECS, accent, () => {
        const fb = canvas.querySelector("#forge-feedback");
        if (fb) fb.innerHTML = `<span style="color:var(--text-muted);">Time — <em style="color:var(--text-secondary);">${targetStr}</em></span>`;
        canvas.querySelectorAll("#forge-submit,#forge-clear,.arena-token").forEach(b => b.setAttribute("disabled", ""));
        setTimeout(() => { idx++; renderQ(); }, 1350);
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
    <div style="margin-bottom:16px;display:flex;justify-content:center;opacity:0.85;">${_uiIconSvg("leaf", 34, accent)}</div>
    <h3 style="font-family:var(--font-display);font-size:1.5rem;font-weight:300;color:var(--text-primary);margin-bottom:14px;">Made with care</h3>
    <p style="font-size:0.9rem;color:var(--text-secondary);line-height:1.75;margin-bottom:14px;">Vaultia is an independent project — no venture capital, no advertisers, no data brokers. Just a genuine attempt to make language learning feel meaningful, beautiful, and worth your time.</p>
    <p style="font-size:0.9rem;color:var(--text-secondary);line-height:1.75;margin-bottom:20px;">If Vaultia has helped you, a small contribution on Ko-fi keeps the servers running, the content growing, and the team caffeinated.</p>
    <a href="${KOFI_URL}" target="_blank" rel="noopener" class="btn btn-primary" style="display:inline-flex;align-items:center;gap:8px;text-decoration:none;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
      Support the Builder
    </a>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px;">
    ${[
      { icon:"ban",  title:"No Ads",         desc:"Your learning experience is never interrupted by advertising." },
      { icon:"lock", title:"No Data Sales",  desc:"Your progress and usage is never sold to third parties." },
      { icon:"key",  title:"Starter Trial",  desc:"A short free trial lets learners feel the climb before buying full access." },
      { icon:"card", title:"Fair Unlock",    desc:"Plan around a simple one-tier unlock — roughly $5, $8, or $10 — instead of ad sludge." },
      { icon:"chat", title:"Community First",desc:"Feature decisions are driven by learner feedback." },
    ].map(f => `
      <div class="card" style="padding:18px;">
        <div style="margin-bottom:8px;display:flex;align-items:center;justify-content:center;opacity:0.85;">${_uiIconSvg(f.icon, 24, "rgba(255,255,255,0.78)")}</div>
        <div style="font-size:0.88rem;font-weight:500;color:var(--text-primary);margin-bottom:4px;">${f.title}</div>
        <div style="font-size:0.78rem;color:var(--text-muted);line-height:1.5;">${f.desc}</div>
      </div>
    `).join("")}
  </div>

    <div class="card" style="padding:20px 24px;text-align:center;">
    <div style="font-size:0.75rem;color:var(--text-muted);font-family:var(--font-mono);margin-bottom:8px;">Thank you for being here.</div>
    <div style="font-family:var(--font-display);font-size:1.2rem;font-weight:300;color:var(--text-secondary);">Every contribution helps keep Vaultia independent, useful, and ad-light.</div>
  </div>
</div>`;
  }

  // ── Profile ───────────────────────────────────────────────────────
  _pageProfile(canvas) {
    const user        = getUser();
    const accent      = ACCENT[this.currentLang] || "#8b7cff";
    const xp          = this.currentProgress?.xp || 0;
    const level       = xpToLevel(xp);
    const dev         = isDevUser();
    const prof        = this.profile || {};
    const momentum    = Math.round(prof.momentum?.score ?? 0);
    const titlePrefix = prof.identity?.titlePrefix ? `${prof.identity.titlePrefix} ` : "";
    const displayName = user?.displayName || "Learner";
    const STAGE_NAMES = ["Starter","Beginner","Explorer","Speaker","Scholar","Specialist","Archivist"];

    // Per-language progress cards (built synchronously from allProgress)
    const langCards = Object.entries(this.allProgress).map(([l, p]) => {
      const lxp    = p.xp || 0;
      const llv    = xpToLevel(lxp);
      const lstg   = p.stageUnlocked || 0;
      const la     = ACCENT[l] || "#8b7cff";
      const stgPct = Math.round((lstg / 6) * 100);
      return `
        <div class="prof-lang-card">
          <div class="prof-lang-accent-bar" style="background:${la};"></div>
          <div class="prof-lang-body">
            <div class="prof-lang-name" style="color:${la};">${LABEL[l] || l}</div>
            <div class="prof-lang-meta">
              <span style="color:${la};">${lxp.toLocaleString()} XP</span>
              <span class="prof-lang-sep">·</span>
              <span>Lv.${llv}</span>
              <span class="prof-lang-sep">·</span>
              <span>${STAGE_NAMES[lstg] || "Starter"}</span>
            </div>
            <div class="prof-lang-bar-track">
              <div class="prof-lang-bar-fill" style="width:${stgPct}%;background:${la};"></div>
            </div>
          </div>
        </div>`;
    }).join("");

    canvas.innerHTML = `
<div class="canvas-content page-enter">

  <!-- Profile header: banner + floating avatar + identity + actions -->
  <div class="prof-header-card">
    <div class="prof-header-banner" style="background:linear-gradient(135deg,${accent}28,${accent}08);"></div>
    <div class="prof-header-body">
      <div id="profile-avatar-wrap" class="prof-avatar-wrap">
        <div class="prof-avatar-inner" style="background:${accent}20;border:2px solid ${accent}40;color:${accent};font-family:var(--font-display);">
          ${user?.photoURL
            ? `<img src="${user.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none'" />`
            : (user?.displayName || user?.email || "G")[0].toUpperCase()
          }
        </div>
      </div>
      <div class="prof-header-identity">
        <div class="prof-display-name">${titlePrefix}${displayName}</div>
        <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:6px;">${user?.email || "Guest session"}</div>
        <div id="prof-glyph-row" class="prof-glyph-row"></div>
      </div>
      <div class="prof-header-actions">
        ${dev ? `<span class="ws-tag" style="color:#a08fff;border-color:rgba(139,124,255,0.3);background:rgba(139,124,255,0.1);">Developer</span>` : ""}
        ${!user?._isLocal && !user?._isGuest
          ? `<span class="ws-tag" style="color:#4db8ff;border-color:rgba(77,184,255,0.25);background:rgba(77,184,255,0.1);">Cloud Sync</span>`
          : `<span class="ws-tag" style="color:#fbbf24;border-color:rgba(251,191,36,0.25);background:rgba(251,191,36,0.08);">Local Save</span>`}
        <button class="btn btn-sm btn-ghost" id="go-to-edit-profile" style="font-size:0.75rem;">Edit Profile</button>
      </div>
    </div>
  </div>

  <!-- Body: left identity column + right achievement board -->
  <div class="prof-body-grid">

    <!-- Left: persona card -->
    <div class="prof-left-col card">
      <div id="profile-bio-slot" class="prof-bio-slot"></div>
      <div class="prof-stat-cluster">
        <div class="prof-stat-cell">
          <span class="prof-stat-value">${(this.currentProgress?.completed||[]).length}</span>
          <span class="prof-stat-label">Lessons</span>
        </div>
        <div class="prof-stat-cell">
          <span class="prof-stat-value">${level}</span>
          <span class="prof-stat-label">Level</span>
        </div>
        <div class="prof-stat-cell">
          <span class="prof-stat-value">${momentum}<span style="font-size:0.7em;opacity:0.7;">%</span></span>
          <span class="prof-stat-label">Momentum</span>
        </div>
      </div>
      <div id="profile-familiar-slot" class="prof-familiar-slot"></div>
      <label class="prof-familiar-toggle">
        <input id="toggle-familiar" type="checkbox" ${prof.familiar?.enabled === false ? "" : "checked"} />
        <span>Show Familiar</span>
      </label>
    </div>

    <!-- Right: achievement board -->
    <div class="prof-right-col">

      <!-- Trophies -->
      <div class="prof-achievement-section card">
        <div class="prof-section-eyebrow">Trophies</div>
        <div id="prof-trophy-showcase" class="prof-trophy-showcase">
          <div class="prof-section-loading">Loading…</div>
        </div>
      </div>

      <!-- Seals (all languages) -->
      <div class="prof-achievement-section card">
        <div class="prof-section-eyebrow">Seals</div>
        <div id="profile-seals-row" class="prof-seals-board">
          <div class="prof-section-loading">Loading…</div>
        </div>
      </div>

      <!-- Language progress -->
      <div class="prof-achievement-section card">
        <div class="prof-section-eyebrow">Language Progress</div>
        <div class="prof-lang-progress-list">
          ${langCards || `<div style="font-size:0.82rem;color:var(--text-muted);padding:8px 0;">No languages started yet.</div>`}
        </div>
      </div>

    </div>
  </div>

  <!-- Archivist Desk: full-width -->
  <div class="card-elevated prof-desk-card">
    <div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:12px;">
      <div style="font-family:var(--font-display);font-size:1.05rem;font-weight:500;color:var(--text-primary);">Archivist Desk</div>
      <button id="desk-material-btn" class="btn btn-sm btn-ghost" style="font-size:0.72rem;">Material</button>
    </div>
    <div id="profile-desk-mount" style="display:flex;justify-content:center;overflow:auto;padding-bottom:8px;"></div>
    <div style="margin-top:10px;font-size:0.72rem;color:var(--text-muted);">Drag artifacts to reposition. Right-click to inspect.</div>
  </div>

  ${dev ? `
  <!-- Dev panel -->
  <div class="card" style="margin-top:16px;background:rgba(139,124,255,0.04);border-color:rgba(139,124,255,0.18);">
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

</div>`;

    // ── Event bindings ───────────────────────────────────────────────
    canvas.querySelector("#go-to-edit-profile")?.addEventListener("click", () => this._onRightNav("edit-profile"));

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
      this.currentProgress.level = 1;
      this.currentProgress.completed = [];
      this.currentProgress.stars = {};
      this.currentProgress.stageUnlocked = 0;
      this.currentProgress.accuracy = null;
      this.currentProgress.vocabSeen = [];
      this.currentProgress.weakWords = [];
      this.currentProgress.reviewQueue = [];
      this.currentProgress.placement = null;
      await saveProgress(this.currentLang, this.currentProgress);
      this.allProgress[this.currentLang] = this.currentProgress;
      eventBus.emit("progress:update", this.currentProgress);
      this.rightPanel?.updateProgress(this.currentProgress);
      syncProgressToProfile(this.currentLang, this.currentProgress);
      const db = getDb(); const me = getUser();
      if (db && me) db.collection("users").doc(me.uid).update({ level: 1, xp: 0 }).catch(() => {});
      showToast(`Progress reset for ${LABEL[this.currentLang] || this.currentLang}`, "success");
      this._pageProfile(canvas);
    });

    this._mountProfileWorkstation(canvas).catch(() => {});
  }

  async _mountProfileWorkstation(canvas) {
    // 1. Avatar decorators (ring + frame)
    const avatarWrap = canvas.querySelector("#profile-avatar-wrap");
    if (avatarWrap) {
      this._profileRing?.destroy?.();
      this._profileRing = new MomentumRing(avatarWrap);
      FrameRenderer.applyFromFirestore(avatarWrap, 72);
    }

    // 2. Glyph badges row — language identity chips with prestige rank
    const glyphRow = canvas.querySelector("#prof-glyph-row");
    if (glyphRow) {
      const langs = Object.keys(this.allProgress).filter(l => (this.allProgress[l]?.xp || 0) > 0);
      if (langs.length) {
        const badgeHtml = await Promise.all(langs.map(async l => {
          let rank = 0;
          try { rank = await PrestigeSystem.getPrestigeRank(l) || 0; } catch (_) {}
          return renderGlyphBadge(l, { rank, size: 30 });
        }));
        glyphRow.innerHTML = badgeHtml.join("");
      }
    }

    // 3. Trophy showcase (pinned first, then earned, max 6)
    const trophyShowcase = canvas.querySelector("#prof-trophy-showcase");
    if (trophyShowcase) {
      try {
        const prof = await loadProfile();
        this.profile = prof;
        const earned = computeEarned(this.currentProgress, this.allProgress, prof);
        const pinned = prof?.trophies?.pinned || [];
        const TIER_COLORS = { bronze:"#cd7c2f", silver:"#94a3b8", gold:"#fbbf24", platinum:"#a78bfa" };
        if (!earned.length) {
          trophyShowcase.innerHTML = `
            <div class="prof-section-empty">
              <div style="font-size:1.6rem;margin-bottom:6px;opacity:0.45;">🏆</div>
              <div>Complete lessons to earn trophies</div>
            </div>`;
        } else {
          const pinnedSet    = new Set(pinned);
          const pinnedEarned = earned.filter(t => pinnedSet.has(t.id));
          const otherEarned  = earned.filter(t => !pinnedSet.has(t.id));
          const showcase     = [...pinnedEarned, ...otherEarned].slice(0, 6);
          trophyShowcase.innerHTML = `
            <div class="prof-trophy-grid">
              ${showcase.map(t => {
                const tier  = t.tier || "bronze";
                const color = TIER_COLORS[tier] || TIER_COLORS.bronze;
                const isPinned = pinnedSet.has(t.id);
                return `<div class="prof-trophy-cell" title="${t.label}${t.desc ? ': ' + t.desc : ''}">
                  <div class="prof-trophy-icon" style="color:${color};border-color:${color}30;background:${color}10;">${t.icon || "🏆"}</div>
                  <div class="prof-trophy-name">${t.label}</div>
                  <div class="prof-trophy-tier" style="color:${color};">${tier}${isPinned ? " · 📌" : ""}</div>
                </div>`;
              }).join("")}
            </div>
            <div class="prof-trophy-count">${earned.length} earned${pinned.length ? ` · ${Math.min(pinned.length, 3)} pinned` : ""}</div>`;
        }
      } catch (_) {
        trophyShowcase.innerHTML = `<div class="prof-section-loading">—</div>`;
      }
    }

    // 4. Seals board — all languages, grouped
    const sealsBoard = canvas.querySelector("#profile-seals-row");
    if (sealsBoard) {
      const prof     = this.profile || await loadProfile();
      this.profile   = prof;
      const allSeals = prof?.seals || {};
      const sealHtml = ["japanese","korean","spanish"].map(l => {
        const s = allSeals[l] || [];
        if (!s.length) return "";
        return `
          <div class="prof-seals-lang-group">
            <div class="prof-seals-lang-label" style="color:${ACCENT[l] || "#8b7cff"};">${LABEL[l] || l}</div>
            <div class="prof-seals-row">${s.map(sk => `<div style="opacity:0.9;">${renderSeal(sk, 30, true)}</div>`).join("")}</div>
          </div>`;
      }).filter(Boolean).join("");
      sealsBoard.innerHTML = sealHtml || `<div class="prof-section-empty"><div>Complete a full stage to earn seals</div></div>`;
    }

    // 5. Bio (async from Firestore)
    const bioSlot = canvas.querySelector("#profile-bio-slot");
    if (bioSlot) {
      const _db = getDb(); const _me = getUser();
      if (_db && _me && !_me._isLocal && !_me._isGuest) {
        _db.collection("users").doc(_me.uid).get().then(snap => {
          const bio = snap?.data()?.bio || "";
          if (bio) {
            const safe = bio.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
            bioSlot.innerHTML = `<div style="font-size:0.78rem;color:var(--text-secondary);line-height:1.55;white-space:pre-wrap;">${safe}</div>`;
          }
        }).catch(() => {});
      }
    }

    // 6. Familiar
    const famSlot = canvas.querySelector("#profile-familiar-slot");
    if (famSlot) {
      this._profileFam?.destroy?.();
      famSlot.innerHTML = "";
      this._profileFam = await Familiar.fromFirestore(famSlot);
    }

    // 7. Familiar toggle
    canvas.querySelector("#toggle-familiar")?.addEventListener("change", async (e) => {
      const enabled = !!e.target.checked;
      const prof = await updateProfile((p) => {
        p.familiar = p.familiar || {};
        p.familiar.enabled = enabled;
        return p;
      });
      this.profile = prof;
      this._pageProfile(canvas);
    });

    // Desk mount
    const deskMount = canvas.querySelector("#profile-desk-mount");
    if (deskMount) {
      this._profileDesk?.destroy?.();
      deskMount.innerHTML = "";
      this._profileDesk = await ProfileDesk.mount(deskMount);
    }

    // Desk material menu
    canvas.querySelector("#desk-material-btn")?.addEventListener("click", async (e) => {
      e.preventDefault();
      const prof = await loadProfile();
      const rewards = prof?.rewards || {};
      const current = prof?.desk?.material || "walnut";

      const materials = [
        { id: "walnut", label: "Polished Walnut", unlocked: true },
        { id: "marble", label: "White Marble", unlocked: !!rewards.desk_marble },
        { id: "carbon", label: "Carbon Fiber", unlocked: !!rewards.desk_carbon },
        { id: "tatami", label: "Traditional Tatami", unlocked: !!rewards.desk_tatami },
      ].filter((m) => m.unlocked);

      const panel = document.createElement("div");
      panel.style.cssText = `
        position:fixed;left:${e.clientX + 10}px;top:${e.clientY + 10}px;z-index:300;
        background:var(--bg-surface);border:1px solid var(--border-normal);
        border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.6);
        padding:10px;min-width:220px;`;
      panel.innerHTML = `
        <div style="font-size:0.7rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--text-muted);font-family:var(--font-mono);margin-bottom:8px;">Desk Material</div>
        ${materials.map((m) => `
          <button data-mat="${m.id}" style="width:100%;text-align:left;padding:8px 10px;border-radius:10px;border:1px solid transparent;background:transparent;color:var(--text-secondary);display:flex;justify-content:space-between;align-items:center;">
            <span>${m.label}</span>
            <span style="font-family:var(--font-mono);font-size:0.72rem;color:var(--text-muted);">${m.id === current ? "Active" : ""}</span>
          </button>
        `).join("")}
      `;

      const dismiss = (ev) => {
        if (!panel.contains(ev.target)) {
          panel.remove();
          document.removeEventListener("mousedown", dismiss);
        }
      };

      panel.querySelectorAll("button[data-mat]").forEach((btn) => {
        btn.addEventListener("mouseenter", () => { btn.style.background = "var(--bg-hover)"; btn.style.borderColor = "var(--border-subtle)"; });
        btn.addEventListener("mouseleave", () => { btn.style.background = ""; btn.style.borderColor = "transparent"; });
        btn.addEventListener("click", async () => {
          const mat = btn.dataset.mat;
          await updateProfile((p) => {
            p.desk = p.desk || {};
            p.desk.material = mat;
            return p;
          });
          panel.remove();
          document.removeEventListener("mousedown", dismiss);
          this._pageProfile(canvas);
        });
      });

      document.body.appendChild(panel);
      setTimeout(() => document.addEventListener("mousedown", dismiss), 10);
    });
  }

  // ── Edit Profile ──────────────────────────────────────────────────
  async _pageEditProfile(canvas) {
    const user   = getUser();
    const accent = ACCENT[this.currentLang] || "#8b7cff";

    // Load bio from Firestore
    let bioText = "";
    try {
      const db = getDb();
      if (db && user && !user._isGuest && !user._isLocal) {
        const doc = await db.collection("users").doc(user.uid).get();
        bioText = doc?.data()?.bio || "";
      }
    } catch (_) {}

    const initials = (user?.displayName || user?.email || "?")[0].toUpperCase();
    const isCloud  = !user?._isLocal && !user?._isGuest;

    canvas.innerHTML = `
<div class="canvas-content page-enter" style="max-width:480px;">
  <div class="section-header">
    <h2 class="section-title">Edit Profile</h2>
    <p class="section-subtitle" style="display:block;">Update your display name, photo, and bio</p>
  </div>

  <!-- Avatar -->
  <div class="card-elevated" style="padding:28px 24px;display:flex;flex-direction:column;align-items:center;gap:20px;margin-bottom:16px;">
    <div style="position:relative;">
      <div id="pfp-preview" style="width:96px;height:96px;border-radius:50%;background:${accent}20;border:2px solid ${accent}40;display:flex;align-items:center;justify-content:center;font-size:2.4rem;font-weight:600;color:${accent};overflow:hidden;font-family:var(--font-display);">
        ${(user?._avatarUrl || user?.photoURL)
          ? `<img src="${user._avatarUrl || user.photoURL}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'" />`
          : initials}
      </div>
      <label for="pfp-input" style="position:absolute;bottom:2px;right:2px;width:28px;height:28px;border-radius:50%;background:var(--bg-surface);border:1px solid var(--border-normal);display:flex;align-items:center;justify-content:center;font-size:0.75rem;${isCloud ? "cursor:pointer;" : "cursor:not-allowed;opacity:0.4;pointer-events:none;"}" title="${isCloud ? "Change photo" : "Photo sync requires a cloud account"}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
      </label>
      <input id="pfp-input" type="file" accept="image/*" style="display:none;" ${!isCloud ? "disabled" : ""} />
    </div>
    ${!isCloud ? `<div style="font-size:0.7rem;color:var(--text-muted);font-family:var(--font-mono);text-align:center;">Photo sync requires a cloud account</div>` : ""}
  </div>

  <!-- Fields -->
  <div class="card-elevated" style="padding:20px 24px;display:flex;flex-direction:column;gap:16px;margin-bottom:16px;">
    <div>
      <label style="display:block;font-size:0.72rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-muted);font-family:var(--font-mono);margin-bottom:6px;">Display Name</label>
      <input id="display-name-input" class="input" value="${user?.displayName || ""}" placeholder="Your name" style="width:100%;font-size:0.9rem;" autocomplete="off" />
      <div style="font-size:0.68rem;color:var(--text-muted);margin-top:5px;">Shown to others on the leaderboard and in friend requests</div>
    </div>
    <div>
      <label style="display:block;font-size:0.72rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-muted);font-family:var(--font-mono);margin-bottom:6px;">Email</label>
      <div class="input" style="width:100%;font-size:0.85rem;color:var(--text-secondary);cursor:default;background:var(--bg-glass);">${user?.email || "Guest session"}</div>
      <div style="display:flex;align-items:center;gap:6px;margin-top:6px;">
        <span style="font-size:0.68rem;color:var(--text-muted);">Account:</span>
        <span style="font-size:0.65rem;font-family:var(--font-mono);padding:2px 7px;border-radius:4px;${isCloud ? "background:rgba(74,222,128,0.1);color:#4ade80;border:1px solid rgba(74,222,128,0.2);" : "background:var(--bg-glass);color:var(--text-muted);border:1px solid var(--border-subtle);"}">${user?._isGuest ? "Guest" : user?._isLocal ? "Local" : "Cloud ✓"}</span>
      </div>
    </div>
    <div>
      <label style="display:block;font-size:0.72rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-muted);font-family:var(--font-mono);margin-bottom:6px;">Bio</label>
      <textarea id="bio-input" class="input" placeholder="Write a short bio…" style="width:100%;font-size:0.85rem;resize:vertical;min-height:80px;max-height:160px;">${bioText}</textarea>
    </div>
  </div>

  <div style="display:flex;gap:10px;justify-content:flex-end;">
    <button id="cancel-edit-profile" class="btn btn-ghost">Cancel</button>
    <button id="save-profile-btn" class="btn btn-primary">Save Changes</button>
  </div>
</div>`;

    // Cancel
    canvas.querySelector("#cancel-edit-profile")?.addEventListener("click", () => this._onRightNav("profile"));

    // Inject spin keyframe once
    if (!document.getElementById("pfp-spin-style")) {
      const st = document.createElement("style");
      st.id = "pfp-spin-style";
      st.textContent = "@keyframes pfpSpin{to{transform:rotate(360deg)}}";
      document.head.appendChild(st);
    }

    // Lazy-load NSFW.js + TF.js and cache the model on window
    const _loadNSFWModel = async () => {
      if (window._nsfwModel) return window._nsfwModel;
      const loadScript = src => new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = src; s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
      if (!window.tf)     await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.20.0/dist/tf.min.js");
      if (!window.nsfwjs) await loadScript("https://cdn.jsdelivr.net/npm/nsfwjs@2.4.0/dist/nsfwjs.min.js");
      window._nsfwModel = await window.nsfwjs.load("https://cdn.jsdelivr.net/npm/nsfwjs@2.4.0/quant_nsfw_mobilenet/");
      return window._nsfwModel;
    };

    // Photo upload
    canvas.querySelector("#pfp-input")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const preview = canvas.querySelector("#pfp-preview");

      // Show checking state
      if (preview) preview.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;width:100%;height:100%;font-size:0.65rem;color:var(--text-muted);font-family:var(--font-mono);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="animation:pfpSpin 1s linear infinite;flex-shrink:0;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          Checking…
        </div>`;

      const img = new Image();
      const objectURL = URL.createObjectURL(file);
      img.onload = async () => {
        URL.revokeObjectURL(objectURL);

        // ── Content moderation ──────────────────────────────────────
        try {
          const model = await _loadNSFWModel();
          const predictions = await model.classify(img);
          const scores = Object.fromEntries(predictions.map(p => [p.className, p.probability]));
          const flagged = (scores.Porn || 0) + (scores.Hentai || 0) + (scores.Sexy || 0);
          if (flagged > 0.45) {
            if (preview) preview.innerHTML = (user._avatarUrl || user.photoURL)
              ? `<img src="${user._avatarUrl || user.photoURL}" style="width:100%;height:100%;object-fit:cover;" />`
              : initials;
            e.target.value = "";
            showToast("Image doesn't meet community guidelines (PG-13). Please choose a different photo.", "error", 5000);
            return;
          }
        } catch (modErr) {
          console.warn("[PFP] Content moderation unavailable:", modErr.message);
          // Fail open — don't block upload if model can't load
        }

        // ── Process & save ──────────────────────────────────────────
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2, sy = (img.height - min) / 2;

        // High-quality version stored in Firestore (used for display everywhere)
        // We do NOT write base64 to Firebase Auth photoURL — it has a character limit
        const hiCvs = document.createElement("canvas");
        hiCvs.width = 256; hiCvs.height = 256;
        hiCvs.getContext("2d").drawImage(img, sx, sy, min, min, 0, 0, 256, 256);
        const hiResURL = hiCvs.toDataURL("image/jpeg", 0.85);

        if (preview) preview.innerHTML = `<img src="${hiResURL}" style="width:100%;height:100%;object-fit:cover;" />`;

        try {
          const db = getDb(); const me = getUser();
          if (db && me) await db.collection("users").doc(me.uid).update({ avatar_url: hiResURL });
          setAvatarUrl(hiResURL);
          eventBus.emit("auth:changed", { user: getUser(), isGuest: false });
          showToast("Photo updated!", "success");
        } catch (saveErr) {
          console.error("[PFP] Save failed:", saveErr);
          showToast("Failed to save photo. Please try again.", "error");
        }
      };
      img.src = objectURL;
    });

    // Save
    canvas.querySelector("#save-profile-btn")?.addEventListener("click", async () => {
      const name = canvas.querySelector("#display-name-input")?.value?.trim();
      const bio  = canvas.querySelector("#bio-input")?.value?.trim() || "";
      if (!name) { showToast("Enter a display name", "error"); return; }
      const btn = canvas.querySelector("#save-profile-btn");
      btn.disabled = true; btn.textContent = "Saving…";
      try {
        const res = await updateSocialProfile({ displayName: name });
        const db  = getDb(); const me = getUser();
        if (db && me) await db.collection("users").doc(me.uid).update({ bio }).catch(() => {});
        if (res.ok) {
          eventBus.emit("auth:changed", { user: getUser(), isGuest: false });
          showToast("Profile updated!", "success");
          this._onRightNav("profile");
        } else {
          btn.disabled = false; btn.textContent = "Save Changes";
          showToast(res.error || "Failed to save", "error");
        }
      } catch (err) {
        btn.disabled = false; btn.textContent = "Save Changes";
        showToast("Failed to save. Please try again.", "error");
      }
    });
  }

  // ── Delete account confirmation ───────────────────────────────────
  _confirmDeleteAccount() {
    const user        = getUser();
    const isEmailUser = !!(user?.email && !user?._isGuest && !user?._isLocal);

    const modal = document.createElement("div");
    modal.style.cssText = "position:fixed;inset:0;z-index:500;background:rgba(0,0,0,0.82);display:flex;align-items:center;justify-content:center;padding:20px;";
    modal.innerHTML = `
      <div style="background:var(--bg-surface);border:1px solid var(--border-normal);border-radius:16px;width:100%;max-width:400px;padding:28px 24px;">
        <h3 style="font-size:1.05rem;font-weight:600;color:var(--text-primary);margin:0 0 8px;">Delete Account</h3>
        <p style="font-size:0.84rem;color:var(--text-secondary);margin:0 0 20px;line-height:1.55;">
          This permanently deletes your account, all progress, and profile data. This cannot be undone.
        </p>
        ${isEmailUser ? `
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-muted);font-family:var(--font-mono);margin-bottom:6px;">Confirm Password</label>
          <input id="del-password" type="password" class="input" placeholder="Your password" style="width:100%;font-size:0.9rem;" autocomplete="current-password" />
        </div>` : ""}
        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-muted);font-family:var(--font-mono);margin-bottom:6px;">Type <span style="color:var(--text-secondary);font-style:normal;">delete</span> to confirm</label>
          <input id="del-confirm-input" class="input" placeholder="delete" style="width:100%;font-size:0.9rem;" autocomplete="off" spellcheck="false" />
        </div>
        <div id="del-error" style="font-size:0.8rem;color:#f87171;min-height:18px;margin-bottom:14px;"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button id="del-cancel" class="btn btn-ghost">Cancel</button>
          <button id="del-submit" class="btn btn-danger" disabled>Delete Account</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const confirmInput = modal.querySelector("#del-confirm-input");
    const submitBtn    = modal.querySelector("#del-submit");
    const errorDiv     = modal.querySelector("#del-error");

    confirmInput.addEventListener("input", () => {
      submitBtn.disabled = confirmInput.value.trim() !== "delete";
    });

    const close = () => modal.remove();
    modal.querySelector("#del-cancel").addEventListener("click", close);
    modal.addEventListener("click", e => { if (e.target === modal) close(); });

    submitBtn.addEventListener("click", async () => {
      const password = modal.querySelector("#del-password")?.value || "";
      if (isEmailUser && !password) {
        errorDiv.textContent = "Please enter your password to confirm.";
        return;
      }
      submitBtn.disabled = true;
      submitBtn.textContent = "Deleting…";
      errorDiv.textContent = "";
      const res = await deleteAccount(password);
      if (res.ok) {
        close();
        showToast("Account deleted.", "info", 3000);
        // Auth state listener in boot() will fire _showAuth() automatically
        eventBus.emit("nav:showAuth");
      } else {
        submitBtn.disabled = false;
        submitBtn.textContent = "Delete Account";
        errorDiv.textContent = res.error || "Something went wrong. Please try again.";
      }
    });
  }

  // ── Performance Board (live Firestore) ───────────────────────────────
  async _pageLeaderboards(canvas) {
    const me     = getUser();
    const accent = ACCENT[this.currentLang] || "#8b7cff";
    let   mode   = "alltime";
    let   lang   = null;
    let   unsubLb = null;
    const STAGES     = ["Starter","Beginner","Explorer","Speaker","Scholar","Specialist","Archivist"];
    const LANG_SHORT = { japanese:"JP", korean:"KO", spanish:"ES" };
    const GRID_COLS  = "36px 1fr 88px 68px 104px 86px";

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
        const rank      = idx + 1;
        const isMe      = u.uid === me?.uid;
        const xpVal     = mode === "weekly" ? (u.weeklyXp || 0) : (u.xp || 0);
        const name      = u.username || u.email?.split("@")[0] || "Learner";
        const init      = name[0]?.toUpperCase() || "?";
        const ua        = ACCENT[u.currentLanguage] || accent;
        const isTop3    = rank <= 3;
        const mc        = rank === 1 ? "#fbbf24" : rank === 2 ? "#94a3b8" : rank === 3 ? "#cd7c2f" : null;
        const mPct      = Math.round(u.momentum?.score ?? 0);
        const mColor    = mPct >= 60 ? "#4ade80" : mPct >= 30 ? "var(--text-secondary)" : "var(--text-muted)";
        const stageName = STAGES[u.stageUnlocked || 0] || "Starter";
        const langShort = LANG_SHORT[u.currentLanguage] || "—";
        const rankCell  = mc
          ? `<div class="lb-rank-medal" style="color:${mc};">${rank}</div>`
          : `<div class="lb-rank-num">${rank}</div>`;
        const avatarImg = (u.avatar_url || u.photoURL)
          ? `<img src="${u.avatar_url||u.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none'"/>`
          : `<span style="font-size:0.74rem;font-weight:600;color:${ua};">${init}</span>`;
        return `<div class="lb-row${isTop3?" lb-row--top3":""}${isMe?" lb-row--me":""}"
            data-uid="${u.uid}"
            style="border-bottom:1px solid var(--border-subtle);border-left:3px solid ${isTop3?mc:"transparent"};display:grid;grid-template-columns:${GRID_COLS};gap:8px;align-items:center;padding:12px 20px 12px 17px;background:${isMe?`${ua}0d`:"transparent"};cursor:${isMe?"default":"pointer"};transition:background 0.15s;">
          ${rankCell}
          <div style="display:flex;align-items:center;gap:9px;min-width:0;" class="lb-identity">
            <div style="position:relative;flex-shrink:0;">
              <div style="width:30px;height:30px;border-radius:50%;background:${ua}18;border:2px solid ${ua}55;display:flex;align-items:center;justify-content:center;overflow:hidden;">${avatarImg}</div>
              ${isUserOnline(u) ? `<div style="position:absolute;bottom:0;right:0;width:8px;height:8px;border-radius:50%;background:#4ade80;border:1.5px solid var(--bg-surface);"></div>` : ""}
            </div>
            <div style="min-width:0;">
              <div style="font-size:0.87rem;font-weight:${isMe?600:400};color:${isMe?ua:"var(--text-primary)"};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}${isMe?` <span style="font-size:0.72rem;color:${ua};opacity:0.7;">(you)</span>`:""}</div>
              <div style="display:flex;align-items:center;gap:5px;margin-top:2px;">
                ${isUserOnline(u)
                  ? `<span style="font-size:0.62rem;color:#4ade80;">online</span>`
                  : u.lastSeenAt
                    ? `<span style="font-size:0.62rem;color:var(--text-muted);">${timeAgo(u.lastSeenAt)}</span>`
                    : ""}
                <span class="lb-lang-chip" style="color:${ua};border-color:${ua}30;background:${ua}0e;">${langShort}</span>
              </div>
            </div>
          </div>
          <div style="font-family:var(--font-mono);font-size:0.87rem;color:${ua};text-align:right;">${xpVal.toLocaleString()}</div>
          <div style="font-size:0.82rem;font-family:var(--font-mono);color:${mColor};text-align:right;">${mPct}%</div>
          <div><span class="lb-stage-chip" style="color:${ua};border-color:${ua}28;background:${ua}0a;">${stageName}</span></div>
          <div style="display:flex;justify-content:flex-end;">
            ${!isMe && me && !isGuest?.() ? `<button class="btn btn-sm btn-ghost lb-add-friend" data-uid="${u.uid}" style="font-size:0.7rem;padding:4px 10px;">+ Friend</button>` : `<div></div>`}
          </div>
        </div>`;
      }).join("");

      // Row click → public profile (skip for own row and friend button)
      body.querySelectorAll(".lb-row:not(.lb-row--me)").forEach(row => {
        row.addEventListener("click", e => {
          if (e.target.closest(".lb-add-friend")) return;
          const uid = row.dataset.uid;
          if (uid) this._pagePublicProfile(canvas, uid);
        });
        row.addEventListener("mouseenter", () => { row.style.background = "var(--bg-hover)"; });
        row.addEventListener("mouseleave", () => {
          const uid = row.dataset.uid;
          const isMe2 = uid === me?.uid;
          const ua2 = ACCENT[(rows.find(r=>r.uid===uid)||{}).currentLanguage] || accent;
          row.style.background = isMe2 ? `${ua2}0d` : "transparent";
        });
      });

      body.querySelectorAll(".lb-add-friend").forEach(btn => {
        // Check existing friend status and update button label
        (async () => {
          try {
            const status = await getFriendStatus(btn.dataset.uid);
            if (!btn.isConnected) return;
            if (status === "accepted") {
              btn.textContent = "Friends"; btn.disabled = true;
              btn.style.color = "#4ade80"; btn.style.borderColor = "rgba(74,222,128,0.3)";
            } else if (status === "pending_sent") {
              btn.textContent = "Sent"; btn.disabled = true;
            } else if (status === "pending_received") {
              btn.textContent = "Accept"; btn.style.color = accent; btn.style.borderColor = accent + "60";
            }
          } catch (_) {}
        })();
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
      <p class="section-subtitle">Click any learner to view their profile</p>
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
    <div class="lb-col-header" style="grid-template-columns:${GRID_COLS};">
      <div>#</div><div>Learner</div><div style="text-align:right;">XP</div><div style="text-align:right;">Flow</div><div>Stage</div><div></div>
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
    const mPct   = Math.round(u.momentum?.score ?? 0);

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
          <div style="font-size:0.75rem;color:${isUserOnline(u)?"#4ade80":"var(--text-muted)"};margin-bottom:12px;">${isUserOnline(u)?"● Online now":"Offline"}</div>
          <!-- Stats row -->
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;">
            ${[
              {v:xp.toLocaleString(), l:"XP"},
              {v:"Lv."+level, l:"Level"},
              {v:mPct+"%", l:"Momentum"},
              {v:stage, l:"Stage"},
            ].map(s=>`<div style="background:var(--bg-hover);border-radius:8px;padding:10px 6px;text-align:center;">
              <div style="font-size:0.88rem;font-weight:600;font-family:var(--font-mono);color:var(--text-primary);">${s.v}</div>
              <div style="font-size:0.6rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;">${s.l}</div>
            </div>`).join("")}
          </div>
          ${langBars ? `<div style="margin-bottom:12px;border-top:1px solid var(--border-subtle);padding-top:10px;"><div style="font-size:0.6rem;color:var(--text-muted);font-family:var(--font-mono);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">Languages</div>${langBars}</div>` : ""}
        </div>
        <!-- Actions -->
        <div style="padding:14px 24px 20px;display:flex;gap:8px;flex-wrap:wrap;">
          <button id="uc-friend-btn" class="btn btn-primary" style="flex:1;${btnStyle}" ${status==="pending_sent"||status==="accepted"?"disabled":""}>${btnLabel}</button>
          <button id="uc-view-profile" class="btn btn-ghost" style="white-space:nowrap;">View Profile →</button>
          <button id="uc-close2" class="btn btn-ghost">Close</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.addEventListener("click", e => { if(e.target===modal) close(); });
    modal.querySelector("#uc-close").addEventListener("click", close);
    modal.querySelector("#uc-close2").addEventListener("click", close);
    modal.querySelector("#uc-view-profile").addEventListener("click", () => {
      close();
      this._pagePublicProfile(canvas, uid);
    });
    modal.querySelector("#uc-friend-btn").addEventListener("click", async () => {
      const btn = modal.querySelector("#uc-friend-btn");
      if (status === "accepted") return;
      if (status === "pending_received") {
        btn.textContent = "Accepting…"; btn.disabled = true;
        const res = await acceptFriendRequest(uid);
        if (res.ok) { showToast("Friends!", "success"); close(); }
        else showToast("Failed: " + res.error, "error");
      } else {
        btn.textContent = "Sending…"; btn.disabled = true;
        const res = await sendFriendRequest(uid);
        if (res.ok) { btn.textContent = "Request Sent"; showToast("Friend request sent!", "success"); }
        else { btn.disabled = false; btn.textContent = "+ Add Friend"; showToast("Failed: " + res.error, "error"); }
      }
    });
  }

  // ── Public profile (read-only view for any user by UID) ──────────
  async _pagePublicProfile(canvas, uid) {
    const db          = getDb();
    const me          = getUser();
    const accent      = ACCENT[this.currentLang] || "#8b7cff";
    const STAGE_NAMES = ["Starter","Beginner","Explorer","Speaker","Scholar","Specialist","Archivist"];
    const TIER_COLORS = { bronze:"#cd7c2f", silver:"#94a3b8", gold:"#fbbf24", platinum:"#a78bfa" };

    const timeAgo = iso => {
      if (!iso) return "a while ago";
      const s = (Date.now() - new Date(iso)) / 1000;
      if (s < 120)   return "just now";
      if (s < 3600)  return Math.floor(s/60) + "m ago";
      if (s < 86400) return Math.floor(s/3600) + "h ago";
      return Math.floor(s/86400) + "d ago";
    };

    canvas.innerHTML = `<div class="canvas-content page-enter"><div style="padding:60px;text-align:center;color:var(--text-muted);font-size:0.88rem;font-family:var(--font-mono);">Loading profile…</div></div>`;

    if (!db) {
      canvas.innerHTML = `<div class="canvas-content page-enter"><div style="padding:60px;text-align:center;color:var(--text-muted);">Profile unavailable in offline mode.</div></div>`;
      return;
    }

    const snap = await db.collection("users").doc(uid).get().catch(() => null);
    if (!snap?.exists) {
      canvas.innerHTML = `<div class="canvas-content page-enter"><div style="padding:60px;text-align:center;color:var(--text-muted);">Profile not found.</div></div>`;
      return;
    }

    const u     = { uid, ...snap.data() };
    const ua    = ACCENT[u.currentLanguage] || accent;
    const name  = u.username || "Learner";
    const xp    = u.xp || 0;
    const level = Math.floor(xp / 200) + 1;
    const mPct  = Math.round(u.momentum?.score ?? 0);
    const stage = STAGE_NAMES[u.stageUnlocked || 0] || "Starter";

    // Try to fetch profile doc for seals / trophies / title
    let profDoc = null;
    try {
      const pSnap = await db.collection("profiles").doc(uid).get();
      if (pSnap.exists) profDoc = pSnap.data();
    } catch (_) {}

    const titlePrefix = profDoc?.identity?.titlePrefix ? `${profDoc.identity.titlePrefix} ` : "";

    // Language progress cards
    const langs     = ["japanese","korean","spanish"];
    const langCards = langs.map(l => {
      const lxp  = u[`xp_${l}`] || (u.currentLanguage === l ? xp : 0);
      if (!lxp) return "";
      const llv  = Math.floor(lxp / 200) + 1;
      const la   = ACCENT[l];
      const lstg = u[`stage_${l}`] || (u.currentLanguage === l ? (u.stageUnlocked || 0) : 0);
      const stgPct = Math.round((lstg / 6) * 100);
      return `
        <div class="prof-lang-card">
          <div class="prof-lang-accent-bar" style="background:${la};"></div>
          <div class="prof-lang-body">
            <div class="prof-lang-name" style="color:${la};">${LABEL[l] || l}</div>
            <div class="prof-lang-meta">
              <span style="color:${la};">${lxp.toLocaleString()} XP</span>
              <span class="prof-lang-sep">·</span>
              <span>Lv.${llv}</span>
              <span class="prof-lang-sep">·</span>
              <span>${STAGE_NAMES[lstg] || "Starter"}</span>
            </div>
            <div class="prof-lang-bar-track">
              <div class="prof-lang-bar-fill" style="width:${stgPct}%;background:${la};"></div>
            </div>
          </div>
        </div>`;
    }).filter(Boolean).join("");

    // Seals from profile doc
    const allSeals   = profDoc?.seals || {};
    const sealGroups = langs.map(l => {
      const s = allSeals[l] || [];
      if (!s.length) return "";
      return `
        <div class="prof-seals-lang-group">
          <div class="prof-seals-lang-label" style="color:${ACCENT[l]};">${LABEL[l] || l}</div>
          <div class="prof-seals-row">${s.map(sk => `<div style="opacity:0.9;">${renderSeal(sk, 28, true)}</div>`).join("")}</div>
        </div>`;
    }).filter(Boolean).join("");

    // Trophies from profile doc (stored as earned IDs)
    const earnedIds = profDoc?.trophies?.earned || [];
    const pinnedIds = profDoc?.trophies?.pinned || [];

    canvas.innerHTML = `
<div class="canvas-content page-enter">

  <button id="pub-back-btn" class="btn btn-ghost btn-sm" style="margin-bottom:18px;display:inline-flex;align-items:center;gap:6px;font-size:0.82rem;">← Back to Board</button>

  <!-- Profile header -->
  <div class="prof-header-card">
    <div class="prof-header-banner" style="background:linear-gradient(135deg,${ua}28,${ua}08);"></div>
    <div class="prof-header-body">
      <div class="prof-avatar-wrap" style="pointer-events:none;">
        <div class="prof-avatar-inner" style="background:${ua}20;border:2px solid ${ua}40;color:${ua};font-family:var(--font-display);">
          ${u.photoURL ? `<img src="${u.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none'"/>` : name[0]?.toUpperCase()}
        </div>
      </div>
      <div class="prof-header-identity">
        <div class="prof-display-name">${titlePrefix}${name}</div>
        <div style="font-size:0.78rem;color:${isUserOnline(u) ? "#4ade80" : "var(--text-muted)"};">
          ${isUserOnline(u) ? "● Online now" : (u.lastSeenAt ? "Last seen " + timeAgo(u.lastSeenAt) : "Offline")}
        </div>
      </div>
      <div class="prof-header-actions">
        ${me && me.uid !== uid && !isGuest?.() ? `<button id="pub-friend-btn" class="btn btn-sm btn-primary">+ Friend</button>` : ""}
      </div>
    </div>
  </div>

  <!-- Body -->
  <div class="prof-body-grid">

    <!-- Left: stat panel -->
    <div class="prof-left-col card">
      <div class="prof-stat-cluster">
        <div class="prof-stat-cell">
          <span class="prof-stat-value">${xp.toLocaleString()}</span>
          <span class="prof-stat-label">XP</span>
        </div>
        <div class="prof-stat-cell">
          <span class="prof-stat-value">${level}</span>
          <span class="prof-stat-label">Level</span>
        </div>
        <div class="prof-stat-cell">
          <span class="prof-stat-value">${mPct}<span style="font-size:0.7em;opacity:0.7;">%</span></span>
          <span class="prof-stat-label">Momentum</span>
        </div>
      </div>
      <div class="prof-stat-cluster" style="margin-top:4px;">
        <div class="prof-stat-cell" style="grid-column:1/-1;">
          <span class="prof-stat-value" style="font-size:0.95rem;">${stage}</span>
          <span class="prof-stat-label">Current Stage</span>
        </div>
      </div>
    </div>

    <!-- Right: achievements + language progress -->
    <div class="prof-right-col">

      ${earnedIds.length ? `
      <div class="prof-achievement-section card">
        <div class="prof-section-eyebrow">Trophies · ${earnedIds.length} earned</div>
        <div class="prof-trophy-grid">
          ${earnedIds.slice(0, 6).map(tid => {
            const isPinned = pinnedIds.includes(tid);
            return `<div class="prof-trophy-cell" title="${tid.replace(/_/g," ")}">
              <div class="prof-trophy-icon" style="color:${TIER_COLORS.gold};border-color:${TIER_COLORS.gold}30;background:${TIER_COLORS.gold}10;">🏆</div>
              <div class="prof-trophy-name">${tid.replace(/_/g," ")}</div>
              ${isPinned ? `<div class="prof-trophy-tier" style="color:${TIER_COLORS.gold};">📌</div>` : ""}
            </div>`;
          }).join("")}
        </div>
        ${earnedIds.length > 6 ? `<div class="prof-trophy-count">+${earnedIds.length - 6} more</div>` : ""}
      </div>` : ""}

      ${sealGroups ? `
      <div class="prof-achievement-section card">
        <div class="prof-section-eyebrow">Seals</div>
        <div class="prof-seals-board">${sealGroups}</div>
      </div>` : ""}

      <div class="prof-achievement-section card">
        <div class="prof-section-eyebrow">Language Progress</div>
        <div class="prof-lang-progress-list">
          ${langCards || `<div style="font-size:0.82rem;color:var(--text-muted);padding:8px 0;">No language data available.</div>`}
        </div>
      </div>

    </div>
  </div>

</div>`;

    canvas.querySelector("#pub-back-btn")?.addEventListener("click", () => this._onLeftNav("leaderboards"));

    const friendBtn = canvas.querySelector("#pub-friend-btn");
    if (friendBtn) {
      getFriendStatus(uid).then(status => {
        if (!friendBtn.isConnected) return;
        if (status === "accepted")         { friendBtn.textContent = "Friends ✓"; friendBtn.disabled = true; friendBtn.style.color = "#4ade80"; }
        else if (status === "pending_sent")     { friendBtn.textContent = "Request Sent"; friendBtn.disabled = true; }
        else if (status === "pending_received") { friendBtn.textContent = "Accept Request"; }
      }).catch(() => {});
      friendBtn.addEventListener("click", async () => {
        const isAccept = friendBtn.textContent === "Accept Request";
        friendBtn.disabled = true;
        friendBtn.textContent = isAccept ? "Accepting…" : "Sending…";
        const res = isAccept ? await acceptFriendRequest(uid) : await sendFriendRequest(uid);
        if (res.ok) {
          friendBtn.textContent = isAccept ? "Friends ✓" : "Sent ✓";
          if (isAccept) friendBtn.style.color = "#4ade80";
          showToast(isAccept ? "Friends!" : "Friend request sent!", "success");
        } else {
          friendBtn.disabled = false;
          friendBtn.textContent = isAccept ? "Accept Request" : "+ Friend";
          showToast(res.error || "Failed", "error");
        }
      });
    }
  }

  // ── Friends page ───────────────────────────────────────────────────
  async _pageFriends(canvas) {
    const me     = getUser();
    const accent = ACCENT[this.currentLang] || "#8b7cff";
    let   searchTimeout = null;
    let   unsubOnline   = null;
    const LANG_SHORT = { japanese:"JP", korean:"KO", spanish:"ES" };
    const STAGES     = ["Starter","Beginner","Explorer","Speaker","Scholar","Specialist","Archivist"];

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
      const friends  = await loadFriends();
      const incoming = friends.filter(f => f.status === "pending" && f.initiator !== me?.uid);
      const outgoing = friends.filter(f => f.status === "pending" && f.initiator === me?.uid);
      const accepted = friends.filter(f => f.status === "accepted");

      // Sort accepted: online first, then by lastSeenAt descending
      accepted.sort((a, b) => {
        const aOn = isUserOnline(a.profile) ? 1 : 0;
        const bOn = isUserOnline(b.profile) ? 1 : 0;
        if (aOn !== bOn) return bOn - aOn;
        const aT = a.profile.lastSeenAt ? new Date(a.profile.lastSeenAt).getTime() : 0;
        const bT = b.profile.lastSeenAt ? new Date(b.profile.lastSeenAt).getTime() : 0;
        return bT - aT;
      });

      if (!friends.length) {
        list.innerHTML = `<div class="fr-empty-state">No friends yet — find learners using the search above, or click any row on the Performance Board.</div>`;
        return;
      }

      let html = "";

      // ── Incoming requests ───────────────────────────────────────────
      if (incoming.length) {
        html += `<div class="fr-section-label">Incoming (${incoming.length})</div>`;
        html += incoming.map(f => {
          const p    = f.profile;
          const fa   = ACCENT[p.currentLanguage] || accent;
          const n    = p.username || "Learner";
          const langS = LANG_SHORT[p.currentLanguage] || "";
          const avatarInner = (p.avatar_url || p.photoURL)
            ? `<img src="${p.avatar_url||p.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none'"/>`
            : `<span style="font-size:0.85rem;font-weight:600;color:${fa};">${n[0].toUpperCase()}</span>`;
          return `<div class="fr-pending-card" style="border-left:3px solid ${fa};">
            <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
              <div style="position:relative;flex-shrink:0;">
                <div class="fr-avatar" style="background:${fa}18;border-color:${fa}55;">${avatarInner}</div>
                ${isUserOnline(p) ? `<div class="fr-online-dot"></div>` : ""}
              </div>
              <div style="min-width:0;">
                <div class="fr-name">${n}</div>
                <div style="font-size:0.7rem;color:var(--text-muted);display:flex;align-items:center;gap:5px;">
                  sent you a request
                  ${langS ? `<span class="lb-lang-chip" style="color:${fa};border-color:${fa}30;background:${fa}0e;">${langS}</span>` : ""}
                </div>
              </div>
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0;">
              <button class="btn btn-sm btn-primary accept-req" data-uid="${p.uid}">Accept</button>
              <button class="btn btn-sm btn-ghost decline-req" data-uid="${p.uid}">Decline</button>
            </div>
          </div>`;
        }).join("");
      }

      // ── Outgoing pending ────────────────────────────────────────────
      if (outgoing.length) {
        html += `<div class="fr-section-label" style="margin-top:${incoming.length ? "18px" : "0"};">Sent (${outgoing.length})</div>`;
        html += outgoing.map(f => {
          const p  = f.profile;
          const fa = ACCENT[p.currentLanguage] || accent;
          const n  = p.username || "Learner";
          const avatarInner = (p.avatar_url || p.photoURL)
            ? `<img src="${p.avatar_url||p.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none'"/>`
            : `<span style="font-size:0.85rem;font-weight:600;color:${fa};">${n[0].toUpperCase()}</span>`;
          return `<div class="fr-pending-card" style="border-left:3px solid var(--border-subtle);opacity:0.72;">
            <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
              <div class="fr-avatar" style="background:${fa}18;border-color:${fa}40;">${avatarInner}</div>
              <div style="min-width:0;">
                <div class="fr-name">${n}</div>
                <div style="font-size:0.7rem;color:var(--text-muted);">request pending</div>
              </div>
            </div>
            <button class="btn btn-sm btn-ghost cancel-req" data-uid="${p.uid}" style="font-size:0.7rem;flex-shrink:0;">Cancel</button>
          </div>`;
        }).join("");
      }

      // ── Accepted friends ────────────────────────────────────────────
      if (accepted.length) {
        const hasPending = incoming.length || outgoing.length;
        html += `<div class="fr-section-label" style="margin-top:${hasPending ? "22px" : "0"};">Friends (${accepted.length})</div>`;
        html += accepted.map(f => {
          const p      = f.profile;
          const fa     = ACCENT[p.currentLanguage] || accent;
          const n      = p.username || "Learner";
          const mPct   = Math.round(p.momentum?.score ?? 0);
          const mColor = mPct >= 60 ? "#4ade80" : mPct >= 30 ? "var(--text-secondary)" : "var(--text-muted)";
          const langS  = LANG_SHORT[p.currentLanguage] || "";
          const stage  = STAGES[p.stageUnlocked || 0] || "Starter";
          const online = isUserOnline(p);
          const avatarInner = (p.avatar_url || p.photoURL)
            ? `<img src="${p.avatar_url||p.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none'"/>`
            : `<span style="font-size:0.9rem;font-weight:600;color:${fa};">${n[0].toUpperCase()}</span>`;
          return `<div class="fr-row" data-uid="${p.uid}">
            <div style="position:relative;flex-shrink:0;">
              <div class="fr-avatar fr-avatar--lg" style="background:${fa}18;border-color:${fa}55;">${avatarInner}</div>
              ${online ? `<div class="fr-online-dot"></div>` : ""}
            </div>
            <div style="flex:1;min-width:0;">
              <div class="fr-name">${n}</div>
              <div style="display:flex;align-items:center;gap:5px;margin-top:2px;flex-wrap:wrap;">
                ${online
                  ? `<span style="font-size:0.62rem;color:#4ade80;">online</span>`
                  : p.lastSeenAt
                    ? `<span style="font-size:0.62rem;color:var(--text-muted);">${timeAgo(p.lastSeenAt)}</span>`
                    : ""}
                ${langS ? `<span class="lb-lang-chip" style="color:${fa};border-color:${fa}30;background:${fa}0e;">${langS}</span>` : ""}
                <span class="fr-stage-chip">${stage}</span>
              </div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
              <div style="font-size:0.82rem;font-family:var(--font-mono);color:${fa};">${(p.xp||0).toLocaleString()} <span style="font-size:0.68rem;color:var(--text-muted);">XP</span></div>
              <div style="font-size:0.72rem;font-family:var(--font-mono);color:${mColor};">${mPct}%</div>
            </div>
            <button class="btn btn-sm btn-ghost remove-friend" data-uid="${p.uid}" title="Remove friend" style="flex-shrink:0;opacity:0.4;font-size:0.75rem;padding:4px 7px;">✕</button>
          </div>`;
        }).join("");
      }

      list.innerHTML = html;

      // Accept incoming
      list.querySelectorAll(".accept-req").forEach(btn => btn.addEventListener("click", async () => {
        btn.disabled = true; btn.textContent = "…";
        const res = await acceptFriendRequest(btn.dataset.uid);
        if (res.ok) { showToast("Friends!", "success"); renderFriends(); }
        else showToast(res.error || "Failed", "error");
      }));

      // Decline incoming
      list.querySelectorAll(".decline-req").forEach(btn => btn.addEventListener("click", async () => {
        btn.disabled = true; btn.textContent = "…";
        await removeFriend(btn.dataset.uid);
        renderFriends();
      }));

      // Cancel outgoing
      list.querySelectorAll(".cancel-req").forEach(btn => btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        btn.disabled = true; btn.textContent = "…";
        await removeFriend(btn.dataset.uid);
        renderFriends();
      }));

      // Friend row click → public profile
      list.querySelectorAll(".fr-row").forEach(row => {
        row.addEventListener("click", e => {
          if (e.target.closest(".remove-friend")) return;
          const uid = row.dataset.uid;
          if (uid) this._pagePublicProfile(canvas, uid);
        });
      });

      // Remove friend
      list.querySelectorAll(".remove-friend").forEach(btn => btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        btn.disabled = true;
        const res = await removeFriend(btn.dataset.uid);
        if (res.ok) { showToast("Removed", "info"); renderFriends(); }
        else { btn.disabled = false; showToast(res.error || "Failed", "error"); }
      }));
    };

    const doSearch = async (q) => {
      const res = canvas.querySelector("#search-results");
      if (!res) return;
      if (!q.trim()) { res.innerHTML = ""; return; }
      res.innerHTML = `<div style="padding:10px 0;color:var(--text-muted);font-size:0.82rem;font-family:var(--font-mono);">Searching…</div>`;
      const users = await searchUsers(q);
      if (!users.length) {
        res.innerHTML = `<div style="padding:10px 0;color:var(--text-muted);font-size:0.85rem;">No learners found for "${q}"</div>`;
        return;
      }
      res.innerHTML = users.map(u => {
        const ua    = ACCENT[u.currentLanguage] || accent;
        const n     = u.username || "Learner";
        const mPct  = Math.round(u.momentum?.score ?? 0);
        const langS = LANG_SHORT[u.currentLanguage] || "";
        const stage = STAGES[u.stageUnlocked || 0] || "Starter";
        const avatarInner = (u.avatar_url || u.photoURL)
          ? `<img src="${u.avatar_url||u.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none'"/>`
          : `<span style="font-size:0.8rem;font-weight:600;color:${ua};">${n[0].toUpperCase()}</span>`;
        const isMe = u.uid === me?.uid;
        return `<div class="fr-search-result${isMe ? " fr-search-result--me" : ""}" data-uid="${u.uid}">
          <div style="position:relative;flex-shrink:0;">
            <div class="fr-avatar" style="background:${ua}18;border-color:${ua}50;">${avatarInner}</div>
            ${isUserOnline(u) ? `<div class="fr-online-dot"></div>` : ""}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:0.88rem;font-weight:500;color:var(--text-primary);">${n}${isMe ? ` <span style="font-size:0.68rem;color:var(--text-muted);">(you)</span>` : ""}</div>
            <div style="display:flex;align-items:center;gap:5px;margin-top:2px;flex-wrap:wrap;">
              ${isUserOnline(u) ? `<span style="font-size:0.62rem;color:#4ade80;">online</span>` : ""}
              ${langS ? `<span class="lb-lang-chip" style="color:${ua};border-color:${ua}30;background:${ua}0e;">${langS}</span>` : ""}
              <span style="font-size:0.68rem;color:var(--text-muted);">${stage}</span>
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0;margin-right:${isMe ? "0" : "8px"};">
            <div style="font-size:0.78rem;font-family:var(--font-mono);color:${ua};">${(u.xp||0).toLocaleString()} XP</div>
            <div style="font-size:0.68rem;color:var(--text-muted);">${mPct}%</div>
          </div>
          ${!isMe ? `<button class="btn btn-sm btn-primary add-friend-btn" data-uid="${u.uid}">+ Add</button>` : ""}
        </div>`;
      }).join("");

      // Search result row → public profile
      res.querySelectorAll(".fr-search-result:not(.fr-search-result--me)").forEach(row => {
        row.addEventListener("click", e => {
          if (e.target.closest(".add-friend-btn")) return;
          const uid = row.dataset.uid;
          if (uid) this._pagePublicProfile(canvas, uid);
        });
      });

      res.querySelectorAll(".add-friend-btn").forEach(btn => btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        btn.disabled = true; btn.textContent = "Sending…";
        const result = await sendFriendRequest(btn.dataset.uid);
        if (result.ok) { btn.textContent = "Sent ✓"; showToast("Friend request sent!", "success"); }
        else { btn.disabled = false; btn.textContent = "+ Add"; showToast(result.error || "Failed", "error"); }
      }));
    };

    canvas.innerHTML = `
<div class="canvas-content page-enter">
  <div class="section-header">
    <div>
      <h2 class="section-title">Friends</h2>
      <p class="section-subtitle">Your study network — click any friend to view their profile</p>
    </div>
  </div>

  <div class="card-elevated fr-search-card">
    <div class="fr-section-label" style="margin-bottom:10px;">Find Learners</div>
    <input id="friend-search" class="input" placeholder="Search by username…" style="width:100%;font-size:0.9rem;" autocomplete="off" spellcheck="false" />
    <div id="search-results" style="margin-top:6px;"></div>
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
            <span style="font-size:0.68rem;padding:2px 7px;border-radius:4px;background:${cat.color}18;color:${cat.color};font-family:var(--font-mono);display:inline-flex;align-items:center;gap:6px;">
              ${_plazaIconSvg(cat.icon, cat.color)} ${cat.label}
            </span>
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
              <span style="font-size:0.72rem;color:var(--text-muted);font-family:var(--font-mono);display:inline-flex;align-items:center;gap:6px;">
                ${_uiIconSvg("chat", 14, "currentColor")}
                ${p.replyCount||0}
              </span>
              ${isMyPost ? `<button class="plaza-delete-post btn btn-sm btn-ghost" data-post-id="${p.id}" aria-label="Delete post" title="Delete" style="color:var(--text-muted);display:inline-flex;align-items:center;justify-content:center;">${_uiIconSvg("trash", 14, "currentColor")}</button>` : ""}
              <button class="btn btn-sm btn-ghost plaza-open" data-post-id="${p.id}">View →</button>
            </div>
          </div>
        </div>`;
      }).join("");

      list.querySelectorAll(".plaza-like").forEach(btn => btn.addEventListener("click", async e => {
        e.stopPropagation();
        if (!me || isGuest?.()) { showToast("Sign in to like posts","info"); return; }
        const r = await toggleLike(btn.dataset.postId);
        if (r.ok) showToast(r.liked ? "Liked" : "Unliked","info",1500);
      }));

      list.querySelectorAll(".plaza-delete-post").forEach(btn => btn.addEventListener("click", async e => {
        e.stopPropagation();
        if (!confirm("Delete this post and all its replies?")) return;
        btn.textContent = "…"; btn.disabled = true;
        const res = await deletePlazaPost(btn.dataset.postId);
        if (!res.ok) { showToast(res.error || "Failed to delete", "error"); btn.innerHTML = _uiIconSvg("trash", 14, "currentColor"); btn.disabled = false; }
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
            ${isMyPost ? `<button id="delete-post-btn" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:0.75rem;font-family:var(--font-mono);padding:4px 8px;border-radius:4px;transition:color 0.15s;display:inline-flex;align-items:center;gap:8px;" title="Delete post" aria-label="Delete post">${_uiIconSvg("trash", 14, "currentColor")} Delete</button>` : ""}
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
                ${isMyReply ? `<button class="delete-reply-btn" data-reply-id="${r.id}" style="background:none;border:none;cursor:pointer;color:var(--text-muted);padding:0 4px;display:inline-flex;align-items:center;justify-content:center;" title="Delete reply" aria-label="Delete reply">${_uiIconSvg("trash", 14, "currentColor")}</button>` : ""}
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
        const review = _filterContent(body);
        if (review.blocked) { showToast(review.reason || "That content violates community guidelines.", "error"); return; }
        const { clean } = review;
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
            <h3 style="font-family:var(--font-display);font-size:1rem;font-weight:400;flex:1;color:var(--text-primary);">Post to Plaza</h3>
            <button id="close-form" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:1.3rem;line-height:1;">×</button>
          </div>
          <div style="padding:20px;display:flex;flex-direction:column;gap:14px;">
            <div>
              <label style="font-size:0.65rem;color:var(--text-muted);font-family:var(--font-mono);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px;">Category</label>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                ${PLAZA_CATEGORIES.map(c => `<button class="select-pill np-cat${c.id==="question"?" active":""}" data-c="${c.id}" style="color:${c.color};display:inline-flex;align-items:center;gap:6px;">${_plazaIconSvg(c.icon, c.color)} ${c.label}</button>`).join("")}
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
              <textarea id="np-q" class="input" placeholder="Ask for help, share a tip, or post a clean text-only joke. No links, no cursing, no NSFW content." style="width:100%;height:90px;resize:vertical;font-size:0.88rem;line-height:1.5;"></textarea>
            </div>
            <div>
              <label style="font-size:0.65rem;color:var(--text-muted);font-family:var(--font-mono);text-transform:uppercase;letter-spacing:0.1em;display:block;margin-bottom:6px;">Tags (comma separated, optional)</label>
              <input id="np-tags" class="input" placeholder="Grammar, Vocabulary…" style="font-size:0.87rem;width:100%;" />
            </div>
            <div style="font-size:0.75rem;color:var(--text-muted);line-height:1.6;padding:10px 12px;border:1px dashed var(--border-subtle);border-radius:10px;background:var(--bg-panel);">Plaza is text-first and tightly moderated. No links, no cursing, no NSFW content, no contact-sharing, and no loophole games.</div>
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
        const tags = (modal.querySelector("#np-tags")?.value||"").split(",").map(t=>t.trim()).filter(Boolean).map(t => t.replace(/[^a-z0-9\- ]/gi, "").slice(0, 24)).filter(Boolean).slice(0, 5);
        const err  = modal.querySelector("#np-err");
        if (!q) { err.style.display="block"; err.textContent="Please enter a post."; return; }
        if (!selLang) { err.style.display="block"; err.textContent="Please select a language."; return; }
        err.style.display = "none";
        modal.querySelector("#np-submit").textContent = "Posting…";
        modal.querySelector("#np-submit").disabled    = true;
        // Profanity check
        const review = _filterContent(q);
        if (review.blocked) { err.style.display="block"; err.textContent = review.reason || "That content violates our community guidelines."; modal.querySelector("#np-submit").disabled=false; modal.querySelector("#np-submit").textContent="Publish Post"; return; }
        const { clean: cleanQ } = review;
        const res = await createPlazaPost({ question: cleanQ, lang: selLang, tags, category: selCategory });
        if (res.ok) { modal.remove(); showToast("Plaza post published.","success"); }
        else {
          const msg = (res.error || "").toLowerCase().includes("permission")
            ? "Firestore rules not deployed yet. Go to Firebase Console → Firestore → Rules and publish the rules from firestore.rules."
            : res.error || "Failed to post.";
          err.style.display="block";
          err.textContent = msg;
          modal.querySelector("#np-submit").disabled=false;
          modal.querySelector("#np-submit").textContent="Publish Post";
        }
      });
    };

    canvas.innerHTML = `
<div class="canvas-content page-enter">
  <div class="section-header">
    <div>
      <h2 class="section-title">The Plaza</h2>
      <p class="section-subtitle">Text-first help board · clean questions, tips, and safe humor only</p>
    </div>
    ${me && !isGuest?.() ? `<button id="plaza-post-btn" class="btn btn-primary">+ Ask Question</button>` : ""}
  </div>
  <div style="font-size:0.74rem;color:var(--text-muted);line-height:1.6;margin-bottom:12px;max-width:760px;">No links, no cursing, no NSFW content, and no contact-sharing. Plaza is for help, clean memes, tips, and useful discussion.</div>
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
  async _pageSettings(canvas) {
    const user   = getUser();
    const accent = ACCENT[this.currentLang] || "#8b7cff";
    const prefs  = JSON.parse(localStorage.getItem("vaultia_prefs") || "{}");

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

    const isCloud          = !user?._isGuest && !user?._isLocal;
    const accountTypeLabel = user?._isGuest ? "Guest" : user?._isLocal ? "Local" : "Cloud";
    const accountTypeStyle = isCloud
      ? "background:rgba(74,222,128,0.1);color:#4ade80;border:1px solid rgba(74,222,128,0.2);"
      : "background:var(--bg-glass);color:var(--text-muted);border:1px solid var(--border-subtle);";
    const avatarSrc  = user?._avatarUrl || user?.photoURL;
    const initials   = (user?.displayName || user?.email || "?")[0].toUpperCase();

    canvas.innerHTML = `
<div class="canvas-content page-enter" style="max-width:560px;">
  <div class="section-header">
    <h2 class="section-title">Settings</h2>
  </div>

  <!-- Account strip -->
  <div class="card-elevated acct-strip">
    <div style="display:flex;align-items:center;gap:14px;">
      <div style="width:44px;height:44px;border-radius:50%;background:${accent}18;border:2px solid ${accent}40;display:flex;align-items:center;justify-content:center;font-size:1rem;font-weight:600;color:${accent};overflow:hidden;flex-shrink:0;">
        ${avatarSrc ? `<img src="${avatarSrc}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'"/>` : initials}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:0.92rem;font-weight:500;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${user?.displayName || "Learner"}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${user?.email || "No email"}</div>
      </div>
      <span style="font-size:0.65rem;font-family:var(--font-mono);padding:3px 8px;border-radius:5px;flex-shrink:0;${accountTypeStyle}">${accountTypeLabel}</span>
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-top:14px;padding-top:12px;border-top:1px solid var(--border-subtle);flex-wrap:wrap;">
      <button id="acct-edit-profile" class="btn btn-ghost" style="font-size:0.8rem;">Edit Profile</button>
      <button id="acct-sign-out" class="btn btn-ghost" style="font-size:0.8rem;">Sign Out</button>
      ${!user?._isGuest ? `<button id="acct-delete" class="btn btn-ghost" style="font-size:0.8rem;color:var(--text-muted);margin-left:auto;">Delete Account</button>` : ""}
    </div>
  </div>

  ${[
    { label:"Notifications", rows:[
      { key:"daily_reminder",    name:"Daily reminder",     hint:"" },
      { key:"streak_alerts",     name:"Momentum reminders", hint:"" },
      { key:"community_replies", name:"Community replies",  hint:"" },
      { key:"xp_milestones",     name:"XP milestones",      hint:"" },
    ]},
    { label:"Appearance", rows:[
      { key:"lang_effects",    name:"Language environment effects", hint:"Sakura petals, neon glows, and more" },
      { key:"animated_bg",     name:"Real photo backgrounds",       hint:"Language-themed background images" },
      { key:"reduced_motion",  name:"Reduced motion",               hint:"Disables animations for accessibility" },
    ]},
    { label:"Data & Privacy", rows:[
      { key:"cloud_sync",       name:"Cloud sync",         hint:"Save progress to Firestore" },
      { key:"usage_analytics",  name:"Usage analytics",    hint:"Anonymous app usage data" },
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
</div>`;

    // Account actions
    canvas.querySelector("#acct-edit-profile")?.addEventListener("click", () => {
      this._onRightNav("edit-profile");
    });
    canvas.querySelector("#acct-sign-out")?.addEventListener("click", () => {
      signOut().then(() => eventBus.emit("nav:showAuth"));
    });
    canvas.querySelector("#acct-delete")?.addEventListener("click", () => {
      this._confirmDeleteAccount();
    });

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
      this._indexLangData(lang, d);
      return d;
    } catch { return null; }
  }

  _indexLangData(langKey, langData) {
    try {
      const map = new Map();
      const stages = langData?.stages || [];
      for (const stage of stages) {
        const stageId = stage?.id;
        const stageKey = stage?.key;
        const units = stage?.units || [];
        for (let ui = 0; ui < units.length; ui++) {
          const unit = units[ui];
          const unitId = unit?.id;
          const unitIndex = ui + 1;
          const sessions = unit?.sessions || [];
          for (const sess of sessions) {
            if (!sess?.id) continue;
            map.set(sess.id, {
              stageKey, stageId, unitIndex, unitId,
              unitPath:      unit.path        || "primary",
              unlocksAfter:  unit.unlocksAfter || null,
              branchType:    unit.branchType   || null,
            });
          }
        }
      }
      this._sessionIndex[langKey] = map;
    } catch {
      this._sessionIndex[langKey] = new Map();
    }
  }

  _registerGlobalEvents() {
    eventBus.on("session:correct",     () => { document.getElementById("env-canvas")?.classList.add("glow-correct");   setTimeout(()=>document.getElementById("env-canvas")?.classList.remove("glow-correct"),1400); });
    eventBus.on("session:incorrect",   () => { document.getElementById("env-canvas")?.classList.add("glow-error");     setTimeout(()=>document.getElementById("env-canvas")?.classList.remove("glow-error"),900); });
    eventBus.on("nav:backToLanguages", () => { this.currentLang=null; this._setEnv(null); this._buildShell(); this._showHub(); });
    eventBus.on("nav:home",            () => { if (this.currentLang) this._showWorkspace(); });
    eventBus.on("nav:showAuth",        () => this._showAuth());
    eventBus.on("nav:support",         () => { const c=document.getElementById("center-canvas"); if(c) this._pageSupport(c); });
    eventBus.on("tts:missing-audio",   payload => {
      console.warn("[Vaultia] static audio missing:", payload);
    });
    eventBus.on("tts:missing-pack", payload => {
      console.warn("[Vaultia] audio pack issue:", payload);
    });
  }
}

const app = new VaultiaApp();
_appInstance = app; // Set global for presence helper
app.boot();

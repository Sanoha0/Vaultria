/**
 * Vaultria — Language Selection Hub v2
 * Cinematic full-screen entry. No panels. Three worlds.
 */

import { eventBus } from "../utils/eventBus.js";
import { LANGUAGES } from "../utils/constants.js";

const LANG_PHOTOS = {
  japanese: "./Japanese-Card.jpg",
  korean:   "./Korean-Card.jpg",
  spanish:  "./Spanish-Card.jpg",
};

const LANG_SCENES = {
  japanese: {
    title:"Japanese", native:"日本語", sub:"日本語",
    tagline:"Master script, tone & cultural depth",
    desc:"From Hiragana to Kanji — build real fluency through immersive structured learning.",
    accent:"#e8a0b8",
    scene:`<svg viewBox="0 0 420 260" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="jsky" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#2a0a1a"/><stop offset="60%" stop-color="#180816"/><stop offset="100%" stop-color="#0e060f"/>
        </radialGradient>
      </defs>
      <rect width="420" height="260" fill="url(#jsky)"/>
      <circle cx="320" cy="55" r="40" fill="rgba(255,220,190,0.06)"/>
      <circle cx="320" cy="55" r="22" fill="rgba(255,220,190,0.12)"/>
      <circle cx="320" cy="55" r="14" fill="rgba(255,230,200,0.25)"/>
      <circle cx="320" cy="55" r="10" fill="rgba(255,240,220,0.5)"/>
      <circle cx="40" cy="20" r="1" fill="rgba(255,255,255,0.6)"/>
      <circle cx="80" cy="40" r="0.8" fill="rgba(255,255,255,0.5)"/>
      <circle cx="150" cy="15" r="1.2" fill="rgba(255,255,255,0.7)"/>
      <circle cx="200" cy="30" r="0.8" fill="rgba(255,255,255,0.4)"/>
      <circle cx="260" cy="18" r="1" fill="rgba(255,255,255,0.5)"/>
      <circle cx="60" cy="70" r="0.7" fill="rgba(255,255,255,0.3)"/>
      <circle cx="380" cy="30" r="0.9" fill="rgba(255,255,255,0.4)"/>
      <rect x="168" y="90" width="84" height="7" rx="2" fill="#c0392b" opacity="0.9"/>
      <rect x="172" y="85" width="76" height="5" rx="1.5" fill="#e74c3c" opacity="0.8"/>
      <rect x="178" y="97" width="5" height="80" rx="2" fill="#c0392b" opacity="0.85"/>
      <rect x="237" y="97" width="5" height="80" rx="2" fill="#c0392b" opacity="0.85"/>
      <rect x="182" y="110" width="56" height="4" rx="1.5" fill="#c0392b" opacity="0.7"/>
      <ellipse cx="210" cy="190" rx="18" ry="6" fill="rgba(180,160,140,0.2)"/>
      <ellipse cx="210" cy="205" rx="14" ry="4" fill="rgba(180,160,140,0.15)"/>
      <rect x="60" y="110" width="7" height="90" rx="3" fill="rgba(120,80,50,0.7)"/>
      <ellipse cx="63" cy="108" rx="28" ry="22" fill="rgba(220,100,130,0.2)"/>
      <ellipse cx="50" cy="100" rx="18" ry="14" fill="rgba(220,120,150,0.18)"/>
      <ellipse cx="78" cy="104" rx="16" ry="12" fill="rgba(200,90,120,0.15)"/>
      <rect x="350" y="105" width="7" height="90" rx="3" fill="rgba(120,80,50,0.7)"/>
      <ellipse cx="353" cy="103" rx="28" ry="22" fill="rgba(220,100,130,0.2)"/>
      <ellipse cx="340" cy="96" rx="18" ry="14" fill="rgba(220,120,150,0.18)"/>
      <circle cx="95" cy="130" r="2.5" fill="rgba(255,180,200,0.5)"/>
      <circle cx="110" cy="145" r="2" fill="rgba(255,160,190,0.4)"/>
      <circle cx="75" cy="155" r="1.8" fill="rgba(255,190,210,0.45)"/>
      <circle cx="330" cy="128" r="2" fill="rgba(255,180,200,0.4)"/>
      <circle cx="345" cy="148" r="2.5" fill="rgba(255,160,190,0.35)"/>
      <rect x="0" y="200" width="420" height="60" fill="rgba(14,6,15,0.6)"/>
      <ellipse cx="210" cy="200" rx="200" ry="30" fill="rgba(14,6,15,0.4)"/>
      <rect x="140" y="155" width="60" height="40" fill="rgba(20,10,20,0.8)"/>
      <polygon points="140,155 170,135 200,155" fill="rgba(20,10,20,0.8)"/>
      <rect x="147" y="148" width="46" height="8" fill="rgba(20,10,20,0.8)"/>
      <rect x="196" y="95" width="8" height="14" rx="3" fill="rgba(255,140,60,0.5)"/>
      <rect x="216" y="95" width="8" height="14" rx="3" fill="rgba(255,140,60,0.5)"/>
    </svg>`
  },
  korean: {
    title:"Korean", native:"한국어", sub:"한국어",
    tagline:"Modern language of expression & culture",
    desc:"From Hangul to fluent conversation — Seoul's energy in every lesson.",
    accent:"#4db8ff",
    scene:`<svg viewBox="0 0 420 260" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
      <defs>
        <filter id="kblur"><feGaussianBlur stdDeviation="2"/></filter>
        <filter id="kglowsmall"><feGaussianBlur stdDeviation="1.5"/></filter>
        <radialGradient id="ksky" cx="50%" cy="30%" r="80%">
          <stop offset="0%" stop-color="#1a0a20"/><stop offset="60%" stop-color="#0a040f"/><stop offset="100%" stop-color="#020408"/>
        </radialGradient>
        <linearGradient id="kmoon" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="rgba(255,250,240,0.5)"/><stop offset="100%" stop-color="rgba(200,220,255,0.3)"/>
        </linearGradient>
      </defs>
      <rect width="420" height="260" fill="url(#ksky)"/>
      <!-- Atmospheric glow -->
      <ellipse cx="210" cy="280" rx="280" ry="120" fill="rgba(77,150,255,0.08)" filter="url(#kblur)"/>
      <ellipse cx="80" cy="270" rx="150" ry="80" fill="rgba(255,100,180,0.06)" filter="url(#kblur)"/>
      <!-- Moon -->
      <circle cx="340" cy="45" r="35" fill="url(#kmoon)"/>
      <circle cx="340" cy="45" r="32" fill="rgba(255,250,230,0.15)"/>
      <!-- Stars -->
      <circle cx="40" cy="20" r="1" fill="rgba(255,255,255,0.7)"/>
      <circle cx="110" cy="25" r="0.8" fill="rgba(255,255,255,0.5)"/>
      <circle cx="280" cy="15" r="1.2" fill="rgba(200,220,255,0.6)"/>
      <circle cx="360" cy="20" r="0.9" fill="rgba(255,255,255,0.4)"/>
      <!-- Main focal tower - modern Seoul style -->
      <rect x="180" y="35" width="60" height="160" fill="rgba(15,25,60,0.9)"/>
      <polygon points="180,35 210,10 240,35" fill="rgba(15,25,60,0.9)"/>
      <!-- Tower beacon -->
      <circle cx="210" cy="8" r="3" fill="rgba(255,100,100,0.9)"/>
      <circle cx="210" cy="8" r="6" fill="rgba(255,100,100,0.3)" filter="url(#kglowsmall)"/>
      <!-- Windows on tower -->
      <rect x="185" y="50" width="6" height="6" fill="rgba(100,200,255,0.8)"/>
      <rect x="229" y="50" width="6" height="6" fill="rgba(100,200,255,0.8)"/>
      <rect x="185" y="75" width="6" height="6" fill="rgba(255,150,100,0.6)"/>
      <rect x="229" y="75" width="6" height="6" fill="rgba(255,150,100,0.6)"/>
      <rect x="185" y="110" width="6" height="6" fill="rgba(150,220,255,0.7)"/>
      <rect x="229" y="110" width="6" height="6" fill="rgba(150,220,255,0.7)"/>
      <rect x="207" y="90" width="5" height="5" fill="rgba(255,200,150,0.7)"/>
      <!-- Left building complex -->
      <rect x="35" y="100" width="45" height="110" fill="rgba(12,20,50,0.85)"/>
      <polygon points="35,100 57.5,75 80,100" fill="rgba(12,20,50,0.85)"/>
      <!-- Windows left building -->
      <rect x="42" y="110" width="4" height="4" fill="rgba(100,200,255,0.7)"/>
      <rect x="54" y="110" width="4" height="4" fill="rgba(100,200,255,0.5)"/>
      <rect x="66" y="110" width="4" height="4" fill="rgba(255,150,100,0.6)"/>
      <rect x="42" y="135" width="4" height="4" fill="rgba(255,180,120,0.65)"/>
      <rect x="54" y="135" width="4" height="4" fill="rgba(100,200,255,0.6)"/>
      <rect x="66" y="135" width="4" height="4" fill="rgba(150,220,255,0.55)"/>
      <rect x="42" y="160" width="4" height="4" fill="rgba(100,200,255,0.7)"/>
      <rect x="54" y="160" width="4" height="4" fill="rgba(255,180,120,0.6)"/>
      <!-- Right building -->
      <rect x="340" y="110" width="50" height="100" fill="rgba(10,18,48,0.88)"/>
      <polygon points="340,110 365,85 390,110" fill="rgba(10,18,48,0.88)"/>
      <!-- Windows right building -->
      <rect x="348" y="120" width="4" height="4" fill="rgba(150,220,255,0.65)"/>
      <rect x="360" y="120" width="4" height="4" fill="rgba(100,200,255,0.6)"/>
      <rect x="372" y="120" width="4" height="4" fill="rgba(255,150,100,0.55)"/>
      <rect x="348" y="150" width="4" height="4" fill="rgba(255,180,120,0.7)"/>
      <rect x="360" y="150" width="4" height="4" fill="rgba(100,200,255,0.65)"/>
      <rect x="372" y="150" width="4" height="4" fill="rgba(150,220,255,0.6)"/>
      <!-- Neon accent lines (Korean text visual reference) -->
      <line x1="120" y1="95" x2="160" y2="95" stroke="rgba(77,184,255,0.5)" stroke-width="2" stroke-linecap="round"/>
      <line x1="260" y1="105" x2="310" y2="105" stroke="rgba(255,77,166,0.4)" stroke-width="2" stroke-linecap="round"/>
      <line x1="100" y1="70" x2="140" y2="70" stroke="rgba(255,180,100,0.35)" stroke-width="1.5" stroke-linecap="round"/>
      <!-- Ground reflections -->
      <ellipse cx="210" cy="210" rx="120" ry="15" fill="rgba(77,180,255,0.08)" filter="url(#kblur)"/>
      <ellipse cx="80" cy="220" rx="70" ry="12" fill="rgba(255,100,180,0.06)" filter="url(#kblur)"/>
      <!-- Foreground darkness -->
      <rect x="0" y="190" width="420" height="70" fill="rgba(5,2,10,0.7)"/>
    </svg>`
  },
  spanish: {
    title:"Spanish", native:"Español", sub:"Español",
    tagline:"The world's second most spoken language",
    desc:"From first words to native conversations — warm, vibrant, alive.",
    accent:"#e8a44a",
    scene:`<svg viewBox="0 0 420 260" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="ssky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1a0800"/>
          <stop offset="35%" stop-color="#3d1500"/>
          <stop offset="65%" stop-color="#6b2800"/>
          <stop offset="100%" stop-color="#1a0800"/>
        </linearGradient>
        <radialGradient id="ssun" cx="50%" cy="42%" r="30%">
          <stop offset="0%" stop-color="rgba(255,160,40,0.35)"/>
          <stop offset="100%" stop-color="rgba(255,100,20,0)"/>
        </radialGradient>
      </defs>
      <rect width="420" height="260" fill="url(#ssky)"/>
      <rect width="420" height="260" fill="url(#ssun)"/>
      <ellipse cx="210" cy="145" rx="180" ry="40" fill="rgba(220,100,20,0.15)"/>
      <circle cx="210" cy="110" r="28" fill="rgba(255,160,50,0.2)"/>
      <circle cx="210" cy="110" r="18" fill="rgba(255,170,60,0.35)"/>
      <circle cx="210" cy="110" r="11" fill="rgba(255,190,80,0.55)"/>
      <circle cx="210" cy="110" r="6" fill="rgba(255,210,120,0.7)"/>
      <rect x="0" y="148" width="420" height="2" fill="rgba(200,120,40,0.3)"/>
      <rect x="0" y="150" width="420" height="110" fill="rgba(10,5,2,0.92)"/>
      <ellipse cx="210" cy="155" rx="120" ry="8" fill="rgba(255,150,50,0.1)"/>
      <rect x="20" y="60" width="70" height="90" fill="rgba(15,5,0,0.9)"/>
      <polygon points="20,60 55,25 90,60" fill="rgba(15,5,0,0.9)"/>
      <rect x="22" y="30" width="14" height="30" fill="rgba(12,4,0,0.9)"/>
      <polygon points="22,30 29,18 36,30" fill="rgba(12,4,0,0.9)"/>
      <rect x="74" y="35" width="14" height="25" fill="rgba(12,4,0,0.9)"/>
      <polygon points="74,35 81,22 88,35" fill="rgba(12,4,0,0.9)"/>
      <ellipse cx="55" cy="72" rx="8" ry="12" fill="rgba(255,160,60,0.15)"/>
      <ellipse cx="55" cy="72" rx="5" ry="8" fill="rgba(255,170,80,0.2)"/>
      <rect x="310" y="75" width="50" height="75" fill="rgba(15,5,0,0.85)"/>
      <rect x="365" y="90" width="40" height="60" fill="rgba(12,4,0,0.85)"/>
      <rect x="285" y="95" width="25" height="55" fill="rgba(14,5,0,0.85)"/>
      <rect x="312" y="78" width="46" height="4" fill="rgba(120,60,20,0.3)"/>
      <rect x="320" y="95" width="6" height="8" rx="1" fill="rgba(255,180,80,0.35)"/>
      <rect x="332" y="95" width="6" height="8" rx="1" fill="rgba(255,180,80,0.25)"/>
      <rect x="344" y="98" width="6" height="8" rx="1" fill="rgba(255,180,80,0.3)"/>
      <rect x="0" y="220" width="420" height="40" fill="rgba(10,4,0,0.95)"/>
      <rect x="0" y="218" width="420" height="4" fill="rgba(60,25,5,0.4)"/>
      <line x1="155" y1="218" x2="155" y2="175" stroke="rgba(80,35,5,0.6)" stroke-width="1.5"/>
      <ellipse cx="155" cy="173" rx="5" ry="7" fill="rgba(255,160,60,0.35)"/>
      <line x1="265" y1="218" x2="265" y2="175" stroke="rgba(80,35,5,0.6)" stroke-width="1.5"/>
      <ellipse cx="265" cy="173" rx="5" ry="7" fill="rgba(255,160,60,0.35)"/>
    </svg>`
  }
};

export class LanguageHub {
  constructor({ container, allProgress, onSelectLanguage }) {
    this.container        = container;
    this.allProgress      = allProgress || {};
    this.onSelectLanguage = onSelectLanguage;
    this._render();
  }

  _render() {
    const stageNames = ["Starter","Beginner","Explorer","Speaker","Scholar","Specialist","Archivist"];
    this.container.style.cssText = "width:100%;height:100vh;overflow:hidden;position:relative;background:#050810;";
    this.container.innerHTML = `
<style>
.hub-root{width:100%;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;overflow:hidden;font-family:'Cormorant Garamond','Georgia',serif;background:radial-gradient(ellipse at 50% 110%,#0d0b1f 0%,#07060f 45%,#030308 100%);}
.hub-root::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:1;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");background-size:200px 200px;opacity:0.35;}
.hub-orb{position:absolute;border-radius:50%;pointer-events:none;z-index:0;}
.hub-orb1{width:700px;height:700px;top:-180px;left:-200px;background:radial-gradient(circle,rgba(110,80,200,0.13) 0%,transparent 70%);filter:blur(60px);animation:orbDrift1 20s ease-in-out infinite;}
.hub-orb2{width:600px;height:600px;bottom:-150px;right:-160px;background:radial-gradient(circle,rgba(60,110,210,0.12) 0%,transparent 70%);filter:blur(60px);animation:orbDrift2 25s ease-in-out infinite;}
.hub-orb3{width:450px;height:450px;top:30%;left:55%;background:radial-gradient(circle,rgba(90,60,160,0.09) 0%,transparent 70%);filter:blur(50px);animation:orbDrift3 30s ease-in-out infinite;}
.hub-stars{position:absolute;inset:0;z-index:0;pointer-events:none;}
@keyframes orbDrift1{0%,100%{transform:translate(0,0);}33%{transform:translate(45px,-35px);}66%{transform:translate(-25px,20px);}}
@keyframes orbDrift2{0%,100%{transform:translate(0,0);}33%{transform:translate(-40px,30px);}66%{transform:translate(30px,-20px);}}
@keyframes orbDrift3{0%,100%{transform:translate(-50%,-50%);}33%{transform:translate(calc(-50% + 30px),calc(-50% - 25px));}66%{transform:translate(calc(-50% - 20px),calc(-50% + 35px));}}
@keyframes starTwinkle{0%,100%{opacity:0.4;}50%{opacity:1;}}
.hub-header{text-align:center;margin-bottom:44px;position:relative;z-index:2;}
.hub-wordmark{font-size:clamp(1.4rem,3vw,2rem);font-weight:300;letter-spacing:0.24em;color:rgba(255,245,235,0.88);text-transform:uppercase;margin-bottom:8px;}
.hub-subtitle{font-size:0.72rem;letter-spacing:0.18em;color:rgba(255,240,220,0.32);text-transform:uppercase;font-family:'DM Mono','Courier New',monospace;}
.hub-cards{display:grid;grid-template-columns:repeat(3,340px);gap:22px;position:relative;z-index:2;padding:0 20px;}
@media(max-width:1100px){.hub-cards{grid-template-columns:repeat(3,minmax(0,1fr));max-width:98vw;}}
@media(max-width:680px){.hub-cards{grid-template-columns:1fr;max-width:380px;}.hub-header{margin-bottom:24px;}}
.lang-world{position:relative;border-radius:16px;overflow:hidden;cursor:pointer;height:360px;border:1px solid rgba(255,255,255,0.08);transition:transform 0.45s cubic-bezier(0.22,1,0.36,1),box-shadow 0.45s cubic-bezier(0.22,1,0.36,1),border-color 0.35s ease;animation:worldReveal 0.65s cubic-bezier(0.22,1,0.36,1) both;}
.lang-world:nth-child(1){animation-delay:0.05s;}.lang-world:nth-child(2){animation-delay:0.15s;}.lang-world:nth-child(3){animation-delay:0.25s;}
@keyframes worldReveal{from{opacity:0;transform:translateY(24px) scale(0.97);}to{opacity:1;transform:translateY(0) scale(1);}}
.lang-world:hover{transform:translateY(-8px) scale(1.02);}
.lang-world:hover .world-scene div{transform:scale(1.06);transition:transform 0.6s cubic-bezier(0.22,1,0.36,1);}
.lang-world:hover .world-overlay{background:rgba(0,0,0,0.18);}
.lang-world:hover .world-enter{opacity:1;transform:translateY(0);}
.lang-world[data-lang="japanese"]:hover{border-color:rgba(232,160,184,0.45);box-shadow:0 16px 48px rgba(232,160,184,0.12),0 4px 16px rgba(0,0,0,0.3);}
.lang-world[data-lang="spanish"]:hover{border-color:rgba(232,164,74,0.45);box-shadow:0 16px 48px rgba(232,164,74,0.12),0 4px 16px rgba(0,0,0,0.3);}
.lang-world[data-lang="korean"]:hover{border-color:rgba(77,184,255,0.45);box-shadow:0 16px 48px rgba(77,184,255,0.12),0 4px 16px rgba(0,0,0,0.3);}
.lang-world:active{transform:translateY(-4px) scale(1.01);}
.world-scene{position:absolute;inset:0;overflow:hidden;}
.world-scene div{transition:transform 0.6s cubic-bezier(0.22,1,0.36,1);}
.world-overlay{position:absolute;inset:0;background:rgba(0,0,0,0.28);transition:background 0.4s ease;}
.world-gradient{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.94) 0%,rgba(0,0,0,0.58) 35%,rgba(0,0,0,0.10) 65%,transparent 100%);}
.world-content{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-end;padding:26px 24px;z-index:2;}
.world-tag{font-family:'DM Mono','Courier New',monospace;font-size:0.62rem;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.38);margin-bottom:8px;}
.world-name{font-size:2.2rem;font-weight:300;line-height:1;color:rgba(255,255,255,0.96);letter-spacing:0.04em;margin-bottom:4px;}
.world-native{font-size:1rem;font-weight:300;color:rgba(255,255,255,0.45);margin-bottom:10px;letter-spacing:0.06em;}
.world-desc{font-size:0.78rem;line-height:1.55;color:rgba(255,255,255,0.48);font-family:'DM Mono','Courier New',monospace;margin-bottom:16px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.world-meta{display:flex;align-items:center;gap:10px;}
.world-xp{font-family:'DM Mono','Courier New',monospace;font-size:0.68rem;color:rgba(255,255,255,0.32);letter-spacing:0.06em;}
.world-stage-pill{padding:3px 10px;border-radius:999px;font-family:'DM Mono','Courier New',monospace;font-size:0.62rem;letter-spacing:0.1em;text-transform:uppercase;border:1px solid;}
.world-enter{margin-left:auto;font-size:0.68rem;letter-spacing:0.12em;text-transform:uppercase;font-family:'DM Mono','Courier New',monospace;color:rgba(255,255,255,0.65);opacity:0;transform:translateY(6px);transition:opacity 0.3s ease,transform 0.3s ease;display:flex;align-items:center;gap:5px;}
.world-badge{position:absolute;top:14px;right:14px;z-index:3;font-family:'DM Mono','Courier New',monospace;font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;padding:4px 10px;border-radius:999px;background:rgba(0,0,0,0.40);backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.45);}
.world-progress-bar{position:absolute;bottom:0;left:0;right:0;height:2px;background:rgba(255,255,255,0.05);}
.world-progress-fill{height:100%;transition:width 1.2s ease 0.4s;border-radius:0 999px 999px 0;}
.hub-footer{margin-top:36px;position:relative;z-index:2;text-align:center;font-family:'DM Mono','Courier New',monospace;font-size:0.65rem;letter-spacing:0.1em;color:rgba(255,255,255,0.15);}
</style>
<div class="hub-root">
  <div class="hub-orb hub-orb1"></div>
  <div class="hub-orb hub-orb2"></div>
  <div class="hub-orb hub-orb3"></div>
  <svg class="hub-stars" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <circle cx="120" cy="80" r="1" fill="rgba(255,255,255,0.5)" style="animation:starTwinkle 4.2s ease-in-out infinite;"/>
    <circle cx="280" cy="45" r="0.8" fill="rgba(255,255,255,0.4)" style="animation:starTwinkle 5.8s ease-in-out 1s infinite;"/>
    <circle cx="450" cy="120" r="1.2" fill="rgba(200,210,255,0.55)" style="animation:starTwinkle 3.9s ease-in-out 0.5s infinite;"/>
    <circle cx="650" cy="60" r="0.9" fill="rgba(255,255,255,0.45)" style="animation:starTwinkle 6.1s ease-in-out 2s infinite;"/>
    <circle cx="820" cy="35" r="1" fill="rgba(220,220,255,0.5)" style="animation:starTwinkle 4.7s ease-in-out 1.5s infinite;"/>
    <circle cx="1000" cy="90" r="0.7" fill="rgba(255,255,255,0.38)" style="animation:starTwinkle 5.3s ease-in-out 0.8s infinite;"/>
    <circle cx="1180" cy="55" r="1.1" fill="rgba(200,215,255,0.5)" style="animation:starTwinkle 4s ease-in-out 2.5s infinite;"/>
    <circle cx="1340" cy="100" r="0.8" fill="rgba(255,255,255,0.42)" style="animation:starTwinkle 6.5s ease-in-out 0.3s infinite;"/>
    <circle cx="60" cy="200" r="0.7" fill="rgba(255,255,255,0.32)" style="animation:starTwinkle 5s ease-in-out 3s infinite;"/>
    <circle cx="380" cy="160" r="1" fill="rgba(210,210,255,0.45)" style="animation:starTwinkle 4.4s ease-in-out 1.2s infinite;"/>
    <circle cx="700" cy="180" r="0.8" fill="rgba(255,255,255,0.38)" style="animation:starTwinkle 3.7s ease-in-out 2.2s infinite;"/>
    <circle cx="950" cy="150" r="1.2" fill="rgba(200,220,255,0.5)" style="animation:starTwinkle 5.6s ease-in-out 0.6s infinite;"/>
    <circle cx="1260" cy="170" r="0.9" fill="rgba(255,255,255,0.4)" style="animation:starTwinkle 4.9s ease-in-out 1.8s infinite;"/>
    <circle cx="200" cy="750" r="0.8" fill="rgba(255,255,255,0.3)" style="animation:starTwinkle 5.2s ease-in-out 2.8s infinite;"/>
    <circle cx="1100" cy="800" r="1" fill="rgba(210,215,255,0.35)" style="animation:starTwinkle 4.6s ease-in-out 1.4s infinite;"/>
  </svg>
  <div class="hub-header">
    <div class="hub-wordmark">Vaultria</div>
    <div class="hub-subtitle">Select your language world</div>
  </div>
  <div class="hub-cards">
    ${LANGUAGES.map(l => this._card(l, stageNames)).join('')}
  </div>
  <div class="hub-footer">Progress saved independently per language &nbsp;·&nbsp; Vaultria Language Workstation</div>
</div>`;

    this.container.querySelectorAll('.lang-world').forEach(card => {
      const lang = card.dataset.lang;
      card.addEventListener('click', () => {
        card.style.transform = 'scale(0.97)';
        setTimeout(() => { this.onSelectLanguage?.(lang); eventBus.emit('lang:selected', lang); }, 110);
      });
      card.addEventListener('keydown', e => {
        if (e.key==='Enter'||e.key===' ') { e.preventDefault(); this.onSelectLanguage?.(lang); }
      });
    });
    requestAnimationFrame(() => {
      this.container.querySelectorAll('.world-progress-fill').forEach(b => { b.style.width = b.dataset.pct+'%'; });
    });
  }

  _card(lang, stageNames) {
    const m    = LANG_SCENES[lang];
    const prog = this.allProgress[lang] || {};
    const xp   = prog.xp || 0;
    const si   = prog.stageUnlocked || 0;
    const stage= stageNames[si] || 'Starter';
    const pct  = Math.min(100, Math.round((xp % 200) / 200 * 100));
    const tot  = prog.completed?.length || 0;
    return `
<div class="lang-world" data-lang="${lang}" role="button" tabindex="0">
  <div class="world-scene">
    <div style="position:absolute;inset:0;background-image:url(${LANG_PHOTOS[lang]});background-size:cover;background-position:center;"></div>
  </div>
  <div class="world-overlay"></div>
  <div class="world-gradient"></div>
  <div class="world-badge">${tot > 0 ? tot+' lessons' : 'Begin'}</div>
  <div class="world-content">
    <div class="world-tag">Language · ${m.sub}</div>
    <div class="world-name">${m.title}</div>
    <div class="world-native">${m.native}</div>
    <div class="world-desc">${m.desc}</div>
    <div class="world-meta">
      <div class="world-stage-pill" style="color:${m.accent};border-color:${m.accent}40;">${stage}</div>
      <div class="world-xp">${xp.toLocaleString()} XP</div>
      <div class="world-enter">Enter <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></div>
    </div>
  </div>
  <div class="world-progress-bar"><div class="world-progress-fill" data-pct="${pct}" style="width:0%;background:${m.accent};"></div></div>
</div>`;
  }
}

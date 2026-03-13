/**
 * Vaultria — REWARD_DEFS
 * Curated Chronicle milestone rewards, presented every 5 levels.
 * All rewards enhance the workspace environment, never gameplay.
 */

export const CHRONICLE_REWARDS = {
  10: {
    title:   "The First Chapter",
    flavor:  "Your study environment begins to breathe.",
    choices: [
      { id:"soundscapes_forest",   label:"Forest Study",    desc:"Ambient birdsong and distant rain for deep focus sessions.",     type:"soundscape" },
      { id:"soundscapes_rain",     label:"Rain on Glass",   desc:"Steady rain against glass, low rolling thunder.",               type:"soundscape" },
      { id:"frame_ink",            label:"Scholar Frame",   desc:"Slow ink-wash particle effect drifts around your avatar.",       type:"frame"      },
    ],
  },
  15: {
    title:   "Deepening",
    flavor:  "The vault grows quieter. More focused.",
    choices: [
      { id:"soundscapes_library",  label:"Reading Room",    desc:"Warm library ambience — turning pages, soft murmur.",           type:"soundscape" },
      { id:"frame_neon",           label:"Neon Frame",      desc:"Seoul-inspired electric cyan geometry frame.",                  type:"frame"      },
    ],
  },
  20: {
    title:   "The Vault Opens",
    flavor:  "New surfaces for your Archivist Desk.",
    choices: [
      { id:"desk_marble",          label:"White Marble Desk",  desc:"Polished white marble desk surface for your Profile Board.", type:"desk"       },
      { id:"frame_ceramic",        label:"Ceramic Frame",   desc:"Hand-painted Spanish tile pattern — terracotta and cobalt.",   type:"frame"      },
    ],
  },
  25: {
    title:   "Parallax",
    flavor:  "Your workspace gains depth.",
    choices: [
      { id:"parallax_sakura",      label:"Sakura Drift",    desc:"Gentle parallax sakura petals across the workspace background.",type:"parallax"   },
      { id:"parallax_city",        label:"Night City",      desc:"Distant city lights layer over the workspace in 3-depth parallax.", type:"parallax" },
      { id:"soundscapes_coffeeshop",label:"Café Corner",    desc:"Coffeeshop ambience — espresso machines, soft chatter.",       type:"soundscape" },
    ],
  },
  30: {
    title:   "Inner Sanctum",
    flavor:  "The workspace adapts to your discipline.",
    choices: [
      { id:"desk_tatami",          label:"Tatami Surface",  desc:"Traditional woven tatami desk surface, warm straw tones.",     type:"desk"       },
      { id:"soundscapes_storm",    label:"Mountain Storm",  desc:"Distant mountain storm — wind, rain, far thunder.",            type:"soundscape" },
    ],
  },
  50: {
    title:   "The Silver Pen",
    flavor:  "A mark of serious dedication.",
    choices: [
      { id:"cursor_silver_pen",    label:"The Silver Pen",  desc:"Replaces your cursor with a custom silver calligraphy pen effect.", type:"cursor" },
      { id:"desk_carbon",          label:"Carbon Fiber Desk",desc:"Precision-woven carbon fiber desk surface.",                  type:"desk"       },
    ],
  },
};

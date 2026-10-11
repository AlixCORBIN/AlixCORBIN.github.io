// Bruitages de la bataille navale, synthétisés en WebAudio (aucun fichier à charger).
// Respecte le bouton muet commun du Casino (sound.isMuted).
import { sound } from "../../lib/sound.js";

let ctx = null;
let master = null;
const audio = () => {
  if (sound.isMuted()) return null;
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
  } catch {
    return null;
  }
  return ctx;
};

let noiseBuf = null;
const noiseBuffer = (c) => {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 3, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
};

/** Bruit filtré avec enveloppe. f0 → f1 : balayage du filtre. */
function noise({ dur, vol = 0.2, type = "lowpass", f0 = 800, f1 = f0, q = 0.7, attack = 0.01, delay = 0 }) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + delay;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const filter = c.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(f0, t);
  filter.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(g).connect(master);
  src.start(t, Math.random() * 1.5);
  src.stop(t + dur + 0.05);
}

function tone({ f0, f1 = f0, dur, vol = 0.08, type = "sine", attack = 0.01, delay = 0 }) {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export const sfx = {
  // Départ du missile : souffle qui monte + coup sourd.
  launch() {
    tone({ f0: 120, f1: 45, dur: 0.35, vol: 0.25, type: "sine" });
    noise({ dur: 0.9, vol: 0.18, type: "bandpass", f0: 300, f1: 2400, q: 1.2, attack: 0.05 });
  },
  // Sifflement du missile pendant le vol (dur en secondes).
  whistle(dur) {
    tone({ f0: 1700, f1: 520, dur, vol: 0.035, type: "sine", attack: 0.3, delay: 0.25 });
  },
  splash() {
    noise({ dur: 0.9, vol: 0.32, type: "lowpass", f0: 2600, f1: 300, attack: 0.008 });
    noise({ dur: 0.5, vol: 0.12, type: "highpass", f0: 3000, f1: 1500, delay: 0.05 });
    // gouttes qui retombent
    for (let i = 0; i < 6; i++) tone({ f0: 900 + Math.random() * 900, f1: 1800, dur: 0.06, vol: 0.02, delay: 0.35 + Math.random() * 0.5 });
  },
  explosion() {
    tone({ f0: 95, f1: 32, dur: 1.1, vol: 0.45, type: "sine", attack: 0.005 });
    noise({ dur: 1.6, vol: 0.55, type: "lowpass", f0: 1800, f1: 120, attack: 0.004 });
    noise({ dur: 0.35, vol: 0.2, type: "highpass", f0: 2500, f1: 900 });
    // crépitements
    for (let i = 0; i < 8; i++) noise({ dur: 0.05, vol: 0.08, type: "bandpass", f0: 1500 + Math.random() * 2000, q: 3, delay: 0.3 + Math.random() * 1 });
  },
  sink() {
    tone({ f0: 260, f1: 55, dur: 2.4, vol: 0.12, type: "sawtooth", attack: 0.2, delay: 0.5 });
    tone({ f0: 130, f1: 40, dur: 2.6, vol: 0.12, type: "sine", attack: 0.2, delay: 0.5 });
    // bulles
    for (let i = 0; i < 14; i++) {
      const f = 300 + Math.random() * 500;
      tone({ f0: f, f1: f * 2.2, dur: 0.08, vol: 0.05, delay: 0.9 + Math.random() * 2 });
    }
  },
  // Sonar : c'est ton tour.
  ping() {
    tone({ f0: 1250, f1: 1180, dur: 1.1, vol: 0.07, attack: 0.005 });
    tone({ f0: 1250, f1: 1180, dur: 0.8, vol: 0.025, attack: 0.005, delay: 0.45 });
  },
  place() {
    tone({ f0: 160, f1: 90, dur: 0.18, vol: 0.18, type: "triangle", attack: 0.003 });
    noise({ dur: 0.25, vol: 0.08, type: "lowpass", f0: 1200, f1: 400 });
  },
  rotate() {
    tone({ f0: 700, f1: 900, dur: 0.07, vol: 0.05, type: "square" });
  },
  hover() {
    tone({ f0: 2200, dur: 0.025, vol: 0.012, type: "sine" });
  },
  horn() {
    tone({ f0: 110, dur: 1.4, vol: 0.12, type: "sawtooth", attack: 0.08 });
    tone({ f0: 165, dur: 1.4, vol: 0.07, type: "sawtooth", attack: 0.08 });
  },
};

/* ---------- ambiance : houle + mouettes de temps en temps ---------- */
let amb = null;
export function startAmbience() {
  const c = audio();
  if (!c || amb) return;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 420;
  const g = c.createGain();
  g.gain.value = 0.05;
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.12;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 0.035;
  lfo.connect(lfoGain).connect(g.gain);
  src.connect(filter).connect(g).connect(master);
  src.start();
  lfo.start();
  const gull = setInterval(() => {
    if (sound.isMuted()) return;
    if (Math.random() < 0.35) {
      tone({ f0: 1400, f1: 900, dur: 0.25, vol: 0.02, type: "triangle" });
      tone({ f0: 1500, f1: 950, dur: 0.22, vol: 0.018, type: "triangle", delay: 0.3 });
    }
  }, 6000);
  const mute = setInterval(() => (g.gain.value = sound.isMuted() ? 0 : 0.05), 400);
  amb = { src, lfo, gull, mute };
}
export function stopAmbience() {
  if (!amb) return;
  try {
    amb.src.stop();
    amb.lfo.stop();
  } catch {}
  clearInterval(amb.gull);
  clearInterval(amb.mute);
  amb = null;
}

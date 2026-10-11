// Bruitages du Buckshot, synthétisés en WebAudio (aucun fichier, aucun droit d'auteur).
// Respecte le bouton muet commun du Casino (sound.isMuted).
import { sound } from "../../lib/sound.js";

let ctx = null;
let master = null;
const audio = () => {
  if (sound.isMuted()) return null;
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 6;
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(comp).connect(ctx.destination);
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

function noise({ dur, vol = 0.2, type = "lowpass", f0 = 800, f1 = f0, q = 0.7, attack = 0.005, delay = 0 }) {
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

function tone({ f0, f1 = f0, dur, vol = 0.08, type = "sine", attack = 0.005, delay = 0 }) {
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

const clack = (delay = 0, pitch = 1) => {
  noise({ dur: 0.07, vol: 0.45, type: "bandpass", f0: 2600 * pitch, q: 3, delay });
  tone({ f0: 220 * pitch, f1: 120, dur: 0.06, vol: 0.18, type: "square", delay });
};

export const sfx = {
  // saisie du fusil sur la table
  grab() {
    noise({ dur: 0.25, vol: 0.12, type: "bandpass", f0: 900, f1: 500, q: 1 });
    tone({ f0: 110, f1: 70, dur: 0.15, vol: 0.2, delay: 0.05 });
  },
  // pompe : culasse en arrière puis en avant
  pump() {
    clack(0, 1);
    noise({ dur: 0.12, vol: 0.12, type: "bandpass", f0: 1400, f1: 900, q: 2, delay: 0.03 });
    clack(0.2, 1.25);
  },
  // détonation : coup sourd, claquement et queue
  fire() {
    tone({ f0: 95, f1: 32, dur: 0.7, vol: 1, type: "sine" });
    noise({ dur: 0.08, vol: 0.9, type: "highpass", f0: 1800 });
    noise({ dur: 1.3, vol: 0.85, type: "lowpass", f0: 7000, f1: 160, q: 0.5 });
    noise({ dur: 2.4, vol: 0.14, type: "lowpass", f0: 900, f1: 120, delay: 0.12, attack: 0.08 });
  },
  // percuteur à vide : « clic » sec
  click() {
    noise({ dur: 0.03, vol: 0.55, type: "highpass", f0: 3500 });
    tone({ f0: 2600, f1: 1900, dur: 0.025, vol: 0.12, type: "square" });
    tone({ f0: 900, f1: 700, dur: 0.12, vol: 0.04, type: "triangle", delay: 0.02 });
  },
  // douille qui rebondit sur la table
  shellBounce() {
    [0, 0.17, 0.29, 0.37].forEach((d, i) => {
      tone({ f0: 2300 - i * 180, f1: 1500, dur: 0.07, vol: 0.12 / (i + 1), type: "triangle", delay: d });
      noise({ dur: 0.03, vol: 0.12 / (i + 1), type: "bandpass", f0: 3000, q: 2, delay: d });
    });
  },
  // cartouche posée sur la table
  shellPlace() {
    tone({ f0: 520, f1: 380, dur: 0.08, vol: 0.12, type: "triangle" });
    noise({ dur: 0.04, vol: 0.12, type: "bandpass", f0: 2200, q: 2 });
  },
  // cartouche glissée dans le magasin
  shellInsert() {
    noise({ dur: 0.08, vol: 0.25, type: "bandpass", f0: 1500, f1: 900, q: 2 });
    tone({ f0: 700, f1: 500, dur: 0.04, vol: 0.08, type: "square", delay: 0.06 });
  },
  // objet qui tombe dans le plateau
  itemDrop(delay = 0) {
    tone({ f0: 170, f1: 110, dur: 0.14, vol: 0.25, delay });
    noise({ dur: 0.08, vol: 0.18, type: "lowpass", f0: 900, delay });
  },
  // battements de cœur
  heartbeat(n = 2, gap = 0.75) {
    for (let i = 0; i < n; i++) {
      tone({ f0: 62, f1: 40, dur: 0.18, vol: 0.5, delay: i * gap });
      tone({ f0: 55, f1: 38, dur: 0.16, vol: 0.35, delay: i * gap + 0.22 });
    }
  },
  // bip du moniteur cardiaque
  ecg(delay = 0) {
    tone({ f0: 1046, dur: 0.09, vol: 0.06, delay });
  },
  flatline() {
    tone({ f0: 1046, dur: 1.8, vol: 0.07, attack: 0.02 });
  },
  // charge du défibrillateur
  charge() {
    tone({ f0: 180, f1: 2200, dur: 0.8, vol: 0.05, type: "sawtooth", attack: 0.1 });
    tone({ f0: 1400, dur: 0.12, vol: 0.06, delay: 0.85 });
  },
  // coup reçu
  hit() {
    tone({ f0: 70, f1: 30, dur: 0.5, vol: 0.6 });
    noise({ dur: 0.4, vol: 0.25, type: "lowpass", f0: 400, f1: 80 });
  },
  // début de manche : impact grave
  roundStart() {
    tone({ f0: 55, f1: 30, dur: 1.6, vol: 0.6 });
    noise({ dur: 1.8, vol: 0.18, type: "lowpass", f0: 300, f1: 60, attack: 0.02 });
    tone({ f0: 220, f1: 210, dur: 1.4, vol: 0.04, type: "sawtooth", delay: 0.1, attack: 0.3 });
  },
  turn() {
    tone({ f0: 660, dur: 0.12, vol: 0.06, type: "triangle" });
    tone({ f0: 880, dur: 0.18, vol: 0.06, type: "triangle", delay: 0.12 });
  },
  win() {
    [262, 330, 392, 523].forEach((f, i) => tone({ f0: f, dur: 0.6, vol: 0.08, type: "triangle", delay: i * 0.14 }));
  },
  lose() {
    [196, 185, 147].forEach((f, i) => tone({ f0: f, f1: f * 0.97, dur: 0.8, vol: 0.09, type: "sawtooth", delay: i * 0.3 }));
  },

  /* ---------- objets ---------- */
  biere() {
    noise({ dur: 0.18, vol: 0.4, type: "highpass", f0: 3500 });
    noise({ dur: 0.8, vol: 0.12, type: "bandpass", f0: 6500, f1: 4000, q: 1, delay: 0.1, attack: 0.05 });
    [0.95, 1.25, 1.55].forEach((d) => {
      tone({ f0: 190, f1: 120, dur: 0.14, vol: 0.2, delay: d });
      noise({ dur: 0.12, vol: 0.1, type: "lowpass", f0: 700, delay: d });
    });
  },
  cigarettes() {
    noise({ dur: 0.05, vol: 0.35, type: "highpass", f0: 5000 });
    noise({ dur: 0.05, vol: 0.35, type: "highpass", f0: 5000, delay: 0.22 });
    noise({ dur: 0.5, vol: 0.15, type: "bandpass", f0: 700, f1: 1400, q: 0.8, delay: 0.25, attack: 0.05 });
    for (let i = 0; i < 10; i++) noise({ dur: 0.012, vol: 0.12, type: "highpass", f0: 4000, delay: 0.6 + Math.random() * 0.6 });
    noise({ dur: 1.1, vol: 0.12, type: "lowpass", f0: 1500, f1: 400, delay: 1.25, attack: 0.25 });
  },
  scie() {
    for (let i = 0; i < 7; i++) {
      const up = i % 2 === 0;
      noise({ dur: 0.15, vol: 0.32, type: "bandpass", f0: up ? 3000 : 4300, f1: up ? 4300 : 3000, q: 4, delay: i * 0.16, attack: 0.02 });
      tone({ f0: 3600 + (up ? 0 : 300), dur: 0.12, vol: 0.02, type: "sawtooth", delay: i * 0.16 });
    }
    tone({ f0: 1800, f1: 1200, dur: 0.3, vol: 0.08, type: "triangle", delay: 1.15 });
  },
  menottes() {
    for (let i = 0; i < 8; i++) noise({ dur: 0.02, vol: 0.3, type: "highpass", f0: 5000, delay: 0.45 + i * 0.035 });
    [0, 0.12, 0.3].forEach((d) => {
      tone({ f0: 2700 + Math.random() * 500, dur: 0.25, vol: 0.06, type: "triangle", delay: d });
      tone({ f0: 3900 + Math.random() * 400, dur: 0.18, vol: 0.04, type: "sine", delay: d });
    });
  },
  inverseur() {
    tone({ f0: 300, f1: 1400, dur: 0.25, vol: 0.08, type: "square" });
    tone({ f0: 1400, f1: 250, dur: 0.35, vol: 0.08, type: "square", delay: 0.25 });
    noise({ dur: 0.5, vol: 0.12, type: "bandpass", f0: 2500, f1: 600, q: 3 });
  },
  loupe() {
    tone({ f0: 2400, dur: 1.1, vol: 0.05 });
    tone({ f0: 3610, dur: 0.9, vol: 0.03, delay: 0.02 });
    noise({ dur: 0.3, vol: 0.05, type: "highpass", f0: 6000, attack: 0.1 });
  },
  telephone() {
    [[697, 1209], [770, 1336], [852, 1477]].forEach(([a, b], i) => {
      tone({ f0: a, dur: 0.12, vol: 0.05, delay: i * 0.18 });
      tone({ f0: b, dur: 0.12, vol: 0.05, delay: i * 0.18 });
    });
    // voix déformée : quelques syllabes filtrées
    for (let i = 0; i < 6; i++) {
      tone({ f0: 120 + Math.random() * 60, f1: 90 + Math.random() * 40, dur: 0.14, vol: 0.06, type: "sawtooth", delay: 0.8 + i * 0.17 });
      noise({ dur: 0.12, vol: 0.06, type: "bandpass", f0: 900 + Math.random() * 800, q: 4, delay: 0.8 + i * 0.17 });
    }
  },
  medicament(lucky) {
    for (let i = 0; i < 14; i++) noise({ dur: 0.015, vol: 0.18, type: "highpass", f0: 3500, delay: Math.random() * 0.5 });
    tone({ f0: 180, f1: 120, dur: 0.15, vol: 0.2, delay: 0.8 });
    if (lucky) [523, 659, 784].forEach((f, i) => tone({ f0: f, dur: 0.3, vol: 0.06, type: "triangle", delay: 1.2 + i * 0.1 }));
    else [1.2, 1.45, 1.65].forEach((d) => noise({ dur: 0.18, vol: 0.3, type: "lowpass", f0: 1200, f1: 300, delay: d }));
  },
  adrenaline() {
    noise({ dur: 0.35, vol: 0.2, type: "bandpass", f0: 3000, f1: 800, q: 2 });
    sfx.heartbeat(3, 0.38);
  },
  telecommande() {
    tone({ f0: 1500, dur: 0.08, vol: 0.06, type: "square" });
    tone({ f0: 1500, dur: 0.08, vol: 0.06, type: "square", delay: 0.14 });
    noise({ dur: 0.7, vol: 0.12, type: "bandpass", f0: 400, f1: 2000, q: 1, delay: 0.3, attack: 0.2 });
  },
};

/* ---------- ambiance : néon qui bourdonne + grésillements ---------- */
export function startAmbience() {
  const c = audio();
  if (!c) return () => {};
  const out = c.createGain();
  out.gain.value = 0;
  out.gain.linearRampToValueAtTime(1, c.currentTime + 2);
  out.connect(master);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 380;
  lp.connect(out);
  const hum = [100, 200, 50].map((f, i) => {
    const o = c.createOscillator();
    o.type = i === 1 ? "sawtooth" : "sine";
    o.frequency.value = f;
    const g = c.createGain();
    g.gain.value = [0.018, 0.006, 0.02][i];
    o.connect(g).connect(lp);
    o.start();
    return o;
  });
  const buzz = setInterval(() => {
    if (sound.isMuted()) return;
    if (Math.random() < 0.35) noise({ dur: 0.08 + Math.random() * 0.25, vol: 0.03, type: "bandpass", f0: 2400, q: 6 });
    if (Math.random() < 0.08) tone({ f0: 45, f1: 40, dur: 1.5, vol: 0.04, attack: 0.4 });
  }, 1700);
  return () => {
    clearInterval(buzz);
    try {
      out.gain.linearRampToValueAtTime(0, c.currentTime + 0.4);
      hum.forEach((o) => o.stop(c.currentTime + 0.5));
    } catch {}
  };
}

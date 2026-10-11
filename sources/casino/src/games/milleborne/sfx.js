// Bruitages du Mille Bornes, synthétisés (aucun fichier audio). Respecte le bouton muet du casino.
import { sound } from "../../lib/sound.js";

let ctx = null;
function audio() {
  if (sound.isMuted()) return null;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
  } catch {
    return null;
  }
  return ctx;
}

function osc(type, f0, f1, dur, vol, delay = 0, filter) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.04, dur / 4));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = o.connect(g);
  if (filter) {
    const f = a.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = filter;
    node = node.connect(f);
  }
  node.connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function hiss(dur, vol, { delay = 0, type = "highpass", freq = 1500, decay = true } = {}) {
  const a = audio();
  if (!a) return;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (decay ? 1 - i / d.length : 1);
  const src = a.createBufferSource();
  const f = a.createBiquadFilter();
  const g = a.createGain();
  f.type = type;
  f.frequency.value = freq;
  g.gain.value = vol;
  src.buffer = buf;
  src.connect(f).connect(g).connect(a.destination);
  src.start(a.currentTime + delay);
}

export const sfx = {
  /** Moteur qui monte en régime : plus la distance est grande, plus il tire. */
  engine(km = 100) {
    const dur = 0.9 + km / 220;
    osc("sawtooth", 55, 70 + km * 0.7, dur, 0.07, 0, 420);
    osc("square", 110, 140 + km * 1.4, dur, 0.025, 0.05, 700);
  },
  horn() {
    osc("square", 392, 392, 0.22, 0.05, 0, 1800);
    osc("square", 494, 494, 0.22, 0.04, 0, 1800);
    osc("square", 392, 392, 0.32, 0.05, 0.28, 1800);
    osc("square", 494, 494, 0.32, 0.04, 0.28, 1800);
  },
  crash() {
    hiss(0.7, 0.35, { type: "lowpass", freq: 900 });
    osc("sine", 120, 35, 0.5, 0.25);
    hiss(0.4, 0.12, { delay: 0.12, freq: 3500 });
  },
  puncture() {
    hiss(0.09, 0.25, { type: "bandpass", freq: 2500 });
    hiss(1.1, 0.12, { delay: 0.08, freq: 4000 });
  },
  sputter() {
    for (let i = 0; i < 5; i++) osc("sawtooth", 70 - i * 6, 50 - i * 6, 0.12, 0.08 - i * 0.012, i * 0.2, 500);
  },
  brake() {
    osc("sawtooth", 1300, 900, 0.6, 0.03, 0, 2600);
    hiss(0.5, 0.06, { freq: 2500 });
  },
  limit() {
    osc("triangle", 660, 660, 0.15, 0.05);
    osc("triangle", 440, 440, 0.25, 0.05, 0.17);
  },
  green() {
    osc("sine", 880, 880, 0.1, 0.06);
    osc("sine", 1320, 1320, 0.16, 0.06, 0.13);
  },
  repair() {
    [0, 0.14, 0.28].forEach((d, i) => osc("triangle", 1600 - i * 200, 900, 0.08, 0.06, d));
  },
  safety() {
    [523, 659, 784].forEach((f, i) => osc("triangle", f, f, 0.22, 0.06, i * 0.1));
  },
  coup() {
    [392, 523, 659, 784, 1047].forEach((f, i) => osc("square", f, f, 0.18, 0.04, i * 0.08, 2400));
    osc("triangle", 1047, 1047, 0.6, 0.06, 0.42);
    setTimeout(() => sfx.horn(), 700);
  },
  whoosh() {
    hiss(0.25, 0.08, { type: "bandpass", freq: 1200 });
  },
  finish() {
    sfx.horn();
    [523, 659, 784, 1047, 1319].forEach((f, i) => osc("triangle", f, f, 0.3, 0.06, 0.6 + i * 0.12));
  },
};

/** Son associé à une carte posée. */
export function playCardSound(e) {
  if (!e) return;
  const k = e.card.k;
  if (e.kind === "discard") return sfx.whoosh();
  if (e.kind === "dist") return sfx.engine(Number(k));
  if (e.kind === "safety") return sfx.safety();
  if (e.kind === "remedy") return k === "go" ? sfx.green() : k === "unlim" ? sfx.green() : sfx.repair();
  sfx.whoosh();
}

/** Son de l'attaque quand elle frappe (fin de la fenêtre du coup fourré). */
export function playHazardSound(k) {
  ({ acc: sfx.crash, flat: sfx.puncture, gas: sfx.sputter, stop: sfx.brake, limit: sfx.limit })[k]?.();
}

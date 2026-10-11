// Moteur (oscillateur suivant la vitesse) et bips de course. Respecte la coupure de son du Casino.
import { sound } from "../../lib/sound.js";

let ctx = null, osc = null, osc2 = null, gain = null;

function audio() {
  if (sound.isMuted()) return null;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
  } catch { return null; }
  return ctx;
}

export function beep(freq = 660, dur = 0.12, vol = 0.07, type = "square") {
  const c = audio();
  if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, c.currentTime);
  g.gain.exponentialRampToValueAtTime(1e-4, c.currentTime + dur);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + dur);
}

export function engine(speed, boost) {
  const c = audio();
  if (!c) { stopEngine(); return; }
  if (!osc) {
    osc = c.createOscillator();
    osc2 = c.createOscillator();
    gain = c.createGain();
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 900;
    osc.type = "sawtooth";
    osc2.type = "square";
    gain.gain.value = 0;
    osc.connect(f);
    osc2.connect(f);
    f.connect(gain).connect(c.destination);
    osc.start();
    osc2.start();
  }
  // régime simulé avec 5 rapports
  const gearTop = [18, 34, 52, 72, 200];
  let g = 0;
  while (g < 4 && speed > gearTop[g]) g++;
  const lo = g ? gearTop[g - 1] : 0;
  const r = Math.min(1, (speed - lo) / (gearTop[g] - lo || 1));
  const f = 55 + r * 70 + g * 6 + (boost ? 20 : 0);
  osc.frequency.setTargetAtTime(f, c.currentTime, 0.04);
  osc2.frequency.setTargetAtTime(f * 0.5, c.currentTime, 0.04);
  gain.gain.setTargetAtTime(0.025 + Math.min(speed, 100) * 0.0004, c.currentTime, 0.05);
}

export function stopEngine() {
  if (!osc) return;
  try { osc.stop(); osc2.stop(); } catch {}
  osc = osc2 = gain = null;
}

export const sfx = {
  tick: () => beep(520, 0.15, 0.08),
  go: () => beep(1040, 0.35, 0.09),
  cp: () => { beep(880, 0.08, 0.06, "triangle"); beep(1320, 0.12, 0.06, "triangle"); },
  boost: () => beep(300, 0.25, 0.05, "sawtooth"),
  finish: () => [660, 880, 1100, 1320].forEach((f, i) => setTimeout(() => beep(f, 0.18, 0.07, "triangle"), i * 90)),
  respawn: () => beep(220, 0.12, 0.05),
  missing: () => beep(180, 0.3, 0.06, "sawtooth"),
};

let audioCtx = null;

let muted = false;

try {
  muted = localStorage.getItem("bj3d-mute") === "1";
} catch {}

const getAudio = () => {
  if (muted) return null;
  try {
    audioCtx =
      audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  } catch {
    return null;
  }
  return audioCtx;
};

function tone(freq, duration, type = "sine", volume = 0.06, delay = 0) {
  const ctx = getAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const at = ctx.currentTime + delay;
  gain.gain.setValueAtTime(volume, at);
  gain.gain.exponentialRampToValueAtTime(1e-4, at + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + duration);
}

function noise(duration, volume = 0.05, delay = 0) {
  const ctx = getAudio();
  if (!ctx) return;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 1800;
  gain.gain.value = volume;
  src.buffer = buffer;
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start(ctx.currentTime + delay);
}

export const sound = {
  card: () => noise(0.08, 0.06),
  chip: () => {
    tone(1400, 0.05, "triangle", 0.05);
    tone(2100, 0.04, "triangle", 0.03, 0.02);
  },
  win: () =>
    [523, 659, 784, 1047].forEach((freq, i) =>
      tone(freq, 0.25, "triangle", 0.06, i * 0.09),
    ),
  lose: () => {
    tone(220, 0.3, "sawtooth", 0.04);
    tone(165, 0.4, "sawtooth", 0.04, 0.12);
  },
  turn: () => tone(880, 0.12, "sine", 0.05),
  // Petits chevaux
  dice: () => {
    for (let i = 0; i < 7; i++) noise(0.04, 0.07, i * 0.09 + Math.random() * 0.04);
    tone(320, 0.06, "square", 0.02, 0.7);
  },
  diceLand: () => {
    noise(0.06, 0.09);
    tone(180, 0.08, "triangle", 0.06);
  },
  hop: (i = 0) => {
    tone(520 + (i % 2) * 90, 0.07, "triangle", 0.05);
    tone(140, 0.05, "sine", 0.06, 0.02);
  },
  six: () => [784, 988, 1175].forEach((f, i) => tone(f, 0.16, "triangle", 0.05, i * 0.07)),
  capture: () => {
    noise(0.25, 0.1);
    tone(400, 0.5, "sawtooth", 0.05);
    tone(200, 0.6, "sawtooth", 0.04, 0.15);
  },
  neigh: () => {
    const ctx = getAudio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    lfo.frequency.value = 22;
    lg.gain.value = 60;
    lfo.connect(lg).connect(osc.frequency);
    const t = ctx.currentTime;
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.exponentialRampToValueAtTime(1300, t + 0.2);
    osc.frequency.exponentialRampToValueAtTime(500, t + 0.9);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.04, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + 1);
    lfo.stop(t + 1);
  },
  fanfare: () =>
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.3, "square", 0.035, i * 0.13)),
  isMuted: () => muted,
  toggle: () => {
    muted = !muted;
    try {
      localStorage.setItem("bj3d-mute", muted ? "1" : "0");
    } catch {}
    return muted;
  },
};

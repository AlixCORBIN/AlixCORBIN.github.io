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
  isMuted: () => muted,
  toggle: () => {
    muted = !muted;
    try {
      localStorage.setItem("bj3d-mute", muted ? "1" : "0");
    } catch {}
    return muted;
  },
};

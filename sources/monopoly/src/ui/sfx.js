// Bruitages synthétisés (Web Audio, aucun fichier à charger)
const KEY = 'mono-sfx'
export const CATEGORIES = {
  dice: 'Lancer de dés',
  move: 'Déplacement des pions',
  money: 'Argent (loyers, gains)',
  events: 'Achats, cartes, prison',
  turn: 'Ton tour / notifications',
}

const defaults = { muted: false, volume: 0.6, cats: Object.fromEntries(Object.keys(CATEGORIES).map((k) => [k, true])) }
let settings = load()
const listeners = new Set()

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY))
    return { ...defaults, ...s, cats: { ...defaults.cats, ...(s?.cats || {}) } }
  } catch { return structuredClone(defaults) }
}
export const getSfx = () => settings
export function setSfx(patch) {
  settings = { ...settings, ...patch, cats: { ...settings.cats, ...(patch.cats || {}) } }
  try { localStorage.setItem(KEY, JSON.stringify(settings)) } catch {}
  if (master) master.gain.value = settings.volume
  listeners.forEach((f) => f(settings))
}
export const onSfx = (f) => (listeners.add(f), () => listeners.delete(f))

let ctx, master, noiseBuf
function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext
    if (!C) return null
    ctx = new C()
    master = ctx.createGain()
    master.gain.value = settings.volume
    master.connect(ctx.destination)
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}
// Débloque l'audio au premier geste (politique autoplay)
if (typeof window !== 'undefined') {
  const unlock = () => { ac(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock) }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}

function tone(f, t0, dur, { type = 'sine', vol = 0.3, slide = 0, attack = 0.005 } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(f, t0)
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t0 + dur)
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(vol, t0 + attack)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
  o.connect(g).connect(master)
  o.start(t0); o.stop(t0 + dur + 0.02)
}
function noise(t0, dur, { vol = 0.3, freq = 2000, q = 1, type = 'bandpass' } = {}) {
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain()
  src.buffer = noiseBuf
  f.type = type; f.frequency.value = freq; f.Q.value = q
  g.gain.setValueAtTime(vol, t0)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
  src.connect(f).connect(g).connect(master)
  src.start(t0, Math.random() * 0.3); src.stop(t0 + dur + 0.02)
}

const SOUNDS = {
  roll: ['dice', (t) => { for (let i = 0; i < 9; i++) noise(t + i * 0.07 + Math.random() * 0.03, 0.05, { vol: 0.35, freq: 1800 + Math.random() * 1800, q: 4 }) }],
  land: ['dice', (t) => { noise(t, 0.08, { vol: 0.5, freq: 900, q: 3 }); noise(t + 0.09, 0.06, { vol: 0.3, freq: 1300, q: 3 }); tone(160, t, 0.08, { vol: 0.2 }) }],
  double: ['dice', (t) => { tone(660, t, 0.12, { type: 'triangle', vol: 0.18 }); tone(990, t + 0.1, 0.18, { type: 'triangle', vol: 0.18 }) }],
  step: ['move', (t) => { tone(520 + Math.random() * 60, t, 0.05, { type: 'triangle', vol: 0.12 }); noise(t, 0.03, { vol: 0.08, freq: 3000, q: 2 }) }],
  gain: ['money', (t) => { tone(1318, t, 0.12, { type: 'square', vol: 0.06 }); tone(1760, t + 0.08, 0.25, { type: 'square', vol: 0.06 }) }],
  pay: ['money', (t) => { tone(392, t, 0.14, { type: 'triangle', vol: 0.22 }); tone(294, t + 0.12, 0.22, { type: 'triangle', vol: 0.22 }) }],
  buy: ['events', (t) => { noise(t, 0.05, { vol: 0.25, freq: 4000, q: 1 }); [784, 988, 1175].forEach((f, i) => tone(f, t + 0.05 + i * 0.07, 0.3, { type: 'triangle', vol: 0.15 })) }],
  build: ['events', (t) => { noise(t, 0.06, { vol: 0.4, freq: 500, q: 2 }); noise(t + 0.12, 0.06, { vol: 0.35, freq: 600, q: 2 }) }],
  card: ['events', (t) => { noise(t, 0.25, { vol: 0.2, freq: 1200, q: 0.7, type: 'highpass' }); tone(880, t + 0.15, 0.2, { vol: 0.08 }) }],
  jail: ['events', (t) => { [440, 370, 311, 262].forEach((f, i) => tone(f, t + i * 0.13, 0.2, { type: 'sawtooth', vol: 0.08 })); noise(t + 0.55, 0.15, { vol: 0.4, freq: 300, q: 2 }) }],
  bid: ['events', (t) => tone(1046, t, 0.08, { type: 'square', vol: 0.06 })],
  turn: ['turn', (t) => { [523, 659, 784].forEach((f, i) => tone(f, t + i * 0.09, 0.35, { vol: 0.16 })) }],
  error: ['turn', (t) => tone(200, t, 0.18, { type: 'square', vol: 0.06, slide: -60 })],
  win: ['turn', (t) => { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, t + i * 0.12, 0.3, { type: 'triangle', vol: 0.16 })) }],
}

export function sfx(name) {
  const def = SOUNDS[name]
  if (!def || settings.muted || !settings.cats[def[0]]) return
  if (!ac() || ctx.state !== 'running') return
  def[1](ctx.currentTime + 0.01)
}

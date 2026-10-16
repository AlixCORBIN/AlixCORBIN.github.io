// Réglages du joueur (mémorisés sur l'appareil) : sensibilité de direction au clavier et à la manette.
// Ils agissent sur les entrées AVANT leur enregistrement : le rejeu serveur reste identique à la course jouée.
const KEY = "racing-settings";
export const DEFAULTS = { kbSens: 1, padSens: 1, padDead: 0.14, live: true };
let cur = { ...DEFAULTS };
try { cur = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch {}
const subs = new Set();
export const getSettings = () => cur;
export function setSettings(patch) {
  cur = { ...cur, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch {}
  subs.forEach((f) => f(cur));
}
export function subscribeSettings(f) { subs.add(f); return () => subs.delete(f); }

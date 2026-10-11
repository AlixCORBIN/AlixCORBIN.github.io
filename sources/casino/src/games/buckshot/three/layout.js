// Géométrie de la table et chronologie des animations, partagées par la scène et le HUD.
import React from "react";

export const TABLE_Y = 1.0;
export const TABLE_R = 2.25;
export const SEAT_R = 3.05;
export const CAM = { x: 0, y: 2.9, z: 3.95 };

// Étapes d'un tir (ms depuis le début de l'événement)
export const SHOT = { lift: 300, aim: 1500, fire: 2500, pump: 3000, eject: 3150, land: 3500, back: 3500, end: 4200 };
// Étapes d'un objet
export const ITEM = { rise: 600, go: 1300, fx: 700, fade: 2000, end: 2700 };
export const ADRENALINE_LEAD = 1700;

export const clamp01 = (x) => Math.max(0, Math.min(1, x));
export const ease = (x) => {
  const k = clamp01(x);
  return k * k * (3 - 2 * k);
};

// Siège relatif : 0 = moi (devant la caméra), puis dans le sens horaire vu de dessus.
export function seatOf(rel, n) {
  const a = (-rel * Math.PI * 2) / n;
  const ux = Math.sin(a);
  const uz = Math.cos(a);
  return { a, ux, uz, tx: uz, tz: -ux };
}

export const at = (s, r, y = TABLE_Y) => [s.ux * r, y, s.uz * r];

// Emplacements du plateau d'objets (2 rangées de 4) devant chaque joueur
export function slotPos(s, k) {
  const col = k % 4;
  const row = Math.floor(k / 4);
  const r = 1.36 + row * 0.33;
  const off = (col - 1.5) * 0.33;
  return [s.ux * r + s.tx * off, TABLE_Y + 0.02, s.uz * r + s.tz * off];
}

// Douilles éjectées : alignées derrière le fusil
export function spentPos(i) {
  const j = (((i * 2654435761) >>> 0) % 1000) / 1000;
  return [-0.95 + i * 0.27, TABLE_Y + 0.03, -0.62 + (j - 0.5) * 0.18, (j - 0.5) * 1.2];
}

// Temps écoulé depuis le début de l'événement courant, rafraîchi pendant l'animation
export function useEventTime(ev, step = 100) {
  const ref = React.useRef({ id: null, t0: 0 });
  if ((ev?.id ?? null) !== ref.current.id) ref.current = { id: ev?.id ?? null, t0: performance.now() };
  const [, force] = React.useState(0);
  React.useEffect(() => {
    if (!ev) return;
    const t = setInterval(() => force((x) => x + 1), step);
    return () => clearInterval(t);
  }, [ev?.id]);
  return ev ? performance.now() - ref.current.t0 : 0;
}

// Charges affichées : un tir réel retire les charges dès la détonation, avant la résolution
export function shownHp(p, ev, t) {
  if (ev?.type === "shot" && ev.live && ev.target === p.id && t >= SHOT.fire) return Math.max(0, p.hp - ev.dmg);
  return p.hp;
}

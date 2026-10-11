// Manettes : détection (branchement / débranchement), manette active, vibrations, navigation dans les menus.
// Mapping « standard » du navigateur : A=0 B=1 X=2 Y=3 LB=4 RB=5 LT=6 RT=7 Select=8 Start=9 L3=10 R3=11 croix=12..15.
import React from "react";

export const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, SELECT: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

let active = null; // index de la manette utilisée en dernier
const listeners = new Set();
const emit = () => listeners.forEach((f) => f());

export function padKind(id = "") {
  const s = id.toLowerCase();
  if (/xbox|xinput|045e/.test(s)) return "xbox";
  if (/054c|playstation|dualsense|dualshock/.test(s)) return "playstation";
  if (/057e|nintendo|pro controller|joy-con/.test(s)) return "switch";
  if (/wireless controller/.test(s)) return "playstation";
  return "generic";
}

// Libellés des boutons selon la marque
const LABELS = {
  xbox: { A: "A", B: "B", X: "X", Y: "Y", LT: "LT", RT: "RT", RB: "RB", START: "Menu" },
  playstation: { A: "✕", B: "○", X: "□", Y: "△", LT: "L2", RT: "R2", RB: "R1", START: "Options" },
  switch: { A: "B", B: "A", X: "Y", Y: "X", LT: "ZL", RT: "ZR", RB: "R", START: "+" },
  generic: { A: "A", B: "B", X: "X", Y: "Y", LT: "LT", RT: "RT", RB: "RB", START: "Start" },
};
export const padLabels = (kind) => LABELS[kind] || LABELS.generic;

function pads() {
  try { return [...(navigator.getGamepads?.() || [])].filter(Boolean); } catch { return []; }
}

// Manette active : la dernière qui a bougé, sinon la première branchée
export function getPad() {
  const list = pads();
  if (!list.length) return null;
  const busy = list.find((p) => p.buttons.some((b) => b.pressed) || p.axes.some((a) => Math.abs(a) > 0.3));
  if (busy && busy.index !== active) { active = busy.index; emit(); }
  return list.find((p) => p.index === active) || list[0];
}

if (typeof window !== "undefined") {
  addEventListener("gamepadconnected", (e) => { active = e.gamepad.index; emit(); });
  addEventListener("gamepaddisconnected", (e) => { if (active === e.gamepad.index) active = null; emit(); });
}

// Etat React : manette branchée ? (certains navigateurs n'annoncent la manette qu'au premier appui)
export function useGamepad() {
  const read = () => {
    const p = pads().find((x) => x.index === active) || pads()[0];
    return p ? { id: p.id, index: p.index, kind: padKind(p.id) } : null;
  };
  const [pad, setPad] = React.useState(read);
  React.useEffect(() => {
    const up = () => setPad(read());
    listeners.add(up);
    const t = setInterval(up, 1000);
    return () => { listeners.delete(up); clearInterval(t); };
  }, []);
  return pad;
}

export function rumble(strong = 0.5, weak = 0.5, ms = 120) {
  const p = getPad();
  const act = p?.vibrationActuator;
  try {
    if (act?.playEffect) act.playEffect("dual-rumble", { duration: ms, strongMagnitude: strong, weakMagnitude: weak });
    else p?.hapticActuators?.[0]?.pulse?.(Math.max(strong, weak), ms);
  } catch {}
}

// Zone morte radiale + courbe douce pour un braquage précis
export function stick(x, dead = 0.14) {
  const a = Math.abs(x);
  if (a < dead) return 0;
  const v = (a - dead) / (1 - dead);
  return Math.sign(x) * Math.min(1, v * (0.55 + 0.45 * v));
}

// Fronts montants des boutons, appelés à chaque interrogation
export function edgeWatcher() {
  let prev = [];
  return (p) => {
    const now = p ? p.buttons.map((b) => b.pressed) : [];
    const before = prev;
    const hit = (i) => now[i] && !before[i];
    const axes = p ? p.axes : [];
    const out = { hit, now, axes };
    prev = now;
    return out;
  };
}

/* ---------- Navigation au pad dans les menus ----------
   Croix ou stick : déplace le focus vers le bouton le plus proche dans la direction ; A valide ; B retour. */
const FOCUSABLE = "button:not([disabled]), input, select, a[href]";
function visible(el) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(el).visibility !== "hidden";
}
function moveFocus(root, dx, dy) {
  const all = [...root.querySelectorAll(FOCUSABLE)].filter(visible);
  if (!all.length) return;
  const cur = document.activeElement && all.includes(document.activeElement) ? document.activeElement : null;
  if (!cur) { all[0].focus({ preventScroll: false }); return; }
  const a = cur.getBoundingClientRect();
  const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best = null, bestScore = Infinity;
  for (const el of all) {
    if (el === cur) continue;
    const b = el.getBoundingClientRect();
    const vx = b.left + b.width / 2 - ax, vy = b.top + b.height / 2 - ay;
    const along = vx * dx + vy * dy;
    if (along <= 4) continue;
    const across = Math.abs(vx * dy - vy * dx);
    const score = along + across * 2.5;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  if (best) { best.focus(); best.scrollIntoView({ block: "nearest", inline: "nearest" }); }
}

export function useGamepadNav(enabled, { onBack, root } = {}) {
  const back = React.useRef(onBack);
  back.current = onBack;
  React.useEffect(() => {
    if (!enabled) return;
    const watch = edgeWatcher();
    let repeatAt = 0, lastDir = "";
    const t = setInterval(() => {
      const p = getPad();
      if (!p) return;
      const { hit, now, axes } = watch(p);
      const container = (root?.current) || document.body;
      const sx = axes[0] || 0, sy = axes[1] || 0;
      const dir = now[BTN.UP] || sy < -0.6 ? "u" : now[BTN.DOWN] || sy > 0.6 ? "d" : now[BTN.LEFT] || sx < -0.6 ? "l" : now[BTN.RIGHT] || sx > 0.6 ? "r" : "";
      const t0 = performance.now();
      if (dir && (dir !== lastDir || t0 > repeatAt)) {
        const [dx, dy] = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] }[dir];
        moveFocus(container, dx, dy);
        repeatAt = t0 + (dir !== lastDir ? 380 : 140);
      }
      lastDir = dir;
      if (hit(BTN.A)) {
        const el = document.activeElement;
        if (el && el !== document.body && container.contains(el)) el.click();
        else moveFocus(container, 0, 1);
      }
      if (hit(BTN.B)) back.current?.();
    }, 40);
    return () => clearInterval(t);
  }, [enabled]);
}

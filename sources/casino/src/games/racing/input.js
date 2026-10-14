// Entrées : clavier (flèches / ZQSD / WASD), manette (n'importe laquelle, branchée à chaud), boutons tactiles.
import { BTN, edgeWatcher, getPad, stick } from "./gamepad.js";
import { getSettings } from "./settings.js";

const keys = new Set();
export const touch = { up: false, down: false, left: false, right: false, drift: false };

const MAP = {
  ArrowUp: "up", KeyW: "up", KeyZ: "up",
  ArrowDown: "down", KeyS: "down",
  ArrowLeft: "left", KeyA: "left", KeyQ: "left",
  ArrowRight: "right", KeyD: "right",
  Space: "drift", ShiftLeft: "drift",
};

export function bindKeys({ onRestart, onRespawn, onEscape }) {
  const down = (e) => {
    if (e.target instanceof HTMLInputElement) return;
    const k = MAP[e.code];
    if (k) { keys.add(k); e.preventDefault(); }
    if (e.repeat) return;
    if (e.code === "KeyR" || e.code === "Delete") onRestart?.();
    if (e.code === "Enter" || e.code === "Backspace") { e.preventDefault(); onRespawn?.(); }
    if (e.code === "Escape") onEscape?.();
  };
  const up = (e) => { const k = MAP[e.code]; if (k) keys.delete(k); };
  const blur = () => keys.clear();
  addEventListener("keydown", down);
  addEventListener("keyup", up);
  addEventListener("blur", blur);
  // manette (fronts montants) : Y/△ recommencer, B/○ réapparaître, Start/Options menu
  const watch = edgeWatcher();
  const poll = setInterval(() => {
    const p = getPad();
    if (!p) return;
    const { hit } = watch(p);
    if (hit(BTN.Y) || hit(BTN.SELECT)) onRestart?.();
    if (hit(BTN.B)) onRespawn?.();
    if (hit(BTN.START)) onEscape?.();
  }, 30);
  return () => {
    removeEventListener("keydown", down);
    removeEventListener("keyup", up);
    removeEventListener("blur", blur);
    clearInterval(poll);
    keys.clear();
  };
}

let kbSteer = 0, kbLast = 0;

export function readInput() {
  let throttle = keys.has("up") || touch.up ? 1 : 0;
  let brake = keys.has("down") || touch.down ? 1 : 0;
  const st = getSettings();
  // clavier : la direction monte progressivement vers la butée ; la sensibilité règle la vitesse de montée
  const now = performance.now();
  const dt = Math.min(0.1, (now - (kbLast || now)) / 1000);
  kbLast = now;
  const target = (keys.has("right") || touch.right ? 1 : 0) - (keys.has("left") || touch.left ? 1 : 0);
  const rate = 4 * st.kbSens; // butée atteinte en 1/(4×sensi) s ; sensi max = instantané
  if (st.kbSens >= 3 || !target) kbSteer = target;
  else if (Math.sign(kbSteer) !== Math.sign(target)) kbSteer = Math.sign(target) * Math.min(1, rate * dt);
  else kbSteer = Math.sign(target) * Math.min(1, Math.abs(kbSteer) + rate * dt);
  let steer = kbSteer;
  let drift = keys.has("drift") || touch.drift;
  const p = getPad();
  if (p) {
    const b = (i) => p.buttons[i] || { pressed: false, value: 0 };
    // manette : zone morte et multiplicateur réglables
    const pad = Math.max(-1, Math.min(1, stick(p.axes[0] || 0, st.padDead) * st.padSens)) + (b(BTN.RIGHT).pressed ? 1 : 0) - (b(BTN.LEFT).pressed ? 1 : 0);
    if (pad) steer = Math.max(-1, Math.min(1, steer + pad));
    // gâchettes analogiques (RT / LT), A et croix haut/bas en tout-ou-rien
    const rt = b(BTN.RT).value || (b(BTN.RT).pressed ? 1 : 0);
    const lt = b(BTN.LT).value || (b(BTN.LT).pressed ? 1 : 0);
    throttle = Math.max(throttle, rt > 0.05 ? rt : 0, b(BTN.A).pressed || b(BTN.UP).pressed ? 1 : 0);
    brake = Math.max(brake, lt > 0.05 ? lt : 0, b(BTN.DOWN).pressed ? 1 : 0);
    drift = drift || b(BTN.X).pressed || b(BTN.RB).pressed || b(BTN.LB).pressed;
  }
  return { throttle, brake, steer, drift };
}

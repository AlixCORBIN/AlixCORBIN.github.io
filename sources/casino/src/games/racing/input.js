// Entrées : clavier (flèches / ZQSD / WASD), manette, boutons tactiles.
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
  // boutons manette (front montant) : Y/Triangle = recommencer, B/Rond = réapparaître, Start = menu
  let prevPad = {};
  const poll = setInterval(() => {
    const p = navigator.getGamepads?.()[0];
    if (!p) return;
    const b = (i) => !!p.buttons[i]?.pressed;
    const now = { y: b(3), b: b(1), start: b(9) };
    if (now.y && !prevPad.y) onRestart?.();
    if (now.b && !prevPad.b) onRespawn?.();
    if (now.start && !prevPad.start) onEscape?.();
    prevPad = now;
  }, 30);
  return () => {
    removeEventListener("keydown", down);
    removeEventListener("keyup", up);
    removeEventListener("blur", blur);
    clearInterval(poll);
    keys.clear();
  };
}

export function readInput() {
  let throttle = keys.has("up") || touch.up ? 1 : 0;
  let brake = keys.has("down") || touch.down ? 1 : 0;
  let steer = (keys.has("right") || touch.right ? 1 : 0) - (keys.has("left") || touch.left ? 1 : 0);
  let drift = keys.has("drift") || touch.drift;
  const p = navigator.getGamepads?.()[0];
  if (p) {
    const ax = p.axes[0] || 0;
    if (Math.abs(ax) > 0.12) steer = Math.max(-1, Math.min(1, steer + ax));
    throttle = Math.max(throttle, p.buttons[7]?.value || 0, p.buttons[0]?.pressed ? 1 : 0);
    brake = Math.max(brake, p.buttons[6]?.value || 0);
    drift = drift || !!p.buttons[2]?.pressed || !!p.buttons[5]?.pressed;
  }
  return { throttle, brake, steer, drift };
}

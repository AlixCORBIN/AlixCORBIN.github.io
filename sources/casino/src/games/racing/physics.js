// Physique arcade déterministe à pas fixe (même entrée = même trajectoire), en dehors de React.
import { LEVEL_H, TILE, cellCenter, gateId } from "./track.js";

export const DT = 1 / 100; // 100 Hz, 1 pas = 10 ms de chrono
export const GHOST_EVERY = 5; // un point de fantôme tous les 5 pas (50 ms)

const G = 42;
const MAX = 78; // vitesse de pointe sur route (u/s)
const MAX_BOOST = 108;
const ACCEL = 34;
const BRAKE = 70;
const REVERSE = 22;

// Réglages par monde (adhérence, tout-terrain)
export const WORLDS = [
  { id: "stadium", name: "Stadium", grip: 1, offroad: 0.55, sky: "#7fc4ff", fog: "#bfe3ff", ground: "#4f9a3c", road: "#3a3d44", accent: "#ffd23f" },
  { id: "desert", name: "Canyon", grip: 0.9, offroad: 0.6, sky: "#ffc98a", fog: "#f3d2a2", ground: "#d9a45f", road: "#5a4a3a", accent: "#ff7a2f" },
  { id: "snow", name: "Glacier", grip: 0.55, offroad: 0.5, sky: "#cfe6ff", fog: "#eef6ff", ground: "#f1f6fb", road: "#6c7f95", accent: "#3fd3ff" },
  { id: "forest", name: "Forêt", grip: 0.85, offroad: 0.45, sky: "#9fd3b0", fog: "#c9e8cf", ground: "#2f6b33", road: "#4a3d33", accent: "#a6ff4d" },
  { id: "neon", name: "Néon", grip: 1.1, offroad: 0.5, sky: "#120a2a", fog: "#1a0f3a", ground: "#140c2e", road: "#1c1c2c", accent: "#ff3fd8", night: true },
];

export function createCar(spawn) {
  const yaw = (spawn.heading * Math.PI) / 2;
  return {
    x: spawn.x, y: spawn.y, z: spawn.z, yaw,
    vx: 0, vz: 0, vy: 0,
    grounded: true, boost: 0, surface: "road", steerVis: 0, slip: 0,
  };
}

export function createRun(track) {
  const s = track.spawnOn(track.start);
  return {
    car: createCar(s),
    steps: 0,
    cps: new Set(),
    lastSpawn: { ...s, yaw: (s.heading * Math.PI) / 2 },
    splits: [],
    finished: false,
    finishMs: null,
    ghost: [],
    events: [],
  };
}

export const speedOf = (c) => Math.hypot(c.vx, c.vz);

// Une étape : input = { throttle: 0..1, brake: 0..1, steer: -1..1, drift: bool }
export function step(run, track, world, input) {
  const c = run.car;
  run.events.length = 0;
  const fx = Math.sin(c.yaw), fz = -Math.cos(c.yaw);
  const rx = Math.cos(c.yaw), rz = Math.sin(c.yaw);
  let vf = c.vx * fx + c.vz * fz;
  let vr = c.vx * rx + c.vz * rz;

  const g0 = track.ground(c.x, c.z, c.y);
  const tile = c.grounded ? g0.tile : null;
  const onRoad = !!tile && tile.type !== "dirt";
  c.surface = !c.grounded ? "air" : tile ? (tile.type === "dirt" ? "dirt" : "road") : "grass";

  if (c.grounded && tile && tile.type === "boost") {
    if (c.boost <= 0) run.events.push("boost");
    c.boost = 1.6;
  }
  c.boost = Math.max(0, c.boost - DT);

  if (c.grounded) {
    const off = c.surface === "grass" ? world.offroad : c.surface === "dirt" ? 0.85 : 1;
    const top = (c.boost > 0 ? MAX_BOOST : MAX) * off;
    if (input.throttle > 0 && vf > -1) {
      const a = (c.boost > 0 ? ACCEL * 1.8 : ACCEL) * (1 - Math.min(Math.max(vf, 0) / top, 1) ** 2);
      vf += a * input.throttle * DT;
    }
    if (input.brake > 0) {
      if (vf > 1) vf -= BRAKE * input.brake * DT;
      else vf = Math.max(vf - REVERSE * input.brake * DT, -20);
    }
    if (!input.throttle && !input.brake) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 6 * DT);
    if (vf > top) vf += (top - vf) * Math.min(1, (c.surface === "grass" ? 2.5 : 1.2) * DT);
    vf -= vf * 0.002 * DT * Math.abs(vf);

    // Direction : vitesse de lacet selon la vitesse, plus de rotation en dérapage
    const sp = Math.abs(vf);
    const ramp = Math.min(sp / 12, 1);
    let rate = (2.7 - 1.0 * Math.min(sp / 90, 1)) * ramp;
    if (input.drift) rate *= 1.35;
    const yawRate = input.steer * rate * Math.sign(vf || 1);
    c.yaw += yawRate * DT;

    // Adhérence latérale
    let grip = 9 * world.grip;
    if (c.surface === "dirt") grip *= 0.5;
    if (c.surface === "grass") grip *= 0.7;
    if (input.drift && sp > 25) grip *= 0.22;
    const before = Math.abs(vr);
    vr *= Math.exp(-grip * DT);
    // Le glissement coûte un peu de vitesse
    vf -= Math.sign(vf) * Math.min(Math.abs(vf), (before - Math.abs(vr)) * 0.18);
    c.slip = Math.min(1, Math.abs(vr) / 18);
  } else {
    // En l'air : un peu de contrôle du lacet, pas d'accélération
    c.yaw += input.steer * 0.9 * DT;
  }
  c.steerVis += (input.steer - c.steerVis) * Math.min(1, 12 * DT);

  // Repère mis à jour avec le nouveau cap (la voiture tourne, la vitesse suit selon l'adhérence)
  const nfx = Math.sin(c.yaw), nfz = -Math.cos(c.yaw);
  const nrx = Math.cos(c.yaw), nrz = Math.sin(c.yaw);
  c.vx = nfx * vf + nrx * vr;
  c.vz = nfz * vf + nrz * vr;

  const ox = c.x, oz = c.z;
  c.x += c.vx * DT;
  c.z += c.vz * DT;

  // Vertical
  const hOld = track.ground(ox, oz, c.y).h;
  const gN = track.ground(c.x, c.z, c.y);
  c.vy -= G * DT;
  c.y += c.vy * DT;
  const wasGrounded = c.grounded;
  if (c.y <= gN.h) {
    if (!wasGrounded && c.vy < -25) run.events.push("land");
    c.y = gN.h;
    c.vy = Math.max(0, (gN.h - hOld) / DT);
    c.grounded = true;
  } else if (wasGrounded && c.y - gN.h < 0.9 && gN.h <= hOld + 0.01 && hOld - gN.h < 2) {
    // reste collé dans les descentes douces
    c.y = gN.h;
    c.vy = Math.min(0, (gN.h - hOld) / DT);
    c.grounded = true;
  } else {
    c.grounded = c.y - gN.h < 0.05;
  }

  run.steps++;

  // Portiques
  const cx = Math.floor(c.x / TILE), cz = Math.floor(c.z / TILE);
  const here = track.cells.get(`${cx},${cz}`);
  if (here) {
    for (const t of here) {
      if (Math.abs(c.y - t.level * LEVEL_H) > 7) continue;
      const [ccx, ccz] = cellCenter(t.x, t.z);
      // déclenché quand on passe à moins de 4 u du centre du bloc
      const near = Math.abs(c.x - ccx) < 6 && Math.abs(c.z - ccz) < 6;
      if (!near) continue;
      const id = gateId(t);
      if (t.type === "cp" && !run.cps.has(id)) {
        run.cps.add(id);
        run.splits.push(run.steps * 10);
        run.lastSpawn = { x: ccx, z: ccz, y: t.level * LEVEL_H + 0.5, yaw: snapYaw(c.yaw) };
        run.events.push("cp");
      } else if (t.type === "finish" && !run.finished && run.cps.size >= track.cps.length) {
        run.finished = true;
        run.finishMs = run.steps * 10;
        run.events.push("finish");
      } else if (t.type === "finish" && !run.finished && !run.lastMissing) {
        run.lastMissing = true;
        run.events.push("missing");
      }
    }
  }
  if (run.lastMissing && run.steps % 200 === 0) run.lastMissing = false;

  if (run.steps % GHOST_EVERY === 0) {
    run.ghost.push(Math.round(c.x * 10), Math.round(c.y * 10), Math.round(c.z * 10), Math.round(c.yaw * 100));
  }

  // Chute hors du monde
  const [w, h] = track.size;
  if (c.y < -40 || c.x < -TILE * 4 || c.z < -TILE * 4 || c.x > (w + 4) * TILE || c.z > (h + 4) * TILE) {
    respawn(run);
  }
}

function snapYaw(y) {
  const q = Math.PI / 2;
  return Math.round(y / q) * q;
}

export function respawn(run) {
  const s = run.lastSpawn;
  run.car = { ...createCar({ x: s.x, y: s.y, z: s.z, heading: 0 }), yaw: s.yaw };
  run.events.push("respawn");
}

// Lecture d'un fantôme : [x,y,z,yaw]*n en entiers -> pose interpolée au temps t (ms)
export function ghostPose(g, tMs) {
  if (!g || g.length < 8) return null;
  const n = g.length / 4;
  const f = tMs / (GHOST_EVERY * 10) - 1;
  const i = Math.max(0, Math.min(n - 2, Math.floor(f)));
  const a = Math.max(0, Math.min(1, f - i));
  if (f >= n - 1) return { x: g[(n - 1) * 4] / 10, y: g[(n - 1) * 4 + 1] / 10, z: g[(n - 1) * 4 + 2] / 10, yaw: g[(n - 1) * 4 + 3] / 100, done: true };
  const k = i * 4;
  const lerp = (o, s) => (g[k + o] + (g[k + 4 + o] - g[k + o]) * a) / s;
  return { x: lerp(0, 10), y: lerp(1, 10), z: lerp(2, 10), yaw: lerp(3, 100) };
}

export function formatTime(ms) {
  if (ms == null) return "--:--.---";
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), r = ms % 1000;
  return `${m}:${String(s).padStart(2, "0")}.${String(r).padStart(3, "0")}`;
}

// TrackMerdia : rejeu d'une course à partir des touches du joueur.
// La physique avance à pas fixe (1/100 s) : rejouer les mêmes entrées depuis le même départ
// redonne la même course. Le serveur (Edge Function racing-verify) calcule ainsi lui-même
// le temps et le fantôme ; le navigateur n'envoie plus que ses entrées.
import { createCar, createRun, createWorld, driveCar, placeCar, stepRun } from "../games/racing/physics.js";

export const COUNTDOWN_STEPS = 240; // 2,4 s de décompte, voiture posée au sol
export const IDLE = Object.freeze({ throttle: 0, brake: 0, steer: 0, drift: false });

// Entrées quantifiées (ce qui est réellement appliqué, côté navigateur comme côté serveur)
export function quantize(input) {
  const c = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round((Number(v) || 0) * 100)));
  return [c(input.throttle, 0, 100), c(input.brake, 0, 100), c(input.steer, -100, 100), input.drift ? 1 : 0];
}
export const toInput = (q) => ({ throttle: q[0] / 100, brake: q[1] / 100, steer: q[2] / 100, drift: !!q[3] });

// Journal : { v: 1, ev: [[pas, gaz, frein, direction, drift], …] (à chaque changement), r: [pas des réapparitions manuelles] }
export function createLog() {
  return { v: 1, ev: [], r: [], last: null };
}
export function logInput(log, step, q) {
  const l = log.last;
  if (!l || l[0] !== q[0] || l[1] !== q[1] || l[2] !== q[2] || l[3] !== q[3]) {
    log.ev.push([step, ...q]);
    log.last = q;
  }
}
export const exportLog = (log) => ({ v: 1, ev: log.ev, r: log.r });

export function validLog(log, maxSteps) {
  if (!log || log.v !== 1 || !Array.isArray(log.ev) || !Array.isArray(log.r)) return false;
  if (log.ev.length > maxSteps + 1 || log.r.length > 2000) return false;
  let prev = -1;
  for (const e of log.ev) {
    if (!Array.isArray(e) || e.length !== 5 || !e.every(Number.isInteger)) return false;
    if (e[0] <= prev || e[0] < 0 || e[1] < 0 || e[1] > 100 || e[2] < 0 || e[2] > 100 || e[3] < -100 || e[3] > 100 || (e[4] !== 0 && e[4] !== 1)) return false;
    prev = e[0];
  }
  prev = -1;
  for (const s of log.r) {
    if (!Number.isInteger(s) || s < prev || s < 0) return false;
    prev = s;
  }
  return true;
}

// Monde neuf + décompte : identique au départ d'une tentative dans le navigateur
export function startRace(track) {
  const phys = createWorld(track);
  const run = createRun(track);
  const car = createCar(phys, run.lastSpawn);
  placeCar(car, run.lastSpawn);
  return { phys, run, car };
}
export function countdownStep(s, world) {
  driveCar(s.phys, s.car, world, IDLE);
  s.phys.world.step();
}

export function replay(track, world, log, maxSteps) {
  const s = startRace(track);
  try {
    for (let i = 0; i < COUNTDOWN_STEPS; i++) countdownStep(s, world);
    let k = 0, r = 0, input = IDLE;
    const { run, car, phys } = s;
    while (!run.finished && run.steps < maxSteps) {
      while (k < log.ev.length && log.ev[k][0] <= run.steps) input = toInput(log.ev[k++].slice(1));
      while (r < log.r.length && log.r[r] <= run.steps) {
        if (log.r[r] === run.steps) placeCar(car, run.lastSpawn);
        r++;
      }
      stepRun(run, track, phys, car, world, input);
    }
    return { finished: run.finished, ms: run.finished ? run.finishMs : null, ghost: run.ghost, splits: run.splits, steps: run.steps };
  } finally {
    s.phys.world.free();
  }
}

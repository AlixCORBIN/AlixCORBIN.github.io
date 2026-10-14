// Pilote automatique de référence, réutilisable depuis d'autres scripts. Ses temps servent de temps auteur.
//   import { botRun } from "./bot-run.mjs"; const r = await botRun(track, world);  -> { finished, ms, steps, log, respawns }
// Il suit l'axe de la piste (racing-line.mjs) : direction vers un point visé devant lui, vitesse limitée par la
// courbure à venir (comme racing-check), entrées quantifiées et journalisées comme dans le navigateur.
import * as P from "../src/games/racing/physics.js";
import { BLOCKS } from "../src/games/racing/blocks.js";
import { COUNTDOWN_STEPS, countdownStep, createLog, exportLog, logInput, quantize, startRace, toInput } from "../src/server/replay.js";
import { racingLine } from "./racing-line.mjs";

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const dist = (a, b) => Math.hypot(...sub(a, b));
// blocs où la courbure de l'axe ne limite pas la vitesse (figures : loopings, murs, tunnels…)
const isFig = (type) => { const d = BLOCKS[type]; return !!(d && (d.figure || type === "loop" || type === "wall" || d.gravity)); };

export function speedLimit(line, idx, world, safe = 1) {
  let vmax = 200;
  for (let k = 4; k < 70; k += 3) {
    const i0 = Math.min(line.length - 1, idx + k), i1 = Math.min(line.length - 1, idx + k + 5), i2 = Math.min(line.length - 1, idx + k + 10);
    const a = line[i0], bb = line[i1], c = line[i2];
    if (isFig(a.type) || isFig(c.type) || a.slow != null) { if (a.slow != null) vmax = Math.min(vmax, a.slow + k * 0.5); continue; }
    const t1 = sub(bb.p, a.p), t2 = sub(c.p, bb.p);
    const u = a.u;
    const h1 = sub(t1, u.map((x) => x * dot(t1, u))), h2 = sub(t2, u.map((x) => x * dot(t2, u)));
    const l1 = Math.hypot(...h1), l2 = Math.hypot(...h2);
    if (l1 < 0.5 || l2 < 0.5) continue;
    const ang = Math.acos(Math.max(-1, Math.min(1, dot(h1, h2) / (l1 * l2))));
    if (ang < 0.02) continue;
    const R = ((l1 + l2) / 2) / ang;
    const bank = 1 + Math.max(0, 1 - u[1]) * 2.5;
    const grip = world.grip * (a.grip ?? 1);
    // sans sol sous la piste (saison 2), marge plus prudente : une sortie de piste est une chute
    const lim = Math.sqrt(R * 26 * bank * grip) * 1.12 * safe + k * 0.45 * Math.sqrt(grip) * safe * safe;
    vmax = Math.min(vmax, lim);
  }
  return vmax;
}

export async function botRun(track, world, { maxSteps = 100 * 120, trace = false, every = 50, tune = {}, hints = {} } = {}) {
  await P.initPhysics();
  const line = racingLine(track, hints);
  const s = startRace(track);
  const steerGain = tune.steerGain ?? 2.6, lookK = tune.lookK ?? 0.16;
  try {
    for (let i = 0; i < COUNTDOWN_STEPS; i++) countdownStep(s, world);
    const log = createLog();
    let idx = 0, respawns = 0, stuck = 0;
    while (!s.run.finished && s.run.steps < maxSteps) {
      const b = s.car.body.translation(), pos = [b.x, b.y, b.z];
      let best = idx, bd = Infinity;
      for (let i = Math.max(0, idx - 2); i < Math.min(line.length, idx + 60); i++) { const d = dist(line[i].p, pos); if (d < bd) { bd = d; best = i; } }
      idx = best;
      const fr = P.carFrame(s.car);
      const v = s.car.speed;
      const tgt = line[Math.min(line.length - 1, idx + Math.round(3 + v * lookK))].p;
      const rel = sub(tgt, pos);
      const steer = Math.max(-1, Math.min(1, Math.atan2(dot(rel, fr.right), Math.max(dot(rel, fr.fwd), 0.1)) * steerGain));
      const vmax = Math.min(speedLimit(line, idx, world, world.void ? tune.safe ?? 0.85 : 1), line[idx].vmax ?? 200);
      const over = v - vmax;
      const air = s.car.contacts === 0;
      const input = air
        ? { throttle: 0, brake: 0, steer: steer * 0.5, drift: false }
        : { throttle: over > 0 ? 0 : 1, brake: over > 3 ? Math.min(1, over / 8) : 0, steer, drift: false };
      const q = quantize(input);
      logInput(log, s.run.steps, q);
      P.stepRun(s.run, track, s.phys, s.car, world, toInput(q));
      if (s.run.events.includes("respawn")) {
        respawns++;
        const p = s.run.lastSpawn.p;
        let bi = 0, bdd = Infinity;
        for (let i = 0; i <= Math.min(line.length - 1, idx + 5); i++) { const d = dist(line[i].p, p); if (d < bdd) { bdd = d; bi = i; } }
        if (trace) console.log("RESPAWN", s.run.steps, pos.map((x) => x.toFixed(1)).join(" "), "idx", idx, line[idx].type, "->", bi);
        idx = bi;
      }
      if (respawns > 15) break;
      if (trace && s.run.steps % every === 0) console.log(s.run.steps, pos.map((x) => x.toFixed(1)).join(" "), "kmh", s.car.kmh, "vmax", Math.round(vmax * 3.6), "c", s.car.contacts, s.car.surface, "idx", idx, "/", line.length, line[idx].type, s.run.events.join(","));
    }
    return { finished: s.run.finished, ms: s.run.finishMs, steps: s.run.steps, log: exportLog(log), respawns, idx, len: line.length };
  } finally {
    s.phys.world.free();
  }
}

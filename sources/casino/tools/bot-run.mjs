// Pilote automatique de référence (même logique que tools/test-replay.mjs) réutilisable depuis d'autres scripts.
//   import { botRun } from "./bot-run.mjs"; const r = await botRun(track, world);  -> { finished, ms, steps, log }
import * as P from "../src/games/racing/physics.js";
import { COUNTDOWN_STEPS, countdownStep, createLog, exportLog, logInput, quantize, startRace, toInput } from "../src/server/replay.js";
import { racingLine } from "./racing-line.mjs";

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const dist = (a, b) => Math.hypot(...sub(a, b));

export async function botRun(track, world, { maxSteps = 100 * 120 } = {}) {
  await P.initPhysics();
  const line = racingLine(track);
  const s = startRace(track);
  try {
    for (let i = 0; i < COUNTDOWN_STEPS; i++) countdownStep(s, world);
    const log = createLog();
    let idx = 0;
    while (!s.run.finished && s.run.steps < maxSteps) {
      const b = s.car.body.translation(), pos = [b.x, b.y, b.z];
      let best = idx, bd = Infinity;
      for (let i = idx; i < Math.min(line.length, idx + 60); i++) { const d = dist(line[i].p, pos); if (d < bd) { bd = d; best = i; } }
      idx = best;
      const fr = P.carFrame(s.car);
      const tgt = line[Math.min(line.length - 1, idx + Math.round(3 + s.car.speed * 0.16))].p;
      const rel = sub(tgt, pos);
      const steer = Math.max(-1, Math.min(1, Math.atan2(dot(rel, fr.right), Math.max(dot(rel, fr.fwd), 0.1)) * 2.6));
      const input = { throttle: s.car.speed > 45 && Math.abs(steer) > 0.5 ? 0.3 : 1, brake: 0, steer, drift: false };
      const q = quantize(input);
      logInput(log, s.run.steps, q);
      P.stepRun(s.run, track, s.phys, s.car, world, toInput(q));
    }
    return { finished: s.run.finished, ms: s.run.finishMs, steps: s.run.steps, log: exportLog(log) };
  } finally {
    s.phys.world.free();
  }
}

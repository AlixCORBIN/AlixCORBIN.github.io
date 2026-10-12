// Vérifie que le rejeu serveur redonne exactement la course pilotée : node tools/test-replay.mjs [map]
import { OFFICIAL } from "../src/games/racing/maps.js";
import { Track } from "../src/games/racing/track.js";
import * as P from "../src/games/racing/physics.js";
import { COUNTDOWN_STEPS, countdownStep, createLog, exportLog, logInput, quantize, replay, startRace, toInput } from "../src/server/replay.js";
import { racingLine } from "./racing-line.mjs";

await P.initPhysics();
const id = process.argv[2] || "v2-1-1";
const map = OFFICIAL.find((m) => m.id === id);
const track = new Track(map.data), world = P.WORLDS[map.world];
const line = racingLine(track);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const dist = (a, b) => Math.hypot(...sub(a, b));

// pilote simple qui joue « comme un humain » (entrées analogiques, une réapparition manuelle)
const s = startRace(track);
for (let i = 0; i < COUNTDOWN_STEPS; i++) countdownStep(s, world);
const log = createLog();
let idx = 0;
while (!s.run.finished && s.run.steps < 100 * 120) {
  const b = s.car.body.translation(), pos = [b.x, b.y, b.z];
  let best = idx, bd = Infinity;
  for (let i = idx; i < Math.min(line.length, idx + 60); i++) { const d = dist(line[i].p, pos); if (d < bd) { bd = d; best = i; } }
  idx = best;
  const fr = P.carFrame(s.car);
  const tgt = line[Math.min(line.length - 1, idx + Math.round(3 + s.car.speed * 0.16))].p;
  const rel = sub(tgt, pos);
  const steer = Math.max(-1, Math.min(1, Math.atan2(dot(rel, fr.right), Math.max(dot(rel, fr.fwd), 0.1)) * 2.6));
  const input = { throttle: s.car.speed > 45 && Math.abs(steer) > 0.5 ? 0.3 : 1, brake: 0, steer, drift: false };
  if (s.run.steps === 1500) { log.r.push(s.run.steps); P.placeCar(s.car, s.run.lastSpawn); }
  const q = quantize(input);
  logInput(log, s.run.steps, q);
  P.stepRun(s.run, track, s.phys, s.car, world, toInput(q));
}
const live = { finished: s.run.finished, ms: s.run.finishMs, steps: s.run.steps, ghost: s.run.ghost };
const t0 = performance.now();
const rep = replay(track, world, exportLog(log), live.finished ? live.steps + 100 : live.steps);
const dt = performance.now() - t0;
const same = rep.steps === live.steps && rep.ms === live.ms && JSON.stringify(rep.ghost) === JSON.stringify(live.ghost);
console.log(`${id} pilote: ${live.finished ? live.ms + " ms" : "pas fini"} (${live.steps} pas, ${log.ev.length} changements)`);
console.log(`rejeu: ${rep.finished ? rep.ms + " ms" : "pas fini"} en ${dt.toFixed(0)} ms CPU -> ${same ? "IDENTIQUE" : "DIFFERENT"}`);
// triche : on annonce un autre journal (gaz à fond tout du long) -> ne doit pas finir pareil
const fake = replay(track, world, { v: 1, ev: [[0, 100, 0, 0, 0]], r: [] }, live.steps + 100);
console.log(`journal bidon: ${fake.finished ? fake.ms + " ms" : "pas fini"}`);
if (process.env.DUMP) (await import("node:fs")).writeFileSync(process.env.DUMP, JSON.stringify({ id, log: exportLog(log), ms: live.ms, ghost: live.ghost }));
process.exitCode = same ? 0 : 1;

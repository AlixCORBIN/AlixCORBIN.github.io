// Vide de la saison 2 : sur une piste de test, compare un monde à sol (Stadium) et un monde suspendu (Atelier).
// Vérifie : chute -> réapparition au dernier checkpoint, rejeu identique (2 fois), pilote auto à l'arrivée.
//   node tools/void-test.mjs
import { createHash } from "node:crypto";
import { placeFrom } from "../src/games/racing/blocks.js";
import { Track, normalizeTiles } from "../src/games/racing/track.js";
import * as P from "../src/games/racing/physics.js";
import { replay } from "../src/server/replay.js";
import { botRun } from "./bot-run.mjs";

const hash = (v) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 12);
function chain(items) {
  let r = placeFrom("start", 0, 0, 0, 2);
  const tiles = [[r.tile.x, r.tile.z, "start", r.tile.rot, r.tile.level]];
  let st = r.next;
  for (const [type, rev] of items) {
    r = placeFrom(type, st.x, st.z, st.d, st.l, !!rev);
    tiles.push([r.tile.x, r.tile.z, r.tile.type, r.tile.rot, r.tile.level]);
    st = r.next;
  }
  return normalizeTiles(tiles);
}
// départ en hauteur, checkpoint, virage à droite, descente, arrivée
const tiles = chain([["road"], ["road"], ["cp"], ["road"], ["bank"], ["road"], ["slope", true], ["road"], ["cp"], ["road"], ["bank", true], ["road"], ["cp"], ["road"], ["finish"], ["road"]]);
await P.initPhysics();
const S2W = P.WORLDS.findIndex((w) => w.void);
let bad = 0;
const check = (ok, msg) => { console.log(`${ok ? "OK    " : "ÉCHEC "} ${msg}`); if (!ok) bad++; };

// 1) gaz à fond tout droit : la voiture rate le virage
const LOG = { v: 1, ev: [[0, 100, 0, 0, 0]], r: [] };
for (const wi of [0, S2W]) {
  const data = { v: 2, world: wi, tiles };
  const track = new Track(data);
  const s = (() => { const phys = P.createWorld(track); const run = P.createRun(track); const car = P.createCar(phys, run.lastSpawn); P.placeCar(car, run.lastSpawn); return { phys, run, car }; })();
  let resp = 0, minY = Infinity, firstResp = null;
  for (let i = 0; i < 1500; i++) {
    P.stepRun(s.run, track, s.phys, s.car, P.WORLDS[wi], { throttle: 1, brake: 0, steer: 0, drift: false });
    const y = s.car.body.translation().y;
    minY = Math.min(minY, y);
    if (s.run.events.includes("respawn")) { resp++; firstResp ??= s.run.steps; }
  }
  s.phys.world.free();
  const name = P.WORLDS[wi].name;
  if (P.WORLDS[wi].void) check(resp > 0 && minY > -40, `${name} (vide) : ${resp} réapparition(s), 1re au pas ${firstResp}, plus bas ${minY.toFixed(1)} u (plancher ${P.fallMap(track).base})`);
  else check(resp === 0, `${name} (sol) : ${resp} réapparition, la voiture roule sur l'herbe (plus bas ${minY.toFixed(1)} u)`);
  // rejeu deux fois identique
  const a = replay(track, P.WORLDS[wi], LOG, 1500), b = replay(track, P.WORLDS[wi], LOG, 1500);
  check(hash(a.ghost) === hash(b.ghost) && a.steps === b.steps, `${name} : rejeu identique (${hash(a.ghost)})`);
}
// 2) pilote auto sur le monde suspendu, puis rejeu de son journal
const track = new Track({ v: 2, world: S2W, tiles });
const bot = await botRun(track, P.WORLDS[S2W], { maxSteps: 6000 });
check(bot.finished, `pilote auto : ${bot.finished ? bot.ms + " ms" : "pas fini"}`);
if (bot.finished) {
  const r = replay(track, P.WORLDS[S2W], bot.log, 15000);
  check(r.finished && r.ms === bot.ms, `rejeu du journal du pilote : ${r.ms} ms`);
}
process.exitCode = bad ? 1 : 0;

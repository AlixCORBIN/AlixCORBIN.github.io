// Test de déterminisme des blocs de la saison 2.
// Pour chaque bloc : petite piste (départ, bloc, arrivée), 20 journaux d'entrées pseudo-aléatoires à graine fixe,
// chacun rejoué 2 fois via src/server/replay.js : temps, nombre de pas et fantôme complet doivent être identiques.
//   node tools/determinism-test.mjs            blocs de saison 2 validés
//   node tools/determinism-test.mjs --all      aussi les blocs encore cachés (season: "off")
//   node tools/determinism-test.mjs wind lift  seulement ces blocs
import { createHash } from "node:crypto";
import { BLOCKS, placeFrom } from "../src/games/racing/blocks.js";
import { Track, normalizeTiles } from "../src/games/racing/track.js";
import * as P from "../src/games/racing/physics.js";
import { replay } from "../src/server/replay.js";

// Pistes de test : suite de [type, réglages] ; "_" = case vide ; "Y" = descendre d'un niveau
const R = ["road"];
const CASES = {
  boost2: [R, R, ["boost2", { level: 3 }], R, ["boost2", { level: 1 }], R, R],
  brake: [R, R, ["brake"], R, R],
  glue: [R, R, ["glue"], ["glue"], R, R],
  oil: [R, R, ["oil"], ["oil"], R, R],
  kicker2: [R, R, ["boost2", { level: 3 }], ["kicker2", { angle: 25, len: 2 }], "_", "_", "_", "_", ["road"], R, R],
  cpfast: [R, ["cpfast", { minSpeed: 250 }], R, ["cpfast", { minSpeed: 60 }], R, R],
  teleport: [R, ["teleport", { pair: 1, role: 0 }], R, "_", "_", ["teleport", { pair: 1, role: 1 }], R, R],
  wind: [R, R, ["wind", { force: 8 }], ["wind", { force: -8 }], R, R],
  gate: [R, R, ["gate", { period: 120, closed: 60, offset: 20 }], R, R, R],
  lift: [R, R, ["lift", { dist: 2, period: 300 }], "_", "_", R, R],
  switch: [R, ["switch", { id: 1 }], R, ["door", { id: 1 }], R, R],
  door: [R, ["switch", { id: 1 }], R, ["door", { id: 1 }], R, R],
  crate: [R, R, ["crate", { minSpeed: 60 }], R, R],
  gravity: [R, R, ["gravity"], R, R],
  rail: [R, R, ["rail"], R, R],
};

function build(spec) {
  const tiles = [];
  let cur = placeFrom("start", 0, 0, 0, 0);
  tiles.push(cur.tile);
  let st = cur.next;
  const DX = [0, 1, 0, -1], DZ = [-1, 0, 1, 0];
  const add = (type, p) => {
    const r = placeFrom(type, st.x, st.z, st.d, st.l, false, p);
    const t = [r.tile.x, r.tile.z, r.tile.type, r.tile.rot, r.tile.level];
    if (p) t.push(p);
    tiles.push(t);
    st = r.next;
  };
  tiles[0] = [cur.tile.x, cur.tile.z, "start", cur.tile.rot, cur.tile.level];
  for (const s of spec) {
    if (s === "_") { st = { ...st, x: st.x + DX[st.d], z: st.z + DZ[st.d] }; continue; }
    add(s[0], s[1]);
  }
  add("cp");
  add("road");
  add("finish");
  return normalizeTiles(tiles);
}

// PRNG à graine fixe (mulberry32)
const prng = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
function randomLog(seed, steps) {
  const rnd = prng(seed);
  const ev = [];
  let s = 0;
  while (s < steps) {
    const mode = rnd();
    ev.push([s, Math.round((mode < 0.85 ? 70 + rnd() * 30 : rnd() * 60)), mode > 0.93 ? Math.round(rnd() * 100) : 0, Math.round((rnd() - 0.5) * (rnd() < 0.5 ? 20 : 120)), rnd() < 0.1 ? 1 : 0]);
    s += 10 + Math.floor(rnd() * 90);
  }
  return { v: 1, ev, r: rnd() < 0.3 ? [Math.floor(steps / 2)] : [] };
}
const hash = (v) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 12);

await P.initPhysics();
const args = process.argv.slice(2);
const all = args.includes("--all");
const only = args.filter((a) => !a.startsWith("--"));
const names = Object.keys(CASES).filter((n) => (only.length ? only.includes(n) : BLOCKS[n] && (all || BLOCKS[n].season === 2)));
const STEPS = 100 * 40;
if (args.includes("--probe")) {
  // gaz à fond, direction 0 : temps d'arrivée de chaque piste de test (comparer avec la piste de route simple)
  for (const name of ["_route", ...names]) {
    const spec = name === "_route" ? [R, R, R, R, R] : CASES[name];
    const t = new Track({ v: 2, world: 0, tiles: build(spec) });
    const r = replay(t, P.WORLDS[0], { v: 1, ev: [[0, 100, 0, 0, 0]], r: [] }, STEPS);
    console.log(`${name.padEnd(10)} ${r.finished ? r.ms + " ms" : "pas fini"} (${r.steps} pas)`);
  }
  process.exit(0);
}
let failed = 0;
for (const name of names) {
  if (!BLOCKS[name]) { console.log(`${name}: ABSENT`); failed++; continue; }
  let ok = true, detail = "", finished = 0;
  try {
    const tiles = build(CASES[name]);
    const track = new Track({ v: 2, world: 0, tiles });
    const err = track.validate();
    if (err) throw new Error(err);
    for (let k = 0; k < 20 && ok; k++) {
      const log = randomLog(1000 + k, STEPS);
      const a = replay(track, P.WORLDS[0], log, STEPS), b = replay(track, P.WORLDS[0], log, STEPS);
      const la = a.ghost.slice(-7), lb = b.ghost.slice(-7);
      if (a.finished) finished++;
      if (a.ms !== b.ms || a.steps !== b.steps || JSON.stringify(la) !== JSON.stringify(lb) || hash(a.ghost) !== hash(b.ghost) || hash(a.splits) !== hash(b.splits)) {
        ok = false;
        detail = `journal ${k} : ${a.ms}/${a.steps}/${hash(a.ghost)} ≠ ${b.ms}/${b.steps}/${hash(b.ghost)}`;
      }
    }
  } catch (e) {
    ok = false;
    detail = e.message;
  }
  if (!ok) failed++;
  console.log(`${ok ? "OK    " : "ÉCHEC "} ${name}${ok ? ` (${finished}/20 arrivées)` : ` — ${detail}`}`);
}
process.exitCode = failed ? 1 : 0;

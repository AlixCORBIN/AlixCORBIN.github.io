// Blocs de la saison 2 (lot 2), un par un, sur une petite piste suspendue (monde Atelier, sans sol) :
//   pilote auto jusqu'à l'arrivée (sans tomber), rejeu de son journal identique, fantôme accepté (ghost-check),
//   20 journaux aléatoires rejoués 2 fois (déterminisme).
//   node tools/blocks-s2-check.mjs [bloc…] [--dump dossier] [--trace]
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { BLOCKS, placeFrom } from "../src/games/racing/blocks.js";
import { Track, normalizeTiles, overlaps } from "../src/games/racing/track.js";
import { trackMeta } from "../src/games/racing/meta.js";
import * as P from "../src/games/racing/physics.js";
import { replay } from "../src/server/replay.js";
import { botRun } from "./bot-run.mjs";
import { ghostProblem } from "./ghost-check-s2.mjs";

const R = ["road"], B = ["boost2", { level: 2 }];
// [type, réglages, sens inversé]
export const CASES = {
  turnw: [R, ["turnw", { r: 2 }], R, ["turnw", { r: 3 }], R],
  bankx: [R, B, R, ["bankx", { angle: 45, r: 2 }], R, B, R, ["bankx", { angle: 70, r: 1 }], R],
  hairpin: [R, R, ["hairpin"], R, R, ["hairpin", { surf: 1 }, true], R],
  chicane: [R, B, ["chicane", { side: 0 }], ["chicane", { side: 1 }], R],
  slopeg: [R, ["slopeg"], R, ["slopeg", null, true], R],
  cliff: [R, B, R, ["cliff"], R, R, ["cliff", null, true], R],
  camber: [R, B, ["camber", { angle: 25, side: 0 }], R, ["camber", { angle: 25, side: 1 }], R],
  whoops: [R, B, R, ["whoops"], R],
  bump: [R, B, R, ["bump", { h: 6 }], "_", R, R],
  wallin: [R, B, R, ["wallin", { side: 0 }], ["wallrun", { side: 0 }], ["wallout", { side: 0 }], R],
  wallrun: [R, B, R, ["wallin", { side: 1 }], ["wallrun", { side: 1 }], ["wallrun", { side: 1 }], ["wallout", { side: 1 }], R],
  halftube: [R, B, R, ["halftube", { side: 0 }], R, ["halftube", { side: 1 }], R],
  tunnel: [R, B, R, ["tunnel", { len: 2 }], R],
  pipe: [R, B, ["pipe"], ["pipe"], R],
  hloop: [R, B, R, ["hloop", { side: 0 }], R, R],
  loopx: [R, B, R, ["loopx", { count: 2 }], R],
  narrow: [R, ["narrow"], ["narrow"], ["narrow"], R],
  bare: [R, ["bare"], ["bare", { surf: 2 }], ["bare", { surf: 1 }], R],
  cut: [R, B, ["kicker2", { angle: 15, len: 1 }], "_", "_", "Y", ["cut"], R],
  water: [R, B, R, ["water"], ["water"], ["water"], R],
  revboost: [R, B, R, ["revboost"], R, R],
  jet: [R, B, R, ["jet", { power: 40 }], "_", "U", "U", "U", R, R],
  surf: [R, ["turnw", { r: 2, surf: 2 }], R, ["slopeg", { surf: 1 }], ["bankx", { r: 2, surf: 3 }], R],
};

export function buildCase(spec, world) {
  let cur = placeFrom("start", 0, 0, 0, 4);
  const tiles = [[cur.tile.x, cur.tile.z, "start", cur.tile.rot, cur.tile.level]];
  let st = cur.next;
  const DX = [0, 1, 0, -1], DZ = [-1, 0, 1, 0];
  const add = (type, p, rev) => {
    const r = placeFrom(type, st.x, st.z, st.d, st.l, !!rev, p);
    const t = [r.tile.x, r.tile.z, r.tile.type, r.tile.rot, r.tile.level];
    if (p) t.push(p);
    tiles.push(t);
    st = r.next;
  };
  for (const s of spec) {
    if (s === "_") { st = { ...st, x: st.x + DX[st.d], z: st.z + DZ[st.d] }; continue; }
    if (s === "Y") { st = { ...st, l: st.l - 1 }; continue; }
    if (s === "U") { st = { ...st, l: st.l + 1 }; continue; }
    add(s[0], s[1], s[2]);
  }
  add("cp"); add("road"); add("cp"); add("road"); add("cp"); add("road"); add("finish"); add("road");
  return { v: 2, world, tiles: normalizeTiles(tiles) };
}

const prng = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
function randomLog(seed, steps) {
  const rnd = prng(seed);
  const ev = [];
  for (let s = 0; s < steps; s += 10 + Math.floor(rnd() * 90))
    ev.push([s, Math.round(rnd() < 0.85 ? 70 + rnd() * 30 : rnd() * 60), rnd() > 0.93 ? Math.round(rnd() * 100) : 0, Math.round((rnd() - 0.5) * (rnd() < 0.5 ? 20 : 120)), rnd() < 0.1 ? 1 : 0]);
  return { v: 1, ev, r: rnd() < 0.3 ? [Math.floor(steps / 2)] : [] };
}
const hash = (v) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 12);

if (import.meta.url === `file://${process.argv[1]}`) {
  await P.initPhysics();
  const args = process.argv.slice(2);
  const dump = args.includes("--dump") ? args[args.indexOf("--dump") + 1] : null;
  const only = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--dump");
  const W = P.WORLDS.findIndex((w) => w.id === "s2tech");
  let bad = 0;
  if (dump) mkdirSync(dump, { recursive: true });
  for (const name of Object.keys(CASES)) {
    if (only.length && !only.includes(name) && !args.includes("--dump-only")) continue;
    const data = buildCase(CASES[name], W);
    if (dump) writeFileSync(`${dump}/${name}.json`, JSON.stringify(data));
    if (args.includes("--dump-only")) continue;
    const track = new Track(data), world = P.WORLDS[W];
    const probs = [];
    const ov = overlaps(data.tiles);
    if (ov.length) probs.push("chevauchement " + ov.slice(0, 3).join(" "));
    const bot = await botRun(track, world, { maxSteps: 6000, trace: args.includes("--trace") });
    if (!bot.finished) probs.push(`pilote pas arrivé (ligne ${bot.idx}/${bot.len})`);
    if (bot.respawns) probs.push(`${bot.respawns} chute(s)`);
    let why = null;
    if (bot.finished) {
      const r = replay(track, world, bot.log, 15000);
      if (r.ms !== bot.ms) probs.push("rejeu ≠ course");
      why = ghostProblem(trackMeta(data), r.ms, r.ghost);
      if (why) probs.push("fantôme refusé : " + why);
    }
    let det = true;
    for (let k = 0; k < 10 && det; k++) {
      const log = randomLog(500 + k, 3000);
      const a = replay(track, world, log, 3000), b = replay(track, world, log, 3000);
      if (hash(a.ghost) !== hash(b.ghost) || a.steps !== b.steps) det = false;
    }
    if (!det) probs.push("NON DÉTERMINISTE");
    if (probs.length) bad++;
    console.log(`${probs.length ? "ÉCHEC" : "OK   "} ${name.padEnd(9)} ${bot.finished ? (bot.ms / 1000).toFixed(2) + " s" : "--"}${probs.length ? " — " + probs.join(" ; ") : ""}`);
  }
  process.exitCode = bad ? 1 : 0;
}

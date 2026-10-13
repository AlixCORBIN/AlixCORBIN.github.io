// Non-régression du format v1 : rejoue « gaz à fond, direction 0 » sur les 25 maps officielles
// et compare au résultat de référence (tools/v1-reference.json).
//   node tools/v1-regression.mjs --record   enregistre la référence
//   node tools/v1-regression.mjs            compare (code de sortie 1 si différent)
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { OFFICIAL } from "../src/games/racing/maps.js";
import { Track } from "../src/games/racing/track.js";
import * as P from "../src/games/racing/physics.js";
import { replay } from "../src/server/replay.js";

const REF = new URL("./v1-reference.json", import.meta.url);
const MAX_STEPS = 100 * 90;
const LOG = { v: 1, ev: [[0, 100, 0, 0, 0]], r: [] };
const hash = (v) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 16);

await P.initPhysics();
const out = {};
for (const map of OFFICIAL) {
  const track = new Track(map.data);
  const r = replay(track, P.WORLDS[map.world], LOG, MAX_STEPS);
  out[map.id] = { finished: r.finished, ms: r.ms, steps: r.steps, ghost: hash(r.ghost), splits: hash(r.splits) };
}
console.log(`${Object.keys(out).length} maps rejouées`);
if (process.argv.includes("--record")) {
  writeFileSync(REF, JSON.stringify(out, null, 1));
  console.log("référence enregistrée");
} else {
  const ref = JSON.parse(readFileSync(REF, "utf8"));
  const bad = Object.keys(ref).filter((id) => JSON.stringify(ref[id]) !== JSON.stringify(out[id]));
  console.log(bad.length || Object.keys(ref).length !== Object.keys(out).length ? `DIFFÉRENT : ${bad.join(", ")}` : "IDENTIQUE sur toutes les maps");
  process.exitCode = bad.length ? 1 : 0;
}

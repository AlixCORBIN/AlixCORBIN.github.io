// Brouillons de maps de la saison 2 (format v2) : un par monde, 2 à 4 nouveaux blocs chacun.
// Génère tools/s2-maps/s2-0N.json et valide chaque map : pas de chevauchement, Track valide, arrivée atteinte par le bot.
//   node tools/s2-maps/build.mjs
// Ce sont des brouillons : à retoucher dans l'éditeur, jamais envoyés automatiquement.
import { writeFileSync } from "node:fs";
import { placeFrom } from "../../src/games/racing/blocks.js";
import { Track, normalizeTiles, overlaps } from "../../src/games/racing/track.js";
import * as P from "../../src/games/racing/physics.js";
import { botRun } from "../bot-run.mjs";

// Jetons « tortue » (comme buildTrack dans track.js) : type, sens inversé
const TOK = {
  S: ["road"], T: ["dirt"], I: ["ice"], B: ["boost"], C: ["cp"], F: ["finish"],
  R: ["turn"], L: ["turn", true], Rb: ["bank"], Lb: ["bank", true], Rg: ["bigturn"], Lg: ["bigturn", true],
  Rgb: ["bigbank"], Lgb: ["bigbank", true], U: ["slope"], D: ["slope", true], O: ["loop"],
};
const DX = [0, 1, 0, -1], DZ = [-1, 0, 1, 0];

function chain(items) {
  const first = placeFrom("start", 0, 0, 0, 0);
  const tiles = [[first.tile.x, first.tile.z, "start", first.tile.rot, first.tile.level]];
  let st = first.next;
  for (const it of items) {
    if (it === "_") { st = { ...st, x: st.x + DX[st.d], z: st.z + DZ[st.d] }; continue; }
    if (it === "Y") { st = { ...st, l: st.l - 1 }; continue; }
    const [type, p, rev] = typeof it === "string" ? [TOK[it][0], null, TOK[it][1]] : [it[0], it[1], false];
    const r = placeFrom(type, st.x, st.z, st.d, st.l, !!rev);
    const t = [r.tile.x, r.tile.z, r.tile.type, r.tile.rot, r.tile.level];
    if (p) t.push(p);
    tiles.push(t);
    st = r.next;
  }
  return normalizeTiles(tiles);
}

const MAPS = [
  { world: 0, name: "S2-01 · Rampe", items: ["S", "S", "C", "S", ["kicker2", { angle: 13, len: 1 }], "_", "_", "S", "S", ["cpfast", { minSpeed: 60 }], "S", ["boost2", { level: 1 }], "S", "Rb", "S", "F", "S"] },
  { world: 1, name: "S2-02 · Vents", items: ["S", "S", ["wind", { force: 12 }], "S", ["wind", { force: -12 }], "S", "C", "Rb", "S", ["brake", { power: 1 }], "S", "Lb", "S", "C", "S", "S", "F", "S"] },
  { world: 2, name: "S2-03 · Huile", items: ["S", "S", ["oil"], "S", "C", "Rgb", "S", ["glue", { drag: 4 }], "S", "Lgb", "S", "C", "S", ["boost2", { level: 2 }], "S", "F", "S"] },
  { world: 3, name: "S2-04 · Sentier piégé", items: ["S", ["gate", { period: 300, closed: 150, offset: 0 }], "S", "C", "R", "T", "T", ["crate", { minSpeed: 60 }], "T", "C", "L", ["switch", { id: 1 }], "S", ["door", { id: 1 }], "S", "F", "S"] },
  { world: 4, name: "S2-05 · Machines", items: ["S", "S", ["rail"], "S", "C", ["gravity"], "S", "C", ["lift", { dist: 2, period: 500 }], "_", "_", "S", "F", "S"] },
];

await P.initPhysics();
let bad = 0;
for (const [i, m] of MAPS.entries()) {
  const tiles = chain(m.items);
  const data = { v: 2, world: m.world, tiles };
  const track = new Track(data);
  const problems = [];
  const err = track.validate();
  if (err) problems.push(err);
  const ov = overlaps(tiles);
  if (ov.length) problems.push(`chevauchements : ${ov.join(", ")}`);
  const bot = await botRun(track, P.WORLDS[m.world], { maxSteps: 100 * 120 });
  if (!bot.finished) problems.push("le bot n'atteint pas l'arrivée");
  const id = `s2-${String(i + 1).padStart(2, "0")}`;
  writeFileSync(new URL(`./${id}.json`, import.meta.url), JSON.stringify({ id, name: m.name, world: m.world, author_ms: bot.finished ? bot.ms : null, data }, null, 1));
  console.log(`${problems.length ? "ÉCHEC" : "OK   "} ${id} ${m.name} — ${tiles.length} blocs, bot : ${bot.finished ? bot.ms + " ms" : "pas fini"}${problems.length ? " — " + problems.join(" ; ") : ""}`);
  bad += problems.length ? 1 : 0;
}
process.exitCode = bad ? 1 : 0;

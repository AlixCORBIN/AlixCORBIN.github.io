// Vérifie les maps officielles (chevauchements, faisabilité) avec un pilote automatique sur la vraie physique,
// et calcule les temps auteur. node tools/racing-check.mjs [--write] [--map v2-1-1] [--ascii] [--trace]
import { writeFileSync } from "node:fs";
import { OFFICIAL } from "../src/games/racing/maps.js";
import { Track, overlaps, buildTrack, normalizeTiles } from "../src/games/racing/track.js";
import { sampleBlock, toWorld } from "../src/games/racing/blocks.js";
import * as P from "../src/games/racing/physics.js";

const args = process.argv.slice(2);
const only = args.includes("--map") ? args[args.indexOf("--map") + 1] : null;
const trace = args.includes("--trace");
const EVERY = +(process.env.EVERY || 50), FROM = +(process.env.FROM || 0);
await P.initPhysics();

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// Axe de la piste dans l'ordre de parcours : on enchaîne les blocs dans l'ordre de la liste,
// chacun parcouru dans le sens qui part du bout le plus proche de la fin du précédent.
export function racingLine(track) {
  const pts = [];
  let last = track.spawn().p;
  for (const t of track.tiles) {
    let S = sampleBlock(t.type).map((f) => ({ p: toWorld(t, f.p), u: toWorld(t, f.u, true), type: t.type }));
    if (dist(S[S.length - 1].p, last) < dist(S[0].p, last)) S = S.reverse();
    // pour les sauts, on garde la continuité de l'ordre
    for (const f of S) pts.push(f);
    last = S[S.length - 1].p;
  }
  // densifie (un point tous les ~2 u)
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const n = Math.max(1, Math.ceil(dist(a.p, b.p) / 2));
    for (let k = 0; k < n; k++) out.push({ p: a.p.map((v, j) => v + (b.p[j] - v) * (k / n)), u: a.u, type: a.type });
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function drive(map) {
  const track = new Track(map.data);
  const world = P.WORLDS[map.world];
  const phys = P.createWorld(track);
  const run = P.createRun(track);
  const car = P.createCar(phys, run.lastSpawn);
  const line = racingLine(track);
  let idx = 0, respawns = 0, stuck = 0;
  const maxSteps = 100 * 180;
  while (!run.finished && run.steps < maxSteps) {
    const b = car.body.translation();
    const pos = [b.x, b.y, b.z];
    // avance l'index le long de la ligne
    let best = idx, bd = Infinity;
    for (let i = idx; i < Math.min(line.length, idx + 60); i++) {
      const d = dist(line[i].p, pos);
      if (d < bd) { bd = d; best = i; }
    }
    idx = best;
    const fr = P.carFrame(car);
    const v = car.speed;
    const look = Math.min(line.length - 1, idx + Math.round(3 + v * 0.16));
    const tgt = line[look].p;
    const rel = sub(tgt, pos);
    const lat = dot(rel, fr.right), fwd = dot(rel, fr.fwd);
    const steer = Math.max(-1, Math.min(1, Math.atan2(lat, Math.max(fwd, 0.1)) * 2.6));
    // vitesse max d'après la courbure à venir (dans le plan de la route)
    let vmax = 200;
    for (let k = 4; k < 40; k += 4) {
      const i0 = Math.min(line.length - 1, idx + k), i1 = Math.min(line.length - 1, idx + k + 6), i2 = Math.min(line.length - 1, idx + k + 12);
      const a = line[i0], bb = line[i1], c = line[i2];
      if (a.type === "loop" || a.type === "wall" || c.type === "loop" || c.type === "wall") continue;
      const t1 = sub(bb.p, a.p), t2 = sub(c.p, bb.p);
      const u = a.u;
      const h1 = sub(t1, u.map((x) => x * dot(t1, u))), h2 = sub(t2, u.map((x) => x * dot(t2, u)));
      const l1 = Math.hypot(...h1), l2 = Math.hypot(...h2);
      if (l1 < 0.5 || l2 < 0.5) continue;
      const ang = Math.acos(Math.max(-1, Math.min(1, dot(h1, h2) / (l1 * l2))));
      if (ang < 0.02) continue;
      const R = ((l1 + l2) / 2) / ang;
      const bank = 1 + Math.max(0, 1 - u[1]) * 2.5;
      const lim = Math.sqrt(R * 26 * bank * world.grip) * 1.12 + k * 0.45;
      vmax = Math.min(vmax, lim);
    }
    const over = v - vmax;
    const input = { throttle: over > 0 ? 0 : 1, brake: over > 4 ? Math.min(1, over / 10) : 0, steer, drift: false };
    P.stepRun(run, track, phys, car, world, input);
    if (run.events.includes("respawn")) { respawns++; idx = Math.max(0, idx - 30); }
    if (v < 1 && run.steps > 300) stuck++; else stuck = 0;
    if (stuck > 300) { if (trace) console.log("STUCK", pos.map((x) => x.toFixed(1)).join(" "), "idx", idx, line[idx].type); P.placeCar(car, run.lastSpawn); respawns++; stuck = 0; }
    if (respawns > 12) break;
    if (trace && run.steps % EVERY === 0 && run.steps >= FROM) console.log(run.steps, pos.map((x) => x.toFixed(1)).join(" "), "kmh", car.kmh, "vmax", Math.round(vmax * 3.6), "c", car.contacts, car.surface, "idx", idx, "/", line.length, run.events.join(","));
  }
  return { ms: run.finished ? run.finishMs : null, respawns, cps: run.cps.size, need: track.cps.length, idx, len: line.length };
}

function ascii(tiles) {
  const t = new Track({ tiles });
  const g = {};
  let W = 0, H = 0;
  t.tiles.forEach((tile) => {
    const S = sampleBlock(tile.type);
    for (const f of S) {
      const p = toWorld(tile, f.p);
      const x = Math.floor(p[0] / 32), z = Math.floor(p[2] / 32);
      const lv = Math.floor((p[1] + 0.5) / 8);
      const ch = tile.type === "start" ? "D" : tile.type === "finish" ? "F" : tile.type === "cp" ? "C" : lv > 9 ? "+" : String(lv);
      const k = `${x},${z}`;
      if (!g[k] || "DFC".includes(ch)) g[k] = ch;
      W = Math.max(W, x + 1); H = Math.max(H, z + 1);
    }
  });
  let s = "";
  for (let z = 0; z < H; z++) { for (let x = 0; x < W; x++) s += g[`${x},${z}`] || "."; s += "\n"; }
  return s;
}

const out = {};
let bad = 0;
const LIST = args.includes("--path")
  ? [{ id: "custom", name: "custom", world: +(process.env.WORLD || 0), data: { world: 0, tiles: normalizeTiles(buildTrack(args[args.indexOf("--path") + 1])) } }]
  : OFFICIAL;
for (const m of LIST) {
  if (only && m.id !== only) continue;
  const ov = overlaps(m.data.tiles);
  const t = new Track(m.data);
  const [w, h] = t.size;
  const r = drive(m);
  const ok = !ov.length && r.ms && w <= 32 && h <= 32;
  if (!ok) bad++;
  console.log(`${ok ? "ok " : "KO "} ${m.id} ${m.name.padEnd(24)} ${w}x${h} cps ${r.cps}/${r.need} resp ${r.respawns} line ${r.idx}/${r.len} ${r.ms ? (r.ms / 1000).toFixed(2) + "s" : "--"}${ov.length ? " overlap " + ov.slice(0, 4).join(" ") : ""}`);
  if (args.includes("--ascii") || (!ok && !only)) console.log(ascii(m.data.tiles));
  if (r.ms) out[m.id] = r.ms;
}
if (args.includes("--write")) {
  writeFileSync(new URL("../src/games/racing/author-times.js", import.meta.url),
    "// Généré par tools/racing-check.mjs : temps du pilote de référence (ms)\nexport const AUTHOR = " + JSON.stringify(out, null, 2) + ";\n");
}
process.exit(bad ? 1 : 0);

// Vérifie les maps officielles (chevauchements) et calcule les temps auteur avec un pilote automatique.
// node tools/racing-check.mjs [--write] [--map off-1-1] [--ascii]
import { writeFileSync } from "node:fs";
import { OFFICIAL, OFFICIAL_RAW } from "../src/games/racing/maps.js";
import { Track, overlaps, cellCenter, rotLocal, TILE } from "../src/games/racing/track.js";
import { WORLDS, createRun, step, speedOf } from "../src/games/racing/physics.js";

const args = process.argv.slice(2);
const only = args.includes("--map") ? args[args.indexOf("--map") + 1] : null;

function waypoints(tiles) {
  return tiles.map(([x, z, type, rot, level]) => {
    let [cx, cz] = cellCenter(x, z);
    if (type === "turn") {
      const [u, v] = rotLocal(5, 5, rot);
      cx += u; cz += v;
    }
    return { x: cx, z: cz, type };
  });
}

function drive(map) {
  const track = new Track(map.data);
  const world = WORLDS[map.world];
  const wps = waypoints(map.data.tiles);
  const run = createRun(track);
  let wi = 1, maxSteps = 100 * 240, respawns = 0;
  while (!run.finished && run.steps < maxSteps) {
    const c = run.car;
    // avance le waypoint courant quand on s'en approche
    while (wi < wps.length - 1 && Math.hypot(wps[wi].x - c.x, wps[wi].z - c.z) < 14) wi++;
    const t = wps[Math.min(wi, wps.length - 1)];
    const t2 = wps[Math.min(wi + 1, wps.length - 1)];
    const tx = t.x * 0.7 + t2.x * 0.3, tz = t.z * 0.7 + t2.z * 0.3;
    const want = Math.atan2(tx - c.x, -(tz - c.z));
    let d = want - c.yaw;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    const sp = speedOf(c);
    const nextTurn = wps.slice(wi, wi + 2).some((w) => w.type === "turn");
    const tooFast = (nextTurn && sp > 52) || Math.abs(d) > 0.6 && sp > 30;
    step(run, track, world, { throttle: tooFast ? 0 : 1, brake: tooFast && sp > 48 ? 0.6 : 0, steer: Math.max(-1, Math.min(1, d * 3)), drift: false });
    if (run.events.includes("respawn")) respawns++;
    if (respawns > 20) break;
  }
  return { ms: run.finished ? run.finishMs : null, respawns, cps: run.cps.size, need: track.cps.length };
}

function ascii(tiles) {
  const g = {};
  const ch = { start: "D", finish: "F", cp: "C", road: "·", turn: "+", ramp: "/", boost: "»", dirt: "~", wide: "#" };
  let W = 0, H = 0;
  for (const [x, z, type, , l] of tiles) { g[`${x},${z}`] = l > 0 ? String(l) : ch[type]; W = Math.max(W, x + 1); H = Math.max(H, z + 1); }
  let s = "";
  for (let z = 0; z < H; z++) { for (let x = 0; x < W; x++) s += g[`${x},${z}`] || " "; s += "\n"; }
  return s;
}

const out = {};
let bad = 0;
for (const m of OFFICIAL) {
  if (only && m.id !== only) continue;
  const ov = overlaps(m.data.tiles);
  const t = new Track(m.data);
  const [w, h] = t.size;
  const r = drive(m);
  const ok = !ov.length && r.ms && w <= 24 && h <= 24;
  if (!ok) bad++;
  console.log(`${ok ? "ok " : "KO "} ${m.id} ${m.name.padEnd(22)} ${w}x${h} cps ${r.cps}/${r.need} respawns ${r.respawns} ${r.ms ? (r.ms / 1000).toFixed(2) + "s" : "--"}${ov.length ? " overlap " + ov.join(" ") : ""}`);
  if (args.includes("--ascii") || !ok) console.log(ascii(m.data.tiles));
  if (r.ms) out[m.id] = r.ms;
}
if (args.includes("--write")) {
  writeFileSync(new URL("../src/games/racing/author-times.js", import.meta.url),
    "// Généré par tools/racing-check.mjs : temps du pilote de référence (ms)\nexport const AUTHOR = " + JSON.stringify(out, null, 2) + ";\n");
}
process.exit(bad ? 1 : 0);

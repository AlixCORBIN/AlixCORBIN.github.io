// Reproduit en JS les contrôles de racing_ghost_problem (version en base + ajouts saison 2 de
// supabase/racing-season2-anticheat.sql) sur des fantômes produits par le bot de référence,
// pour les maps de la campagne tools/s2-maps/s2-NN.json (ligne principale et chaque raccourci, comme le pilote auto de
// build.mjs) et quelques pistes de test (téléporteur, turbo niveau 3…).
// Affiche, pour chaque map : temps, durée et coût CPU du rejeu, vitesse max entre deux points,
// distance max à l'axe, et ce que la base refuserait.
//   node tools/ghost-check-s2.mjs [--map s2-03] [--neg]
import { readFileSync, readdirSync } from "node:fs";
import { placeFrom } from "../src/games/racing/blocks.js";
import { trackMeta } from "../src/games/racing/meta.js";
import { Track, normalizeTiles } from "../src/games/racing/track.js";
import * as P from "../src/games/racing/physics.js";
import { replay } from "../src/server/replay.js";
import { botRun } from "./bot-run.mjs";

// Seuils de la saison 1 (identiques à la base) et ajustements saison 2 (meta.v = 2) : voir la migration
export const S1 = { jump: 4.6, near: 12, start: 25, finish: 30, cp: 22 };
// Saison 2 : vitesse terminale mesurée avec des turbos niveau 3 en série = 5,6 u / 50 ms (112 u/s), y compris après
// un tremplin 35° × 2 ou une chute de 12 niveaux -> seuil 6,0 u (120 u/s). Les autres seuils sont inchangés.
export const S2 = { ...S1, jump: 6.0 };

// Copie de racing_ghost_problem : null si plausible, sinon la raison
export function ghostProblem(meta, time, g) {
  if (!Array.isArray(g) || g[0] !== -2) return "fantôme absent";
  const n = (g.length - 1) / 7;
  if ((g.length - 1) % 7 !== 0 || n < 10) return "fantôme mal formé";
  if (n * 50 <= time - 50 || n * 50 > time) return "durée du fantôme ≠ temps";
  const pt = (k) => [g[1 + k * 7] / 10, g[2 + k * 7] / 10, g[3 + k * 7] / 10];
  const G = Array.from({ length: n }, (_, k) => pt(k));
  const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const T = meta?.v === 2 ? S2 : S1;
  const anchors = meta ? [...meta.cps, meta.start] : [];
  const tps = meta?.v === 2 ? [...(meta.teleports || []), ...(meta.rails || [])] : [];
  for (let i = 1; i < n; i++) {
    if (d3(G[i], G[i - 1]) > T.jump) {
      const ok = anchors.some((c) => d3(G[i], c) < T.near) || tps.some((c) => d3(G[i], c) < T.near);
      if (!ok) return `vitesse impossible (point ${i}, ${d3(G[i], G[i - 1]).toFixed(2)} u)`;
    }
  }
  if (!meta) return null;
  // hors-piste permis (supabase/racing-hors-piste.sql) : seules les fausses données sont refusées
  if (d3(G[0], meta.start) > T.start) return "mauvais départ";
  if (!meta.finish.some((f) => d3(G[n - 1], f) < T.finish)) return "arrivée non atteinte";
  for (const c of meta.cps) if (!G.some((p) => d3(p, c) < T.cp)) return "checkpoint manqué";
  return null;
}

// Mesures brutes : plus grand saut entre deux points (hors réapparitions/téléportations) et plus grand écart à l'axe
function stats(meta, g) {
  const n = (g.length - 1) / 7;
  const G = Array.from({ length: n }, (_, k) => [g[1 + k * 7] / 10, g[2 + k * 7] / 10, g[3 + k * 7] / 10]);
  const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  let jump = 0, off = 0;
  for (let i = 1; i < n; i++) {
    const d = d3(G[i], G[i - 1]);
    const tp = [...(meta.teleports || []), ...(meta.rails || [])].some((c) => d3(G[i], c) < 12);
    if (!tp) jump = Math.max(jump, d);
  }
  for (const p of G) off = Math.max(off, Math.min(...meta.line.map((l) => d3(p, l))));
  return { jump, off };
}

// Pistes de test en plus des brouillons
function chain(items, world) {
  const first = placeFrom("start", 0, 0, 0, 0);
  const tiles = [[first.tile.x, first.tile.z, "start", first.tile.rot, first.tile.level]];
  let st = first.next;
  const DX = [0, 1, 0, -1], DZ = [-1, 0, 1, 0];
  for (const it of items) {
    if (it === "_") { st = { ...st, x: st.x + DX[st.d], z: st.z + DZ[st.d] }; continue; }
    const [type, p] = it;
    const r = placeFrom(type, st.x, st.z, st.d, st.l, false, p);
    const t = [r.tile.x, r.tile.z, r.tile.type, r.tile.rot, r.tile.level];
    if (p) t.push(p);
    tiles.push(t);
    st = r.next;
  }
  return { v: 2, world, tiles: normalizeTiles(tiles) };
}
const R = ["road"];
const EXTRA = [
  { id: "t-teleport", name: "Téléporteur", data: chain([R, R, ["cp"], R, ["teleport", { pair: 1, role: 0 }], R, "_", "_", "_", "_", ["teleport", { pair: 1, role: 1 }], R, R, ["finish"], R], 0) },
  { id: "t-boost3", name: "Turbos niveau 3", data: chain([R, ["boost2", { level: 3 }], R, ["boost2", { level: 3 }], R, ["boost2", { level: 3 }], R, R, R, ["cp"], R, R, R, R, ["finish"], R], 0) },
  { id: "t-turbo3x14", name: "14 turbos niveau 3", data: chain([...Array(14).fill(0).flatMap(() => [["boost2", { level: 3 }], R]), ["cp"], R, ["finish"], R], 4) },
  { id: "t-kicker35", name: "Tremplin 35° × 2", data: chain([R, R, ["boost2", { level: 3 }], R, ["kicker2", { angle: 35, len: 2 }], "_", "_", "_", "_", "_", R, R, ["cp"], R, ["finish"], R], 0) },
];

if (import.meta.url === `file://${process.argv[1]}`) {
  await P.initPhysics();
  const dir = new URL("./s2-maps/", import.meta.url);
  const only = process.argv.includes("--map") ? process.argv[process.argv.indexOf("--map") + 1] : null;
  const drafts = readdirSync(dir).filter((f) => /^s2-\d+\.json$/.test(f)).sort().map((f) => JSON.parse(readFileSync(new URL(f, dir), "utf8")))
    .filter((m) => !only || m.id === only);
  // une entrée par ligne de pilote : principale, puis chaque raccourci
  const runs = drafts.flatMap((m) => [{ ...m, hints: { order: m.hints?.main, slow: m.hints?.slow, gates: m.hints?.gates } },
    ...Object.entries(m.hints?.alts || {}).map(([g, order]) => ({ ...m, id: `${m.id}/${g}`, hints: { order, slow: m.hints?.altSlow?.[g] ?? m.hints?.slow, gates: m.hints?.gates } }))]);
  let refused = 0;
  for (const m of [...runs, ...(only ? [] : EXTRA)]) {
    const track = new Track(m.data);
    const world = P.WORLDS[m.data.world ?? 0];
    const meta = trackMeta(m.data);
    const bot = await botRun(track, world, { maxSteps: 15000, hints: m.hints || {} });
    if (!bot.finished) { console.log(`${m.id.padEnd(11)} bot : pas fini`); refused++; continue; }
    const t0 = performance.now();
    const r = replay(track, world, bot.log, 15000);
    const cpu = performance.now() - t0;
    const why = ghostProblem(meta, r.ms, r.ghost);
    const s = stats(meta, r.ghost);
    if (why) refused++;
    console.log(`${m.id.padEnd(11)} ${(r.ms / 1000).toFixed(2).padStart(6)} s course, rejeu ${cpu.toFixed(0).padStart(4)} ms CPU, saut max ${s.jump.toFixed(2)} u/50 ms (${(s.jump * 20).toFixed(0)} u/s), écart axe max ${s.off.toFixed(1)} u, téléporteurs ${meta.teleports?.length ?? 0} -> ${why ? "REFUSÉ : " + why : "accepté"}`);
  }
  if (process.argv.includes("--neg")) {
    // contre-épreuve : sans la liste des sorties de téléporteur, le saut doit être refusé
    const m = EXTRA[0], track = new Track(m.data), world = P.WORLDS[0], meta = trackMeta(m.data);
    const bot = await botRun(track, world, { maxSteps: 15000 });
    const r = replay(track, world, bot.log, 15000);
    console.log("sans teleports :", ghostProblem({ ...meta, teleports: [] }, r.ms, r.ghost) || "accepté (ANORMAL)");
    console.log("comme saison 1 :", ghostProblem({ ...meta, v: undefined }, r.ms, r.ghost) || "accepté (ANORMAL)");
  }
  process.exitCode = refused ? 1 : 0;
}

// Repères d'une piste pour la vérification des fantômes côté base (anti-triche) :
// départ, portiques d'arrivée, checkpoints, et l'axe de la piste échantillonné tous les ~8 u.
// Maps v2 (saison 2) : en plus v: 2, teleports (points où la voiture réapparaît à la sortie d'un téléporteur) et rails
// (extrémités où la voiture est accrochée), pour que racing_ghost_problem accepte le saut de position correspondant.
// Les maps v1 gardent exactement l'ancienne forme.
import { BLOCKS, param, sampleBlock, toWorld } from "./blocks.js";
import { Track } from "./track.js";

const r1 = (v) => Math.round(v * 10) / 10;
export function trackMeta(data) {
  const t = new Track(data);
  const line = [];
  for (const tile of t.tiles) {
    const S = sampleBlock(tile.type);
    let last = null;
    for (const f of S) {
      const p = toWorld(tile, f.p);
      if (last && Math.hypot(p[0] - last[0], p[1] - last[1], p[2] - last[2]) < 8) continue;
      line.push(p.map(r1));
      last = p;
    }
  }
  const meta = {
    start: t.start ? t.spawn().p.map(r1) : null,
    finish: t.gates.filter((g) => g.kind === "finish").map((g) => g.p.map(r1)),
    cps: t.gates.filter((g) => g.kind === "cp").map((g) => g.p.map(r1)),
    line,
  };
  if (data.v === 2) {
    meta.v = 2;
    // même point que teleportCar (physics.js) : 4 u après le plan de sortie, 0,5 u au-dessus
    meta.teleports = t.gates
      .filter((g) => g.kind === "teleport" && param(g.tile, "role") === 1)
      .map((g) => g.p.map((v, i) => r1(v + g.t[i] * 4 + g.u[i] * 0.5)));
    // rails : la voiture est accrochée à l'axe dès qu'elle passe à moins de 6 u d'une extrémité (petit saut de position)
    meta.rails = t.tiles
      .filter((tile) => BLOCKS[tile.type].mech === "rail")
      .flatMap((tile) => { const S = sampleBlock(tile.type); return [S[0], S[S.length - 1]].map((f) => toWorld(tile, f.p).map(r1)); });
  }
  return meta;
}

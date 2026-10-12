// Repères d'une piste pour la vérification des fantômes côté base (anti-triche) :
// départ, portiques d'arrivée, checkpoints, et l'axe de la piste échantillonné tous les ~8 u.
import { sampleBlock, toWorld } from "./blocks.js";
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
  return {
    start: t.start ? t.spawn().p.map(r1) : null,
    finish: t.gates.filter((g) => g.kind === "finish").map((g) => g.p.map(r1)),
    cps: t.gates.filter((g) => g.kind === "cp").map((g) => g.p.map(r1)),
    line,
  };
}

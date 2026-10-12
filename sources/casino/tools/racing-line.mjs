// Axe de course d'une piste (partagé par racing-check et test-replay)
import { sampleBlock, toWorld } from "../src/games/racing/blocks.js";
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
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


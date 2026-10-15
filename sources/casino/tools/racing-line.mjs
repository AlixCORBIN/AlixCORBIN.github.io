// Axe de course d'une piste (partagé par racing-check, test-replay et bot-run).
// Les blocs sont enchaînés dans l'ordre de la liste, chacun parcouru depuis le bout le plus proche de la fin du précédent.
// hints (maps de la saison 2, voir tools/s2-maps) : order = indices des tuiles dans l'ordre de passage (sinon l'ordre de la
// liste), skip = indices ignorés, slow = { indice: vitesse max en m/s } imposée au pilote sur ce bloc.
import { BLOCKS, sampleBlock, tileSurface, toWorld } from "../src/games/racing/blocks.js";
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const DEFAULT_SLOW = { hairpin: 15, wallout: 38 };
export function racingLine(track, hints = {}) {
  const skip = new Set(hints.skip || []), slowAt = hints.slow || {};
  const pts = [];
  let last = track.spawn().p;
  const order = hints.order || track.tiles.map((_, i) => i);
  for (const i of order) {
    const t = track.tiles[i];
    if (skip.has(i)) continue;
    const grip = { ice: 0.35, dirt: 0.7, water: 0.8 }[tileSurface(t)] ?? 1;
    // vitesses prudentes par défaut (pas de sol pour rattraper une erreur) : épingle, sortie de mur
    const slow = slowAt[i] ?? DEFAULT_SLOW[BLOCKS[t.type].base || t.type] ?? null;
    let S = sampleBlock(t.type).map((f) => ({ p: toWorld(t, f.p), u: toWorld(t, f.u, true), type: t.type, tile: i, grip, slow }));
    // sortie de téléporteur : parcourue dans son sens (la voiture y ressort dans l'axe du portique)
    const tpOut = t.type === "teleport" && t.p?.role === 1;
    if (!tpOut && dist(S[S.length - 1].p, last) < dist(S[0].p, last)) S = S.reverse();
    if (t.type === "platform") {
      // plateforme prise en angle (embranchement) : on passe par son centre, pas par le bord opposé
      const k = order.indexOf(i), nt = track.tiles[order[k + 1]];
      if (dist(S[0].p, last) > 10) S = S.slice(1);
      if (nt) {
        const N = sampleBlock(nt.type);
        const ne = [toWorld(nt, N[0].p), toWorld(nt, N[N.length - 1].p)];
        if (Math.min(...ne.map((q) => dist(q, S[S.length - 1].p))) > 10) S = S.slice(0, -1);
      }
    }
    for (const f of S) pts.push(f);
    last = S[S.length - 1].p;
    // entrée de téléporteur : la ligne traverse le portique tout droit, sans relier le portique à la sortie
    if (t.type === "teleport" && !(t.p?.role)) {
      const a = S[S.length - 2].p, b = S[S.length - 1].p, n = dist(a, b) || 1;
      pts.push({ ...S[S.length - 1], p: b.map((v, j) => v + ((b[j] - a[j]) / n) * 12), cut: true });
    }
  }
  // densifie (un point tous les ~2 u)
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const n = a.cut ? 1 : Math.max(1, Math.ceil(dist(a.p, b.p) / 2));
    for (let k = 0; k < n; k++) out.push({ ...a, p: a.p.map((v, j) => v + (b.p[j] - v) * (k / n)) });
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// Sol des maps de la saison 2 (réglage par map) : data.ground = { relief: 0..4 } (dunes de `relief` niveaux, 0 = plat).
// Sans ce réglage, une map d'un monde de la saison 2 reste suspendue au-dessus du vide.
// Le relief est une grille de hauteurs (pas de 8 u) creusée sous la piste : la route ne touche jamais le sol, qui remonte
// en talus de part et d'autre. Fonction pure des tuiles : même relief dans le navigateur et au rejeu serveur.
import { LEVEL_H, TILE, sampleBlock, sectionPoints, toWorld } from "./blocks.js";

export const GROUND_STEP = 8; // pas de la grille (u)
const MARGIN = 8; // cases de terrain autour de la piste
const CLEAR = 0.5; // le sol passe 0,5 u sous la chaussée (on remonte sur la piste depuis le sable)
const TALUS = 0.6; // pente des talus le long de la piste
const FLAT = 12; // le sol reste sous la chaussée jusqu'à 12 u de chaque point de la route (une maille de 8 u en diagonale)
const DENSE = 4; // espacement max des points de la route pris en compte (u)
const EDGE = 4; // le relief s'efface sur les 4 dernières cases du bord

// Réglage de sol d'une map, normalisé (null : pas de sol)
export function groundOf(data) {
  const g = data?.ground;
  if (!g || typeof g !== "object") return null;
  const relief = Math.max(0, Math.min(4, Math.round(Number(g.relief) || 0)));
  return { relief };
}

// Revêtement du sol selon le monde : sable (Mesa rouge), neige (Banquise), herbe ailleurs
export const groundSurface = (world) => (world?.id === "s2dirt" ? "sand" : world?.id === "s2ice" ? "snow" : "grass");

// Dunes : somme de sinusoïdes, entre 0 et 1
function dune(x, z) {
  const a = Math.sin(x * 0.011 + z * 0.004 + 1.3) * Math.cos(z * 0.009 - x * 0.003 + 0.4);
  const b = Math.sin((x - z) * 0.006 + 2.1);
  const c = Math.sin(x * 0.023 + 0.7) * Math.sin(z * 0.019 + 1.9);
  return Math.max(0, Math.min(1, 0.5 + 0.32 * a + 0.12 * b + 0.06 * c));
}

// Grille de hauteurs du terrain d'une piste (mise en cache sur l'objet Track)
export function terrainOf(track) {
  if (track._terrain !== undefined) return track._terrain;
  const g = groundOf(track.data);
  if (!g) return (track._terrain = null);
  const [w, h] = track.size;
  const x0 = -MARGIN * TILE, z0 = -MARGIN * TILE;
  const nx = Math.round(((w + 2 * MARGIN) * TILE) / GROUND_STEP), nz = Math.round(((h + 2 * MARGIN) * TILE) / GROUND_STEP);
  const W = nx + 1, D = nz + 1;
  const amp = g.relief * LEVEL_H;
  // plafond imposé par la piste (talus) : +∞ loin de toute route
  const cap = new Float32Array(W * D).fill(Infinity);
  const reach = Math.ceil((FLAT + (amp + CLEAR + 8) / TALUS) / GROUND_STEP) + 1;
  const stamp = (p, y) => {
    const ci = Math.round((p[0] - x0) / GROUND_STEP), cj = Math.round((p[2] - z0) / GROUND_STEP);
    for (let i = Math.max(0, ci - reach); i <= Math.min(nx, ci + reach); i++) {
      for (let j = Math.max(0, cj - reach); j <= Math.min(nz, cj + reach); j++) {
        const d = Math.hypot(x0 + i * GROUND_STEP - p[0], z0 + j * GROUND_STEP - p[2]);
        const c = y - CLEAR + Math.max(0, d - FLAT) * TALUS;
        const k = i * D + j;
        if (c < cap[k]) cap[k] = c;
      }
    }
  };
  let prevEnd = null;
  for (const t of track.tiles) {
    const S = sampleBlock(t.type);
    // points de la chaussée tous les DENSE u au plus, en long et en travers
    const secs = S.map((f) => sectionPoints(t.type, f).map((lp) => toWorld(t, lp)));
    for (let i = 0; i < secs.length; i++) {
      const A = secs[i], B = secs[Math.min(i + 1, secs.length - 1)];
      const along = i + 1 < secs.length ? Math.ceil(Math.max(...A.map((p, k) => Math.hypot(...p.map((v, m) => v - B[k][m])))) / DENSE) : 1;
      for (let a = 0; a < along; a++) {
        const row = A.map((p, k) => p.map((v, m) => v + ((B[k][m] - v) * a) / along));
        for (let k = 0; k < row.length; k++) {
          const q = row[Math.min(k + 1, row.length - 1)], p = row[k];
          const across = k + 1 < row.length ? Math.max(1, Math.ceil(Math.hypot(...p.map((v, m) => v - q[m])) / DENSE)) : 1;
          for (let c = 0; c < across; c++) {
            const r = p.map((v, m) => v + ((q[m] - v) * c) / across);
            stamp(r, r[1]);
          }
        }
      }
    }
    // saut entre deux blocs consécutifs : le sol reste sous la trajectoire
    const a = toWorld(t, S[0].p), b = toWorld(t, S[S.length - 1].p);
    const d2 = (p, q) => (p[0] - q[0]) ** 2 + (p[2] - q[2]) ** 2;
    const [entry, exit] = prevEnd && d2(b, prevEnd) < d2(a, prevEnd) ? [b, a] : [a, b];
    if (prevEnd) {
      const dist = Math.sqrt(d2(entry, prevEnd));
      if (dist > 6 && dist < 8 * TILE) {
        const y = Math.min(entry[1], prevEnd[1]) - 4, n = Math.ceil(dist / GROUND_STEP);
        for (let k = 1; k < n; k++) stamp([prevEnd[0] + ((entry[0] - prevEnd[0]) * k) / n, 0, prevEnd[2] + ((entry[2] - prevEnd[2]) * k) / n], y);
      }
    }
    prevEnd = exit;
  }
  // hauteurs : rangée i (x), colonne j (z), stockage i * D + j
  const heights = new Float32Array(W * D);
  for (let i = 0; i <= nx; i++) {
    for (let j = 0; j <= nz; j++) {
      const x = x0 + i * GROUND_STEP, z = z0 + j * GROUND_STEP;
      const edge = Math.min(i, nx - i, j, nz - j) / ((EDGE * TILE) / GROUND_STEP);
      const fade = Math.min(1, edge);
      const k = i * D + j;
      heights[k] = Math.min(amp * dune(x, z) * fade * fade * (3 - 2 * fade), cap[k]);
    }
  }
  const at = (x, z) => {
    const fi = Math.max(0, Math.min(nx, (x - x0) / GROUND_STEP)), fj = Math.max(0, Math.min(nz, (z - z0) / GROUND_STEP));
    const i = Math.min(nx - 1, Math.floor(fi)), j = Math.min(nz - 1, Math.floor(fj)), u = fi - i, v = fj - j;
    const H = (a, b) => heights[a * D + b];
    return (H(i, j) * (1 - u) + H(i + 1, j) * u) * (1 - v) + (H(i, j + 1) * (1 - u) + H(i + 1, j + 1) * u) * v;
  };
  return (track._terrain = { x0, z0, nx, nz, step: GROUND_STEP, heights, at, relief: g.relief });
}

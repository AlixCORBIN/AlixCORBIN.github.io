// Catalogue des blocs. Chaque bloc est une route « balayée » le long d'un chemin 3D :
// path(s) donne, pour s ∈ [0, 1], le point de l'axe et la normale de la chaussée (vers le haut de la route),
// dans le repère local du bloc : origine au centre de sa case d'entrée, au niveau du sol de la case,
// on entre par le bord sud (z = +16) en roulant vers le nord (-z), la droite est +x.
// Tous les blocs se parcourent dans les deux sens (sauf ceux marqués dir: sens imposé).

export const TILE = 32;
export const LEVEL_H = 8;
export const ROAD_W = 20; // largeur de chaussée
const H = TILE / 2;

const smooth = (t) => t * t * (3 - 2 * t);
const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const Y = [0, 1, 0];

const straight = (s) => ({ p: [0, 0, H - TILE * s], up: Y });

function turnPath(R) {
  // quart de cercle vers la droite, centre (R - H + H, 0, H) => entre au sud, sort à l'est
  return (s) => {
    const a = (s * Math.PI) / 2;
    return { p: [R - R * Math.cos(a), 0, H - R * Math.sin(a)], up: Y, center: [R, 0, H] };
  };
}

// Virage relevé : la chaussée pivote autour d'une ligne à « pivot » unités du centre côté intérieur
function banked(base, maxDeg, pivot) {
  const b0 = (maxDeg * Math.PI) / 180;
  return (s) => {
    const q = base(s);
    const sn = Math.sin(Math.PI * s);
    const b = b0 * sn * sn;
    // direction horizontale vers le centre du virage
    let cx = q.center[0] - q.p[0], cz = q.center[2] - q.p[2];
    const l = Math.hypot(cx, cz) || 1;
    cx /= l; cz /= l;
    const up = [Math.sin(b) * cx, Math.cos(b), Math.sin(b) * cz];
    return { p: [q.p[0], q.p[1] + pivot * Math.sin(b), q.p[2]], up };
  };
}

const slope = (levels, cells, ease = smooth) => (s) => ({ p: [0, levels * LEVEL_H * ease(s), H - TILE * cells * s], up: null });

// Looping sur 2 cases : approche (décalage à gauche), cercle en hélice, sortie (retour au centre)
function loopPath(R = 12, shift = 11) {
  const lenA = TILE, lenL = 2 * Math.PI * R, lenB = TILE, tot = lenA + lenL + lenB;
  const a = lenA / tot, b = (lenA + lenL) / tot;
  const zc = H - TILE; // centre du cercle (milieu du bloc)
  return (s) => {
    if (s <= a) {
      const t = s / a;
      return { p: [-shift * smooth(t), 0, H - TILE * t], up: null };
    }
    if (s >= b) {
      const t = (s - b) / (1 - b);
      return { p: [shift * (1 - smooth(t)), 0, zc - TILE * t], up: null };
    }
    const t = (s - a) / (b - a);
    const th = t * 2 * Math.PI;
    return {
      p: [-shift + 2 * shift * smoother(t), R - R * Math.cos(th), zc - R * Math.sin(th)],
      up: [0, Math.cos(th), Math.sin(th)],
    };
  };
}

// Wallride sur 3 cases : à droite, le sol se relève en quart de tube puis en mur vertical, et redescend.
// Profil transversal (de gauche à droite) : sol plat, arc de rayon WR_R, mur droit.
const WR_R = 12;
function wallProfile(b) {
  const F = ROAD_W - 10 * b, A = (Math.PI / 2) * b, W = 16 * b;
  const pts = [];
  const x0 = -ROAD_W / 2;
  pts.push([x0, 0, 0]); // [x, y, abscisse curviligne]
  pts.push([x0 + F, 0, F]);
  const n = 8;
  for (let i = 1; i <= n; i++) {
    const a = (A * i) / n;
    pts.push([x0 + F + WR_R * Math.sin(a), WR_R * (1 - Math.cos(a)), F + WR_R * a]);
  }
  const [lx, ly, lw] = pts[pts.length - 1];
  pts.push([lx + W * Math.cos(A), ly + W * Math.sin(A), lw + W]);
  return pts;
}
function wallBump(s) {
  return s < 0.32 ? smoother(s / 0.32) : s > 0.68 ? smoother((1 - s) / 0.32) : 1;
}
function wallPath(cells = 3) {
  return (s) => {
    const b = wallBump(s);
    const pts = wallProfile(b);
    const total = pts[pts.length - 1][2];
    // ligne idéale : du centre du sol au milieu du mur
    const target = ROAD_W / 2 + b * (total - ROAD_W / 2 - 8);
    let i = 1;
    while (i < pts.length - 1 && pts[i][2] < target) i++;
    const a = pts[i - 1], c = pts[i];
    const k = (target - a[2]) / Math.max(1e-6, c[2] - a[2]);
    const x = a[0] + (c[0] - a[0]) * k, y = a[1] + (c[1] - a[1]) * k;
    const dx = c[0] - a[0], dy = c[1] - a[1], l = Math.hypot(dx, dy) || 1;
    const z = H - TILE * cells * s;
    return { p: [x, y, z], up: [-dy / l, dx / l, 0], section: pts.map(([px, py]) => [px, py, z]) };
  };
}

const kicker = (s) => ({ p: [0, LEVEL_H * 0.45 * s * s, H - TILE * s], up: null });

// type de surface : road | dirt | ice | boost
export const BLOCKS = {
  road: { label: "Route", path: straight, n: 2, cat: "Routes" },
  dirt: { label: "Terre", path: straight, n: 2, surface: "dirt", cat: "Routes" },
  ice: { label: "Glace", path: straight, n: 2, surface: "ice", cat: "Routes" },
  boost: { label: "Turbo", path: straight, n: 2, surface: "boost", dir: true, cat: "Routes" },
  start: { label: "Départ", path: straight, n: 2, gate: "start", dir: true, cat: "Portiques" },
  cp: { label: "Checkpoint", path: straight, n: 2, gate: "cp", cat: "Portiques" },
  finish: { label: "Arrivée", path: straight, n: 2, gate: "finish", cat: "Portiques" },
  turn: { label: "Virage", path: turnPath(H), n: 14, cat: "Virages" },
  bank: { label: "Virage relevé", path: banked(turnPath(H), 30, 0), n: 18, cat: "Virages" },
  bigturn: { label: "Grand virage", path: turnPath(TILE + H), n: 22, cat: "Virages" },
  bigbank: { label: "Grand virage relevé", path: banked(turnPath(TILE + H), 34, ROAD_W / 2), n: 26, cat: "Virages" },
  slope: { label: "Pente", path: slope(1, 1), n: 10, cat: "Relief" },
  steep: { label: "Pente raide", path: slope(2, 1), n: 14, cat: "Relief" },
  hill: { label: "Montée longue", path: slope(3, 2), n: 20, cat: "Relief" },
  kicker: { label: "Tremplin", path: kicker, n: 10, dir: true, cat: "Relief" },
  loop: { label: "Looping", path: loopPath(), n: 110, cat: "Figures" },
  wall: { label: "Wallride", path: wallPath(), n: 48, cat: "Figures" },
  platform: { label: "Plateforme", path: straight, n: 2, width: TILE, cat: "Routes" },
};

// ---------- Blocs de la saison 2 ----------
// Réglages par tuile : tile.p = { clé: valeur }, valeurs par défaut dans params[clé].def (voir param()).
// Tout ce qui est dynamique dépend uniquement du numéro de pas (run.steps) : voir physics.js.
const S2 = { season: 2, cat: "Saison 2" };
const OFF = { season: "off", cat: "Saison 2" }; // pas encore validé : caché de la palette
const P = (label, min, max, def, step = 1) => ({ label, min, max, def, step });

// Tremplin réglable : angle d'arrivée (degrés) et longueur (1 ou 2 cases)
const kicker2Path = (deg, len) => {
  const a = Math.tan((deg * Math.PI) / 180) * TILE * len * 0.5;
  return (s) => ({ p: [0, a * s * s, H - TILE * len * s], up: null });
};
// Lacets de 9 unités : tangente droite aux deux bouts (le bloc s'enchaîne comme un bloc droit)
const railPath = (s) => ({ p: [9 * Math.sin(2 * Math.PI * s) * Math.sin(Math.PI * s), 0, H - TILE * s], up: Y });

Object.assign(BLOCKS, {
  boost2: { label: "Turbo réglable", path: straight, n: 2, surface: "boost2", dir: true, ...S2, params: { level: P("Niveau", 1, 3, 2) } },
  brake: { label: "Frein", path: straight, n: 2, surface: "brake", ...S2, params: { power: P("Force", 1, 3, 1) } },
  glue: { label: "Colle", path: straight, n: 2, surface: "glue", ...S2, params: { drag: P("Traînée", 2, 8, 4) } },
  oil: { label: "Huile", path: straight, n: 2, surface: "oil", ...S2 },
  kicker2: {
    label: "Tremplin réglable", path: kicker2Path(13, 1), n: 10, dir: true, ...S2,
    params: { angle: P("Angle (°)", 10, 35, 13), len: P("Longueur (cases)", 1, 2, 1) },
    variant: (p) => {
      const angle = Math.round(Math.max(10, Math.min(35, p.angle ?? 13))), len = Math.round(Math.max(1, Math.min(2, p.len ?? 1)));
      return { key: `${angle}:${len}`, path: kicker2Path(angle, len), n: 10 * len };
    },
  },
  cpfast: { label: "Checkpoint rapide", path: straight, n: 2, gate: "cp", fast: true, ...S2, params: { minSpeed: P("Vitesse min (km/h)", 40, 250, 100, 10) } },
  teleport: {
    label: "Téléporteur", path: straight, n: 2, gate: "teleport", ...S2,
    params: { pair: P("Paire n°", 1, 9, 1), role: P("0 = entrée, 1 = sortie", 0, 1, 0) },
  },
  wind: { label: "Vent", path: straight, n: 2, wind: true, ...S2, params: { force: P("Force latérale (m/s², signe = sens)", -30, 30, 12) } },
  // blocs lourds
  gate: {
    label: "Barrière", path: straight, n: 2, mech: "gate", ...S2,
    params: { period: P("Période (pas de 10 ms)", 50, 1000, 300, 10), closed: P("Fermée (pas)", 10, 990, 150, 10), offset: P("Décalage (pas)", 0, 990, 0, 10) },
  },
  lift: { label: "Plateforme mobile", path: straight, n: 2, mech: "lift", ...S2, params: { dist: P("Course (cases)", 1, 4, 2), period: P("Période (pas)", 100, 1500, 500, 10) } },
  switch: { label: "Interrupteur", path: straight, n: 2, gate: "switch", ...OFF, params: { id: P("Identifiant", 1, 5, 1) } },
  door: { label: "Porte", path: straight, n: 2, mech: "door", ...OFF, params: { id: P("Identifiant", 1, 5, 1) } },
  crate: { label: "Caisse", path: straight, n: 2, mech: "crate", ...OFF, params: { minSpeed: P("Vitesse min (km/h)", 40, 250, 90, 10) } },
  gravity: { label: "Gravité de piste", path: loopPath(16, 11), n: 110, gravity: true, ...OFF },
  rail: { label: "Rail", path: railPath, n: 14, mech: "rail", ...OFF },
});

// Valeur d'un réglage de tuile (tile.p ou valeur par défaut du bloc)
export function param(tile, key) {
  const v = tile?.p?.[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return BLOCKS[tile?.type]?.params?.[key]?.def;
}
export const defaultParams = (type) => Object.fromEntries(Object.entries(BLOCKS[type]?.params || {}).map(([k, d]) => [k, d.def]));

// Blocs à géométrie réglable : le type résolu inclut les réglages ("kicker2~25:2"), enregistré à la demande
export function resolveType(type, p) {
  const def = BLOCKS[type];
  if (!def || !def.variant) return type;
  const v = def.variant(p || {});
  const key = `${type}~${v.key}`;
  if (!BLOCKS[key]) BLOCKS[key] = { ...def, variant: null, path: v.path, n: v.n, base: type };
  return key;
}

export const BLOCK_KEYS = Object.keys(BLOCKS);

// Saison d'un bloc : season absent = 1 (aucun bloc existant ne change). Les futurs blocs `season: 2`
// restent cachés de la palette de l'éditeur tant que la saison 2 n'est pas ouverte (voir Editor.jsx).
export const blockSeason = (type) => BLOCKS[type]?.season ?? 1;
export const blockKeysForSeason = (maxSeason = 1) => BLOCK_KEYS.filter((k) => blockSeason(k) <= maxSeason);

// ---------- échantillonnage ----------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

const sampleCache = new Map();
// Frames le long d'un bloc (repère local) : { p, t (tangente), r (droite), u (haut) }
export function sampleBlock(type, n) {
  const def = BLOCKS[type];
  const N = n || def.n;
  const key = `${type}:${N}`;
  if (sampleCache.has(key)) return sampleCache.get(key);
  const out = [];
  const e = 1e-4;
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    const q = def.path(s);
    const a = def.path(clamp01(s - e)).p, b = def.path(clamp01(s + e)).p;
    const t = norm(sub(b, a));
    let up = q.up;
    if (!up) {
      // normale « verticale » perpendiculaire à la tangente (pentes)
      const r0 = norm(cross(t, Y));
      up = cross(r0, t);
    }
    const r = norm(cross(t, up));
    const u = norm(cross(r, t));
    out.push({ s, p: q.p, t, r, u, section: q.section || null });
  }
  sampleCache.set(key, out);
  return out;
}

export const blockWidth = (type) => BLOCKS[type].width || ROAD_W;

// Points du profil transversal (gauche -> droite), en local, pour un échantillon
export function sectionPoints(type, f) {
  if (f.section) return f.section;
  const w = blockWidth(type) / 2;
  return [-w, w].map((k) => [f.p[0] + f.r[0] * k, f.p[1] + f.r[1] * k, f.p[2] + f.r[2] * k]);
}

// ---------- placement (rotation par quarts horaires vu de dessus, nord -> est) ----------
export function rot2(x, z, r) {
  switch (r & 3) {
    case 1: return [-z, x];
    case 2: return [-x, -z];
    case 3: return [z, -x];
    default: return [x, z];
  }
}
export const cellCenter = (x, z) => [x * TILE + H, z * TILE + H];

// Transforme un point/vecteur local d'un bloc placé en coordonnées monde
export function toWorld(tile, v, isDir = false) {
  const [x, z] = rot2(v[0], v[2], tile.rot);
  if (isDir) return [x, v[1], z];
  const [cx, cz] = cellCenter(tile.x, tile.z);
  return [x + cx, v[1] + tile.level * LEVEL_H, z + cz];
}

const DX = [0, 1, 0, -1];
const DZ = [-1, 0, 1, 0];
const dirOf = (t) => (Math.abs(t[0]) > Math.abs(t[2]) ? (t[0] > 0 ? 1 : 3) : t[2] > 0 ? 2 : 0);
const cellOf = (x, z) => [Math.floor(x / TILE), Math.floor(z / TILE)];

// Bout d'un bloc (local) : case qui contient l'extrémité, direction de sortie, niveau
function endInfo(type, atStart) {
  const S = sampleBlock(type);
  const f = atStart ? S[0] : S[S.length - 1];
  const out = atStart ? f.t.map((v) => -v) : f.t; // direction en sortant par ce bout
  // point juste à l'intérieur du bloc et juste à l'extérieur
  const inside = [f.p[0] - out[0] * 2, f.p[1], f.p[2] - out[2] * 2];
  const [ix, iz] = cellOf(inside[0] + H, inside[2] + H);
  return { cell: [ix, iz], dir: dirOf(out), level: Math.round(f.p[1] / LEVEL_H) };
}
const endCache = new Map();
export function blockEnds(type) {
  if (!endCache.has(type)) endCache.set(type, { a: endInfo(type, true), b: endInfo(type, false) });
  return endCache.get(type);
}

// Place un bloc pour qu'on y entre par la case (cx, cz) au niveau l en roulant dans la direction d.
// reverse = parcourir le bloc depuis son extrémité. Retourne la tuile et la case/direction/niveau suivants.
export function placeFrom(type, cx, cz, d, l, reverse = false) {
  const ends = blockEnds(type);
  const entry = reverse ? ends.b : ends.a; // bout par lequel on entre
  const exit = reverse ? ends.a : ends.b;
  // direction d'entrée locale = opposée de la direction « sortante » du bout d'entrée
  const inDir = (entry.dir + 2) & 3;
  const rot = (d - inDir + 4) & 3;
  const [ox, oz] = rot2(entry.cell[0], entry.cell[1], rot);
  const x = cx - ox, z = cz - oz, level = l - entry.level;
  const tile = { x, z, type, rot, level };
  const [ex, ez] = rot2(exit.cell[0], exit.cell[1], rot);
  const nd = (exit.dir + rot) & 3;
  return { tile, next: { x: x + ex + DX[nd], z: z + ez + DZ[nd], d: nd, l: level + exit.level } };
}

// Cases occupées (x, z, bande de niveau) par un bloc placé
export function occupancy(tile0) {
  const tile = tile0.p ? { ...tile0, type: resolveType(tile0.type, tile0.p) } : tile0;
  const S = sampleBlock(tile.type);
  const set = new Set();
  for (let i = 1; i < S.length - 1; i++) {
    const sec = sectionPoints(tile.type, S[i]);
    const pts = [S[i].p, sec[0], sec[sec.length - 1]];
    if (sec.length > 2) pts.push(sec[Math.floor(sec.length / 2)]);
    for (const lp0 of pts) {
      // on rentre d'une unité vers l'axe pour ne pas déborder sur la case voisine
      const lp = lp0.map((v, j) => v + (S[i].p[j] - v) * (1 / 10));
      const p = toWorld(tile, lp);
      const [cx, cz] = cellOf(p[0], p[2]);
      set.add(`${cx},${cz},${Math.floor((p[1] + 0.5) / LEVEL_H)}`);
    }
  }
  // les blocs droits n'ont que 3 échantillons : on ajoute leur case de base
  set.add(`${tile.x},${tile.z},${tile.level}`);
  return set;
}

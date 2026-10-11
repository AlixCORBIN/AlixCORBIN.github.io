// Pistes en blocs (façon Trackmania) : une grille de cases de TILE unités, chaque bloc a un type,
// une rotation (quart de tour horaire vu de dessus) et un niveau (hauteur = niveau * LEVEL_H).
// Directions : 0 = nord (-z), 1 = est (+x), 2 = sud (+z), 3 = ouest (-x).

export const TILE = 32;
export const LEVEL_H = 8;
export const ROAD_HALF = 10; // demi-largeur de route
export const GRID = 24; // taille max d'une map (cases)

// Types de blocs. "gate" : portique ; "dir" : bloc orienté (ne marche que dans un sens).
export const BLOCKS = {
  road: { label: "Route", key: "1" },
  turn: { label: "Virage", key: "2" },
  ramp: { label: "Pente", key: "3", dir: true },
  boost: { label: "Turbo", key: "4", dir: true },
  start: { label: "Départ", key: "5", dir: true, gate: true },
  cp: { label: "Checkpoint", key: "6", gate: true },
  finish: { label: "Arrivée", key: "7", gate: true },
  wide: { label: "Plateforme", key: "8" },
  dirt: { label: "Terre", key: "9" },
};

const DX = [0, 1, 0, -1];
const DZ = [-1, 0, 1, 0];

// local -> monde : rotation horaire de r quarts (nord -> est)
export function rotLocal(u, v, r) {
  switch (r & 3) {
    case 1: return [-v, u];
    case 2: return [-u, -v];
    case 3: return [v, -u];
    default: return [u, v];
  }
}
// monde -> local (inverse)
export function toLocal(x, z, r) {
  return rotLocal(x, z, (4 - (r & 3)) & 3);
}

export const tileKey = (x, z, l) => `${x},${z},${l}`;
export const cellCenter = (x, z) => [x * TILE + TILE / 2, z * TILE + TILE / 2];

// Surface d'un bloc au point local (u, v) ∈ [-16, 16]² : hauteur relative ou null (pas de route).
// Les virages relient les côtés sud (+z) et est (+x) en rotation 0.
function localSurface(type, u, v) {
  const H = TILE / 2;
  if (type === "wide") return 0;
  if (type === "turn") {
    const d = Math.hypot(u - H, v - H);
    return Math.abs(d - H) <= ROAD_HALF ? 0 : null;
  }
  if (Math.abs(u) > ROAD_HALF) return null;
  if (type === "ramp") return ((H - v) / TILE) * LEVEL_H; // monte vers le nord
  return 0;
}

export class Track {
  constructor(data) {
    this.data = data;
    this.tiles = (data.tiles || []).map(([x, z, type, rot = 0, level = 0]) => ({ x, z, type, rot, level }));
    this.cells = new Map();
    for (const t of this.tiles) {
      const k = `${t.x},${t.z}`;
      if (!this.cells.has(k)) this.cells.set(k, []);
      this.cells.get(k).push(t);
    }
    this.start = this.tiles.find((t) => t.type === "start") || null;
    this.cps = this.tiles.filter((t) => t.type === "cp");
    this.finishes = this.tiles.filter((t) => t.type === "finish");
    let mx = 0, mz = 0;
    for (const t of this.tiles) { mx = Math.max(mx, t.x + 1); mz = Math.max(mz, t.z + 1); }
    this.size = [Math.max(mx, 4), Math.max(mz, 4)];
  }

  // Hauteur du sol sous (x, z) : la surface de route la plus haute sous y + tol, sinon l'herbe (0).
  ground(x, z, y = 1e9, tol = 1.5) {
    const cx = Math.floor(x / TILE), cz = Math.floor(z / TILE);
    const list = this.cells.get(`${cx},${cz}`);
    let best = -0.3, tile = null; // herbe légèrement sous la route
    if (list) {
      const [ox, oz] = cellCenter(cx, cz);
      for (const t of list) {
        const [u, v] = toLocal(x - ox, z - oz, t.rot);
        const s = localSurface(t.type, u, v);
        if (s === null) continue;
        const h = t.level * LEVEL_H + s;
        if (h <= y + tol && (tile === null || h > best)) { best = h; tile = t; }
      }
    }
    return { h: best, tile };
  }

  // Point de départ / réapparition sur un bloc donné (centre, cap selon la rotation)
  spawnOn(t) {
    const [x, z] = cellCenter(t.x, t.z);
    return { x, z, y: t.level * LEVEL_H + 0.5, heading: t.rot };
  }

  validate() {
    if (!this.start) return "Il faut un bloc Départ.";
    if (this.tiles.filter((t) => t.type === "start").length > 1) return "Un seul bloc Départ.";
    if (!this.finishes.length) return "Il faut au moins une Arrivée.";
    return null;
  }
}

// Clé de bloc portique (pour le suivi des checkpoints)
export const gateId = (t) => `${t.x},${t.z},${t.level}`;

/* ---------- Constructeur « tortue » pour les maps officielles ----------
   Chaque lettre pose un bloc puis avance d'une case :
   S route · L / R virage gauche / droite · C checkpoint · B turbo · U pente montante · D pente descendante
   K tremplin (pente, la route reprend au niveau d'avant : saut) · _ vide (trou à sauter) · T terre
   F arrivée. Un chiffre après une lettre la répète (S3 = trois routes). Le départ est posé en premier. */
export function buildTrack(path, { x = 2, z = 20, heading = 0, level = 0 } = {}) {
  const tiles = [];
  let d = heading, l = level, cx = x, cz = z;
  const put = (type, rot, lv = l) => tiles.push([cx, cz, type, rot & 3, lv]);
  const step = () => { cx += DX[d]; cz += DZ[d]; };
  put("start", d);
  step();
  const tokens = path.replace(/\s+/g, "").match(/[A-Z_][0-9]*/g) || [];
  for (const tok of tokens) {
    const n = tok.length > 1 ? parseInt(tok.slice(1), 10) : 1;
    for (let i = 0; i < n; i++) {
      switch (tok[0]) {
        case "S": put("road", d); break;
        case "T": put("dirt", d); break;
        case "C": put("cp", d); break;
        case "B": put("boost", d); break;
        case "F": put("finish", d); break;
        case "W": put("wide", 0); break;
        case "R": put("turn", d); d = (d + 1) & 3; break;
        case "L": put("turn", d + 1); d = (d + 3) & 3; break;
        case "U": put("ramp", d); l += 1; break;
        case "K": put("ramp", d); break;
        case "D": l -= 1; put("ramp", d + 2, l); break;
        case "_": break;
        default: break;
      }
      step();
    }
  }
  return tiles;
}

// Décale une liste de blocs pour qu'elle tienne dans la grille (marge d'une case)
export function normalizeTiles(tiles) {
  let mx = Infinity, mz = Infinity;
  for (const t of tiles) { mx = Math.min(mx, t[0]); mz = Math.min(mz, t[1]); }
  return tiles.map(([x, z, ...rest]) => [x - mx + 1, z - mz + 1, ...rest]);
}

// Vérifie qu'aucune case n'est occupée deux fois au même niveau (ni par un bloc et la pente qui y monte)
export function overlaps(tiles) {
  const seen = new Set(), bad = [];
  for (const [x, z, type, , l] of tiles) {
    const ks = [tileKey(x, z, l)];
    if (type === "ramp") ks.push(tileKey(x, z, l + 1));
    for (const k of ks) { if (seen.has(k)) bad.push(k); seen.add(k); }
  }
  return bad;
}

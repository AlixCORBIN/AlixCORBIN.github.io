// Piste = liste de blocs placés sur une grille (x, z, type, rot, niveau). Voir blocks.js pour la géométrie.
import { BLOCKS, LEVEL_H, TILE, occupancy, placeFrom, sampleBlock, toWorld } from "./blocks.js";

export { TILE, LEVEL_H } from "./blocks.js";
export const GRID = 32; // taille max d'une map (cases)
export const MAX_LEVEL = 12;

// Anciennes maps (v1) : types renommés
const LEGACY = { ramp: "slope", wide: "platform" };

export class Track {
  constructor(data) {
    this.data = data;
    this.tiles = (data.tiles || [])
      .map(([x, z, type, rot = 0, level = 0]) => ({ x, z, type: LEGACY[type] || type, rot: rot & 3, level }))
      .filter((t) => BLOCKS[t.type]);
    this.start = this.tiles.find((t) => t.type === "start") || null;
    this.cps = this.tiles.filter((t) => t.type === "cp");
    this.finishes = this.tiles.filter((t) => t.type === "finish");
    this.gates = this.tiles.filter((t) => BLOCKS[t.type].gate).map((t) => ({ tile: t, kind: BLOCKS[t.type].gate, ...frameAt(t, 0.5) }));
    let mx = 0, mz = 0, nx = 0, nz = 0;
    for (const t of this.tiles) {
      for (const k of occupancy(t)) {
        const [x, z] = k.split(",").map(Number);
        mx = Math.max(mx, x + 1); mz = Math.max(mz, z + 1); nx = Math.min(nx, x); nz = Math.min(nz, z);
      }
    }
    this.min = [nx, nz];
    this.size = [Math.max(mx, 4), Math.max(mz, 4)];
  }

  // Position et orientation de départ : sur le bloc Départ, avant le portique
  spawn() {
    const f = frameAt(this.start, 0.3);
    return { p: [f.p[0] + f.u[0] * 1.2, f.p[1] + f.u[1] * 1.2, f.p[2] + f.u[2] * 1.2], fwd: f.t, up: f.u };
  }

  validate() {
    if (!this.start) return "Il faut un bloc Départ.";
    if (this.tiles.filter((t) => t.type === "start").length > 1) return "Un seul bloc Départ.";
    if (!this.finishes.length) return "Il faut au moins une Arrivée.";
    return null;
  }
}

// Repère monde d'un bloc placé au paramètre s (interpolé entre deux échantillons)
export function frameAt(tile, s) {
  const S = sampleBlock(tile.type);
  const x = Math.max(0, Math.min(1, s)) * (S.length - 1);
  const i = Math.min(S.length - 2, Math.floor(x)), k = x - i;
  const A = S[i], B = S[i + 1];
  const mix = (a, b) => a.map((v, j) => v + (b[j] - v) * k);
  return { p: toWorld(tile, mix(A.p, B.p)), t: toWorld(tile, mix(A.t, B.t), true), r: toWorld(tile, mix(A.r, B.r), true), u: toWorld(tile, mix(A.u, B.u), true) };
}

export const gateId = (t) => `${t.x},${t.z},${t.level}`;

/* ---------- Constructeur « tortue » pour les maps officielles ----------
   Jetons (un chiffre à la fin répète) :
   S route · T terre · I glace · B turbo · C checkpoint · F arrivée · X plateforme
   R / L virage · Rb / Lb virage relevé · Rg / Lg grand virage · Rgb / Lgb grand virage relevé
   U pente · Us pente raide · Uh montée longue (3 niveaux) · D / Ds / Dh les mêmes en descente
   K tremplin · _ case vide (saut) · Y descendre d'un niveau sans poser (réception plus bas)
   O looping · W wallride à droite · Wl wallride à gauche */
const TOKENS = {
  S: ["road"], T: ["dirt"], I: ["ice"], B: ["boost"], C: ["cp"], F: ["finish"], X: ["platform"],
  R: ["turn"], L: ["turn", true], Rb: ["bank"], Lb: ["bank", true], Rg: ["bigturn"], Lg: ["bigturn", true],
  Rgb: ["bigbank"], Lgb: ["bigbank", true],
  U: ["slope"], Us: ["steep"], Uh: ["hill"], D: ["slope", true], Ds: ["steep", true], Dh: ["hill", true],
  K: ["kicker"], O: ["loop"], W: ["wall"], Wl: ["wall", true],
};
const DX = [0, 1, 0, -1];
const DZ = [-1, 0, 1, 0];

export function buildTrack(path, { x = 0, z = 0, d = 0, l = 0 } = {}) {
  const tiles = [];
  let cur = placeFrom("start", x, z, d, l);
  tiles.push(cur.tile);
  let st = cur.next;
  const tokens = path.replace(/\s+/g, "").match(/[A-Z_][a-z]*[0-9]*/g) || [];
  for (const tok of tokens) {
    const m = tok.match(/^([A-Z_][a-z]*)([0-9]*)$/);
    const n = m[2] ? parseInt(m[2], 10) : 1;
    for (let i = 0; i < n; i++) {
      if (m[1] === "_") { st = { ...st, x: st.x + DX[st.d], z: st.z + DZ[st.d] }; continue; }
      if (m[1] === "Y") { st = { ...st, l: st.l - 1 }; continue; }
      const def = TOKENS[m[1]];
      if (!def) throw new Error(`Jeton inconnu ${tok}`);
      const r = placeFrom(def[0], st.x, st.z, st.d, st.l, !!def[1]);
      tiles.push(r.tile);
      st = r.next;
    }
  }
  return tiles.map((t) => [t.x, t.z, t.type, t.rot, t.level]);
}

// Décale les blocs pour que tout tienne dans la grille, avec une case de marge (niveau min 0)
export function normalizeTiles(tiles) {
  const t = new Track({ tiles });
  const minL = Math.min(0, ...tiles.map((x) => x[4]));
  return tiles.map(([x, z, type, rot, l]) => [x - t.min[0] + 1, z - t.min[1] + 1, type, rot, l - minL]);
}

// Paires de blocs qui se chevauchent (même case, même bande de niveau)
export function overlaps(tiles) {
  const seen = new Map(), bad = [];
  tiles.forEach(([x, z, type, rot, level], i) => {
    for (const k of occupancy({ x, z, type, rot, level })) {
      if (seen.has(k) && seen.get(k) !== i) bad.push(`${k} (${tiles[seen.get(k)][2]}/${type})`);
      seen.set(k, i);
    }
  });
  return bad;
}

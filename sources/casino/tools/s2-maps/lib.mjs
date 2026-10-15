// Outils de construction et de validation des maps de la campagne saison 2 (voir campaign.mjs et build.mjs).
//
// Notation « tortue » (une chaîne, jetons séparés par des espaces) :
//   bloc[:clé=val,clé=val][/d|/i|/w]   pose un bloc ; /d terre, /i glace, /w eau (réglage surf)
//   !bloc…                              même bloc parcouru dans l'autre sens (virages : à gauche ; pentes : descente)
//   alias : S route, C checkpoint, F arrivée, X plateforme, Sb route sans bords, Sn route étroite, Cf checkpoint rapide,
//           W eau, B turbo réglable, K tremplin réglable
//   _  case vide (saut)     Y  un niveau plus bas     ^  un niveau plus haut
//   @nom  mémorise la position     =nom  y revient
//   <A … A>  blocs de la ligne principale contournés par le raccourci A
//   {A … }   blocs du raccourci A (ignorés par le pilote principal, suivis par le pilote « raccourci »)
//   >R / >L  sort de la dernière plateforme posée par son côté droit / gauche
//   #nom     étiquette du bloc suivant (pour les consignes de vitesse du pilote : slow: { nom: m/s })
import { BLOCKS, LEVEL_H, TILE, occupancy, placeFrom, resolveType, sampleBlock, sectionPoints, toWorld } from "../../src/games/racing/blocks.js";
import { Track, normalizeTiles, overlaps } from "../../src/games/racing/track.js";

const ALIAS = { S: "road", C: "cp", F: "finish", X: "platform", Sb: "bare", Sn: "narrow", Cf: "cpfast", W: "water", B: "boost2", K: "kicker2" };
const SURF = { d: 1, i: 2, w: 3 };
const DX = [0, 1, 0, -1], DZ = [-1, 0, 1, 0];

function parseTok(tok) {
  let rev = false;
  if (tok.startsWith("!")) { rev = true; tok = tok.slice(1); }
  let surf = null;
  const sm = tok.match(/\/([diw])$/);
  if (sm) { surf = SURF[sm[1]]; tok = tok.slice(0, -2); }
  const [name, ps] = tok.split(":");
  const type = ALIAS[name] || name;
  if (!BLOCKS[type]) throw new Error(`Bloc inconnu : ${name}`);
  let p = null;
  if (ps) p = Object.fromEntries(ps.split(",").map((kv) => { const [k, v] = kv.split("="); return [k, Number(v)]; }));
  if (surf !== null) p = { ...(p || {}), surf };
  return { type, p, rev };
}

// Construit les tuiles. Retourne { tiles (normalisées), meta par tuile : { alt, bypass } }
export function build(src, { start = { x: 0, z: 0, d: 0, l: 4 } } = {}) {
  const toks = src.trim().split(/\s+/);
  const raw = [];
  const info = [];
  let first = placeFrom("start", start.x, start.z, start.d, start.l);
  raw.push([first.tile.x, first.tile.z, "start", first.tile.rot, first.tile.level]);
  info.push({});
  let st = first.next;
  const saved = {};
  const bypass = new Set(); // groupes de contournement ouverts
  let alt = null; // groupe de raccourci en cours
  let last = null; // dernière tuile posée (pour >R / >L)
  const labels = {};
  let pending = [];
  for (const tok of toks) {
    if (tok === "_") { st = { ...st, x: st.x + DX[st.d], z: st.z + DZ[st.d] }; continue; }
    if (tok === "Y") { st = { ...st, l: st.l - 1 }; continue; }
    if (tok === "^") { st = { ...st, l: st.l + 1 }; continue; }
    if (tok.startsWith("@")) { saved[tok.slice(1)] = { ...st }; continue; }
    if (tok.startsWith("=")) { st = { ...saved[tok.slice(1)] }; continue; }
    if (/^<[A-Z]$/.test(tok)) { bypass.add(tok[1]); continue; }
    if (/^[A-Z]>$/.test(tok)) { bypass.delete(tok[0]); continue; }
    if (/^\{[A-Z]$/.test(tok)) { alt = tok[1]; continue; }
    if (tok === "}") { alt = null; continue; }
    if (tok.startsWith("#")) { pending.push(tok.slice(1)); continue; }
    if (tok === ">R" || tok === ">L") {
      // sortie latérale d'une plateforme : la case voisine à droite / à gauche, dans cette direction
      const d = (last.d + (tok === ">R" ? 1 : 3)) & 3;
      st = { x: last.x + DX[d], z: last.z + DZ[d], d, l: last.l };
      continue;
    }
    const { type, p, rev } = parseTok(tok);
    const r = placeFrom(type, st.x, st.z, st.d, st.l, rev, p);
    const t = [r.tile.x, r.tile.z, r.tile.type, r.tile.rot, r.tile.level];
    if (p) t.push(p);
    raw.push(t);
    for (const n of pending) labels[n] = raw.length - 1;
    pending = [];
    info.push({ alt, bypass: [...bypass] });
    last = { x: st.x, z: st.z, d: st.d, l: st.l };
    st = r.next;
  }
  return { tiles: normalizeTiles(raw), info, end: st, labels };
}

// Indices des tuiles pour le pilote : ligne principale (raccourcis ignorés) et ligne de chaque raccourci
export function lines(info) {
  const main = info.map((x, i) => (x.alt ? null : i)).filter((i) => i !== null);
  const groups = [...new Set(info.map((x) => x.alt).filter(Boolean))];
  const alts = {};
  for (const g of groups) {
    const altTiles = info.map((x, i) => (x.alt === g ? i : null)).filter((i) => i !== null);
    const byp = main.filter((i) => info[i].bypass?.includes(g));
    const firstB = byp.length ? main.indexOf(byp[0]) : null;
    const before = firstB === null ? main : main.slice(0, firstB);
    const after = firstB === null ? [] : main.slice(main.indexOf(byp[byp.length - 1]) + 1);
    alts[g] = [...before, ...altTiles, ...after];
  }
  // raccourcis sans blocs propres (chute, saut à travers le vide) : seulement des blocs contournés
  for (const i of main) for (const g of info[i].bypass || []) {
    if (alts[g]) continue;
    alts[g] = main.filter((j) => !info[j].bypass?.includes(g));
  }
  return { main, alts };
}

// ---------- validations ----------
const PLAIN = new Set(["road", "bare", "narrow", "platform", "cp", "start", "finish", "cpfast"]);

export function checkMap(m, tiles, info) {
  const errs = [], warns = [];
  const data = { v: 2, world: m.world, tiles };
  if (m.ground) data.ground = m.ground;
  const track = new Track(data);
  const v = track.validate();
  if (v) errs.push(v);
  const ov = overlaps(tiles);
  if (ov.length) errs.push(`chevauchements : ${ov.slice(0, 4).join(" ")}${ov.length > 4 ? "…" : ""}`);
  const [w, h] = track.size;
  if (w > 32 || h > 32) errs.push(`trop grande : ${w}×${h} (max 32×32)`);
  const levels = tiles.map((t) => t[4]);
  const maxL = Math.max(...levels);
  if (maxL > 12) errs.push(`niveau ${maxL} > 12`);
  const relief = maxL - Math.min(...levels);
  if (relief < 4) errs.push(`dénivelé ${relief} niveaux (< 4)`);
  const n = tiles.length;
  if (n < 20 || n > 80) errs.push(`${n} blocs (attendu 20 à 80)`);
  if (track.cps.length < 3) errs.push(`${track.cps.length} checkpoints (< 3)`);
  // lignes droites sans élément : au plus 4 blocs droits « simples » d'affilée sur la ligne principale
  const { main } = lines(info);
  let run = 0, worst = 0;
  for (const i of main) {
    if (PLAIN.has(tiles[i][2]) && !(tiles[i][5]?.surf)) { run++; worst = Math.max(worst, run); } else run = 0;
  }
  if (worst > 4) errs.push(`ligne droite de ${worst} blocs sans élément`);
  // dégagement : deux chaussées de blocs non reliés ne doivent pas passer à moins de 7 u l'une de l'autre
  const clr = clearance(track);
  if (clr.length) errs.push(`dégagement : ${clr.slice(0, 3).join(" ; ")}`);
  return { errs, warns, track, data, size: [w, h], relief, n };
}

// Points de chaussée de chaque tuile ; deux tuiles sont « reliées » si un de leurs bouts se touche
export function clearance(track) {
  const pts = track.tiles.map((t) => {
    const S = sampleBlock(t.type);
    const out = [];
    for (const f of S) for (const lp of sectionPoints(t.type, f)) out.push(toWorld(t, lp));
    for (const f of S) out.push(toWorld(t, f.p));
    return out;
  });
  const ends = track.tiles.map((t) => { const S = sampleBlock(t.type); return [toWorld(t, S[0].p), toWorld(t, S[S.length - 1].p)]; });
  const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const linked = (i, j) => ends[i].some((a) => ends[j].some((b) => d3(a, b) < 3)) || track.tiles[i].type === "platform" || track.tiles[j].type === "platform";
  const grid = new Map();
  pts.forEach((arr, i) => arr.forEach((p) => {
    const k = `${Math.floor(p[0] / 8)},${Math.floor(p[2] / 8)}`;
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push([i, p]);
  }));
  const bad = new Set();
  for (const [k, list] of grid) {
    const [gx, gz] = k.split(",").map(Number);
    const near = [];
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) near.push(...(grid.get(`${gx + dx},${gz + dz}`) || []));
    for (const [i, p] of list) for (const [j, q] of near) {
      if (j <= i) continue;
      if (Math.hypot(p[0] - q[0], p[2] - q[2]) < 5 && Math.abs(p[1] - q[1]) < 7 && !linked(i, j)) bad.add(`${track.tiles[i].type}#${i}/${track.tiles[j].type}#${j}`);
    }
  }
  return [...bad];
}

// Suites de 4 blocs (type + réglages) de la ligne principale, hors suites faites surtout de routes
export function ngrams(tiles, info, n = 4) {
  const { main } = lines(info);
  const sig = main.map((i) => { const t = tiles[i]; const p = t[5] ? JSON.stringify(t[5]) : ""; return t[2] + p; });
  const out = new Set();
  for (let i = 0; i + n <= sig.length; i++) {
    const g = sig.slice(i, i + n);
    if (g.filter((x) => PLAIN.has(x.replace(/\{.*$/, ""))).length >= 2) continue;
    out.add(g.join(" "));
  }
  return out;
}

// Plan ASCII par case (niveau max, D départ, F arrivée, C checkpoint)
export function ascii(track) {
  const g = {};
  let W = 0, H = 0;
  for (const tile of track.tiles) {
    for (const k of occupancy(tile)) {
      const [x, z, lv] = k.split(",").map(Number);
      const ch = tile.type === "start" ? "D" : tile.type === "finish" ? "F" : BLOCKS[tile.type].gate === "cp" ? "C" : lv > 9 ? String.fromCharCode(55 + lv) : String(Math.max(0, lv));
      const kk = `${x},${z}`;
      if (!g[kk] || "DFC".includes(ch) || (!"DFC".includes(g[kk]) && ch > g[kk])) g[kk] = ch;
      W = Math.max(W, x + 1); H = Math.max(H, z + 1);
    }
  }
  let s = "";
  for (let z = 0; z < H; z++) { for (let x = 0; x < W; x++) s += g[`${x},${z}`] || "·"; s += "\n"; }
  return s;
}
export { LEVEL_H, TILE, resolveType };

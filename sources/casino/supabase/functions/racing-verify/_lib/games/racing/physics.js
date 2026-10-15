// Physique : Rapier (corps rigides) + contrôleur de véhicule à rayons (4 roues à suspensions).
// Pas fixe de 1/100 s : 1 pas = 10 ms de chrono. Tout tourne hors de React.
import RAPIER from "@dimforge/rapier3d-compat";
import { BLOCKS, TILE, param, sampleBlock, sectionPoints, tileSurface, toWorld } from "./blocks.js";
import { groundSurface, terrainOf } from "./terrain.js";

export const DT = 1 / 100;
const GHOST_TAG = -2;
export const GHOST_EVERY = 5; // un point de fantôme tous les 5 pas (50 ms)
const GRAVITY = 26;
const GRASS_Y = -0.3;

// Réglages par monde
export const WORLDS = [
  { id: "stadium", name: "Stadium", grip: 1, sky: "#7fc4ff", fog: "#bfe3ff", ground: "#4f9a3c", road: "#3a3d44", accent: "#ffd23f" },
  { id: "desert", name: "Canyon", grip: 0.95, sky: "#ffc98a", fog: "#f3d2a2", ground: "#d9a45f", road: "#5a4a3a", accent: "#ff7a2f" },
  { id: "snow", name: "Glacier", grip: 0.7, sky: "#cfe6ff", fog: "#eef6ff", ground: "#f1f6fb", road: "#6c7f95", accent: "#3fd3ff" },
  { id: "forest", name: "Forêt", grip: 0.9, sky: "#9fd3b0", fog: "#c9e8cf", ground: "#2f6b33", road: "#4a3d33", accent: "#a6ff4d" },
  { id: "neon", name: "Néon", grip: 1.05, sky: "#120a2a", fog: "#1a0f3a", ground: "#140c2e", road: "#1c1c2c", accent: "#ff3fd8", night: true },
  // Saison 2 : pistes suspendues au-dessus du vide (pas de sol praticable, voir createWorld / stepRun)
  { id: "s2tech", name: "Atelier", season: 2, void: true, grip: 1, sky: "#9fb3c8", fog: "#c3cfdb", ground: "#3d4652", road: "#33363d", accent: "#ff9f1c", style: "Tech" },
  { id: "s2speed", name: "Stratosphère", season: 2, void: true, grip: 1.02, sky: "#3d8cff", fog: "#a9d0ff", ground: "#f4f8ff", road: "#2f3440", accent: "#29e0ff", style: "Fullspeed" },
  { id: "s2dirt", name: "Mesa rouge", season: 2, void: true, grip: 0.95, sky: "#f5a25d", fog: "#f2c08c", ground: "#8a3b1f", road: "#5a4a3a", accent: "#ffcf4a", style: "Dirt" },
  { id: "s2ice", name: "Banquise", season: 2, void: true, grip: 0.8, sky: "#bfe4ff", fog: "#e8f6ff", ground: "#2a6f9e", road: "#6c7f95", accent: "#7df9ff", style: "Ice" },
  { id: "s2air", name: "Archipel", season: 2, void: true, grip: 1, sky: "#1b1446", fog: "#3a2a7a", ground: "#0d0a26", road: "#24243a", accent: "#ffd23f", night: true, style: "Mixte aérien" },
];
export const worldsForSeason = (season) => WORLDS.map((w, i) => ({ ...w, index: i })).filter((w) => (w.season ?? 1) === season);

// Surfaces : adhérence latérale, adhérence longitudinale, frein moteur
const SURF = {
  road: { side: 1, slip: 1 },
  boost: { side: 1, slip: 1 },
  dirt: { side: 0.62, slip: 0.75 },
  ice: { side: 0.28, slip: 0.35 },
  grass: { side: 0.55, slip: 0.6 },
  // saison 2
  boost2: { side: 1, slip: 1 },
  brake: { side: 1, slip: 0.9 },
  glue: { side: 1.6, slip: 1.3 },
  oil: { side: 0.07, slip: 0.1 },
  water: { side: 0.75, slip: 0.8 },
  revboost: { side: 1, slip: 1 },
  sand: { side: 0.5, slip: 0.55 }, // sol des maps de la saison 2 (terrain.js)
  snow: { side: 0.4, slip: 0.45 },
};
// Eau : freinage proportionnel à la vitesse au-delà de WATER_V (m/s) : ralentit fortement, n'arrête jamais
const WATER_V = 15, WATER_K = 0.6;
// Booster inversé : pendant REV_T secondes, moteur ×0,15 et traînée ×5 (frein brutal), turbo coupé
const REV_T = 0.8;
// Figures assistées : raideur (1/s²) et amortissement (1/s) du rappel vers l'axe
const ASSIST_K = 5, ASSIST_C = 3.5, MAGNET = 8, MAGNET_T = 0.4;

// Turbo réglable : durée (s), force du moteur, division de la traînée. Le niveau 2 = turbo classique.
const BOOST2 = {
  1: { dur: 1.1, k: 1.18, drag: 1.06 },
  2: { dur: 1.8, k: 1.3, drag: 1.12 },
  3: { dur: 2.6, k: 1.5, drag: 1.2 },
};

const CAR = {
  half: [1.05, 0.32, 2.15],
  mass: 1000,
  wheels: [
    [-1.15, -0.05, -1.45, true],
    [1.15, -0.05, -1.45, true],
    [-1.15, -0.05, 1.55, false],
    [1.15, -0.05, 1.55, false],
  ],
  radius: 0.5,
  rest: 0.45,
  travel: 0.35,
  stiff: 70,
  comp: 3.2,
  relax: 3.8,
  slip: 2.6,
  engine: 3600, // par roue (4x4)
  brake: 120,
  drag: 1.95, // traînée (v²)
  roll: 18, // résistance au roulement
  down: 2.2, // appui aéro (v²)
  topBoost: 1.3,
};

let ready = null;
export const initPhysics = () => (ready ||= RAPIER.init());

// --------- Maillage de collision de la route (dessus de chaussée) ---------
export function roadTriangles(tile, thickness = 0.6) {
  const S = sampleBlock(tile.type);
  const top = [], bot = [];
  let m = 0;
  for (const f of S) {
    const sec = sectionPoints(tile.type, f);
    m = sec.length;
    for (const lp of sec) {
      top.push(...toWorld(tile, lp));
      bot.push(...toWorld(tile, [lp[0] - f.u[0] * thickness, lp[1] - f.u[1] * thickness, lp[2] - f.u[2] * thickness]));
    }
  }
  const n = top.length / 3;
  const idx = [];
  for (let i = 0; i < S.length - 1; i++) {
    for (let j = 0; j < m - 1; j++) {
      const a = i * m + j, b = a + 1, c = a + m, d = c + 1;
      idx.push(a, b, c, b, d, c); // dessus (normale vers le haut de la route)
      idx.push(n + a, n + c, n + b, n + b, n + c, n + d); // dessous
    }
  }
  return { verts: new Float32Array([...top, ...bot]), idx: new Uint32Array(idx), top: n };
}

// Accotement d'une route posée au sol : talus qui descend de chaque bord jusqu'au terrain (pente 1/2, 3 u de large au
// minimum), là où la chaussée est à peu près à plat et à moins de 6 u au-dessus du terrain (maps de la saison 2 avec sol,
// voir terrain.js) : on remonte sur la piste depuis le sable, même sur une bosse
export function skirtTriangles(tile, terrain) {
  const S = sampleBlock(tile.type);
  const verts = [], idx = [];
  for (const side of [0, 1]) {
    const row = S.map((f) => {
      const sec = sectionPoints(tile.type, f);
      const a = toWorld(tile, sec[side ? sec.length - 1 : 0]);
      const r = toWorld(tile, f.r, true), l = Math.hypot(r[0], r[2]) || 1, k = side ? 1 : -1;
      const drop = a[1] - terrain.at(a[0], a[2]);
      const w = 3 + 2 * Math.max(0, drop);
      const bx = a[0] + (r[0] / l) * w * k, bz = a[2] + (r[2] / l) * w * k;
      return { a, b: [bx, Math.min(a[1] - 0.6, terrain.at(bx, bz) - 0.3), bz], ok: f.u[1] > 0.9 && drop < 6 };
    });
    for (let i = 0; i < row.length - 1; i++) {
      if (!row[i].ok || !row[i + 1].ok) continue;
      const n = verts.length / 3;
      verts.push(...row[i].a, ...row[i].b, ...row[i + 1].a, ...row[i + 1].b);
      idx.push(n, n + 1, n + 2, n + 1, n + 3, n + 2, n, n + 2, n + 1, n + 1, n + 2, n + 3);
    }
  }
  return idx.length ? { verts: new Float32Array(verts), idx: new Uint32Array(idx) } : null;
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// Quaternion à partir d'une base (avant = -z local, haut = +y local)
export function quatFromBasis(fwd, up) {
  const z = norm(fwd.map((v) => -v));
  const x = norm(cross(up, z));
  const y = cross(z, x);
  const m00 = x[0], m01 = y[0], m02 = z[0], m10 = x[1], m11 = y[1], m12 = z[1], m20 = x[2], m21 = y[2], m22 = z[2];
  const tr = m00 + m11 + m22;
  let qw, qx, qy, qz;
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; qw = s / 4; qx = (m21 - m12) / s; qy = (m02 - m20) / s; qz = (m10 - m01) / s; }
  else if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; qw = (m21 - m12) / s; qx = s / 4; qy = (m01 + m10) / s; qz = (m02 + m20) / s; }
  else if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; qw = (m02 - m20) / s; qx = (m01 + m10) / s; qy = s / 4; qz = (m12 + m21) / s; }
  else { const s = Math.sqrt(1 + m22 - m00 - m11) * 2; qw = (m10 - m01) / s; qx = (m02 + m20) / s; qy = (m12 + m21) / s; qz = s / 4; }
  return { x: qx, y: qy, z: qz, w: qw };
}

export function rotate(q, v) {
  const [x, y, z] = v;
  const ix = q.w * x + q.y * z - q.z * y, iy = q.w * y + q.z * x - q.x * z, iz = q.w * z + q.x * y - q.y * x, iw = -q.x * x - q.y * y - q.z * z;
  return [ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y, iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z, iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x];
}

// Repère monde d'un bloc posé, au milieu de son axe : { p, t (avant), r (droite), u (haut) }
function tileFrame(tile) {
  const S = sampleBlock(tile.type);
  const f = S[Math.floor((S.length - 1) / 2)];
  return { p: toWorld(tile, f.p), t: toWorld(tile, f.t, true), r: toWorld(tile, f.r, true), u: toWorld(tile, f.u, true) };
}

// Plateforme mobile : va-et-vient le long du bloc sur `dist` cases, période `period` pas.
// Position = fonction pure de run.steps (déterminisme du rejeu).
export function liftPhase(tile, steps) {
  const period = Math.max(2, Math.round(param(tile, "period") ?? 500));
  const x = (steps % period) / period;
  const tri = x < 0.5 ? x * 2 : 2 - x * 2;
  return tri * tri * (3 - 2 * tri);
}
function liftPos(f, tile, steps) {
  const d = (param(tile, "dist") ?? 2) * TILE * liftPhase(tile, steps);
  return [f.p[0] - f.u[0] * 0.3 + f.t[0] * d, f.p[1] - f.u[1] * 0.3 + f.t[1] * d, f.p[2] - f.u[2] * 0.3 + f.t[2] * d];
}
// Barrière cyclique : fermée tant que (pas + décalage) % période < durée fermée
export function gateClosed(tile, steps) {
  const period = Math.max(2, Math.round(param(tile, "period") ?? 300));
  return (steps + Math.round(param(tile, "offset") ?? 0)) % period < (param(tile, "closed") ?? 150);
}
export const crateKey = (t) => `crate:${t.x},${t.z},${t.level}`;
export const switchKey = (id) => `sw:${id}`;

// Met à jour barrières, portes, caisses et plateformes pour le pas qui va être simulé
function updateMechanisms(phys, run, car) {
  const n = run.steps;
  let bp = null;
  for (const m of phys.mech) {
    let on = m.on;
    if (m.kind === "lift") {
      const p = liftPos(m.f, m.tile, n + 1);
      m.body.setNextKinematicTranslation({ x: p[0], y: p[1], z: p[2] });
      continue;
    }
    if (m.kind === "gate") on = gateClosed(m.tile, n);
    else if (m.kind === "door") on = !run.flags[switchKey(param(m.tile, "id"))];
    else if (m.kind === "crate") {
      const key = crateKey(m.tile);
      if (!run.flags[key]) {
        // la voiture touche la caisse (rayon ~2,4 m autour de son centre) assez vite : elle explose, sinon elle bloque
        bp ||= car.body.translation();
        const d = [bp.x - m.f.p[0] - m.f.u[0] * 2, bp.y - m.f.p[1] - m.f.u[1] * 2, bp.z - m.f.p[2] - m.f.u[2] * 2];
        const gap = Math.hypot(Math.max(0, Math.abs(dot(d, m.f.r)) - 4), Math.max(0, Math.abs(dot(d, m.f.u)) - 2), Math.max(0, Math.abs(dot(d, m.f.t)) - 4));
        if (gap <= 2.4 && car.speed * 3.6 >= (param(m.tile, "minSpeed") ?? 90)) { run.flags[key] = true; run.events.push("crate"); }
      }
      on = !run.flags[key];
    }
    if (on !== m.on) { m.collider.setEnabled(on); m.on = on; }
  }
}

// Rail : la voiture est accrochée à l'axe du bloc (direction ignorée), vitesse constante, sortie libre en fin de rail
const RAIL_GRAB = 6;
function railStep(phys, run, car) {
  if (!car.rail) {
    if (run.railCool > 0 || car.speed < 5) return false;
    const bp = car.body.translation();
    for (const r of phys.rails) {
      for (const end of [0, r.pts.length - 1]) {
        const q = r.pts[end];
        if (Math.hypot(bp.x - q.p[0], bp.y - q.p[1], bp.z - q.p[2]) < RAIL_GRAB) {
          car.rail = { r, s: end === 0 ? 0 : r.len, dir: end === 0 ? 1 : -1, v: Math.max(car.speed, 14) };
          break;
        }
      }
      if (car.rail) break;
    }
    if (!car.rail) return false;
  }
  const rl = car.rail;
  rl.s += rl.dir * rl.v * DT;
  if (rl.s < 0 || rl.s > rl.r.len) { car.rail = null; run.railCool = 100; return false; }
  const { cum, pts } = rl.r;
  let i = 0;
  while (i < cum.length - 2 && cum[i + 1] < rl.s) i++;
  const k = (rl.s - cum[i]) / Math.max(1e-6, cum[i + 1] - cum[i]);
  const mix = (a, b) => a.map((v, j) => v + (b[j] - v) * k);
  const p = mix(pts[i].p, pts[i + 1].p), t = norm(mix(pts[i].t, pts[i + 1].t)), u = norm(mix(pts[i].u, pts[i + 1].u));
  const fwd = t.map((v) => v * rl.dir);
  car.body.setTranslation({ x: p[0] + u[0] * 0.45, y: p[1] + u[1] * 0.45, z: p[2] + u[2] * 0.45 }, true);
  car.body.setRotation(quatFromBasis(fwd, u), true);
  car.body.setLinvel({ x: fwd[0] * rl.v, y: fwd[1] * rl.v, z: fwd[2] * rl.v }, true);
  car.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  car.speed = rl.v; car.kmh = Math.round(rl.v * 3.6); car.contacts = 4; car.surface = "road"; car.airTime = 0;
  return true;
}

// --------- Monde ---------
export function createWorld(track) {
  const world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 });
  world.timestep = DT;
  const surfaceOf = new Map();
  const tileOf = new Map(); // collider -> tuile (réglages tile.p lus par driveCar)
  const winds = [];
  const mech = []; // barrières, portes, caisses, plateformes mobiles (pilotés par run.steps, voir updateMechanisms)
  const rails = [];
  const gravs = [];
  const jets = [];
  const assist = new Map(); // figures de la saison 2 (murs, looping horizontal) : la voiture est tenue sur la ligne
  // sol (herbe) ; mondes de la saison 2 : piste suspendue au-dessus du vide, sauf les maps avec un sol (terrain.js)
  const [w, h] = track.size;
  const wd = WORLDS[track.data?.world];
  const s2 = wd?.season === 2;
  const terrain = s2 ? terrainOf(track) : null;
  const voidWorld = !!wd?.void && !terrain;
  if (terrain) {
    // grille de hauteurs (colonnes en x, rangées en z, stockage colonne par colonne), centrée sur la translation
    const sx = terrain.nx * terrain.step, sz = terrain.nz * terrain.step;
    const hf = world.createCollider(
      RAPIER.ColliderDesc.heightfield(terrain.nz, terrain.nx, terrain.heights, { x: sx, y: 1, z: sz })
        .setTranslation(terrain.x0 + sx / 2, 0, terrain.z0 + sz / 2).setFriction(0.8),
    );
    surfaceOf.set(hf.handle, groundSurface(wd));
    // accotements : talus roulable de part et d'autre de la route quand elle est au niveau du sol (on remonte depuis le sable)
    for (const t of track.tiles) {
      if (BLOCKS[t.type].mech === "lift" || BLOCKS[t.type].figure) continue;
      const sk = skirtTriangles(t, terrain);
      if (!sk) continue;
      const c = world.createCollider(RAPIER.ColliderDesc.trimesh(sk.verts, sk.idx).setFriction(1));
      surfaceOf.set(c.handle, tileSurface(t));
      tileOf.set(c.handle, t);
    }
  } else if (!voidWorld) {
    const ground = world.createCollider(
      RAPIER.ColliderDesc.cuboid(w * 16 + 2000, 1, h * 16 + 2000).setTranslation(w * 16, GRASS_Y - 1, h * 16).setFriction(0.8),
    );
    surfaceOf.set(ground.handle, "grass");
  }
  for (const t of track.tiles) {
    const mk = BLOCKS[t.type].mech;
    if (mk === "lift") {
      // plateforme mobile : pas de route statique, un corps cinématique dont la position ne dépend que de run.steps
      const f = tileFrame(t);
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(...liftPos(f, t, 0)).setRotation(quatFromBasis(f.t, f.u)));
      const c = world.createCollider(RAPIER.ColliderDesc.cuboid(10, 0.3, 16).setFriction(1), body);
      surfaceOf.set(c.handle, "road");
      tileOf.set(c.handle, t);
      mech.push({ kind: "lift", tile: t, f, body, collider: c });
      continue;
    }
    const { verts, idx } = roadTriangles(t, BLOCKS[t.type].figure ? 2.5 : 0.6); // figures S2 : chaussée épaisse (pas de traversée)
    const c = world.createCollider(RAPIER.ColliderDesc.trimesh(verts, idx).setFriction(1));
    surfaceOf.set(c.handle, tileSurface(t));
    tileOf.set(c.handle, t);
    const def = BLOCKS[t.type];
    if (def.jet) jets.push({ ...tileFrame(t), power: param(t, "power") ?? 28 });
    if (def.assist) assist.set(t, sampleBlock(t.type).map((f) => ({ p: toWorld(t, f.p), r: toWorld(t, f.r, true), u: toWorld(t, f.u, true) })));
    if (def.wind) winds.push({ ...tileFrame(t), force: param(t, "force") ?? 0 });
    if (mk === "gate" || mk === "door" || mk === "crate") {
      // obstacle plein sur la route (désactivé par updateMechanisms)
      const f = tileFrame(t);
      const [hx, hy, hz, up] = mk === "gate" ? [10, 3, 0.5, 3] : mk === "door" ? [10, 4, 0.8, 4] : [4, 2, 4, 2];
      const c = world.createCollider(
        RAPIER.ColliderDesc.cuboid(hx, hy, hz)
          .setTranslation(f.p[0] + f.u[0] * up, f.p[1] + f.u[1] * up, f.p[2] + f.u[2] * up)
          .setRotation(quatFromBasis(f.t, f.u)).setFriction(0.5),
      );
      surfaceOf.set(c.handle, "road");
      mech.push({ kind: mk, tile: t, f, collider: c, on: true });
    }
    if (mk === "rail") {
      const pts = sampleBlock(t.type).map((s) => ({ p: toWorld(t, s.p), t: toWorld(t, s.t, true), u: toWorld(t, s.u, true) }));
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(...sub(pts[i].p, pts[i - 1].p)));
      rails.push({ tile: t, pts, cum, len: cum[cum.length - 1] });
    }
    if (def.gravity) gravs.push({ pts: sampleBlock(t.type).map((s) => ({ p: toWorld(t, s.p), u: toWorld(t, s.u, true) })) });
  }
  return { world, surfaceOf, tileOf, winds, mech, rails, gravs, jets, assist, s2, fall: voidWorld ? fallMap(track) : null };
}

// Vide (saison 2) : hauteur sous laquelle la voiture réapparaît au dernier checkpoint, par case.
// Plancher d'une case = route la plus basse dans un rayon de FALL_R cases, moins FALL_MARGIN ; loin de toute route,
// plancher global (route la plus basse de la map, moins la marge). Fonction pure de la position : rejeu identique.
export const FALL_R = 3, FALL_MARGIN = 24;
export function fallMap(track) {
  const low = new Map();
  let min = Infinity;
  for (const t of track.tiles) {
    for (const f of sampleBlock(t.type)) {
      for (const lp of sectionPoints(t.type, f)) {
        const p = toWorld(t, lp);
        const k = `${Math.floor(p[0] / TILE)},${Math.floor(p[2] / TILE)}`;
        if (!(low.get(k) <= p[1])) low.set(k, p[1]);
        if (p[1] < min) min = p[1];
      }
    }
  }
  const floor = new Map();
  for (const [k, y] of low) {
    const [cx, cz] = k.split(",").map(Number);
    for (let dx = -FALL_R; dx <= FALL_R; dx++)
      for (let dz = -FALL_R; dz <= FALL_R; dz++) {
        const kk = `${cx + dx},${cz + dz}`;
        if (!(floor.get(kk) <= y)) floor.set(kk, y);
      }
  }
  const base = (Number.isFinite(min) ? min : 0) - FALL_MARGIN;
  return { base, floor, at: (x, z) => { const y = floor.get(`${Math.floor(x / TILE)},${Math.floor(z / TILE)}`); return (y === undefined ? base + FALL_MARGIN : y) - FALL_MARGIN; } };
}

export function createCar(phys, spawn) {
  const { world } = phys;
  const q = quatFromBasis(spawn.fwd, spawn.up);
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(spawn.p[0], spawn.p[1] + 0.4, spawn.p[2])
      .setRotation(q)
      .setLinearDamping(0.02)
      .setAngularDamping(0.6)
      .setCcdEnabled(true)
      .setCanSleep(false),
  );
  const [hx, hy, hz] = CAR.half;
  const vol = 8 * hx * hy * hz;
  world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setDensity(CAR.mass / vol).setFriction(0.3).setRestitution(0.05), body);
  // centre de gravité abaissé : plus stable
  body.setAdditionalMassProperties(0, { x: 0, y: -0.35, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0, w: 1 }, true);
  const vc = world.createVehicleController(body);
  vc.indexUpAxis = 1;
  vc.setIndexForwardAxis = 2; // (setter mal nommé dans rapier 0.12)
  CAR.wheels.forEach(([x, y, z], i) => {
    vc.addWheel({ x, y, z }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, CAR.rest, CAR.radius);
    vc.setWheelSuspensionStiffness(i, CAR.stiff);
    vc.setWheelSuspensionCompression(i, CAR.comp);
    vc.setWheelSuspensionRelaxation(i, CAR.relax);
    vc.setWheelMaxSuspensionTravel(i, CAR.travel);
    vc.setWheelMaxSuspensionForce(i, 150000);
    vc.setWheelFrictionSlip(i, CAR.slip);
  });
  return { body, vc, steer: 0, boost: 0, slow: 0, ccd: true, groundTile: null, assistTile: null, assistT: 0, boostMax: 1.8, boostK: CAR.topBoost, boostDrag: 1.12, rail: null, airTime: 0, contacts: 0, surface: "road", speed: 0, kmh: 0, slip: 0, wheelSpin: [0, 0, 0, 0] };
}

// Vecteurs du châssis en monde
export function carFrame(car) {
  const q = car.body.rotation();
  return { q, fwd: rotate(q, [0, 0, -1]), up: rotate(q, [0, 1, 0]), right: rotate(q, [1, 0, 0]) };
}

// input = { throttle: 0..1, brake: 0..1, steer: -1..1, drift: bool }
export function driveCar(phys, car, world, input) {
  const { body, vc } = car;
  const v = body.linvel();
  const vel = [v.x, v.y, v.z];
  const { fwd, up, right } = carFrame(car);
  const vf = dot(vel, fwd);
  const speed = Math.hypot(v.x, v.y, v.z);
  car.speed = speed;

  // contacts et surface sous les roues
  let contacts = 0;
  const surfCount = {};
  const surfTile = {};
  let groundTile = null;
  for (let i = 0; i < 4; i++) {
    if (vc.wheelIsInContact(i)) {
      contacts++;
      const g = vc.wheelGroundObject(i);
      const s = (g && phys.surfaceOf.get(g.handle)) || "road";
      surfCount[s] = (surfCount[s] || 0) + 1;
      if (!surfTile[s] && g) surfTile[s] = phys.tileOf.get(g.handle);
      if (!groundTile && g) groundTile = phys.tileOf.get(g.handle);
    }
  }
  car.contacts = contacts;
  car.groundTile = groundTile;
  const surface = Object.keys(surfCount).sort((a, b) => surfCount[b] - surfCount[a])[0] || "air";
  car.surface = surface;
  const sf = SURF[surface] || SURF.road;

  // zone de gravité de piste : la gravité suit la normale de la route (force compensatrice m·g·(ŷ − n))
  let gravN = null;
  if (phys.gravs.length) {
    const bp = body.translation();
    let best = 14 * 14;
    for (const z of phys.gravs) {
      for (const q of z.pts) {
        const d2 = (bp.x - q.p[0]) ** 2 + (bp.y - q.p[1]) ** 2 + (bp.z - q.p[2]) ** 2;
        if (d2 < best) { best = d2; gravN = q.u; }
      }
    }
  }
  const inGrav = !!gravN;
  if (surface === "boost") { car.boost = 1.8; car.boostMax = 1.8; car.boostK = CAR.topBoost; car.boostDrag = 1.12; }
  else if (surface === "boost2") {
    const b = BOOST2[Math.max(1, Math.min(3, Math.round(param(surfTile.boost2, "level") ?? 2)))];
    car.boost = car.boostMax = b.dur; car.boostK = b.k; car.boostDrag = b.drag;
  }
  if (surface === "revboost") { car.boost = 0; car.slow = REV_T; }
  car.boost = Math.max(0, car.boost - DT);
  const slowed = car.slow > 0;
  if (slowed) car.slow -= DT;

  // direction : angle max qui baisse avec la vitesse
  const maxSteer = 0.6 / (1 + Math.max(0, vf) * 0.028);
  car.steer += (input.steer * maxSteer - car.steer) * Math.min(1, DT * 9);
  vc.setWheelSteering(0, -car.steer);
  vc.setWheelSteering(1, -car.steer);

  // moteur / frein / marche arrière
  const boostK = car.boost > 0 ? car.boostK : 1;
  let engine = 0, brake = 0;
  // couple plus fort à bas régime (permet de repartir dans une pente raide)
  const lowRpm = 1 + 1.3 * Math.max(0, 1 - Math.abs(vf) / 28);
  if (input.throttle > 0) engine = CAR.engine * input.throttle * boostK * lowRpm * (vf < 0 ? 1.5 : 1);
  if (slowed) engine *= 0.15;
  if (input.brake > 0) {
    if (vf > 2) brake = CAR.brake * input.brake;
    else engine = -CAR.engine * 0.55 * input.brake;
  }
  if (!input.throttle && !input.brake) brake = 4; // frein moteur
  if (surface === "brake") {
    // zone de freinage : coupe le turbo, freine fort et réduit la poussée
    car.boost = 0;
    brake = Math.max(brake, 70 * (param(surfTile.brake, "power") ?? 1));
    engine *= 0.3;
  }
  for (let i = 0; i < 4; i++) {
    vc.setWheelEngineForce(i, -engine * sf.slip);
    vc.setWheelBrake(i, brake);
    const rear = i >= 2;
    const drift = input.drift && rear && speed > 15;
    vc.setWheelSideFrictionStiffness(i, sf.side * world.grip * (drift ? 0.35 : 1));
    vc.setWheelFrictionSlip(i, CAR.slip * sf.slip * world.grip * (drift ? 0.7 : 1));
  }

  // traînée, résistance, appui aérodynamique (colle la voiture dans les loopings et sur les murs)
  // surface collante : forte traînée, la vitesse reste plafonnée
  let drag = (CAR.drag * (surface === "glue" ? param(surfTile.glue, "drag") ?? 4 : 1)) / (car.boost > 0 ? car.boostDrag : 1);
  if (slowed) drag *= 5;
  const f = [-vel[0] * speed * drag, -vel[1] * speed * drag, -vel[2] * speed * drag];
  if (surface === "water" && speed > WATER_V) {
    const a = (CAR.mass * WATER_K * (speed - WATER_V)) / speed;
    f[0] -= vel[0] * a; f[1] -= vel[1] * a; f[2] -= vel[2] * a;
  }
  if (contacts) {
    const roll = Math.min(CAR.roll, Math.abs(vf) * 40) * Math.sign(vf);
    f[0] -= fwd[0] * roll; f[1] -= fwd[1] * roll; f[2] -= fwd[2] * roll;
    const dn = CAR.down * speed * speed * (contacts / 4);
    f[0] -= up[0] * dn; f[1] -= up[1] * dn; f[2] -= up[2] * dn;
    // adhérence sur les surfaces raides (murs, loopings) : plaque la voiture et compense la glissade
    const tilt = 1 - up[1];
    if (tilt > 0.15 && speed > 8 && !inGrav) {
      const k = Math.min(1, (speed - 8) / 14) * Math.min(1, tilt);
      const m = CAR.mass * GRAVITY;
      f[0] -= up[0] * m * k; f[1] -= up[1] * m * k; f[2] -= up[2] * m * k;
      // part de la gravité tangente à la surface, compensée à 85 %
      const gt = [-up[0] * up[1], 1 - up[1] * up[1], -up[2] * up[1]];
      f[0] += gt[0] * m * 0.85 * k; f[1] += gt[1] * m * 0.85 * k; f[2] += gt[2] * m * 0.85 * k;
    }
    car.airTime = 0;
  } else {
    car.airTime += DT;
  }
  if (gravN) {
    const m = CAR.mass * GRAVITY;
    f[0] += -gravN[0] * m; f[1] += (1 - gravN[1]) * m; f[2] += -gravN[2] * m;
  }
  // vent : force latérale constante (vers la droite du bloc si positive) tant que la voiture est dans la zone
  if (phys.winds.length) {
    const bp = body.translation();
    for (const w of phys.winds) {
      const d = [bp.x - w.p[0], bp.y - w.p[1], bp.z - w.p[2]];
      if (Math.abs(dot(d, w.t)) <= TILE / 2 && Math.abs(dot(d, w.r)) <= 18 && dot(d, w.u) > -4 && dot(d, w.u) < 20) {
        const a = CAR.mass * w.force;
        f[0] += w.r[0] * a; f[1] += w.r[1] * a; f[2] += w.r[2] * a;
      }
    }
  }
  // figures assistées (saison 2 : murs, tubes, looping horizontal) : ressort amorti qui ramène la voiture vers l'axe du
  // bloc en travers de la chaussée, et aimantation vers la chaussée. L'aimant reste actif 0,4 s après la perte de contact
  // (roues qui décollent un instant au plafond) tant que la voiture reste à moins de 8 u de l'axe.
  if (phys.assist.size) {
    if (contacts && groundTile && phys.assist.has(groundTile)) { car.assistTile = groundTile; car.assistT = 0; }
    else if (car.assistTile) car.assistT += DT;
    if (car.assistTile && car.assistT <= MAGNET_T) {
      const bp = body.translation();
      let best = Infinity, q = null;
      for (const a of phys.assist.get(car.assistTile)) {
        const d2 = (bp.x - a.p[0]) ** 2 + (bp.y - a.p[1]) ** 2 + (bp.z - a.p[2]) ** 2;
        if (d2 < best) { best = d2; q = a; }
      }
      if (best < 64) {
        const off = (bp.x - q.p[0]) * q.r[0] + (bp.y - q.p[1]) * q.r[1] + (bp.z - q.p[2]) * q.r[2];
        const a = -CAR.mass * Math.max(-40, Math.min(40, ASSIST_K * off + ASSIST_C * dot(vel, q.r)));
        f[0] += q.r[0] * a; f[1] += q.r[1] * a; f[2] += q.r[2] * a;
        // aimant : petite force vers la chaussée ; sans contact, elle remplace aussi la compensation de gravité
        const pull = CAR.mass * (MAGNET + (contacts ? 0 : GRAVITY * Math.max(0, -q.u[1])));
        f[0] -= q.u[0] * pull; f[1] -= q.u[1] * pull; f[2] -= q.u[2] * pull;
      } else car.assistTile = null;
    } else car.assistTile = null;
  }
  body.resetForces(true);
  body.addForce({ x: f[0], y: f[1], z: f[2] }, true);

  // contrôle en l'air : un peu de lacet et de tangage, et redressement doux
  body.resetTorques(true);
  if (!contacts && car.airTime > 0.15) {
    const m = CAR.mass;
    // stabilisation : ramène doucement le toit vers le haut (évite les tonneaux)
    const fix = cross(up, [0, 1, 0]);
    const av = body.angvel();
    body.addTorque({ x: fix[0] * m * 6 - av.x * m * 0.8, y: 0, z: fix[2] * m * 6 - av.z * m * 0.8 }, true);
    const yaw = -input.steer * 3.2 * m;
    const pitch = (input.brake - input.throttle) * 1.6 * m;
    body.addTorque({ x: up[0] * yaw + right[0] * pitch, y: up[1] * yaw + right[1] * pitch, z: up[2] * yaw + right[2] * pitch }, true);
  }

  // réacteur vertical : dans la colonne au-dessus du bloc, la vitesse vers le haut du bloc est portée à `power` (m/s)
  if (phys.jets.length) {
    const bp = body.translation();
    for (const j of phys.jets) {
      const d = [bp.x - j.p[0], bp.y - j.p[1], bp.z - j.p[2]];
      const h = dot(d, j.u);
      if (Math.abs(dot(d, j.t)) <= TILE / 2 && Math.abs(dot(d, j.r)) <= 12 && h > -2 && h < 6) {
        const vu = dot(vel, j.u);
        if (vu < j.power) {
          const k = j.power - vu;
          body.setLinvel({ x: v.x + j.u[0] * k, y: v.y + j.u[1] * k, z: v.z + j.u[2] * k }, true);
        }
      }
    }
  }
  vc.updateVehicle(DT);
  car.slip = Math.min(1, Math.abs(dot(vel, right)) / 14);
  car.kmh = Math.round(Math.max(0, vf) * 3.6);
}

export function placeCar(car, spawn) {
  const q = quatFromBasis(spawn.fwd, spawn.up);
  car.body.setTranslation({ x: spawn.p[0], y: spawn.p[1] + 0.4, z: spawn.p[2] }, true);
  car.body.setRotation(q, true);
  car.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  car.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  car.boost = 0;
  car.steer = 0;
  car.rail = null;
  car.slow = 0;
  car.assistTile = null;
}

// --------- Une tentative ---------
export function createRun(track) {
  return { flipped: 0, steps: 0, cps: new Set(), splits: [], finished: false, finishMs: null, ghost: [GHOST_TAG], events: [], lastSpawn: track.spawn(), missingCool: 0, flags: {}, tpCool: 0, railCool: 0 };
}

// Téléporteur : la voiture ressort à 4 m du plan de sortie, vitesse conservée, réorientée selon la sortie
function teleportCar(car, g, out) {
  const v = car.body.linvel();
  const vel = [v.x, v.y, v.z];
  const vt = dot(vel, g.t), vr = dot(vel, g.r), vu = dot(vel, g.u);
  const nv = [0, 1, 2].map((i) => out.t[i] * vt + out.r[i] * vr + out.u[i] * vu);
  const pos = [0, 1, 2].map((i) => out.p[i] + out.t[i] * 4 + out.u[i] * 0.5);
  car.body.setTranslation({ x: pos[0], y: pos[1], z: pos[2] }, true);
  car.body.setRotation(quatFromBasis(out.t, out.u), true);
  car.body.setLinvel({ x: nv[0], y: nv[1], z: nv[2] }, true);
  car.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  car.steer = 0;
}

// Passage d'un portique : la voiture traverse le plan du portique, près de son axe
function gateHit(g, prev, cur) {
  const a = dot(sub(prev, g.p), g.t), b = dot(sub(cur, g.p), g.t);
  if (a > 0 === b > 0 && Math.abs(b) > 0.01) return false;
  const d = sub(cur, g.p);
  return Math.abs(dot(d, g.r)) < 13 && dot(d, g.u) > -3 && dot(d, g.u) < 12;
}

export function stepRun(run, track, phys, car, world, input) {
  run.events.length = 0;
  const p0 = car.body.translation();
  const prev = [p0.x, p0.y, p0.z];
  if (phys.mech.length) updateMechanisms(phys, run, car);
  if (run.railCool > 0) run.railCool--;
  if (!(phys.rails.length && railStep(phys, run, car))) driveCar(phys, car, world, input);
  // Figures lourdes de la saison 2 (tubes, looping horizontal) : pas de détection continue des collisions tant que la
  // voiture roule dessus (elle y coûtait trop de calcul au rejeu serveur) ; partout ailleurs, et en l'air, elle reste
  // active comme en saison 1. Fonction de l'état de la voiture : rejeu identique.
  if (phys.s2) {
    const ccd = !(car.contacts > 0 && car.groundTile && BLOCKS[car.groundTile.type].noCcd);
    if (ccd !== car.ccd) { car.body.enableCcd(ccd); car.ccd = ccd; }
  }
  phys.world.step();
  run.steps++;
  const p1 = car.body.translation();
  const cur = [p1.x, p1.y, p1.z];
  if (car.boost > car.boostMax - 0.01) run.events.push("boost");

  if (run.tpCool > 0) run.tpCool--;
  for (const g of track.gates) {
    if (!gateHit(g, prev, cur)) continue;
    if (g.kind === "switch") {
      const key = switchKey(param(g.tile, "id") ?? 1);
      if (!run.flags[key]) { run.flags[key] = true; run.events.push("switch"); }
      continue;
    }
    if (g.kind === "teleport") {
      // entrée (role 0) franchie dans le sens de la marche : sortie de la même paire
      if (run.tpCool > 0 || (param(g.tile, "role") ?? 0) !== 0 || dot(sub(cur, prev), g.t) <= 0) continue;
      const pair = param(g.tile, "pair");
      const out = track.gates.find((o) => o.kind === "teleport" && o !== g && param(o.tile, "pair") === pair && param(o.tile, "role") === 1);
      if (!out) continue;
      teleportCar(car, g, out);
      const tp = car.body.translation();
      cur[0] = tp.x; cur[1] = tp.y; cur[2] = tp.z;
      run.tpCool = 50;
      run.events.push("teleport");
      break;
    }
    // checkpoint conditionnel : sous la vitesse minimale (km/h), il ne se passe rien
    if (BLOCKS[g.tile.type].fast && car.speed * 3.6 < (param(g.tile, "minSpeed") ?? 100)) continue;
    const id = `${g.tile.x},${g.tile.z},${g.tile.level}`;
    if (g.kind === "cp" && !run.cps.has(id)) {
      run.cps.add(id);
      run.splits.push(run.steps * 10);
      const fwdDir = dot(sub(cur, prev), g.t) >= 0 ? g.t : g.t.map((x) => -x);
      run.lastSpawn = { p: g.p.map((v, i) => v + g.u[i] * 1.2), fwd: fwdDir, up: g.u };
      run.events.push("cp");
    } else if (g.kind === "finish" && !run.finished) {
      if (run.cps.size >= track.cps.length) {
        run.finished = true;
        run.finishMs = run.steps * 10;
        run.events.push("finish");
      } else if (run.missingCool <= 0) {
        run.missingCool = 200;
        run.events.push("missing");
      }
    }
  }
  run.missingCool--;

  if (run.steps % GHOST_EVERY === 0) {
    const q = car.body.rotation();
    run.ghost.push(Math.round(cur[0] * 10), Math.round(cur[1] * 10), Math.round(cur[2] * 10),
      Math.round(q.x * 1000), Math.round(q.y * 1000), Math.round(q.z * 1000), Math.round(q.w * 1000));
  }
  // voiture retournée ou coincée : réapparition automatique au bout de 2 s
  const upY = carFrame(car).up[1];
  run.flipped = (car.contacts < 2 && car.speed < 3) || (upY < 0.2 && car.speed < 6) ? run.flipped + 1 : 0;
  // chute hors du monde
  const [w, h] = track.size;
  const fell = phys.fall ? cur[1] < phys.fall.at(cur[0], cur[2]) : cur[1] < -40;
  if (run.flipped > 200 || fell || cur[0] < -400 || cur[2] < -400 || cur[0] > w * 32 + 400 || cur[2] > h * 32 + 400) {
    placeCar(car, run.lastSpawn);
    run.flipped = 0;
    run.events.push("respawn");
  }
}

// Fantôme : marqueur de version puis 7 entiers par point (x, y, z en dm, quaternion ×1000).
// Les fantômes de l'ancienne version (sans marqueur) sont ignorés.
export const GHOST_STRIDE = 7;
export function ghostPose(g0, tMs) {
  if (!g0 || g0[0] !== GHOST_TAG) return null;
  const g = g0.length > 1 && g0._body ? g0._body : (g0._body = g0.slice(1));
  if (g.length < GHOST_STRIDE * 2 || g.length % GHOST_STRIDE) return null;
  const n = g.length / GHOST_STRIDE;
  const f = tMs / (GHOST_EVERY * 10) - 1;
  const i = Math.max(0, Math.min(n - 2, Math.floor(f)));
  const a = f >= n - 1 ? 1 : Math.max(0, Math.min(1, f - i));
  const k = i * GHOST_STRIDE, k2 = k + GHOST_STRIDE;
  const l = (o, s) => (g[k + o] + (g[k2 + o] - g[k + o]) * a) / s;
  let q2 = [g[k2 + 3], g[k2 + 4], g[k2 + 5], g[k2 + 6]];
  const q1 = [g[k + 3], g[k + 4], g[k + 5], g[k + 6]];
  if (q1[0] * q2[0] + q1[1] * q2[1] + q1[2] * q2[2] + q1[3] * q2[3] < 0) q2 = q2.map((x) => -x);
  const q = q1.map((v, j) => v + (q2[j] - v) * a);
  const ql = Math.hypot(...q) || 1;
  return { x: l(0, 10), y: l(1, 10), z: l(2, 10), q: { x: q[0] / ql, y: q[1] / ql, z: q[2] / ql, w: q[3] / ql }, done: f >= n - 1 };
}

export function formatTime(ms) {
  if (ms == null) return "--:--.---";
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), r = ms % 1000;
  return `${m}:${String(s).padStart(2, "0")}.${String(r).padStart(3, "0")}`;
}

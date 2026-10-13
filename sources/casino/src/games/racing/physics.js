// Physique : Rapier (corps rigides) + contrôleur de véhicule à rayons (4 roues à suspensions).
// Pas fixe de 1/100 s : 1 pas = 10 ms de chrono. Tout tourne hors de React.
import RAPIER from "@dimforge/rapier3d-compat";
import { BLOCKS, param, sampleBlock, sectionPoints, toWorld } from "./blocks.js";

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
];

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
};

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

// --------- Monde ---------
export function createWorld(track) {
  const world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 });
  world.timestep = DT;
  const surfaceOf = new Map();
  const tileOf = new Map(); // collider -> tuile (réglages tile.p lus par driveCar)
  // sol (herbe)
  const [w, h] = track.size;
  const ground = world.createCollider(
    RAPIER.ColliderDesc.cuboid(w * 16 + 2000, 1, h * 16 + 2000).setTranslation(w * 16, GRASS_Y - 1, h * 16).setFriction(0.8),
  );
  surfaceOf.set(ground.handle, "grass");
  for (const t of track.tiles) {
    const { verts, idx } = roadTriangles(t);
    const c = world.createCollider(RAPIER.ColliderDesc.trimesh(verts, idx).setFriction(1));
    surfaceOf.set(c.handle, BLOCKS[t.type].surface || "road");
    tileOf.set(c.handle, t);
  }
  return { world, surfaceOf, tileOf };
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
  return { body, vc, steer: 0, boost: 0, boostMax: 1.8, boostK: CAR.topBoost, boostDrag: 1.12, airTime: 0, contacts: 0, surface: "road", speed: 0, kmh: 0, slip: 0, wheelSpin: [0, 0, 0, 0] };
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
  for (let i = 0; i < 4; i++) {
    if (vc.wheelIsInContact(i)) {
      contacts++;
      const g = vc.wheelGroundObject(i);
      const s = (g && phys.surfaceOf.get(g.handle)) || "road";
      surfCount[s] = (surfCount[s] || 0) + 1;
      if (!surfTile[s] && g) surfTile[s] = phys.tileOf.get(g.handle);
    }
  }
  car.contacts = contacts;
  const surface = Object.keys(surfCount).sort((a, b) => surfCount[b] - surfCount[a])[0] || "air";
  car.surface = surface;
  const sf = SURF[surface] || SURF.road;
  if (surface === "boost") { car.boost = 1.8; car.boostMax = 1.8; car.boostK = CAR.topBoost; car.boostDrag = 1.12; }
  else if (surface === "boost2") {
    const b = BOOST2[Math.max(1, Math.min(3, Math.round(param(surfTile.boost2, "level") ?? 2)))];
    car.boost = car.boostMax = b.dur; car.boostK = b.k; car.boostDrag = b.drag;
  }
  car.boost = Math.max(0, car.boost - DT);

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
  const drag = (CAR.drag * (surface === "glue" ? param(surfTile.glue, "drag") ?? 4 : 1)) / (car.boost > 0 ? car.boostDrag : 1);
  const f = [-vel[0] * speed * drag, -vel[1] * speed * drag, -vel[2] * speed * drag];
  if (contacts) {
    const roll = Math.min(CAR.roll, Math.abs(vf) * 40) * Math.sign(vf);
    f[0] -= fwd[0] * roll; f[1] -= fwd[1] * roll; f[2] -= fwd[2] * roll;
    const dn = CAR.down * speed * speed * (contacts / 4);
    f[0] -= up[0] * dn; f[1] -= up[1] * dn; f[2] -= up[2] * dn;
    // adhérence sur les surfaces raides (murs, loopings) : plaque la voiture et compense la glissade
    const tilt = 1 - up[1];
    if (tilt > 0.15 && speed > 8) {
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
}

// --------- Une tentative ---------
export function createRun(track) {
  return { flipped: 0, steps: 0, cps: new Set(), splits: [], finished: false, finishMs: null, ghost: [GHOST_TAG], events: [], lastSpawn: track.spawn(), missingCool: 0 };
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
  driveCar(phys, car, world, input);
  phys.world.step();
  run.steps++;
  const p1 = car.body.translation();
  const cur = [p1.x, p1.y, p1.z];
  if (car.boost > car.boostMax - 0.01) run.events.push("boost");

  for (const g of track.gates) {
    if (!gateHit(g, prev, cur)) continue;
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
  if (run.flipped > 200 || cur[1] < -40 || cur[0] < -400 || cur[2] < -400 || cur[0] > w * 32 + 400 || cur[2] > h * 32 + 400) {
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

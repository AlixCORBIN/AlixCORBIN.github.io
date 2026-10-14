// Construit la piste en three.js pur (un Group), à partir d'un Track. Matériaux partagés par monde.
import * as THREE from "three";
import { BLOCKS, TILE, occupancy, param, sampleBlock, sectionPoints, tileSurface, toWorld } from "../blocks.js";
import { crateKey, gateClosed, liftPhase, switchKey } from "../physics.js";

const DECK = 1.2; // épaisseur visuelle de la chaussée

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}

function roadTex(world, dirt, ice) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = dirt ? "#7a5634" : ice ? "#bfe6f7" : world.road;
    g.fillRect(0, 0, w, h);
    // grain
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = `rgba(${dirt ? "40,25,10" : "255,255,255"},${Math.random() * 0.06})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    if (dirt) {
      g.fillStyle = "rgba(40,25,12,.35)";
      g.fillRect(w * 0.28, 0, w * 0.1, h);
      g.fillRect(w * 0.62, 0, w * 0.1, h);
      return;
    }
    // bordures rouge / blanc
    for (let y = 0; y < h; y += 32) {
      g.fillStyle = (y / 32) % 2 ? "#e8e8e8" : "#d4262c";
      g.fillRect(0, y, 14, 32);
      g.fillRect(w - 14, y, 14, 32);
    }
    g.fillStyle = "rgba(255,255,255,.75)";
    g.fillRect(18, 0, 4, h);
    g.fillRect(w - 22, 0, 4, h);
    g.fillStyle = "rgba(255,255,255,.45)";
    for (let y = 8; y < h; y += 64) g.fillRect(w / 2 - 2, y, 4, 32);
  });
}

function boostTex(color) {
  return canvasTex(128, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = color;
    g.lineWidth = 14;
    g.lineJoin = "round";
    for (let i = 0; i < 3; i++) {
      const y = 50 + i * 70;
      g.beginPath();
      g.moveTo(16, y + 40);
      g.lineTo(w / 2, y);
      g.lineTo(w - 16, y + 40);
      g.stroke();
    }
  });
}

function bannerTex(text, bg, fg, checker) {
  return canvasTex(512, 96, (g, w, h) => {
    if (checker) {
      const s = 24;
      for (let x = 0; x < w; x += s) for (let y = 0; y < h; y += s) {
        g.fillStyle = ((x + y) / s) % 2 ? "#111" : "#fff";
        g.fillRect(x, y, s, s);
      }
      g.fillStyle = "rgba(0,0,0,.65)";
      g.fillRect(w * 0.2, 14, w * 0.6, h - 28);
    } else {
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
    }
    g.fillStyle = fg;
    g.font = "900 54px system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, w / 2, h / 2 + 3);
  });
}

const cache = new Map();
function materials(world) {
  if (cache.has(world.id)) return cache.get(world.id);
  const emissive = world.night ? 0.35 : 0;
  const road = new THREE.MeshStandardMaterial({ map: roadTex(world, false), roughness: 0.85 });
  const dirt = new THREE.MeshStandardMaterial({ map: roadTex(world, true), roughness: 1 });
  const ice = new THREE.MeshStandardMaterial({ map: roadTex(world, false, true), roughness: 0.15, metalness: 0.2 });
  for (const m of [road, dirt, ice]) { m.map.wrapS = m.map.wrapT = THREE.RepeatWrapping; m.side = THREE.DoubleSide; }
  const side = new THREE.MeshStandardMaterial({ color: world.night ? "#2a2250" : "#c9ccd2", roughness: 0.7, emissive: world.night ? world.accent : "#000", emissiveIntensity: emissive * 0.4, side: THREE.DoubleSide });
  const plain = new THREE.MeshStandardMaterial({ color: world.road, roughness: 0.85 });
  const kerb = new THREE.MeshStandardMaterial({ color: world.night ? world.accent : "#e8e8e8", emissive: world.night ? world.accent : "#000", emissiveIntensity: world.night ? 0.8 : 0 });
  const pillar = new THREE.MeshStandardMaterial({ color: world.night ? "#1d1640" : "#9aa0a8", roughness: 0.9 });
  const boost = new THREE.MeshBasicMaterial({ map: boostTex("#ff8a1f"), transparent: true, depthWrite: false });
  const gates = {
    start: new THREE.MeshBasicMaterial({ map: bannerTex("DÉPART", "#18a04a", "#fff") }),
    cp: new THREE.MeshBasicMaterial({ map: bannerTex("CHECKPOINT", "#1f6fe0", "#fff") }),
    finish: new THREE.MeshBasicMaterial({ map: bannerTex("ARRIVÉE", "#000", "#fff", true) }),
    // saison 2
    cpfast: new THREE.MeshBasicMaterial({ map: bannerTex("CP RAPIDE", "#d9731a", "#fff") }),
    teleport: new THREE.MeshBasicMaterial({ map: bannerTex("TÉLÉPORT", "#7a2fd0", "#fff") }),
    switch: new THREE.MeshBasicMaterial({ map: bannerTex("INTERRUPTEUR", "#c9a100", "#111") }),
  };
  const s2 = {
    brake: new THREE.MeshStandardMaterial({ color: "#8a1f24", roughness: 0.9, side: THREE.DoubleSide }),
    glue: new THREE.MeshStandardMaterial({ color: "#6b2fa0", roughness: 0.4, side: THREE.DoubleSide }),
    oil: new THREE.MeshStandardMaterial({ color: "#07070b", roughness: 0.05, metalness: 0.7, side: THREE.DoubleSide }),
    grav: new THREE.MeshStandardMaterial({ color: "#3b2a78", emissive: "#6a4cff", emissiveIntensity: 0.45, roughness: 0.6, side: THREE.DoubleSide }),
    boost: [1, 2, 3].map((l) => new THREE.MeshBasicMaterial({ map: boostTex(["#3ad06b", "#ff8a1f", "#ff2f4f"][l - 1]), transparent: true, depthWrite: false })),
    kick: new THREE.MeshBasicMaterial({ map: boostTex("#ffd23f"), transparent: true, depthWrite: false }),
    windR: new THREE.MeshBasicMaterial({ map: boostTex("#6fe3ff"), transparent: true, depthWrite: false, opacity: 0.8 }),
    barrier: new THREE.MeshStandardMaterial({ color: "#e0262c", emissive: "#a00", emissiveIntensity: 0.4 }),
    lift: new THREE.MeshStandardMaterial({ color: "#c9ccd2", metalness: 0.5, roughness: 0.4 }),
    crate: new THREE.MeshStandardMaterial({ color: "#a8743a", roughness: 0.9 }),
    rail: new THREE.MeshStandardMaterial({ color: "#d8dde4", metalness: 0.8, roughness: 0.25 }),
    door: ["#d4262c", "#1f6fe0", "#1fa84a", "#d9a800", "#8a3fd0"].map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.3 })),
    // lot 2
    water: new THREE.MeshStandardMaterial({ color: "#1f7fd1", emissive: "#0a3a7a", emissiveIntensity: 0.35, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.88, side: THREE.DoubleSide }),
    rev: new THREE.MeshBasicMaterial({ map: boostTex("#ff2f4f"), transparent: true, depthWrite: false }),
    jet: new THREE.MeshStandardMaterial({ color: "#2b2f36", emissive: "#29e0ff", emissiveIntensity: 0.9 }),
    jetCol: new THREE.MeshBasicMaterial({ color: "#7df9ff", transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }),
    hazard: new THREE.MeshBasicMaterial({ map: canvasTex(128, 32, (g, w, h) => { for (let x = -h; x < w; x += 16) { g.fillStyle = (x / 16) % 2 ? "#111" : "#ffd23f"; g.beginPath(); g.moveTo(x, h); g.lineTo(x + 16, h); g.lineTo(x + 16 + h, 0); g.lineTo(x + h, 0); g.fill(); } }) }),
    ring: new THREE.MeshStandardMaterial({ color: world.night ? "#2a2250" : "#c9ccd2", emissive: world.accent, emissiveIntensity: 0.35, metalness: 0.4, roughness: 0.4 }),
  };
  const post = new THREE.MeshStandardMaterial({ color: "#2b2f36", roughness: 0.5, metalness: 0.3 });
  const m = { road, dirt, ice, side, plain, kerb, pillar, boost, gates, post, s2 };
  cache.set(world.id, m);
  return m;
}

const boxGeo = new Map();
const box = (w, h, d) => {
  const k = `${w},${h},${d}`;
  if (!boxGeo.has(k)) boxGeo.set(k, new THREE.BoxGeometry(w, h, d));
  return boxGeo.get(k);
};

// Chaussée balayée : dessus texturé (u = travers, v = longueur / largeur), dessous et flancs
function sweptGeometry(tile) {
  const S = sampleBlock(tile.type);
  const rows = S.map((f) => {
    const sec = sectionPoints(tile.type, f);
    return sec.map((lp) => ({ top: toWorld(tile, lp), bot: toWorld(tile, [lp[0] - f.u[0] * DECK, lp[1] - f.u[1] * DECK, lp[2] - f.u[2] * DECK]) }));
  });
  const m = rows[0].length;
  const pos = [], uv = [], idx = [];
  // abscisses le long (au centre) et en travers
  let along = 0;
  const vAt = [0];
  for (let i = 1; i < S.length; i++) {
    const a = S[i - 1].p, b = S[i].p;
    along += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    vAt.push(along);
  }
  const push = (p, u, v) => { pos.push(...p); uv.push(u, v); return pos.length / 3 - 1; };
  const width = 20;
  // dessus
  const topIdx = rows.map((row, i) => {
    let acc = 0;
    return row.map((pt, j) => {
      if (j) { const q = row[j - 1].top; acc += Math.hypot(pt.top[0] - q[0], pt.top[1] - q[1], pt.top[2] - q[2]); }
      return { i: push(pt.top, 0, 0), acc };
    });
  });
  // u normalisé par rangée (la texture garde ses bordures sur le bord de la route)
  topIdx.forEach((row, i) => {
    const tot = row[row.length - 1].acc || 1;
    row.forEach((c) => { uv[c.i * 2] = row.length > 2 ? c.acc / width : c.acc / tot; uv[c.i * 2 + 1] = vAt[i] / width; });
  });
  const topCount = idx.length;
  for (let i = 0; i < rows.length - 1; i++)
    for (let j = 0; j < m - 1; j++) {
      const a = topIdx[i][j].i, b = topIdx[i][j + 1].i, c = topIdx[i + 1][j].i, d = topIdx[i + 1][j + 1].i;
      idx.push(a, b, c, b, d, c);
    }
  const topEnd = idx.length;
  // dessous
  const botIdx = rows.map((row) => row.map((pt) => push(pt.bot, 0, 0)));
  for (let i = 0; i < rows.length - 1; i++)
    for (let j = 0; j < m - 1; j++) {
      const a = botIdx[i][j], b = botIdx[i][j + 1], c = botIdx[i + 1][j], d = botIdx[i + 1][j + 1];
      idx.push(a, c, b, b, c, d);
    }
  // flancs gauche et droit
  for (const j of [0, m - 1]) {
    for (let i = 0; i < rows.length - 1; i++) {
      const a = topIdx[i][j].i, b = topIdx[i + 1][j].i, c = botIdx[i][j], d = botIdx[i + 1][j];
      if (j === 0) idx.push(a, c, b, b, c, d);
      else idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.addGroup(topCount, topEnd - topCount, 0);
  g.addGroup(topEnd, idx.length - topEnd, 1);
  g.computeVertexNormals();
  return g;
}

// Repère (matrice) d'un portique ou d'un décor posé sur la route
function basis(f) {
  const m = new THREE.Matrix4();
  const r = new THREE.Vector3(...f.r), u = new THREE.Vector3(...f.u), b = new THREE.Vector3(...f.t).negate();
  m.makeBasis(r, u, b);
  m.setPosition(...f.p);
  return m;
}

function gate(kind, mats, f, start) {
  const g = new THREE.Group();
  const hgt = 9, half = 11.2;
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  add(box(1.2, hgt, 1.2), mats.post, -half, hgt / 2, 0);
  add(box(1.2, hgt, 1.2), mats.post, half, hgt / 2, 0);
  add(box(2 * half + 1.2, 2.4, 0.6), [mats.post, mats.post, mats.post, mats.post, mats.gates[kind], mats.gates[kind]], 0, hgt, 0);
  g.matrixAutoUpdate = false;
  g.matrix.copy(basis(f));
  if (start) g.matrix.multiply(new THREE.Matrix4().makeTranslation(0, 0, -12));
  return g;
}

const frameOf = (tile, s) => {
  const S = sampleBlock(tile.type);
  const f = S[Math.round(s * (S.length - 1))];
  return { p: toWorld(tile, f.p), t: toWorld(tile, f.t, true), r: toWorld(tile, f.r, true), u: toWorld(tile, f.u, true) };
};

// Éléments de la saison 2 : décor posé sur le bloc et animations (fonction du pas et des drapeaux de la course)
function decorS2(t, def, mats, root, anim) {
  const m = mats.s2;
  const f = frameOf(t, 0.5);
  const flat = (mat, w, l, lift = 0.07, yaw = 0) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, l), mat);
    p.matrixAutoUpdate = false;
    p.matrix.copy(basis(f)).multiply(new THREE.Matrix4().makeTranslation(0, lift, 0)).multiply(new THREE.Matrix4().makeRotationY(yaw)).multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
    root.add(p);
  };
  const solid = (geo, mat, off = [0, 0, 0]) => {
    const o = new THREE.Mesh(geo, mat);
    o.matrixAutoUpdate = false;
    o.matrix.copy(basis(f)).multiply(new THREE.Matrix4().makeTranslation(...off));
    root.add(o);
    return o;
  };
  if (def.surface === "boost2") flat(m.boost[Math.max(1, Math.min(3, Math.round(param(t, "level") ?? 2))) - 1], 12, 24);
  if (def.surface === "revboost") flat(m.rev, 12, 24, 0.07, Math.PI);
  if (def.cutEdge) {
    // bandes jaunes et noires au bord de la coupure (bout de sortie du bloc)
    const p = new THREE.Mesh(new THREE.PlaneGeometry(20, 3), m.hazard);
    p.matrixAutoUpdate = false;
    p.matrix.copy(basis(frameOf(t, 0.92))).multiply(new THREE.Matrix4().makeTranslation(0, 0.08, 0)).multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
    root.add(p);
  }
  if (def.jet) {
    solid(new THREE.CylinderGeometry(7, 7, 0.4, 24), m.jet, [0, 0.1, 0]);
    solid(new THREE.CylinderGeometry(7, 9, 24, 24, 1, true), m.jetCol, [0, 12, 0]);
  }
  if (def.tube) {
    // arceaux autour de l'axe du tube (axe = point de la chaussée + normale × rayon)
    const S = sampleBlock(t.type);
    const geo = new THREE.TorusGeometry(13.5, 0.45, 6, 32);
    for (let i = 2; i < S.length - 2; i += Math.max(2, Math.round(S.length / 9))) {
      const f2 = S[i];
      const c = toWorld(t, f2.p.map((v, j) => v + f2.u[j] * 12));
      const tt = new THREE.Vector3(...toWorld(t, f2.t, true));
      const o = new THREE.Mesh(geo, m.ring);
      o.position.set(...c);
      o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tt);
      root.add(o);
    }
  }
  if (def.base === "kicker2") flat(m.kick, 10, 14, 0.07);
  if (def.wind) flat(m.windR, 14, 28, 0.9, (param(t, "force") ?? 0) >= 0 ? -Math.PI / 2 : Math.PI / 2);
  if (def.mech === "gate") {
    const o = solid(box(20, 6, 1), m.barrier, [0, 3, 0]);
    anim.push((steps) => { o.visible = gateClosed(t, steps); });
  }
  if (def.mech === "door") {
    const o = solid(box(20, 8, 1.6), m.door[(Math.max(1, Math.round(param(t, "id") ?? 1)) - 1) % 5], [0, 4, 0]);
    anim.push((steps, flags) => { o.visible = !flags[switchKey(param(t, "id"))]; });
  }
  if (def.mech === "crate") {
    const o = solid(box(8, 4, 8), m.crate, [0, 2, 0]);
    anim.push((steps, flags) => { o.visible = !flags[crateKey(t)]; });
  }
  if (def.mech === "lift") {
    const slab = new THREE.Mesh(box(20, 0.6, 32), m.lift);
    slab.matrixAutoUpdate = true;
    const dist = TILE * (param(t, "dist") ?? 2);
    root.add(slab);
    const q = new THREE.Quaternion().setFromRotationMatrix(basis({ ...f, p: [0, 0, 0] }));
    slab.quaternion.copy(q);
    anim.push((steps) => {
      const d = dist * liftPhase(t, steps);
      slab.position.set(f.p[0] - f.u[0] * 0.3 + f.t[0] * d, f.p[1] - f.u[1] * 0.3 + f.t[1] * d, f.p[2] - f.u[2] * 0.3 + f.t[2] * d);
    });
    anim.at(-1)(0);
  }
  if (def.mech === "rail") {
    const pts = sampleBlock(t.type).map((s) => new THREE.Vector3(...toWorld(t, s.p)).addScaledVector(new THREE.Vector3(...toWorld(t, s.u, true)), 0.7));
    root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.35, 6), m.rail));
  }
}

export function buildTrackGroup(track, world) {
  const mats = materials(world);
  const root = new THREE.Group();
  const anim = [];
  root.userData.anim = anim;
  const pillars = [];
  for (const t of track.tiles) {
    const def = BLOCKS[t.type];
    if (def.season || def.base) decorS2(t, def, mats, root, anim);
    if (def.mech === "lift") continue; // pas de route fixe : la plateforme est animée
    const surf = tileSurface(t);
    const s2top = { brake: mats.s2.brake, glue: mats.s2.glue, oil: mats.s2.oil, water: mats.s2.water }[surf] || (def.gravity ? mats.s2.grav : null);
    const top = s2top || (surf === "dirt" ? mats.dirt : surf === "ice" ? mats.ice : t.type === "platform" || def.bare ? mats.plain : mats.road);
    root.add(new THREE.Mesh(sweptGeometry(t), [top, mats.side]));
    if (def.surface === "boost") {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(12, 24), mats.boost);
      p.matrixAutoUpdate = false;
      p.matrix.copy(basis(frameOf(t, 0.5))).multiply(new THREE.Matrix4().makeTranslation(0, 0.06, 0)).multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
      root.add(p);
    }
    if (def.gate) root.add(gate(def.fast ? "cpfast" : def.gate, mats, frameOf(t, 0.5), def.gate === "start"));
    // piliers sous les parties à peu près horizontales et en hauteur
    if (t.type !== "loop" && t.type !== "wall" && !world.void) {
      const S = sampleBlock(t.type);
      const step = Math.max(1, Math.round(S.length / 3));
      for (let i = Math.floor(step / 2); i < S.length; i += step) {
        const f = S[i];
        const p = toWorld(t, f.p);
        if (p[1] > 2 && f.u[1] > 0.85) pillars.push([p[0], p[1] - DECK, p[2]]);
      }
    }
  }
  if (pillars.length) {
    const geo = new THREE.BoxGeometry(2.6, 1, 2.6);
    geo.translate(0, 0.5, 0);
    const inst = new THREE.InstancedMesh(geo, mats.pillar, pillars.length);
    const m4 = new THREE.Matrix4();
    pillars.forEach(([x, y, z], i) => inst.setMatrixAt(i, m4.makeScale(1, y + 0.3, 1).setPosition(x, -0.3, z)));
    root.add(inst);
  }
  return root;
}

// Mondes suspendus de la saison 2 : rien de praticable sous la piste, seulement un décor lointain bien plus bas
export const VOID_DEPTH = 320;
function buildVoidDecor(track, world, seed) {
  const [w, h] = track.size;
  let s = seed * 7919 + 104729;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const group = new THREE.Group();
  const cx = (w * TILE) / 2, cz = (h * TILE) / 2;
  const y0 = -VOID_DEPTH;
  // fond : mer de nuages, lave, océan… très loin sous la piste
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshStandardMaterial({
    color: world.ground, roughness: 1, emissive: world.id === "s2dirt" ? "#ff4a1a" : world.id === "s2air" ? "#2a1a6a" : "#000", emissiveIntensity: world.id === "s2dirt" ? 0.25 : 0.5,
  }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(cx, y0, cz);
  group.add(sea);
  const kind = world.id;
  const spots = [];
  for (let i = 0; i < 140; i++) {
    const a = rnd() * Math.PI * 2, r = 120 + rnd() * 1400;
    spots.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r, 0.6 + rnd() * 0.8, rnd() * 6.28, rnd()]);
  }
  let geo, mat, y = y0;
  if (kind === "s2tech") {
    geo = new THREE.BoxGeometry(40, 120, 40); geo.translate(0, 60, 0);
    mat = new THREE.MeshStandardMaterial({ color: "#5b6573", roughness: 0.8, emissive: "#ff9f1c", emissiveIntensity: 0.05 });
  } else if (kind === "s2speed") {
    geo = new THREE.SphereGeometry(30, 10, 8); geo.scale(2.2, 0.6, 1.4);
    mat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1, emissive: "#ffffff", emissiveIntensity: 0.25 });
    y = y0 + 120;
  } else if (kind === "s2dirt") {
    geo = new THREE.CylinderGeometry(36, 48, 140, 7); geo.translate(0, 70, 0);
    mat = new THREE.MeshStandardMaterial({ color: "#b4532a", flatShading: true, roughness: 1 });
  } else if (kind === "s2ice") {
    geo = new THREE.ConeGeometry(40, 120, 6); geo.translate(0, 40, 0);
    mat = new THREE.MeshStandardMaterial({ color: "#e9f7ff", flatShading: true, roughness: 0.3 });
  } else {
    geo = new THREE.ConeGeometry(40, 90, 7); geo.rotateX(Math.PI); geo.translate(0, -45, 0);
    mat = new THREE.MeshStandardMaterial({ color: "#4a3b2a", flatShading: true });
    y = y0 + 180;
  }
  const inst = new THREE.InstancedMesh(geo, mat, spots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  spots.forEach(([x, z, k, r, j], i) => {
    q.setFromEuler(e.set(0, r, 0));
    m4.compose(p.set(x, y + (kind === "s2air" || kind === "s2speed" ? j * 60 : 0), z), q, sc.set(k, k, k));
    inst.setMatrixAt(i, m4);
  });
  group.add(inst);
  if (kind === "s2air") {
    // îles flottantes : herbe sur le dessus des cônes renversés
    const top = new THREE.CylinderGeometry(40, 40, 6, 7);
    const tops = new THREE.InstancedMesh(top, new THREE.MeshStandardMaterial({ color: "#3d8a4a", flatShading: true }), spots.length);
    spots.forEach(([x, z, k, r, j], i) => { q.setFromEuler(e.set(0, r, 0)); m4.compose(p.set(x, y + j * 60 + 3 * k, z), q, sc.set(k, k, k)); tops.setMatrixAt(i, m4); });
    group.add(tops);
  }
  return group;
}

// Décor dispersé autour de la piste (arbres, rochers, néons…), en instances
export function buildDecor(track, world, seed = 1) {
  if (world.void) return buildVoidDecor(track, world, seed);
  const [w, h] = track.size;
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const occupied = new Set();
  for (const t of track.tiles) for (const k of occupancy(t)) occupied.add(k.split(",").slice(0, 2).join(","));
  const spots = [];
  const pad = 6;
  for (let i = 0; i < 260; i++) {
    const x = (rnd() * (w + pad * 2) - pad) * TILE;
    const z = (rnd() * (h + pad * 2) - pad) * TILE;
    const cx = Math.floor(x / TILE), cz = Math.floor(z / TILE);
    let near = false;
    for (let dx = -1; dx <= 1 && !near; dx++) for (let dz = -1; dz <= 1; dz++) if (occupied.has(`${cx + dx},${cz + dz}`)) near = true;
    if (!near) spots.push([x, z, 0.7 + rnd() * 0.8, rnd() * 6.28]);
  }
  const group = new THREE.Group();
  const kind = world.id;
  let geo, mat, trunk = null;
  if (kind === "forest" || kind === "snow") {
    geo = new THREE.ConeGeometry(4, 14, 7);
    geo.translate(0, 11, 0);
    mat = new THREE.MeshStandardMaterial({ color: kind === "snow" ? "#dfeaf3" : "#1f5a2a", flatShading: true });
    trunk = new THREE.CylinderGeometry(0.8, 1, 5, 6);
    trunk.translate(0, 2.5, 0);
  } else if (kind === "desert") {
    geo = new THREE.DodecahedronGeometry(5, 0);
    geo.translate(0, 2, 0);
    mat = new THREE.MeshStandardMaterial({ color: "#b5733d", flatShading: true });
  } else if (kind === "neon") {
    geo = new THREE.BoxGeometry(3, 30, 3);
    geo.translate(0, 15, 0);
    mat = new THREE.MeshStandardMaterial({ color: "#1b1240", emissive: world.accent, emissiveIntensity: 0.6 });
  } else {
    geo = new THREE.BoxGeometry(14, 8, 6);
    geo.translate(0, 4, 0);
    mat = new THREE.MeshStandardMaterial({ color: "#d8dde4" });
  }
  const inst = new THREE.InstancedMesh(geo, mat, spots.length);
  const trunks = trunk ? new THREE.InstancedMesh(trunk, new THREE.MeshStandardMaterial({ color: "#5a3b22" }), spots.length) : null;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  spots.forEach(([x, z, k, r], i) => {
    q.setFromEuler(e.set(0, r, 0));
    m4.compose(p.set(x, 0, z), q, sc.set(k, k, k));
    inst.setMatrixAt(i, m4);
    trunks?.setMatrixAt(i, m4);
  });
  group.add(inst);
  if (trunks) group.add(trunks);
  return group;
}

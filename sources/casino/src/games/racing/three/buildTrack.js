// Construit la piste en three.js pur (un Group), à partir d'un Track. Matériaux partagés par monde.
import * as THREE from "three";
import { LEVEL_H, ROAD_HALF, TILE, cellCenter } from "../track.js";

const H = TILE / 2;
const DECK = 1.2;

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

function roadTex(world, dirt) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = dirt ? "#7a5634" : world.road;
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
  const side = new THREE.MeshStandardMaterial({ color: world.night ? "#2a2250" : "#c9ccd2", roughness: 0.7, emissive: world.night ? world.accent : "#000", emissiveIntensity: emissive * 0.4 });
  const plain = new THREE.MeshStandardMaterial({ color: world.road, roughness: 0.85 });
  const kerb = new THREE.MeshStandardMaterial({ color: world.night ? world.accent : "#e8e8e8", emissive: world.night ? world.accent : "#000", emissiveIntensity: world.night ? 0.8 : 0 });
  const pillar = new THREE.MeshStandardMaterial({ color: world.night ? "#1d1640" : "#9aa0a8", roughness: 0.9 });
  const boost = new THREE.MeshBasicMaterial({ map: boostTex("#ff8a1f"), transparent: true, depthWrite: false });
  const gates = {
    start: new THREE.MeshBasicMaterial({ map: bannerTex("DÉPART", "#18a04a", "#fff") }),
    cp: new THREE.MeshBasicMaterial({ map: bannerTex("CHECKPOINT", "#1f6fe0", "#fff") }),
    finish: new THREE.MeshBasicMaterial({ map: bannerTex("ARRIVÉE", "#000", "#fff", true) }),
  };
  const post = new THREE.MeshStandardMaterial({ color: "#2b2f36", roughness: 0.5, metalness: 0.3 });
  const m = { road, dirt, side, plain, kerb, pillar, boost, gates, post };
  cache.set(world.id, m);
  return m;
}

const boxGeo = new Map();
const box = (w, h, d) => {
  const k = `${w},${h},${d}`;
  if (!boxGeo.has(k)) boxGeo.set(k, new THREE.BoxGeometry(w, h, d));
  return boxGeo.get(k);
};

let turnGeo = null;
function turnGeometry() {
  if (turnGeo) return turnGeo;
  const s = new THREE.Shape();
  s.absarc(H, -H, H + ROAD_HALF, Math.PI / 2, Math.PI, false);
  s.absarc(H, -H, H - ROAD_HALF, Math.PI, Math.PI / 2, true);
  const g = new THREE.ExtrudeGeometry(s, { depth: DECK, bevelEnabled: false, curveSegments: 24 });
  g.rotateX(-Math.PI / 2);
  turnGeo = g;
  return g;
}
let kerbTurn = null;
function turnKerbs() {
  if (kerbTurn) return kerbTurn;
  const mk = (r) => {
    const s = new THREE.Shape();
    s.absarc(H, -H, r + 0.6, Math.PI / 2, Math.PI, false);
    s.absarc(H, -H, r - 0.6, Math.PI, Math.PI / 2, true);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.35, bevelEnabled: false, curveSegments: 24 });
    g.rotateX(-Math.PI / 2);
    return g;
  };
  kerbTurn = [mk(H + ROAD_HALF), mk(H - ROAD_HALF)];
  return kerbTurn;
}

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

function gate(type, mats, base) {
  const g = new THREE.Group();
  // le portique de départ est à l'avant du bloc, pour que la caméra ne démarre pas dessous
  if (type === "start") g.position.z = -H + 2;
  const hgt = 9;
  g.add(mesh(box(1.2, hgt, 1.2), mats.post, -ROAD_HALF - 1.2, base + hgt / 2, 0));
  g.add(mesh(box(1.2, hgt, 1.2), mats.post, ROAD_HALF + 1.2, base + hgt / 2, 0));
  const banner = mesh(box(2 * ROAD_HALF + 3.6, 2.4, 0.6), [mats.post, mats.post, mats.post, mats.post, mats.gates[type], mats.gates[type]], 0, base + hgt, 0);
  g.add(banner);
  return g;
}

export function buildTrackGroup(track, world) {
  const mats = materials(world);
  const root = new THREE.Group();
  for (const t of track.tiles) {
    const g = new THREE.Group();
    const [cx, cz] = cellCenter(t.x, t.z);
    g.position.set(cx, 0, cz);
    g.rotation.y = (-t.rot * Math.PI) / 2;
    const base = t.level * LEVEL_H;
    const sideMats = (top) => [mats.side, mats.side, top, mats.side, mats.side, mats.side];
    if (t.type === "turn") {
      const m = new THREE.Mesh(turnGeometry(), mats.plain);
      m.position.y = base - DECK;
      g.add(m);
      for (const k of turnKerbs()) {
        const km = new THREE.Mesh(k, mats.kerb);
        km.position.y = base - 0.3;
        g.add(km);
      }
    } else if (t.type === "ramp") {
      const len = Math.hypot(TILE, LEVEL_H);
      const a = Math.atan2(LEVEL_H, TILE);
      const m = mesh(box(2 * ROAD_HALF, DECK, len + 0.4), sideMats(mats.road), 0, base + LEVEL_H / 2 - DECK / 2 / Math.cos(a), 0);
      m.rotation.x = a;
      g.add(m);
    } else if (t.type === "wide") {
      g.add(mesh(box(TILE, DECK, TILE), sideMats(mats.plain), 0, base - DECK / 2, 0));
    } else {
      const top = t.type === "dirt" ? mats.dirt : mats.road;
      g.add(mesh(box(2 * ROAD_HALF, DECK, TILE), sideMats(top), 0, base - DECK / 2, 0));
      if (t.type === "boost") {
        const p = mesh(new THREE.PlaneGeometry(12, 24), mats.boost, 0, base + 0.05, 0);
        p.rotation.x = -Math.PI / 2;
        g.add(p);
      }
      if (t.type === "start" || t.type === "cp" || t.type === "finish") g.add(gate(t.type, mats, base));
    }
    // Piliers sous les blocs surélevés
    const top = base + (t.type === "ramp" ? LEVEL_H / 2 : 0) - DECK;
    if (top > 0.5) {
      const ph = top;
      const offs = t.type === "turn" ? [[H - 6, H - 22], [H - 22, H - 6]] : [[0, -9], [0, 9]];
      for (const [u, v] of offs) g.add(mesh(box(2.4, ph, 2.4), mats.pillar, u, ph / 2, v));
    }
    root.add(g);
  }
  return root;
}

// Décor dispersé autour de la piste (arbres, rochers, néons…), en instances
export function buildDecor(track, world, seed = 1) {
  const [w, h] = track.size;
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const occupied = new Set(track.tiles.map((t) => `${t.x},${t.z}`));
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

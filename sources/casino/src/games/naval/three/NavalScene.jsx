import { Html, Sparkles, Stars } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import React from "react";
import * as THREE from "three";
import { useRoomMii } from "../../../lib/mii.js";
import { MiiAvatar } from "../../../ui/MiiAvatar.jsx";
import { COLS, FLEET, SIZE, fleetError, shipCells } from "../engine.js";
import { FLY_MS } from "../host.js";

export const LEFT = -6.6;
export const RIGHT = 6.6;
const HALF = SIZE / 2;
const cellPos = (bx, x, y) => [bx + x - HALF + 0.5, y - HALF + 0.5];
const shipCenter = (bx, s) => {
  const [cx, cz] = cellPos(bx, s.x, s.y);
  const off = (s.len - 1) / 2;
  return s.dir === "h" ? [cx + off, cz] : [cx, cz + off];
};
const seeded = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/* ---------------- mer ---------------- */

const WAVES = `
uniform float uTime;
float wv(vec2 p){ return 0.13*sin(p.x*0.33+uTime*0.85) + 0.09*sin(p.y*0.41+uTime*0.65) + 0.045*sin((p.x+p.y)*0.95+uTime*1.7); }
vec2 wd(vec2 p){
  float a = 0.13*0.33*cos(p.x*0.33+uTime*0.85);
  float b = 0.09*0.41*cos(p.y*0.41+uTime*0.65);
  float c = 0.045*0.95*cos((p.x+p.y)*0.95+uTime*1.7);
  return vec2(a+c, b+c);
}
`;

function Ocean() {
  const uniforms = React.useRef({ uTime: { value: 0 } });
  const mat = React.useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: "#1a6d96", roughness: 0.18, metalness: 0.25 });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uniforms.current.uTime;
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\n" + WAVES)
        .replace("#include <beginnormal_vertex>", "vec2 dd = wd(position.xy);\nvec3 objectNormal = normalize(vec3(-dd.x, -dd.y, 1.0));")
        .replace("#include <begin_vertex>", "vec3 transformed = vec3(position);\ntransformed.z += wv(position.xy);");
    };
    return m;
  }, []);
  useFrame((s) => (uniforms.current.uTime.value = s.clock.elapsedTime));
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-0.05} material={mat} receiveShadow>
      <planeGeometry args={[160, 160, 160, 160]} />
    </mesh>
  );
}

/* ---------------- grilles ---------------- */

function labelTexture(accent) {
  const px = 88;
  const n = SIZE + 1;
  const c = document.createElement("canvas");
  c.width = c.height = n * px;
  const ctx = c.getContext("2d");
  const o = px / 2;
  ctx.strokeStyle = "rgba(170,225,255,.55)";
  ctx.lineWidth = 3;
  for (let i = 0; i <= SIZE; i++) {
    ctx.beginPath();
    ctx.moveTo(o + i * px, o);
    ctx.lineTo(o + i * px, o + SIZE * px);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(o, o + i * px);
    ctx.lineTo(o + SIZE * px, o + i * px);
    ctx.stroke();
  }
  ctx.strokeStyle = accent;
  ctx.lineWidth = 7;
  ctx.strokeRect(o, o, SIZE * px, SIZE * px);
  ctx.fillStyle = "#e9f6ff";
  ctx.font = `700 ${px * 0.36}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < SIZE; i++) {
    ctx.fillText(COLS[i], o + (i + 0.5) * px, o / 2 + 2);
    ctx.fillText(String(i + 1), o / 2, o + (i + 0.5) * px);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function Board({ bx, accent, onMove, onLeave, onClick, onContext }) {
  const tex = React.useMemo(() => labelTexture(accent), [accent]);
  const rim = "#25313d";
  const w = SIZE + 1;
  return (
    <group position={[bx, 0, 0]}>
      {/* cadre métallique */}
      {[
        [0, -HALF - 0.25, w, 0.5],
        [0, HALF + 0.25, w, 0.5],
        [-HALF - 0.25, 0, 0.5, w],
        [HALF + 0.25, 0, 0.5, w],
      ].map(([x, z, sx, sz], i) => (
        <mesh key={i} position={[x, 0.1, z]} castShadow receiveShadow>
          <boxGeometry args={[sx, 0.42, sz]} />
          <meshStandardMaterial color={rim} metalness={0.7} roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[0, 0.33, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[w, w]} />
        <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {/* zone cliquable */}
      <mesh
        position={[0, 0.3, 0]}
        rotation-x={-Math.PI / 2}
        visible={false}
        onPointerMove={(e) => {
          if (!onMove) return;
          e.stopPropagation();
          const x = Math.floor(e.point.x - bx + HALF);
          const y = Math.floor(e.point.z + HALF);
          if (x >= 0 && y >= 0 && x < SIZE && y < SIZE) onMove(x, y);
        }}
        onPointerOut={() => onLeave?.()}
        onClick={(e) => {
          if (!onClick) return;
          e.stopPropagation();
          onClick(Math.floor(e.point.x - bx + HALF), Math.floor(e.point.z + HALF));
        }}
        onContextMenu={(e) => {
          e.nativeEvent?.preventDefault?.();
          onContext?.();
        }}
      >
        <planeGeometry args={[SIZE, SIZE]} />
      </mesh>
    </group>
  );
}

/* ---------------- navires ---------------- */

function hullGeometry(len, width) {
  const L = len * 0.94;
  const h = L / 2;
  const w = width / 2;
  const s = new THREE.Shape();
  s.moveTo(-h, -w * 0.8);
  s.quadraticCurveTo(-h, -w, -h + 0.15, -w);
  s.lineTo(h - 0.75, -w);
  s.quadraticCurveTo(h - 0.15, -w * 0.9, h, 0);
  s.quadraticCurveTo(h - 0.15, w * 0.9, h - 0.75, w);
  s.lineTo(-h + 0.15, w);
  s.quadraticCurveTo(-h, w, -h, w * 0.8);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -0.14, 0);
  return g;
}

function Turret({ x, flip = false, mat }) {
  return (
    <group position={[x, 0.24, 0]} rotation-y={flip ? Math.PI : 0}>
      <mesh castShadow material={mat}>
        <cylinderGeometry args={[0.16, 0.19, 0.12, 14]} />
      </mesh>
      <mesh position={[0.24, 0.02, 0.05]} castShadow material={mat}>
        <boxGeometry args={[0.34, 0.04, 0.04]} />
      </mesh>
      <mesh position={[0.24, 0.02, -0.05]} castShadow material={mat}>
        <boxGeometry args={[0.34, 0.04, 0.04]} />
      </mesh>
    </group>
  );
}

function ShipModel({ k, len, sunk, ghost }) {
  const hullMat = React.useMemo(
    () =>
      ghost
        ? new THREE.MeshBasicMaterial({ color: ghost, transparent: true, opacity: 0.55, depthWrite: false })
        : new THREE.MeshStandardMaterial({ color: k === "sub" ? "#2e363f" : "#65717e", metalness: 0.45, roughness: 0.5 }),
    [k, ghost],
  );
  const deckMat = React.useMemo(
    () => (ghost ? hullMat : new THREE.MeshStandardMaterial({ color: "#9aa6b2", metalness: 0.3, roughness: 0.6 })),
    [ghost, hullMat],
  );
  const darkMat = React.useMemo(
    () => (ghost ? hullMat : new THREE.MeshStandardMaterial({ color: "#2b323a", metalness: 0.4, roughness: 0.6 })),
    [ghost, hullMat],
  );
  React.useEffect(() => {
    if (ghost) return;
    const c = sunk ? "#2a2522" : k === "sub" ? "#2e363f" : "#65717e";
    hullMat.color.set(c);
    deckMat.color.set(sunk ? "#3a3430" : "#9aa6b2");
  }, [sunk, ghost]);
  const L = len * 0.94;
  const width = k === "carrier" ? 0.82 : k === "torpedo" ? 0.5 : 0.64;
  const hullGeo = React.useMemo(() => hullGeometry(len, width), [len, width]);
  if (k === "sub") {
    return (
      <group>
        <mesh rotation-z={Math.PI / 2} position-y={0.02} scale={[1, 1, 0.85]} material={hullMat} castShadow>
          <capsuleGeometry args={[0.24, L - 0.5, 6, 16]} />
        </mesh>
        <mesh position={[0.25, 0.3, 0]} material={darkMat} castShadow>
          <boxGeometry args={[0.5, 0.3, 0.16]} />
        </mesh>
        <mesh position={[0.25, 0.46, 0]} material={darkMat}>
          <cylinderGeometry args={[0.015, 0.015, 0.25]} />
        </mesh>
        <mesh position={[-L / 2 + 0.1, 0.08, 0]} material={darkMat}>
          <boxGeometry args={[0.05, 0.3, 0.4]} />
        </mesh>
      </group>
    );
  }
  const hull = <mesh geometry={hullGeo} material={hullMat} castShadow receiveShadow />;
  if (k === "carrier") {
    return (
      <group>
        {hull}
        <mesh position={[0, 0.24, 0]} material={darkMat} receiveShadow castShadow>
          <boxGeometry args={[L - 0.2, 0.06, 0.9]} />
        </mesh>
        <mesh position={[0, 0.275, 0]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[L - 0.6, 0.03]} />
          <meshBasicMaterial color={ghost || "#f2f2e8"} transparent opacity={ghost ? 0.4 : 0.85} />
        </mesh>
        <mesh position={[0.4, 0.48, -0.32]} material={deckMat} castShadow>
          <boxGeometry args={[0.7, 0.42, 0.2]} />
        </mesh>
        <mesh position={[0.45, 0.85, -0.32]} material={darkMat}>
          <cylinderGeometry args={[0.02, 0.02, 0.4]} />
        </mesh>
        {!ghost &&
          [-1.2, -0.4].map((x) => (
            <mesh key={x} position={[x, 0.31, 0.15]} castShadow material={deckMat}>
              <boxGeometry args={[0.3, 0.05, 0.28]} />
            </mesh>
          ))}
      </group>
    );
  }
  return (
    <group>
      {hull}
      <mesh position={[-0.05, 0.32, 0]} material={deckMat} castShadow>
        <boxGeometry args={[k === "torpedo" ? 0.42 : 0.62, 0.22, width * 0.6]} />
      </mesh>
      <mesh position={[0, 0.5, 0]} material={deckMat} castShadow>
        <boxGeometry args={[0.3, 0.16, width * 0.42]} />
      </mesh>
      <mesh position={[0.05, 0.75, 0]} material={darkMat}>
        <cylinderGeometry args={[0.015, 0.015, 0.36]} />
      </mesh>
      {k !== "torpedo" && (
        <mesh position={[-0.42, 0.4, 0]} material={darkMat} castShadow>
          <cylinderGeometry args={[0.09, 0.11, 0.3, 12]} />
        </mesh>
      )}
      {k !== "torpedo" && <Turret x={L / 2 - 0.55} mat={darkMat} />}
      {k === "cruiser" && <Turret x={-L / 2 + 0.5} flip mat={darkMat} />}
      {k === "torpedo" && (
        <mesh position={[-0.4, 0.22, 0]} material={darkMat}>
          <boxGeometry args={[0.3, 0.06, 0.3]} />
        </mesh>
      )}
    </group>
  );
}

function Ship({ bx, s, sunk, seed = 0 }) {
  const ref = React.useRef();
  const [x, z] = shipCenter(bx, s);
  const rotY = s.dir === "h" ? 0 : -Math.PI / 2;
  const sinkT = React.useRef(0);
  useFrame((st, dt) => {
    const g = ref.current;
    if (!g) return;
    const t = st.clock.elapsedTime + seed * 2.1;
    if (sunk) sinkT.current = Math.min(1, sinkT.current + dt / 2.6);
    const k = sinkT.current;
    const ease = k * k * (3 - 2 * k);
    g.position.y = 0.02 + Math.sin(t * 1.3) * 0.03 * (1 - ease) - ease * 0.42;
    g.rotation.x = Math.sin(t * 0.9) * 0.025 + ease * 0.32 * (seed % 2 ? 1 : -1);
    g.rotation.z = Math.sin(t * 0.7) * 0.015 + ease * 0.12;
  });
  return (
    <group position={[x, 0, z]} rotation-y={rotY}>
      <group ref={ref}>
        <ShipModel k={s.k} len={s.len} sunk={sunk} />
      </group>
    </group>
  );
}

/* ---------------- marqueurs, feu, fumée ---------------- */

const fireMat = new THREE.MeshBasicMaterial({ color: "#ff8a1f", transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
const fireCore = new THREE.MeshBasicMaterial({ color: "#ffe27a", transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
const smokeMat = new THREE.MeshStandardMaterial({ color: "#2b2b2b", transparent: true, opacity: 0.45, depthWrite: false, roughness: 1 });

function Fire({ pos, seed, small }) {
  const ref = React.useRef();
  const puffs = React.useRef([]);
  useFrame((st) => {
    const t = st.clock.elapsedTime + seed * 5;
    if (ref.current) {
      ref.current.children.forEach((c, i) => {
        const f = 0.75 + 0.35 * Math.abs(Math.sin(t * (7 + i * 2.3) + i));
        c.scale.set(f, f * (1 + 0.3 * Math.sin(t * 11 + i)), f);
      });
    }
    puffs.current.forEach((p, i) => {
      if (!p) return;
      const k = (t * 0.35 + i / 3) % 1;
      p.position.set(Math.sin(i * 2 + t) * 0.1 + k * 0.4, 0.4 + k * 2.2, Math.cos(i * 3 + t) * 0.1);
      const sc = 0.15 + k * 0.5;
      p.scale.setScalar(sc);
    });
  });
  const s = small ? 0.6 : 1;
  return (
    <group position={[pos[0], 0.18, pos[1]]} scale={s}>
      <group ref={ref}>
        <mesh material={fireMat} position-y={0.18}>
          <coneGeometry args={[0.2, 0.55, 8]} />
        </mesh>
        <mesh material={fireMat} position={[0.12, 0.12, 0.05]}>
          <coneGeometry args={[0.13, 0.36, 8]} />
        </mesh>
        <mesh material={fireCore} position-y={0.12}>
          <coneGeometry args={[0.1, 0.3, 8]} />
        </mesh>
      </group>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(m) => (puffs.current[i] = m)} material={smokeMat}>
          <sphereGeometry args={[1, 8, 6]} />
        </mesh>
      ))}
    </group>
  );
}

function MissMarker({ pos, seed }) {
  const ref = React.useRef();
  useFrame((st) => {
    if (ref.current) ref.current.position.y = 0.12 + Math.sin(st.clock.elapsedTime * 2 + seed * 3) * 0.04;
  });
  return (
    <group ref={ref} position={[pos[0], 0.12, pos[1]]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.1, 0.13, 0.22, 12]} />
        <meshStandardMaterial color="#eef3f7" roughness={0.4} />
      </mesh>
      <mesh position-y={0.13}>
        <sphereGeometry args={[0.07, 10, 8]} />
        <meshStandardMaterial color="#cfe6f5" emissive="#4aa3d8" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

function HitPeg({ pos }) {
  return (
    <mesh position={[pos[0], 0.3, pos[1]]}>
      <sphereGeometry args={[0.1, 10, 8]} />
      <meshBasicMaterial color="#ff3b30" toneMapped={false} />
    </mesh>
  );
}

function Shots({ bx, shots, hideSeq }) {
  return shots.map((s) => {
    if (s.seq === hideSeq) return null; // l'impact en cours est montré par l'effet
    const pos = cellPos(bx, s.x, s.y);
    const seed = s.x * 10 + s.y;
    return s.hit ? (
      <group key={s.x + "," + s.y}>
        <HitPeg pos={pos} />
        <Fire pos={pos} seed={seed} small={s.sunk} />
      </group>
    ) : (
      <MissMarker key={s.x + "," + s.y} pos={pos} seed={seed} />
    );
  });
}

/* ---------------- missile & impacts ---------------- */

const TRAIL = 26;
function Missile({ from, to, startAt }) {
  const body = React.useRef();
  const trail = React.useRef([]);
  const hist = React.useRef([]);
  const H = 5;
  const posAt = (k) => {
    const x = from[0] + (to[0] - from[0]) * k;
    const z = from[2] + (to[2] - from[2]) * k;
    const y = from[1] + (to[1] - from[1]) * k + 4 * H * k * (1 - k);
    return new THREE.Vector3(x, y, z);
  };
  useFrame(() => {
    const k = Math.min(1, (performance.now() - startAt) / FLY_MS);
    // accélération en fin de course
    const e = k < 0.5 ? k * 0.9 : 0.45 + (k - 0.5) * 1.1;
    const p = posAt(e);
    const n = posAt(Math.min(1, e + 0.01));
    if (body.current) {
      body.current.position.copy(p);
      body.current.lookAt(n);
      body.current.visible = k < 1;
    }
    hist.current.unshift(p.clone());
    hist.current.length = Math.min(hist.current.length, TRAIL);
    trail.current.forEach((m, i) => {
      if (!m) return;
      const h = hist.current[i];
      m.visible = !!h && k < 1;
      if (h) {
        m.position.copy(h);
        m.scale.setScalar(0.1 + i * 0.016);
        m.material.opacity = 0.5 * (1 - i / TRAIL);
      }
    });
  });
  return (
    <group>
      <group ref={body}>
        <group scale={1.8}>
        {/* le missile pointe vers +z (lookAt) */}
        <mesh rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.09, 0.09, 0.7, 10]} />
          <meshStandardMaterial color="#c9ced4" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position-z={0.47} rotation-x={Math.PI / 2}>
          <coneGeometry args={[0.09, 0.25, 10]} />
          <meshStandardMaterial color="#c0392b" />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position-z={-0.3} rotation-z={(i * Math.PI) / 2}>
            <boxGeometry args={[0.36, 0.02, 0.16]} />
            <meshStandardMaterial color="#8d949b" />
          </mesh>
        ))}
        <mesh position-z={-0.5} rotation-x={-Math.PI / 2} material={fireCore}>
          <coneGeometry args={[0.08, 0.35, 8]} />
        </mesh>
        </group>
        <pointLight color="#ffb347" intensity={8} distance={7} />
      </group>
      {Array.from({ length: TRAIL }, (_, i) => (
        <mesh key={i} ref={(m) => (trail.current[i] = m)}>
          <sphereGeometry args={[1, 6, 5]} />
          <meshBasicMaterial color={i < 3 ? "#ffcf7a" : "#c8cdd2"} transparent opacity={0.4} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function Splash({ pos, startAt }) {
  const col = React.useRef();
  const ring = React.useRef();
  const drops = React.useRef([]);
  const dirs = React.useMemo(() => Array.from({ length: 16 }, (_, i) => [Math.cos(i * 2.4) * (0.6 + seeded(i) * 0.9), 3 + seeded(i + 9) * 2.5, Math.sin(i * 2.4) * (0.6 + seeded(i + 3) * 0.9)]), []);
  useFrame(() => {
    const t = (performance.now() - startAt) / 1000;
    if (col.current) {
      const up = t < 0.35 ? t / 0.35 : Math.max(0, 1 - (t - 0.35) / 0.9);
      col.current.scale.set(0.5 + t * 0.6, Math.max(0.01, up * 2.4), 0.5 + t * 0.6);
      col.current.material.opacity = 0.8 * Math.max(0, 1 - t / 1.4);
    }
    if (ring.current) {
      ring.current.scale.setScalar(0.3 + t * 2.2);
      ring.current.material.opacity = Math.max(0, 0.7 - t * 0.45);
    }
    drops.current.forEach((d, i) => {
      if (!d) return;
      const [vx, vy, vz] = dirs[i];
      d.position.set(vx * t, Math.max(0, vy * t - 4.9 * t * t), vz * t);
      d.visible = t < 1.6;
    });
  });
  return (
    <group position={[pos[0], 0.1, pos[1]]}>
      <mesh ref={col} position-y={0.5}>
        <cylinderGeometry args={[0.25, 0.45, 1, 12, 1, true]} />
        <meshStandardMaterial color="#e8f6ff" transparent opacity={0.8} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.05}>
        <ringGeometry args={[0.6, 0.8, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.7} depthWrite={false} />
      </mesh>
      {dirs.map((_, i) => (
        <mesh key={i} ref={(m) => (drops.current[i] = m)}>
          <sphereGeometry args={[0.06, 6, 5]} />
          <meshStandardMaterial color="#f0faff" />
        </mesh>
      ))}
    </group>
  );
}

function Explosion({ pos, startAt, big }) {
  const ball = React.useRef();
  const flash = React.useRef();
  const light = React.useRef();
  const debris = React.useRef([]);
  const smoke = React.useRef([]);
  const n = big ? 22 : 14;
  const dirs = React.useMemo(() => Array.from({ length: n }, (_, i) => [Math.cos(i * 2.39) * (1 + seeded(i) * 2), 3 + seeded(i + 4) * 4, Math.sin(i * 2.39) * (1 + seeded(i + 7) * 2)]), [n]);
  const s = big ? 1.6 : 1;
  useFrame(() => {
    const t = (performance.now() - startAt) / 1000;
    if (ball.current) {
      ball.current.scale.setScalar(s * (0.2 + Math.min(1, t / 0.25) * 1.2));
      ball.current.material.opacity = Math.max(0, 1 - t / 0.7);
    }
    if (flash.current) {
      flash.current.scale.setScalar(s * (0.5 + t * 6));
      flash.current.material.opacity = Math.max(0, 0.8 - t * 2.4);
    }
    if (light.current) light.current.intensity = Math.max(0, 40 * s * (1 - t / 0.8));
    debris.current.forEach((d, i) => {
      if (!d) return;
      const [vx, vy, vz] = dirs[i];
      d.position.set(vx * t, Math.max(-0.2, vy * t - 6 * t * t), vz * t);
      d.rotation.set(t * 8 + i, t * 5, 0);
      d.visible = t < 1.8;
    });
    smoke.current.forEach((m, i) => {
      if (!m) return;
      const k = Math.max(0, t - 0.15 - i * 0.08);
      m.position.set(Math.sin(i * 1.7) * 0.4 * k, 0.4 + k * 1.6, Math.cos(i * 2.3) * 0.4 * k);
      m.scale.setScalar(s * (0.2 + k * 0.7));
      m.material.opacity = Math.max(0, 0.6 - k * 0.3);
    });
  });
  return (
    <group position={[pos[0], 0.3, pos[1]]}>
      <pointLight ref={light} color="#ff9a3c" distance={14} position-y={1} />
      <mesh ref={ball}>
        <sphereGeometry args={[0.6, 18, 14]} />
        <meshBasicMaterial color="#ffb347" transparent toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={flash} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.3, 0.5, 32]} />
        <meshBasicMaterial color="#fff2c4" transparent toneMapped={false} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {dirs.map((_, i) => (
        <mesh key={i} ref={(m) => (debris.current[i] = m)}>
          <boxGeometry args={[0.08, 0.05, 0.12]} />
          <meshBasicMaterial color={i % 3 ? "#ff7a1a" : "#3a3a3a"} toneMapped={false} />
        </mesh>
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} ref={(m) => (smoke.current[i] = m)}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color="#353535" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------------- caméra ---------------- */

function Rig({ focus, shake }) {
  const { camera, size } = useThree();
  const look = React.useRef(new THREE.Vector3(0, 0, 0));
  useFrame((_s, dt) => {
    const aspect = size.width / size.height;
    const f = THREE.MathUtils.clamp(1.45 / aspect, 1, 2.3);
    const { pos, at, speed = 1.8 } = focus;
    const k = 1 - Math.exp(-speed * Math.min(dt, 0.05));
    const tx = at[0] + (pos[0] - at[0]) * f;
    const ty = at[1] + (pos[1] - at[1]) * f;
    const tz = at[2] + (pos[2] - at[2]) * f;
    camera.position.x += (tx - camera.position.x) * k;
    camera.position.y += (ty - camera.position.y) * k;
    camera.position.z += (tz - camera.position.z) * k;
    look.current.x += (at[0] - look.current.x) * k;
    look.current.y += (at[1] - look.current.y) * k;
    look.current.z += (at[2] - look.current.z) * k;
    const sh = shake.current;
    if (sh > 0.001) {
      camera.position.x += (Math.random() - 0.5) * sh;
      camera.position.y += (Math.random() - 0.5) * sh;
      shake.current *= Math.exp(-5 * dt);
    }
    camera.lookAt(look.current);
  });
  return null;
}

/* ---------------- capitaines (Mii) ---------------- */

function Captain({ p, bx, active, won }) {
  const mii = useRoomMii(p);
  const ref = React.useRef();
  useFrame((st) => {
    if (!ref.current) return;
    const t = st.clock.elapsedTime;
    ref.current.position.y = 0.3 + (won ? Math.abs(Math.sin(t * 5)) * 0.35 : 0);
  });
  return (
    <group position={[bx, 0, -HALF - 1.9]}>
      <mesh position-y={0.1} receiveShadow castShadow>
        <cylinderGeometry args={[0.9, 1, 0.4, 24]} />
        <meshStandardMaterial color="#2a3644" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position-y={0.31} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.78, 0.9, 32]} />
        <meshBasicMaterial color={active ? "#ffd36a" : "#3f5466"} toneMapped={false} />
      </mesh>
      <group ref={ref}>
        <MiiAvatar mii={mii} scale={1.05} />
      </group>
    </group>
  );
}

/* ---------------- scène ---------------- */

export function NavalScene({ state, meId, placing, onAim, onFire, aim }) {
  const shake = React.useRef(0);
  const me = state.players.find((p) => p.id === meId);
  const foe = state.players.find((p) => p.id !== meId);
  const boardOf = (id) => (id === meId ? LEFT : RIGHT);
  const battle = state.phase === "battle";
  const shot = battle ? state.shot : null;
  const myTurn = battle && state.turn === meId && state.step === "aim";

  // Horodatage local des étapes du tir (vol, impact) pour animer au même rythme chez tout le monde.
  const [flight, setFlight] = React.useState(null);
  const [impact, setImpact] = React.useState(null);
  React.useEffect(() => {
    if (!shot) return;
    const bx = boardOf(shot.target);
    const [cx, cz] = cellPos(bx, shot.x, shot.y);
    if (state.step === "flying" && flight?.seq !== shot.seq) {
      const fromBx = boardOf(shot.by);
      // départ : depuis un navire encore à flot (le mien) ou depuis l'arrière de la grille adverse
      let from = [fromBx, 0.6, -HALF - 1];
      if (shot.by === meId && me?.ships?.length) {
        const alive = me.ships.filter((s) => !me.sunk.includes(s.k));
        const s = alive[shot.seq % Math.max(1, alive.length)] || me.ships[0];
        const [sx, sz] = shipCenter(fromBx, s);
        from = [sx, 0.6, sz];
      }
      setFlight({ seq: shot.seq, from, to: [cx, 0.2, cz], at: performance.now() });
    }
    if (state.step === "impact" && impact?.seq !== shot.seq) {
      setImpact({ seq: shot.seq, pos: [cx, cz], hit: shot.hit, sunk: !!shot.sunk, at: performance.now() });
      shake.current = shot.sunk ? 0.7 : shot.hit ? 0.4 : 0.08;
    }
  }, [state.step, shot?.seq]);

  // Cadrage : chaque phase du tir a son plan, les transitions sont lentes pour bien suivre l'action.
  const focus = React.useMemo(() => {
    if (state.phase === "lobby" || state.phase === "end") return { pos: [0, 15, 19], at: [0, 0, 0], speed: 0.9 };
    if (state.phase === "placing") return { pos: [LEFT, 14.5, 8.5], at: [LEFT, 0, 0.6], speed: 1.6 };
    // En visée : la grille du joueur qui va subir le tir. Pendant le vol : plan large sur les deux grilles.
    const target = state.step !== "aim" && shot ? boardOf(shot.target) : state.turn === meId ? RIGHT : LEFT;
    if (state.step === "flying" && shot) {
      return { pos: [target * 0.25, 17, 20], at: [target * 0.25, 1.5, -0.5], speed: 1.3 };
    }
    if (state.step === "impact" && shot) {
      const [cx, cz] = cellPos(target, shot.x, shot.y);
      return { pos: [cx * 0.6 + target * 0.4, 8.5, cz + 8.5], at: [cx, 0.3, cz], speed: 2.2 };
    }
    return { pos: [target, 13.5, 10.5], at: [target, 0, 0.5], speed: 1.5 };
  }, [state.phase, state.step, state.turn, shot?.seq]);

  const hideMine = impact && shot && state.step === "impact" ? impact.seq : null;
  const ghost = placing?.ghost;
  const ghostOk = ghost && !fleetError([...placing.ships, ghost], { partial: true, touch: state.settings.touch });

  const renderBoard = (p, bx) => {
    if (!p) return null;
    const showShips = p.ships || [];
    return (
      <group key={p.id}>
        {showShips.map((s, i) => (
          <Ship key={s.k} bx={bx} s={s} sunk={p.sunk.includes(s.k)} seed={i + (bx > 0 ? 7 : 0)} />
        ))}
        <Shots bx={bx} shots={p.shots} hideSeq={hideMine} />
      </group>
    );
  };

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ fov: 42, near: 0.1, far: 200, position: [0, 18, 22] }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <color attach="background" args={["#0b1f33"]} />
      <fog attach="fog" args={["#0b1f33", 30, 85]} />
      <Stars radius={90} depth={30} count={1500} factor={3} fade speed={0.4} />
      <hemisphereLight args={["#b4d6ff", "#123049", 1]} />
      <directionalLight
        position={[-12, 22, 14]}
        intensity={2.1}
        color="#ffe2bd"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
      />
      <Rig focus={focus} shake={shake} />
      <Ocean />

      <Board
        bx={LEFT}
        accent="#5cc8ff"
        onMove={placing ? placing.onHover : undefined}
        onLeave={placing ? () => placing.onHover(null) : undefined}
        onClick={placing ? placing.onCell : undefined}
        onContext={placing?.onRotate}
      />
      <Board
        bx={RIGHT}
        accent="#ff6b6b"
        onMove={myTurn ? (x, y) => onAim(x + "," + y) : undefined}
        onLeave={myTurn ? () => onAim(null) : undefined}
        onClick={myTurn ? onFire : undefined}
      />

      {placing ? (
        <group>
          {placing.ships.map((s, i) => (
            <Ship key={s.k} bx={LEFT} s={s} seed={i} />
          ))}
          {ghost && (
            <group position={[shipCenter(LEFT, ghost)[0], 0.08, shipCenter(LEFT, ghost)[1]]} rotation-y={ghost.dir === "h" ? 0 : -Math.PI / 2}>
              <ShipModel k={ghost.k} len={ghost.len} ghost={ghostOk ? "#48e07a" : "#ff4d4d"} />
            </group>
          )}
        </group>
      ) : (
        <>
          {renderBoard(me, LEFT)}
          {renderBoard(foe, RIGHT)}
        </>
      )}

      {myTurn && aim && (() => {
        const [x, y] = aim.split(",").map(Number);
        const [cx, cz] = cellPos(RIGHT, x, y);
        const used = foe?.shots.some((s) => s.x === x && s.y === y);
        return <Crosshair x={cx} z={cz} used={used} />;
      })()}

      {battle && state.step === "flying" && flight && flight.seq === shot?.seq && (
        <Missile key={flight.seq} from={flight.from} to={flight.to} startAt={flight.at} />
      )}
      {impact && battle && state.step === "impact" && impact.seq === shot?.seq &&
        (impact.hit ? (
          <group key={"x" + impact.seq}>
            <Explosion pos={impact.pos} startAt={impact.at} big={impact.sunk} />
            <Fire pos={impact.pos} seed={impact.seq} />
          </group>
        ) : (
          <Splash key={"s" + impact.seq} pos={impact.pos} startAt={impact.at} />
        ))}

      {me && <Captain p={me} bx={LEFT} active={state.turn === me.id} won={state.phase === "end" && state.winner === me.id} />}
      {foe && <Captain p={foe} bx={RIGHT} active={state.turn === foe.id} won={state.phase === "end" && state.winner === foe.id} />}
      {me && (
        <Html position={[LEFT, 0.4, HALF + 1.1]} center zIndexRange={[20, 0]}>
          <div className={"nv-plate mine" + (state.turn === me.id ? " turn" : "")}>Ta flotte</div>
        </Html>
      )}
      {foe && (
        <Html position={[RIGHT, 0.4, HALF + 1.1]} center zIndexRange={[20, 0]}>
          <div className={"nv-plate foe" + (state.turn === foe.id ? " turn" : "")}>
            {foe.bot ? "🤖 " : ""}Flotte de {foe.name}
          </div>
        </Html>
      )}
      {state.phase === "end" && <Sparkles count={90} scale={[26, 6, 12]} position={[0, 3, 0]} size={6} speed={0.5} color="#ffd36a" />}
    </Canvas>
  );
}

function Crosshair({ x, z, used }) {
  const ref = React.useRef();
  useFrame((st) => {
    if (ref.current) {
      ref.current.rotation.z = st.clock.elapsedTime * 1.5;
      ref.current.scale.setScalar(1 + Math.sin(st.clock.elapsedTime * 6) * 0.06);
    }
  });
  const c = used ? "#888" : "#ff4d4d";
  return (
    <group position={[x, 0.36, z]} rotation-x={-Math.PI / 2}>
      <mesh>
        <planeGeometry args={[0.96, 0.96]} />
        <meshBasicMaterial color={c} transparent opacity={0.22} depthWrite={false} toneMapped={false} />
      </mesh>
      <group ref={ref}>
        <mesh>
          <ringGeometry args={[0.3, 0.36, 32]} />
          <meshBasicMaterial color={c} toneMapped={false} />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} rotation-z={(i * Math.PI) / 2} position={[Math.cos((i * Math.PI) / 2) * 0.42, Math.sin((i * Math.PI) / 2) * 0.42, 0]}>
            <planeGeometry args={[0.16, 0.04]} />
            <meshBasicMaterial color={c} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export { FLEET, shipCells };

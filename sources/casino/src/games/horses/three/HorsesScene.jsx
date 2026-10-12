import { Html, RoundedBox, Sparkles } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import React from "react";
import { ACESFilmicToneMapping, CanvasTexture, MathUtils, Quaternion, SRGBColorSpace, Vector3 } from "three";
import { useRoomMii } from "../../../lib/mii.js";
import { sound } from "../../../lib/sound.js";
import { MiiAvatar } from "../../../ui/MiiAvatar.jsx";
import { COLORS, COLOR_HEX, FINISH, LADDER, STABLE, TRACK, cellOf, startIndex } from "../engine.js";
import { HOP_MS, ROLL_MS } from "../host.js";

const S = 0.8; // taille d'une case
const BOARD_Y = 0.02;
const toWorld = ([x, y]) => [(x - 7) * S, (y - 7) * S];

/* ---------- plateau dessiné sur une seule texture ---------- */

function boardTexture() {
  const N = 1500;
  const u = N / 15;
  const cv = document.createElement("canvas");
  cv.width = cv.height = N;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#f6efdc";
  ctx.fillRect(0, 0, N, N);
  const corner = [[0, 0], [9, 0], [9, 9], [0, 9]];
  COLORS.forEach((c, i) => {
    const [cx, cy] = corner[i];
    ctx.fillStyle = COLOR_HEX[c];
    ctx.fillRect(cx * u, cy * u, 6 * u, 6 * u);
    ctx.fillStyle = "#fbf6e8";
    ctx.beginPath();
    ctx.roundRect(cx * u + u * 0.7, cy * u + u * 0.7, u * 4.6, u * 4.6, u * 0.6);
    ctx.fill();
    // places de l'écurie
    STABLE[i].forEach(([x, y]) => {
      ctx.fillStyle = COLOR_HEX[c] + "55";
      ctx.beginPath();
      ctx.arc((x + 0.5) * u, (y + 0.5) * u, u * 0.62, 0, Math.PI * 2);
      ctx.fill();
    });
  });
  const cell = ([x, y], fill, label) => {
    ctx.fillStyle = fill;
    ctx.fillRect(x * u + 3, y * u + 3, u - 6, u - 6);
    ctx.strokeStyle = "#5b4a32";
    ctx.lineWidth = 3;
    ctx.strokeRect(x * u + 2, y * u + 2, u - 4, u - 4);
    if (label) {
      ctx.fillStyle = "#fff";
      ctx.font = `900 ${u * 0.55}px Georgia, serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, (x + 0.5) * u, (y + 0.54) * u);
    }
  };
  TRACK.forEach((p, i) => {
    const owner = COLORS.findIndex((_, c) => startIndex(c) === i);
    cell(p, owner >= 0 ? COLOR_HEX[COLORS[owner]] : "#fffaf0", owner >= 0 ? "➜" : "");
  });
  LADDER.forEach((steps, c) => steps.slice(0, 5).forEach((p, k) => cell(p, COLOR_HEX[COLORS[c]] + "cc", String(k + 1))));
  // centre : quatre triangles
  const tri = [[[6, 6], [9, 6]], [[9, 6], [9, 9]], [[9, 9], [6, 9]], [[6, 9], [6, 6]]];
  [3, 0, 1, 2].forEach((c, i) => {
    const [[ax, ay], [bx, by]] = tri[i];
    ctx.fillStyle = COLOR_HEX[COLORS[c]];
    ctx.beginPath();
    ctx.moveTo(ax * u, ay * u);
    ctx.lineTo(bx * u, by * u);
    ctx.lineTo(7.5 * u, 7.5 * u);
    ctx.closePath();
    ctx.fill();
  });
  ctx.fillStyle = "#fff";
  ctx.font = `900 ${u * 0.7}px Georgia, serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("6", 7.5 * u, 7.55 * u);
  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function Board() {
  const tex = React.useMemo(boardTexture, []);
  return (
    <group>
      <mesh position={[0, -0.25, 0]} receiveShadow castShadow>
        <boxGeometry args={[15 * S + 0.8, 0.5, 15 * S + 0.8]} />
        <meshStandardMaterial color="#5a3820" roughness={0.6} />
      </mesh>
      <mesh position={[0, BOARD_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[15 * S, 15 * S]} />
        <meshStandardMaterial map={tex} roughness={0.85} />
      </mesh>
      <mesh position={[0, -1.2, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[40, 48]} />
        <meshStandardMaterial color="#14100c" roughness={1} />
      </mesh>
    </group>
  );
}

/* ---------- cheval ---------- */

function HorseModel({ color, glow }) {
  return (
    <group scale={0.62}>
      <mesh position={[0, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.42, 0.5, 0.2, 28]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.1} emissive={color} emissiveIntensity={glow} />
      </mesh>
      <mesh position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.36, 0.55, 24]} />
        <meshStandardMaterial color={color} roughness={0.35} emissive={color} emissiveIntensity={glow} />
      </mesh>
      {/* cou + tête */}
      <mesh position={[0, 0.9, 0.05]} rotation={[0.35, 0, 0]} castShadow>
        <boxGeometry args={[0.32, 0.6, 0.38]} />
        <meshStandardMaterial color={color} roughness={0.35} emissive={color} emissiveIntensity={glow} />
      </mesh>
      <mesh position={[0, 1.1, 0.32]} rotation={[1.1, 0, 0]} castShadow>
        <boxGeometry args={[0.28, 0.5, 0.3]} />
        <meshStandardMaterial color={color} roughness={0.35} emissive={color} emissiveIntensity={glow} />
      </mesh>
      {/* crinière */}
      <mesh position={[0, 1.05, -0.17]} rotation={[0.35, 0, 0]}>
        <boxGeometry args={[0.1, 0.62, 0.12]} />
        <meshStandardMaterial color="#2a1a10" />
      </mesh>
      {[-0.09, 0.09].map((x) => (
        <mesh key={x} position={[x, 1.32, 0.05]} rotation={[-0.2, 0, 0]}>
          <coneGeometry args={[0.06, 0.18, 8]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
      {[-0.1, 0.1].map((x) => (
        <mesh key={"e" + x} position={[x * 1.45, 1.2, 0.3]}>
          <sphereGeometry args={[0.04, 10, 10]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      ))}
    </group>
  );
}

const restSpot = (c, prog, h, colorIdx) => {
  // plusieurs chevaux au centre : on les décale autour du 6
  let p = cellOf(c, prog, h);
  if (prog === FINISH) {
    const a = (colorIdx * 4 + h) * (Math.PI / 8);
    p = [7 + Math.cos(a) * 0.9, 7 + Math.sin(a) * 0.9];
  }
  return toWorld(p);
};

/**
 * Un cheval suit sa file de sauts (une case par saut, avec un petit son) ;
 * un renvoi à l'écurie est un grand vol en cloche.
 */
function Horse({ colorIdx, h, prog, anim, kicked, selectable, onPick, active }) {
  const c = COLORS[colorIdx];
  const ref = React.useRef();
  const st = React.useRef(null);
  const [hover, setHover] = React.useState(false);
  const rest = restSpot(colorIdx, prog, h, colorIdx);

  if (!st.current) st.current = { pos: new Vector3(rest[0], 0, rest[1]), queue: [], seg: null, lastSeq: null, face: 0 };

  React.useEffect(() => {
    const s = st.current;
    if (anim && s.lastSeq !== anim.seq) {
      s.lastSeq = anim.seq;
      if (anim.mine && anim.path.length) {
        s.queue = anim.path.map((p, i) => ({ to: toWorld(p), ms: HOP_MS, h: 0.55, i }));
        // la dernière case peut être un emplacement décalé (centre)
        s.queue[s.queue.length - 1].to = rest;
        s.queue[s.queue.length - 1].last = true;
        return;
      }
      if (kicked) {
        s.queue = [{ to: rest, ms: 1100, h: 3.2, kick: true }];
        return;
      }
    }
    if (!s.queue.length && !s.seg) {
      const d = Math.hypot(s.pos.x - rest[0], s.pos.z - rest[1]);
      if (d > 0.01) s.queue = [{ to: rest, ms: 500, h: 0.8 }];
    }
  }, [anim?.seq, prog, rest[0], rest[1]]);

  useFrame((_s, dt) => {
    const s = st.current;
    const g = ref.current;
    if (!g) return;
    if (!s.seg && s.queue.length) {
      const q = s.queue.shift();
      s.seg = { ...q, from: s.pos.clone(), t: 0 };
      const dx = q.to[0] - s.pos.x;
      const dz = q.to[1] - s.pos.z;
      if (Math.hypot(dx, dz) > 0.01) s.face = Math.atan2(dx, dz);
    }
    let y = 0;
    let spin = 0;
    if (s.seg) {
      const seg = s.seg;
      seg.t = Math.min(1, seg.t + (dt * 1000) / seg.ms);
      const e = seg.kick ? seg.t : MathUtils.smoothstep(seg.t, 0, 1);
      s.pos.x = MathUtils.lerp(seg.from.x, seg.to[0], e);
      s.pos.z = MathUtils.lerp(seg.from.z, seg.to[1], e);
      y = Math.sin(seg.t * Math.PI) * seg.h;
      if (seg.kick) spin = seg.t * Math.PI * 4;
      if (seg.t >= 1) {
        s.seg = null;
        if (seg.i !== undefined) sound.hop(seg.i);
        if (seg.last && prog === FINISH) sound.neigh();
      }
    }
    g.position.set(s.pos.x, BOARD_Y + y + (hover && selectable ? 0.18 : 0), s.pos.z);
    g.rotation.y = MathUtils.lerp(g.rotation.y, s.face, 1 - Math.exp(-10 * dt)) + spin;
  });

  return (
    <group
      ref={ref}
      onClick={selectable ? (e) => (e.stopPropagation(), onPick(h)) : undefined}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
        if (selectable) document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHover(false);
        document.body.style.cursor = "";
      }}
    >
      <HorseModel color={COLOR_HEX[c]} glow={selectable ? 0.35 + (hover ? 0.3 : 0) : active ? 0.05 : 0} />
      {selectable && <SelectRing />}
    </group>
  );
}

function SelectRing() {
  const ref = React.useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.z = clock.elapsedTime * 2;
    const k = 1 + Math.sin(clock.elapsedTime * 6) * 0.08;
    ref.current.scale.set(k, k, k);
  });
  return (
    <mesh ref={ref} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.36, 0.46, 32, 1, 0, Math.PI * 1.6]} />
      <meshBasicMaterial color="#ffd36a" toneMapped={false} />
    </mesh>
  );
}

/* ---------- dé ---------- */

const DIE = 0.62; // arête
const H = DIE / 2;
// Normale de chaque face et ses deux axes dans le plan de la face. Faces opposées : 1-6, 2-5, 3-4.
const FACE_AXES = {
  1: [[0, 1, 0], [1, 0, 0], [0, 0, 1]],
  6: [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
  2: [[1, 0, 0], [0, 0, 1], [0, 1, 0]],
  5: [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
  3: [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
  4: [[0, 0, -1], [1, 0, 0], [0, 1, 0]],
};
const PIPS = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};
// Rotation qui amène la face v vers le haut (+y).
const UP = new Vector3(0, 1, 0);
const faceUp = (v) => new Quaternion().setFromUnitVectors(new Vector3(...FACE_AXES[v][0]), UP);

function DieBody() {
  const pips = [];
  for (let v = 1; v <= 6; v++) {
    const [n, u, w] = FACE_AXES[v].map((a) => new Vector3(...a));
    PIPS[v].forEach(([i, j], k) => {
      const p = n.clone().multiplyScalar(H + 0.002).addScaledVector(u, i * 0.16).addScaledVector(w, j * 0.16);
      const q = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), n);
      pips.push(
        <mesh key={v + "-" + k} position={p.toArray()} quaternion={q}>
          <circleGeometry args={[v === 1 ? 0.075 : 0.052, 24]} />
          <meshStandardMaterial color={v === 1 ? "#b3121f" : "#161616"} roughness={0.5} polygonOffset polygonOffsetFactor={-2} />
        </mesh>,
      );
    });
  }
  return (
    <group>
      <RoundedBox args={[DIE, DIE, DIE]} radius={0.09} smoothness={4} castShadow>
        <meshPhysicalMaterial color="#fbf8ef" roughness={0.25} clearcoat={0.8} clearcoatRoughness={0.2} />
      </RoundedBox>
      {pips}
    </group>
  );
}

/**
 * Lancer « à rebours » : on part de l'orientation finale (face tirée en haut) et on lui ajoute
 * une rotation autour de l'axe de roulement qui décroît jusqu'à zéro. Le dé roule donc
 * réellement dans le sens de son déplacement et finit pile sur la bonne face, sans recalage.
 */
function Die({ die, at }) {
  const ref = React.useRef();
  const st = React.useRef({ seq: null, t: 1, landed: true });
  useFrame((_s, dt) => {
    const s = st.current;
    const m = ref.current;
    if (!m || !die) return;
    if (s.seq !== die.seq) {
      s.seq = die.seq;
      s.t = 0;
      s.landed = false;
      s.bounced = 0;
      const end = new Vector3(at[0], 0, at[1]);
      const dir = new Vector3(-at[0], 0, -at[1]).normalize();
      if (!Number.isFinite(dir.x)) dir.set(0, 0, -1);
      // départ décalé vers le centre du plateau, avec un léger angle aléatoire
      dir.applyAxisAngle(UP, (Math.random() - 0.5) * 0.8);
      s.from = end.clone().addScaledVector(dir, 3.2);
      s.to = end;
      s.axis = new Vector3().crossVectors(UP, dir.clone().negate()).normalize();
      s.turns = (5 + Math.floor(Math.random() * 3)) * (Math.PI / 2); // multiple de quart de tour
      s.wobble = new Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
      const yaw = new Quaternion().setFromAxisAngle(UP, Math.round(Math.random() * 4) * (Math.PI / 2) + (Math.random() - 0.5) * 0.5);
      s.qEnd = yaw.multiply(faceUp(die.v));
      sound.dice();
    }
    s.t = Math.min(1, s.t + (dt * 1000) / (ROLL_MS * 0.9));
    const k = s.t;
    const ease = 1 - Math.pow(1 - k, 3); // ralentit en fin de course
    m.position.lerpVectors(s.from, s.to, ease);
    // trois rebonds de plus en plus petits
    const b = [[0, 0.38, 1.1], [0.38, 0.68, 0.45], [0.68, 0.88, 0.14]];
    let y = 0;
    for (const [a0, a1, hgt] of b) if (k >= a0 && k < a1) y = Math.sin(((k - a0) / (a1 - a0)) * Math.PI) * hgt;
    m.position.y = H + y;
    const bounceIdx = b.findIndex(([, a1]) => k < a1);
    if (bounceIdx > s.bounced) {
      s.bounced = bounceIdx;
      sound.diceLand();
    }
    const left = s.turns * (1 - ease);
    const wob = Math.sin(k * Math.PI * 3) * (1 - k) * 0.35;
    const q = new Quaternion().setFromAxisAngle(s.axis, -left);
    q.multiply(new Quaternion().setFromAxisAngle(s.wobble, wob));
    m.quaternion.copy(q.multiply(s.qEnd));
    if (k >= 1 && !s.landed) {
      s.landed = true;
      m.quaternion.copy(s.qEnd);
      sound.diceLand();
      if (die.v === 6) sound.six();
    }
  });
  if (!die) return null;
  return (
    <group ref={ref} position={[at[0], H, at[1]]}>
      <DieBody />
    </group>
  );
}

/* ---------- joueurs, caméra, lumières ---------- */

// coin de chaque couleur (pour le Mii, l'étiquette et le dé)
const CORNER = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

function Player({ p, colorIdx, active, winner }) {
  const mii = useRoomMii(p);
  const [cx, cz] = CORNER[colorIdx];
  const x = cx * 7.2;
  const z = cz * 7.2;
  const body = React.useRef();
  useFrame(({ clock }) => {
    if (body.current) body.current.position.y = (active ? Math.abs(Math.sin(clock.elapsedTime * 4)) * 0.2 : 0) + (winner ? Math.abs(Math.sin(clock.elapsedTime * 7)) * 0.5 : 0);
  });
  return (
    <group position={[x, -0.5, z]}>
      <group ref={body}>
        <MiiAvatar mii={mii} walk={winner} rotation={[0, Math.atan2(-x, -z), 0]} scale={1.7} />
      </group>
    </group>
  );
}

function Rig({ focus }) {
  const { camera, size } = useThree();
  const look = React.useRef(new Vector3());
  useFrame((_s, dt) => {
    const aspect = size.width / size.height;
    const f = MathUtils.clamp(1.5 / aspect, 1, 1.9);
    const k = 1 - Math.exp(-1.6 * dt);
    const tx = focus[0] * 0.35;
    const tz = 14 * f + focus[1] * 0.25;
    camera.position.x += (tx - camera.position.x) * k;
    camera.position.y += (14.5 * f - camera.position.y) * k;
    camera.position.z += (tz - camera.position.z) * k;
    look.current.lerp(new Vector3(focus[0] * 0.4, 0, focus[1] * 0.4 + 0.6), k);
    camera.lookAt(look.current);
  });
  return null;
}

function Plate({ p, active, choosing }) {
  const home = p.horses.filter((x) => x === FINISH).length;
  return (
    <div className={`hc-plate ${active ? "turn" : ""}`} style={{ "--c": COLOR_HEX[p.color] }}>
      <b>
        {p.bot ? "🤖 " : ""}
        {p.name}
      </b>
      <span>
        {"🐴".repeat(home)}
        {home}/4 arrivés
      </span>
      {active && choosing && <em>choisit un cheval…</em>}
    </div>
  );
}

export function HorsesScene({ state, meId, onPick }) {
  const turnP = state.players.find((p) => p.id === state.turnId);
  const turnColor = turnP ? COLORS.indexOf(turnP.color) : 0;
  const canPick = state.stage === "choose" && state.turnId === meId;
  const anim = state.anim;

  // point suivi par la caméra : le cheval en mouvement, sinon le coin du joueur actif
  let focus = [CORNER[turnColor][0] * 2.5, CORNER[turnColor][1] * 2.5];
  if (anim && state.stage === "moving") {
    const mover = state.players.find((p) => p.id === anim.id);
    if (mover) focus = toWorld(cellOf(COLORS.indexOf(mover.color), anim.to, anim.horse));
  }
  const dieAt = [CORNER[turnColor][0] * 0.5, CORNER[turnColor][1] * 0.5];
  const winner = state.phase === "end" ? state.winner : null;

  React.useEffect(() => {
    if (anim?.kicked) sound.capture();
  }, [anim?.seq]);

  return (
    <Canvas shadows dpr={[1, 2]} camera={{ fov: 40, near: 0.1, far: 120, position: [0, 14, 13] }} gl={{ antialias: true, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.05 }}>
      <color attach="background" args={["#0b0907"]} />
      <fog attach="fog" args={["#0b0907", 30, 60]} />
      <ambientLight intensity={0.7} />
      <hemisphereLight args={["#fff3dc", "#2a1a10", 0.5]} />
      <directionalLight position={[6, 16, 8]} intensity={2.3} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-10} shadow-camera-right={10} shadow-camera-top={10} shadow-camera-bottom={-10} shadow-bias={-4e-4} />
      <Rig focus={focus} />
      <Board />
      {state.players.map((p) => {
        const ci = COLORS.indexOf(p.color);
        const mine = anim && anim.id === p.id;
        return (
          <group key={p.id}>
            {p.horses.map((prog, h) => (
              <Horse
                key={h}
                colorIdx={ci}
                h={h}
                prog={prog}
                anim={anim ? { ...anim, mine: mine && anim.horse === h } : null}
                kicked={anim?.kicked && anim.kicked.id === p.id && anim.kicked.horse === h}
                selectable={canPick && p.id === meId && state.choices.includes(h)}
                active={state.turnId === p.id}
                onPick={onPick}
              />
            ))}
            <Player p={p} colorIdx={ci} active={state.turnId === p.id} winner={winner === p.id} />
            <Html position={[CORNER[ci][0] * 7.2, 0, CORNER[ci][1] * 7.2 + 0.9]} center zIndexRange={[20, 0]}>
              <Plate p={p} active={state.turnId === p.id} choosing={state.stage === "choose"} />
            </Html>
          </group>
        );
      })}
      {state.phase === "playing" && <Die die={state.die} at={dieAt} />}
      {winner && <Sparkles count={90} scale={[12, 5, 12]} position={[0, 2.5, 0]} size={6} speed={0.6} color="#f2b705" />}
    </Canvas>
  );
}


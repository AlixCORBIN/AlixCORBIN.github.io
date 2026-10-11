// Scène 3D du Buckshot : salle sombre, néons, table ronde, fusil animé, Mii des joueurs.
// Toutes les animations suivent l'événement en cours (state.event) et sa chronologie (layout.js).
import { Html } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import React from "react";
import { ACESFilmicToneMapping, Color, Euler, Fog, Object3D, Quaternion, Vector3 } from "three";
import { useRoomMii } from "../../../lib/mii.js";
import { MiiAvatar } from "../../../ui/MiiAvatar.jsx";
import { GunModel, MUZZLE_Z } from "./Gun.jsx";
import { ItemModel, Shell } from "./Models.jsx";
import { ADRENALINE_LEAD, CAM, ITEM, SEAT_R, SHOT, TABLE_R, TABLE_Y, at, clamp01, ease, seatOf, shownHp, slotPos, spentPos, useEventTime } from "./layout.js";

const Ctx = React.createContext(null);
const useCtx = () => React.useContext(Ctx);

const REST_P = new Vector3(0, TABLE_Y + 0.07, 0.05);
const REST_Q = new Quaternion().setFromEuler(new Euler(0, Math.PI / 2, Math.PI / 2));
const RAISE_P = new Vector3(0, TABLE_Y + 0.42, 0.05);
const v3 = (a) => new Vector3(a[0], a[1], a[2]);
const bump = (t, a, d) => (t >= a && t < a + d ? Math.sin(((t - a) / d) * Math.PI) : 0);

export function BuckshotScene({ state, meId }) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ fov: 52, position: [CAM.x, CAM.y, CAM.z], near: 0.05, far: 60 }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.1;
        scene.background = new Color("#040507");
        scene.fog = new Fog("#040507", 8, 19);
      }}
    >
      <World state={state} meId={meId} />
    </Canvas>
  );
}

function World({ state, meId }) {
  const n = state.players.length;
  const meIdx = Math.max(0, state.players.findIndex((p) => p.id === meId));
  const seats = React.useMemo(() => {
    const m = {};
    state.players.forEach((p, i) => (m[p.id] = seatOf((i - meIdx + n) % n, n)));
    return m;
  }, [state.players.map((p) => p.id).join(), meIdx]);
  const clock = React.useRef({ id: null, t0: 0 });
  const evId = state.event?.id ?? null;
  if (evId !== clock.current.id) clock.current = { id: evId, t0: performance.now() };
  const T = React.useCallback(() => (clock.current.id === null ? 1e9 : performance.now() - clock.current.t0), []);
  const ctx = { state, meId, seats, T };
  const playing = state.phase !== "lobby";
  return (
    <Ctx.Provider value={ctx}>
      <Lights />
      <Room />
      <Table />
      <Rig />
      {state.players.map((p) => (
        <Seat key={p.id} p={p} s={seats[p.id]} isMe={p.id === meId} />
      ))}
      {playing && (
        <>
          <Trays />
          <Deal />
          <Cuffs />
          <ShellRow />
          <Spent />
          <Flights />
          {state.players.filter((p) => p.alive).length >= 3 && <DirRing dir={state.dir} />}
        </>
      )}
      <GunRig />
    </Ctx.Provider>
  );
}

/* ---------- ambiance ---------- */

function Lights() {
  const spot = React.useRef();
  const bulb = React.useRef();
  const flick = React.useRef({ until: 0, next: 4 });
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const f = flick.current;
    if (t > f.next) {
      f.until = t + 0.08 + Math.random() * 0.25;
      f.next = t + 5 + Math.random() * 9;
    }
    const k = t < f.until ? 0.25 + Math.random() * 0.5 : 1;
    if (spot.current) spot.current.intensity = 75 * k;
    if (bulb.current) bulb.current.emissiveIntensity = 4 * k;
  });
  return (
    <>
      <hemisphereLight args={["#3a4a66", "#050505", 0.35]} />
      <spotLight ref={spot} position={[0, 4.35, 0.15]} angle={0.68} penumbra={0.6} intensity={75} distance={14} decay={1.6} color="#ffe0b0" castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0005} />
      <pointLight position={[0, 2.5, 0]} intensity={3.2} distance={6} decay={1.4} color="#ffcf9a" />
      {/* lampe suspendue */}
      <group position={[0, 4.45, 0.15]}>
        <mesh position={[0, 1.6, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 3, 6]} />
          <meshStandardMaterial color="#111" />
        </mesh>
        <mesh>
          <cylinderGeometry args={[0.12, 0.55, 0.38, 32, 1, true]} />
          <meshStandardMaterial color="#1c1f1c" metalness={0.6} roughness={0.5} side={2} />
        </mesh>
        <mesh ref={bulb} position={[0, -0.1, 0]}>
          <sphereGeometry args={[0.09, 16, 12]} />
          <meshStandardMaterial color="#fff2d0" emissive="#ffdca0" emissiveIntensity={4} toneMapped={false} />
        </mesh>
      </group>
    </>
  );
}

function Neon({ position, size, color, rotation }) {
  return (
    <mesh position={position} rotation={rotation}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3.2} toneMapped={false} />
    </mesh>
  );
}

function Room() {
  const pink = "#ff2a6d";
  const cyan = "#29e3ff";
  const wall = { color: "#101215", roughness: 1 };
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#0c0d0f" roughness={0.95} />
      </mesh>
      <mesh position={[0, 3.5, -6.6]}>
        <boxGeometry args={[14, 7, 0.2]} />
        <meshStandardMaterial {...wall} />
      </mesh>
      <mesh position={[-6.6, 3.5, 0]}>
        <boxGeometry args={[0.2, 7, 14]} />
        <meshStandardMaterial {...wall} />
      </mesh>
      <mesh position={[6.6, 3.5, 0]}>
        <boxGeometry args={[0.2, 7, 14]} />
        <meshStandardMaterial {...wall} />
      </mesh>
      {/* enseigne au néon : cadre + deux cartouches */}
      <group position={[0, 3.6, -6.45]}>
        <Neon position={[0, 0.75, 0]} size={[3.6, 0.05, 0.05]} color={pink} />
        <Neon position={[0, -0.75, 0]} size={[3.6, 0.05, 0.05]} color={pink} />
        <Neon position={[-1.8, 0, 0]} size={[0.05, 1.55, 0.05]} color={pink} />
        <Neon position={[1.8, 0, 0]} size={[0.05, 1.55, 0.05]} color={pink} />
        <Neon position={[-0.55, 0.05, 0]} size={[0.9, 0.24, 0.05]} color="#ff3040" />
        <Neon position={[-1.1, 0.05, 0]} size={[0.18, 0.3, 0.05]} color="#ffc04a" />
        <Neon position={[0.65, -0.05, 0]} size={[0.9, 0.24, 0.05]} color={cyan} />
        <Neon position={[0.1, -0.05, 0]} size={[0.18, 0.3, 0.05]} color="#ffc04a" />
      </group>
      <pointLight position={[0, 3.6, -5.6]} intensity={9} distance={10} decay={1.5} color={pink} />
      {/* tubes cyan sur le mur gauche */}
      <Neon position={[-6.45, 2.4, -2.2]} size={[0.05, 2.6, 0.05]} color={cyan} />
      <Neon position={[-6.45, 2.4, -1.6]} size={[0.05, 2.6, 0.05]} color={cyan} />
      <pointLight position={[-5.6, 2.4, -1.9]} intensity={5} distance={8} decay={1.5} color={cyan} />
      {/* tube rouge à droite */}
      <Neon position={[6.45, 4.2, -1]} size={[0.05, 0.05, 3]} color="#ff3040" />
      <pointLight position={[5.7, 4, -1]} intensity={3} distance={7} decay={1.5} color="#ff3040" />
      {/* caisses dans les coins */}
      {[[-5.2, -5.1, 1.2], [5.0, -5.3, 1.0], [-5.4, 4.6, 1.1]].map(([x, z, s], i) => (
        <mesh key={i} position={[x, s / 2, z]} rotation={[0, i, 0]} castShadow receiveShadow>
          <boxGeometry args={[s, s, s]} />
          <meshStandardMaterial color="#1a1612" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function Table() {
  return (
    <group>
      <mesh position={[0, TABLE_Y - 0.06, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[TABLE_R, TABLE_R, 0.12, 72]} />
        <meshStandardMaterial color="#1e2b23" roughness={0.93} />
      </mesh>
      <mesh position={[0, TABLE_Y - 0.03, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[TABLE_R, 0.07, 12, 72]} />
        <meshStandardMaterial color="#2b1a10" roughness={0.55} />
      </mesh>
      <mesh position={[0, TABLE_Y + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.95, 0.97, 64]} />
        <meshBasicMaterial color="#3b4c40" />
      </mesh>
      <mesh position={[0, TABLE_Y / 2, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.3, TABLE_Y, 16]} />
        <meshStandardMaterial color="#15100c" />
      </mesh>
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <cylinderGeometry args={[0.8, 0.9, 0.06, 32]} />
        <meshStandardMaterial color="#15100c" />
      </mesh>
    </group>
  );
}

// Caméra à la place du joueur ; secousse sur les tirs réels.
function Rig() {
  const { camera, size } = useThree();
  const { state, meId, T } = useCtx();
  useFrame(({ clock }) => {
    const ev = state.event;
    const t = T();
    let amp = 0;
    if (ev?.type === "shot" && ev.live && t >= SHOT.fire && t < SHOT.fire + 800) amp = (ev.target === meId ? 0.26 : 0.1) * Math.exp(-(t - SHOT.fire) / 170);
    const aspect = size.width / size.height;
    const f = aspect < 0.8 ? 1.55 : aspect < 1.25 ? 1.2 : 1;
    const e = clock.elapsedTime;
    camera.position.set(
      CAM.x + (Math.random() - 0.5) * amp + Math.sin(e * 0.45) * 0.03,
      CAM.y + (f - 1) * 1.3 + (Math.random() - 0.5) * amp + Math.sin(e * 0.8) * 0.015,
      CAM.z * f,
    );
    camera.lookAt(0, 1.5, -0.9);
    const fov = aspect < 0.8 ? 64 : 52;
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}

/* ---------- joueurs ---------- */

function Seat({ p, s, isMe }) {
  const { state, T } = useCtx();
  const mii = useRoomMii(p);
  const body = React.useRef();
  const [x, , z] = at(s, SEAT_R, 0);
  useFrame((_s, dt) => {
    if (!body.current) return;
    const ev = state.event;
    const t = T();
    let tilt = null;
    if (ev?.type === "shot" && ev.live && ev.target === p.id && t >= SHOT.fire) {
      const k = (t - SHOT.fire) / 1000;
      tilt = p.hp - ev.dmg <= 0 ? -1.45 * ease(k * 1.6) : -0.6 * Math.exp(-k * 4) * Math.min(1, k * 25);
    } else if (ev?.type === "item" && ev.item === "medicament" && ev.by === p.id && !ev.lucky && p.hp <= 1 && t >= 1500) {
      tilt = -1.45 * ease((t - 1500) / 700);
    }
    const target = tilt ?? (p.alive || state.phase === "lobby" ? 0 : -1.45);
    const r = body.current.rotation;
    r.x = tilt !== null ? tilt : r.x + (target - r.x) * Math.min(1, dt * 3);
  });
  return (
    <group position={[x, 0, z]} rotation={[0, Math.atan2(-x, -z), 0]}>
      {!isMe && (
        <group ref={body}>
          <MiiAvatar mii={mii} scale={1.32} eyesClosed={!p.alive && state.phase !== "lobby"} />
        </group>
      )}
      {!isMe && (
        <Html position={[0, 2.78, 0]} center zIndexRange={[20, 0]}>
          <Tag p={p} ev={state.event} turn={state.turn === p.id && state.phase === "playing"} lobby={state.phase === "lobby"} />
        </Html>
      )}
      {state.phase !== "lobby" && <Monitor p={p} />}
    </group>
  );
}

function Tag({ p, ev, turn, lobby }) {
  const t = useEventTime(ev);
  const hp = shownHp(p, ev, t);
  return (
    <div className={"bs-tag" + (turn ? " turn" : "") + (!p.alive && !lobby ? " dead" : "")}>
      <b>{p.name}</b>
      {!lobby && (
        <span className={"bs-bolts" + (p.cut ? " cut" : "")}>
          {Array.from({ length: p.maxHp }, (_, i) => (
            <i key={i} className={i < hp ? "on" : ""} />
          ))}
        </span>
      )}
      {!lobby && (
        <small>
          {!p.alive ? "☠ hors jeu" : `${p.items.length} objet${p.items.length > 1 ? "s" : ""}`}
          {p.cuffed ? " · ⛓" : ""}
          {p.wins ? ` · ${"★".repeat(p.wins)}` : ""}
        </small>
      )}
    </div>
  );
}

// Moniteur du défibrillateur posé au bord de la table, tourné vers son joueur.
function Monitor({ p }) {
  const { state, T } = useCtx();
  const bars = React.useRef([]);
  const dot = React.useRef();
  const green = React.useMemo(() => new Color("#3dff7a"), []);
  const red = React.useMemo(() => new Color("#ff3b3b"), []);
  const off = React.useMemo(() => new Color("#0d1a12"), []);
  useFrame(({ clock }) => {
    const ev = state.event;
    const t = T();
    let hp = shownHp(p, ev, t);
    if (ev?.type === "round") hp = Math.min(p.hp, Math.max(0, Math.floor((t - 900) / 260)));
    const col = p.cut ? red : green;
    bars.current.forEach((m, i) => {
      if (!m) return;
      const on = i < hp;
      m.color.copy(on ? col : off);
      m.emissive.copy(on ? col : off);
      m.emissiveIntensity = on ? 1.6 : 0.1;
    });
    if (dot.current) {
      const beat = (clock.elapsedTime * (p.alive ? 1.1 : 0)) % 1;
      dot.current.emissiveIntensity = p.alive && beat < 0.12 ? 3 : 0.15;
    }
  });
  const w = 0.07;
  return (
    <group position={[1.15, TABLE_Y + 0.12, SEAT_R - 2.0]} rotation={[0.35, Math.PI, 0]} scale={0.7}>
      <mesh castShadow>
        <boxGeometry args={[0.55, 0.32, 0.14]} />
        <meshStandardMaterial color="#1b1d1f" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.01, 0.071]}>
        <planeGeometry args={[0.48, 0.24]} />
        <meshStandardMaterial color="#030806" />
      </mesh>
      {Array.from({ length: p.maxHp || 0 }, (_, i) => (
        <mesh key={i} position={[-0.2 + i * w, -0.01, 0.073]}>
          <planeGeometry args={[0.05, 0.14]} />
          <meshStandardMaterial ref={(m) => (bars.current[i] = m)} color="#0d1a12" toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[0.2, 0.08, 0.073]}>
        <circleGeometry args={[0.014, 10]} />
        <meshStandardMaterial ref={dot} color="#ff4444" emissive="#ff3030" toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ---------- objets sur la table ---------- */

function hiddenSlots(ev) {
  const h = {};
  if (ev?.type === "item") {
    h[ev.by + ":" + ev.idx] = true;
    if (ev.item === "adrenaline") h[ev.target + ":" + ev.steal] = true;
  }
  return h;
}

function Trays() {
  const { state, seats } = useCtx();
  const hidden = hiddenSlots(state.event);
  return state.players.map((p) =>
    p.items.map((it, k) =>
      hidden[p.id + ":" + k] ? null : (
        <group key={p.id + k + it} position={slotPos(seats[p.id], k)} rotation={[0, seats[p.id].a, 0]}>
          <ItemModel id={it} />
        </group>
      ),
    ),
  );
}

function Deal() {
  const { state, seats } = useCtx();
  const ev = state.event;
  if (ev?.type !== "deal") return null;
  return Object.entries(ev.gifts).flatMap(([pid, list]) => {
    const p = state.players.find((x) => x.id === pid);
    if (!p) return [];
    return list.map((it, k) => <Falling key={pid + k} pos={slotPos(seats[pid], p.items.length + k)} rot={seats[pid].a} id={it} start={300 + k * 380} />);
  });
}

function Falling({ pos, rot, id, start }) {
  const { T } = useCtx();
  const g = React.useRef();
  useFrame(() => {
    const t = T() - start;
    if (!g.current) return;
    g.current.visible = t > 0;
    const k = clamp01(t / 420);
    const h = k < 1 ? (1 - k * k) * 1.1 : Math.abs(Math.sin(clamp01((t - 420) / 220) * Math.PI)) * 0.06;
    g.current.position.set(pos[0], pos[1] + h, pos[2]);
    g.current.rotation.set(0, rot + (1 - k) * 3, 0);
  });
  return (
    <group ref={g} visible={false}>
      <ItemModel id={id} />
    </group>
  );
}

function Cuffs() {
  const { state, seats, T } = useCtx();
  const ev = state.event;
  const list = state.players.filter((p) => (p.cuffed && p.alive) || (ev?.type === "skip" && ev.who === p.id));
  return list.map((p) => <CuffSet key={p.id} s={seats[p.id]} skipping={ev?.type === "skip" && ev.who === p.id} T={T} />);
}

function CuffSet({ s, skipping, T }) {
  const g = React.useRef();
  const pos = at(s, 1.97, TABLE_Y + 0.02);
  useFrame(() => {
    if (!g.current) return;
    const t = skipping ? T() : 0;
    const shake = skipping && t < 1600 ? Math.sin(t / 25) * 0.04 : 0;
    const k = skipping ? 1 - clamp01((t - 1800) / 600) : 1;
    g.current.position.set(pos[0] - s.tx * 0.75 + shake, pos[1] + (skipping ? Math.abs(shake) * 2 : 0), pos[2] - s.tz * 0.75);
    g.current.scale.setScalar(Math.max(0.001, k * 1.5));
  });
  return (
    <group ref={g} rotation={[0, s.a, 0]}>
      <ItemModel id="menottes" glow={0.6} />
    </group>
  );
}

// Cartouches montrées avant le chargement, puis glissées une à une dans le fusil.
function ShellRow() {
  const { state } = useCtx();
  const ev = state.event;
  const info = state.loadInfo;
  if (!info || (ev?.type !== "show" && ev?.type !== "load")) return null;
  const n = info.live + info.blank;
  return Array.from({ length: n }, (_, i) => <RowShell key={ev.id + ":" + i} i={i} n={n} live={i < info.live} mode={ev.type} />);
}

function RowShell({ i, n, live, mode }) {
  const { T } = useCtx();
  const g = React.useRef();
  const x = (i - (n - 1) / 2) * 0.2;
  useFrame(() => {
    if (!g.current) return;
    const t = T();
    if (mode === "show") {
      const k = clamp01((t - (300 + i * 260)) / 220);
      g.current.visible = k > 0;
      g.current.position.set(x, TABLE_Y + 0.035 + (1 - k) * 0.35, 0.6);
      g.current.scale.setScalar(1.3);
    } else {
      const step = 2500 / n;
      const k = ease((t - (250 + i * step)) / (step * 0.8));
      g.current.position.set(x * (1 - k), TABLE_Y + 0.035 + Math.sin(k * Math.PI) * 0.25 + k * 0.05, 0.6 * (1 - k) + 0.05 * k);
      g.current.scale.setScalar(1.3 * (1 - k * 0.9));
      g.current.visible = k < 0.98;
    }
  });
  return (
    <group ref={g} rotation={[0, Math.PI / 2, 0]}>
      <Shell live={live} />
    </group>
  );
}

function Spent() {
  const { state } = useCtx();
  return state.spent.map((live, i) => {
    const [x, y, z, r] = spentPos(i);
    return <Shell key={i} live={live} position={[x, y, z]} rotation={[0, r, 0]} />;
  });
}

function DirRing({ dir }) {
  const g = React.useRef();
  useFrame((_s, dt) => {
    if (g.current) g.current.rotation.y -= dir * dt * 0.35;
  });
  return (
    <group ref={g} position={[0, TABLE_Y + 0.02, 0]}>
      {[0, 1, 2].map((i) => (
        <group key={i} rotation={[0, (i * Math.PI * 2) / 3, 0]}>
          <mesh position={[0, 0, TABLE_R - 0.12]} rotation={[0, 0, dir > 0 ? Math.PI / 2 : -Math.PI / 2]}>
            <coneGeometry args={[0.05, 0.14, 3]} />
            <meshStandardMaterial color="#ff2a6d" emissive="#ff2a6d" emissiveIntensity={1.4} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ---------- objets utilisés ---------- */

// Point d'arrivée de chaque objet : sur le fusil, vers la cible, ou vers le joueur lui-même.
function destOf(item, s, target) {
  switch (item) {
    case "loupe":
      return [0.05, TABLE_Y + 0.3, 0.18];
    case "scie":
      return [0.62, TABLE_Y + 0.2, 0.16];
    case "inverseur":
      return [0, TABLE_Y + 0.28, 0.2];
    case "menottes":
      return target ? at(target, 1.97, TABLE_Y + 0.35) : at(s, 1.6, 1.6);
    case "telecommande":
      return [0, TABLE_Y + 0.9, 0];
    case "adrenaline":
      return at(s, 2.3, 1.85);
    default:
      return at(s, 2.35, 2.15);
  }
}

function Flights() {
  const { state, seats } = useCtx();
  const ev = state.event;
  if (ev?.type !== "item") return null;
  const s = seats[ev.by];
  if (!s) return null;
  if (ev.item === "adrenaline") {
    const tg = seats[ev.target];
    return (
      <>
        <Flight key="a" id="adrenaline" from={slotPos(s, ev.idx)} use={at(s, 1.8, 1.6)} dest={destOf("adrenaline", s)} offset={0} scale={ADRENALINE_LEAD / ITEM.end} />
        <Flight key="b" id={ev.sub.item} from={slotPos(tg, ev.steal)} use={at(s, 1.8, 1.6)} dest={destOf(ev.sub.item, s, seats[ev.sub.target])} offset={ADRENALINE_LEAD} ev={ev.sub} />
      </>
    );
  }
  return <Flight id={ev.item} from={slotPos(s, ev.idx)} use={at(s, 1.8, 1.6)} dest={destOf(ev.item, s, seats[ev.target])} offset={0} ev={ev} />;
}

function Flight({ id, from, use, dest, offset, scale = 1, ev }) {
  const { T } = useCtx();
  const g = React.useRef();
  const A = React.useMemo(() => v3(from), [from.join()]);
  const B = React.useMemo(() => v3(use), [use.join()]);
  const C = React.useMemo(() => v3(dest), [dest.join()]);
  const tmp = React.useMemo(() => new Vector3(), []);
  useFrame(({ clock }) => {
    if (!g.current) return;
    const t = (T() - offset) / scale;
    g.current.visible = t >= 0;
    if (t < 0) return;
    if (t < ITEM.rise) {
      const k = ease(t / ITEM.rise);
      tmp.lerpVectors(A, B, k);
      tmp.y += Math.sin(k * Math.PI) * 0.25;
    } else if (t < ITEM.go) {
      tmp.lerpVectors(B, C, ease((t - ITEM.rise) / (ITEM.go - ITEM.rise)));
    } else tmp.copy(C);
    const e = clock.elapsedTime;
    let rx = 0;
    let ry = t * 0.002;
    if (id === "biere" && t > ITEM.go) rx = -Math.min(1.2, (t - ITEM.go) / 300);
    if (id === "scie" && t > ITEM.fx && t < 1800) tmp.x += Math.sin(t / 35) * 0.05;
    if (id === "loupe" && t > ITEM.go) tmp.y += Math.sin(e * 3) * 0.02;
    g.current.position.copy(tmp);
    g.current.rotation.set(rx, ry, 0);
    const k = 1 - clamp01((t - ITEM.fade) / (ITEM.end - ITEM.fade));
    g.current.scale.setScalar(Math.max(0.001, 1.6 * k));
  });
  return (
    <>
      <group ref={g} visible={false}>
        <ItemModel id={id} glow={0.8} />
      </group>
      {id === "scie" && <Particles at={dest} offset={offset + ITEM.fx} dur={1100} color="#ffb347" count={18} spread={0.5} up={0.4} />}
      {id === "cigarettes" && <Particles at={dest} offset={offset + 900} dur={1500} color="#9aa0a6" count={14} spread={0.15} up={0.9} size={0.05} />}
      {id === "inverseur" && <Particles at={[0, TABLE_Y + 0.15, 0.05]} offset={offset + 900} dur={800} color="#b36cff" count={16} spread={0.7} up={0.3} />}
      {id === "medicament" && ev && <Particles at={dest} offset={offset + 1300} dur={900} color={ev.lucky ? "#3dff7a" : "#ff3b3b"} count={12} spread={0.4} up={0.5} />}
    </>
  );
}

// Particules simples (étincelles, fumée) : trajectoires déterministes, pas d'état.
function Particles({ at: p, offset, dur, color, count, spread, up, size = 0.02 }) {
  const { T } = useCtx();
  const refs = React.useRef([]);
  const seeds = React.useMemo(() => Array.from({ length: count }, (_, i) => [Math.sin(i * 12.9898) * 0.5, Math.cos(i * 78.233) * 0.5, ((i * 37) % 100) / 100]), [count]);
  useFrame(() => {
    const t = T() - offset;
    refs.current.forEach((m, i) => {
      if (!m) return;
      const [a, b, c] = seeds[i];
      const local = (t - c * dur * 0.5) / (dur * 0.6);
      m.visible = local > 0 && local < 1;
      if (!m.visible) return;
      m.position.set(p[0] + a * spread * local, p[1] + up * local + c * 0.05, p[2] + b * spread * local);
      m.scale.setScalar(1 - local * 0.6);
    });
  });
  return seeds.map((_, i) => (
    <mesh key={i} ref={(m) => (refs.current[i] = m)} visible={false}>
      <sphereGeometry args={[size, 6, 4]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} toneMapped={false} transparent opacity={0.85} />
    </mesh>
  ));
}

/* ---------- le fusil ---------- */

function GunRig() {
  const { state, meId, seats, T } = useCtx();
  const g = React.useRef();
  const parts = React.useRef();
  const glow = React.useRef();
  const flash = React.useRef();
  const flashMesh = React.useRef();
  const smoke = React.useRef();
  const casing = React.useRef();
  const caseLive = React.useRef();
  const caseBlank = React.useRef();
  const tmp = React.useMemo(() => ({ o: new Object3D(), P: new Vector3(), Q: new Quaternion(), m: new Vector3(), port: new Vector3(), land: new Vector3() }), []);

  const hold = (byId, targetId) => {
    const s = seats[byId];
    const tg = seats[targetId];
    const self = byId === targetId;
    const o = tmp.o;
    o.position.set(...(self ? at(s, 1.5, 2.0) : at(s, 2.15, 1.72)));
    if (targetId === meId) o.lookAt(CAM.x, CAM.y - 0.08, CAM.z);
    else o.lookAt(...at(tg, SEAT_R, 2.2));
    return { p: o.position.clone(), q: o.quaternion.clone() };
  };

  useFrame(() => {
    if (!g.current || !parts.current) return;
    const ev = state.event;
    const t = T();
    const P = tmp.P.copy(REST_P);
    const Q = tmp.Q.copy(REST_Q);
    let pump = 0;
    let kick = 0;
    let flashK = 0;
    let smokeK = 0;
    let eject = null; // { t0, t1, live }
    let sawed = state.saw;
    let glowK = 0;
    const beer = ev?.type === "item" && (ev.item === "biere" || ev.sub?.item === "biere");
    const itemT = ev?.type === "item" ? (ev.item === "adrenaline" ? t - ADRENALINE_LEAD : t) : 0;
    const itemId = ev?.type === "item" ? (ev.item === "adrenaline" ? ev.sub.item : ev.item) : null;

    if (ev?.type === "shot" && seats[ev.by] && seats[ev.target]) {
      sawed = ev.saw;
      const h = hold(ev.by, ev.target);
      if (t >= SHOT.lift && t < SHOT.aim) {
        const k = ease((t - SHOT.lift) / (SHOT.aim - SHOT.lift));
        P.lerpVectors(REST_P, h.p, k);
        P.y += Math.sin(k * Math.PI) * 0.4;
        Q.slerpQuaternions(REST_Q, h.q, k);
      } else if (t >= SHOT.aim && t < SHOT.back) {
        P.copy(h.p);
        Q.copy(h.q);
        if (t < SHOT.fire) P.y += Math.sin(t / 60) * 0.004;
        if (t >= SHOT.fire) kick = Math.exp(-(t - SHOT.fire) / 160) * (ev.live ? 1 : 0.18);
        pump = bump(t, SHOT.pump, 360);
        if (ev.live) flashK = t >= SHOT.fire && t < SHOT.fire + 110 ? 1 : 0;
        else smokeK = t >= SHOT.fire && t < SHOT.fire + 900 ? (t - SHOT.fire) / 900 : 0;
        eject = { t0: SHOT.eject, t1: SHOT.land, live: ev.live };
      } else if (t >= SHOT.back && t < SHOT.end) {
        const k = ease((t - SHOT.back) / (SHOT.end - SHOT.back));
        P.lerpVectors(h.p, REST_P, k);
        Q.slerpQuaternions(h.q, REST_Q, k);
        eject = { t0: SHOT.eject, t1: SHOT.land, live: ev.live };
      }
    } else if (beer) {
      const k = ease((itemT - 500) / 500) * (1 - ease((itemT - 2000) / 600));
      P.lerpVectors(REST_P, RAISE_P, k);
      pump = bump(itemT, 1200, 360);
      eject = { t0: 1350, t1: 1700, live: (ev.item === "biere" ? ev : ev.sub).live, base: ev.item === "adrenaline" ? ADRENALINE_LEAD : 0 };
    } else if (ev?.type === "load") {
      const k = ease((t - 2850) / 250) * (1 - ease((t - 3250) / 150));
      P.lerpVectors(REST_P, RAISE_P, k * 0.6);
      pump = bump(t, 2950, 360);
    }
    if (itemId === "scie" && itemT >= 1800) sawed = true;
    if (itemId === "inverseur") glowK = bump(itemT, 800, 900);

    g.current.position.copy(P);
    g.current.quaternion.copy(Q);
    if (kick) {
      g.current.rotateX(-kick * 0.5);
      g.current.translateZ(-kick * 0.14);
    }
    const parts_ = parts.current;
    if (parts_.pump) parts_.pump.position.z = 0.26 - pump * 0.13;
    if (parts_.barrel) parts_.barrel.scale.z = sawed ? 0.52 : 1;
    if (parts_.muzzle) parts_.muzzle.position.z = sawed ? MUZZLE_Z.sawed : MUZZLE_Z.full;
    if (glow.current) glow.current.emissiveIntensity = glowK * 2.5;

    // éclair de bouche / fumée
    parts_.muzzle?.getWorldPosition(tmp.m);
    if (flash.current) {
      flash.current.position.copy(tmp.m);
      flash.current.intensity = flashK * 90;
    }
    if (flashMesh.current) {
      flashMesh.current.position.copy(tmp.m);
      flashMesh.current.visible = flashK > 0;
      flashMesh.current.scale.setScalar(0.18 + Math.random() * 0.12);
    }
    if (smoke.current) {
      smoke.current.visible = smokeK > 0;
      smoke.current.position.copy(tmp.m);
      smoke.current.position.y += smokeK * 0.3;
      smoke.current.scale.setScalar(0.05 + smokeK * 0.15);
      smoke.current.material.opacity = 0.5 * (1 - smokeK);
    }

    // douille éjectée par la pompe
    if (casing.current) {
      const te = eject ? (eject.base ? t - eject.base : t) : -1;
      casing.current.visible = !!eject && te >= eject.t0;
      if (casing.current.visible) {
        if (caseLive.current) caseLive.current.visible = eject.live;
        if (caseBlank.current) caseBlank.current.visible = !eject.live;
        const k = clamp01((te - eject.t0) / (eject.t1 - eject.t0));
        const [lx, ly, lz, lr] = spentPos(state.spent.length);
        tmp.land.set(lx, ly, lz);
        if (k < 1) parts_.port?.getWorldPosition(tmp.port);
        casing.current.position.lerpVectors(k < 1 ? tmp.port : tmp.land, tmp.land, k < 1 ? ease(k) : 1);
        casing.current.position.y += Math.sin(k * Math.PI) * 0.45;
        casing.current.rotation.set(k * 9, lr + k * 4, 0);
        if (k >= 1) casing.current.rotation.set(0, lr, 0);
      }
    }
  });

  return (
    <>
      <group ref={g} scale={1.45}>
        <GunModel ref={parts} glowRef={glow} />
      </group>
      <pointLight ref={flash} intensity={0} distance={7} decay={1.5} color="#ffbb44" />
      <mesh ref={flashMesh} visible={false}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshBasicMaterial color="#ffd27a" toneMapped={false} />
      </mesh>
      <mesh ref={smoke} visible={false}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshStandardMaterial color="#888" transparent opacity={0.4} />
      </mesh>
      <group ref={casing} visible={false}>
        <group ref={caseLive}>
          <Shell live />
        </group>
        <group ref={caseBlank}>
          <Shell live={false} />
        </group>
      </group>
    </>
  );
}

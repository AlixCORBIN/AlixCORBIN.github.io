import { Html, Sparkles } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import React from "react";
import { ACESFilmicToneMapping, Color, MathUtils } from "three";
import { COLORS, COLOR_HEX } from "../cards.js";
import { Card3D } from "./Card3D.jsx";
import { feltTexture } from "./textures.js";

const DECK = { x: -1.55, z: 0.3 };
const PILE = { x: 1.35, z: 0.3 };
const PAWN = ["#d7263d", "#f2b705", "#2e9e4f", "#1f6fd1", "#b45fd6", "#ef7d22", "#2fb5b5", "#e86aa0", "#8bc34a", "#9e9e9e"];
const ORDER = { r: 0, y: 1, g: 2, b: 3, w: 4 };
const VALUE_ORDER = { skip: 10, rev: 11, d2: 12, wild: 13, wd4: 14 };

const sortHand = (hand) =>
  [...hand].sort(
    (a, b) =>
      ORDER[a.c] - ORDER[b.c] ||
      (VALUE_ORDER[a.v] ?? Number(a.v)) - (VALUE_ORDER[b.v] ?? Number(b.v)) ||
      a.id - b.id,
  );

const jitter = (id, salt) => (((id * 2654435761 + salt * 40503) >>> 0) % 1000) / 1000 - 0.5;

// En portrait, les sièges se resserrent pour rester dans l'écran.
function seatOf(i, meIdx, n, portrait) {
  const a = Math.PI / 2 + (((i - meIdx + n) % n) / n) * Math.PI * 2;
  return portrait ? { a, x: Math.cos(a) * 3.7, z: 1 + Math.sin(a) * 5.6 } : { a, x: Math.cos(a) * 7.4, z: Math.sin(a) * 4.9 };
}

const useAspect = () => {
  const get = () => (typeof window === "undefined" ? 1.6 : window.innerWidth / window.innerHeight);
  const [aspect, setAspect] = React.useState(get);
  React.useEffect(() => {
    const on = () => setAspect(get());
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return aspect;
};

function Rig() {
  const { camera, size } = useThree();
  useFrame((_s, dt) => {
    const aspect = size.width / size.height;
    const f = MathUtils.clamp(1.55 / aspect, 1, 1.7);
    const k = 1 - Math.exp(-3 * dt);
    camera.position.x += (0 - camera.position.x) * k;
    camera.position.y += (12.6 * f - camera.position.y) * k;
    camera.position.z += (11.6 * f - camera.position.z) * k;
    camera.lookAt(0, 0, 1.9);
  });
  return null;
}

function Ring({ color, dir }) {
  const spin = React.useRef();
  const mat = React.useRef();
  const target = React.useMemo(() => new Color(color), [color]);
  useFrame((_s, dt) => {
    if (spin.current) spin.current.rotation.y += dir * dt * 0.55;
    if (mat.current) {
      mat.current.color.lerp(target, 1 - Math.exp(-6 * dt));
      mat.current.emissive.lerp(target, 1 - Math.exp(-6 * dt));
    }
  });
  return (
    <group position={[0, 0.03, 0.3]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.55, 3.7, 96]} />
        <meshStandardMaterial ref={mat} color={color} emissive={color} emissiveIntensity={1.6} toneMapped={false} />
      </mesh>
      <group ref={spin}>
        {[0, 1, 2].map((i) => (
          <group key={i} rotation={[0, (i * Math.PI * 2) / 3, 0]}>
            <mesh position={[3.62, 0.02, 0]} rotation={[0, dir > 0 ? Math.PI : 0, -Math.PI / 2]}>
              <coneGeometry args={[0.28, 0.6, 3]} />
              <meshStandardMaterial color="#f4efe2" emissive="#f4efe2" emissiveIntensity={0.5} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

function Table() {
  const felt = React.useMemo(() => {
    const t = feltTexture();
    t.wrapS = t.wrapT = 1000;
    t.repeat.set(5, 5);
    return t;
  }, []);
  return (
    <group>
      <mesh position={[0, -0.4, 1]} receiveShadow>
        <cylinderGeometry args={[9.2, 9.6, 0.5, 96]} />
        <meshStandardMaterial color="#3a2415" roughness={0.55} />
      </mesh>
      <mesh position={[0, -0.075, 1]} receiveShadow>
        <cylinderGeometry args={[8.7, 8.7, 0.1, 96]} />
        <meshStandardMaterial map={felt} color="#e9fff3" roughness={0.95} />
      </mesh>
      <mesh position={[0, -0.012, 1]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[8.5, 8.68, 96]} />
        <meshBasicMaterial color="#e8c468" />
      </mesh>
      <mesh position={[0, -0.9, 1]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[40, 48]} />
        <meshStandardMaterial color="#0a0f12" roughness={1} />
      </mesh>
    </group>
  );
}

function Pawn({ index, active, x, z, winner }) {
  const ring = React.useRef();
  const body = React.useRef();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ring.current) {
      ring.current.rotation.z = t * 1.2;
      ring.current.material.opacity = active ? 0.7 + Math.sin(t * 5) * 0.25 : 0;
    }
    if (body.current) body.current.position.y = 0.75 + (active ? Math.abs(Math.sin(t * 4)) * 0.22 : 0) + (winner ? Math.abs(Math.sin(t * 7)) * 0.4 : 0);
  });
  const color = PAWN[index % PAWN.length];
  return (
    <group position={[x, 0, z]}>
      <mesh ref={ring} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.8, 0.95, 40]} />
        <meshBasicMaterial color="#ffd36a" transparent opacity={0} />
      </mesh>
      <group ref={body}>
        <mesh castShadow position={[0, 0, 0]}>
          <coneGeometry args={[0.5, 1.1, 24]} />
          <meshStandardMaterial color={color} roughness={0.4} />
        </mesh>
        <mesh castShadow position={[0, 0.78, 0]}>
          <sphereGeometry args={[0.34, 24, 24]} />
          <meshStandardMaterial color={color} roughness={0.35} />
        </mesh>
      </group>
    </group>
  );
}

function Plate({ p, active, risk, score, onCatch }) {
  return (
    <div className={`un-plate ${active ? "turn" : ""} ${p.uno ? "uno" : ""}`}>
      <b>
        {p.bot ? "🤖 " : ""}
        {p.name}
      </b>
      <span>
        {p.count} carte{p.count > 1 ? "s" : ""}
        {score ? ` · ${p.score} pts` : ""}
      </span>
      {p.uno && p.count === 1 && <em>UNO !</em>}
      {risk && (
        <button className="un-catch" onClick={onCatch}>
          Pas de UNO ! Attraper
        </button>
      )}
    </div>
  );
}

function Lights({ color }) {
  const light = React.useRef();
  const target = React.useMemo(() => new Color(color), [color]);
  useFrame((_s, dt) => {
    if (light.current) light.current.color.lerp(target, 1 - Math.exp(-5 * dt));
  });
  return (
    <>
      <color attach="background" args={["#05090c"]} />
      <fog attach="fog" args={["#05090c", 28, 60]} />
      <ambientLight intensity={0.75} />
      <hemisphereLight args={["#cfe8ff", "#10231a", 0.5]} />
      <directionalLight
        position={[5, 16, 9]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-4e-4}
      />
      <pointLight ref={light} position={[0, 3.2, 0.3]} intensity={26} distance={14} color={color} />
    </>
  );
}

export function UnoScene({ state, meId, onPlay, onDraw, onCatch }) {
  const [hover, setHover] = React.useState(null);
  const aspect = useAspect();
  const portrait = aspect < 1.1;
  const n = state.players.length;
  const meIdx = Math.max(0, state.players.findIndex((p) => p.id === meId));
  const me = state.players[meIdx];
  const playing = state.phase === "playing";
  const reveal = state.phase === "roundEnd" || state.phase === "end";
  const showTarget = state.settings.target > 0;
  const color = COLOR_HEX[state.color] || "#ffffff";
  const seats = state.players.map((_, i) => seatOf(i, meIdx, n, portrait));
  const deckSpawn = { x: DECK.x, y: 0.5, z: DECK.z, rx: 0, ry: 0, rz: Math.PI };

  const items = [];

  // Talon : quelques cartes empilées, la dernière est cliquable pour piocher.
  const deckVisible = Math.min(5, Math.ceil(state.deckCount / 12));
  for (let k = 0; k < deckVisible; k++) {
    const top = k === deckVisible - 1;
    items.push({
      key: "deck-" + k,
      card: null,
      target: { x: DECK.x, y: 0.02 + k * 0.045, z: DECK.z, rx: 0, ry: 0.06 * (k % 2), rz: Math.PI },
      onClick: top && playing && state.turn === meId && state.drawn == null && !state.challenge ? (e) => (e.stopPropagation(), onDraw()) : undefined,
      onOver: top && state.turn === meId ? () => (document.body.style.cursor = "pointer") : undefined,
      onOut: () => (document.body.style.cursor = ""),
      scale: 1.2,
    });
  }

  // Défausse : les dernières cartes, jetées avec un léger désordre.
  state.discard.forEach((c, j) => {
    const lastPlay = state.last && state.last.card.id === c.id ? state.last : null;
    const fromIdx = lastPlay ? state.players.findIndex((p) => p.id === lastPlay.id) : -1;
    const seat = fromIdx >= 0 && lastPlay.id !== meId ? seats[fromIdx] : null;
    items.push({
      key: "c" + c.id,
      card: c,
      target: {
        x: PILE.x + jitter(c.id, 1) * 0.5,
        y: 0.02 + j * 0.03,
        z: PILE.z + jitter(c.id, 2) * 0.4,
        rx: 0,
        ry: jitter(c.id, 3) * 1.1,
        rz: 0,
      },
      from: seat ? { x: seat.x * 0.7, y: 0.9, z: seat.z * 0.7, rx: 0, ry: 0, rz: Math.PI } : undefined,
      scale: 1.2,
    });
  });

  // Adversaires : cartes retournées en éventail devant leur pion (visibles à la fin de la manche).
  state.players.forEach((p, i) => {
    if (p.id === meId) return;
    const s = seats[i];
    const m = p.count;
    const step = Math.min(0.34, (portrait ? 2.2 : 3.2) / Math.max(1, m - 1));
    const k = portrait ? 0.9 : 0.66;
    const hc = { x: s.x * k, z: 1 + (s.z - 1) * k };
    const tx = -Math.sin(s.a);
    const tz = Math.cos(s.a);
    const cards = reveal && p.hand ? sortHand(p.hand) : null;
    for (let j = 0; j < m; j++) {
      const o = (j - (m - 1) / 2) * step;
      const base = {
        x: hc.x + tx * o,
        y: 0.12 + j * 0.012,
        z: hc.z + tz * o,
        rx: 0.12,
        ry: Math.PI / 2 - s.a,
        rz: cards ? 0 : Math.PI,
      };
      items.push({
        key: cards ? "c" + cards[j].id : `o-${p.id}-${j}`,
        card: cards ? cards[j] : null,
        target: base,
        from: deckSpawn,
      });
    }
  });

  // Ma main : en bas, face visible, les cartes jouables se soulèvent.
  const mine = sortHand(me?.hand || state.hand || []);
  const m = mine.length;
  const step = Math.min(1.0, MathUtils.clamp(aspect * 15, 6, 10.6) / Math.max(1, m - 1));
  const canAct = playing && state.turn === meId && !state.challenge;
  mine.forEach((c, i) => {
    const o = (i - (m - 1) / 2) * step;
    const playable = state.playable.includes(c.id);
    const lift = hover === c.id && canAct && playable ? 0.55 : playable && canAct ? 0.18 : 0;
    items.push({
      key: "c" + c.id,
      card: c,
      target: {
        x: o,
        y: 1.5 + i * 0.006 + lift * 0.75,
        z: 5.2 + o * o * 0.012 - lift * 0.35 + i * 0.012,
        rx: 0.98,
        ry: -o * 0.028,
        rz: 0,
      },
      from: deckSpawn,
      dim: canAct && !playable,
      scale: 1.22,
      onClick: canAct && playable ? (e) => (e.stopPropagation(), onPlay(c)) : undefined,
      onOver: (e) => {
        e.stopPropagation();
        setHover(c.id);
        document.body.style.cursor = canAct && playable ? "pointer" : "";
      },
      onOut: () => {
        setHover((h) => (h === c.id ? null : h));
        document.body.style.cursor = "";
      },
    });
  });

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ fov: 42, near: 0.1, far: 120, position: [0, 12, 12] }}
      gl={{ antialias: true, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
    >
      <Lights color={color} />
      <Rig />
      <Table />
      <Ring color={color} dir={state.dir} />
      {items.map((it) => (
        <Card3D key={it.key} card={it.card} target={it.target} from={it.from} dim={it.dim} scale={it.scale} onClick={it.onClick} onOver={it.onOver} onOut={it.onOut} />
      ))}
      {state.players.map((p, i) => {
        if (p.id === meId) return null;
        const s = seats[i];
        return (
          <group key={p.id}>
            <Pawn index={i} x={s.x} z={s.z} active={state.turn === p.id || state.challenge?.to === p.id} winner={reveal && state.roundWinner === p.id} />
            <Html position={[s.x, 1.9, s.z]} center zIndexRange={[20, 0]}>
              <Plate
                p={p}
                active={state.turn === p.id}
                risk={state.unoRisk?.id === p.id}
                score={showTarget}
                onCatch={() => onCatch(p.id)}
              />
            </Html>
          </group>
        );
      })}
      {reveal && <Sparkles count={70} scale={[12, 5, 8]} position={[0, 3, 1]} size={5} speed={0.6} color="#f2b705" />}
    </Canvas>
  );
}

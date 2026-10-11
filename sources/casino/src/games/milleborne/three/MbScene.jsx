import { Html } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import React from "react";
import { ACESFilmicToneMapping, CanvasTexture, DoubleSide, MathUtils, RepeatWrapping, SRGBColorSpace, Vector3 } from "three";
import { Car } from "./Car.jsx";
import { LANE, PERIM, RADIUS, STRAIGHT, laneOffset, pointAt, ribbon } from "./track.js";

const OVERVIEW = { pos: new Vector3(0, 23, 21), look: new Vector3(0, 0, 1) };

/** Caméra : vue d'ensemble, puis elle vient suivre la voiture qui roule (comme le pion du Monopoly). */
function Rig({ focus }) {
  const { camera, size } = useThree();
  const look = React.useRef(OVERVIEW.look.clone());
  const tmpPos = React.useMemo(() => new Vector3(), []);
  const tmpLook = React.useMemo(() => new Vector3(), []);
  useFrame((_s, dt) => {
    const f = MathUtils.clamp(1.6 / (size.width / size.height), 1, 1.9);
    const obj = focus?.current;
    if (obj) {
      tmpLook.set(obj.x, 0.4, obj.z);
      tmpPos.set(obj.x * 0.85, 7.5 * f, obj.z + 7 * f);
    } else {
      tmpLook.copy(OVERVIEW.look);
      tmpPos.set(OVERVIEW.pos.x, OVERVIEW.pos.y * f, OVERVIEW.pos.z * f);
    }
    const k = 1 - Math.exp(-2.8 * dt);
    camera.position.lerp(tmpPos, k);
    look.current.lerp(tmpLook, k);
    camera.lookAt(look.current);
  });
  return null;
}

function checker() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext("2d");
  for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) {
    ctx.fillStyle = (x + y) % 2 ? "#111" : "#fff";
    ctx.fillRect(x * 16, y * 16, 16, 16);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function grass() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#3f7d34";
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `hsl(${100 + Math.random() * 30},45%,${24 + Math.random() * 18}%)`;
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(30, 30);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function Road({ n, goal }) {
  const half = (n * LANE) / 2 + 0.35;
  const geos = React.useMemo(
    () => ({
      asphalt: ribbon(-half, half, 0.01),
      edgeIn: ribbon(-half, -half + 0.1, 0.02),
      edgeOut: ribbon(half - 0.1, half, 0.02),
      lanes: Array.from({ length: n - 1 }, (_, i) => {
        const o = laneOffset(i, n) + LANE / 2;
        return ribbon(o - 0.025, o + 0.025, 0.015);
      }),
    }),
    [n],
  );
  const flag = React.useMemo(checker, []);
  const turf = React.useMemo(grass, []);
  const start = pointAt(0);
  const marks = [];
  const stepKm = 100;
  for (let km = stepKm; km < goal; km += stepKm) marks.push(km);
  const trees = React.useMemo(() => {
    const out = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 46; i++) {
      const s = rnd() * PERIM;
      const side = rnd() < 0.5 ? -1 : 1;
      const pt = pointAt(s, side * (half + 1.4 + rnd() * 4));
      if (side < 0 && Math.abs(pt.x) < STRAIGHT / 2 && Math.abs(pt.z) < RADIUS - half - 1.5 && rnd() < 0.5) continue;
      out.push({ ...pt, h: 0.9 + rnd() * 1.1 });
    }
    return out;
  }, [half]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[140, 140]} />
        <meshStandardMaterial map={turf} roughness={1} />
      </mesh>
      <mesh geometry={geos.asphalt} receiveShadow>
        <meshStandardMaterial color="#3a3d42" roughness={0.9} side={DoubleSide} />
      </mesh>
      <mesh geometry={geos.edgeIn}>
        <meshBasicMaterial color="#e9e9e9" side={DoubleSide} />
      </mesh>
      <mesh geometry={geos.edgeOut}>
        <meshBasicMaterial color="#e9e9e9" side={DoubleSide} />
      </mesh>
      {geos.lanes.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshBasicMaterial color="#f5d76e" side={DoubleSide} />
        </mesh>
      ))}
      {/* ligne de départ / arrivée et son portique */}
      <mesh position={[start.x, 0.02, start.z]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <planeGeometry args={[half * 2, 0.6]} />
        <meshBasicMaterial map={flag} />
      </mesh>
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[start.x, 1.3, start.z + sd * (half + 0.15)]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 2.6, 10]} />
          <meshStandardMaterial color="#ddd" metalness={0.6} />
        </mesh>
      ))}
      <mesh position={[start.x, 2.5, start.z]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[half * 2 + 0.3, 0.45, 0.06]} />
        <meshStandardMaterial map={flag} />
      </mesh>
      <Html position={[start.x, 3.15, start.z]} center zIndexRange={[10, 0]}>
        <div className="mb-arch">{goal} km</div>
      </Html>
      {/* bornes kilométriques */}
      {marks.map((km) => {
        const pt = pointAt((km / goal) * PERIM, -(half + 0.45));
        return (
          <group key={km} position={[pt.x, 0, pt.z]} rotation={[0, pt.yaw, 0]}>
            <mesh position={[0, 0.3, 0]} castShadow>
              <boxGeometry args={[0.32, 0.6, 0.14]} />
              <meshStandardMaterial color="#f4f1ea" />
            </mesh>
            <mesh position={[0, 0.66, 0]}>
              <cylinderGeometry args={[0.16, 0.16, 0.14, 16, 1, false, 0, Math.PI]} />
              <meshStandardMaterial color="#c62828" />
            </mesh>
            <Html position={[0, 0.95, 0]} center zIndexRange={[9, 0]}>
              <div className="mb-borne">{km}</div>
            </Html>
          </group>
        );
      })}
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]}>
          <mesh position={[0, 0.25, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.1, 0.5, 6]} />
            <meshStandardMaterial color="#6b4423" />
          </mesh>
          <mesh position={[0, 0.5 + t.h / 2, 0]} castShadow>
            <coneGeometry args={[0.45, t.h, 8]} />
            <meshStandardMaterial color="#2f6b2a" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function MbScene({ state, meId, renderPlate }) {
  // Une voiture par équipe (en individuel, une par joueur).
  const cars = [];
  state.players.forEach((p) => {
    const c = cars.find((x) => x.team === p.team);
    if (c) c.members.push(p);
    else cars.push({ team: p.team, p, members: [p] });
  });
  const n = cars.length;
  const goal = state.goal;
  const e = state.effect;
  const focusId = e && (e.kind === "dist" ? e.by : e.kind === "hazard" ? e.target : null);
  const focus = React.useRef(null);
  const reveal = state.phase === "roundEnd" || state.phase === "end";
  // Position à suivre : calculée depuis l'état (la voiture interpole vers la même cible).
  if (focusId && state.phase === "playing") {
    const i = cars.findIndex((c) => c.members.some((m) => m.id === focusId));
    const p = cars[i].p;
    const pt = pointAt((Math.min(p.km, goal) / goal) * PERIM, laneOffset(i, n));
    focus.current = { x: pt.x, z: pt.z, rotation: { y: pt.yaw } };
  } else focus.current = null;

  return (
    <Canvas shadows dpr={[1, 2]} camera={{ fov: 42, near: 0.1, far: 200, position: [0, 26, 24] }} gl={{ antialias: true, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.05 }}>
      <color attach="background" args={["#9fd3ff"]} />
      <fog attach="fog" args={["#9fd3ff", 45, 110]} />
      <hemisphereLight args={["#ffffff", "#2d5a27", 0.9]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[12, 24, 10]}
        intensity={2.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
        shadow-bias={-4e-4}
      />
      <Rig focus={focus} />
      <Road n={n} goal={goal} />
      {cars.map(({ p, members }, i) => {
        const ids = members.map((m) => m.id);
        return (
          <Car
            key={p.id}
            p={p}
            index={i}
            lane={laneOffset(i, n)}
            goal={goal}
            active={ids.includes(state.turn)}
            hit={e?.kind === "hazard" && ids.includes(e.target) && !e.coup}
            finished={reveal && ids.includes(state.roundWinner)}
            plate={renderPlate(members, i, ids.includes(meId), ids.includes(state.turn))}
          />
        );
      })}
    </Canvas>
  );
}

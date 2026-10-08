import { OrbitControls, Sparkles, Stars } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import React from "react";
import { ACESFilmicToneMapping, Color, MathUtils } from "three";
import { Villager } from "./Villager.jsx";

const NIGHT = { bg: new Color("#050a1a"), fog: new Color("#060c1f"), amb: 0.18, sun: 0.0, moon: 0.9, fire: 60 };
const DAY = { bg: new Color("#8fc1e8"), fog: new Color("#b7d6ea"), amb: 0.55, sun: 2.6, moon: 0, fire: 18 };

// Graine fixe pour que le décor soit identique chez tous les joueurs
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function Lighting({ night }) {
  const t = React.useRef(night ? 0 : 1);
  const amb = React.useRef();
  const sun = React.useRef();
  const moon = React.useRef();
  const { scene } = useThree();
  useFrame((_, dt) => {
    t.current = MathUtils.damp(t.current, night ? 0 : 1, 1.6, dt);
    const k = t.current;
    if (scene.background?.isColor) scene.background.copy(NIGHT.bg).lerp(DAY.bg, k);
    if (scene.fog) scene.fog.color.copy(NIGHT.fog).lerp(DAY.fog, k);
    if (amb.current) amb.current.intensity = MathUtils.lerp(NIGHT.amb, DAY.amb, k);
    if (sun.current) sun.current.intensity = MathUtils.lerp(NIGHT.sun, DAY.sun, k);
    if (moon.current) moon.current.intensity = MathUtils.lerp(NIGHT.moon, DAY.moon, k);
  });
  return (
    <>
      <color attach="background" args={["#050a1a"]} />
      <fog attach="fog" args={["#060c1f", 22, 60]} />
      <ambientLight ref={amb} color="#b9c8ff" />
      <hemisphereLight args={["#9cc4ff", "#1c2a14", 0.25]} />
      <directionalLight
        ref={sun}
        position={[12, 18, 6]}
        color="#fff1d2"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
        shadow-bias={-5e-4}
      />
      <directionalLight ref={moon} position={[-10, 14, -8]} color="#8fa8ff" />
      {night && <Stars radius={70} depth={30} count={2500} factor={3} fade speed={0.4} />}
      <mesh position={night ? [-18, 20, -30] : [22, 26, -28]}>
        <sphereGeometry args={[night ? 1.6 : 2.2, 32, 32]} />
        <meshBasicMaterial color={night ? "#f2f0dc" : "#fff4c4"} toneMapped={false} />
      </mesh>
    </>
  );
}

function Campfire({ night }) {
  const light = React.useRef();
  const flames = React.useRef([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (light.current)
      light.current.intensity = (night ? 70 : 20) * (0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7.3));
    flames.current.forEach((f, i) => {
      if (!f) return;
      const s = 1 + 0.18 * Math.sin(t * (9 + i * 2.3) + i);
      f.scale.set(1, s, 1);
      f.rotation.y = t * (0.6 + i * 0.2);
    });
  });
  return (
    <group>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh
          key={i}
          castShadow
          position={[0, 0.12, 0]}
          rotation={[Math.PI / 2, 0, (i / 5) * Math.PI]}
        >
          <cylinderGeometry args={[0.09, 0.11, 1.3, 8]} />
          <meshStandardMaterial color="#4a2e1a" roughness={1} />
        </mesh>
      ))}
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return (
          <mesh key={"s" + i} position={[Math.cos(a) * 0.85, 0.08, Math.sin(a) * 0.85]} castShadow>
            <dodecahedronGeometry args={[0.16, 0]} />
            <meshStandardMaterial color="#6b6f75" roughness={1} />
          </mesh>
        );
      })}
      {[
        [0.42, 1.1, "#ff6a1a"],
        [0.3, 0.85, "#ffb02e"],
        [0.16, 0.6, "#fff0a0"],
      ].map(([r, h, c], i) => (
        <mesh key={"f" + i} ref={(el) => (flames.current[i] = el)} position={[0, 0.2 + h / 2, 0]}>
          <coneGeometry args={[r, h, 7]} />
          <meshBasicMaterial color={c} transparent opacity={0.85} toneMapped={false} />
        </mesh>
      ))}
      <pointLight ref={light} position={[0, 1.2, 0]} color="#ff9a3c" distance={22} decay={1.6} castShadow />
      <Sparkles count={30} scale={[1, 3, 1]} position={[0, 1.8, 0]} size={3} speed={1.2} color="#ffb060" />
    </group>
  );
}

function House({ position, rotation, night, hue }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh castShadow receiveShadow position={[0, 1, 0]}>
        <boxGeometry args={[2.6, 2, 2.2]} />
        <meshStandardMaterial color={hue} roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0, 2.65, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[2.1, 1.4, 4]} />
        <meshStandardMaterial color="#6b2f22" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.65, 1.11]}>
        <planeGeometry args={[0.6, 1.3]} />
        <meshStandardMaterial color="#3d2516" />
      </mesh>
      {[-0.85, 0.85].map((x) => (
        <mesh key={x} position={[x, 1.25, 1.11]}>
          <planeGeometry args={[0.5, 0.5]} />
          <meshStandardMaterial
            color={night ? "#ffd27a" : "#2a3540"}
            emissive={night ? "#ffb347" : "#000000"}
            emissiveIntensity={night ? 1.4 : 0}
          />
        </mesh>
      ))}
    </group>
  );
}

function Decor({ night }) {
  const { houses, trees } = React.useMemo(() => {
    const r = rng(42);
    const hues = ["#d8c3a0", "#c9b08a", "#e2d3b8", "#bfa27c"];
    const houses = Array.from({ length: 9 }, (_, i) => {
      const a = (i / 9) * Math.PI * 2 + 0.3;
      const d = 15 + r() * 2;
      return { p: [Math.cos(a) * d, 0, Math.sin(a) * d], rot: -a - Math.PI / 2, hue: hues[i % 4] };
    });
    const trees = Array.from({ length: 60 }, () => {
      const a = r() * Math.PI * 2;
      const d = 20 + r() * 14;
      return { p: [Math.cos(a) * d, 0, Math.sin(a) * d], s: 0.8 + r() * 0.9 };
    });
    return { houses, trees };
  }, []);
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[60, 64]} />
        <meshStandardMaterial color="#2c4a22" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <circleGeometry args={[8.5, 48]} />
        <meshStandardMaterial color="#6a5638" roughness={1} />
      </mesh>
      {houses.map((h, i) => (
        <House key={i} position={h.p} rotation={h.rot} night={night} hue={h.hue} />
      ))}
      {trees.map((t, i) => (
        <group key={i} position={t.p} scale={t.s}>
          <mesh castShadow position={[0, 0.6, 0]}>
            <cylinderGeometry args={[0.15, 0.22, 1.2, 6]} />
            <meshStandardMaterial color="#4a3020" />
          </mesh>
          <mesh castShadow position={[0, 2.1, 0]}>
            <coneGeometry args={[1.1, 2.6, 7]} />
            <meshStandardMaterial color="#1f4a2a" roughness={1} />
          </mesh>
          <mesh castShadow position={[0, 3.1, 0]}>
            <coneGeometry args={[0.8, 1.8, 7]} />
            <meshStandardMaterial color="#25562f" roughness={1} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function CameraRig({ meAngle, radius }) {
  const { camera, size } = useThree();
  const ctl = React.useRef();
  React.useEffect(() => {
    const far = radius + (size.width < size.height ? 14 : 10);
    const a = meAngle ?? Math.PI / 2;
    camera.position.set(Math.cos(a) * far, 9.5, Math.sin(a) * far);
    camera.lookAt(0, 0.8, 0);
    ctl.current?.update();
  }, [meAngle, radius, size.width, size.height]);
  return (
    <OrbitControls
      ref={ctl}
      makeDefault
      target={[0, 0.8, 0]}
      enablePan={false}
      minDistance={6}
      maxDistance={30}
      minPolarAngle={0.25}
      maxPolarAngle={1.42}
    />
  );
}

export function VillageScene({ state, meId, pickable, selected, onPick, bubbles }) {
  const night = state.phase === "night";
  const n = state.players.length;
  const radius = Math.max(3.4, n * 0.48);
  const meIdx = state.players.findIndex((p) => p.id === meId);
  const angle = (i) => (i / Math.max(n, 1)) * Math.PI * 2 + Math.PI / 2;
  const counts = {};
  Object.values(state.votes || {}).forEach((t) => (counts[t] = (counts[t] || 0) + 1));
  const wolfTargets = {};
  Object.values(state.mine?.wolfVotes || {}).forEach((t) => (wolfTargets[t] = (wolfTargets[t] || 0) + 1));
  const meWolf = state.players[meIdx]?.role === "wolf";
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ fov: 42, near: 0.1, far: 140, position: [0, 8, 14] }}
      gl={{ antialias: true, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      onPointerMissed={() => onPick?.(null)}
    >
      <Lighting night={night} />
      <Decor night={night} />
      <Campfire night={night} />
      {state.players.map((p, i) => {
        const a = angle(i);
        return (
          <Villager
            key={p.id}
            p={p}
            index={i}
            position={[Math.cos(a) * radius, 0, Math.sin(a) * radius]}
            facing={-a - Math.PI / 2}
            isMe={p.id === meId}
            night={night}
            sleeping={night && p.alive && !(meWolf && p.role === "wolf") && p.id !== meId}
            glowEyes={p.role === "wolf" && (night || state.phase === "end")}
            pickable={pickable?.includes(p.id)}
            selected={selected?.includes(p.id)}
            votes={counts[p.id] || wolfTargets[p.id] || 0}
            voteKind={counts[p.id] ? "vote" : wolfTargets[p.id] ? "wolf" : null}
            bubble={bubbles?.[p.id]}
            onPick={onPick}
          />
        );
      })}
      <CameraRig meAngle={meIdx >= 0 ? angle(meIdx) : null} radius={radius} />
    </Canvas>
  );
}

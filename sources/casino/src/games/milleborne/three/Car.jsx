import { Html, Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import React from "react";
import { MathUtils } from "three";
import { useRoomMii } from "../../../lib/mii.js";
import { MiiAvatar } from "../../../ui/MiiAvatar.jsx";
import { PERIM, pointAt } from "./track.js";

export const CAR_COLORS = ["#d7263d", "#1f6fd1", "#f2b705", "#2e9e4f", "#b45fd6", "#ef7d22"];
const MAX_SPEED = PERIM * 0.11; // unités / s : 100 km ≈ 0,7 s sur 1000 km, la voiture a le temps de se voir rouler

function Wheel({ x, z, spin, flat }) {
  return (
    <group position={[x, 0.2, z]}>
      <mesh ref={spin} rotation={[0, 0, Math.PI / 2]} scale={flat ? [1, 0.55, 1.25] : 1} castShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.16, 18]} />
        <meshStandardMaterial color="#141414" roughness={0.8} />
      </mesh>
    </group>
  );
}

/** Feu tricolore miniature au-dessus de la voiture. */
function Light({ status }) {
  const color = status === "go" ? "#2bff6a" : status === "stop" ? "#ff2b2b" : status === "hazard" ? "#ffa31a" : "#444";
  return (
    <group position={[0, 1.55, 0]}>
      <mesh>
        <sphereGeometry args={[0.13, 16, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={status === "none" ? 0 : 2.4} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.35, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.5, 6]} />
        <meshStandardMaterial color="#888" />
      </mesh>
    </group>
  );
}

export function Car({ p, index, lane, goal, active, hit, plate, finished }) {
  const root = React.useRef();
  const body = React.useRef();
  const wheels = [React.useRef(), React.useRef(), React.useRef(), React.useRef()];
  const s = React.useRef(null);
  const mii = useRoomMii(p);
  const color = CAR_COLORS[index % CAR_COLORS.length];
  const target = (Math.min(p.km, goal) / goal) * PERIM;
  const crashed = p.battle === "acc";
  const flat = p.battle === "flat";

  useFrame(({ clock }, dt) => {
    const g = root.current;
    if (!g) return;
    if (s.current === null) s.current = target;
    const rest = target - s.current;
    const v = Math.min(MAX_SPEED, Math.max(1.2, Math.abs(rest) * 2.4)) * dt;
    const moving = Math.abs(rest) > 0.01;
    s.current = moving ? s.current + Math.sign(rest) * Math.min(Math.abs(rest), v) : target;
    const pt = pointAt(s.current, lane);
    g.position.set(pt.x, 0, pt.z);
    const dy = MathUtils.euclideanModulo(pt.yaw - g.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
    g.rotation.y += dy * (1 - Math.exp(-14 * dt));
    wheels.forEach((w) => w.current && moving && (w.current.rotation.x += v * 6));
    const t = clock.elapsedTime;
    if (body.current) {
      const bump = moving ? Math.sin(t * 30) * 0.025 : active ? Math.abs(Math.sin(t * 4)) * 0.05 : 0;
      const shake = hit ? Math.sin(t * 60) * 0.06 : 0;
      body.current.position.y = bump;
      body.current.rotation.z = (flat ? -0.12 : 0) + shake + (crashed ? 0.22 : 0);
      body.current.rotation.x = moving ? -0.05 : 0;
      body.current.rotation.y = crashed ? 0.5 : 0;
    }
  });

  const status = p.rolling ? "go" : p.battle === "stop" || !p.battle ? "stop" : ["acc", "gas", "flat"].includes(p.battle) ? "hazard" : "stop";

  return (
    <group ref={root}>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.62, 0.74, 32]} />
        <meshBasicMaterial color="#ffd36a" transparent opacity={active ? 0.9 : 0} />
      </mesh>
      <group ref={body}>
        <mesh position={[0, 0.36, 0]} castShadow>
          <boxGeometry args={[0.62, 0.26, 1.15]} />
          <meshStandardMaterial color={color} metalness={0.35} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.56, -0.12]} castShadow>
          <boxGeometry args={[0.5, 0.2, 0.5]} />
          <meshStandardMaterial color="#cfe9ff" metalness={0.2} roughness={0.1} transparent opacity={0.55} />
        </mesh>
        {[-0.2, 0.2].map((x) => (
          <mesh key={x} position={[x, 0.38, 0.58]}>
            <boxGeometry args={[0.12, 0.07, 0.02]} />
            <meshStandardMaterial color="#fff6c8" emissive="#fff6c8" emissiveIntensity={1.5} toneMapped={false} />
          </mesh>
        ))}
        <mesh position={[0, 0.5, 0.42]}>
          <boxGeometry args={[0.04, 0.04, 0.04]} />
          <meshStandardMaterial color="#fff" />
        </mesh>
        {mii && <MiiAvatar mii={mii} position={[0, 0.22, -0.12]} scale={0.3} />}
        <Wheel x={-0.33} z={0.36} spin={wheels[0]} />
        <Wheel x={0.33} z={0.36} spin={wheels[1]} flat={flat} />
        <Wheel x={-0.33} z={-0.38} spin={wheels[2]} />
        <Wheel x={0.33} z={-0.38} spin={wheels[3]} flat={flat} />
      </group>
      <Light status={status} />
      {p.limit && (
        <Html position={[0.45, 1.5, 0]} center zIndexRange={[19, 0]}>
          <div className="mb-limit">50</div>
        </Html>
      )}
      {crashed && <Sparkles count={26} scale={[0.9, 1.4, 0.9]} position={[0, 0.9, 0.2]} size={9} speed={0.5} color="#777" />}
      {p.battle === "gas" && <Sparkles count={10} scale={[0.6, 0.6, 0.6]} position={[0, 0.5, -0.7]} size={5} speed={0.3} color="#bbb" />}
      {finished && <Sparkles count={60} scale={[2.5, 2.5, 2.5]} position={[0, 1.2, 0]} size={6} speed={0.8} color="#ffd36a" />}
      <Html position={[0, 2 + (index % 3) * 0.55, 0]} center zIndexRange={[20, 0]}>
        {plate}
      </Html>
    </group>
  );
}

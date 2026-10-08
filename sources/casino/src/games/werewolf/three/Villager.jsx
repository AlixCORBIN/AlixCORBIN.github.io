import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import React from "react";
import { ROLES } from "../roles.js";

const CLOTH = ["#b84a3a", "#3a6db8", "#4f9a52", "#c99a2e", "#7b4fb0", "#2f8f8f", "#b5567f", "#8a6a3c"];
const SKIN = ["#f1c7a3", "#d9a47c", "#a8714e", "#f5d6bd", "#7b4a30"];

function Tomb({ role }) {
  return (
    <group>
      <mesh castShadow position={[0, 0.55, 0]}>
        <boxGeometry args={[0.8, 1.1, 0.22]} />
        <meshStandardMaterial color="#8d9196" roughness={0.95} />
      </mesh>
      <mesh castShadow position={[0, 1.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 0.22, 20, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color="#8d9196" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.03, 0.45]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[0.9, 1.1]} />
        <meshStandardMaterial color="#3e2c1c" />
      </mesh>
      {role && (
        <Html position={[0, 0.7, 0.13]} center transform distanceFactor={4} occlude={false} pointerEvents="none">
          <div className="ww-tomb-icon">{ROLES[role].icon}</div>
        </Html>
      )}
    </group>
  );
}

export function Villager({
  p,
  index,
  position,
  facing,
  isMe,
  sleeping,
  glowEyes,
  pickable,
  selected,
  votes,
  voteKind,
  bubble,
  onPick,
}) {
  const body = React.useRef();
  const ring = React.useRef();
  const [hover, setHover] = React.useState(false);
  const cloth = CLOTH[index % CLOTH.length];
  const skin = SKIN[(index * 3) % SKIN.length];
  const wolfish = p.role === "wolf" && glowEyes;
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + index;
    if (body.current) {
      body.current.position.y = sleeping ? 0 : Math.sin(t * 2) * 0.03;
      body.current.rotation.x = MathLerp(body.current.rotation.x, sleeping ? 0.45 : 0, 0.08);
    }
    if (ring.current) ring.current.rotation.z = t * 0.8;
  });
  const role = p.role ? ROLES[p.role] : null;
  const click = (e) => {
    if (!pickable) return;
    e.stopPropagation();
    onPick?.(p.id);
  };
  const ringColor = selected ? "#ffd36a" : voteKind === "wolf" ? "#ff4b3e" : pickable && hover ? "#ffffff" : "#ffd36a";
  return (
    <group position={position} rotation={[0, facing, 0]}>
      {p.alive ? (
        <group
          ref={body}
          onClick={click}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHover(true);
            if (pickable) document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            setHover(false);
            document.body.style.cursor = "";
          }}
        >
          {/* tronc / habit */}
          <mesh castShadow position={[0, 0.75, 0]}>
            <capsuleGeometry args={[0.36, 0.7, 6, 14]} />
            <meshStandardMaterial color={cloth} roughness={0.8} />
          </mesh>
          {/* tête */}
          <mesh castShadow position={[0, 1.62, 0]}>
            <sphereGeometry args={[0.3, 24, 24]} />
            <meshStandardMaterial color={wolfish ? "#6f6a66" : skin} roughness={0.7} />
          </mesh>
          {/* yeux (côté feu) */}
          {[-0.1, 0.1].map((x) => (
            <mesh key={x} position={[x, 1.66, 0.27]}>
              <sphereGeometry args={[sleeping ? 0.025 : 0.045, 10, 10]} />
              <meshStandardMaterial
                color={wolfish ? "#ff2a1a" : "#1a1a1a"}
                emissive={wolfish ? "#ff2a1a" : "#000"}
                emissiveIntensity={wolfish ? 3 : 0}
                toneMapped={!wolfish}
              />
            </mesh>
          ))}
          {wolfish ? (
            [-0.17, 0.17].map((x) => (
              <mesh key={x} castShadow position={[x, 1.92, 0]} rotation={[0, 0, x > 0 ? -0.3 : 0.3]}>
                <coneGeometry args={[0.09, 0.26, 4]} />
                <meshStandardMaterial color="#5a5550" />
              </mesh>
            ))
          ) : (
            <mesh castShadow position={[0, 1.9, 0]}>
              <coneGeometry args={[0.34, 0.32, 16]} />
              <meshStandardMaterial color={cloth} roughness={0.9} />
            </mesh>
          )}
          {/* zone de clic élargie */}
          <mesh position={[0, 1, 0]} visible={false}>
            <cylinderGeometry args={[0.6, 0.6, 2.2, 8]} />
          </mesh>
        </group>
      ) : (
        <Tomb role={p.role} />
      )}
      {/* rond au sol : sélection / cible */}
      {(pickable || selected || votes > 0) && (
        <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <ringGeometry args={[0.62, selected ? 0.82 : 0.72, 32, 1, 0, Math.PI * (pickable && !selected ? 1.6 : 2)]} />
          <meshBasicMaterial color={ringColor} transparent opacity={selected || hover ? 0.95 : 0.55} toneMapped={false} />
        </mesh>
      )}
      <Html position={[0, p.alive ? 2.45 : 1.75, 0]} center distanceFactor={11} zIndexRange={[20, 0]} pointerEvents="none">
        <div className={"ww-plate" + (isMe ? " me" : "") + (p.alive ? "" : " dead") + (selected ? " sel" : "")}>
          {bubble && <div className="ww-bubble">{bubble}</div>}
          <span className="nm">
            {p.lover ? "💘 " : ""}
            {p.name}
            {p.bot ? " 🤖" : ""}
          </span>
          {role && (
            <span className="rl" style={{ color: role.color }}>
              {role.icon} {role.name}
            </span>
          )}
          {votes > 0 && <span className={"vt " + voteKind}>{votes}</span>}
        </div>
      </Html>
    </group>
  );
}

const MathLerp = (a, b, k) => a + (b - a) * k;

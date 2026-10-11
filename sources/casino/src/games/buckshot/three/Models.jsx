// Petits modèles en primitives : cartouches et objets.
import React from "react";

const metal = { color: "#9aa3ab", metalness: 0.85, roughness: 0.3 };

export function Shell({ live, ...props }) {
  return (
    <group {...props}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.12, 14]} />
        <meshStandardMaterial color={live ? "#c0182a" : "#1d4fb8"} roughness={0.45} emissive={live ? "#5a0008" : "#04163d"} emissiveIntensity={0.6} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[-0.07, 0, 0]} castShadow>
        <cylinderGeometry args={[0.032, 0.032, 0.03, 14]} />
        <meshStandardMaterial color="#c9a14a" metalness={0.9} roughness={0.25} />
      </mesh>
    </group>
  );
}

export function ItemModel({ id, glow = 0 }) {
  switch (id) {
    case "loupe":
      return (
        <group rotation={[-Math.PI / 2, 0, 0]}>
          <mesh castShadow>
            <torusGeometry args={[0.075, 0.014, 10, 28]} />
            <meshStandardMaterial {...metal} color="#c8b27a" />
          </mesh>
          <mesh>
            <circleGeometry args={[0.07, 24]} />
            <meshStandardMaterial color="#bfe6ff" transparent opacity={0.35} emissive="#8fd0ff" emissiveIntensity={0.3 + glow} />
          </mesh>
          <mesh position={[0, -0.14, 0]} castShadow>
            <cylinderGeometry args={[0.014, 0.018, 0.13, 10]} />
            <meshStandardMaterial color="#2a1a10" />
          </mesh>
        </group>
      );
    case "biere":
      return (
        <group position={[0, 0.085, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.052, 0.052, 0.17, 18]} />
            <meshStandardMaterial color="#1f6b34" metalness={0.6} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.088, 0]}>
            <cylinderGeometry args={[0.046, 0.05, 0.012, 18]} />
            <meshStandardMaterial {...metal} />
          </mesh>
          <mesh position={[0, 0, 0.051]}>
            <planeGeometry args={[0.06, 0.06]} />
            <meshStandardMaterial color="#e8d27a" />
          </mesh>
        </group>
      );
    case "cigarettes":
      return (
        <group position={[0, 0.03, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.13, 0.055, 0.17]} />
            <meshStandardMaterial color="#a3161f" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.0285, -0.05]}>
            <boxGeometry args={[0.13, 0.002, 0.07]} />
            <meshStandardMaterial color="#efe8dc" />
          </mesh>
        </group>
      );
    case "scie":
      return (
        <group position={[0, 0.02, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.3, 0.012, 0.07]} />
            <meshStandardMaterial {...metal} />
          </mesh>
          <mesh position={[-0.18, 0.01, 0]} castShadow>
            <boxGeometry args={[0.09, 0.04, 0.11]} />
            <meshStandardMaterial color="#5a2d16" roughness={0.7} />
          </mesh>
        </group>
      );
    case "menottes":
      return (
        <group position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          {[-0.06, 0.06].map((x) => (
            <mesh key={x} position={[x, 0, 0]} castShadow>
              <torusGeometry args={[0.05, 0.011, 8, 24]} />
              <meshStandardMaterial {...metal} emissive="#445" emissiveIntensity={glow} />
            </mesh>
          ))}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.006, 0.006, 0.04, 6]} />
            <meshStandardMaterial {...metal} />
          </mesh>
        </group>
      );
    case "inverseur":
      return (
        <group position={[0, 0.03, 0]}>
          <mesh position={[-0.03, 0, 0]} castShadow>
            <boxGeometry args={[0.06, 0.06, 0.1]} />
            <meshStandardMaterial color="#b3192b" />
          </mesh>
          <mesh position={[0.03, 0, 0]} castShadow>
            <boxGeometry args={[0.06, 0.06, 0.1]} />
            <meshStandardMaterial color="#1d4fb8" />
          </mesh>
          <mesh position={[0, 0.032, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.01, 12]} />
            <meshStandardMaterial color="#d6b3ff" emissive="#a45cff" emissiveIntensity={1 + glow * 3} toneMapped={false} />
          </mesh>
        </group>
      );
    case "telephone":
      return (
        <group position={[0, 0.01, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.075, 0.016, 0.15]} />
            <meshStandardMaterial color="#111" roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.0085, -0.015]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.06, 0.09]} />
            <meshStandardMaterial color="#5cff9a" emissive="#2cff7a" emissiveIntensity={0.4 + glow * 2} toneMapped={false} />
          </mesh>
        </group>
      );
    case "medicament":
      return (
        <group position={[0, 0.055, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.04, 0.04, 0.09, 16]} />
            <meshStandardMaterial color="#d9761c" transparent opacity={0.85} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.055, 0]}>
            <cylinderGeometry args={[0.043, 0.043, 0.025, 16]} />
            <meshStandardMaterial color="#f2f2f2" />
          </mesh>
        </group>
      );
    case "adrenaline":
      return (
        <group position={[0, 0.025, 0]} rotation={[0, 0, Math.PI / 2]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.02, 0.02, 0.15, 12]} />
            <meshStandardMaterial color="#f5f0c8" transparent opacity={0.6} />
          </mesh>
          <mesh position={[0, -0.01, 0]}>
            <cylinderGeometry args={[0.014, 0.014, 0.11, 10]} />
            <meshStandardMaterial color="#ffd23a" emissive="#ffb000" emissiveIntensity={0.4 + glow * 2} toneMapped={false} />
          </mesh>
          <mesh position={[0, -0.11, 0]}>
            <cylinderGeometry args={[0.002, 0.002, 0.07, 6]} />
            <meshStandardMaterial {...metal} />
          </mesh>
          <mesh position={[0, 0.09, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.01, 12]} />
            <meshStandardMaterial color="#ddd" />
          </mesh>
        </group>
      );
    case "telecommande":
      return (
        <group position={[0, 0.014, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.065, 0.025, 0.16]} />
            <meshStandardMaterial color="#1b1d22" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.015, -0.045]}>
            <cylinderGeometry args={[0.012, 0.012, 0.01, 12]} />
            <meshStandardMaterial color="#ff2a3a" emissive="#ff2a3a" emissiveIntensity={0.6 + glow * 2} toneMapped={false} />
          </mesh>
        </group>
      );
    default:
      return null;
  }
}

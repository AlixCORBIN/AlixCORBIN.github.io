// Fusil à pompe en primitives. Le canon pointe vers +z ; l'origine est au milieu de l'arme.
import React from "react";

const wood = { color: "#3f2412", roughness: 0.7 };
const steel = { color: "#2a2e34", metalness: 0.45, roughness: 0.45 };

export const MUZZLE_Z = { full: 0.74, sawed: 0.44 };

export const GunModel = React.forwardRef(function GunModel({ glowRef }, ref) {
  const pump = React.useRef();
  const barrel = React.useRef();
  const muzzle = React.useRef();
  const port = React.useRef();
  React.useImperativeHandle(ref, () => ({ pump: pump.current, barrel: barrel.current, muzzle: muzzle.current, port: port.current }));
  return (
    <group>
      {/* crosse */}
      <mesh position={[0, -0.035, -0.5]} rotation={[0.08, 0, 0]} castShadow>
        <boxGeometry args={[0.1, 0.16, 0.42]} />
        <meshStandardMaterial {...wood} />
      </mesh>
      <mesh position={[0, -0.005, -0.25]} castShadow>
        <boxGeometry args={[0.075, 0.1, 0.16]} />
        <meshStandardMaterial {...wood} />
      </mesh>
      {/* boîte de culasse */}
      <mesh position={[0, 0.005, -0.04]} castShadow>
        <boxGeometry args={[0.095, 0.13, 0.3]} />
        <meshStandardMaterial ref={glowRef} {...steel} emissive="#a45cff" emissiveIntensity={0} />
      </mesh>
      <group ref={port} position={[0.05, 0.03, -0.02]} />
      {/* pontet et détente */}
      <mesh position={[0, -0.085, -0.12]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.035, 0.007, 6, 16, Math.PI]} />
        <meshStandardMaterial {...steel} />
      </mesh>
      {/* canon (raccourci quand il est scié) */}
      <group ref={barrel} position={[0, 0.035, 0.11]}>
        <mesh position={[0, 0, 0.315]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.03, 0.03, 0.63, 16]} />
          <meshStandardMaterial {...steel} />
        </mesh>
      </group>
      <group ref={muzzle} position={[0, 0.035, MUZZLE_Z.full]} />
      {/* magasin tubulaire */}
      <mesh position={[0, -0.03, 0.31]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 0.5, 12]} />
        <meshStandardMaterial {...steel} />
      </mesh>
      {/* pompe */}
      <mesh ref={pump} position={[0, -0.03, 0.26]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.047, 0.047, 0.22, 14]} />
        <meshStandardMaterial {...wood} color="#33200f" />
      </mesh>
    </group>
  );
});

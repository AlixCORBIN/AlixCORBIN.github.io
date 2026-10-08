import React from "react";
import { DoubleSide, LatheGeometry, Vector2 } from "three";
import { WHEEL_RADIUS } from "./geometry.js";

export function Bowl() {
  const outerGeo = React.useMemo(() => {
    const pts = [
      [3.7, -0.4],
      [3.7, 0.45],
      [3.45, 0.64],
      [3, 0.7],
      [2.82, 0.64],
    ].map(([x, y]) => new Vector2(x, y));
    return new LatheGeometry(pts, 96);
  }, []);
  const trackGeo = React.useMemo(() => {
    const pts = [
      [2.82, 0.64],
      [2.7, 0.62],
      [2.5, 0.52],
      [2.3, 0.4],
      [2.05, 0.31],
      [WHEEL_RADIUS, 0.29],
    ].map(([x, y]) => new Vector2(x, y));
    return new LatheGeometry(pts, 96);
  }, []);
  return (
    <group>
      <mesh geometry={outerGeo} castShadow receiveShadow>
        <meshStandardMaterial
          color="#3a1f12"
          roughness={0.35}
          metalness={0.2}
          side={DoubleSide}
        />
      </mesh>
      <mesh geometry={trackGeo} receiveShadow>
        <meshStandardMaterial
          color="#5c3320"
          roughness={0.18}
          metalness={0.25}
          side={DoubleSide}
        />
      </mesh>
      <mesh position={[0, 0.7, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.86, 0.045, 12, 128]} />
        <meshStandardMaterial
          color="#e6c778"
          metalness={0.95}
          roughness={0.2}
        />
      </mesh>
      {Array.from(
        {
          length: 8,
        },
        (_, i) => {
          const angle = (i / 8) * Math.PI * 2 + 0.2;
          return (
            <mesh
              key={i}
              position={[Math.cos(angle) * 2.18, 0.41, Math.sin(angle) * 2.18]}
              rotation={[0, -angle + Math.PI / 4, 0]}
              castShadow
            >
              <boxGeometry args={[0.12, 0.12, 0.12]} />
              <meshStandardMaterial
                color="#e6c778"
                metalness={0.9}
                roughness={0.25}
              />
            </mesh>
          );
        },
      )}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.41, 0]}
        receiveShadow
      >
        <circleGeometry args={[14, 64]} />
        <meshStandardMaterial color="#0a3a28" roughness={0.95} />
      </mesh>
    </group>
  );
}

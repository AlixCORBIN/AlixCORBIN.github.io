import { useFrame } from "@react-three/fiber";
import React from "react";
import { CHIPS } from "../chips.js";
import { chipTextures } from "./textures.js";

function Chip({ v, y }) {
  const { top, side } = React.useMemo(() => chipTextures(v), [v]);
  return (
    <mesh position={[0, y, 0]} castShadow>
      <cylinderGeometry args={[0.19, 0.19, 0.045, 36]} />
      <meshStandardMaterial attach="material-0" map={side} roughness={0.5} />
      <meshStandardMaterial attach="material-1" map={top} roughness={0.5} />
      <meshStandardMaterial attach="material-2" map={top} roughness={0.5} />
    </mesh>
  );
}

function chipStacks(amount) {
  const stacks = [];
  for (const chip of CHIPS) {
    const count = Math.floor(amount / chip.v);
    amount -= count * chip.v;
    if (count) {
      stacks.push([chip.v, Math.min(count, 14)]);
    }
  }
  return stacks;
}

export function ChipStack({ position, amount, flat }) {
  const ref = React.useRef();
  const born = React.useRef(performance.now());
  useFrame(() => {
    if (!ref.current) return;
    const k = Math.min(1, (performance.now() - born.current) / 260);
    const ease = 1 - Math.pow(1 - k, 3);
    ref.current.scale.setScalar(0.4 + 0.6 * ease);
    ref.current.position.y = position[1] + (1 - ease) * 0.5;
  });
  const stacks = flat ? [[amount / 9, 9]] : chipStacks(amount);
  return amount ? (
    <group ref={ref} position={position}>
      {stacks.map(([value, count], i) => (
        <group
          key={value}
          position={[(i - (stacks.length - 1) / 2) * 0.17, 0, (i % 2) * 0.03]}
        >
          {Array.from(
            {
              length: count,
            },
            (_, j) => (
              <Chip key={j} v={value} y={0.023 + j * 0.047} />
            ),
          )}
        </group>
      ))}
    </group>
  ) : null;
}

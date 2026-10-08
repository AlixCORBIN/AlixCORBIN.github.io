import React from "react";
import { ExtrudeGeometry, Path, Shape } from "three";
import { CHIPS } from "../chips.js";
import { ChipStack } from "./ChipStack.jsx";
import { FELT_Y, SHOE_POS, TABLE_SIZE } from "./layout.js";
import { feltTexture, tableLayoutTexture } from "./textures.js";

function tableOutline(shape, halfW, radiusZ, depth) {
  shape.moveTo(-halfW, depth);
  shape.lineTo(halfW, depth);
  shape.lineTo(halfW, 0);
  shape.absellipse(0, 0, halfW, radiusZ, 0, Math.PI, true);
  shape.lineTo(-halfW, depth);
  return shape;
}

export function Table() {
  const { W, H, D } = TABLE_SIZE;
  const feltGeo = React.useMemo(() => {
    const geo = new ExtrudeGeometry(tableOutline(new Shape(), W, H, D), {
      depth: FELT_Y,
      bevelEnabled: false,
      curveSegments: 64,
    });
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, []);
  const railGeo = React.useMemo(() => {
    const shape = tableOutline(new Shape(), W + 0.5, H + 0.5, D + 0.5);
    shape.holes.push(tableOutline(new Path(), W, H, D));
    const geo = new ExtrudeGeometry(shape, {
      depth: 0.42,
      bevelEnabled: true,
      bevelSize: 0.08,
      bevelThickness: 0.08,
      bevelSegments: 6,
      curveSegments: 64,
    });
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, []);
  const baseGeo = React.useMemo(() => {
    const geo = new ExtrudeGeometry(
      tableOutline(new Shape(), W + 0.4, H + 0.4, D + 0.4),
      {
        depth: 1.4,
        bevelEnabled: false,
        curveSegments: 48,
      },
    );
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, []);
  const felt = React.useMemo(() => feltTexture(), []);
  const layout = React.useMemo(() => tableLayoutTexture(), []);
  return (
    <group>
      <mesh geometry={feltGeo} receiveShadow position={[0, 0, 0]}>
        <meshStandardMaterial map={felt} roughness={0.95} color="#1c8a5c" />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, FELT_Y + 0.002, (H - D) / 2]}
        receiveShadow
      >
        <planeGeometry args={[W * 2, D + H]} />
        <meshBasicMaterial
          map={layout}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh geometry={railGeo} castShadow receiveShadow>
        <meshStandardMaterial
          color="#2a1710"
          roughness={0.45}
          metalness={0.15}
        />
      </mesh>
      <mesh geometry={baseGeo} position={[0, -1.4, 0]} receiveShadow>
        <meshStandardMaterial color="#0d0806" roughness={0.8} />
      </mesh>
    </group>
  );
}

export function TableProps() {
  return (
    <group>
      <group
        position={[SHOE_POS.x, FELT_Y, SHOE_POS.z]}
        rotation={[0, -0.3, 0]}
      >
        <mesh position={[0, 0.3, 0]} castShadow>
          <boxGeometry args={[1, 0.6, 0.75]} />
          <meshStandardMaterial
            color="#1a1a1e"
            roughness={0.35}
            metalness={0.5}
          />
        </mesh>
        <mesh position={[-0.05, 0.64, 0]} castShadow>
          <boxGeometry args={[0.8, 0.1, 0.6]} />
          <meshStandardMaterial color="#f2eee2" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.32, 0.38]}>
          <boxGeometry args={[0.9, 0.04, 0.02]} />
          <meshStandardMaterial
            color="#e8c468"
            metalness={0.9}
            roughness={0.25}
          />
        </mesh>
      </group>
      <group position={[-4.7, FELT_Y, -2.9]} rotation={[0, 0.25, 0]}>
        <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.1, 0.12, 0.85]} />
          <meshStandardMaterial
            color="#1a1a1e"
            roughness={0.35}
            metalness={0.4}
          />
        </mesh>
        <mesh position={[0, 0.2, 0]} castShadow>
          <boxGeometry args={[0.7, 0.2, 0.52]} />
          <meshStandardMaterial color="#efe9db" roughness={0.7} />
        </mesh>
      </group>
      <group position={[0, FELT_Y, -3.75]}>
        <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
          <boxGeometry args={[4.3, 0.1, 0.55]} />
          <meshStandardMaterial
            color="#14100d"
            roughness={0.5}
            metalness={0.3}
          />
        </mesh>
        {CHIPS.map((chip, i) => (
          <ChipStack
            key={chip.v}
            position={[(i - (CHIPS.length - 1) / 2) * 0.68, 0.1, 0]}
            amount={chip.v * 9}
            flat
          />
        ))}
      </group>
    </group>
  );
}

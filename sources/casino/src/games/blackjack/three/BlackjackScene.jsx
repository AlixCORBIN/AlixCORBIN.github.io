import { ContactShadows, OrbitControls, Sparkles } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import React from "react";
import { ACESFilmicToneMapping } from "three";
import { Dealer } from "./Dealer.jsx";
import { FELT_Y } from "./layout.js";
import { PlayerSeat } from "./PlayerSeat.jsx";
import { Table, TableProps } from "./Table.jsx";

function CameraRig() {
  const { camera, size } = useThree();
  const controls = React.useRef();
  React.useEffect(() => {
    const aspect = size.width / size.height;
    const zoom = Math.min(2.4, Math.max(1, 1.75 / aspect));
    camera.position.set(0, 7.4 * zoom, 8.4 * zoom);
    camera.lookAt(0, 0, 1.3);
    controls.current?.update();
  }, [size.width, size.height]);
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={[0, 0, 1.3]}
      enablePan={false}
      minDistance={6}
      maxDistance={22}
      minPolarAngle={0.35}
      maxPolarAngle={1.2}
      minAzimuthAngle={-0.7}
      maxAzimuthAngle={0.7}
    />
  );
}

export function BlackjackScene({ state, me }) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{
        fov: 38,
        near: 0.1,
        far: 80,
        position: [0, 7.4, 8.4],
      }}
      gl={{
        antialias: true,
        toneMapping: ACESFilmicToneMapping,
        toneMappingExposure: 1.05,
      }}
    >
      <color attach="background" args={["#04100b"]} />
      <fog attach="fog" args={["#04100b", 18, 40]} />
      <ambientLight intensity={0.55} />
      <hemisphereLight args={["#bfe8d4", "#1a0f08", 0.35]} />
      <spotLight
        position={[0, 11, 3]}
        angle={0.8}
        penumbra={0.8}
        intensity={260}
        color="#fff1d6"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-4e-4}
      />
      <pointLight position={[-6, 3, 4]} intensity={18} color="#ffb870" />
      <pointLight position={[6, 3, 4]} intensity={18} color="#ffb870" />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -1.45, 0]}
        receiveShadow
      >
        <circleGeometry args={[40, 48]} />
        <meshStandardMaterial color="#0a0604" roughness={0.9} />
      </mesh>
      <Table />
      <TableProps />
      <Dealer g={state} />
      {state.players.map((p, i) => (
        <PlayerSeat key={p.id} p={p} index={i} isMe={p.id === me} g={state} />
      ))}
      <ContactShadows
        position={[0, FELT_Y + 0.001, 0.5]}
        scale={16}
        blur={2.2}
        opacity={0.35}
        far={2}
      />
      <Sparkles
        count={40}
        scale={[16, 6, 12]}
        size={2}
        speed={0.15}
        opacity={0.25}
        position={[0, 3, 0]}
      />
      <CameraRig />
    </Canvas>
  );
}

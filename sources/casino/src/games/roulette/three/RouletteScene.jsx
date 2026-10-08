import { OrbitControls, Sparkles } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import React from "react";
import { ACESFilmicToneMapping } from "three";
import { Bowl } from "./Bowl.jsx";
import { Wheel } from "./Wheel.jsx";

function CameraRig() {
  const { camera, size } = useThree();
  const controls = React.useRef();
  React.useEffect(() => {
    const aspect = size.width / size.height;
    const zoom = Math.min(2.2, Math.max(1, 1.75 / aspect));
    camera.position.set(0, 6.2 * zoom, 5.2 * zoom);
    camera.lookAt(0, 0.3, 0);
    controls.current?.update();
  }, [size.width, size.height]);
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={[0, 0.3, 0]}
      enablePan={false}
      minDistance={5}
      maxDistance={16}
      minPolarAngle={0.2}
      maxPolarAngle={1.35}
    />
  );
}

export function RouletteScene({ state }) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{
        fov: 38,
        near: 0.1,
        far: 80,
        position: [0, 6.2, 5.2],
      }}
      gl={{
        antialias: true,
        toneMapping: ACESFilmicToneMapping,
        toneMappingExposure: 1.1,
      }}
    >
      <color attach="background" args={["#04100b"]} />
      <fog attach="fog" args={["#04100b", 16, 34]} />
      <ambientLight intensity={0.5} />
      <hemisphereLight args={["#bfe8d4", "#1a0f08", 0.35]} />
      <spotLight
        position={[0, 10, 2]}
        angle={0.7}
        penumbra={0.7}
        intensity={320}
        color="#fff1d6"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-4e-4}
      />
      <pointLight position={[-5, 3, 4]} intensity={20} color="#ffb870" />
      <pointLight position={[5, 3, 4]} intensity={20} color="#ffb870" />
      <Bowl />
      <Wheel phase={state.phase} result={state.result} round={state.round} />
      <Sparkles
        count={40}
        scale={[12, 5, 10]}
        size={2}
        speed={0.15}
        opacity={0.25}
        position={[0, 2.5, 0]}
      />
      <CameraRig />
    </Canvas>
  );
}

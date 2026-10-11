import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import React from "react";
import * as THREE from "three";
import { TILE, cellCenter } from "../track.js";
import { ghostPose, speedOf } from "../physics.js";
import { readInput } from "../input.js";
import { buildCar } from "./CarModel.js";
import { buildDecor, buildTrackGroup } from "./buildTrack.js";

function Environment({ track, world }) {
  const { scene } = useThree();
  const [w, h] = track.size;
  React.useEffect(() => {
    scene.background = new THREE.Color(world.sky);
    scene.fog = new THREE.Fog(world.fog, 120, world.night ? 520 : 760);
    return () => { scene.fog = null; };
  }, [world, scene]);
  const trackObj = React.useMemo(() => buildTrackGroup(track, world), [track, world]);
  const decor = React.useMemo(() => buildDecor(track, world, track.tiles.length), [track, world]);
  const cx = (w * TILE) / 2, cz = (h * TILE) / 2;
  return (
    <>
      <hemisphereLight args={[world.night ? "#6a5cff" : "#ffffff", world.ground, world.night ? 0.7 : 1.1]} />
      <directionalLight position={[cx + 200, 320, cz + 120]} intensity={world.night ? 0.5 : 1.6} />
      <mesh rotation-x={-Math.PI / 2} position={[cx, -0.3, cz]}>
        <planeGeometry args={[4000, 4000]} />
        <meshStandardMaterial color={world.ground} roughness={1} />
      </mesh>
      {world.id === "stadium" && (
        <gridHelper args={[w * TILE + 12 * TILE, w + 12, "#5fae4a", "#5fae4a"]} position={[cx, -0.26, cz]} />
      )}
      {world.night && (
        <gridHelper args={[3000, 90, world.accent, "#3a1f7a"]} position={[cx, -0.25, cz]} />
      )}
      <primitive object={trackObj} />
      <primitive object={decor} />
    </>
  );
}

function Ghost({ data, color, session }) {
  const car = React.useMemo(() => buildCar(color, { ghost: true }), [color]);
  useFrame(() => {
    const p = session.phase === "countdown" ? ghostPose(data, 0) : ghostPose(data, session.timeMs);
    if (!p) { car.group.visible = false; return; }
    car.group.visible = true;
    car.group.position.set(p.x, p.y, p.z);
    car.group.rotation.set(0, -p.yaw, 0);
  });
  return <primitive object={car.group} />;
}

const tmpV = new THREE.Vector3();

function PlayerCar({ session, color, hudRef }) {
  const car = React.useMemo(() => buildCar(color), [color]);
  const { camera } = useThree();
  const cam = React.useRef({ init: false, yaw: 0, pos: new THREE.Vector3(), look: new THREE.Vector3() });
  const pitch = React.useRef(0);
  useFrame((_s, dt) => {
    session.update(dt, readInput());
    const c = session.run.car;
    car.group.position.set(c.x, c.y, c.z);
    // assiette : pente du sol sous la voiture, ou lacet seul en l'air
    if (c.grounded) {
      const fx = Math.sin(c.yaw), fz = -Math.cos(c.yaw);
      const a = session.track.ground(c.x + fx * 2, c.z + fz * 2, c.y).h;
      const b = session.track.ground(c.x - fx * 2, c.z - fz * 2, c.y).h;
      pitch.current += (Math.atan2(a - b, 4) - pitch.current) * Math.min(1, dt * 14);
    } else {
      pitch.current += (Math.atan2(c.vy, Math.max(speedOf(c), 1)) * 0.6 - pitch.current) * Math.min(1, dt * 3);
    }
    car.group.rotation.set(0, 0, 0);
    car.group.rotateY(-c.yaw);
    car.group.rotateX(pitch.current);
    car.group.rotateZ(-c.steerVis * c.slip * 0.08);
    const sp = speedOf(c);
    for (const w of car.wheels) w.rotation.x -= sp * dt / 0.55;
    for (const p of car.frontPivots) p.rotation.y = -c.steerVis * 0.45;

    // caméra de poursuite
    const k = cam.current;
    let dyaw = c.yaw - k.yaw;
    while (dyaw > Math.PI) dyaw -= 2 * Math.PI;
    while (dyaw < -Math.PI) dyaw += 2 * Math.PI;
    if (!k.init || session.phase === "countdown") { k.yaw = c.yaw; k.init = true; }
    else k.yaw += dyaw * Math.min(1, dt * 5);
    const back = 10 + sp * 0.04, up = 4 + sp * 0.012;
    tmpV.set(c.x - Math.sin(k.yaw) * back, c.y + up, c.z + Math.cos(k.yaw) * back);
    if (session.phase === "countdown") k.pos.copy(tmpV);
    else k.pos.lerp(tmpV, Math.min(1, dt * 8));
    camera.position.copy(k.pos);
    k.look.set(c.x + Math.sin(k.yaw) * 6, c.y + 1.5, c.z - Math.cos(k.yaw) * 6);
    camera.lookAt(k.look);
    const fov = 68 + Math.min(sp, 110) * 0.12 + (c.boost > 0 ? 6 : 0);
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix(); }
    hudRef.current?.(session, sp);
  });
  return <primitive object={car.group} />;
}

export function RaceScene({ session, ghosts = [], color, hudRef }) {
  return (
    <Canvas camera={{ fov: 70, near: 0.5, far: 3000 }} dpr={[1, 1.75]} gl={{ antialias: true }}>
      <Environment track={session.track} world={session.world} />
      {ghosts.map((g) => <Ghost key={g.key} data={g.data} color={g.color} session={session} />)}
      <PlayerCar session={session} color={color} hudRef={hudRef} />
    </Canvas>
  );
}

// Vue orbitale de la piste (aperçu éditeur)
export function TrackPreview({ track, world }) {
  const [w, h] = track.size;
  const cx = (w * TILE) / 2, cz = (h * TILE) / 2;
  const s = track.start ? cellCenter(track.start.x, track.start.z) : [cx, cz];
  return (
    <Canvas camera={{ fov: 50, near: 1, far: 4000, position: [cx + w * 18, Math.max(w, h) * 26, cz + h * 28] }}>
      <Environment track={track} world={world} />
      <OrbitControls target={[cx, 0, cz]} maxPolarAngle={Math.PI / 2.1} />
      {track.start && (
        <mesh position={[s[0], track.start.level * 8 + 1.5, s[1]]}>
          <boxGeometry args={[2.3, 1.5, 4.6]} />
          <meshStandardMaterial color="#e63946" />
        </mesh>
      )}
    </Canvas>
  );
}

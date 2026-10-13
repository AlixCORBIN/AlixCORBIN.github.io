import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import React from "react";
import * as THREE from "three";
import { TILE } from "../track.js";
import { carFrame, ghostPose } from "../physics.js";
import { readInput } from "../input.js";
import { buildCar } from "./CarModel.js";
import { buildDecor, buildTrackGroup } from "./buildTrack.js";

function Environment({ track, world, fog = true, session = null }) {
  const { scene } = useThree();
  const [w, h] = track.size;
  React.useEffect(() => {
    scene.background = new THREE.Color(world.sky);
    scene.fog = fog ? new THREE.Fog(world.fog, 120, world.night ? 520 : 760) : null;
    return () => { scene.fog = null; };
  }, [world, scene, fog]);
  const trackObj = React.useMemo(() => buildTrackGroup(track, world), [track, world]);
  const decor = React.useMemo(() => buildDecor(track, world, track.tiles.length), [track, world]);
  // éléments mobiles de la saison 2 (plateformes, barrières, portes, caisses) : fonction du pas de la course
  useFrame(() => {
    const anim = trackObj.userData.anim;
    if (!anim?.length) return;
    const steps = session?.run?.steps ?? 0, flags = session?.run?.flags ?? {};
    for (const a of anim) a(steps, flags);
  });
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
    const p = ghostPose(data, session.phase === "countdown" ? 0 : session.timeMs);
    if (!p) { car.group.visible = false; return; }
    car.group.visible = true;
    car.group.position.set(p.x, p.y, p.z);
    car.group.quaternion.set(p.q.x, p.q.y, p.q.z, p.q.w);
  });
  return <primitive object={car.group} />;
}

const tmpV = new THREE.Vector3();
const tmpUp = new THREE.Vector3();
const WHEEL_Y = -0.05;

function PlayerCar({ session, color, hudRef }) {
  const car = React.useMemo(() => buildCar(color), [color]);
  const { camera } = useThree();
  const cam = React.useRef({ init: false, dir: new THREE.Vector3(0, 0, -1), up: new THREE.Vector3(0, 1, 0), pos: new THREE.Vector3(), look: new THREE.Vector3() });
  useFrame((_s, dt) => {
    session.update(dt, readInput());
    const c = session.car;
    const t = c.body.translation(), q = c.body.rotation();
    car.group.position.set(t.x, t.y, t.z);
    car.group.quaternion.set(q.x, q.y, q.z, q.w);
    // roues : suspension, rotation, braquage
    const vc = c.vc;
    car.pivots.forEach((pv, i) => {
      const len = vc.wheelSuspensionLength(i) ?? 0.45;
      pv.position.y = WHEEL_Y - len;
      pv.rotation.y = vc.wheelSteering(i) || 0;
      car.wheels[i].rotation.x = -(vc.wheelRotation(i) || 0);
    });

    const fr = carFrame(c);
    const k = cam.current;
    const fwd = tmpV.set(...fr.fwd);
    // la caméra suit le haut de la voiture dans les loopings et sur les murs, sinon garde le ciel en haut
    const steep = c.contacts > 0 && fr.up[1] < 0.8;
    tmpUp.set(...(steep ? fr.up : [0, 1, 0]));
    if (!k.init || session.phase === "countdown") {
      k.dir.copy(fwd); k.up.set(0, 1, 0); k.init = true;
    } else {
      k.dir.lerp(fwd, Math.min(1, dt * 6)).normalize();
      k.up.lerp(tmpUp, Math.min(1, dt * 3)).normalize();
    }
    const sp = c.speed;
    const back = 9 + Math.min(sp, 100) * 0.04, upOff = 3.6 + Math.min(sp, 100) * 0.01;
    const target = new THREE.Vector3(t.x, t.y, t.z).addScaledVector(k.dir, -back).addScaledVector(k.up, upOff);
    if (session.phase === "countdown" || k.pos.distanceTo(target) > 60) k.pos.copy(target);
    else k.pos.lerp(target, Math.min(1, dt * 10));
    camera.position.copy(k.pos);
    camera.up.copy(k.up);
    k.look.set(t.x, t.y, t.z).addScaledVector(k.dir, 6).addScaledVector(k.up, 1.4);
    camera.lookAt(k.look);
    const fov = 68 + Math.min(sp, 110) * 0.14 + (c.boost > 0 ? 6 : 0);
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix(); }
    hudRef.current?.(session, c);
  });
  return <primitive object={car.group} />;
}

export function RaceScene({ session, ghosts = [], color, hudRef }) {
  return (
    <Canvas camera={{ fov: 70, near: 0.5, far: 3000 }} dpr={[1, 1.75]} gl={{ antialias: true }}>
      <Environment track={session.track} world={session.world} session={session} />
      {ghosts.map((g) => <Ghost key={g.key} data={g.data} color={g.color} session={session} />)}
      <PlayerCar session={session} color={color} hudRef={hudRef} />
    </Canvas>
  );
}

// Vue orbitale de la piste (aperçu éditeur)
export function TrackPreview({ track, world }) {
  const [w, h] = track.size;
  const cx = (w * TILE) / 2, cz = (h * TILE) / 2;
  const sp = track.start ? track.spawn().p : null;
  return (
    <Canvas camera={{ fov: 50, near: 1, far: 4000, position: [cx + w * 14, Math.max(w, h) * 14 + 40, cz + h * 20] }}>
      <Environment track={track} world={world} fog={false} />
      <OrbitControls target={[cx, 0, cz]} maxPolarAngle={Math.PI / 2.1} />
      {sp && (
        <mesh position={sp}>
          <boxGeometry args={[2.3, 1.5, 4.6]} />
          <meshStandardMaterial color="#e63946" />
        </mesh>
      )}
    </Canvas>
  );
}

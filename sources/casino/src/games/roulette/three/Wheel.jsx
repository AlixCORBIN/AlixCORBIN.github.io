import { useFrame } from "@react-three/fiber";
import React from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
import { WHEEL_ORDER, numberColor } from "../rules.js";
import {
  BALL_POCKET_R,
  BALL_TRACK_R,
  POCKETS,
  POCKET_ANGLE,
  RING_INNER,
  RING_OUTER,
  SPIN_SECONDS,
  WHEEL_RADIUS,
  WHEEL_SPEED,
  pocketAngle,
} from "./geometry.js";

function wheelTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  const c = 1024 / 2;
  const scale = 1024 / 2 / WHEEL_RADIUS;
  ctx.fillStyle = "#16100b";
  ctx.beginPath();
  ctx.arc(c, c, 1024 / 2, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < POCKETS; i++) {
    const angle = pocketAngle(i);
    const num = WHEEL_ORDER[i];
    const color = numberColor(num);
    ctx.fillStyle =
      color === "green" ? "#0b7a3b" : color === "red" ? "#b3202a" : "#0d0d11";
    ctx.beginPath();
    ctx.arc(
      c,
      c,
      RING_OUTER * scale,
      angle - POCKET_ANGLE / 2,
      angle + POCKET_ANGLE / 2,
    );
    ctx.arc(
      c,
      c,
      RING_INNER * scale,
      angle + POCKET_ANGLE / 2,
      angle - POCKET_ANGLE / 2,
      true,
    );
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.translate(
      c + Math.cos(angle) * 1.62 * scale,
      c + Math.sin(angle) * 1.62 * scale,
    );
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${0.13 * scale}px Georgia, serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(num), 0, 0);
    ctx.restore();
  }
  ctx.strokeStyle = "#d9b45a";
  ctx.lineWidth = 0.035 * scale;
  for (const r of [RING_OUTER, RING_INNER]) {
    ctx.beginPath();
    ctx.arc(c, c, r * scale, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = "#2a1a10";
  ctx.beginPath();
  ctx.arc(c, c, (RING_INNER - 0.03) * scale, 0, Math.PI * 2);
  ctx.fill();
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));

const smoothstep = (v) => {
  v = clamp01(v);
  return v * v * (3 - 2 * v);
};

export function Wheel({ phase, result, round }) {
  const rotor = React.useRef();
  const ball = React.useRef();
  const light = React.useRef();
  const texture = React.useMemo(() => wheelTexture(), []);
  const anim = React.useRef({
    theta: 0,
    active: false,
    round: -1,
    lastK: -1,
    t0: 0,
    th0: 0,
    phiT: 0,
    k: 0,
  });
  React.useEffect(() => {
    const a = anim.current;
    if (result == null || (phase !== "spinning" && phase !== "settle")) return;
    const pocket = WHEEL_ORDER.indexOf(result);
    if (phase === "spinning" && a.round !== round) {
      a.round = round;
      a.active = true;
      a.t0 = performance.now();
      a.th0 = a.theta;
      a.k = pocket;
      const endTheta = a.th0 + WHEEL_SPEED * SPIN_SECONDS + 2 * Math.PI * 1.3;
      a.phiT = pocketAngle(pocket) - endTheta;
      a.lastK = pocket;
    } else {
      if (a.round !== round) {
        a.round = round;
        a.lastK = pocket;
      }
    }
  }, [phase, result, round]);
  useFrame((_state, dt) => {
    const a = anim.current;
    const now = performance.now();
    let visible = a.lastK >= 0;
    let radius = BALL_POCKET_R;
    let height = 0.34;
    let scale = 1;
    let phi;
    if (a.active) {
      const elapsed = (now - a.t0) / 1000;
      if (elapsed >= SPIN_SECONDS) {
        a.active = false;
        a.theta = a.th0 + WHEEL_SPEED * SPIN_SECONDS + 2 * Math.PI * 1.3;
      } else {
        const k = elapsed / SPIN_SECONDS;
        a.theta =
          a.th0 +
          WHEEL_SPEED * elapsed +
          2 * Math.PI * 1.3 * (1 - (1 - k) * (1 - k));
        const slow = 1 - Math.pow(1 - k, 2.4);
        phi = a.phiT - 2 * Math.PI * 9 * (1 - slow);
        const drop = smoothstep((k - 0.55) / 0.35);
        radius = BALL_TRACK_R + (BALL_POCKET_R - BALL_TRACK_R) * drop;
        height =
          0.34 +
          0.2 *
            smoothstep(
              (radius - BALL_POCKET_R) / (BALL_TRACK_R - BALL_POCKET_R),
            );
        if (k > 0.88) {
          const bounce = k - 0.88;
          radius +=
            0.06 * Math.sin(70 * bounce) * Math.max(0, 1 - bounce / 0.12);
          height +=
            0.14 * Math.abs(Math.sin(34 * bounce)) * Math.exp(-22 * bounce);
        }
        scale = Math.min(1, elapsed / 0.25);
      }
    }
    if (!a.active) {
      a.theta += WHEEL_SPEED * dt;
    }
    if (rotor.current) {
      rotor.current.rotation.y = a.theta;
    }
    if (phi === undefined && a.lastK >= 0) {
      phi = pocketAngle(a.lastK) - a.theta;
    }
    if (ball.current) {
      ball.current.visible = visible;
      if (visible) {
        ball.current.position.set(
          Math.cos(phi) * radius,
          height,
          Math.sin(phi) * radius,
        );
        ball.current.scale.setScalar(scale);
      }
    }
    if (light.current && ball.current) {
      light.current.position.copy(ball.current.position).y += 0.5;
      light.current.intensity = phase === "settle" ? 4 : 0;
    }
  });
  const fretAngles = React.useMemo(
    () =>
      Array.from(
        {
          length: POCKETS,
        },
        (_, i) => pocketAngle(i) + POCKET_ANGLE / 2,
      ),
    [],
  );
  return (
    <group>
      <group ref={rotor}>
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.28, 0]}
          receiveShadow
        >
          <circleGeometry args={[WHEEL_RADIUS, 96]} />
          <meshStandardMaterial
            map={texture}
            roughness={0.35}
            metalness={0.15}
          />
        </mesh>
        {fretAngles.map((_, i) => (
          <mesh
            key={i}
            position={[
              (Math.cos(_) * (RING_INNER + RING_OUTER)) / 2,
              0.33,
              (Math.sin(_) * (RING_INNER + RING_OUTER)) / 2,
            ]}
            rotation={[0, -_, 0]}
            castShadow
          >
            <boxGeometry args={[RING_OUTER - RING_INNER, 0.09, 0.016]} />
            <meshStandardMaterial
              color="#e6c778"
              metalness={0.9}
              roughness={0.25}
            />
          </mesh>
        ))}
        <mesh position={[0, 0.5, 0]} castShadow>
          <coneGeometry args={[0.95, 0.5, 48]} />
          <meshStandardMaterial
            color="#3a2414"
            metalness={0.5}
            roughness={0.35}
          />
        </mesh>
        <mesh position={[0, 0.82, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.07, 0.35, 24]} />
          <meshStandardMaterial
            color="#e6c778"
            metalness={0.95}
            roughness={0.2}
          />
        </mesh>
        <mesh position={[0, 1.02, 0]} castShadow>
          <sphereGeometry args={[0.13, 24, 24]} />
          <meshStandardMaterial
            color="#f1d58b"
            metalness={0.95}
            roughness={0.15}
          />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <mesh
            key={i}
            position={[0, 0.66, 0]}
            rotation={[0, (i * Math.PI) / 2, 0.9]}
            castShadow
          >
            <boxGeometry args={[0.9, 0.04, 0.05]} />
            <meshStandardMaterial
              color="#e6c778"
              metalness={0.9}
              roughness={0.25}
            />
          </mesh>
        ))}
      </group>
      <mesh ref={ball} castShadow visible={false}>
        <sphereGeometry args={[0.085, 24, 24]} />
        <meshStandardMaterial
          color="#fafafa"
          roughness={0.08}
          metalness={0.15}
          emissive="#bbbbbb"
          emissiveIntensity={0.25}
        />
      </mesh>
      <pointLight ref={light} color="#ffe6a0" distance={3} intensity={0} />
    </group>
  );
}

import { useFrame } from "@react-three/fiber";
import React from "react";
import { BoxGeometry, MathUtils } from "three";
import { cardMaterials } from "./textures.js";

export const CARD_W = 1.0;
export const CARD_H = 1.5;
export const CARD_T = 0.012;

const geometry = new BoxGeometry(CARD_W, CARD_T, CARD_H);

/**
 * Une carte posée dans la scène. `target` = { x, y, z, rx, ry, rz } : la carte glisse vers sa cible,
 * donc passer d'une zone à l'autre (main -> défausse) s'anime sans rien recréer.
 * `from` (optionnel) donne la position de départ à l'apparition (talon, siège d'un adversaire).
 */
export function Card3D({ card, target, from, dim, onClick, onOver, onOut, scale = 1, speed: spd }) {
  const ref = React.useRef();
  const materials = React.useMemo(() => cardMaterials(card), [card ? card.c + card.v : "back"]);
  const init = React.useRef(false);

  useFrame((_state, dt) => {
    const obj = ref.current;
    if (!obj) return;
    if (!init.current) {
      init.current = true;
      obj.rotation.order = "YXZ";
      const s = from || target;
      obj.position.set(s.x, s.y, s.z);
      obj.rotation.set(s.rx ?? 0, s.ry ?? 0, s.rz ?? 0);
      return;
    }
    const k = 1 - Math.exp(-(spd || 9) * dt);
    const dist = Math.hypot(target.x - obj.position.x, target.z - obj.position.z);
    const lift = target.y + Math.min(dist, 4) * 0.28;
    obj.position.x += (target.x - obj.position.x) * k;
    obj.position.z += (target.z - obj.position.z) * k;
    obj.position.y += (lift - obj.position.y) * k;
    obj.rotation.x += (target.rx - obj.rotation.x) * k;
    obj.rotation.y += (shortest(obj.rotation.y, target.ry) - obj.rotation.y) * k;
    obj.rotation.z += (target.rz - obj.rotation.z) * k;
  });

  return (
    <group ref={ref} scale={scale}>
      <mesh
        castShadow
        receiveShadow
        geometry={geometry}
        material={materials}
        onClick={onClick}
        onPointerOver={onOver}
        onPointerOut={onOut}
      />
      {dim && (
        <mesh position={[0, CARD_T / 2 + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[CARD_W * 0.98, CARD_H * 0.98]} />
          <meshBasicMaterial color="#05080a" transparent opacity={0.4} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

// Plus court chemin entre deux angles, pour que la rotation ne fasse jamais un tour complet.
function shortest(from, to) {
  return from + MathUtils.euclideanModulo(to - from + Math.PI, Math.PI * 2) - Math.PI;
}

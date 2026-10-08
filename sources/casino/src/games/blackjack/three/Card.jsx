import { useFrame } from "@react-three/fiber";
import React from "react";
import { MeshStandardMaterial, Vector3 } from "three";
import { CARD_H, CARD_THICKNESS, CARD_W, SHOE_POS } from "./layout.js";
import { cardBackTexture, cardFaceTexture } from "./textures.js";

const cardEdgeMaterial = new MeshStandardMaterial({
  color: "#efe9db",
  roughness: 0.7,
});

export function Card({ card, target, rotY = 0, delay = 0, hiddenFlip }) {
  const ref = React.useRef();
  const born = React.useRef(performance.now());
  const face = card.hidden ? cardBackTexture() : cardFaceTexture(card);
  const materials = React.useMemo(
    () => [
      cardEdgeMaterial,
      cardEdgeMaterial,
      new MeshStandardMaterial({
        map: face,
        roughness: 0.55,
      }),
      new MeshStandardMaterial({
        map: cardBackTexture(),
        roughness: 0.55,
      }),
      cardEdgeMaterial,
      cardEdgeMaterial,
    ],
    [face],
  );
  const dest = React.useMemo(
    () => new Vector3(...target),
    [target[0], target[1], target[2]],
  );
  useFrame((_state, dt) => {
    const obj = ref.current;
    if (!obj) return;
    if ((performance.now() - born.current) / 1000 - delay < 0) {
      obj.visible = false;
      return;
    }
    if (!obj.visible) {
      obj.visible = true;
      obj.position.copy(SHOE_POS);
      obj.rotation.set(0, 0, Math.PI);
      obj.userData.init = true;
    }
    const k = 1 - Math.exp(-9 * dt);
    obj.position.x += (dest.x - obj.position.x) * k;
    obj.position.z += (dest.z - obj.position.z) * k;
    const dist = Math.hypot(dest.x - obj.position.x, dest.z - obj.position.z);
    const lift = dest.y + Math.min(dist, 3) * 0.22;
    obj.position.y += (lift - obj.position.y) * k;
    const flip = hiddenFlip ? Math.PI : 0;
    obj.rotation.z += (flip - obj.rotation.z) * (1 - Math.exp(-7 * dt));
    obj.rotation.y += (rotY - obj.rotation.y) * k;
    obj.children[0].position.y = Math.abs(Math.sin(obj.rotation.z)) * 0.35;
  });
  return (
    <group ref={ref} visible={false} position={SHOE_POS.toArray()}>
      <mesh castShadow receiveShadow material={materials}>
        <boxGeometry args={[CARD_W, CARD_THICKNESS, CARD_H]} />
      </mesh>
    </group>
  );
}

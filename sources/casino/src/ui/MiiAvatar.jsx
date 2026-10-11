import { useFrame } from "@react-three/fiber";
import React from "react";
import { miiKit } from "../lib/mii.js";

// Mii 3D animé (respiration, clignement). Pieds en y=0, regard vers +z, ~1.85 de haut à l'échelle 1.
export function MiiAvatar({ mii, walk = false, eyesClosed = false, lookDown = 0, override, ...props }) {
  const data = React.useMemo(() => {
    if (!mii) return null;
    if (!override) return mii;
    const m = JSON.parse(JSON.stringify(mii));
    override(m);
    return m;
  }, [mii, override]);
  const key = data ? JSON.stringify(data) : "";
  const obj = React.useMemo(() => (data ? miiKit.buildMii(data) : null), [key]);
  React.useEffect(() => () => obj && miiKit.disposeMii(obj), [obj]);
  useFrame((_s, dt) => {
    if (obj) miiKit.tickMii(obj, Math.min(dt, 0.05), { walk, eyesClosed, lookDown });
  });
  if (!obj) return null;
  return (
    <group {...props}>
      <primitive object={obj} />
    </group>
  );
}

// Vignette 2D (portrait) rendue une fois hors écran, mise en cache
let portraitRenderer = null;
const portraitCache = new Map();
export function miiPortrait(THREE, mii, size = 160) {
  const key = size + JSON.stringify(mii);
  if (portraitCache.has(key)) return portraitCache.get(key);
  if (!portraitRenderer) {
    portraitRenderer = { r: new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }), scene: new THREE.Scene(), cam: new THREE.PerspectiveCamera(28, 1, 0.05, 50) };
    portraitRenderer.r.outputColorSpace = THREE.SRGBColorSpace;
    portraitRenderer.scene.add(new THREE.HemisphereLight(0xffffff, 0xc9dbe6, 1.5));
    const key2 = new THREE.DirectionalLight(0xffffff, 1.7);
    key2.position.set(2, 4, 5);
    portraitRenderer.scene.add(key2);
  }
  const { r, scene, cam } = portraitRenderer;
  r.setSize(size, size, false);
  const g = miiKit.buildMii(mii, { body: false });
  scene.add(g);
  const y = miiKit.HEAD_SCALE * 1.05;
  cam.position.set(0, y + 0.06, 1.95);
  cam.lookAt(0, y, 0);
  r.render(scene, cam);
  const url = r.domElement.toDataURL("image/png");
  scene.remove(g);
  miiKit.disposeMii(g);
  portraitCache.set(key, url);
  return url;
}

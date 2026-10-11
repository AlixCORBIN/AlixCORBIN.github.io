// Voiture stylisée (blocs), regard vers -z. Retourne { group, wheels, frontPivots }.
import * as THREE from "three";

export function buildCar(color = "#e63946", { ghost = false } = {}) {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.4, transparent: ghost, opacity: ghost ? 0.4 : 1, depthWrite: !ghost });
  const dark = new THREE.MeshStandardMaterial({ color: "#16181d", roughness: 0.6, transparent: ghost, opacity: ghost ? 0.35 : 1, depthWrite: !ghost });
  const glass = new THREE.MeshStandardMaterial({ color: "#9fd4ff", roughness: 0.1, metalness: 0.6, transparent: true, opacity: ghost ? 0.25 : 0.85 });
  const add = (geo, mat, x, y, z, parent = g) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = !ghost;
    parent.add(m);
    return m;
  };
  add(new THREE.BoxGeometry(2.3, 0.55, 4.6), body, 0, 0.75, 0); // châssis
  add(new THREE.BoxGeometry(1.6, 0.35, 1.6), body, 0, 1.2, -1.4).rotation.x = 0.12; // capot
  add(new THREE.BoxGeometry(1.25, 0.6, 1.5), glass, 0, 1.3, 0.35); // cockpit
  add(new THREE.BoxGeometry(2.6, 0.12, 0.7), dark, 0, 1.55, 2.15); // aileron
  add(new THREE.BoxGeometry(0.12, 0.5, 0.5), dark, -1.0, 1.25, 2.1);
  add(new THREE.BoxGeometry(0.12, 0.5, 0.5), dark, 1.0, 1.25, 2.1);
  add(new THREE.BoxGeometry(2.7, 0.12, 0.6), dark, 0, 0.5, -2.45); // lame avant
  const wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.5, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [], frontPivots = [];
  for (const [x, z, front] of [[-1.25, -1.5, 1], [1.25, -1.5, 1], [-1.25, 1.6, 0], [1.25, 1.6, 0]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.55, z);
    g.add(pivot);
    const w = add(wheelGeo, dark, 0, 0, 0, pivot);
    wheels.push(w);
    if (front) frontPivots.push(pivot);
  }
  if (!ghost) {
    const lightMat = new THREE.MeshBasicMaterial({ color: "#ff2a2a" });
    add(new THREE.BoxGeometry(0.5, 0.15, 0.05), lightMat, -0.75, 0.85, 2.31);
    add(new THREE.BoxGeometry(0.5, 0.15, 0.05), lightMat, 0.75, 0.85, 2.31);
  }
  return { group: g, wheels, frontPivots };
}

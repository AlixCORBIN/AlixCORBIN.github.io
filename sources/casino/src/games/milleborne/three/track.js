// Circuit en forme de stade : la distance parcourue (0..objectif) devient une position sur la boucle.
import { BufferGeometry, Float32BufferAttribute } from "three";

export const STRAIGHT = 18;
export const RADIUS = 7;
export const LANE = 0.62;
export const PERIM = 2 * STRAIGHT + 2 * Math.PI * RADIUS;

/** Point au curviligne s (départ au milieu de la ligne droite du bas), décalé de `off` vers l'extérieur. */
export function pointAt(s, off = 0) {
  s = ((s % PERIM) + PERIM) % PERIM;
  const L = STRAIGHT, R = RADIUS, A = Math.PI * R;
  let x, z, hx, hz;
  if (s < L / 2) [x, z, hx, hz] = [s, R, 1, 0];
  else if (s < L / 2 + A) {
    const th = Math.PI / 2 - (s - L / 2) / R;
    [x, z, hx, hz] = [L / 2 + R * Math.cos(th), R * Math.sin(th), Math.sin(th), -Math.cos(th)];
  } else if (s < L * 1.5 + A) [x, z, hx, hz] = [L / 2 - (s - L / 2 - A), -R, -1, 0];
  else if (s < L * 1.5 + 2 * A) {
    const th = -Math.PI / 2 - (s - L * 1.5 - A) / R;
    [x, z, hx, hz] = [-L / 2 + R * Math.cos(th), R * Math.sin(th), Math.sin(th), -Math.cos(th)];
  } else [x, z, hx, hz] = [-L / 2 + (s - L * 1.5 - 2 * A), R, 1, 0];
  // normale extérieure = (-hz, hx)
  return { x: x - hz * off, z: z + hx * off, yaw: Math.atan2(hx, hz) };
}

/** Ruban plat entre deux décalages (bitume, lignes). */
export function ribbon(inner, outer, y = 0, steps = 240, from = 0, to = PERIM) {
  const pos = [];
  const idx = [];
  for (let i = 0; i <= steps; i++) {
    const s = from + ((to - from) * i) / steps;
    const a = pointAt(s, inner);
    const b = pointAt(s, outer);
    pos.push(a.x, y, a.z, b.x, y, b.z);
    if (i < steps) {
      const k = i * 2;
      idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** Décalage de la voie du joueur i parmi n (centrées sur la ligne médiane). */
export const laneOffset = (i, n) => (i - (n - 1) / 2) * LANE;

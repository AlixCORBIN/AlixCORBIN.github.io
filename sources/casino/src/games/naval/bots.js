// IA du bot : chasse en damier, puis traque autour des touchés jusqu'à couler le navire.
import { secureRandomInt } from "../../lib/random.js";
import { FLEET, SIZE } from "./engine.js";

const speed = () => (import.meta.env?.DEV && globalThis.__navalSpeed) || 1;
export const botDelay = (min, max) => (min + secureRandomInt(Math.max(1, max - min))) / speed();

const pick = (arr) => arr[secureRandomInt(arr.length)];

export function botTarget(g, bot) {
  const target = g.players.find((p) => p !== bot);
  const shot = new Map(target.shots.map((s) => [s.x + "," + s.y, s]));
  const free = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE && !shot.has(x + "," + y);
  const open = target.shots.filter((s) => s.hit && !s.sunk);

  if (open.length) {
    // Plusieurs touchés alignés : on prolonge la ligne.
    if (open.length >= 2) {
      const sameRow = open.every((s) => s.y === open[0].y);
      const sameCol = open.every((s) => s.x === open[0].x);
      if (sameRow || sameCol) {
        const along = open.map((s) => (sameRow ? s.x : s.y));
        const lo = Math.min(...along) - 1;
        const hi = Math.max(...along) + 1;
        const ends = (sameRow ? [[lo, open[0].y], [hi, open[0].y]] : [[open[0].x, lo], [open[0].x, hi]]).filter(([x, y]) => free(x, y));
        if (ends.length) return pick(ends);
      }
    }
    const around = [];
    for (const s of open)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (free(s.x + dx, s.y + dy)) around.push([s.x + dx, s.y + dy]);
    if (around.length) return pick(around);
  }

  // Chasse : le plus petit navire restant fixe le pas du damier.
  // (seule info utilisée sur la flotte adverse : quels navires sont coulés, ce qui est public)
  const left = FLEET.filter((f) => !(target.ships || []).some((s) => s.k === f.k && s.hits >= s.len));
  const step = Math.max(2, Math.min(...(left.length ? left.map((f) => f.len) : [2])));
  const hunt = [];
  const all = [];
  for (let x = 0; x < SIZE; x++)
    for (let y = 0; y < SIZE; y++) {
      if (!free(x, y)) continue;
      all.push([x, y]);
      if ((x + y) % step === 0) hunt.push([x, y]);
    }
  // Un peu d'imprévu pour ne pas être un robot parfait.
  if (hunt.length && secureRandomInt(10) < 8) return pick(hunt);
  return pick(all);
}

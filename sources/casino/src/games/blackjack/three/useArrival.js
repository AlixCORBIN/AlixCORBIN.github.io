import React from "react";

// Temps pour qu'une carte glisse du sabot jusqu'à sa place (voir Card.jsx).
const TRAVEL_S = 0.55;

/**
 * Nombre de cartes "arrivées" (dans l'ordre) : permet d'afficher le score
 * carte par carte, en phase avec l'animation de distribution.
 * keys   : une clé stable par carte (change à chaque nouvelle manche)
 * delays : délai d'animation (s) de chaque carte, comme passé à <Card delay>
 */
export function useArrival(keys, delays) {
  const born = React.useRef(new Map());
  const [, setTick] = React.useState(0);
  const now = performance.now();
  keys.forEach((k) => {
    if (!born.current.has(k)) born.current.set(k, now);
  });
  const dueAt = keys.map(
    (k, i) => born.current.get(k) + ((delays[i] || 0) + TRAVEL_S) * 1000,
  );
  let count = 0;
  while (count < keys.length && dueAt[count] <= now) count++;
  const next = dueAt[count];
  const sig = keys.join("|");
  React.useEffect(() => {
    if (count >= keys.length) return undefined;
    const id = setTimeout(
      () => setTick((t) => t + 1),
      Math.max(20, next - performance.now() + 20),
    );
    return () => clearTimeout(id);
  }, [sig, count]);
  return count;
}

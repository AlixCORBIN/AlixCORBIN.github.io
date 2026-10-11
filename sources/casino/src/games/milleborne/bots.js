// IA des bots du Mille Bornes : réparer, repartir, rouler le plus loin possible et freiner le leader.
import { REMEDY_OF, SAFETY_OF, kindOf } from "./cards.js";
import { currentPlayer, targetsFor } from "./engine.js";
import { secureRandomInt } from "../../lib/random.js";

const chance = (p) => secureRandomInt(1000) < p * 1000;
const speed = () => (import.meta.env?.DEV && globalThis.__mbSpeed) || 1;
export const botDelay = (min, max) => (min + secureRandomInt(Math.max(1, max - min))) / speed();

/** Un bot visé par une attaque sort-il son coup fourré ? */
export const botCoups = () => chance(0.9);

function value(g, p, card, target) {
  const k = card.k;
  const kind = kindOf(k);
  const goal = g.goal;
  if (kind === "dist") return 50 + Number(k) / 4;
  if (kind === "remedy") return 90;
  if (kind === "hazard") {
    const t = g.players.find((x) => x.id === target);
    // On vise le leader, surtout s'il approche de l'arrivée ; inutile de s'acharner sur les retardataires.
    const lead = Math.max(...g.players.filter((x) => x.car !== p.car).map((x) => x.car.km));
    const behind = t.car.km < lead ? 25 : 0;
    const danger = t.car.km >= p.car.km ? 15 : 0;
    return 30 + (t.car.km / goal) * 70 + danger - behind + (k === "limit" ? -12 : 0) + secureRandomInt(10);
  }
  // Botte : on la garde pour un coup fourré, sauf si elle débloque la voiture ou que le talon est presque vide.
  if (p.car.battle && SAFETY_OF[p.car.battle] === k) return 95;
  if (k === "prio" && (p.car.limit || p.car.battle === "stop")) return 95;
  return g.deck.length < 12 ? 70 : 5;
}

/** Carte la moins utile à défausser. */
function junk(g, p) {
  const cost = (c) => {
    const kind = kindOf(c.k);
    if (kind === "safety") return 1000;
    if (kind === "remedy") {
      const covered = Object.entries(REMEDY_OF).some(([h, r]) => r === c.k && p.car.safeties.includes(SAFETY_OF[h]));
      const dup = p.hand.filter((x) => x.k === c.k).length;
      return covered ? 0 : 50 - dup * 12;
    }
    if (kind === "dist") return p.car.km + Number(c.k) > g.goal ? 1 : 30 + Number(c.k) / 10;
    return 40;
  };
  return [...p.hand].sort((a, b) => cost(a) - cost(b))[0];
}

export function botTurn(g, bot = currentPlayer(g)) {
  let best = null;
  for (const card of bot.hand) {
    for (const target of targetsFor(g, bot, card.k)) {
      const v = value(g, bot, card, target === "self" ? bot.id : target);
      if (!best || v > best.v) best = { v, card, target };
    }
  }
  if (best && best.v > 10) return { t: "play", card: best.card.id, target: best.target === "self" ? bot.id : best.target };
  return { t: "discard", card: junk(g, bot).id };
}

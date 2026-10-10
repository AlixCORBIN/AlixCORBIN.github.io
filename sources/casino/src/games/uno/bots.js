// IA simple des bots du UNO : choix de la carte, de la couleur, défis du +4 et attrapage des « UNO » oubliés.
import { COLORS, isWild } from "./cards.js";
import { legalCards, topCard } from "./engine.js";
import { secureRandomInt } from "../../lib/random.js";

const pick = (arr) => (arr.length ? arr[secureRandomInt(arr.length)] : null);
const chance = (p) => secureRandomInt(1000) < p * 1000;

// En développement, window.__unoSpeed accélère les bots pour les tests automatiques.
const speed = () => (import.meta.env?.DEV && globalThis.__unoSpeed) || 1;

export const botDelay = (min, max) => (min + secureRandomInt(Math.max(1, max - min))) / speed();

const nextPlayer = (g) => g.players[(((g.turn + g.dir) % g.players.length) + g.players.length) % g.players.length];

/** Couleur la plus présente dans la main restante (hors jokers), au hasard à défaut. */
export function bestColor(hand) {
  const count = Object.fromEntries(COLORS.map((c) => [c, 0]));
  hand.forEach((c) => {
    if (!isWild(c)) count[c.c]++;
  });
  const max = Math.max(...Object.values(count));
  if (max === 0) return pick(COLORS);
  return pick(COLORS.filter((c) => count[c] === max));
}

function score(g, bot, card) {
  const rest = bot.hand.filter((c) => c.id !== card.id);
  let s = 0;
  const next = nextPlayer(g);
  const threat = next && next.hand.length <= 2;
  if (isWild(card)) {
    // Les jokers sont gardés pour les moments difficiles.
    s -= card.v === "wd4" ? 6 : 4;
    if (rest.length <= 2) s += 8;
    if (threat) s += card.v === "wd4" ? 9 : 3;
  } else {
    s += rest.filter((c) => c.c === card.c).length * 0.8;
    s += Number(card.v) >= 0 ? Number(card.v) * 0.2 : 0;
    if (["skip", "rev", "d2"].includes(card.v)) s += threat ? 7 : 2;
    if (card.v === "rev" && g.players.length === 2) s += 1;
  }
  return s + secureRandomInt(100) / 100;
}

/** Action du bot dont c'est le tour (ou qui doit répondre à un +4). */
export function botTurn(g, bot) {
  if (g.challenge && g.challenge.to === bot.id) {
    const from = g.players.find((p) => p.id === g.challenge.from);
    // Plus l'adversaire a de cartes en main, plus un +4 légal est probable : on défie davantage les petites mains.
    const p = from && from.hand.length <= 3 ? 0.55 : 0.28;
    return { t: chance(p) ? "challenge" : "accept" };
  }
  const legal = legalCards(g, bot);
  if (g.drawn != null) {
    const c = legal[0];
    if (c && chance(0.92)) return playAction(g, bot, c);
    return { t: "pass" };
  }
  if (!legal.length) return { t: "draw" };
  const top = topCard(g);
  // Un +4 « légal » seulement s'il ne reste aucune carte de la couleur courante (sauf bluff rare).
  const hasColor = bot.hand.some((c) => c.c === g.color);
  const usable = legal.filter((c) => {
    if (c.v !== "wd4" || g.pending > 0) return true;
    return !hasColor || chance(0.08);
  });
  const pool = usable.length ? usable : legal;
  let best = null;
  let bestScore = -Infinity;
  for (const c of pool) {
    const s = score(g, bot, c);
    if (s > bestScore) {
      best = c;
      bestScore = s;
    }
  }
  void top;
  return playAction(g, bot, best);
}

function playAction(g, bot, card) {
  const rest = bot.hand.filter((c) => c.id !== card.id);
  return {
    t: "play",
    card: card.id,
    color: isWild(card) ? bestColor(rest) : undefined,
    uno: rest.length === 1 ? chance(0.82) : false,
  };
}

/** Un bot repère-t-il un joueur à 1 carte qui a oublié de dire UNO ? */
export const botCatches = (g, bot) => !!g.unoRisk && g.unoRisk.id !== bot.id && chance(0.55);

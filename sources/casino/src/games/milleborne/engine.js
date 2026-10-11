// Moteur du Mille Bornes : fonctions pures sur l'état de la partie (aucun timer ici).
import { LABEL, REMEDY_OF, SAFETIES, SAFETY_OF, kindOf, makeDeck } from "./cards.js";
import { secureRandomInt } from "../../lib/random.js";
import { fail, ok } from "../../lib/result.js";

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
export const HAND_SIZE = 6;
export const BOT_NAMES = ["Luna", "Max", "Zoé", "Noa", "Théo", "Inès", "Hugo", "Lola"];
export const DEFAULT_SETTINGS = { goal: 0, target: 0, turnMs: 30000, teams: true };
export const GOALS = [0, 700, 1000]; // 0 = règle officielle : 700 km en individuel, 1000 km en équipes
export const TARGETS = [0, 5000];
export const TURN_CHOICES = [0, 20000, 30000, 60000];

const MAX_LOG = 60;
const find = (g, id) => g.players.find((p) => p.id === id);

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createMbGame() {
  return {
    game: "milleborne",
    phase: "lobby", // lobby | playing | roundEnd | end
    players: [],
    hostId: null,
    settings: { ...DEFAULT_SETTINGS },
    deck: [],
    discard: [],
    turn: 0,
    round: 0,
    dealer: 0,
    effect: null, // carte posée dont la suite n'est pas encore jouée (animation, fenêtre du coup fourré)
    endReason: null,
    winner: null,
    log: [],
    seq: 0,
    botSeq: 0,
    startedAt: null,
    stats: { turns: 0, hazards: 0, coups: 0 },
  };
}

function note(g, text, tone) {
  g.log.push({ id: ++g.seq, at: Date.now(), text, tone });
  if (g.log.length > MAX_LOG) g.log.splice(0, g.log.length - MAX_LOG);
}

/* ---------- salle ---------- */

export function addPlayer(g, id, name, { bot = false } = {}) {
  if (find(g, id)) return fail("deja present");
  if (g.phase !== "lobby") return fail("partie en cours");
  if (g.players.length >= MAX_PLAYERS) return fail("table pleine");
  const base = String(name || "Joueur").trim().slice(0, 16) || "Joueur";
  let nm = base;
  for (let i = 2; g.players.some((p) => p.name === nm); i++) nm = `${base} ${i}`;
  g.players.push({ id, name: nm, bot, hand: [], score: 0, afk: 0, left: false, team: 0, car: freshCar(), breakdown: [] });
  if (!g.hostId) g.hostId = id;
  return ok();
}

const freshCar = () => ({ km: 0, battle: null, limit: false, safeties: [], coups: [], n200: 0 });

/** Équipes de 2 à 4 et 6 joueurs (règle officielle), partenaires assis en alternance. */
export const teamMode = (g) => g.settings.teams && (g.players.length === 4 || g.players.length === 6);

export function addBot(g) {
  const used = new Set(g.players.map((p) => p.name));
  const name = BOT_NAMES.find((n) => !used.has(n)) || "Bot";
  return addPlayer(g, "bot-" + ++g.botSeq, name, { bot: true });
}

export function removeBot(g) {
  if (g.phase !== "lobby") return fail("partie en cours");
  const bots = g.players.filter((p) => p.bot);
  if (!bots.length) return fail("aucun bot");
  g.players = g.players.filter((p) => p !== bots[bots.length - 1]);
  return ok();
}

export function removePlayer(g, id) {
  const p = find(g, id);
  if (!p) return fail("absent");
  if (g.phase === "lobby" || g.phase === "end") g.players = g.players.filter((x) => x !== p);
  else {
    p.bot = true;
    p.left = true;
    note(g, `${p.name} s'est déconnecté : un bot conduit à sa place.`, "info");
  }
  if (g.hostId === id) g.hostId = g.players.find((x) => !x.bot)?.id || null;
  return ok();
}

export function fillWithBots(g, min = 2) {
  while (g.players.length < min) addBot(g);
}

export function setSettings(g, patch) {
  if (g.phase !== "lobby") return fail("partie en cours");
  if (GOALS.includes(patch.goal)) g.settings.goal = patch.goal;
  if (TARGETS.includes(patch.target)) g.settings.target = patch.target;
  if (TURN_CHOICES.includes(patch.turnMs)) g.settings.turnMs = patch.turnMs;
  if ("teams" in patch) g.settings.teams = !!patch.teams;
  return ok();
}

/* ---------- règles ---------- */

const has = (p, s) => p.car.safeties.includes(s);

/** Le véhicule roule : feu vert, ou Prioritaire sans attaque en cours. */
export function rolling(p) {
  if (p.car.battle === "go") return true;
  return has(p, "prio") && (p.car.battle === null || kindOf(p.car.battle) === "remedy");
}

/** Cibles possibles d'une carte pour le joueur p : [] = injouable, ["self"] = sur soi. */
export function targetsFor(g, p, k) {
  const kind = kindOf(k);
  const goal = g.goal;
  if (kind === "dist") {
    const v = Number(k);
    const okd = rolling(p) && (!p.car.limit || v <= 50) && p.car.km + v <= goal && (v !== 200 || p.car.n200 < 2);
    return okd ? ["self"] : [];
  }
  if (kind === "safety") return ["self"];
  if (kind === "remedy") {
    if (k === "go") {
      const okg = !has(p, "prio") && (p.car.battle === null || p.car.battle === "stop" || ["rep", "fuel", "spare"].includes(p.car.battle));
      return okg ? ["self"] : [];
    }
    if (k === "unlim") return p.car.limit ? ["self"] : [];
    return p.car.battle && REMEDY_OF[p.car.battle] === k ? ["self"] : [];
  }
  const seen = new Set([p.car]);
  return g.players
    .filter((t) => !seen.has(t.car) && seen.add(t.car) && !has(t, SAFETY_OF[k]) && (k === "limit" ? !t.car.limit : rolling(t)))
    .map((t) => t.id);
}

export const currentPlayer = (g) => g.players[g.turn];

function refillDraw(g, p) {
  const c = g.deck.pop();
  if (c) p.hand.push(c);
  return c;
}

export function startGame(g) {
  if (g.phase !== "lobby") return fail("partie en cours");
  if (g.players.length < MIN_PLAYERS) return fail("pas assez de joueurs");
  g.players.forEach((p) => (p.score = 0));
  g.round = 0;
  g.winner = null;
  g.startedAt = Date.now();
  g.gameId = crypto.randomUUID();
  g.stats = { turns: 0, hazards: 0, coups: 0 };
  g.dealer = secureRandomInt(g.players.length);
  return dealHand(g);
}

function dealHand(g) {
  g.round++;
  g.phase = "playing";
  g.deck = shuffle(makeDeck());
  g.discard = [];
  g.effect = null;
  g.endReason = null;
  const teams = teamMode(g);
  g.goal = g.settings.goal || (teams ? 1000 : 700);
  const half = g.players.length / 2;
  g.players.forEach((p, i) => {
    p.team = teams ? i % half : i;
    p.car = teams && i >= half ? g.players[i - half].car : freshCar();
    p.breakdown = [];
    p.hand = [];
  });
  for (let i = 0; i < HAND_SIZE; i++) g.players.forEach((p) => refillDraw(g, p));
  g.turn = (g.dealer + 1) % g.players.length;
  note(g, `Manche ${g.round} : objectif ${g.goal} km. Il faut un feu vert pour partir !`, "info");
  startTurn(g);
  return ok();
}

/** Début de tour : le joueur pioche une carte (s'il en reste). Les mains vides sont sautées quand le talon est épuisé. */
function startTurn(g) {
  for (let i = 0; i < g.players.length; i++) {
    const p = currentPlayer(g);
    if (g.deck.length || p.hand.length) {
      refillDraw(g, p);
      g.stats.turns++;
      return;
    }
    g.turn = (g.turn + 1) % g.players.length;
  }
  endHand(g, "deck");
}

function guard(g, id) {
  if (g.phase !== "playing") return fail("pas de partie");
  if (g.effect) return fail("attends la fin de l'animation");
  const p = currentPlayer(g);
  if (!p || p.id !== id) return fail("pas ton tour");
  return ok({ p });
}

function applySafety(p, s) {
  p.car.safeties.push(s);
  if (s === "prio") {
    p.car.limit = false;
    if (p.car.battle === "stop") p.car.battle = null;
  } else if (p.car.battle && SAFETY_OF[p.car.battle] === s) p.car.battle = null;
}

export function play(g, id, cardId, targetId) {
  const r = guard(g, id);
  if (!r.ok) return r;
  const p = r.p;
  const card = p.hand.find((c) => c.id === cardId);
  if (!card) return fail("carte absente");
  const targets = targetsFor(g, p, card.k);
  if (!targets.length) return fail("carte injouable maintenant");
  const kind = kindOf(card.k);
  let target = targets[0] === "self" ? p.id : targetId;
  if (kind === "hazard" && !targets.includes(target)) {
    if (targets.length === 1) target = targets[0];
    else return fail("choisis une cible");
  }
  p.hand = p.hand.filter((c) => c !== card);
  p.afk = 0;
  const t = find(g, target);
  g.effect = { id: ++g.seq, by: p.id, card, kind, target, coup: false };
  if (kind === "dist") {
    p.car.km += Number(card.k);
    if (card.k === "200") p.car.n200++;
    note(g, `${p.name} avance de ${card.k} km (${p.car.km} km).`);
    if (p.car.km === g.goal) g.effect.finish = true;
  } else if (kind === "hazard") {
    g.stats.hazards++;
    note(g, `${p.name} pose ${LABEL[card.k]} sur ${t.name} !`, "hazard");
  } else if (kind === "remedy") {
    if (card.k === "unlim") p.car.limit = false;
    else p.car.battle = card.k;
    note(g, `${p.name} joue ${LABEL[card.k]}.`);
  } else {
    applySafety(p, card.k);
    note(g, `${p.name} pose la botte ${LABEL[card.k]} et rejoue.`, "safety");
  }
  if (kind !== "hazard") g.discard.push(card);
  return ok();
}

export function discard(g, id, cardId) {
  const r = guard(g, id);
  if (!r.ok) return r;
  const p = r.p;
  const card = p.hand.find((c) => c.id === cardId);
  if (!card) return fail("carte absente");
  p.hand = p.hand.filter((c) => c !== card);
  p.afk = 0;
  g.discard.push(card);
  g.effect = { id: ++g.seq, by: p.id, card, kind: "discard", target: p.id };
  note(g, `${p.name} défausse ${LABEL[card.k]}.`, "info");
  return ok();
}

/** Le joueur visé peut-il répondre par un coup fourré ? */
export function canCoup(g, id) {
  const e = g.effect;
  const t = find(g, id);
  if (!e || !t || e.kind !== "hazard" || e.coup || find(g, e.target).car !== t.car) return false;
  return !!t?.hand.some((c) => c.k === SAFETY_OF[e.card.k]);
}

export function coupFourre(g, id) {
  if (!canCoup(g, id)) return fail("trop tard");
  const e = g.effect;
  const t = find(g, id);
  const s = SAFETY_OF[e.card.k];
  const card = t.hand.find((c) => c.k === s);
  t.hand = t.hand.filter((c) => c !== card);
  applySafety(t, s);
  t.car.coups.push(s);
  g.discard.push(e.card);
  refillDraw(g, t);
  e.coup = true;
  e.coupCard = card;
  e.coupBy = t.id;
  g.stats.coups++;
  note(g, `COUP FOURRÉ de ${t.name} avec ${LABEL[s]} !`, "safety");
  return ok();
}

/** Suite de la carte posée, appelée par l'hôte après l'animation. */
export function resolveEffect(g) {
  const e = g.effect;
  if (!e || g.phase !== "playing") return;
  g.effect = null;
  if (e.kind === "hazard" && !e.coup) {
    const t = find(g, e.target);
    if (e.card.k === "limit") t.car.limit = true;
    else t.car.battle = e.card.k;
    g.discard.push(e.card);
  }
  if (e.finish) return endHand(g, "trip", e.by);
  if (e.coup) g.turn = g.players.findIndex((p) => p.id === e.coupBy);
  else if (e.kind !== "safety") g.turn = (g.turn + 1) % g.players.length;
  startTurn(g);
}

/* ---------- fin de manche ---------- */

function endHand(g, reason, finisherId = null) {
  g.effect = null;
  g.endReason = reason;
  const done = new Map();
  const finCar = find(g, finisherId)?.car;
  for (const p of g.players) {
    if (done.has(p.car)) {
      const mate = done.get(p.car);
      p.breakdown = mate.breakdown;
      p.handScore = mate.handScore;
      p.score += p.handScore;
      continue;
    }
    done.set(p.car, p);
    const b = [];
    if (p.car.km) b.push({ label: "Distance", pts: p.car.km });
    if (p.car.safeties.length) b.push({ label: `${p.car.safeties.length} botte${p.car.safeties.length > 1 ? "s" : ""}`, pts: p.car.safeties.length * 100 });
    if (p.car.safeties.length === SAFETIES.length) b.push({ label: "Les 4 bottes", pts: 300 });
    if (p.car.coups.length) b.push({ label: `${p.car.coups.length} coup${p.car.coups.length > 1 ? "s" : ""} fourré${p.car.coups.length > 1 ? "s" : ""}`, pts: p.car.coups.length * 300 });
    if (p.car === finCar) {
      b.push({ label: "Voyage terminé", pts: 400 });
      if (!g.deck.length) b.push({ label: "Allonge (talon épuisé)", pts: 300 });
      if (p.car.n200 === 0) b.push({ label: "Sans 200 km", pts: 300 });
      if (g.players.every((o) => o.car === p.car || o.car.km === 0)) b.push({ label: "Capot (adversaires à 0)", pts: 500 });
    }
    p.breakdown = b;
    p.handScore = b.reduce((s, x) => s + x.pts, 0);
    p.score += p.handScore;
  }
  const fin = find(g, finisherId);
  note(g, fin ? `${fin.name} boucle ses ${g.goal} km !` : "Plus de cartes : fin de la manche.", "info");
  const best = [...g.players].sort((a, b) => b.score - a.score)[0];
  g.roundWinner = (fin || [...g.players].sort((a, b) => b.handScore - a.handScore)[0]).id;
  const over = g.settings.target === 0 || best.score >= g.settings.target;
  g.phase = over ? "end" : "roundEnd";
  if (over) {
    g.winner = best.id;
    g.endedAt = Date.now();
  }
}

export function nextRound(g) {
  if (g.phase !== "roundEnd") return fail("pas maintenant");
  g.dealer = (g.dealer + 1) % g.players.length;
  return dealHand(g);
}

export function backToLobby(g) {
  if (g.phase !== "end") return fail("pas maintenant");
  g.phase = "lobby";
  g.players = g.players.filter((p) => !p.left);
  g.players.forEach((p) => Object.assign(p, { car: freshCar(), breakdown: [], hand: [], score: 0 }));
  g.effect = null;
  g.log = [];
  return ok();
}

/* ---------- vue filtrée ---------- */

export function viewFor(g, viewer) {
  const me = find(g, viewer);
  const reveal = g.phase === "roundEnd" || g.phase === "end";
  const e = g.effect;
  return {
    game: "milleborne",
    phase: g.phase,
    hostId: g.hostId,
    settings: { ...g.settings },
    round: g.round,
    goal: g.goal || g.settings.goal || 700,
    turn: g.phase === "playing" ? currentPlayer(g)?.id : null,
    deckCount: g.deck.length,
    discardTop: g.discard[g.discard.length - 1] || null,
    effect: e
      ? { id: e.id, by: e.by, card: e.card, kind: e.kind, target: e.target, coup: e.coup, coupCard: e.coupCard || null, coupBy: e.coupBy || null, finish: !!e.finish }
      : null,
    canCoup: canCoup(g, viewer),
    endReason: g.endReason,
    roundWinner: g.roundWinner || null,
    winner: g.winner,
    log: g.log.slice(-20),
    hand: me ? me.hand : [],
    legal:
      me && g.phase === "playing" && !e && currentPlayer(g) === me
        ? Object.fromEntries(me.hand.map((c) => [c.id, targetsFor(g, me, c.k)]))
        : {},
    players: g.players.map((p) => ({
      id: p.id,
      name: p.name,
      bot: p.bot,
      count: p.hand.length,
      team: p.team,
      teams: teamMode(g),
      km: p.car.km,
      battle: p.car.battle,
      rolling: rolling(p),
      limit: p.car.limit,
      safeties: p.car.safeties,
      coups: p.car.coups,
      n200: p.car.n200,
      score: p.score,
      handScore: reveal ? p.handScore : null,
      breakdown: reveal ? p.breakdown : [],
    })),
  };
}

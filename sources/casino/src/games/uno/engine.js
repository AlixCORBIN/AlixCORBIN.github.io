// Moteur du UNO : fonctions pures sur l'état de la partie (aucun timer ici).
import { COLORS, COLOR_NAME, VALUE_LABEL, isPlayable, makeDeck, points } from "./cards.js";
import { secureRandomInt } from "../../lib/random.js";
import { fail, ok } from "../../lib/result.js";

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 10;
export const HAND_SIZE = 7;
export const BOT_NAMES = ["Luna", "Max", "Zoé", "Noa", "Théo", "Inès", "Hugo", "Lola", "Gaspard", "Mila"];
export const DEFAULT_SETTINGS = {
  stack: false, // cumul des +2 / +4 (désactive le défi du +4)
  target: 0, // 0 = une seule manche, sinon score à atteindre
  turnMs: 30000, // 0 = pas de limite
};
export const TARGETS = [0, 200, 500];
export const TURN_CHOICES = [0, 15000, 30000, 60000];

const MAX_LOG = 60;
const find = (g, id) => g.players.find((p) => p.id === id);
const pick = (arr) => arr[secureRandomInt(arr.length)];

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createUnoGame() {
  return {
    game: "uno",
    phase: "lobby", // lobby | playing | roundEnd | end
    players: [],
    hostId: null,
    settings: { ...DEFAULT_SETTINGS },
    deck: [],
    discard: [],
    color: null,
    dir: 1,
    turn: 0,
    round: 0,
    dealer: 0,
    pending: 0,
    pendingType: null,
    drawn: null, // id de la carte piochée et jouable (le joueur peut la jouer ou passer)
    challenge: null, // { from, to, prevColor, bluff } après un +4 (défi possible)
    unoRisk: null, // { id } : joueur à 1 carte qui n'a pas dit UNO
    last: null, // { id, card } dernière carte jouée (animation)
    roundWinner: null,
    roundPts: 0,
    winner: null,
    log: [],
    seq: 0,
    botSeq: 0,
    startedAt: null,
    turnStartedAt: null,
    stats: { turns: 0, plays: 0, draws: 0, specials: 0, challenges: 0, catches: 0 },
  };
}

/* ---------- journal ---------- */

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
  g.players.push({ id, name: nm, bot, hand: [], score: 0, uno: false, afk: 0, left: false });
  if (!g.hostId) g.hostId = id;
  return ok();
}

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
  if (g.phase === "lobby" || g.phase === "end") {
    g.players = g.players.filter((x) => x !== p);
  } else {
    // En pleine partie, un bot reprend la main du joueur parti.
    p.bot = true;
    p.left = true;
    note(g, `${p.name} s'est déconnecté : un bot joue à sa place.`, "info");
  }
  if (g.hostId === id) g.hostId = g.players.find((x) => !x.bot)?.id || null;
  return ok();
}

export function fillWithBots(g, min = 3) {
  while (g.players.length < min) addBot(g);
}

export function setSettings(g, patch) {
  if (g.phase !== "lobby") return fail("partie en cours");
  if ("stack" in patch) g.settings.stack = !!patch.stack;
  if ("target" in patch && TARGETS.includes(patch.target)) g.settings.target = patch.target;
  if ("turnMs" in patch && TURN_CHOICES.includes(patch.turnMs)) g.settings.turnMs = patch.turnMs;
  return ok();
}

/* ---------- paquet ---------- */

export const topCard = (g) => g.discard[g.discard.length - 1] || null;

function refill(g) {
  if (g.deck.length > 0 || g.discard.length <= 1) return;
  const keep = g.discard.pop();
  g.deck = shuffle(g.discard);
  g.discard = [keep];
  note(g, "Le talon est mélangé.", "info");
}

function drawCards(g, p, n) {
  let got = 0;
  for (let i = 0; i < n; i++) {
    refill(g);
    const c = g.deck.pop();
    if (!c) break;
    p.hand.push(c);
    got++;
  }
  g.stats.draws += got;
  if (got) p.uno = false;
  return got;
}

/* ---------- manche ---------- */

export function startGame(g) {
  if (g.phase !== "lobby") return fail("deja lance");
  if (g.players.length < MIN_PLAYERS) return fail("pas assez de joueurs");
  g.round = 0;
  g.startedAt = Date.now();
  g.winner = null;
  g.log = [];
  g.stats = { turns: 0, plays: 0, draws: 0, specials: 0, challenges: 0, catches: 0 };
  g.players.forEach((p) => {
    p.score = 0;
    p.afk = 0;
  });
  dealRound(g);
  return ok();
}

export function dealRound(g) {
  const n = g.players.length;
  g.round++;
  g.deck = shuffle(makeDeck());
  g.discard = [];
  g.pending = 0;
  g.pendingType = null;
  g.drawn = null;
  g.challenge = null;
  g.unoRisk = null;
  g.last = null;
  g.roundWinner = null;
  g.roundPts = 0;
  g.dir = 1;
  g.players.forEach((p) => {
    p.hand = [];
    p.uno = false;
  });
  for (let i = 0; i < HAND_SIZE; i++) g.players.forEach((p) => p.hand.push(g.deck.pop()));
  // Carte de départ : un +4 est remis dans le talon.
  let start = g.deck.pop();
  while (start.v === "wd4") {
    g.deck.splice(secureRandomInt(g.deck.length + 1), 0, start);
    start = g.deck.pop();
  }
  g.discard.push(start);
  g.color = start.c === "w" ? pick(COLORS) : start.c;
  g.dealer = (n - 1 + (g.round - 1)) % n;
  g.turn = (g.dealer + 1) % n;
  g.phase = "playing";
  g.phaseStart = Date.now();
  note(g, `Manche ${g.round} : c'est parti !`, "info");
  // Effet de la carte de départ.
  if (start.v === "skip") {
    note(g, `${g.players[g.turn].name} passe son tour (carte de départ).`, "info");
    advance(g, 1);
  } else if (start.v === "rev") {
    g.dir = -1;
    g.turn = g.dealer;
    note(g, "Le sens du jeu est inversé dès le départ.", "info");
  } else if (start.v === "d2") {
    const p = g.players[g.turn];
    drawCards(g, p, 2);
    note(g, `${p.name} pioche 2 cartes (carte de départ).`, "info");
    advance(g, 1);
  } else if (start.v === "wild") {
    note(g, `Le joker de départ donne ${COLOR_NAME[g.color]}.`, "info");
  }
  g.turnStartedAt = Date.now();
}

function advance(g, steps = 1) {
  const n = g.players.length;
  g.turn = (((g.turn + g.dir * steps) % n) + n) % n;
  g.turnStartedAt = Date.now();
  g.drawn = null;
}

const turnPlayer = (g) => g.players[g.turn];

function clearRisk(g, actorId) {
  if (g.unoRisk && g.unoRisk.id !== actorId) g.unoRisk = null;
}

/* ---------- actions ---------- */

export function legalCards(g, p) {
  if (g.phase !== "playing" || turnPlayer(g)?.id !== p.id || g.challenge) return [];
  const top = topCard(g);
  if (g.drawn != null) {
    const c = p.hand.find((x) => x.id === g.drawn);
    return c ? [c] : [];
  }
  return p.hand.filter((c) => isPlayable(c, top, g.color, g.pending, g.pendingType));
}

export function play(g, id, cardId, color, uno = false) {
  if (g.phase !== "playing") return fail("pas en jeu");
  const p = find(g, id);
  if (!p) return fail("joueur inconnu");
  if (turnPlayer(g).id !== id) return fail("ce n'est pas ton tour");
  if (g.challenge) return fail("réponds d'abord au +4");
  const card = p.hand.find((c) => c.id === cardId);
  if (!card) return fail("carte absente");
  if (!legalCards(g, p).some((c) => c.id === cardId)) return fail("carte non jouable");
  if (card.c === "w" && !COLORS.includes(color)) return fail("choisis une couleur");

  const prevColor = g.color;
  // Un +4 est « légal » seulement sans carte de la couleur courante (sinon c'est un bluff).
  const bluff =
    card.v === "wd4" && p.hand.some((c) => c.id !== card.id && c.c === prevColor && c.c !== "w");

  p.hand = p.hand.filter((c) => c.id !== cardId);
  g.discard.push(card);
  g.color = card.c === "w" ? color : card.c;
  g.drawn = null;
  g.last = { id, card, at: Date.now() };
  g.stats.plays++;
  g.stats.turns++;
  if (card.c === "w" || ["skip", "rev", "d2"].includes(card.v)) g.stats.specials++;
  clearRisk(g, id);

  const label = card.c === "w" ? `${VALUE_LABEL[card.v]} (${COLOR_NAME[color]})` : cardText(card);
  note(g, `${p.name} joue ${label}.`, "play");

  if (p.hand.length === 1) {
    if (uno || p.uno) {
      p.uno = true;
      note(g, `${p.name} : UNO !`, "uno");
    } else {
      g.unoRisk = { id };
    }
  } else {
    p.uno = false;
  }

  if (p.hand.length === 0) {
    finishWithPenalty(g, p, card);
    return ok();
  }

  applyEffect(g, p, card, prevColor, bluff);
  return ok();
}

function applyEffect(g, p, card, prevColor, bluff) {
  const n = g.players.length;
  switch (card.v) {
    case "skip": {
      advance(g, 1);
      note(g, `${turnPlayer(g).name} passe son tour.`, "info");
      advance(g, 1);
      break;
    }
    case "rev": {
      g.dir = -g.dir;
      note(g, "Le sens du jeu s'inverse.", "info");
      if (n === 2) {
        // À deux, l'inversion fait rejouer le même joueur.
        advance(g, 2);
      } else advance(g, 1);
      break;
    }
    case "d2": {
      if (g.settings.stack) {
        g.pending += 2;
        g.pendingType = "d2";
        advance(g, 1);
      } else {
        advance(g, 1);
        const v = turnPlayer(g);
        drawCards(g, v, 2);
        note(g, `${v.name} pioche 2 cartes et passe.`, "info");
        advance(g, 1);
      }
      break;
    }
    case "wd4": {
      if (g.settings.stack) {
        g.pending += 4;
        g.pendingType = "wd4";
        advance(g, 1);
      } else {
        advance(g, 1);
        g.challenge = { from: p.id, to: turnPlayer(g).id, prevColor, bluff };
        note(g, `${turnPlayer(g).name} peut défier le +4 ou piocher 4 cartes.`, "info");
      }
      break;
    }
    default:
      advance(g, 1);
  }
}

/** La dernière carte est jouée : la victime d'un +2 / +4 pioche encore, puis on compte les points. */
function finishWithPenalty(g, winner, card) {
  const n = g.players.length;
  if (card.v === "d2" || card.v === "wd4") {
    const amount = (card.v === "d2" ? 2 : 4) + g.pending;
    const v = g.players[(((g.turn + g.dir) % n) + n) % n];
    drawCards(g, v, amount);
    note(g, `${v.name} pioche ${amount} cartes.`, "info");
    g.pending = 0;
    g.pendingType = null;
  }
  endRound(g, winner);
}

export function draw(g, id) {
  if (g.phase !== "playing") return fail("pas en jeu");
  const p = find(g, id);
  if (!p) return fail("joueur inconnu");
  if (turnPlayer(g).id !== id) return fail("ce n'est pas ton tour");
  if (g.challenge) return fail("réponds d'abord au +4");
  if (g.drawn != null) return fail("joue la carte piochée ou passe");
  clearRisk(g, id);
  g.stats.turns++;
  if (g.pending > 0) {
    const n = g.pending;
    drawCards(g, p, n);
    note(g, `${p.name} pioche ${n} cartes.`, "info");
    g.pending = 0;
    g.pendingType = null;
    advance(g, 1);
    return ok();
  }
  const before = p.hand.length;
  drawCards(g, p, 1);
  const c = p.hand[p.hand.length - 1];
  if (p.hand.length === before || !c) {
    note(g, `${p.name} ne peut pas piocher et passe.`, "info");
    advance(g, 1);
    return ok();
  }
  if (isPlayable(c, topCard(g), g.color)) {
    g.drawn = c.id;
    note(g, `${p.name} pioche une carte.`, "info");
  } else {
    note(g, `${p.name} pioche une carte et passe.`, "info");
    advance(g, 1);
  }
  return ok();
}

export function pass(g, id) {
  if (g.phase !== "playing") return fail("pas en jeu");
  if (turnPlayer(g).id !== id) return fail("ce n'est pas ton tour");
  if (g.drawn == null) return fail("pioche d'abord");
  const p = find(g, id);
  note(g, `${p.name} garde la carte et passe.`, "info");
  advance(g, 1);
  return ok();
}

/** Réponse au +4 : défier (le joueur a-t-il bluffé ?) ou accepter de piocher 4 cartes. */
export function challenge(g, id) {
  const c = g.challenge;
  if (!c || c.to !== id) return fail("rien à défier");
  const target = find(g, c.to);
  const from = find(g, c.from);
  g.challenge = null;
  clearRisk(g, id);
  g.stats.challenges++;
  if (c.bluff) {
    drawCards(g, from, 4);
    note(g, `Défi réussi ! ${from.name} bluffait et pioche 4 cartes.`, "uno");
    g.turnStartedAt = Date.now();
  } else {
    drawCards(g, target, 6);
    note(g, `Défi raté : ${target.name} pioche 6 cartes et passe.`, "uno");
    advance(g, 1);
  }
  return ok();
}

export function accept(g, id) {
  const c = g.challenge;
  if (!c || c.to !== id) return fail("rien à accepter");
  const target = find(g, c.to);
  g.challenge = null;
  clearRisk(g, id);
  drawCards(g, target, 4);
  note(g, `${target.name} pioche 4 cartes et passe.`, "info");
  advance(g, 1);
  return ok();
}

/** UNO ! : prévient la pénalité (à 1 carte) ou s'arme à l'avance (à 2 cartes, avant de jouer). */
export function sayUno(g, id) {
  const p = find(g, id);
  if (!p) return fail("joueur inconnu");
  if (g.phase !== "playing") return fail("pas en jeu");
  if (p.hand.length === 1) {
    if (g.unoRisk?.id === id) g.unoRisk = null;
    if (!p.uno) {
      p.uno = true;
      note(g, `${p.name} : UNO !`, "uno");
    }
    return ok();
  }
  if (p.hand.length === 2) {
    p.uno = true;
    return ok();
  }
  return fail("pas besoin");
}

/** Prendre un joueur à 1 carte qui n'a pas dit UNO : il pioche 2 cartes. */
export function catchUno(g, id, targetId) {
  const risk = g.unoRisk;
  if (!risk || risk.id !== targetId || id === targetId) return fail("trop tard");
  const catcher = find(g, id);
  const target = find(g, targetId);
  if (!catcher || !target || target.hand.length !== 1 || target.uno) return fail("trop tard");
  g.unoRisk = null;
  drawCards(g, target, 2);
  g.stats.catches++;
  note(g, `${catcher.name} a surpris ${target.name} sans UNO : +2 cartes !`, "uno");
  return ok();
}

/** Temps écoulé : action automatique pour que la partie ne reste jamais bloquée. */
export function timeoutTurn(g) {
  if (g.phase !== "playing") return fail("pas en jeu");
  const p = turnPlayer(g);
  if (!p) return fail("pas de joueur");
  if (!p.bot) {
    p.afk++;
    if (p.afk >= 3) {
      p.bot = true;
      p.left = true;
      note(g, `${p.name} est absent : un bot prend sa place.`, "info");
    }
  }
  if (g.challenge) return accept(g, g.challenge.to);
  if (g.drawn != null) return pass(g, p.id);
  return draw(g, p.id);
}

/* ---------- fin de manche ---------- */

function endRound(g, winner) {
  const pts = g.players.filter((p) => p !== winner).reduce((s, p) => s + p.hand.reduce((a, c) => a + points(c), 0), 0);
  winner.score += pts;
  g.roundWinner = winner.id;
  g.roundPts = pts;
  g.challenge = null;
  g.drawn = null;
  g.unoRisk = null;
  g.pending = 0;
  g.pendingType = null;
  note(g, `${winner.name} gagne la manche (+${pts} points).`, "uno");
  const target = g.settings.target;
  if (target > 0 && winner.score < target) {
    g.phase = "roundEnd";
  } else {
    // Fin de partie : le meilleur score gagne (la manche unique donne le vainqueur de la manche).
    const best = [...g.players].sort((a, b) => b.score - a.score)[0];
    g.winner = target > 0 ? best.id : winner.id;
    g.phase = "end";
    g.endedAt = Date.now();
  }
}

export function nextRound(g) {
  if (g.phase !== "roundEnd") return fail("pas de manche à lancer");
  dealRound(g);
  return ok();
}

export function backToLobby(g) {
  g.phase = "lobby";
  g.winner = null;
  g.roundWinner = null;
  g.players = g.players.filter((p) => !p.left);
  g.players.forEach((p) => {
    p.hand = [];
    p.score = 0;
    p.uno = false;
    p.afk = 0;
  });
  if (!g.players.find((p) => p.id === g.hostId)) g.hostId = g.players.find((p) => !p.bot)?.id || null;
  return ok();
}

/* ---------- vue filtrée ---------- */

export const cardText = (c) => {
  const v = VALUE_LABEL[c.v] || c.v;
  return `${v} ${COLOR_NAME[c.c].toLowerCase()}`;
};

/** Vue d'un joueur : sa main en clair, celle des autres réduite à un nombre de cartes. */
export function viewFor(g, viewerId) {
  const reveal = g.phase === "roundEnd" || g.phase === "end";
  const viewer = find(g, viewerId);
  const cur = g.phase === "playing" ? turnPlayer(g) : null;
  return {
    game: "uno",
    phase: g.phase,
    hostId: g.hostId,
    settings: g.settings,
    round: g.round,
    dir: g.dir,
    color: g.color,
    turn: cur?.id || null,
    pending: g.pending,
    pendingType: g.pendingType,
    drawn: cur && cur.id === viewerId ? g.drawn : null,
    challenge: g.challenge ? { from: g.challenge.from, to: g.challenge.to } : null,
    unoRisk: g.unoRisk ? { id: g.unoRisk.id } : null,
    top: topCard(g),
    discard: g.discard.slice(-6),
    deckCount: g.deck.length,
    last: g.last ? { id: g.last.id, card: g.last.card, at: g.last.at } : null,
    players: g.players.map((p) => ({
      id: p.id,
      name: p.name,
      bot: p.bot,
      left: p.left,
      count: p.hand.length,
      score: p.score,
      uno: p.uno,
      hand: p.id === viewerId || reveal ? p.hand : undefined,
    })),
    hand: viewer ? viewer.hand : [],
    playable: viewer ? legalCards(g, viewer).map((c) => c.id) : [],
    roundWinner: g.roundWinner,
    roundPts: g.roundPts,
    winner: g.winner,
    log: g.log.slice(-40),
  };
}

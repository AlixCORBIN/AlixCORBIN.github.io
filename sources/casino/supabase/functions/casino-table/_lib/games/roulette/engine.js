import { BETS, ROULETTE_RULES } from "./rules.js";
import { secureRandomInt } from "../../lib/random.js";
import { fail, ok } from "../../lib/result.js";

export function createRouletteGame() {
  return {
    game: "roulette",
    phase: "betting",
    round: 0,
    players: [],
    result: null,
    history: [],
    rng: {
      source: "crypto",
      spins: 0,
      at: Date.now(),
      signed: false,
      error: null,
    },
    buffer: [],
    bufferMeta: null,
    bufferProof: null,
    proofPrev: null,
  };
}

const findPlayer = (g, id) => g.players.find((p) => p.id === id);

export const totalBet = (player) =>
  player.bets.reduce((sum, b) => sum + b.amount, 0);

export function addPlayer(g, id, name, bankroll = 1000) {
  if (findPlayer(g, id)) {
    return fail("deja assis");
  }
  if (g.players.length >= 8) {
    return fail("table pleine");
  }
  g.players.push({
    id,
    name: String(name || "Joueur").slice(0, 16),
    bankroll: Math.max(0, Math.floor(bankroll)),
    startBankroll: Math.max(0, Math.floor(bankroll)),
    bets: [],
    lastBets: [],
    ready: false,
    net: 0,
    win: 0,
    stats: {
      credit: 0,
      spins: 0,
      wins: 0,
      wagered: 0,
      biggest: 0,
      peak: Math.floor(bankroll),
    },
  });
  return ok();
}

export function takeCredit(g, id) {
  const player = findPlayer(g, id);
  if (
    !player ||
    g.phase !== "betting" ||
    player.bankroll >= ROULETTE_RULES.minChip ||
    totalBet(player) > 0
  ) {
    return fail("credit refuse");
  }
  player.bankroll += ROULETTE_RULES.creditAmount;
  player.stats.credit += ROULETTE_RULES.creditAmount;
  return ok();
}

export function removePlayer(g, id) {
  const player = findPlayer(g, id);
  if (player) {
    if (g.phase === "betting") {
      g.players = g.players.filter((p) => p.id !== id);
      maybeSpin(g);
    } else {
      player.left = true;
    }
  }
  return ok();
}

export function placeBet(g, id, key, amount) {
  const player = findPlayer(g, id);
  if (!player) return fail("joueur inconnu");
  if (g.phase !== "betting" || player.ready) return fail("mises fermees");
  const bet = BETS.get(key);
  amount = Math.floor(Number(amount));
  if (!bet || !(amount >= ROULETTE_RULES.minChip)) return fail("mise invalide");
  if (amount > player.bankroll) return fail("solde insuffisant");
  player.bankroll -= amount;
  player.stats.wagered += amount;
  const existing = player.bets.find((b) => b.key === key);
  if (existing) {
    existing.amount += amount;
  } else {
    player.bets.push({
      key,
      amount,
    });
  }
  player.undo = [
    ...(player.undo || []),
    {
      key,
      amount,
    },
  ];
  return ok();
}

export function undoBet(g, id) {
  const player = findPlayer(g, id);
  if (!player || g.phase !== "betting" || player.ready || !player.undo?.length)
    return fail("rien a annuler");
  const last = player.undo.pop();
  const bet = player.bets.find((b) => b.key === last.key);
  if (bet) {
    bet.amount -= last.amount;
    if (bet.amount <= 0) {
      player.bets = player.bets.filter((b) => b !== bet);
    }
  }
  player.bankroll += last.amount;
  player.stats.wagered -= last.amount;
  return ok();
}

export function clearBets(g, id) {
  const player = findPlayer(g, id);
  if (!player || g.phase !== "betting" || player.ready)
    return fail("impossible");
  const total = totalBet(player);
  player.bankroll += total;
  player.stats.wagered -= total;
  player.bets = [];
  player.undo = [];
  return ok();
}

export function rebet(g, id) {
  const player = findPlayer(g, id);
  if (!player || g.phase !== "betting" || player.ready)
    return fail("impossible");
  clearBets(g, id);
  const total = player.lastBets.reduce((sum, b) => sum + b.amount, 0);
  if (!total || total > player.bankroll) return fail("solde insuffisant");
  for (const b of player.lastBets) {
    placeBet(g, id, b.key, b.amount);
  }
  return ok();
}

export function doubleBets(g, id) {
  const player = findPlayer(g, id);
  if (!player || g.phase !== "betting" || player.ready || !player.bets.length)
    return fail("impossible");
  if (totalBet(player) > player.bankroll) return fail("solde insuffisant");
  for (const b of [...player.bets]) {
    placeBet(g, id, b.key, b.amount);
  }
  return ok();
}

export function setReady(g, id, ready = true) {
  const player = findPlayer(g, id);
  if (!player || g.phase !== "betting") {
    return fail("impossible");
  }
  player.ready = !!ready;
  maybeSpin(g);
  return ok();
}

export function maybeSpin(g) {
  if (g.phase !== "betting") return;
  const betting = g.players.filter((p) => p.bets.length);
  if (
    betting.length &&
    g.players.every((p) => p.ready || !p.bets.length) &&
    betting.every((p) => p.ready)
  ) {
    spin(g);
  }
}

export function pushNumbers(g, values, meta) {
  g.buffer = [...g.buffer, ...values];
  g.bufferMeta = meta;
  if (meta.proof) {
    g.bufferProof = meta.proof;
  }
}

function nextNumber(g) {
  if (g.buffer.length) {
    const num = g.buffer.shift();
    g.rng = {
      source: g.bufferMeta.source,
      spins: g.rng.spins + 1,
      at: g.bufferMeta.at,
      signed: !!g.bufferMeta.proof,
      error: null,
    };
    if (!g.buffer.length && g.bufferProof) {
      g.proofPrev = {
        ...g.bufferProof,
        until: g.rng.spins,
      };
      g.bufferProof = null;
    }
    return num;
  }
  g.rng = {
    source: "crypto",
    spins: g.rng.spins + 1,
    at: Date.now(),
    signed: false,
    error: g.rng.error,
  };
  return secureRandomInt(37);
}

function spin(g) {
  if (g.phase !== "betting") return fail("impossible");
  for (const p of g.players) {
    p.ready = true;
    p.lastBets = p.bets.map((b) => ({
      ...b,
    }));
    p.net = 0;
    p.win = 0;
  }
  g.round++;
  g.result = nextNumber(g);
  g.phase = "spinning";
  return ok({
    result: g.result,
  });
}

export function resolveSpin(g) {
  if (g.phase !== "spinning") return fail("impossible");
  const result = g.result;
  for (const p of g.players) {
    if (!p.bets.length) continue;
    const staked = totalBet(p);
    let won = 0;
    for (const b of p.bets) {
      const bet = BETS.get(b.key);
      if (bet.nums.includes(result)) {
        won += b.amount * (bet.mult + 1);
      }
    }
    p.bankroll += won;
    p.win = won;
    p.net = won - staked;
    p.stats.spins++;
    if (won > 0) {
      p.stats.wins++;
    }
    p.stats.biggest = Math.max(p.stats.biggest, p.net);
    p.stats.peak = Math.max(p.stats.peak, p.bankroll);
  }
  g.history.unshift(result);
  g.history = g.history.slice(0, ROULETTE_RULES.historyLen);
  g.phase = "settle";
  return ok();
}

export function nextRound(g) {
  if (g.phase !== "settle") return fail("impossible");
  g.players = g.players.filter((p) => !p.left);
  for (const p of g.players) {
    p.bets = [];
    p.undo = [];
    p.ready = false;
    p.net = 0;
    p.win = 0;
  }
  g.phase = "betting";
  g.result = null;
  return ok();
}

export function publicView(g) {
  const { buffer, bufferMeta, bufferProof, ...rest } = g;
  const view = JSON.parse(JSON.stringify(rest));
  view.bufferLeft = buffer.length;
  if (g.phase === "betting") {
    view.result = null;
  }
  view.players.forEach((p) => {
    delete p.undo;
  });
  return view;
}

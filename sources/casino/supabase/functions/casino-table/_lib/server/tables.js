// Tables d'argent (blackjack, roulette) tenues par le serveur.
// Module pur : aucune dépendance navigateur. Il est copié dans l'Edge Function casino-table
// (tools/sync-server.mjs) et testé en Node (tools/test-tables.mjs).
// Le navigateur n'envoie que des intentions (miser, tirer, rester…) ; cartes, tirages,
// gains et soldes sont calculés ici, puis écrits en base par la fonction.
import * as BJ from "../games/blackjack/engine.js";
import * as RO from "../games/roulette/engine.js";
import { ROULETTE_RULES } from "../games/roulette/rules.js";

export const AFK_MS = 60000;
export const PEER_TIMEOUT_MS = 20000;
const GRACE_MS = 5000;
const MAX_PLAYERS = { blackjack: 5, roulette: 8 };

export const GAMES = ["blackjack", "roulette"];

export function createRoom(game, code, isPublic = false) {
  if (!GAMES.includes(game)) throw new Error("jeu inconnu");
  return {
    code,
    game,
    isPublic: !!isPublic,
    g: game === "blackjack" ? BJ.createBlackjackGame() : RO.createRouletteGame(),
    members: {}, // uid -> { name, seen, act, mii, session, kicked }
    timers: {}, // nom -> échéance (ms epoch)
    sig: "",
    afk: null,
    betAfk: null,
    graceAt: 0,
    settledAt: 0,
    deadline: 0,
    spins: [], // numéros sortis à enregistrer (stats roulette)
  };
}

const E = (room) => (room.game === "blackjack" ? BJ : RO);
const humans = (room) => room.g.players.filter((p) => !p.left);
const isMulti = (room) => humans(room).length > 1;

/* ---------- solde réglé (ce qu'on écrit dans le portefeuille) ---------- */
// Mise en cours de manche = perdue si on part ; mises encore modifiables = rendues.
export function walletValue(room, p) {
  const g = room.g;
  if (room.game === "roulette" && g.phase === "betting") return p.bankroll + RO.totalBet(p);
  return p.bankroll;
}

/* ---------- membres ---------- */
export function join(room, uid, name, bankroll, mii, now, session) {
  const m = room.members[uid];
  if (m?.kicked) delete room.members[uid];
  if (room.g.players.some((p) => p.id === uid)) {
    room.members[uid] = { ...room.members[uid], seen: now, act: now, mii: mii ?? room.members[uid]?.mii ?? null };
    return { ok: true };
  }
  if (room.g.players.length >= MAX_PLAYERS[room.game]) return { ok: false, error: "Table pleine" };
  const res = E(room).addPlayer(room.g, uid, name, bankroll);
  if (!res.ok) return res;
  room.members[uid] = { name, seen: now, act: now, mii: mii ?? null, session };
  schedule(room, now);
  return { ok: true };
}

export function leave(room, uid, now) {
  E(room).removePlayer(room.g, uid);
  delete room.members[uid];
  schedule(room, now);
}

function kick(room, uid, now) {
  E(room).removePlayer(room.g, uid);
  room.members[uid] = { ...(room.members[uid] || {}), kicked: true, seen: now };
}

export function dropStale(room, now) {
  const gone = [];
  for (const [uid, m] of Object.entries(room.members)) {
    if (m.kicked) {
      if (now - m.seen > 120000) delete room.members[uid];
      continue;
    }
    if (now - m.seen > PEER_TIMEOUT_MS) {
      E(room).removePlayer(room.g, uid);
      delete room.members[uid];
      gone.push(uid);
    }
  }
  if (gone.length) schedule(room, now);
  return gone;
}

/* ---------- actions des joueurs ---------- */
export function act(room, uid, a, now) {
  if (!a || typeof a !== "object" || typeof a.t !== "string") return { ok: false, error: "action invalide" };
  const m = room.members[uid];
  if (!m || m.kicked) return { ok: false, error: "pas a la table" };
  m.seen = now;
  m.act = now;
  const g = room.g;
  let res;
  if (room.game === "blackjack") {
    switch (a.t) {
      case "bet": res = BJ.setBets(g, uid, { bet: a.bet, pp: a.pp, t3: a.t3 }); break;
      case "rebet": res = BJ.rebet(g, uid); break;
      case "ready": res = BJ.setReady(g, uid, a.v !== false); break;
      case "credit": res = BJ.takeCredit(g, uid); break;
      case "insurance": res = BJ.decideInsurance(g, uid, !!a.take); break;
      case "hit": res = BJ.hit(g, uid); break;
      case "stand": res = BJ.stand(g, uid); break;
      case "double": res = BJ.doubleDown(g, uid); break;
      case "split": res = BJ.split(g, uid); break;
      case "next":
        res = g.phase === "settle" && now - room.settledAt > 1200 ? BJ.nextRound(g) : { ok: false };
        break;
      default: res = { ok: false, error: "action inconnue" };
    }
  } else {
    switch (a.t) {
      case "bet": res = RO.placeBet(g, uid, String(a.key), a.amount); break;
      case "credit": res = RO.takeCredit(g, uid); break;
      case "undo": res = RO.undoBet(g, uid); break;
      case "clear": res = RO.clearBets(g, uid); break;
      case "rebet": res = RO.rebet(g, uid); break;
      case "double": res = RO.doubleBets(g, uid); break;
      case "ready": res = isMulti(room) ? { ok: false } : RO.setReady(g, uid, a.v !== false); break;
      case "next":
        res = g.phase === "settle" && now - room.settledAt > 1500 ? RO.nextRound(g) : { ok: false };
        break;
      default: res = { ok: false, error: "action inconnue" };
    }
  }
  res = res || { ok: false };
  if (res.ok) schedule(room, now);
  return res;
}

/* ---------- minuteries (échéances stockées, déclenchées à chaque appel) ---------- */
function arm(room, name, at) {
  room.timers[name] = at;
}

function fire(room, name, now) {
  const g = room.g;
  delete room.timers[name];
  if (room.game === "blackjack") {
    if (name === "dealer") {
      const { more } = BJ.dealerStep(g);
      if (!more) room.settledAt = now;
    } else if (name === "next") BJ.nextRound(g);
    else if (name === "ins") BJ.closeInsurance(g);
    else if (name === "turn") {
      const id = room.afk?.id;
      if (id) {
        BJ.stand(g, id);
        kick(room, id, now);
      }
    } else if (name === "bet") {
      const armedAt = room.betArmedAt || 0;
      const idle = g.players.filter((p) => !p.ready && (room.members[p.id]?.act || 0) < armedAt).map((p) => p.id);
      BJ.forceReady(g);
      idle.forEach((id) => kick(room, id, now));
    } else if (name === "grace") {
      room.graceAt = 0;
      BJ.forceReady(g);
    }
  } else {
    if (name === "spin") {
      RO.resolveSpin(g);
      room.settledAt = now;
      room.spins.push(g.result);
    } else if (name === "next") RO.nextRound(g);
    else if (name === "bet") {
      room.deadline = 0;
      if (g.players.some((p) => p.bets.length)) {
        g.players.forEach((p) => {
          p.ready = true;
        });
        RO.maybeSpin(g);
      }
    }
  }
  schedule(room, now);
}

export function schedule(room, now) {
  return room.game === "blackjack" ? scheduleBJ(room, now) : scheduleRO(room, now);
}

function scheduleBJ(room, now) {
  const g = room.g;
  const multi = isMulti(room);
  const sig = [
    g.phase,
    g.round,
    g.turn && `${g.turn.p}.${g.turn.h}`,
    g.turn && g.players[g.turn.p]?.hands[g.turn.h]?.cards.length,
    g.dealer.cards.length,
    g.dealer.hidden,
  ].join("|");
  if (sig !== room.sig) {
    room.sig = sig;
    room.timers = {};
    room.afk = null;
    if (g.phase === "dealer") arm(room, "dealer", now + (g.dealer.hidden ? 900 : 1000));
    else if (g.phase === "settle") {
      room.settledAt = now;
      arm(room, "next", now + 9000);
    } else if (g.phase === "insurance") arm(room, "ins", now + 8000);
    else if (g.phase === "playing" && multi && g.turn) {
      const id = g.players[g.turn.p].id;
      room.afk = { id, at: now + AFK_MS };
      arm(room, "turn", now + AFK_MS);
    }
  }
  if (g.phase === "betting" && multi && g.players.some((p) => p.ready) && !room.timers.bet) {
    const waiting = g.players.filter((p) => !p.ready);
    room.betAfk = waiting.length ? { id: waiting[0].id, at: now + AFK_MS } : null;
    room.betArmedAt = now;
    arm(room, "bet", now + AFK_MS);
  }
  if (g.phase === "betting") {
    const notReady = g.players.filter((p) => !p.ready);
    const betting = g.players.filter((p) => p.bet > 0);
    if (multi && betting.length > 0 && betting.every((p) => p.ready) && notReady.length > 0) {
      if (!room.timers.grace) {
        room.graceAt = now + GRACE_MS;
        arm(room, "grace", room.graceAt);
      }
      room.afk = { id: notReady[0].id, ids: notReady.map((p) => p.id), kind: "grace", at: room.graceAt, total: GRACE_MS };
    } else {
      delete room.timers.grace;
      room.afk = (g.players.some((p) => p.ready) && room.timers.bet && room.betAfk) || null;
    }
  }
}

function scheduleRO(room, now) {
  const g = room.g;
  const sig = g.phase + "|" + g.round;
  if (sig !== room.sig) {
    room.sig = sig;
    room.timers = {};
    room.deadline = 0;
    if (g.phase === "spinning") arm(room, "spin", now + ROULETTE_RULES.spinMs);
    else if (g.phase === "settle") arm(room, "next", now + 9000);
  }
  if (g.phase === "betting" && isMulti(room) && !room.timers.bet) {
    room.deadline = now + ROULETTE_RULES.autoMs;
    arm(room, "bet", room.deadline);
  }
}

// Déclenche toutes les échéances passées (dans l'ordre).
export function tick(room, now) {
  for (let i = 0; i < 200; i++) {
    let next = null;
    for (const [name, at] of Object.entries(room.timers)) if (at <= now && (!next || at < next[1])) next = [name, at];
    if (!next) return;
    fire(room, next[0], next[1]);
  }
}

export const nextDue = (room) => {
  const v = Object.values(room.timers);
  return v.length ? Math.min(...v) : null;
};

/* ---------- aléa (random.org fourni par la fonction) ---------- */
export function needsRandom(room) {
  const g = room.g;
  if (room.game === "blackjack") return !g.nextKeys && !(g.round === 0 && g.rng.source === "random.org") ? { kind: "keys", n: BJ.RULES.decks * 52 } : null;
  return g.buffer.length < 10 ? { kind: "ints", n: 50 } : null;
}

export function feedRandom(room, values, meta) {
  if (room.game === "blackjack") BJ.applyShoeKeys(room.g, values, meta);
  else RO.pushNumbers(room.g, values, meta);
}

/* ---------- vue publique (ce que voient les navigateurs) ---------- */
export function view(room, now) {
  const g = room.g;
  const v = E(room).publicView(g);
  v.game = room.game;
  if (room.game === "blackjack") {
    v.afk = room.afk
      ? { id: room.afk.id, ids: room.afk.ids, kind: room.afk.kind, ms: Math.max(0, room.afk.at - now), total: room.afk.total || AFK_MS }
      : null;
  } else {
    v.deadline = room.deadline ? { ms: Math.max(0, room.deadline - now), total: ROULETTE_RULES.autoMs } : null;
    v.auto = isMulti(room);
  }
  v.isPublic = room.isPublic;
  v.at = now;
  v.due = nextDue(room);
  v.kicked = Object.entries(room.members).filter(([, m]) => m.kicked).map(([uid]) => uid);
  return v;
}

/* ---------- ce qu'il faut écrire en base après un appel ---------- */
export function walletUpdates(room) {
  return room.g.players
    .filter((p) => !p.left || room.g.phase === "settle")
    .map((p) => {
      const m = room.members[p.id] || {};
      const credit = p.stats?.credit || 0;
      const debt = Math.max(0, credit - (m.creditSynced || 0));
      if (room.members[p.id]) room.members[p.id].creditSynced = credit;
      return { uid: p.id, bankroll: Math.max(0, Math.floor(walletValue(room, p))), debt };
    });
}

export function sessionRows(room) {
  const g = room.g;
  if (g.phase !== "settle") return [];
  return g.players.map((p) => {
    const session = room.members[p.id]?.session;
    if (room.game === "blackjack") return { game: "blackjack", uid: p.id, session, round: g.round, stats: BJ.sessionStats(p) };
    if (!p.bets.length) return null;
    const s = p.stats;
    return {
      game: "roulette",
      uid: p.id,
      session,
      round: g.round,
      stats: {
        spins: s.spins, wins: s.wins, wagered: s.wagered, net: p.bankroll - p.startBankroll - s.credit,
        biggest: s.biggest, peak: s.peak, credit: s.credit, final: p.bankroll,
      },
    };
  }).filter(Boolean);
}

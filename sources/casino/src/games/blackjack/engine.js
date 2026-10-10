import {
  cardValue,
  handValue,
  isNatural,
  makeShoe,
  perfectPairs,
  twentyOnePlusThree,
} from "./cards.js";
import { fail, ok } from "../../lib/result.js";

export const RULES = {
  decks: 6,
  penetration: 0.75,
  minBet: 5,
  maxBet: Infinity,
  sideMax: Infinity,
  maxHands: 4,
  bjPays: 1.5,
  startBankroll: 1000,
  creditAmount: 500,
};

const SEAT_ORDER = [2, 1, 3, 0, 4];

export function createBlackjackGame() {
  return {
    phase: "betting",
    round: 0,
    shoe: makeShoe(RULES.decks),
    dealer: {
      cards: [],
      hidden: false,
      bj: false,
    },
    players: [],
    turn: null,
    notice: null,
    rng: {
      source: "crypto",
      shuffles: 1,
      at: Date.now(),
      signed: false,
      error: null,
    },
    rngProof: null,
    proofPrev: null,
    nextKeys: null,
    nextMeta: null,
  };
}

export function applyShoeKeys(g, keys, meta) {
  if (g.round === 0 && g.phase === "betting") {
    g.shoe = makeShoe(RULES.decks, keys);
    g.rng = {
      source: meta.source,
      shuffles: 1,
      at: meta.at,
      signed: !!meta.proof,
      error: null,
    };
    g.rngProof = meta.proof || null;
  } else {
    g.nextKeys = keys;
    g.nextMeta = meta;
  }
}

function reshuffle(g) {
  g.proofPrev = g.rngProof
    ? {
        ...g.rngProof,
        shoeNumber: g.rng.shuffles,
      }
    : null;
  const shoeNumber = (g.rng?.shuffles || 1) + 1;
  if (g.nextKeys) {
    g.shoe = makeShoe(RULES.decks, g.nextKeys);
    g.rng = {
      source: g.nextMeta.source,
      shuffles: shoeNumber,
      at: g.nextMeta.at,
      signed: !!g.nextMeta.proof,
      error: null,
    };
    g.rngProof = g.nextMeta.proof || null;
  } else {
    g.shoe = makeShoe(RULES.decks);
    g.rng = {
      source: "crypto",
      shuffles: shoeNumber,
      at: Date.now(),
      signed: false,
      error: g.rng?.error || null,
    };
    g.rngProof = null;
  }
  g.nextKeys = null;
  g.nextMeta = null;
}

const findPlayer = (g, id) => g.players.find((p) => p.id === id);

function drawCard(g) {
  if (g.shoe.length === 0) {
    reshuffle(g);
  }
  return g.shoe.pop();
}

function placeStake(player, amount) {
  player.bankroll -= amount;
  player.stats.wagered += amount;
}

function createStats(bankroll = RULES.startBankroll) {
  return {
    played: 0,
    won: 0,
    lost: 0,
    push: 0,
    wagered: 0,
    splits: 0,
    doubles: 0,
    blackjacks: 0,
    peak: bankroll,
    drawdown: 0,
    credit: 0,
  };
}

export function addPlayer(g, id, name, bankroll = RULES.startBankroll) {
  if (findPlayer(g, id)) return fail("deja assis");
  const taken = new Set(g.players.map((p) => p.seat));
  const seat = SEAT_ORDER.find((seatIndex) => !taken.has(seatIndex));
  if (seat === undefined) {
    return fail("table pleine");
  }
  g.players.push({
    id,
    name: String(name || "Joueur").slice(0, 16),
    seat,
    bankroll,
    bet: 0,
    pp: 0,
    t3: 0,
    lastBets: {
      bet: 0,
      pp: 0,
      t3: 0,
    },
    ready: false,
    hands: [],
    insurance: 0,
    insuranceDecided: false,
    side: null,
    left: false,
    net: 0,
    startBankroll: bankroll,
    stats: createStats(bankroll),
  });
  g.players.sort((a, b) => a.seat - b.seat);
  return ok();
}

export function removePlayer(g, id) {
  const player = findPlayer(g, id);
  if (player) {
    if (g.phase === "betting" || !player.hands.length) {
      g.players = g.players.filter((p) => p.id !== id);
      maybeDeal(g);
    } else {
      player.left = true;
      if (g.phase === "insurance") {
        player.insuranceDecided = true;
        checkInsuranceDone(g);
      }
      if (g.phase === "playing") {
        advanceTurn(g);
      }
    }
  }
  return ok();
}

export function setBets(g, id, { bet = 0, pp = 0, t3 = 0 }) {
  const player = findPlayer(g, id);
  if (player) {
    if (g.phase !== "betting" || player.ready) {
      return fail("mises fermees");
    }
    [bet, pp, t3] = [bet, pp, t3].map((v) =>
      Math.max(0, Math.floor(Number(v) || 0)),
    );
    if (bet > RULES.maxBet || pp > RULES.sideMax || t3 > RULES.sideMax) {
      return fail("mise trop haute");
    }
    if (bet + pp + t3 > player.bankroll) {
      return fail("solde insuffisant");
    }
    player.bet = bet;
    player.pp = pp;
    player.t3 = t3;
    return ok();
  }
  return fail("joueur inconnu");
}

export function rebet(g, id) {
  const player = findPlayer(g, id);
  if (!player || g.phase !== "betting" || player.ready)
    return fail("impossible");
  const { bet, pp, t3 } = player.lastBets;
  return setBets(g, id, {
    bet,
    pp,
    t3,
  });
}

export function takeCredit(g, id) {
  const player = findPlayer(g, id);
  if (!player || g.phase !== "betting" || player.bankroll >= RULES.minBet) {
    return fail("credit refuse");
  }
  player.bankroll += RULES.creditAmount;
  player.stats.credit += RULES.creditAmount;
  return ok();
}

export function setReady(g, id, ready = true) {
  const player = findPlayer(g, id);
  if (!player || g.phase !== "betting") {
    return fail("impossible");
  }
  if (ready && player.bet > 0 && player.bet < RULES.minBet) {
    return fail(`mise mini ${RULES.minBet}`);
  }
  if (ready && player.bet === 0 && (player.pp > 0 || player.t3 > 0)) {
    return fail("mise principale requise");
  }
  player.ready = !!ready;
  maybeDeal(g);
  return ok();
}

function maybeDeal(g) {
  if (g.phase !== "betting") return;
  const seated = g.players.filter((p) => !p.left);
  if (!(!seated.length || !seated.every((p) => p.ready))) {
    if (!seated.some((p) => p.bet > 0)) {
      seated.forEach((p) => (p.ready = false));
      return;
    }
    dealRound(g);
  }
}

export function forceReady(g) {
  if (g.phase === "betting") {
    for (const p of g.players) {
      if (!p.ready) {
        if (p.bet > 0 && p.bet < RULES.minBet) {
          p.bet = 0;
        }
        p.ready = true;
      }
    }
    maybeDeal(g);
  }
}

function dealRound(g) {
  if (g.shoe.length < RULES.decks * 52 * (1 - RULES.penetration)) {
    reshuffle(g);
    g.notice = "Sabot re-melange";
  } else {
    g.notice = null;
  }
  g.round++;
  g.dealer = {
    cards: [],
    hidden: false,
    bj: false,
  };
  const inPlay = [];
  for (const p of g.players) {
    p.hands = [];
    p.insurance = 0;
    p.insuranceDecided = true;
    p.side = null;
    p.net = 0;
    if (p.bet > 0) {
      p.lastBets = {
        bet: p.bet,
        pp: p.pp,
        t3: p.t3,
      };
      placeStake(p, p.bet + p.pp + p.t3);
      p.hands = [
        {
          cards: [],
          bet: p.bet,
          done: false,
          split: false,
          doubled: false,
          aceSplit: false,
          result: null,
          payout: 0,
        },
      ];
      p.roundStake = p.bet + p.pp + p.t3;
      inPlay.push(p);
    } else {
      p.roundStake = 0;
    }
  }
  for (const p of inPlay) {
    p.hands[0].cards.push(drawCard(g));
  }
  g.dealer.cards.push(drawCard(g));
  for (const p of inPlay) {
    p.hands[0].cards.push(drawCard(g));
  }
  // Blackjack europeen : le croupier n'a qu'une carte, la 2e est tiree apres les joueurs
  const upCard = g.dealer.cards[0];
  for (const p of inPlay) {
    const [c1, c2] = p.hands[0].cards;
    p.side = {};
    if (p.pp > 0) {
      const pair = perfectPairs(c1, c2);
      p.side.pp = {
        name: pair ? pair.name : null,
        win: pair ? p.pp * pair.mult : -p.pp,
      };
      if (pair) {
        p.bankroll += p.pp * (pair.mult + 1);
      }
    }
    if (p.t3 > 0) {
      const combo = twentyOnePlusThree(c1, c2, upCard);
      p.side.t3 = {
        name: combo ? combo.name : null,
        win: combo ? p.t3 * combo.mult : -p.t3,
      };
      if (combo) {
        p.bankroll += p.t3 * (combo.mult + 1);
      }
    }
  }
  if (upCard.r === "A") {
    g.phase = "insurance";
    for (const p of inPlay) {
      p.insuranceDecided = false;
    }
    checkInsuranceDone(g);
  } else startPlay(g);
}

export function decideInsurance(g, id, take) {
  const player = findPlayer(g, id);
  if (
    !player ||
    g.phase !== "insurance" ||
    player.insuranceDecided ||
    !player.hands.length
  )
    return fail("impossible");
  if (take) {
    const cost = Math.floor(player.hands[0].bet / 2);
    if (cost < 1 || cost > player.bankroll) return fail("solde insuffisant");
    placeStake(player, cost);
    player.insurance = cost;
  }
  player.insuranceDecided = true;
  checkInsuranceDone(g);
  return ok();
}

export function closeInsurance(g) {
  if (g.phase === "insurance") {
    g.players.forEach((p) => (p.insuranceDecided = true));
    checkInsuranceDone(g);
  }
}

function checkInsuranceDone(g) {
  if (g.phase === "insurance" && g.players.every((p) => p.insuranceDecided)) {
    startPlay(g);
  }
}

function startPlay(g) {
  // pas de verification du blackjack du croupier (pas de carte cachee)
  g.phase = "playing";
  for (const p of g.players)
    for (const hand of p.hands) {
      if (isNatural(hand)) {
        hand.done = true;
      }
    }
  advanceTurn(g);
}

function advanceTurn(g) {
  g.turn = null;
  for (let pi = 0; pi < g.players.length; pi++) {
    const player = g.players[pi];
    for (let hi = 0; hi < player.hands.length; hi++) {
      const hand = player.hands[hi];
      if (!hand.done) {
        if (player.left) {
          hand.done = true;
          continue;
        }
        g.turn = {
          p: pi,
          h: hi,
        };
        return;
      }
    }
  }
  g.phase = "dealer";
}

function currentHand(g, id) {
  if (g.phase !== "playing" || !g.turn) return {};
  const player = g.players[g.turn.p];
  return !player || player.id !== id
    ? {}
    : {
        p: player,
        h: player.hands[g.turn.h],
      };
}

export function availableActions(g, id) {
  const { p: player, h: hand } = currentHand(g, id);
  if (!hand)
    return {
      hit: false,
      stand: false,
      double: false,
      split: false,
    };
  const twoCards = hand.cards.length === 2;
  return {
    hit: !hand.aceSplit,
    stand: true,
    double: twoCards && !hand.aceSplit && player.bankroll >= hand.bet,
    split:
      twoCards &&
      !hand.aceSplit &&
      player.hands.length < RULES.maxHands &&
      player.bankroll >= hand.bet &&
      cardValue(hand.cards[0].r) === cardValue(hand.cards[1].r),
  };
}

export function hit(g, id) {
  const { p: player, h: hand } = currentHand(g, id);
  if (!hand || !availableActions(g, id).hit) {
    return fail("impossible");
  }
  hand.cards.push(drawCard(g));
  if (handValue(hand.cards).total >= 21) {
    hand.done = true;
  }
  if (hand.done) {
    advanceTurn(g);
  }
  return ok();
}

export function stand(g, id) {
  const { h: hand } = currentHand(g, id);
  if (hand) {
    hand.done = true;
    advanceTurn(g);
    return ok();
  }
  return fail("impossible");
}

export function doubleDown(g, id) {
  const { p: player, h: hand } = currentHand(g, id);
  if (!hand || !availableActions(g, id).double) {
    return fail("impossible");
  }
  placeStake(player, hand.bet);
  hand.bet *= 2;
  hand.doubled = true;
  player.stats.doubles++;
  hand.cards.push(drawCard(g));
  hand.done = true;
  advanceTurn(g);
  return ok();
}

export function split(g, id) {
  const { p: player, h: hand } = currentHand(g, id);
  if (!hand || !availableActions(g, id).split) return fail("impossible");
  const index = g.turn.h;
  const aces = hand.cards[0].r === "A";
  placeStake(player, hand.bet);
  player.stats.splits++;
  const newHand = (card) => ({
    cards: [card, drawCard(g)],
    bet: hand.bet,
    done: false,
    split: true,
    doubled: false,
    aceSplit: aces,
    result: null,
    payout: 0,
  });
  const [c1, c2] = hand.cards;
  const h1 = newHand(c1);
  const h2 = newHand(c2);
  for (const h of [h1, h2]) {
    if (h.aceSplit || handValue(h.cards).total === 21) {
      h.done = true;
    }
  }
  player.hands.splice(index, 1, h1, h2);
  advanceTurn(g);
  return ok();
}

const anyLiveHand = (g) =>
  g.players.some((p) =>
    p.hands.some((h) => handValue(h.cards).total <= 21 && !isNatural(h)),
  );

const hasLiveHand = (g) =>
  g.players.some((p) =>
    p.hands.some((h) => handValue(h.cards).total <= 21 && !isNatural(h)),
  );
const hasUnbustedHand = (g) =>
  g.players.some((p) => p.hands.some((h) => handValue(h.cards).total <= 21));
const hasInsurance = (g) => g.players.some((p) => p.insurance > 0);

export function dealerStep(g) {
  if (g.phase !== "dealer")
    return {
      more: false,
    };
  g.dealer.hidden = false;
  if (g.dealer.cards.length === 1) {
    // 2e carte du croupier, seulement si une main (ou une assurance) est encore en jeu
    if (!hasUnbustedHand(g) && !hasInsurance(g)) {
      settle(g);
      return { more: false };
    }
    g.dealer.cards.push(drawCard(g));
    if (handValue(g.dealer.cards).total === 21) {
      g.dealer.bj = true;
      settle(g);
      return { more: false };
    }
    return { more: true };
  }
  const total = handValue(g.dealer.cards).total;
  if (hasLiveHand(g) && total < 17) {
    g.dealer.cards.push(drawCard(g));
    return { more: true };
  }
  settle(g);
  return { more: false };
}

function handResult(hand, dealerTotal, dealerBJ) {
  const total = handValue(hand.cards).total;
  const natural = isNatural(hand);
  return total > 21
    ? "bust"
    : dealerBJ
      ? natural
        ? "push"
        : "lose"
      : natural
        ? "blackjack"
        : dealerTotal > 21 || total > dealerTotal
          ? "win"
          : total < dealerTotal
            ? "lose"
            : "push";
}

function settle(g) {
  const dealerTotal = handValue(g.dealer.cards).total;
  const dealerBJ = g.dealer.bj;
  g.dealer.hidden = false;
  for (const p of g.players) {
    if (!p.hands.length) continue;
    let payout = 0;
    if (dealerBJ && p.insurance > 0) {
      p.bankroll += p.insurance * 3;
    }
    for (const [hi, hand] of p.hands.entries()) {
      const result = handResult(hand, dealerTotal, dealerBJ);
      hand.result = result;
      hand.payout =
        result === "blackjack"
          ? hand.bet * (1 + RULES.bjPays)
          : result === "win"
            ? hand.bet * 2
            : result === "push"
              ? hand.bet
              : 0;
      if (dealerBJ && result === "lose") {
        // blackjack du croupier : seule la mise initiale est perdue, doubles et splits sont rendus
        hand.payout = hi === 0 ? hand.bet - p.bet : hand.bet;
      }
      payout += hand.payout;
      p.stats.played++;
      if (result === "win" || result === "blackjack") {
        p.stats.won++;
      } else if (result === "lose" || result === "bust") {
        p.stats.lost++;
      } else {
        p.stats.push++;
      }
      if (result === "blackjack") {
        p.stats.blackjacks++;
      }
    }
    p.bankroll += payout;
    const sideNet = ["pp", "t3"].reduce(
      (sum, key) => sum + (p.side && p.side[key] ? p.side[key].win : 0),
      0,
    );
    const insuranceNet = dealerBJ ? p.insurance * 2 : -p.insurance;
    const mainNet = payout - p.hands.reduce((sum, h) => sum + h.bet, 0);
    p.net = mainNet + sideNet + insuranceNet;
    const stats = p.stats;
    stats.peak = Math.max(stats.peak, p.bankroll);
    stats.drawdown = Math.max(stats.drawdown, stats.peak - p.bankroll);
  }
  g.phase = "settle";
  g.turn = null;
}

export function nextRound(g) {
  if (g.phase !== "settle") return fail("impossible");
  g.players = g.players.filter((p) => !p.left);
  for (const p of g.players) {
    p.hands = [];
    p.insurance = 0;
    p.side = null;
    p.ready = false;
    p.net = 0;
    const { bet, pp, t3 } = p.lastBets;
    if (bet + pp + t3 <= p.bankroll && bet > 0) {
      p.bet = bet;
      p.pp = pp;
      p.t3 = t3;
    } else {
      p.bet = 0;
      p.pp = 0;
      p.t3 = 0;
    }
  }
  g.dealer = {
    cards: [],
    hidden: false,
    bj: false,
  };
  g.phase = "betting";
  g.turn = null;
  return ok();
}

export function publicView(g) {
  const { shoe, rngProof, nextKeys, nextMeta, ...rest } = g;
  const view = JSON.parse(JSON.stringify(rest));
  if (g.dealer.hidden) {
    view.dealer.cards = view.dealer.cards.map((card, i) =>
      i === 1
        ? {
            hidden: true,
          }
        : card,
    );
  }
  view.shoeLeft = shoe.length;
  return view;
}

export function sessionStats(player) {
  const s = player.stats;
  return {
    hands_played: s.played,
    hands_won: s.won,
    hands_lost: s.lost,
    hands_push: s.push,
    total_wagered: s.wagered,
    net_result: player.bankroll - player.startBankroll - s.credit,
    splits_used: s.splits,
    doubles_used: s.doubles,
    blackjacks_hit: s.blackjacks,
    final_bankroll: player.bankroll,
    peak: s.peak,
    drawdown: s.drawdown,
    credit: s.credit,
  };
}

import { secureRandomInt } from "../../lib/random.js";

const SUITS = ["S", "H", "D", "C"];

const RANKS = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

export const isRedSuit = (suit) => suit === "H" || suit === "D";

const rankIndex = (rank) => RANKS.indexOf(rank) + 1;

export const cardValue = (rank) =>
  rank === "A" ? 11 : ["10", "J", "Q", "K"].includes(rank) ? 10 : Number(rank);

const buildDecks = (decks) => {
  const cards = [];
  for (let d = 0; d < decks; d++)
    for (const suit of SUITS)
      for (const rank of RANKS) {
        cards.push({
          r: rank,
          s: suit,
        });
      }
  return cards;
};

export function makeShoe(decks = 6, keys = null) {
  const cards = buildDecks(decks);
  if (keys && keys.length === cards.length)
    return cards
      .map((card, index) => ({
        c: card,
        i: index,
        k: keys[index],
      }))
      .sort((a, b) => a.k - b.k || a.i - b.i)
      .map((entry, index) => ({
        ...entry.c,
        id: index,
      }));
  for (let i = cards.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards.map((card, index) => ({
    ...card,
    id: index,
  }));
}

export function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    if (!card.hidden) {
      total += cardValue(card.r);
      if (card.r === "A") {
        aces++;
      }
    }
  }
  for (; total > 21 && aces > 0; ) {
    total -= 10;
    aces--;
  }
  return {
    total,
    soft: aces > 0 && total <= 21,
  };
}

export function perfectPairs(a, b) {
  return a.r !== b.r
    ? null
    : a.s === b.s
      ? {
          name: "Paire parfaite",
          mult: 25,
        }
      : isRedSuit(a.s) === isRedSuit(b.s)
        ? {
            name: "Paire de couleur",
            mult: 12,
          }
        : {
            name: "Paire mixte",
            mult: 5,
          };
}

function isStraight(cards) {
  const ranks = cards.map((c) => rankIndex(c.r)).sort((a, b) => a - b);
  return ranks[0] === ranks[1] || ranks[1] === ranks[2]
    ? false
    : ranks[1] === ranks[0] + 1 && ranks[2] === ranks[1] + 1
      ? true
      : ranks[0] === 1 && ranks[1] === 12 && ranks[2] === 13;
}

export function twentyOnePlusThree(a, b, c) {
  const cards = [a, b, c];
  const flush = cards.every((card) => card.s === a.s);
  const trips = cards.every((card) => card.r === a.r);
  const straight = isStraight(cards);
  return trips && flush
    ? {
        name: "Brelan assorti",
        mult: 100,
      }
    : straight && flush
      ? {
          name: "Quinte flush",
          mult: 40,
        }
      : trips
        ? {
            name: "Brelan",
            mult: 30,
          }
        : straight
          ? {
              name: "Suite",
              mult: 10,
            }
          : flush
            ? {
                name: "Couleur",
                mult: 5,
              }
            : null;
}

export const isNatural = (hand) =>
  hand.cards.length === 2 && !hand.split && handValue(hand.cards).total === 21;

// Cartes du UNO : définition du paquet, points et règle de jeu d'une carte.

export const COLORS = ["r", "y", "g", "b"];

export const COLOR_NAME = { r: "Rouge", y: "Jaune", g: "Vert", b: "Bleu", w: "Joker" };

export const COLOR_HEX = {
  r: "#d7263d",
  y: "#f2b705",
  g: "#2e9e4f",
  b: "#1f6fd1",
  w: "#1b1b24",
};

export const VALUE_LABEL = {
  skip: "Passe",
  rev: "Sens",
  d2: "+2",
  wild: "Joker",
  wd4: "+4",
};

export const isWild = (card) => card.c === "w";
export const isAction = (card) => ["skip", "rev", "d2", "wild", "wd4"].includes(card.v);

/** 108 cartes : 0 x1, 1-9 x2, passe/sens/+2 x2 par couleur, 4 jokers, 4 jokers +4. */
export function makeDeck() {
  const cards = [];
  let id = 0;
  const add = (c, v) => cards.push({ id: id++, c, v });
  for (const c of COLORS) {
    add(c, "0");
    for (let n = 1; n <= 9; n++) {
      add(c, String(n));
      add(c, String(n));
    }
    for (const v of ["skip", "rev", "d2"]) {
      add(c, v);
      add(c, v);
    }
  }
  for (let i = 0; i < 4; i++) {
    add("w", "wild");
    add("w", "wd4");
  }
  return cards;
}

/** Valeur d'une carte pour le décompte de fin de manche. */
export function points(card) {
  if (card.c === "w") return 50;
  if (["skip", "rev", "d2"].includes(card.v)) return 20;
  return Number(card.v);
}

/** Clé de face (54 faces différentes) pour les textures. */
export const faceKey = (card) => `${card.c}-${card.v}`;

/**
 * Une carte est jouable sur la défausse si elle a la couleur courante, la même valeur que le dessus,
 * ou si c'est un joker. Pendant un cumul (+2 / +4), seule une carte du même type est jouable.
 */
export function isPlayable(card, top, color, pending = 0, pendingType = null) {
  if (pending > 0) return card.v === pendingType;
  if (card.c === "w") return true;
  return card.c === color || (top && card.v === top.v);
}

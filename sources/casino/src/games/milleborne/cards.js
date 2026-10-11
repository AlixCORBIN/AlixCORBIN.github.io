// Paquet officiel du Mille Bornes : 106 cartes.
export const DIST = ["25", "50", "75", "100", "200"];
export const HAZARDS = ["acc", "gas", "flat", "limit", "stop"];
export const REMEDIES = ["rep", "fuel", "spare", "unlim", "go"];
export const SAFETIES = ["ace", "tank", "tough", "prio"];

export const REMEDY_OF = { acc: "rep", gas: "fuel", flat: "spare", stop: "go", limit: "unlim" };
export const SAFETY_OF = { acc: "ace", gas: "tank", flat: "tough", stop: "prio", limit: "prio" };

const COUNTS = {
  25: 10, 50: 10, 75: 10, 100: 12, 200: 4,
  acc: 3, gas: 3, flat: 3, limit: 4, stop: 5,
  rep: 6, fuel: 6, spare: 6, unlim: 6, go: 14,
  ace: 1, tank: 1, tough: 1, prio: 1,
};

export const LABEL = {
  25: "25 km", 50: "50 km", 75: "75 km", 100: "100 km", 200: "200 km",
  acc: "Accident", gas: "Panne d'essence", flat: "Crevaison", limit: "Limite de vitesse", stop: "Feu rouge",
  rep: "Réparations", fuel: "Essence", spare: "Roue de secours", unlim: "Fin de limite", go: "Feu vert",
  ace: "As du volant", tank: "Citerne", tough: "Increvable", prio: "Prioritaire",
};

export const ICON = {
  25: "🐌", 50: "🦆", 75: "🦋", 100: "🐇", 200: "🐦",
  acc: "💥", gas: "⛽", flat: "🛞", limit: "50", stop: "🔴",
  rep: "🔧", fuel: "⛽", spare: "🛞", unlim: "∞", go: "🟢",
  ace: "🏎️", tank: "🛢️", tough: "🛡️", prio: "🚑",
};

export const kindOf = (k) =>
  DIST.includes(k) ? "dist" : HAZARDS.includes(k) ? "hazard" : REMEDIES.includes(k) ? "remedy" : "safety";

export function makeDeck() {
  const deck = [];
  let id = 0;
  for (const [k, n] of Object.entries(COUNTS)) for (let i = 0; i < n; i++) deck.push({ id: ++id, k });
  return deck;
}

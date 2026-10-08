export const ROLES = {
  wolf: {
    name: "Loup-Garou",
    team: "wolves",
    icon: "🐺",
    color: "#e0473a",
    desc: "Chaque nuit, avec la meute, dévore un villageois. Le jour, fais-toi passer pour un innocent.",
  },
  villager: {
    name: "Villageois",
    team: "village",
    icon: "🧑‍🌾",
    color: "#c9b48a",
    desc: "Aucun pouvoir, mais ton vote compte. Démasque les loups pendant les débats.",
  },
  seer: {
    name: "Voyante",
    team: "village",
    icon: "🔮",
    color: "#9b6bff",
    desc: "Chaque nuit, découvre le vrai rôle d'un joueur.",
  },
  witch: {
    name: "Sorcière",
    team: "village",
    icon: "🧪",
    color: "#4fd1a5",
    desc: "Une potion de vie pour sauver la victime des loups, une potion de mort pour éliminer quelqu'un. Une fois chacune.",
  },
  hunter: {
    name: "Chasseur",
    team: "village",
    icon: "🏹",
    color: "#d9902f",
    desc: "Si tu meurs, tu emportes immédiatement un joueur de ton choix.",
  },
  cupid: {
    name: "Cupidon",
    team: "village",
    icon: "💘",
    color: "#ff6fa8",
    desc: "La première nuit, désigne deux amoureux. Si l'un meurt, l'autre meurt de chagrin.",
  },
  guard: {
    name: "Salvateur",
    team: "village",
    icon: "🛡️",
    color: "#5aa9ff",
    desc: "Chaque nuit, protège un joueur des loups (jamais le même deux nuits de suite).",
  },
};

export const SPECIALS = ["seer", "witch", "hunter", "cupid", "guard"];

export const NIGHT_ORDER = ["cupid", "guard", "seer", "wolves", "witch"];

export const STEP_LABEL = {
  cupid: "Cupidon désigne les amoureux",
  guard: "Le Salvateur protège quelqu'un",
  seer: "La Voyante sonde un joueur",
  wolves: "Les loups choisissent leur victime",
  witch: "La Sorcière prépare ses potions",
};

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 16;

export const DEFAULT_SETTINGS = {
  seer: true,
  witch: true,
  hunter: true,
  cupid: false,
  guard: false,
  wolves: 0, // 0 = auto
  dayMs: 120000,
  nightMs: 30000,
};

export const autoWolves = (n) => (n >= 16 ? 4 : n >= 12 ? 3 : n >= 7 ? 2 : 1);

export function buildDeck(n, settings) {
  const maxWolves = Math.max(1, Math.floor((n - 1) / 2));
  const wolves = Math.min(maxWolves, settings.wolves || autoWolves(n));
  const deck = Array(wolves).fill("wolf");
  for (const r of SPECIALS) {
    if (settings[r] && deck.length < n) deck.push(r);
  }
  while (deck.length < n) deck.push("villager");
  return deck;
}

export const BOT_NAMES = [
  "Gaspard", "Mathilde", "Léon", "Rose", "Firmin", "Adèle", "Octave",
  "Berthe", "Eugène", "Louise", "Honoré", "Jeanne", "Marius", "Agathe",
  "Basile", "Célestine", "Hector", "Margot", "Anatole", "Suzanne",
];

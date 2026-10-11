// Moteur des Petits Chevaux : fonctions pures sur l'état de la partie (les timers sont dans host.js).
import { secureRandomInt } from "../../lib/random.js";
import { fail, ok } from "../../lib/result.js";

export const COLORS = ["r", "b", "y", "g"];
export const COLOR_NAME = { r: "Rouge", b: "Bleu", y: "Jaune", g: "Vert" };
export const COLOR_HEX = { r: "#d7263d", b: "#1f6fd1", y: "#f2b705", g: "#2e9e4f" };
export const BOT_NAMES = ["Éclair", "Pégase", "Tornado", "Jolly Jumper"];
export const HORSES = 4;
export const TURN_CHOICES = [0, 20000, 40000];

// Progression d'un cheval : -1 à l'écurie, 0..50 sur la piste (50 = case devant son échelle),
// 51..55 marches 1 à 5 de l'échelle, 56 = centre (arrivé).
export const ENTRY = 50;
export const FINISH = 56;

/* ---------- plateau (grille 15 × 15, x vers la droite, y vers le bas) ---------- */

const rot = ([x, y]) => [14 - y, x]; // quart de tour horaire autour du centre
const rotN = (c, n) => {
  let p = c;
  for (let i = 0; i < n; i++) p = rot(p);
  return p;
};

// Piste commune de 52 cases, en partant de la case de sortie du Rouge.
const QUARTER = [
  [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
  [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0],
  [7, 0], [8, 0],
];
export const TRACK = [0, 1, 2, 3].flatMap((q) => QUARTER.map((c) => rotN(c, q)));
if (TRACK.length !== 52) throw new Error("piste invalide");

export const LADDER = COLORS.map((_, c) =>
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6.4, 7]].map((p) => rotN(p, c)),
);
export const STABLE = COLORS.map((_, c) =>
  [[1.6, 1.6], [3.4, 1.6], [1.6, 3.4], [3.4, 3.4]].map((p) => rotN(p, c)),
);
export const startIndex = (c) => c * 13;

/** Case (x, y) d'un cheval selon sa progression. */
export function cellOf(c, prog, h = 0) {
  if (prog < 0) return STABLE[c][h];
  if (prog <= ENTRY) return TRACK[(startIndex(c) + prog) % 52];
  return LADDER[c][prog - ENTRY - 1];
}

/* ---------- partie ---------- */

const find = (g, id) => g.players.find((p) => p.id === id);

export function createHorsesGame() {
  return {
    game: "horses",
    phase: "lobby", // lobby | playing | end
    players: [],
    hostId: null,
    settings: { turnMs: 20000 },
    turn: 0,
    stage: "roll", // roll | rolling | choose | moving | pass
    die: null, // { v, seq }
    sixes: 0,
    choices: [],
    anim: null, // { seq, color, horse, from, to, path, capture: {color, horse} | null }
    seq: 0,
    log: [],
    logSeq: 0,
    winner: null,
    ranking: [],
    botSeq: 0,
    startedAt: null,
    stats: { rolls: 0, sixes: 0, captures: 0, moves: 0 },
  };
}

function note(g, text, tone) {
  g.log.push({ id: ++g.logSeq, text, tone });
  if (g.log.length > 40) g.log.splice(0, g.log.length - 40);
}

export function addPlayer(g, id, name, { bot = false } = {}) {
  if (find(g, id)) return fail("deja present");
  if (g.phase !== "lobby") return fail("partie en cours");
  if (g.players.length >= 4) return fail("table pleine");
  const base = String(name || "Joueur").trim().slice(0, 16) || "Joueur";
  let nm = base;
  for (let i = 2; g.players.some((p) => p.name === nm); i++) nm = `${base} ${i}`;
  const used = new Set(g.players.map((p) => p.color));
  const color = COLORS.find((c) => !used.has(c));
  g.players.push({ id, name: nm, bot, color, horses: [-1, -1, -1, -1], afk: 0, left: false, captures: 0 });
  if (!g.hostId) g.hostId = id;
  return ok();
}

export function addBot(g) {
  const used = new Set(g.players.map((p) => p.name));
  return addPlayer(g, "bot-" + ++g.botSeq, BOT_NAMES.find((n) => !used.has(n)) || "Bot", { bot: true });
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
    note(g, `${p.name} est parti : un bot prend ses chevaux.`, "info");
  }
  if (g.hostId === id) g.hostId = g.players.find((x) => !x.bot)?.id || null;
  return ok();
}

export function setSettings(g, patch) {
  if (g.phase !== "lobby") return fail("partie en cours");
  if (TURN_CHOICES.includes(patch.turnMs)) g.settings.turnMs = patch.turnMs;
  return ok();
}

export function startGame(g) {
  if (g.phase !== "lobby") return fail("deja lance");
  while (g.players.length < 2) addBot(g);
  // Ordre de jeu fixe autour du plateau : rouge, bleu, jaune, vert.
  g.players.sort((a, b) => COLORS.indexOf(a.color) - COLORS.indexOf(b.color));
  g.players.forEach((p) => {
    p.horses = [-1, -1, -1, -1];
    p.afk = 0;
    p.captures = 0;
  });
  g.phase = "playing";
  g.turn = secureRandomInt(g.players.length);
  g.stage = "roll";
  g.die = null;
  g.sixes = 0;
  g.anim = null;
  g.winner = null;
  g.ranking = [];
  g.log = [];
  g.startedAt = Date.now();
  g.gameId = crypto.randomUUID();
  g.stats = { rolls: 0, sixes: 0, captures: 0, moves: 0 };
  note(g, `${g.players[g.turn].name} commence.`, "info");
  return ok();
}

export function backToLobby(g) {
  if (g.phase !== "end") return fail("partie en cours");
  g.players = g.players.filter((p) => !p.left);
  g.phase = "lobby";
  g.anim = null;
  g.die = null;
  return ok();
}

/* ---------- déplacements ---------- */

const occupant = (g, cell, skip) => {
  for (const p of g.players)
    for (let h = 0; h < HORSES; h++) {
      const pr = p.horses[h];
      if (pr < 0 || pr > ENTRY || (p === skip.p && h === skip.h)) continue;
      const c = cellOf(COLORS.indexOf(p.color), pr);
      if (c[0] === cell[0] && c[1] === cell[1]) return { p, h };
    }
  return null;
};

/** Destination d'un cheval avec ce dé, ou null si le coup est interdit. */
export function target(g, p, h, d) {
  const pr = p.horses[h];
  const c = COLORS.indexOf(p.color);
  let to;
  if (pr === FINISH) return null;
  if (pr < 0) to = d === 6 ? 0 : null;
  else if (pr < ENTRY) to = pr + d <= ENTRY ? pr + d : null; // il faut tomber pile devant l'échelle
  else to = d === pr - ENTRY + 1 ? pr + 1 : null; // marche n : il faut faire n
  if (to === null) return null;
  if (to <= ENTRY) {
    const occ = occupant(g, cellOf(c, to), { p, h });
    if (occ && occ.p === p) return null; // jamais deux chevaux de la même couleur sur une case
    return { to, capture: occ ? { id: occ.p.id, horse: occ.h } : null };
  }
  return { to, capture: null };
}

export const legalMoves = (g, p, d) =>
  [0, 1, 2, 3].map((h) => ({ h, t: target(g, p, h, d) })).filter((m) => m.t);

const current = (g) => g.players[g.turn];

export function roll(g, id) {
  if (g.phase !== "playing" || g.stage !== "roll") return fail("pas maintenant");
  const p = current(g);
  if (p.id !== id) return fail("ce n'est pas ton tour");
  const v = 1 + secureRandomInt(6);
  g.die = { v, seq: ++g.seq, by: p.id };
  g.stage = "rolling";
  g.stats.rolls++;
  if (v === 6) {
    g.stats.sixes++;
    g.sixes++;
  }
  p.afk = 0;
  return ok();
}

/** Appelé par l'hôte quand le dé a fini de rouler. */
export function settleRoll(g) {
  if (g.stage !== "rolling") return;
  const p = current(g);
  const v = g.die.v;
  if (g.sixes >= 3) {
    note(g, `${p.name} fait trois 6 de suite : tour perdu !`, "bad");
    g.choices = [];
    g.stage = "pass";
    return;
  }
  g.choices = legalMoves(g, p, v).map((m) => m.h);
  if (!g.choices.length) {
    // Aucun cheval en piste : trois essais pour sortir un 6.
    const stuck = p.horses.every((x) => x < 0 || x === FINISH);
    g.tries = (g.tries || 0) + 1;
    g.retry = stuck && g.tries < 3;
    note(g, `${p.name} fait ${v} : aucun cheval ne peut bouger${g.retry ? ` (essai ${g.tries}/3)` : ""}.`, "info");
    g.stage = "pass";
  } else g.stage = "choose";
}

export function move(g, id, h) {
  if (g.phase !== "playing" || g.stage !== "choose") return fail("pas maintenant");
  const p = current(g);
  if (p.id !== id) return fail("ce n'est pas ton tour");
  if (!g.choices.includes(h)) return fail("ce cheval ne peut pas bouger");
  const t = target(g, p, h, g.die.v);
  const c = COLORS.indexOf(p.color);
  const from = p.horses[h];
  const path = [];
  if (from < 0) path.push(cellOf(c, 0));
  else for (let s = from + 1; s <= t.to; s++) path.push(cellOf(c, s));
  p.horses[h] = t.to;
  p.afk = 0;
  g.stats.moves++;
  g.anim = { seq: ++g.seq, id: p.id, horse: h, from, to: t.to, path, capture: t.capture };
  g.stage = "moving";
  g.choices = [];
  if (from < 0) note(g, `${p.name} sort un cheval de l'écurie.`);
  else if (t.to === FINISH) note(g, `🏁 Un cheval ${COLOR_NAME[p.color].toLowerCase()} arrive au centre !`, "good");
  else if (t.to > ENTRY) note(g, `${p.name} monte sur la marche ${t.to - ENTRY}.`);
  return ok();
}

/** Appelé par l'hôte quand l'animation du déplacement est finie. */
export function endMove(g) {
  if (g.stage !== "moving" && g.stage !== "pass") return;
  const p = current(g);
  const cap = g.stage === "moving" ? g.anim?.capture : null;
  if (cap) {
    const victim = find(g, cap.id);
    if (victim) {
      victim.horses[cap.horse] = -1;
      p.captures++;
      g.stats.captures++;
      note(g, `💥 ${p.name} renvoie un cheval de ${victim.name} à l'écurie !`, "bad");
      g.anim = { ...g.anim, seq: ++g.seq, kicked: { id: victim.id, horse: cap.horse }, capture: null, path: [] };
    }
  }
  if (p.horses.every((x) => x === FINISH)) {
    g.phase = "end";
    g.winner = p.id;
    g.endedAt = Date.now();
    g.ranking = [...g.players]
      .map((q) => ({ id: q.id, score: q.horses.reduce((s, x) => s + Math.max(0, x + 1), 0) }))
      .sort((a, b) => b.score - a.score)
      .map((r) => r.id);
    note(g, `🏆 ${p.name} gagne la partie !`, "good");
    return;
  }
  const replay = g.die?.v === 6 && g.sixes < 3 && g.stage === "moving";
  if (replay) note(g, `${p.name} a fait 6 : il rejoue.`, "info");
  if (replay || g.stage === "moving") g.tries = 0;
  if (replay || g.retry) g.retry = false;
  else {
    g.tries = 0;
    g.turn = (g.turn + 1) % g.players.length;
    g.sixes = 0;
  }
  g.stage = "roll";
}

/** Temps écoulé pour un humain : on joue pour lui. */
export function timeoutTurn(g) {
  const p = current(g);
  const afk = p.afk + 1;
  if (afk >= 3 && !p.bot) {
    p.bot = true;
    note(g, `${p.name} est absent : un bot joue à sa place.`, "info");
  }
  if (g.stage === "roll") roll(g, p.id);
  else if (g.stage === "choose") move(g, p.id, g.choices[0]);
  p.afk = afk; // roll/move remettent afk à 0 : on garde le compteur
}

export const viewFor = (g) => ({
  ...g,
  players: g.players.map((p) => ({ ...p })),
  turnId: g.phase === "playing" ? current(g).id : null,
});

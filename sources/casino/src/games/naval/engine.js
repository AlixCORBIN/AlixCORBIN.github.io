// Moteur de la bataille navale : fonctions pures sur l'état de la partie (les délais sont gérés par l'hôte).
import { secureRandomInt } from "../../lib/random.js";
import { fail, ok } from "../../lib/result.js";

export const SIZE = 10;
export const MAX_PLAYERS = 2;
export const FLEET = [
  { k: "carrier", name: "Porte-avions", len: 5 },
  { k: "cruiser", name: "Croiseur", len: 4 },
  { k: "destroyer", name: "Contre-torpilleur", len: 3 },
  { k: "sub", name: "Sous-marin", len: 3 },
  { k: "torpedo", name: "Torpilleur", len: 2 },
];
export const BOT_NAMES = ["Amiral Max", "Capitaine Zoé", "Corsaire Noa", "Mousse Théo", "Vigie Inès"];
export const DEFAULT_SETTINGS = {
  turnMs: 30000, // 0 = pas de limite
  bonus: false, // rejouer après un tir au but
  touch: true, // les navires peuvent se toucher
};
export const TURN_CHOICES = [0, 20000, 30000, 60000];
export const COLS = "ABCDEFGHIJ";
export const cellName = (x, y) => COLS[x] + (y + 1);

const MAX_LOG = 50;
const find = (g, id) => g.players.find((p) => p.id === id);
const other = (g, p) => g.players.find((x) => x !== p);

export function shipCells(s) {
  const out = [];
  for (let i = 0; i < s.len; i++) out.push(s.dir === "h" ? [s.x + i, s.y] : [s.x, s.y + i]);
  return out;
}

/** Vérifie une flotte complète (ou partielle si partial). Renvoie un message d'erreur ou null. */
export function fleetError(ships, { partial = false, touch = true } = {}) {
  if (!Array.isArray(ships)) return "flotte invalide";
  if (!partial && ships.length !== FLEET.length) return "flotte incomplète";
  const taken = new Map();
  for (const s of ships) {
    const ref = FLEET.find((f) => f.k === s?.k);
    if (!ref || ref.len !== s.len || !["h", "v"].includes(s.dir)) return "navire invalide";
    if (ships.filter((o) => o.k === s.k).length > 1) return "navire en double";
    for (const [x, y] of shipCells(s)) {
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= SIZE || y >= SIZE) return "hors de la grille";
      if (taken.has(x + "," + y)) return "navires superposés";
      taken.set(x + "," + y, s.k);
    }
  }
  if (!touch) {
    for (const [key, k] of taken) {
      const [x, y] = key.split(",").map(Number);
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++) {
          const o = taken.get(x + dx + "," + (y + dy));
          if (o && o !== k) return "les navires ne doivent pas se toucher";
        }
    }
  }
  return null;
}

export function randomFleet(touch = true) {
  for (let tries = 0; tries < 500; tries++) {
    const ships = [];
    for (const f of FLEET) {
      let placed = false;
      for (let a = 0; a < 200 && !placed; a++) {
        const dir = secureRandomInt(2) ? "h" : "v";
        const x = secureRandomInt(dir === "h" ? SIZE - f.len + 1 : SIZE);
        const y = secureRandomInt(dir === "v" ? SIZE - f.len + 1 : SIZE);
        const s = { k: f.k, len: f.len, x, y, dir };
        if (!fleetError([...ships, s], { partial: true, touch })) {
          ships.push(s);
          placed = true;
        }
      }
      if (!placed) break;
    }
    if (ships.length === FLEET.length) return ships;
  }
  return null;
}

export function createNavalGame() {
  return {
    game: "naval",
    phase: "lobby", // lobby | placing | battle | end
    players: [],
    hostId: null,
    settings: { ...DEFAULT_SETTINGS },
    turn: 0,
    step: "aim", // aim | flying | impact
    shot: null, // { seq, by, target, x, y, hit, sunk }
    shotSeq: 0,
    round: 0,
    winner: null,
    log: [],
    seq: 0,
    botSeq: 0,
    startedAt: null,
    endedAt: null,
  };
}

function note(g, text, tone) {
  g.log.push({ id: ++g.seq, text, tone });
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
  g.players.push({ id, name: nm, bot, left: false, ships: null, ready: false, shots: [], fired: 0, hits: 0 });
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
  const bot = g.players.find((p) => p.bot);
  if (!bot) return fail("aucun bot");
  g.players = g.players.filter((p) => p !== bot);
  return ok();
}

export function removePlayer(g, id) {
  const p = find(g, id);
  if (!p) return fail("absent");
  if (g.phase === "lobby" || g.phase === "end") {
    g.players = g.players.filter((x) => x !== p);
  } else {
    p.bot = true;
    p.left = true;
    if (!p.ships) {
      p.ships = randomFleet(g.settings.touch).map((s) => ({ ...s, hits: 0 }));
      p.ready = true;
      maybeStartBattle(g);
    }
    note(g, `${p.name} a quitté : un bot prend la barre.`, "info");
  }
  if (g.hostId === id) g.hostId = g.players.find((x) => !x.bot)?.id || null;
  return ok();
}

export function setSettings(g, patch) {
  if (g.phase !== "lobby") return fail("partie en cours");
  if ("turnMs" in patch && TURN_CHOICES.includes(patch.turnMs)) g.settings.turnMs = patch.turnMs;
  if ("bonus" in patch) g.settings.bonus = !!patch.bonus;
  if ("touch" in patch) g.settings.touch = !!patch.touch;
  return ok();
}

/* ---------- placement ---------- */

export function startGame(g) {
  if (g.phase !== "lobby") return fail("deja lance");
  while (g.players.length < MAX_PLAYERS) addBot(g);
  g.round++;
  g.phase = "placing";
  g.winner = null;
  g.shot = null;
  g.step = "aim";
  g.log = [];
  g.startedAt = Date.now();
  g.endedAt = null;
  g.players.forEach((p) => {
    p.ships = null;
    p.ready = false;
    p.shots = [];
    p.fired = 0;
    p.hits = 0;
    if (p.bot) {
      p.ships = randomFleet(g.settings.touch).map((s) => ({ ...s, hits: 0 }));
      p.ready = true;
    }
  });
  note(g, "Placez vos navires !", "info");
  return ok();
}

export function placeFleet(g, id, ships) {
  const p = find(g, id);
  if (!p) return fail("absent");
  if (g.phase !== "placing") return fail("placement terminé");
  const clean = (Array.isArray(ships) ? ships : []).map((s) => ({ k: s?.k, len: s?.len, x: s?.x, y: s?.y, dir: s?.dir }));
  const err = fleetError(clean, { touch: g.settings.touch });
  if (err) return fail(err);
  p.ships = clean.map((s) => ({ ...s, hits: 0 }));
  p.ready = true;
  note(g, `${p.name} a déployé sa flotte.`, "info");
  maybeStartBattle(g);
  return ok();
}

export function unready(g, id) {
  const p = find(g, id);
  if (!p || g.phase !== "placing") return fail("trop tard");
  p.ready = false;
  return ok();
}

/** Fin du temps de placement : flotte aléatoire pour les retardataires. */
export function autoPlace(g) {
  if (g.phase !== "placing") return;
  g.players.forEach((p) => {
    if (!p.ready) {
      p.ships = randomFleet(g.settings.touch).map((s) => ({ ...s, hits: 0 }));
      p.ready = true;
      note(g, `${p.name} : flotte placée au hasard.`, "info");
    }
  });
  maybeStartBattle(g);
}

function maybeStartBattle(g) {
  if (g.phase !== "placing" || !g.players.every((p) => p.ready)) return;
  g.phase = "battle";
  g.turn = secureRandomInt(g.players.length);
  g.step = "aim";
  note(g, `${g.players[g.turn].name} ouvre le feu en premier.`, "big");
}

/* ---------- combat ---------- */

export const shooter = (g) => g.players[g.turn];

export function fire(g, id, x, y) {
  if (g.phase !== "battle" || g.step !== "aim") return fail("attends ton tour");
  const p = shooter(g);
  if (p.id !== id) return fail("ce n'est pas ton tour");
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= SIZE || y >= SIZE) return fail("hors de la grille");
  const t = other(g, p);
  if (t.shots.some((s) => s.x === x && s.y === y)) return fail("case déjà visée");
  g.shot = { seq: ++g.shotSeq, by: p.id, target: t.id, x, y, hit: null, sunk: null };
  g.step = "flying";
  p.fired++;
  return ok();
}

/** Le missile touche la grille. */
export function resolveShot(g) {
  if (g.phase !== "battle" || g.step !== "flying" || !g.shot) return;
  const p = find(g, g.shot.by);
  const t = find(g, g.shot.target);
  const { x, y } = g.shot;
  const ship = t.ships.find((s) => shipCells(s).some(([cx, cy]) => cx === x && cy === y));
  const where = cellName(x, y);
  const shot = { x, y, hit: !!ship, seq: g.shot.seq };
  t.shots.push(shot);
  g.shot.hit = !!ship;
  if (ship) {
    ship.hits++;
    p.hits++;
    if (ship.hits >= ship.len) {
      g.shot.sunk = ship.k;
      shipCells(ship).forEach(([cx, cy]) => {
        const s = t.shots.find((o) => o.x === cx && o.y === cy);
        if (s) s.sunk = true;
      });
      const name = FLEET.find((f) => f.k === ship.k).name;
      note(g, `${p.name} → ${where} : ${name} de ${t.name} coulé !`, "sunk");
      if (t.ships.every((s) => s.hits >= s.len)) g.winner = p.id;
    } else {
      note(g, `${p.name} → ${where} : touché !`, "hit");
    }
  } else {
    note(g, `${p.name} → ${where} : à l'eau.`, "miss");
  }
  g.step = "impact";
}

/** Après l'animation d'impact : fin de partie ou tour suivant. */
export function afterImpact(g) {
  if (g.phase !== "battle" || g.step !== "impact") return;
  if (g.winner) {
    g.phase = "end";
    g.endedAt = Date.now();
    note(g, `${find(g, g.winner).name} remporte la bataille !`, "big");
    return;
  }
  if (!(g.settings.bonus && g.shot?.hit)) g.turn = (g.turn + 1) % g.players.length;
  g.step = "aim";
}

/** Temps écoulé : tir au hasard sur une case libre. */
export function timeoutFire(g) {
  if (g.phase !== "battle" || g.step !== "aim") return;
  const p = shooter(g);
  const t = other(g, p);
  const free = [];
  for (let x = 0; x < SIZE; x++) for (let y = 0; y < SIZE; y++) if (!t.shots.some((s) => s.x === x && s.y === y)) free.push([x, y]);
  const [x, y] = free[secureRandomInt(free.length)];
  note(g, `${p.name} tarde : tir automatique.`, "info");
  fire(g, p.id, x, y);
}

export function backToLobby(g) {
  if (g.phase !== "end") return fail("partie en cours");
  g.phase = "lobby";
  g.players = g.players.filter((p) => !p.left);
  g.players.forEach((p) => {
    p.ships = null;
    p.ready = false;
    p.shots = [];
  });
  g.shot = null;
  return ok();
}

/* ---------- vue par joueur (les navires adverses restent sur l'hôte tant qu'ils flottent) ---------- */

export function viewFor(g, viewerId) {
  const reveal = g.phase === "end";
  return {
    game: "naval",
    phase: g.phase,
    hostId: g.hostId,
    settings: g.settings,
    round: g.round,
    turn: g.phase === "battle" ? shooter(g).id : null,
    step: g.step,
    shot: g.shot,
    winner: g.winner,
    players: g.players.map((p) => ({
      id: p.id,
      name: p.name,
      bot: p.bot,
      left: p.left,
      ready: p.ready,
      fired: p.fired,
      hits: p.hits,
      shots: p.shots,
      sunk: (p.ships || []).filter((s) => s.hits >= s.len).map((s) => s.k),
      ships:
        p.id === viewerId || reveal
          ? p.ships
          : (p.ships || []).filter((s) => s.hits >= s.len),
    })),
    log: g.log.slice(-30),
  };
}

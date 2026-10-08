// Moteur du Loup-Garou : fonctions pures sur l'état de la partie (aucun timer ici).
import {
  BOT_NAMES,
  DEFAULT_SETTINGS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  NIGHT_ORDER,
  ROLES,
  buildDeck,
} from "./roles.js";
import { secureRandomInt } from "../../lib/random.js";
import { fail, ok } from "../../lib/result.js";

const MAX_CHAT = 200;
const VIEW_CHAT = 140;

export const isWolf = (p) => p?.role === "wolf";
const find = (g, id) => g.players.find((p) => p.id === id);
export const alivePlayers = (g) => g.players.filter((p) => p.alive);
const pick = (arr) => arr[secureRandomInt(arr.length)];

export function createWerewolfGame() {
  return {
    game: "werewolf",
    phase: "lobby", // lobby | night | day | hunter | end
    step: null,
    day: 0,
    players: [],
    hostId: null,
    settings: { ...DEFAULT_SETTINGS },
    chat: [],
    seq: 0,
    botSeq: 0,
    night: null,
    votes: {},
    witch: { life: true, death: true },
    lovers: null,
    lastGuard: null,
    seen: {},
    claims: [],
    pendingHunters: [],
    hunter: null,
    after: null,
    winner: null,
    lastVote: null,
    starting: false,
    rng: { source: "crypto", at: Date.now() },
  };
}

/* ---------- chat ---------- */

function push(g, msg) {
  g.chat.push({ id: ++g.seq, at: Date.now(), day: g.day, ...msg });
  if (g.chat.length > MAX_CHAT) g.chat.splice(0, g.chat.length - MAX_CHAT);
}
export const sys = (g, text, ch = "village", tone) =>
  push(g, { ch, sys: true, text, tone });
const whisper = (g, id, text, tone) => sys(g, text, "p:" + id, tone);

export function canRead(g, viewer, ch) {
  if (ch === "village") return true;
  if (ch.startsWith("p:")) return viewer?.id === ch.slice(2);
  if (!viewer) return false;
  const spectator = g.phase === "end" || (!viewer.alive && g.phase !== "lobby");
  if (ch === "wolves") return isWolf(viewer) || spectator;
  if (ch === "lovers") return !!g.lovers?.includes(viewer.id) || spectator;
  if (ch === "dead") return spectator;
  return false;
}

export function canWrite(g, p, ch) {
  if (!p) return false;
  if (g.phase === "lobby" || g.phase === "end") return ch === "village";
  if (!p.alive) return ch === "dead";
  if (ch === "village") return g.phase !== "night";
  if (ch === "wolves") return isWolf(p);
  if (ch === "lovers") return !!g.lovers?.includes(p.id);
  return false;
}

export function say(g, id, ch, text) {
  const p = find(g, id);
  const clean = String(text || "").replace(/\s+/g, " ").trim().slice(0, 240);
  if (!clean) return fail("message vide");
  if (!canWrite(g, p, ch)) return fail("tu ne peux pas parler ici");
  const now = Date.now();
  if (p.lastMsg && now - p.lastMsg < 600) return fail("doucement !");
  p.lastMsg = now;
  push(g, { ch, from: id, name: p.name, text: clean });
  return ok();
}

/* ---------- salle ---------- */

export function addPlayer(g, id, name, { bot = false } = {}) {
  if (find(g, id)) return fail("deja present");
  if (g.phase !== "lobby") return fail("partie en cours");
  if (g.players.length >= MAX_PLAYERS) return fail("village plein");
  let base = String(name || "Joueur").trim().slice(0, 16) || "Joueur";
  let nm = base;
  for (let i = 2; g.players.some((p) => p.name === nm); i++) nm = `${base} ${i}`;
  g.players.push({ id, name: nm, bot, alive: true, role: null, ready: bot, cause: null });
  if (!g.hostId) g.hostId = id;
  sys(g, `${nm} arrive au village.`, "village", "info");
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
  const last = bots[bots.length - 1];
  g.players = g.players.filter((p) => p !== last);
  sys(g, `${last.name} quitte le village.`, "village", "info");
  return ok();
}

export function removePlayer(g, id) {
  const p = find(g, id);
  if (!p) return fail("absent");
  if (g.phase === "lobby" || g.phase === "end") {
    g.players = g.players.filter((x) => x !== p);
    sys(g, `${p.name} a quitté le village.`, "village", "info");
  } else {
    // En pleine partie, un bot reprend le personnage pour ne pas casser l'équilibre.
    p.bot = true;
    p.left = true;
    sys(g, `${p.name} s'est déconnecté : un bot joue à sa place.`, "village", "info");
  }
  if (g.hostId === id) g.hostId = g.players.find((x) => !x.bot)?.id || null;
  return ok();
}

export function setReady(g, id, v) {
  const p = find(g, id);
  if (!p || g.phase !== "lobby") return fail("impossible");
  p.ready = !!v;
  return ok();
}

export function setSettings(g, patch) {
  if (g.phase !== "lobby") return fail("partie en cours");
  const s = g.settings;
  for (const k of ["seer", "witch", "hunter", "cupid", "guard"]) {
    if (k in patch) s[k] = !!patch[k];
  }
  if ("wolves" in patch) s.wolves = Math.max(0, Math.min(5, patch.wolves | 0));
  if ("dayMs" in patch) s.dayMs = Math.max(30000, Math.min(300000, patch.dayMs | 0));
  if ("nightMs" in patch) s.nightMs = Math.max(15000, Math.min(90000, patch.nightMs | 0));
  return ok();
}

/* ---------- démarrage ---------- */

export function fillWithBots(g) {
  while (g.players.length < MIN_PLAYERS) addBot(g);
}

export function startGame(g, keys, meta) {
  const n = g.players.length;
  if (n < MIN_PLAYERS) return fail(`il faut au moins ${MIN_PLAYERS} joueurs`);
  const deck = buildDeck(n, g.settings)
    .map((role, i) => ({ role, k: keys?.[i] ?? secureRandomInt(1e9) }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.role);
  g.players.forEach((p, i) => {
    p.role = deck[i];
    p.alive = true;
    p.cause = null;
    p.ready = p.bot;
  });
  Object.assign(g, {
    day: 0,
    witch: { life: true, death: true },
    lovers: null,
    lastGuard: null,
    seen: {},
    claims: [],
    votes: {},
    pendingHunters: [],
    hunter: null,
    winner: null,
    lastVote: null,
    starting: false,
    chat: [],
    startedAt: Date.now(),
    stats: { votes: 0, kills: 0 },
  });
  g.rng = meta ? { source: meta.source, at: meta.at } : { source: "crypto", at: Date.now() };
  const counts = {};
  deck.forEach((r) => (counts[r] = (counts[r] || 0) + 1));
  sys(
    g,
    "La partie commence ! Rôles en jeu : " +
      Object.entries(counts)
        .map(([r, c]) => `${c > 1 ? c + " " : ""}${ROLES[r].icon} ${ROLES[r].name}`)
        .join(", "),
    "village",
    "info",
  );
  g.players.forEach((p) => {
    const mates =
      isWolf(p) && g.players.filter((x) => isWolf(x) && x !== p).map((x) => x.name);
    whisper(
      g,
      p.id,
      `Tu es ${ROLES[p.role].icon} ${ROLES[p.role].name}. ${ROLES[p.role].desc}` +
        (mates && mates.length ? ` Ta meute : ${mates.join(", ")}.` : ""),
      "role",
    );
  });
  startNight(g);
  return ok();
}

export function backToLobby(g) {
  if (g.phase !== "end") return fail("partie en cours");
  g.phase = "lobby";
  g.step = null;
  g.players = g.players.filter((p) => !p.left);
  g.players.forEach((p) => {
    p.role = null;
    p.alive = true;
    p.cause = null;
    p.ready = p.bot;
  });
  g.winner = null;
  g.lovers = null;
  sys(g, "Nouvelle partie : le village se rassemble autour du feu.", "village", "info");
  return ok();
}

/* ---------- nuit ---------- */

export function stepActors(g, step) {
  const a = alivePlayers(g);
  switch (step) {
    case "cupid":
      return g.day === 1 && !g.lovers ? a.filter((p) => p.role === "cupid") : [];
    case "guard":
      return a.filter((p) => p.role === "guard");
    case "seer":
      return a.filter((p) => p.role === "seer");
    case "wolves":
      return a.filter(isWolf);
    case "witch":
      return g.witch.life || g.witch.death ? a.filter((p) => p.role === "witch") : [];
    default:
      return [];
  }
}

function startNight(g) {
  g.phase = "night";
  g.day++;
  g.step = null;
  g.votes = {};
  g.night = { wolfVotes: {}, victim: null, guard: null, saved: false, poison: null, done: {} };
  sys(g, `🌙 Nuit ${g.day} : le village s'endort...`, "village", "night");
  nextStep(g);
}

function nextStep(g) {
  let i = g.step ? NIGHT_ORDER.indexOf(g.step) + 1 : 0;
  for (; i < NIGHT_ORDER.length; i++) {
    if (stepActors(g, NIGHT_ORDER[i]).length) {
      g.step = NIGHT_ORDER[i];
      g.night.done = {};
      if (g.step === "witch") {
        const w = stepActors(g, "witch")[0];
        const v = find(g, g.night.victim);
        whisper(
          g,
          w.id,
          v
            ? `🧪 Cette nuit, les loups ont attaqué ${v.name}.`
            : "🧪 Les loups n'ont attaqué personne cette nuit.",
          "night",
        );
      }
      return;
    }
  }
  endNight(g);
}

const isActor = (g, id) => stepActors(g, g.step).some((p) => p.id === id);
const aliveTarget = (g, id) => {
  const p = find(g, id);
  return p && p.alive ? p : null;
};

export function nightAction(g, id, a) {
  if (g.phase !== "night") return fail("ce n'est pas la nuit");
  if (!isActor(g, id)) return fail("ce n'est pas ton tour");
  const me = find(g, id);
  const n = g.night;
  switch (g.step) {
    case "cupid": {
      const [x, y] = Array.isArray(a.targets) ? a.targets : [];
      const p1 = aliveTarget(g, x);
      const p2 = aliveTarget(g, y);
      if (!p1 || !p2 || p1 === p2) return fail("choisis deux joueurs différents");
      g.lovers = [p1.id, p2.id];
      whisper(g, id, `💘 Tu as uni ${p1.name} et ${p2.name}.`, "night");
      whisper(g, p1.id, `💘 Tu es amoureux de ${p2.name} (${ROLES[p2.role].name}). Si l'un meurt, l'autre aussi.`, "love");
      whisper(g, p2.id, `💘 Tu es amoureux de ${p1.name} (${ROLES[p1.role].name}). Si l'un meurt, l'autre aussi.`, "love");
      nextStep(g);
      return ok();
    }
    case "guard": {
      const t = aliveTarget(g, a.target);
      if (!t) return fail("cible invalide");
      if (t.id === g.lastGuard) return fail("pas deux nuits de suite le même");
      n.guard = t.id;
      g.lastGuard = t.id;
      whisper(g, id, `🛡️ Tu protèges ${t.name} cette nuit.`, "night");
      nextStep(g);
      return ok();
    }
    case "seer": {
      const t = aliveTarget(g, a.target);
      if (!t || t.id === id) return fail("cible invalide");
      (g.seen[id] ||= {})[t.id] = t.role;
      whisper(g, id, `🔮 ${t.name} est ${ROLES[t.role].icon} ${ROLES[t.role].name}.`, isWolf(t) ? "danger" : "night");
      nextStep(g);
      return ok();
    }
    case "wolves": {
      const t = aliveTarget(g, a.target);
      if (!t || isWolf(t)) return fail("cible invalide");
      if (n.wolfVotes[id] !== t.id) {
        n.wolfVotes[id] = t.id;
        sys(g, `${me.name} veut dévorer ${t.name}.`, "wolves", "night");
      }
      const wolves = stepActors(g, "wolves");
      if (wolves.every((w) => n.wolfVotes[w.id])) resolveWolves(g);
      return ok();
    }
    case "witch": {
      if (a.save && g.witch.life && n.victim) {
        n.saved = true;
        g.witch.life = false;
      }
      if (a.kill && g.witch.death) {
        const t = aliveTarget(g, a.kill);
        if (!t || t.id === id) return fail("cible invalide");
        n.poison = t.id;
        g.witch.death = false;
      }
      nextStep(g);
      return ok();
    }
  }
  return fail("action inconnue");
}

function resolveWolves(g) {
  const n = g.night;
  const counts = {};
  Object.values(n.wolfVotes).forEach((t) => (counts[t] = (counts[t] || 0) + 1));
  const max = Math.max(0, ...Object.values(counts));
  const top = Object.keys(counts).filter((t) => counts[t] === max);
  n.victim = top.length ? pick(top) : null;
  const v = find(g, n.victim);
  sys(g, v ? `La meute a choisi : ${v.name}.` : "La meute n'a choisi personne.", "wolves", "night");
  nextStep(g);
}

export function nightTimeout(g) {
  if (g.phase !== "night") return;
  if (g.step === "wolves") return resolveWolves(g);
  nextStep(g);
}

function endNight(g) {
  const n = g.night;
  g.step = null;
  g.phase = "day";
  sys(g, `☀️ Jour ${g.day} : le village se réveille.`, "village", "day");
  const deaths = [];
  if (n.victim && n.victim !== n.guard && !n.saved) deaths.push([n.victim, "wolves"]);
  if (n.poison && !deaths.some(([d]) => d === n.poison)) deaths.push([n.poison, "poison"]);
  if (!deaths.length) sys(g, "Miracle : personne n'est mort cette nuit.", "village", "day");
  deaths.forEach(([d, c]) => kill(g, d, c));
  settle(g, "day");
}

/* ---------- morts ---------- */

const CAUSE = {
  wolves: "a été dévoré(e) par les loups",
  poison: "a été retrouvé(e) empoisonné(e)",
  vote: "a été éliminé(e) par le village",
  hunter: "a été abattu(e) par le Chasseur",
  grief: "meurt de chagrin",
};

function kill(g, id, cause) {
  const p = find(g, id);
  if (!p || !p.alive) return;
  p.alive = false;
  p.cause = cause;
  p.diedDay = g.day;
  if (g.stats) {
    if (cause === "vote") g.stats.votes++;
    if (cause === "wolves") g.stats.kills++;
  }
  sys(g, `💀 ${p.name} ${CAUSE[cause]}. C'était ${ROLES[p.role].icon} ${ROLES[p.role].name}.`, "village", "death");
  if (p.role === "hunter") g.pendingHunters.push(p.id);
  if (g.lovers?.includes(id)) {
    const other = g.lovers.find((x) => x !== id);
    kill(g, other, "grief");
  }
}

function settle(g, next) {
  if (g.pendingHunters.length) {
    g.phase = "hunter";
    g.hunter = g.pendingHunters.shift();
    g.after = next;
    sys(g, `🏹 ${find(g, g.hunter).name}, le Chasseur, épaule son fusil...`, "village", "danger");
    return;
  }
  g.hunter = null;
  if (checkWin(g)) return;
  if (next === "day") startDay(g);
  else startNight(g);
}

export function hunterShoot(g, id, target) {
  if (g.phase !== "hunter" || g.hunter !== id) return fail("ce n'est pas à toi de tirer");
  const t = aliveTarget(g, target);
  if (t) kill(g, t.id, "hunter");
  else sys(g, "Le Chasseur tire en l'air.", "village", "info");
  settle(g, g.after);
  return ok();
}

export function hunterTimeout(g) {
  if (g.phase !== "hunter") return;
  sys(g, "Le Chasseur hésite trop longtemps et tire en l'air.", "village", "info");
  settle(g, g.after);
}

/* ---------- jour ---------- */

function startDay(g) {
  g.phase = "day";
  g.step = "vote";
  g.votes = {};
  sys(g, "Débattez, puis votez pour éliminer un suspect.", "village", "day");
}

export function vote(g, id, target) {
  if (g.phase !== "day") return fail("pas de vote en cours");
  const me = find(g, id);
  if (!me?.alive) return fail("les morts ne votent pas");
  if (target === null) {
    delete g.votes[id];
    return ok();
  }
  const t = aliveTarget(g, target);
  if (!t || t.id === id) return fail("cible invalide");
  if (g.votes[id] === t.id) return ok();
  g.votes[id] = t.id;
  sys(g, `🗳️ ${me.name} vote contre ${t.name}.`, "village", "vote");
  if (alivePlayers(g).every((p) => g.votes[p.id])) resolveVote(g);
  return ok();
}

export function voteCounts(g) {
  const c = {};
  Object.values(g.votes).forEach((t) => (c[t] = (c[t] || 0) + 1));
  return c;
}

export function resolveVote(g) {
  if (g.phase !== "day") return;
  const counts = voteCounts(g);
  const max = Math.max(0, ...Object.values(counts));
  const top = Object.keys(counts).filter((t) => counts[t] === max);
  g.lastVote = { counts, day: g.day };
  if (top.length !== 1) {
    sys(g, max ? "Égalité : le village n'arrive pas à trancher, personne n'est éliminé." : "Personne n'a voté.", "village", "vote");
  } else {
    kill(g, top[0], "vote");
  }
  g.votes = {};
  settle(g, "night");
}

/* ---------- victoire ---------- */

function checkWin(g) {
  const a = alivePlayers(g);
  const wolves = a.filter(isWolf).length;
  let winner = null;
  if (!a.length) winner = "none";
  else if (g.lovers && a.length === 2 && a.every((p) => g.lovers.includes(p.id)) && isWolf(a[0]) !== isWolf(a[1]))
    winner = "lovers";
  else if (wolves === 0) winner = "village";
  else if (wolves >= a.length - wolves) winner = "wolves";
  if (!winner) return false;
  g.phase = "end";
  g.step = null;
  g.winner = winner;
  g.players.forEach((p) => (p.won = didWin(g, p)));
  sys(
    g,
    {
      village: "🎉 Le village a éliminé tous les loups !",
      wolves: "🐺 Les loups-garous ont pris le contrôle du village.",
      lovers: "💘 Les amoureux survivent seuls et gagnent ensemble !",
      none: "Plus personne n'est en vie...",
    }[winner],
    "village",
    "end",
  );
  return true;
}

export function didWin(g, p) {
  if (!g.winner || !p) return false;
  if (g.winner === "lovers") return !!g.lovers?.includes(p.id);
  if (g.winner === "wolves") return isWolf(p);
  if (g.winner === "village") return !isWolf(p);
  return false;
}

/* ---------- vue par joueur (masque les infos secrètes) ---------- */

const CHANNELS = [
  ["village", "Village"],
  ["wolves", "Meute"],
  ["lovers", "Amoureux"],
  ["dead", "Cimetière"],
];

export function viewFor(g, viewerId) {
  const me = find(g, viewerId);
  const over = g.phase === "end";
  const spectator = over || (me && !me.alive && g.phase !== "lobby");
  const loverView = spectator || !!g.lovers?.includes(viewerId);
  const knows = (p) =>
    !!p.role &&
    (spectator ||
      p.id === viewerId ||
      !p.alive ||
      (isWolf(me) && isWolf(p)) ||
      (g.lovers?.includes(viewerId) && g.lovers.includes(p.id)) ||
      !!g.seen[viewerId]?.[p.id]);
  const players = g.players.map((p) => ({
    id: p.id,
    name: p.name,
    bot: p.bot,
    alive: p.alive,
    ready: p.ready,
    cause: p.alive ? null : p.cause,
    role: knows(p) ? p.role : null,
    lover: loverView && !!g.lovers?.includes(p.id),
    won: over ? didWin(g, p) : undefined,
  }));
  const actors = g.phase === "night" ? stepActors(g, g.step).map((p) => p.id) : [];
  const mine = {
    channels: CHANNELS.filter(([ch]) => canRead(g, me, ch)).map(([ch, label]) => ({
      ch,
      label,
      write: canWrite(g, me, ch),
    })),
    myTurn:
      (g.phase === "night" && actors.includes(viewerId)) ||
      (g.phase === "day" && !!me?.alive) ||
      (g.phase === "hunter" && g.hunter === viewerId),
  };
  if (g.phase === "night" && me) {
    if (isWolf(me) || spectator) mine.wolfVotes = g.night.wolfVotes;
    if (g.step === "witch" && (me.role === "witch" || spectator)) mine.victim = g.night.victim;
    if (me.role === "guard") mine.lastGuard = g.lastGuard;
  }
  if (me?.role === "witch" || spectator) mine.potions = { ...g.witch };
  return {
    game: "werewolf",
    phase: g.phase,
    step: g.step,
    day: g.day,
    hostId: g.hostId,
    settings: g.settings,
    starting: g.starting,
    players,
    actors: spectator || isWolf(me) ? actors : actors.includes(viewerId) ? [viewerId] : [],
    votes: g.phase === "day" ? g.votes : {},
    hunter: g.hunter,
    winner: g.winner,
    lastVote: g.lastVote,
    chat: g.chat.filter((m) => canRead(g, me, m.ch)).slice(-VIEW_CHAT),
    rng: g.rng,
    mine,
  };
}

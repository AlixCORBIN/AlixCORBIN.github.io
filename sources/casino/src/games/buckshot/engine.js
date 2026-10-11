// Moteur du Buckshot : fonctions pures sur l'état de la partie (les délais sont gérés par l'hôte).
// Chaque action crée un « événement » (g.event) que la scène anime ; l'hôte l'applique à la fin
// de sa durée (resolveEvent). Aucune action n'est acceptée tant qu'un événement est en cours.
import { ITEMS, ITEM_IDS } from "./items.js";
import { secureRandomInt } from "../../lib/random.js";
import { fail, ok } from "../../lib/result.js";

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
export const MAX_ITEMS = 8;
export const WIN_ROUNDS = 2;
// Trois manches : charges de vie et objets reçus à chaque chargement.
export const ROUNDS = [
  { hp: 2, items: 0 },
  { hp: 4, items: 2 },
  { hp: 6, items: 4 },
];
// En manche 3, sous ce seuil les câbles du défibrillateur sont coupés : plus de soin possible.
export const CUT_AT = 2;
export const TURN_CHOICES = [0, 30000, 45000, 60000];
export const BOT_NAMES = ["Le Croupier", "Vex", "Moira", "Silas"];

// Durées des animations (ms). La scène s'en sert aussi pour caler ses étapes.
export const EVENT_MS = { round: 3600, deal: 2900, show: 4400, load: 3400, shot: 4200, skip: 2600 };
const ITEM_MS = { biere: 3000, adrenaline: 1700 };
export const itemMs = (ev) => (ev.item === "adrenaline" ? ITEM_MS.adrenaline + itemMs(ev.sub) : ITEM_MS[ev.item] || 2700);
export const eventMs = (ev) => (ev.type === "item" ? itemMs(ev) : EVENT_MS[ev.type] || 2000);

const MAX_LOG = 50;
const find = (g, id) => g.players.find((p) => p.id === id);
const rand = (n) => secureRandomInt(n);

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createBuckshotGame() {
  return {
    game: "buckshot",
    phase: "lobby", // lobby | playing | roundEnd | end
    players: [],
    hostId: null,
    settings: { turnMs: 45000 },
    round: 0,
    turn: 0,
    dir: 1,
    shells: [], // [{ id, live }] : la première est engagée dans la chambre
    loadInfo: null, // { live, blank } du chargement en cours
    spent: [], // cartouches éjectées pendant ce chargement (true = réelle)
    shellSeq: 0,
    loadInRound: 0,
    saw: false,
    know: {}, // { playerId: { shellId: live } } : ce que chacun sait (privé)
    event: null,
    evSeq: 0,
    reloadAfter: false,
    roundWinner: null,
    winner: null,
    log: [],
    seq: 0,
    botSeq: 0,
    startedAt: null,
    endedAt: null,
    stats: newStats(),
  };
}

const newStats = () => ({ loads: 0, shots: 0, hits: 0, selfBlanks: 0, items: 0, damage: 0 });

function note(g, text, tone) {
  g.log.push({ id: ++g.seq, text, tone });
  if (g.log.length > MAX_LOG) g.log.splice(0, g.log.length - MAX_LOG);
}

/* ---------- salle ---------- */

export function addPlayer(g, id, name, { bot = false } = {}) {
  if (find(g, id)) return fail("déjà présent");
  if (g.phase !== "lobby") return fail("partie en cours");
  if (g.players.length >= MAX_PLAYERS) return fail("table pleine");
  const base = String(name || "Joueur").trim().slice(0, 16) || "Joueur";
  let nm = base;
  for (let i = 2; g.players.some((p) => p.name === nm); i++) nm = `${base} ${i}`;
  g.players.push({ id, name: nm, bot, hp: 0, maxHp: 0, items: [], cuffed: false, alive: true, cut: false, wins: 0, afk: 0, left: false });
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
  const bots = g.players.filter((p) => p.bot);
  if (!bots.length) return fail("aucun bot");
  g.players = g.players.filter((p) => p !== bots[bots.length - 1]);
  return ok();
}

export function removePlayer(g, id) {
  const p = find(g, id);
  if (!p) return fail("absent");
  if (g.phase === "lobby" || g.phase === "end") {
    const idx = g.players.indexOf(p);
    g.players.splice(idx, 1);
    if (g.turn > idx) g.turn--;
  } else {
    p.bot = true;
    p.left = true;
    note(g, `${p.name} s'est déconnecté : un bot prend sa place.`, "info");
  }
  if (g.hostId === id) g.hostId = g.players.find((x) => !x.bot)?.id || null;
  return ok();
}

export function fillWithBots(g, min = MIN_PLAYERS) {
  while (g.players.length < min) addBot(g);
}

export function setSettings(g, patch) {
  if (g.phase !== "lobby") return fail("partie en cours");
  if ("turnMs" in patch && TURN_CHOICES.includes(patch.turnMs)) g.settings.turnMs = patch.turnMs;
  return ok();
}

export function startGame(g) {
  if (g.phase !== "lobby") return fail("déjà lancée");
  if (g.players.length < MIN_PLAYERS) return fail("pas assez de joueurs");
  g.round = 0;
  g.startedAt = Date.now();
  g.endedAt = null;
  g.winner = null;
  g.log = [];
  g.stats = newStats();
  g.players.forEach((p) => {
    p.wins = 0;
    p.afk = 0;
  });
  startRound(g);
  return ok();
}

export function backToLobby(g) {
  if (g.phase !== "end") return fail("partie en cours");
  g.players = g.players.filter((p) => !p.left);
  Object.assign(g, { phase: "lobby", round: 0, event: null, shells: [], spent: [], loadInfo: null, winner: null, roundWinner: null, log: [] });
  g.players.forEach((p) => Object.assign(p, { hp: 0, maxHp: 0, items: [], cuffed: false, alive: true, cut: false, wins: 0 }));
  return ok();
}

/* ---------- manches et chargements ---------- */

const cfg = (g) => ROUNDS[Math.min(g.round, ROUNDS.length) - 1];
const alive = (g) => g.players.filter((p) => p.alive);

function setEvent(g, ev) {
  g.event = { id: ++g.evSeq, ...ev };
  g.event.ms = eventMs(g.event);
}

function startRound(g) {
  g.round++;
  const c = cfg(g);
  g.players.forEach((p) => Object.assign(p, { hp: c.hp, maxHp: c.hp, items: [], cuffed: false, alive: true, cut: false }));
  Object.assign(g, { phase: "playing", saw: false, dir: 1, know: {}, shells: [], spent: [], loadInfo: null, loadInRound: 0, roundWinner: null, reloadAfter: false });
  g.turn = (g.round - 1) % g.players.length;
  note(g, `Manche ${g.round} : ${c.hp} charges chacun${c.items ? `, ${c.items} objets par chargement` : ""}.`, "round");
  setEvent(g, { type: "round", round: g.round, hp: c.hp, items: c.items });
}

export function nextRound(g) {
  if (g.phase !== "roundEnd") return fail("pas maintenant");
  startRound(g);
  return ok();
}

// Composition d'un chargement : au moins une réelle et une à blanc, jamais trop déséquilibré.
function makeShells(g) {
  g.loadInRound++;
  let live;
  let n;
  if (g.round === 1 && g.loadInRound === 1) [live, n] = [1, 3];
  else if (g.round === 1 && g.loadInRound === 2) [live, n] = [3, 5];
  else {
    n = 2 + rand(g.round === 1 ? 5 : 7);
    live = Math.floor(n / 2) + (n > 2 ? rand(2) : 0);
  }
  const list = [];
  for (let i = 0; i < n; i++) list.push({ id: ++g.shellSeq, live: i < live });
  g.shells = shuffle(list);
  g.loadInfo = { live, blank: n - live };
  g.spent = [];
  g.saw = false;
}

function drawItem(g) {
  const pool = ITEM_IDS.filter((id) => id !== "telecommande" || alive(g).length >= 3);
  const total = pool.reduce((s, id) => s + ITEMS[id].w, 0);
  let r = rand(total);
  for (const id of pool) {
    r -= ITEMS[id].w;
    if (r < 0) return id;
  }
  return pool[0];
}

function startLoad(g) {
  g.stats.loads++;
  makeShells(g);
  const count = cfg(g).items;
  if (count > 0) {
    const gifts = {};
    const lost = {};
    for (const p of alive(g)) {
      gifts[p.id] = [];
      for (let i = 0; i < count; i++) {
        if (p.items.length + gifts[p.id].length < MAX_ITEMS) gifts[p.id].push(drawItem(g));
        else lost[p.id] = (lost[p.id] || 0) + 1;
      }
    }
    setEvent(g, { type: "deal", gifts, lost });
  } else {
    setEvent(g, { type: "show", live: g.loadInfo.live, blank: g.loadInfo.blank });
  }
}

/* ---------- tours ---------- */

function nextAliveIdx(g, from) {
  const n = g.players.length;
  for (let k = 1; k <= n; k++) {
    const i = (((from + g.dir * k) % n) + n) % n;
    if (g.players[i].alive) return i;
  }
  return from;
}

// Passe la main ; un joueur menotté saute son tour (événement « skip »).
function passTurn(g) {
  g.turn = nextAliveIdx(g, g.turn);
  const p = g.players[g.turn];
  if (p.cuffed) {
    p.cuffed = false;
    note(g, `${p.name} est menotté et passe son tour.`, "info");
    setEvent(g, { type: "skip", who: p.id });
  }
}

function endCheck(g) {
  const left = alive(g);
  if (left.length > 1) return false;
  const w = left[0] || g.players[g.turn];
  w.wins++;
  g.roundWinner = w.id;
  g.event = null;
  g.shells = [];
  note(g, `${w.name} remporte la manche ${g.round}.`, "win");
  if (w.wins >= WIN_ROUNDS || g.round >= ROUNDS.length) {
    const best = Math.max(...g.players.map((p) => p.wins));
    const top = g.players.filter((p) => p.wins === best);
    g.winner = (top.length === 1 ? top[0] : w).id;
    g.phase = "end";
    g.endedAt = Date.now();
    note(g, `${find(g, g.winner).name} gagne la partie !`, "win");
  } else {
    g.phase = "roundEnd";
  }
  return true;
}

function afterAction(g, keep) {
  g.event = null;
  if (endCheck(g)) return;
  if (!keep) passTurn(g);
  if (!g.shells.length) {
    if (g.event) g.reloadAfter = true;
    else startLoad(g);
  }
}

function hurt(g, p, dmg) {
  p.hp = Math.max(0, p.hp - dmg);
  g.stats.damage += dmg;
  if (p.hp <= 0) {
    p.alive = false;
    p.cuffed = false;
    note(g, `${p.name} est hors jeu.`, "dead");
  } else if (g.round === ROUNDS.length && !p.cut && p.hp <= CUT_AT) {
    p.cut = true;
    note(g, `Les câbles de ${p.name} sont coupés : plus aucun soin possible.`, "dead");
  }
}

function heal(p, n) {
  if (p.cut) return 0;
  const gain = Math.max(0, Math.min(n, p.maxHp - p.hp));
  p.hp += gain;
  return gain;
}

function learn(g, pid, shellId, live) {
  (g.know[pid] ||= {})[shellId] = live;
}

/* ---------- actions ---------- */

function actor(g, id) {
  if (g.phase !== "playing") return [null, "pas de partie en cours"];
  if (g.event) return [null, "attends la fin de l'action"];
  const p = g.players[g.turn];
  if (!p || p.id !== id) return [null, "ce n'est pas ton tour"];
  if (!g.shells.length) return [null, "fusil vide"];
  return [p, null];
}

export function shoot(g, id, targetId) {
  const [p, err] = actor(g, id);
  if (!p) return fail(err);
  const t = find(g, targetId || id);
  if (!t || !t.alive) return fail("cible invalide");
  const live = g.shells[0].live;
  const dmg = live ? (g.saw ? 2 : 1) : 0;
  p.afk = 0;
  g.stats.shots++;
  setEvent(g, { type: "shot", by: p.id, target: t.id, live, dmg, saw: g.saw });
  return ok();
}

export function useItem(g, id, idx, opts = {}) {
  const [p, err] = actor(g, id);
  if (!p) return fail(err);
  const item = p.items[idx];
  if (!item) return fail("objet introuvable");
  const res = buildItem(g, p, item, opts, false);
  if (!res.ok) return res;
  p.afk = 0;
  setEvent(g, { ...res.ev, idx });
  return ok();
}

function pickTarget(g, p, targetId) {
  if (targetId) return find(g, targetId);
  const others = alive(g).filter((x) => x !== p);
  return others.length === 1 ? others[0] : null;
}

function buildItem(g, p, item, { target, steal } = {}, nested) {
  const ev = { type: "item", by: p.id, item };
  const cur = g.shells[0];
  switch (item) {
    case "loupe":
      ev.priv = { live: cur.live };
      break;
    case "biere":
      ev.live = cur.live;
      break;
    case "cigarettes":
      ev.gain = p.cut ? 0 : Math.min(1, p.maxHp - p.hp);
      break;
    case "scie":
      if (g.saw) return fail("le canon est déjà scié");
      break;
    case "menottes": {
      const t = pickTarget(g, p, target);
      if (!t || t === p || !t.alive) return fail("choisis un adversaire");
      if (t.cuffed) return fail(`${t.name} est déjà menotté`);
      ev.target = t.id;
      break;
    }
    case "inverseur":
      break;
    case "telephone":
      if (g.shells.length <= 1) ev.priv = { none: true };
      else {
        const k = 1 + rand(g.shells.length - 1);
        ev.priv = { pos: k + 1, live: g.shells[k].live };
        ev.shell = g.shells[k].id;
      }
      break;
    case "medicament":
      ev.lucky = rand(100) < 40;
      ev.gain = ev.lucky ? (p.cut ? 0 : Math.min(2, p.maxHp - p.hp)) : 0;
      break;
    case "adrenaline": {
      if (nested) return fail("impossible");
      const t = pickTarget(g, p, target);
      if (!t || t === p || !t.alive) return fail("choisis un adversaire");
      const stolen = t.items[steal];
      if (!stolen) return fail("choisis un objet à voler");
      if (stolen === "adrenaline") return fail("on ne vole pas une adrénaline");
      const sub = buildItem(g, p, stolen, { target: t.id }, true);
      if (!sub.ok) return sub;
      Object.assign(ev, { target: t.id, steal, sub: sub.ev });
      break;
    }
    case "telecommande":
      if (alive(g).length < 3) return fail("inutile à deux joueurs");
      break;
    default:
      return fail("objet inconnu");
  }
  return ok({ ev });
}

function applyItem(g, ev) {
  const p = find(g, ev.by);
  const name = ITEMS[ev.item].name;
  g.stats.items++;
  switch (ev.item) {
    case "loupe":
      learn(g, p.id, g.shells[0].id, g.shells[0].live);
      note(g, `${p.name} examine la cartouche à la loupe.`);
      break;
    case "biere": {
      const s = g.shells.shift();
      g.spent.push(s.live);
      g.saw = false;
      note(g, `${p.name} boit une bière et éjecte une cartouche ${s.live ? "RÉELLE" : "à blanc"}.`, s.live ? "live" : "blank");
      break;
    }
    case "cigarettes": {
      const gain = heal(p, 1);
      note(g, gain ? `${p.name} fume une cigarette : +1 charge.` : `${p.name} fume une cigarette, sans effet.`, gain ? "heal" : undefined);
      break;
    }
    case "scie":
      g.saw = true;
      note(g, `${p.name} scie le canon : le prochain tir réel fera 2 dégâts.`, "live");
      break;
    case "menottes": {
      const t = find(g, ev.target);
      t.cuffed = true;
      note(g, `${p.name} menotte ${t.name}.`);
      break;
    }
    case "inverseur": {
      const s = g.shells[0];
      s.live = !s.live;
      for (const k of Object.values(g.know)) if (s.id in k) k[s.id] = s.live;
      note(g, `${p.name} utilise l'inverseur.`);
      break;
    }
    case "telephone":
      if (ev.shell) learn(g, p.id, ev.shell, ev.priv.live);
      note(g, ev.shell ? `${p.name} reçoit un appel mystérieux.` : `${p.name} décroche… « Dommage. »`);
      break;
    case "medicament":
      if (ev.lucky) {
        const gain = heal(p, 2);
        note(g, `${p.name} avale le médicament : +${gain} charge${gain > 1 ? "s" : ""}.`, "heal");
      } else {
        note(g, `${p.name} avale le médicament : il était vraiment périmé (−1).`, "live");
        hurt(g, p, 1);
      }
      break;
    case "adrenaline": {
      const t = find(g, ev.target);
      t.items.splice(ev.steal, 1);
      note(g, `${p.name} s'injecte de l'adrénaline et vole ${ITEMS[ev.sub.item].name} à ${t.name}.`);
      applyItem(g, ev.sub);
      g.stats.items--;
      break;
    }
    case "telecommande":
      g.dir = -g.dir;
      note(g, `${p.name} inverse le sens du jeu.`);
      break;
    default:
      note(g, `${p.name} utilise ${name}.`);
  }
}

/* ---------- résolution des événements (appelée par l'hôte) ---------- */

export function resolveEvent(g) {
  const ev = g.event;
  if (!ev) return;
  switch (ev.type) {
    case "round":
      g.event = null;
      startLoad(g);
      break;
    case "deal":
      for (const [pid, list] of Object.entries(ev.gifts)) find(g, pid)?.items.push(...list);
      setEvent(g, { type: "show", live: g.loadInfo.live, blank: g.loadInfo.blank });
      break;
    case "show":
      note(g, `Chargement : ${ev.live} réelle${ev.live > 1 ? "s" : ""}, ${ev.blank} à blanc.`, "load");
      setEvent(g, { type: "load", n: ev.live + ev.blank });
      break;
    case "load":
      g.event = null;
      break;
    case "shot": {
      const p = find(g, ev.by);
      const t = find(g, ev.target);
      const s = g.shells.shift();
      g.spent.push(s.live);
      g.saw = false;
      const self = p === t;
      if (ev.live) {
        g.stats.hits++;
        note(g, `${p.name} tire sur ${self ? "lui-même" : t.name} : RÉELLE${ev.dmg > 1 ? " (canon scié, −2)" : ""}.`, "live");
        hurt(g, t, ev.dmg);
      } else {
        if (self) g.stats.selfBlanks++;
        note(g, `${p.name} tire sur ${self ? "lui-même" : t.name} : à blanc.${self ? " Il rejoue." : ""}`, "blank");
      }
      afterAction(g, self && !ev.live);
      break;
    }
    case "skip":
      g.event = null;
      passTurn(g);
      if (!g.event && g.reloadAfter) {
        g.reloadAfter = false;
        startLoad(g);
      }
      break;
    case "item": {
      const p = find(g, ev.by);
      p.items.splice(ev.idx, 1);
      applyItem(g, ev);
      afterAction(g, p.alive);
      break;
    }
    default:
      g.event = null;
  }
}

// Temps écoulé : le joueur tire sur un adversaire au hasard.
export function timeoutTurn(g) {
  if (g.phase !== "playing" || g.event) return;
  const p = g.players[g.turn];
  if (!p || p.bot) return;
  p.afk++;
  const others = alive(g).filter((x) => x !== p);
  const t = others[rand(others.length)] || p;
  note(g, `Temps écoulé pour ${p.name}.`, "info");
  shoot(g, p.id, t.id);
}

/* ---------- vue envoyée à chaque joueur ---------- */

function cleanEvent(ev, viewer) {
  if (!ev) return null;
  const out = { ...ev };
  if (out.priv && out.by !== viewer) delete out.priv;
  delete out.shell;
  if (out.sub) out.sub = cleanEvent(out.sub, viewer);
  return out;
}

export function viewFor(g, viewer) {
  const mine = g.know[viewer] || {};
  return {
    game: g.game,
    phase: g.phase,
    hostId: g.hostId,
    settings: g.settings,
    round: g.round,
    turn: g.players[g.turn]?.id || null,
    dir: g.dir,
    players: g.players.map((p) => ({
      id: p.id,
      name: p.name,
      bot: p.bot,
      hp: p.hp,
      maxHp: p.maxHp,
      items: p.items.slice(),
      cuffed: p.cuffed,
      alive: p.alive,
      cut: p.cut,
      wins: p.wins,
      left: p.left,
    })),
    shellCount: g.shells.length,
    loadInfo: g.loadInfo,
    spent: g.spent.slice(),
    saw: g.saw,
    event: cleanEvent(g.event, viewer),
    myKnow: g.shells.map((s) => (s.id in mine ? mine[s.id] : null)),
    log: g.log.slice(-14),
    roundWinner: g.roundWinner,
    winner: g.winner,
  };
}

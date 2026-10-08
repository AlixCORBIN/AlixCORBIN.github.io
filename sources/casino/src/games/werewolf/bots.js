// IA simple des bots : décisions de nuit, votes de jour et quelques répliques.
import { alivePlayers, isWolf, voteCounts } from "./engine.js";
import { secureRandomInt } from "../../lib/random.js";

const pick = (arr) => (arr.length ? arr[secureRandomInt(arr.length)] : null);
const chance = (p) => secureRandomInt(1000) < p * 1000;
const partnerOf = (g, id) => (g.lovers?.includes(id) ? g.lovers.find((x) => x !== id) : null);

function knownWolves(g, bot) {
  const seen = g.seen[bot.id] || {};
  return alivePlayers(g).filter((p) => seen[p.id] === "wolf");
}

function suspects(g, bot) {
  const partner = partnerOf(g, bot.id);
  const others = alivePlayers(g).filter((p) => p.id !== bot.id && p.id !== partner);
  if (isWolf(bot)) return others.filter((p) => !isWolf(p));
  const seen = g.seen[bot.id] || {};
  return others.filter((p) => seen[p.id] !== "villager" && !(seen[p.id] && seen[p.id] !== "wolf"));
}

function leader(counts, filter) {
  let best = null;
  let max = 0;
  for (const [id, c] of Object.entries(counts)) {
    if (c > max && filter(id)) {
      best = id;
      max = c;
    }
  }
  return best;
}

export function botNight(g, bot) {
  const others = alivePlayers(g).filter((p) => p.id !== bot.id);
  switch (g.step) {
    case "cupid": {
      const pool = alivePlayers(g);
      const a = pick(pool);
      const b = pick(pool.filter((p) => p !== a));
      return { t: "night", targets: [a.id, b.id] };
    }
    case "guard": {
      const pool = alivePlayers(g).filter((p) => p.id !== g.lastGuard);
      const self = pool.find((p) => p.id === bot.id);
      return { t: "night", target: (self && chance(0.3) ? self : pick(pool)).id };
    }
    case "seer": {
      const seen = g.seen[bot.id] || {};
      const fresh = others.filter((p) => !seen[p.id]);
      return { t: "night", target: (pick(fresh) || pick(others)).id };
    }
    case "wolves": {
      const prey = others.filter((p) => !isWolf(p));
      const already = Object.values(g.night.wolfVotes).filter((t) => prey.some((p) => p.id === t));
      const claimer = g.claims.map((c) => c.by).find((id) => prey.some((p) => p.id === id));
      const target =
        (already.length && chance(0.85) && pick(already)) ||
        (claimer && chance(0.8) && claimer) ||
        pick(prey)?.id;
      return { t: "night", target };
    }
    case "witch": {
      const v = g.night.victim;
      const save = !!v && g.witch.life && (v === bot.id || v === partnerOf(g, bot.id) || chance(0.55));
      let kill = null;
      if (g.witch.death && g.day >= 2 && chance(0.35)) {
        const known = knownWolves(g, bot)[0];
        const last = g.lastVote ? leader(g.lastVote.counts, (id) => others.some((p) => p.id === id)) : null;
        kill = known?.id || last || null;
        if (kill === partnerOf(g, bot.id)) kill = null;
      }
      return { t: "night", save, kill };
    }
  }
  return null;
}

export function botVote(g, bot) {
  const pool = suspects(g, bot);
  if (!pool.length) return null;
  const ids = new Set(pool.map((p) => p.id));
  const known = !isWolf(bot) && knownWolves(g, bot).find((p) => ids.has(p.id));
  if (known) return known.id;
  const claim = !isWolf(bot) && g.claims.find((c) => ids.has(c.target) && c.day === g.day);
  if (claim && chance(0.75)) return claim.target;
  const lead = leader(voteCounts(g), (id) => ids.has(id));
  if (lead && chance(isWolf(bot) ? 0.7 : 0.5)) return lead;
  return pick(pool).id;
}

export function botShoot(g, bot) {
  const pool = suspects(g, bot);
  const known = knownWolves(g, bot)[0];
  const last = g.lastVote ? leader(g.lastVote.counts, (id) => pool.some((p) => p.id === id)) : null;
  return known?.id || last || pick(pool)?.id || null;
}

const LINES = {
  open: [
    "Bon... qui a entendu du bruit cette nuit ?",
    "Je ne fais confiance à personne aujourd'hui.",
    "Restons calmes et réfléchissons.",
    "Il faut voter, sinon les loups gagnent.",
    "Moi je suis simple villageois, je vous le jure.",
  ],
  accuse: [
    "{x} est bien trop silencieux à mon goût.",
    "Je trouve {x} louche depuis hier.",
    "{x}, tu peux nous expliquer ton vote ?",
    "Mon instinct me dit {x}.",
    "Votons {x}, je le sens mal.",
  ],
  defend: [
    "Pourquoi moi ?! Je suis innocent !",
    "Vous faites fausse route, ce n'est pas moi.",
    "Si vous m'éliminez, vous le regretterez.",
  ],
  wolves: [
    "On prend {x} cette nuit ?",
    "{x} commence à nous soupçonner.",
    "Je propose {x}.",
    "Discrets demain, on suit le vote du village.",
  ],
};

export function botChat(g, bot, ch) {
  const others = alivePlayers(g).filter((p) => p.id !== bot.id);
  if (!others.length) return null;
  if (ch === "wolves") {
    const prey = others.filter((p) => !isWolf(p));
    const x = pick(prey);
    return x ? pick(LINES.wolves).replace("{x}", x.name) : null;
  }
  // Une voyante qui a trouvé un loup se dévoile parfois.
  if (bot.role === "seer") {
    const w = knownWolves(g, bot)[0];
    if (w && !g.claims.some((c) => c.by === bot.id && c.target === w.id) && chance(0.6)) {
      g.claims.push({ by: bot.id, target: w.id, day: g.day });
      return `Je suis la Voyante : ${w.name} est un loup-garou !`;
    }
  }
  const counts = voteCounts(g);
  if ((counts[bot.id] || 0) >= 2 && chance(0.6)) return pick(LINES.defend);
  const target = botVote(g, bot);
  const x = g.players.find((p) => p.id === target);
  if (x && chance(0.65)) return pick(LINES.accuse).replace("{x}", x.name);
  return pick(LINES.open);
}

export const botDelay = (min, max) => min + secureRandomInt(Math.max(1, max - min));

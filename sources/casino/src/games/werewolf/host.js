import { botChat, botDelay, botNight, botShoot, botVote } from "./bots.js";
import {
  addBot,
  addPlayer,
  alivePlayers,
  backToLobby,
  createWerewolfGame,
  fillWithBots,
  hunterShoot,
  hunterTimeout,
  isWolf,
  nightAction,
  nightTimeout,
  removeBot,
  removePlayer,
  resolveVote,
  say,
  setReady,
  setSettings,
  startGame,
  stepActors,
  viewFor,
  vote,
} from "./engine.js";
import { saveWerewolfGame } from "./api.js";
import { fetchShuffleKeys } from "../../lib/random.js";
import { fail } from "../../lib/result.js";
import { HostController } from "../../net/controller.js";

const HUNTER_MS = 25000;

export class WerewolfHost extends HostController {
  makeGame() {
    return createWerewolfGame();
  }
  addPlayer(id, name) {
    return addPlayer(this.g, id, name);
  }
  removePlayer(id) {
    return removePlayer(this.g, id);
  }
  viewOf() {
    return viewFor(this.g, this.me);
  }
  ensureKeys() {}

  // Chaque joueur reçoit sa propre vue : les rôles secrets ne quittent jamais l'hôte.
  publish() {
    this.announce();
    this.schedule();
    this.state = viewFor(this.g, this.me);
    this.decorate(this.state);
    this.emit();
    if (this.online && this.link && this.status === "ready") {
      for (const p of this.g.players) {
        if (p.bot || p.id === this.me || !this.seen.has(p.id)) continue;
        const s = viewFor(this.g, p.id);
        this.decorate(s);
        this.link.send(p.id, { t: "state", s });
      }
    }
  }
  decorate(view) {
    view.deadline = this.deadline
      ? { ms: Math.max(0, this.deadline - Date.now()), total: this.deadlineTotal }
      : null;
    view.online = this.online;
  }
  act(action) {
    const res = this.handle(this.me, action) || { ok: false };
    this.lastError = res.ok ? null : res.error;
    if (res.ok) this.publish();
    else this.emit();
  }
  handle(id, a) {
    const g = this.g;
    const isHost = id === g.hostId;
    switch (a?.t) {
      case "chat":
        return say(g, id, a.ch, a.text);
      case "ready":
        return setReady(g, id, a.v);
      case "settings":
        return isHost ? setSettings(g, a.patch || {}) : fail("réservé à l'hôte");
      case "addBot":
        return isHost ? addBot(g) : fail("réservé à l'hôte");
      case "removeBot":
        return isHost ? removeBot(g) : fail("réservé à l'hôte");
      case "start":
        return isHost ? this.start() : fail("réservé à l'hôte");
      case "night":
        return nightAction(g, id, a);
      case "vote": {
        const res = vote(g, id, a.target ?? null);
        if (res.ok) this.hurryBots();
        return res;
      }
      case "endDay":
        if (!isHost || g.phase !== "day") return fail("réservé à l'hôte");
        resolveVote(g);
        return { ok: true };
      case "shoot":
        return hunterShoot(g, id, a.target);
      case "restart":
        return isHost ? backToLobby(g) : fail("réservé à l'hôte");
    }
    return fail("action inconnue");
  }
  start() {
    const g = this.g;
    if (g.phase !== "lobby" || g.starting) return fail("déjà lancé");
    fillWithBots(g);
    g.starting = true;
    const n = g.players.length;
    fetchShuffleKeys(n, { timeoutMs: 4000 })
      .then(({ keys, meta }) => startGame(g, keys, meta))
      .catch(() => startGame(g, null, null))
      .finally(() => this.publish());
    return { ok: true };
  }

  // Si tous les humains ont voté, les bots se décident vite.
  hurryBots() {
    const g = this.g;
    if (g.phase !== "day") return;
    const living = alivePlayers(g);
    if (!living.filter((p) => !p.bot).every((p) => g.votes[p.id])) return;
    living
      .filter((p) => p.bot && !g.votes[p.id])
      .forEach((b) => this.arm("vote-" + b.id, botDelay(600, 2500), () => this.botVote(b)));
  }
  botVote(b) {
    const g = this.g;
    if (g.phase !== "day" || !b.alive || g.votes[b.id]) return;
    const t = botVote(g, b);
    if (t) vote(g, b.id, t);
  }
  botSay(b, ch) {
    const g = this.g;
    if (!b.alive) return;
    const text = botChat(g, b, ch);
    if (text) {
      b.lastMsg = 0;
      say(g, b.id, ch, text);
    }
  }

  schedule() {
    const g = this.g;
    const sig = [g.phase, g.step, g.day, g.hunter].join("|");
    if (sig === this.sig) return;
    if (g.phase === "end" && !this.sig.startsWith("end")) saveWerewolfGame(g);
    this.sig = sig;
    this.clearTimers();
    this.deadline = null;
    const setDeadline = (ms, fn) => {
      this.deadline = Date.now() + ms;
      this.deadlineTotal = ms;
      this.arm("deadline", ms, fn);
    };
    const humans = (list) => list.some((p) => !p.bot);

    if (g.phase === "night") {
      const actors = stepActors(g, g.step);
      setDeadline(humans(actors) ? g.settings.nightMs : 8000, () => nightTimeout(g));
      actors
        .filter((p) => p.bot)
        .forEach((b) =>
          this.arm("bot-" + b.id, botDelay(1800, 5000), () => {
            if (g.phase !== "night" || !stepActors(g, g.step).includes(b)) return;
            const a = botNight(g, b);
            if (a) nightAction(g, b.id, a);
          }),
        );
      if (g.step === "wolves" && actors.some((p) => !p.bot)) {
        actors
          .filter((p) => p.bot)
          .forEach((b) => this.arm("wchat-" + b.id, botDelay(800, 2500), () => this.botSay(b, "wolves")));
      }
    } else if (g.phase === "day") {
      const ms = g.settings.dayMs;
      setDeadline(ms, () => resolveVote(g));
      alivePlayers(g)
        .filter((p) => p.bot)
        .forEach((b) => {
          this.arm("chat1-" + b.id, botDelay(2000, ms * 0.35), () => this.botSay(b, "village"));
          if (secureChance(0.5))
            this.arm("chat2-" + b.id, botDelay(ms * 0.35, ms * 0.6), () => this.botSay(b, "village"));
          this.arm("vote-" + b.id, botDelay(ms * 0.4, ms * 0.85), () => this.botVote(b));
        });
      this.hurryBots();
    } else if (g.phase === "hunter") {
      const h = g.players.find((p) => p.id === g.hunter);
      setDeadline(h?.bot ? 6000 : HUNTER_MS, () => hunterTimeout(g));
      if (h?.bot)
        this.arm("bot-hunter", botDelay(1500, 3500), () => {
          if (g.phase === "hunter" && g.hunter === h.id) hunterShoot(g, h.id, botShoot(g, h));
        });
    }
  }
}

const secureChance = (p) => Math.random() < p;

export { isWolf };

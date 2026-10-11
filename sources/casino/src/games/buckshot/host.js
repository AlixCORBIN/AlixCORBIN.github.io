import { botDelay, botTurn } from "./bots.js";
import { saveBuckshotGame } from "./api.js";
import {
  addBot,
  addPlayer,
  backToLobby,
  createBuckshotGame,
  eventMs,
  fillWithBots,
  nextRound,
  removeBot,
  removePlayer,
  resolveEvent,
  setSettings,
  shoot,
  startGame,
  timeoutTurn,
  useItem,
  viewFor,
} from "./engine.js";
import { fail } from "../../lib/result.js";
import { HostController } from "../../net/controller.js";

const ROUND_END_MS = 7000;

export class BuckshotHost extends HostController {
  makeGame() {
    return createBuckshotGame();
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

  // Chaque joueur reçoit sa propre vue : ce que révèlent la loupe et le téléphone reste privé.
  publish() {
    this.announce();
    this.schedule();
    this.state = viewFor(this.g, this.me);
    this.decorate(this.state);
    this.updateMiis();
    this.emit();
    this.sendViews();
  }
  sendViews() {
    if (!this.online || !this.link || this.status !== "ready") return;
    for (const p of this.g.players) {
      if (p.bot || p.id === this.me || !this.seen.has(p.id)) continue;
      const s = viewFor(this.g, p.id);
      this.decorate(s);
      this.link.send(p.id, { t: "state", s });
    }
  }
  heartbeat() {
    super.heartbeat();
    this.sendViews();
  }
  decorate(view) {
    view.deadline = this.deadline ? { ms: Math.max(0, this.deadline - Date.now()), total: this.deadlineTotal } : null;
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
      case "settings":
        return isHost ? setSettings(g, a.patch || {}) : fail("réservé à l'hôte");
      case "addBot":
        return isHost ? addBot(g) : fail("réservé à l'hôte");
      case "removeBot":
        return isHost ? removeBot(g) : fail("réservé à l'hôte");
      case "start":
        if (!isHost) return fail("réservé à l'hôte");
        fillWithBots(g);
        g.gameId = crypto.randomUUID();
        this.saved = false;
        return startGame(g);
      case "shoot":
        return shoot(g, id, a.target);
      case "item":
        return useItem(g, id, a.idx, { target: a.target, steal: a.steal });
      case "next":
        return isHost ? nextRound(g) : fail("réservé à l'hôte");
      case "restart":
        return isHost ? backToLobby(g) : fail("réservé à l'hôte");
      default:
        return fail("action inconnue");
    }
  }

  botAct(bot) {
    const g = this.g;
    if (g.phase !== "playing" || g.event || g.players[g.turn] !== bot) return;
    const a = botTurn(g, bot);
    const res = a.t === "item" ? useItem(g, bot.id, a.idx, a) : shoot(g, bot.id, a.target);
    if (!res.ok) {
      const t = g.players.find((p) => p.alive && p !== bot) || bot;
      shoot(g, bot.id, t.id);
    }
  }

  schedule() {
    const g = this.g;
    const sig = [g.phase, g.round, g.turn, g.event?.id, g.shells.length, g.players.map((p) => p.items.length).join(",")].join("|");
    if (sig === this.sig) return;
    this.sig = sig;
    this.clearTimers();
    this.deadline = null;
    if (g.phase === "end" && !this.saved) {
      this.saved = true;
      if (g.players.some((p) => !p.bot)) saveBuckshotGame(g);
    }
    if (g.phase === "playing" && g.event) {
      this.arm("event", eventMs(g.event), () => resolveEvent(g));
    } else if (g.phase === "playing") {
      const p = g.players[g.turn];
      if (p?.bot) this.arm("bot", botDelay(1300, 2500), () => this.botAct(p));
      else if (g.settings.turnMs > 0) {
        this.deadline = Date.now() + g.settings.turnMs;
        this.deadlineTotal = g.settings.turnMs;
        this.arm("deadline", g.settings.turnMs, () => timeoutTurn(g));
      }
    } else if (g.phase === "roundEnd") {
      this.deadline = Date.now() + ROUND_END_MS;
      this.deadlineTotal = ROUND_END_MS;
      this.arm("next", ROUND_END_MS, () => nextRound(g));
    }
  }
}

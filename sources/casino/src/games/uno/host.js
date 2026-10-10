import { botCatches, botDelay, botTurn } from "./bots.js";
import { saveUnoGame } from "./api.js";
import {
  accept,
  addBot,
  addPlayer,
  backToLobby,
  catchUno,
  challenge,
  createUnoGame,
  draw,
  fillWithBots,
  nextRound,
  pass,
  play,
  removeBot,
  removePlayer,
  sayUno,
  setSettings,
  startGame,
  timeoutTurn,
  viewFor,
} from "./engine.js";
import { fail } from "../../lib/result.js";
import { HostController } from "../../net/controller.js";

const ROUND_END_MS = 14000;

export class UnoHost extends HostController {
  makeGame() {
    return createUnoGame();
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

  // Chaque joueur reçoit sa propre vue : les mains adverses ne quittent jamais l'hôte.
  publish() {
    this.announce();
    this.schedule();
    this.state = viewFor(this.g, this.me);
    this.decorate(this.state);
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
  // Un message « état » perdu laisserait un client figé jusqu'à la prochaine action : on le renvoie à chaque battement.
  heartbeat() {
    super.heartbeat();
    this.sendViews();
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
    const mine = g.players.find((p) => p.id === id);
    let res;
    switch (a?.t) {
      case "settings":
        return isHost ? setSettings(g, a.patch || {}) : fail("réservé à l'hôte");
      case "addBot":
        return isHost ? addBot(g) : fail("réservé à l'hôte");
      case "removeBot":
        return isHost ? removeBot(g) : fail("réservé à l'hôte");
      case "start":
        if (!isHost) return fail("réservé à l'hôte");
        fillWithBots(g, 3);
        g.gameId = crypto.randomUUID();
        return startGame(g);
      case "play":
        res = play(g, id, a.card, a.color, !!a.uno);
        break;
      case "draw":
        res = draw(g, id);
        break;
      case "pass":
        res = pass(g, id);
        break;
      case "challenge":
        res = challenge(g, id);
        break;
      case "accept":
        res = accept(g, id);
        break;
      case "uno":
        res = sayUno(g, id);
        break;
      case "catch":
        res = catchUno(g, id, a.target);
        break;
      case "next":
        return isHost ? nextRound(g) : fail("réservé à l'hôte");
      case "restart":
        return isHost ? backToLobby(g) : fail("réservé à l'hôte");
      default:
        return fail("action inconnue");
    }
    if (res.ok && mine && a.t !== "uno" && a.t !== "catch") mine.afk = 0;
    return res;
  }

  botAct(bot) {
    const g = this.g;
    if (g.phase !== "playing") return;
    const actor = g.challenge ? g.players.find((p) => p.id === g.challenge.to) : g.players[g.turn];
    if (actor !== bot) return;
    const a = botTurn(g, bot);
    if (a.t === "play") play(g, bot.id, a.card, a.color, a.uno);
    else if (a.t === "draw") draw(g, bot.id);
    else if (a.t === "pass") pass(g, bot.id);
    else if (a.t === "challenge") challenge(g, bot.id);
    else accept(g, bot.id);
  }

  schedule() {
    const g = this.g;
    const sig = [
      g.phase,
      g.round,
      g.turn,
      g.dir,
      g.drawn,
      g.pending,
      g.challenge?.to,
      g.unoRisk?.id,
      g.discard.length,
      g.deck.length,
    ].join("|");
    if (sig === this.sig) return;
    if (g.phase === "end" && !this.sig?.startsWith("end")) saveUnoGame(g);
    this.sig = sig;
    this.clearTimers();
    this.deadline = null;
    const setDeadline = (ms, fn) => {
      this.deadline = Date.now() + ms;
      this.deadlineTotal = ms;
      this.arm("deadline", ms, fn);
    };

    if (g.phase === "playing") {
      const actor = g.challenge ? g.players.find((p) => p.id === g.challenge.to) : g.players[g.turn];
      if (actor?.bot) {
        this.arm("bot", botDelay(1100, 2300), () => this.botAct(actor));
      } else if (g.settings.turnMs > 0) {
        setDeadline(g.settings.turnMs, () => timeoutTurn(g));
      }
      // Un joueur à 1 carte sans UNO : les bots peuvent le surprendre.
      if (g.unoRisk) {
        g.players
          .filter((p) => p.bot && p.id !== g.unoRisk.id)
          .forEach((b) =>
            this.arm("catch-" + b.id, botDelay(1200, 3200), () => {
              if (g.unoRisk && botCatches(g, b)) catchUno(g, b.id, g.unoRisk.id);
            }),
          );
      }
    } else if (g.phase === "roundEnd") {
      setDeadline(ROUND_END_MS, () => nextRound(g));
    }
  }
}

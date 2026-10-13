import { saveMilleBornesGame } from "./api.js";
import { botCoups, botDelay, botTurn } from "./bots.js";
import {
  addBot, addPlayer, backToLobby, canCoup, coupFourre, createMbGame, currentPlayer, discard, fillWithBots,
  nextRound, play, removeBot, removePlayer, resolveEffect, setSettings, startGame, viewFor,
} from "./engine.js";
import { fail } from "../../lib/result.js";
import { HostController } from "../../net/controller.js";

const ROUND_END_MS = 16000;

// Rythme « plateau » : chaque carte a le temps d'être vue et la voiture de rouler avant le joueur suivant.
const effectDelay = (e) => {
  if (e.coup) return 3600;
  if (e.finish) return 3600;
  if (e.kind === "dist") return 2300 + Number(e.card.k) * 8; // 100 km ≈ 3,1 s : la caméra suit la voiture jusqu'au bout
  if (e.kind === "hazard") return 3400; // même durée que le joueur visé ait la botte ou non : rien ne fuite
  if (e.kind === "safety") return 2800;
  if (e.kind === "discard") return 1300;
  return 2000;
};

export class MilleBorneHost extends HostController {
  makeGame() {
    return createMbGame();
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

  // Chaque joueur reçoit sa vue : les mains adverses restent chez l'hôte.
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

    this.sendWatchers();
  }
  spectatorView() {
    const s = viewFor(this.g, "__spectator__");
    this.decorate(s);
    return s;
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
        fillWithBots(g, 2);
        return startGame(g);
      case "play":
        return play(g, id, a.card, a.target);
      case "discard":
        return discard(g, id, a.card);
      case "coup":
        return coupFourre(g, id);
      case "next":
        return isHost ? nextRound(g) : fail("réservé à l'hôte");
      case "restart":
        return isHost ? backToLobby(g) : fail("réservé à l'hôte");
      default:
        return fail("action inconnue");
    }
  }

  autoPlay(p) {
    const g = this.g;
    if (g.phase !== "playing" || g.effect || currentPlayer(g) !== p) return;
    const a = botTurn(g, p);
    if (a.t === "play") play(g, p.id, a.card, a.target);
    else discard(g, p.id, a.card);
  }

  schedule() {
    const g = this.g;
    const e = g.effect;
    const sig = [g.phase, g.round, g.turn, g.deck.length, e?.id, e?.coup].join("|");
    if (sig === this.sig) return;
    if (g.phase === "end" && !String(this.sig || "").startsWith("end") && g.players.some((p) => !p.bot)) saveMilleBornesGame(g);
    this.sig = sig;
    this.clearTimers();
    this.deadline = null;
    const setDeadline = (ms, fn) => {
      this.deadline = Date.now() + ms;
      this.deadlineTotal = ms;
      this.arm("deadline", ms, fn);
    };
    if (g.phase === "playing" && e) {
      const ms = effectDelay(e);
      this.arm("effect", botDelay(ms, ms + 1), () => resolveEffect(g));
      const t = g.players.find((p) => p.bot && canCoup(g, p.id));
      if (t && botCoups()) this.arm("coup", botDelay(900, 1700), () => coupFourre(g, t.id));
    } else if (g.phase === "playing") {
      const p = currentPlayer(g);
      if (p?.bot) this.arm("bot", botDelay(1800, 2900), () => this.autoPlay(p));
      else if (g.settings.turnMs > 0)
        setDeadline(g.settings.turnMs, () => {
          p.afk = (p.afk || 0) + 1;
          this.autoPlay(p);
        });
    } else if (g.phase === "roundEnd") {
      setDeadline(ROUND_END_MS, () => nextRound(g));
    }
  }
}

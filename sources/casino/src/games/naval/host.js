import { saveNavalGame } from "./api.js";
import { botDelay, botTarget } from "./bots.js";
import {
  addBot,
  addPlayer,
  afterImpact,
  autoPlace,
  backToLobby,
  createNavalGame,
  fire,
  placeFleet,
  removeBot,
  removePlayer,
  resolveShot,
  setSettings,
  startGame,
  timeoutFire,
  unready,
  viewFor,
} from "./engine.js";
import { fail } from "../../lib/result.js";
import { HostController } from "../../net/controller.js";

const PLACE_MS = 120000;
// Rythme volontairement posé : on voit le missile partir, arriver, puis l'effet avant de passer la main.
export const FLY_MS = 1900;
const impactMs = (shot) => (shot?.sunk ? 3400 : shot?.hit ? 2400 : 1900);

export class NavalHost extends HostController {
  makeGame() {
    return createNavalGame();
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

  // Chaque joueur reçoit sa propre vue : la flotte adverse ne quitte jamais l'hôte.
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
        g.gameId = crypto.randomUUID();
        return startGame(g);
      case "place":
        return placeFleet(g, id, a.ships);
      case "unready":
        return unready(g, id);
      case "fire":
        return fire(g, id, a.x, a.y);
      case "restart":
        return isHost ? backToLobby(g) : fail("réservé à l'hôte");
      default:
        return fail("action inconnue");
    }
  }

  schedule() {
    const g = this.g;
    const sig = [g.phase, g.step, g.turn, g.shot?.seq, g.players.map((p) => +p.ready).join("")].join("|");
    if (sig === this.sig) return;
    if (g.phase === "end" && !String(this.sig || "").startsWith("end") && g.players.some((p) => !p.bot)) saveNavalGame(g);
    this.sig = sig;
    this.clearTimers();
    this.deadline = null;
    const setDeadline = (ms, fn) => {
      this.deadline = Date.now() + ms;
      this.deadlineTotal = ms;
      this.arm("deadline", ms, fn);
    };
    if (g.phase === "placing") {
      setDeadline(PLACE_MS, () => autoPlace(g));
    } else if (g.phase === "battle" && g.step === "aim") {
      const p = g.players[g.turn];
      // Le bot « réfléchit » le temps que la caméra arrive sur la grille visée.
      if (p.bot) this.arm("bot", botDelay(1700, 3000), () => {
        const [x, y] = botTarget(g, p);
        fire(g, p.id, x, y);
      });
      else if (g.settings.turnMs > 0) setDeadline(g.settings.turnMs, () => timeoutFire(g));
    } else if (g.phase === "battle" && g.step === "flying") {
      this.arm("fly", FLY_MS, () => resolveShot(g));
    } else if (g.phase === "battle" && g.step === "impact") {
      this.arm("impact", impactMs(g.shot), () => afterImpact(g));
    }
  }
}

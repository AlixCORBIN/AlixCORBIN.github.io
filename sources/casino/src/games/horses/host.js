import {
  ENTRY,
  FINISH,
  addBot,
  addPlayer,
  backToLobby,
  createHorsesGame,
  endMove,
  move,
  removeBot,
  removePlayer,
  roll,
  setSettings,
  settleRoll,
  startGame,
  target,
  timeoutTurn,
  viewFor,
} from "./engine.js";
import { secureRandomInt } from "../../lib/random.js";
import { fail } from "../../lib/result.js";
import { HostController } from "../../net/controller.js";

// Rythme volontairement posé : on doit voir chaque lancer et chaque saut.
export const ROLL_MS = 1500; // le dé roule
export const HOP_MS = 360; // un saut de case
const AFTER_MOVE_MS = 900; // pause après l'arrivée
const PASS_MS = 1600; // « aucun cheval ne peut bouger »
const CAPTURE_MS = 1300; // le cheval renvoyé repart à l'écurie

const botDelay = (min, max) => min + secureRandomInt(max - min);

/** IA : finir > manger > sortir > rentrer à l'échelle > avancer le plus avancé hors danger. */
function botChoice(g, p) {
  const d = g.die.v;
  let best = g.choices[0];
  let bestScore = -1e9;
  for (const h of g.choices) {
    const t = target(g, p, h, d);
    const from = p.horses[h];
    let s = t.to;
    if (t.to === FINISH) s += 1000;
    if (t.capture) s += 600;
    if (from < 0) s += 400;
    if (t.to === ENTRY || t.to > ENTRY) s += 300;
    s += secureRandomInt(20);
    if (s > bestScore) {
      bestScore = s;
      best = h;
    }
  }
  return best;
}

export class HorsesHost extends HostController {
  makeGame() {
    return createHorsesGame();
  }
  addPlayer(id, name) {
    return addPlayer(this.g, id, name);
  }
  removePlayer(id) {
    return removePlayer(this.g, id);
  }
  viewOf() {
    return viewFor(this.g);
  }
  ensureKeys() {}
  decorate(view) {
    view.deadline = this.deadline ? { ms: Math.max(0, this.deadline - Date.now()), total: this.deadlineTotal } : null;
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
        return isHost ? startGame(g) : fail("réservé à l'hôte");
      case "roll":
        return roll(g, id);
      case "move":
        return move(g, id, a.horse);
      case "restart":
        return isHost ? backToLobby(g) : fail("réservé à l'hôte");
      default:
        return fail("action inconnue");
    }
  }
  schedule() {
    const g = this.g;
    const sig = [g.phase, g.turn, g.stage, g.die?.seq, g.anim?.seq].join("|");
    if (sig === this.sig) return;
    this.sig = sig;
    this.clearTimers();
    this.deadline = null;
    if (g.phase !== "playing") return;
    const p = g.players[g.turn];
    const human = (ms, fn) => {
      if (!g.settings.turnMs) return;
      this.deadline = Date.now() + g.settings.turnMs;
      this.deadlineTotal = g.settings.turnMs;
      this.arm("deadline", g.settings.turnMs, fn);
    };
    switch (g.stage) {
      case "roll":
        if (p.bot) this.arm("bot", botDelay(1100, 1700), () => roll(g, p.id));
        else human(0, () => timeoutTurn(g));
        break;
      case "rolling":
        this.arm("settle", ROLL_MS, () => {
          settleRoll(g);
          // Un seul cheval jouable : on le joue directement (après un court temps de lecture).
          if (g.stage === "choose" && g.choices.length === 1 && !p.bot) this.autoOne = true;
        });
        break;
      case "choose":
        if (p.bot || this.autoOne) {
          const one = this.autoOne;
          this.autoOne = false;
          this.arm("bot", one ? 650 : botDelay(700, 1200), () => move(g, p.id, p.bot ? botChoice(g, p) : g.choices[0]));
        } else human(0, () => timeoutTurn(g));
        break;
      case "moving": {
        const ms = g.anim.path.length * HOP_MS + AFTER_MOVE_MS + (g.anim.capture ? CAPTURE_MS : 0);
        this.arm("move", ms, () => endMove(g));
        break;
      }
      case "pass":
        this.arm("pass", PASS_MS, () => endMove(g));
        break;
    }
  }
}

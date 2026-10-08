import {
  addPlayer,
  clearBets,
  createRouletteGame,
  doubleBets,
  maybeSpin,
  nextRound,
  placeBet,
  publicView,
  pushNumbers,
  rebet,
  removePlayer,
  resolveSpin,
  setReady,
  takeCredit,
  undoBet,
} from "./engine.js";
import { recordSpin } from "./api.js";
import { ROULETTE_RULES } from "./rules.js";
import { fetchRandomIntegers } from "../../lib/random.js";
import { HostController } from "../../net/controller.js";

const RNG_BATCH = 50;

const RNG_LOW_WATER = 10;

export class RouletteHost extends HostController {
  makeGame() {
    return createRouletteGame();
  }
  addPlayer(id, name, bankroll) {
    return addPlayer(this.g, id, name, bankroll);
  }
  removePlayer(id) {
    return removePlayer(this.g, id);
  }
  viewOf() {
    return publicView(this.g);
  }
  decorate(view) {
    view.deadline = this.deadline
      ? {
          ms: Math.max(0, this.deadline - Date.now()),
          total: ROULETTE_RULES.autoMs,
        }
      : null;
    view.auto = !!this.online;
  }
  ensureKeys() {
    const g = this.g;
    if (
      !(
        this.fetching ||
        g.buffer.length >= RNG_LOW_WATER ||
        Date.now() < (this.retryAt || 0)
      )
    ) {
      this.fetching = true;
      this.rngWait = fetchRandomIntegers(RNG_BATCH, {
        min: 0,
        max: 36,
      })
        .then(({ values, meta }) => {
          pushNumbers(g, values, meta);
          g.rng.error = null;
        })
        .catch((err) => {
          this.retryAt = Date.now() + 30000;
          g.rng.error =
            "random.org injoignable (" +
            (err.message || err.name) +
            ") : CSPRNG local utilise";
        })
        .finally(() => {
          this.fetching = false;
          this.rngWait = null;
          this.publish();
        });
    }
  }
  dispatch(id, action) {
    if (
      action.t === "ready" &&
      action.v !== false &&
      this.rngWait &&
      !this.g.buffer.length
    ) {
      this.rngWait.then(() => this.dispatch(id, action));
      return;
    }
    super.dispatch(id, action);
  }
  handle(id, action) {
    const g = this.g;
    switch (action.t) {
      case "bet":
        return placeBet(g, id, action.key, action.amount);
      case "credit":
        return takeCredit(g, id);
      case "undo":
        return undoBet(g, id);
      case "clear":
        return clearBets(g, id);
      case "rebet":
        return rebet(g, id);
      case "double":
        return doubleBets(g, id);
      case "ready":
        return this.online
          ? {
              ok: false,
            }
          : setReady(g, id, action.v !== false);
      case "next":
        return g.phase === "settle" && Date.now() - (this.settledAt || 0) > 1500
          ? nextRound(g)
          : {
              ok: false,
            };
      default:
        return {
          ok: false,
        };
    }
  }
  schedule() {
    const g = this.g;
    const sig = g.phase + "|" + g.round;
    if (sig !== this.sig) {
      this.sig = sig;
      this.clearTimers();
      this.deadline = null;
      if (g.phase === "spinning") {
        this.arm("spin", ROULETTE_RULES.spinMs, () => {
          resolveSpin(g);
          this.settledAt = Date.now();
          recordSpin(g.result);
        });
      } else if (g.phase === "settle") {
        this.arm("next", 9000, () => nextRound(g));
      }
    }
    if (g.phase === "betting" && this.online && !this.timers.bet) {
      this.deadline = Date.now() + ROULETTE_RULES.autoMs;
      this.arm("bet", ROULETTE_RULES.autoMs, () => {
        delete this.timers.bet;
        if (g.players.some((p) => p.bets.length)) {
          g.players.forEach((p) => {
            p.ready = true;
          });
          maybeSpin(g);
          this.deadline = null;
        } else {
          this.schedule();
        }
        this.publish();
      });
    }
  }
}

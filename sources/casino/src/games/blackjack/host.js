import {
  RULES,
  addPlayer,
  applyShoeKeys,
  closeInsurance,
  createBlackjackGame,
  dealerStep,
  decideInsurance,
  doubleDown,
  forceReady,
  hit,
  nextRound,
  publicView,
  rebet,
  removePlayer,
  setBets,
  setReady,
  split,
  stand,
  takeCredit,
} from "./engine.js";
import { fetchShuffleKeys } from "../../lib/random.js";
import { AFK_MS, HostController } from "../../net/controller.js";

const GRACE_MS = 5000;

export class BlackjackHost extends HostController {
  makeGame() {
    return createBlackjackGame();
  }
  addPlayer(id, name, bankroll) {
    return addPlayer(this.g, id, name, bankroll);
  }
  removePlayer(id) {
    return removePlayer(this.g, id);
  }
  viewOf() {
    const view = publicView(this.g);
    view.game = "blackjack";
    return view;
  }
  decorate(view) {
    view.afk = this.afk
      ? {
          id: this.afk.id,
          ids: this.afk.ids,
          kind: this.afk.kind,
          ms: Math.max(0, this.afk.at - Date.now()),
          total: this.afk.total || AFK_MS,
        }
      : null;
  }
  ensureKeys() {
    const g = this.g;
    if (
      !(
        this.fetching ||
        g.nextKeys ||
        Date.now() < (this.retryAt || 0) ||
        (g.round === 0 && g.rng.source === "random.org")
      )
    ) {
      this.fetching = true;
      this.rngWait = fetchShuffleKeys(RULES.decks * 52)
        .then(({ keys, meta }) => {
          applyShoeKeys(g, keys, meta);
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
    if (action.t === "ready" && action.v !== false && this.rngWait) {
      this.rngWait.then(() => this.dispatch(id, action));
      return;
    }
    super.dispatch(id, action);
  }
  handle(id, action) {
    const g = this.g;
    switch (action.t) {
      case "bet":
        return setBets(g, id, action);
      case "rebet":
        return rebet(g, id);
      case "ready":
        return setReady(g, id, action.v !== false);
      case "credit":
        return takeCredit(g, id);
      case "insurance":
        return decideInsurance(g, id, !!action.take);
      case "hit":
        return hit(g, id);
      case "stand":
        return stand(g, id);
      case "double":
        return doubleDown(g, id);
      case "split":
        return split(g, id);
      case "next":
        return g.phase === "settle" && Date.now() - (this.settledAt || 0) > 1200
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
    const multi = this.online && g.players.length > 1;
    const sig = [
      g.phase,
      g.round,
      g.turn && `${g.turn.p}.${g.turn.h}`,
      g.turn && g.players[g.turn.p]?.hands[g.turn.h]?.cards.length,
      g.dealer.cards.length,
      g.dealer.hidden,
    ].join("|");
    if (sig !== this.sig) {
      this.sig = sig;
      this.clearTimers();
      this.afk = null;
      if (g.phase === "dealer") {
        const step = () => {
          const { more } = dealerStep(g);
          if (!more) {
            this.settledAt = Date.now();
          }
        };
        this.arm("dealer", g.dealer.hidden ? 900 : 1000, step);
      } else if (g.phase === "settle") {
        this.settledAt = Date.now();
        this.arm("next", 9000, () => nextRound(g));
      } else if (g.phase === "insurance")
        this.arm("ins", 15000, () => closeInsurance(g));
      else if (g.phase === "playing" && multi && g.turn) {
        const id = g.players[g.turn.p].id;
        this.afk = {
          id,
          at: Date.now() + AFK_MS,
        };
        this.arm("turn", AFK_MS, () => {
          stand(g, id);
          this.kick(id);
        });
      }
    }
    if (
      g.phase === "betting" &&
      multi &&
      g.players.some((p) => p.ready) &&
      !this.timers.bet
    ) {
      const now = Date.now();
      const waiting = g.players.filter((p) => !p.ready);
      if (waiting.length) {
        this.betAfk = {
          id: waiting[0].id,
          at: now + AFK_MS,
        };
      }
      this.arm("bet", AFK_MS, () => {
        const idle = g.players
          .filter(
            (p) =>
              !p.ready && p.id !== this.me && (this.lastAct[p.id] || 0) < now,
          )
          .map((p) => p.id);
        forceReady(g);
        idle.forEach((id) => this.kick(id));
      });
    }
    if (g.phase === "betting") {
      const notReady = g.players.filter((p) => !p.ready);
      const betting = g.players.filter((p) => p.bet > 0);
      if (
        multi &&
        betting.length > 0 &&
        betting.every((p) => p.ready) &&
        notReady.length > 0
      ) {
        if (!this.timers.grace) {
          this.graceAt = Date.now() + GRACE_MS;
          this.arm("grace", GRACE_MS, () => {
            delete this.timers.grace;
            this.graceAt = 0;
            forceReady(g);
          });
        }
        this.afk = {
          id: notReady[0].id,
          ids: notReady.map((p) => p.id),
          kind: "grace",
          at: this.graceAt,
          total: GRACE_MS,
        };
      } else {
        if (this.timers.grace) {
          clearTimeout(this.timers.grace);
          delete this.timers.grace;
        }
        this.afk =
          (g.players.some((p) => p.ready) && this.timers.bet && this.betAfk) ||
          null;
      }
    }
  }
}

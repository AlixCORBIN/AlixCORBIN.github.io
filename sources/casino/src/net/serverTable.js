// Contrôleur d'une table d'argent tenue par le serveur (blackjack, roulette).
// Même interface que HostController / ClientController (subscribe, state, me, act, destroy)
// pour que les écrans de jeu n'aient rien à changer. Toute décision est prise par
// l'Edge Function casino-table ; ici on n'envoie que des intentions et on affiche la vue.
import { callFunction, db } from "../lib/identity.js";
import { refreshWallet } from "../lib/wallet.js";
import { sanitizeMii, setRoomMiis } from "../lib/mii.js";
import * as BJ from "../games/blackjack/engine.js";
import * as RO from "../games/roulette/engine.js";

// Actions qui ne révèlent aucune information cachée : appliquées tout de suite à l'écran avec le même
// moteur que le serveur, puis envoyées ensemble au serveur, qui reste seul juge (sa réponse fait foi).
const LOCAL = {
  blackjack: { bet: (g, id, a) => BJ.setBets(g, id, a), rebet: (g, id) => BJ.rebet(g, id) },
  roulette: {
    bet: (g, id, a) => RO.placeBet(g, id, a.key, a.amount),
    undo: (g, id) => RO.undoBet(g, id),
    clear: (g, id) => RO.clearBets(g, id),
    rebet: (g, id) => RO.rebet(g, id),
    double: (g, id) => RO.doubleBets(g, id),
  },
};
const FLUSH_MS = 350;
const FAST_BJ = new Set(["hit", "stand", "double", "split", "insurance"]);

const HEARTBEAT_MS = 5000;

export class ServerTable {
  constructor(game, { code = null, isPublic = false, mii = null, spectate = false } = {}) {
    this.spectator = !!spectate && !!code;
    this.listeners = new Set();
    this.subscribe = (fn) => {
      this.listeners.add(fn);
      return () => this.listeners.delete(fn);
    };
    this.getSnapshot = () => this.version;
    this.version = 0;
    this.role = code ? "client" : "host";
    this.online = true;
    this.server = true;
    this.game = game;
    this.code = code;
    this.isPublic = !!isPublic;
    this.mii = mii ? sanitizeMii(mii) : null;
    this.state = null;
    this.me = null;
    this.status = "connecting";
    this.error = null;
    this.miis = {};
    this.rowVersion = 0;
    this.queue = []; // actions locales pas encore confirmées par le serveur
    this.undo = []; // pile d'annulation des mises (roulette), gardée côté navigateur
    this.chain = Promise.resolve();
    this.open();
  }
  emit() {
    this.version++;
    this.listeners.forEach((fn) => fn());
  }
  fail(msg) {
    if (this.status === "closed") return;
    this.status = "error";
    this.error = msg;
    this.emit();
  }
  async open() {
    // Observateur : on lit seulement la vue publique de la table (lisible par tous pour une salle publique)
    if (this.spectator) {
      this.me = "__spectator__";
      this.status = "ready";
      this.listen();
      this.emit();
      return;
    }
    try {
      const res = this.code
        ? await callFunction("casino-table", { op: "join", code: this.code, mii: this.mii })
        : await callFunction("casino-table", { op: "create", game: this.game, isPublic: this.isPublic, mii: this.mii });
      if (res.error && !res.view) return this.fail(res.error);
      if (res.ok === false) return this.fail(res.error || "Impossible de rejoindre la table");
      this.code = res.code;
      this.me = res.me;
      this.status = "ready";
      this.apply(res);
      this.listen();
      this.hb = setInterval(() => this.ping(), HEARTBEAT_MS);
    } catch (e) {
      this.fail(e.message);
    }
  }
  listen() {
    const sb = db();
    this.ch = sb
      .channel("table-" + this.code)
      .on("postgres_changes", { event: "*", schema: "public", table: "casino_room_views", filter: `code=eq.${this.code}` }, ({ new: row }) => {
        if (row && row.version > this.rowVersion) this.apply({ version: row.version, view: row.view, miis: row.miis });
      })
      .subscribe();
    sb.from("casino_room_views").select("version, view, miis").eq("code", this.code).maybeSingle().then(({ data }) => {
      if (data) this.apply({ version: data.version, view: data.view, miis: data.miis });
    });
  }
  apply(res) {
    if (res.version && res.version < this.rowVersion) return;
    if (res.version) this.rowVersion = res.version;
    if (!res.view) return;
    const prevPhase = this.state?.phase;
    if (res.view.phase !== "betting" || res.view.round !== this.state?.round) this.undo = [];
    this.state = this.queue.length ? this.replayLocal(res.view) : res.view;
    this.isPublic = res.view.isPublic ?? this.isPublic;
    if (res.miis) {
      const map = {};
      for (const [id, m] of Object.entries(res.miis).slice(0, 16)) map[id] = sanitizeMii(m);
      this.miis = map;
      setRoomMiis(map);
    }
    if (res.kicked || (this.me && res.view.kicked?.includes(this.me))) {
      this.kicked = true;
      this.fail("Retire de la table pour inactivite (1 minute sans action).");
      return;
    }
    if (prevPhase !== res.view.phase && res.view.phase === "settle") refreshWallet().catch(() => {});
    this.armTimer();
    this.emit();
  }
  // Le serveur n'a pas d'horloge : à l'échéance suivante (croupier, tirage…), on le relance.
  armTimer() {
    clearTimeout(this.timer);
    const v = this.state;
    if (!v?.due || this.spectator) return;
    const wait = Math.max(150, v.due - v.at + 60);
    this.timer = setTimeout(() => this.ping(), wait);
  }
  async call(body) {
    if (this.status !== "ready") return null;
    try {
      const res = await callFunction("casino-table", { ...body, code: this.code });
      if (res.error && res.ok === undefined && !res.view) {
        if (res.error === "Salle introuvable") this.fail("La table a ete fermee");
        this.lastError = res.error;
        this.emit();
        return res;
      }
      if (res.ok === false && res.error) {
        this.lastError = res.error;
      }
      this.apply(res);
      return res;
    } catch (e) {
      if (e.status === 403) this.fail(e.message);
      this.lastError = e.message;
      this.emit();
      return null;
    }
  }
  ping() {
    if (this.queue.length) return this.flush();
    return this.call({ op: "ping" });
  }
  replayLocal(view) {
    const g = structuredClone(view);
    for (const a of this.queue) this.applyLocal(g, a);
    return g;
  }
  applyLocal(g, a) {
    const fn = LOCAL[this.game]?.[a.t];
    const me = g.players?.find((p) => p.id === this.me);
    if (!fn || !me) return { ok: false };
    me.undo = this.undo;
    const res = fn(g, this.me, a) || { ok: false };
    this.undo = me.undo || [];
    delete me.undo;
    return res;
  }
  act(action) {
    if (this.status !== "ready" || !action || this.spectator) return;
    const game = this.state?.game || this.game;
    this.game = game;
    if (LOCAL[game]?.[action.t] && this.state) {
      // affichage immédiat, envoi groupé un peu plus tard
      const g = structuredClone(this.state);
      const res = this.applyLocal(g, action);
      if (!res.ok) {
        this.lastError = res.error || "Action refusee";
        this.emit();
        return;
      }
      this.state = g;
      this.queue.push(action);
      this.emit();
      clearTimeout(this.flushTimer);
      this.flushTimer = setTimeout(() => this.flush(), FLUSH_MS);
      return;
    }
    // action qui révèle une information (cartes, tirage) : on envoie tout de suite, mises en attente comprises.
    // Tirer / doubler : la carte part tout de suite face cachée vers la main, et se retourne à la réponse du serveur.
    if (game === "blackjack" && (action.t === "hit" || action.t === "double")) this.placeholderCard();
    // Blackjack, actions en cours de main : appel direct à la base (bj_act, ~70 ms), sinon la fonction
    if (game === "blackjack" && FAST_BJ.has(action.t) && !this.queue.length) return this.fastBlackjack(action);
    return this.flush([action]);
  }
  fastBlackjack(action) {
    this.chain = this.chain.then(async () => {
      if (this.status !== "ready") return;
      try {
        const { data, error } = await db().rpc("bj_act", { p_code: this.code, p_action: action });
        if (!error && data && !data.fallback) {
          if (data.ok === false) this.lastError = data.error || "Action refusee";
          this.apply(data);
          if (data.ok === false) this.emit();
          return;
        }
      } catch {}
      // cas rare (minuterie échue, remélange…) : la fonction prend le relais
      await this.call({ op: "act", actions: [action] });
    });
    return this.chain;
  }
  placeholderCard() {
    const g = this.state;
    const turn = g?.phase === "playing" && g.turn;
    const p = turn && g.players[turn.p];
    if (!p || p.id !== this.me || !p.hands[turn.h]) return;
    const next = structuredClone(g);
    next.players[turn.p].hands[turn.h].cards.push({ hidden: true, pending: true });
    this.state = next;
    this.emit();
  }
  flush(extra = []) {
    clearTimeout(this.flushTimer);
    const actions = [...this.queue.splice(0), ...extra];
    if (!actions.length) return this.chain;
    // un seul envoi à la fois, dans l'ordre
    this.chain = this.chain.then(() => this.call({ op: "act", actions }));
    return this.chain;
  }
  setPublic(v) {
    this.isPublic = !!v;
    this.emit();
    this.call({ op: "public", isPublic: this.isPublic });
  }
  destroy() {
    clearInterval(this.hb);
    clearTimeout(this.flushTimer);
    clearTimeout(this.timer);
    if (this.status === "ready" && !this.spectator) callFunction("casino-table", { op: "leave", code: this.code }).then(() => refreshWallet()).catch(() => {});
    this.status = "closed";
    try {
      this.ch && db().removeChannel(this.ch);
    } catch {}
    setRoomMiis({});
  }
}

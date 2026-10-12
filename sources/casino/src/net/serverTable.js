// Contrôleur d'une table d'argent tenue par le serveur (blackjack, roulette).
// Même interface que HostController / ClientController (subscribe, state, me, act, destroy)
// pour que les écrans de jeu n'aient rien à changer. Toute décision est prise par
// l'Edge Function casino-table ; ici on n'envoie que des intentions et on affiche la vue.
import { callFunction, db } from "../lib/identity.js";
import { refreshWallet } from "../lib/wallet.js";
import { sanitizeMii, setRoomMiis } from "../lib/mii.js";

const HEARTBEAT_MS = 5000;

export class ServerTable {
  constructor(game, { code = null, isPublic = false, mii = null } = {}) {
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
    this.state = res.view;
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
    if (!v?.due) return;
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
    return this.call({ op: "ping" });
  }
  act(action) {
    return this.call({ op: "act", action });
  }
  setPublic(v) {
    this.isPublic = !!v;
    this.emit();
    this.call({ op: "public", isPublic: this.isPublic });
  }
  destroy() {
    clearInterval(this.hb);
    clearTimeout(this.timer);
    if (this.status === "ready") callFunction("casino-table", { op: "leave", code: this.code }).then(() => refreshWallet()).catch(() => {});
    this.status = "closed";
    try {
      this.ch && db().removeChannel(this.ch);
    } catch {}
    setRoomMiis({});
  }
}

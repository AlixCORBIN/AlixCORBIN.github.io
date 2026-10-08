import { RoomChannel, makeRoomCode } from "./channel.js";

export const AFK_MS = 60000;

const HEARTBEAT_MS = 5000;

const PEER_TIMEOUT_MS = 20000;

class Store {
  constructor() {
    this.subscribe = (listener) => {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    };
    this.getSnapshot = () => this.version;
    this.listeners = new Set();
    this.state = null;
    this.status = "init";
    this.error = null;
    this.code = null;
    this.me = null;
    this.online = false;
    this.version = 0;
  }
  emit() {
    this.version++;
    this.listeners.forEach((fn) => fn());
  }
}

export class HostController extends Store {
  constructor(name, { online = false, bankroll = 1000 } = {}) {
    super();
    this.role = "host";
    this.online = online;
    this.name = name;
    this.bankroll = bankroll;
    this.g = this.makeGame();
    this.seen = new Map();
    this.timers = {};
    this.lastAct = {};
    this.afk = null;
    this.sig = "";
    this.status = "connecting";
    if (online) {
      this.openPeer();
    } else {
      this.me = "solo";
      this.addPlayer(this.me, name, bankroll);
      this.status = "ready";
      this.publish();
    }
  }
  openPeer(attempt = 0) {
    this.code = makeRoomCode();
    const link = new RoomChannel(
      this.code,
      (msg, from) => this.onMsg(msg, from),
      true,
    );
    this.link = link;
    link.ready
      .then(() => {
        let taken = false;
        this.onTaken = () => {
          taken = true;
        };
        link.send("host", {
          t: "probe",
        });
        setTimeout(() => {
          if (this.status !== "closed") {
            if (taken && attempt < 5) {
              link.close();
              return this.openPeer(attempt + 1);
            }
            this.me = "host-" + link.id;
            this.addPlayer(this.me, this.name, this.bankroll);
            this.status = "ready";
            this.hb = setInterval(() => this.heartbeat(), HEARTBEAT_MS);
            this.publish();
          }
        }, 1200);
      })
      .catch(() => {
        this.status = "error";
        this.error =
          "Impossible de creer la salle (serveur de jeu injoignable)";
        this.emit();
      });
  }
  heartbeat() {
    this.link.send("*", {
      t: "hb",
    });
    const now = Date.now();
    for (const [id, lastSeen] of this.seen) {
      if (now - lastSeen > PEER_TIMEOUT_MS) {
        this.drop(id);
      }
    }
  }
  onMsg(msg, from) {
    if (!msg || typeof msg != "object" || this.status !== "ready") {
      if (msg?.t === "taken") {
        this.onTaken?.();
      }
      return;
    }
    if (msg.t === "probe") {
      this.link.send("*", {
        t: "taken",
      });
      return;
    }
    if (msg.t === "taken") return;
    const peer = from;
    if (msg.t === "hello") {
      if (this.seen.has(peer)) {
        this.link.send(peer, {
          t: "welcome",
          id: peer,
        });
        this.publish();
        return;
      }
      const bankroll = Number.isFinite(msg.bankroll)
        ? Math.max(0, Math.min(msg.bankroll, 1000000000000))
        : 1000;
      if (!this.addPlayer(peer, msg.name, bankroll).ok) {
        this.link.send(peer, {
          t: "full",
        });
        return;
      }
      this.seen.set(peer, Date.now());
      this.lastAct[peer] = Date.now();
      this.link.send(peer, {
        t: "welcome",
        id: peer,
      });
      this.publish();
    } else {
      if (this.seen.has(peer)) {
        this.seen.set(peer, Date.now());
        if (msg.t === "act") {
          this.dispatch(peer, msg.a);
        } else if (msg.t === "bye") {
          this.drop(peer);
        } else if (msg.t === "ping") {
          this.link.send(peer, {
            t: "hb",
          });
        }
      }
    }
  }
  drop(id) {
    if (this.seen.has(id)) {
      this.seen.delete(id);
      delete this.lastAct[id];
      this.removePlayer(id);
      this.publish();
    }
  }
  kick(id, reason = "afk") {
    if (id !== this.me) {
      this.removePlayer(id);
      this.seen.delete(id);
      delete this.lastAct[id];
      this.link?.send(id, {
        t: "kicked",
        reason,
      });
    }
  }
  act(action) {
    this.dispatch(this.me, action);
  }
  dispatch(id, action) {
    this.lastAct[id] = Date.now();
    const res = this.handle(id, action) || {
      ok: false,
    };
    if (res.ok) {
      this.publish();
    } else if (id !== this.me) {
      this.link?.send(id, {
        t: "err",
        m: res.error || "action refusee",
      });
    }
  }
  publish() {
    this.ensureKeys();
    this.schedule();
    this.state = this.viewOf();
    this.decorate(this.state);
    this.emit();
    if (this.online && this.link && this.status === "ready") {
      this.link.send("*", {
        t: "state",
        s: this.state,
      });
    }
  }
  decorate() {}
  arm(name, ms, fn) {
    clearTimeout(this.timers[name]);
    this.timers[name] = setTimeout(() => {
      fn();
      this.publish();
    }, ms);
  }
  clearTimers() {
    Object.values(this.timers).forEach(clearTimeout);
    this.timers = {};
  }
  destroy() {
    this.clearTimers();
    clearInterval(this.hb);
    this.link?.send("*", {
      t: "closed",
    });
    this.link?.close();
    this.status = "closed";
  }
}

export class ClientController extends Store {
  constructor(name, code, bankroll = 1000) {
    super();
    this.role = "client";
    this.online = true;
    this.code = code.toUpperCase().trim();
    this.status = "connecting";
    this.name = name;
    this.bankroll = bankroll;
    this.attempt();
  }
  attempt() {
    const { name, bankroll } = this;
    const link = new RoomChannel(this.code, (msg) => this.onMsg(msg));
    this.link = link;
    this.lastHost = Date.now();
    const fail = (reason) => {
      if (!(this.status === "ready" || this.status === "closed")) {
        this.status = "error";
        this.error = reason;
        this.emit();
      }
    };
    this.failTimer = setTimeout(
      () =>
        fail(
          "Salle introuvable : verifie le code, et que l hote a bien cree la salle et garde sa page ouverte.",
        ),
      15000,
    );
    link.ready
      .then(() => {
        const hello = () => {
          if (!this.me && this.status === "connecting") {
            link.send("host", {
              t: "hello",
              name,
              bankroll,
            });
          }
        };
        hello();
        this.helloTimer = setInterval(hello, 1500);
        this.pingTimer = setInterval(() => {
          if (
            this.status === "ready" &&
            Date.now() - this.lastHost > PEER_TIMEOUT_MS
          ) {
            this.status = "error";
            this.error = "Connexion a l hote perdue";
            this.emit();
            return;
          }
          if (this.me) {
            link.send("host", {
              t: "ping",
            });
          }
        }, HEARTBEAT_MS);
      })
      .catch(() => fail("Serveur de jeu injoignable (reseau bloque ?)"));
    this.fail = fail;
  }
  onMsg(msg) {
    if (!(!msg || typeof msg != "object")) {
      this.lastHost = Date.now();
      if (msg.t === "welcome") {
        this.me = msg.id;
        clearTimeout(this.failTimer);
        clearInterval(this.helloTimer);
      } else if (msg.t === "state" && this.me) {
        this.state = msg.s;
        this.status = "ready";
        this.emit();
      } else if (msg.t === "full") {
        this.fail("Table pleine");
      } else if (msg.t === "kicked") {
        this.kicked = true;
        this.status = "error";
        this.error = "Deconnecte pour inactivite (1 minute sans action).";
        this.emit();
      } else if (msg.t === "closed") {
        if (this.status !== "closed") {
          this.status = "error";
          this.error = "L hote a ferme la salle";
          this.emit();
        }
      } else if (msg.t === "err") {
        this.lastError = msg.m;
        this.emit();
      }
    }
  }
  act(action) {
    if (this.me) {
      this.link?.send("host", {
        t: "act",
        a: action,
      });
    }
  }
  destroy() {
    clearTimeout(this.failTimer);
    clearInterval(this.helloTimer);
    clearInterval(this.pingTimer);
    this.status = "closed";
    if (this.me) {
      this.link?.send("host", {
        t: "bye",
      });
    }
    this.link?.close();
  }
}

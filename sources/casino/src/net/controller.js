import { RoomChannel, makeRoomCode, clientKey } from "./channel.js";
import { announceRoom, withdrawRoom } from "./rooms.js";
import { miiForId, sanitizeMii, sanitizeOwnMii, setRoomMiis } from "../lib/mii.js";
import { myBadge, setRoomAdmins, verifyBadge } from "../lib/admins.js";
import { myUid } from "../lib/identity.js";
import { buildReport, setActiveHost } from "../lib/report.js";

export const AFK_MS = 60000;

const HEARTBEAT_MS = 5000;

const PEER_TIMEOUT_MS = 20000;
// Un joueur silencieux n'est retiré de la partie qu'après ce délai : s'il revient avant
// (coupure réseau, page rechargée, téléphone en veille), il retrouve sa place.
const GRACE_MS = 60000;
// Côté client : durée pendant laquelle on retente de rejoindre l'hôte avant d'abandonner
const RECONNECT_MS = 60000;

// Sauvegarde locale de la salle de l'hôte (pour la rouvrir après un rechargement)
const HOST_SAVE = "casino-host-room";
export function loadHostRoom() {
  try {
    const x = JSON.parse(localStorage.getItem(HOST_SAVE));
    return x && Date.now() - x.at < 6 * 3600e3 ? x : null;
  } catch {
    return null;
  }
}
export function clearHostRoom() {
  try { localStorage.removeItem(HOST_SAVE); } catch {}
}
const LAST_ROOM = "casino-last-room";
export function loadLastRoom() {
  try {
    const x = JSON.parse(localStorage.getItem(LAST_ROOM));
    return x && Date.now() - x.at < 3 * 3600e3 ? x : null;
  } catch {
    return null;
  }
}
export function clearLastRoom() {
  try { localStorage.removeItem(LAST_ROOM); } catch {}
}

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
    this.miis = {};
  }
  emit() {
    this.version++;
    this.listeners.forEach((fn) => fn());
  }
}

export class HostController extends Store {
  constructor(name, { online = false, bankroll = 1000, isPublic = false, game = "", mii = null, restore = null } = {}) {
    super();
    this.restoreData = restore && restore.game === game ? restore : null;
    // clé stable du navigateur -> identifiant de joueur (pour rendre sa place à qui revient)
    this.keyToId = { ...(this.restoreData?.keys || {}) };
    this.away = new Map();
    this.myMii = mii ? sanitizeOwnMii(mii) : null;
    this.peerMiis = {};
    this.peerRaw = {};
    // joueurs admin prouvés par un badge serveur lié à "SALLE:id"
    this.adminIds = new Set();
    this.badgeOf = {};
    this.miiSig = "";
    this.role = "host";
    this.online = online;
    this.isPublic = isPublic;
    this.gameId = game;
    this.name = name;
    this.bankroll = bankroll;
    this.g = this.makeGame();
    this.seen = new Map();
    // observateurs (mode spectateur) : reçoivent la vue publique, ne jouent pas
    this.watchers = new Map();
    // identité serveur de chaque joueur humain (pour la confirmation des résultats)
    this.uids = {};
    this.report = null;
    setActiveHost(this);
    myUid().then((u) => {
      this.myUid = u;
    });
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
    this.code = attempt === 0 && this.restoreData ? this.restoreData.code : makeRoomCode();
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
            const r = this.restoreData;
            let restored = false;
            if (r && !taken && r.code === this.code) {
              // réouverture de la salle après un rechargement : même code, même partie
              try {
                this.g = r.g;
                this.me = r.me;
                for (const p of this.g.players || []) if (!p.bot && p.id !== this.me) this.away.set(p.id, Date.now());
                restored = true;
              } catch {
                this.g = this.makeGame();
              }
            }
            if (!restored) {
              this.keyToId = {};
              this.me = "host-" + link.id;
              this.addPlayer(this.me, this.name, this.bankroll);
            }
            myBadge(`${this.code}:${this.me}`).then((t) => {
              if (!t || this.status === "closed") return;
              this.badgeOf[this.me] = t;
              this.adminIds.add(this.me);
              this.miiSig = "";
              this.updateMiis();
              this.announce();
            }, () => {});
            this.status = "ready";
            this.hb = setInterval(() => this.heartbeat(), HEARTBEAT_MS);
            this.publish();
          }
        }, 1200);
      })
      .catch(() => {
        // serveur injoignable : on bascule en partie locale (solo) plutôt que d'échouer
        link.close();
        this.online = false;
        this.link = null;
        this.me = "solo";
        this.addPlayer(this.me, this.name, this.bankroll);
        this.status = "ready";
        this.offlineFallback = true;
        this.publish();
      });
  }
  heartbeat() {
    this.link.send("*", {
      t: "hb",
    });
    const now = Date.now();
    for (const [id, lastSeen] of this.watchers) {
      if (now - lastSeen > PEER_TIMEOUT_MS) this.watchers.delete(id);
    }
    for (const [id, lastSeen] of this.seen) {
      if (now - lastSeen > PEER_TIMEOUT_MS) {
        // silence : on garde sa place un moment, il peut revenir
        this.seen.delete(id);
        this.away.set(id, lastSeen);
      }
    }
    for (const [id, since] of this.away) {
      if (now - since > GRACE_MS) {
        this.away.delete(id);
        this.seen.set(id, 0);
        this.drop(id);
      }
    }
    this.saveRoom();
    this.sendWatchers();
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
    if (msg.t === "hello" && msg.spectate) {
      this.watchers.set(peer, Date.now());
      this.link.send(peer, { t: "welcome", id: peer, spectator: true });
      this.link.send(peer, this.miisMsg());
      this.sendWatchers();
      return;
    }
    if (this.watchers.has(peer)) {
      if (msg.t === "bye") this.watchers.delete(peer);
      else {
        this.watchers.set(peer, Date.now());
        if (msg.t === "ping") this.link.send(peer, { t: "hb" });
      }
      return;
    }
    if (msg.t === "badge") {
      const token = msg.token;
      verifyBadge(token, `${this.code}:${peer}`).then((u) => {
        if (!u || this.status === "closed") return;
        this.badgeOf[peer] = token;
        this.adminIds.add(peer);
        if (this.peerRaw[peer]) this.peerMiis[peer] = sanitizeMii(this.peerRaw[peer], { admin: true });
        this.miiSig = "";
        this.updateMiis();
      });
      return;
    }
    if (msg.t === "hello") {
      // retour d'un joueur connu (même navigateur) : il reprend son identifiant et sa place
      const key = typeof msg.key === "string" ? msg.key.slice(0, 64) : null;
      const known = key && this.keyToId[key];
      if (known && (this.g?.players || []).some((p) => p.id === known)) {
        this.away.delete(known);
        this.seen.set(known, Date.now());
        this.lastAct[known] = Date.now();
        if (peer !== known) this.link.send(peer, { t: "welcome", id: known });
        this.link.send(known, { t: "welcome", id: known });
        this.publish();
        this.link.send(known, this.miisMsg());
        return;
      }
      if (key) this.keyToId[key] = peer;
      this.away.delete(peer);
      if (msg.mii && typeof msg.mii === "object") {
        this.peerRaw[peer] = msg.mii;
        this.peerMiis[peer] = sanitizeMii(msg.mii, { admin: this.adminIds.has(peer) });
      }
      if (typeof msg.uid === "string" && /^[0-9a-f-]{36}$/.test(msg.uid)) this.uids[peer] = msg.uid;
      if (this.seen.has(peer)) {
        this.link.send(peer, {
          t: "welcome",
          id: peer,
        });
        this.publish();
        this.link.send(peer, this.miisMsg());
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
      this.link.send(peer, this.miisMsg());
    } else {
      if (!this.seen.has(peer) && this.away.has(peer) && msg.t !== "bye") {
        // il était marqué absent mais il parle de nouveau : il est de retour
        this.away.delete(peer);
        this.seen.set(peer, Date.now());
      }
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
    if (this.seen.has(id) || this.away.has(id)) {
      this.away.delete(id);
      this.seen.delete(id);
      delete this.lastAct[id];
      delete this.peerMiis[id];
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
  // vrai multijoueur = au moins un autre humain connecté (sinon c'est du solo dans une salle)
  isMulti() {
    return this.online && this.seen.size > 0;
  }
  setPublic(v) {
    this.isPublic = !!v;
    this.announce();
    this.emit();
  }
  announce() {
    if (!this.online || this.status !== "ready" || !this.code) return;
    if (!this.isPublic) return withdrawRoom();
    const players = (this.g?.players || []).filter((p) => !p.bot);
    announceRoom({
      public: true,
      game: this.gameId,
      code: this.code,
      host: this.name,
      hostId: this.me,
      badge: this.badgeOf[this.me] || undefined,
      players: players.length,
      bots: (this.g?.players || []).length - players.length,
      status: this.g?.phase === "lobby" ? "lobby" : "playing",
    });
  }
  // Sauvegarde locale (au plus toutes les 2 s) pour pouvoir rouvrir la salle après un rechargement
  saveRoom(force = false) {
    if (!this.online || this.status !== "ready" || !this.code) return;
    const now = Date.now();
    if (!force && now - (this.savedAt || 0) < 2000) return;
    this.savedAt = now;
    try {
      localStorage.setItem(HOST_SAVE, JSON.stringify({ at: now, game: this.gameId, code: this.code, me: this.me, name: this.name, isPublic: this.isPublic, keys: this.keyToId, g: this.g }));
    } catch {}
  }
  // joueurs momentanément absents (affichage éventuel par les jeux)
  awayIds() {
    return [...this.away.keys()];
  }
  publish() {
    this.announce();
    this.saveRoom();
    this.ensureKeys();
    this.schedule();
    this.state = this.viewOf();
    this.decorate(this.state);
    if (this.report) this.state.report = this.report;
    this.updateMiis();
    this.emit();
    if (this.online && this.link && this.status === "ready") {
      this.link.send("*", {
        t: "state",
        s: this.state,
      });
    }
  }
  decorate() {}
  // Vue envoyée aux observateurs : la vue publique par défaut (jeux sans info cachée).
  // Les jeux à vue par joueur la redéfinissent pour ne rien révéler de caché.
  spectatorView() {
    return this.state;
  }
  sendWatchers() {
    if (!this.online || !this.link || this.status !== "ready" || !this.watchers.size) return;
    const s = this.spectatorView();
    if (!s) return;
    for (const id of this.watchers.keys()) this.link.send(id, { t: "state", s });
  }
  // Résultat de fin de partie : diffusé à tous, chaque humain le confirme au serveur
  // (appelé pendant schedule() : on publie au tour suivant, sinon schedule → save → setReport → publish → schedule… boucle)
  setReport(game, args) {
    this.report = buildReport(game, args, (id) => (id === this.me ? this.myUid : this.uids[id]));
    clearTimeout(this.reportTimer);
    this.reportTimer = setTimeout(() => this.status !== "closed" && this.publish(), 0);
  }
  // Mii de chaque joueur : le sien, celui envoyé par le client, ou un Mii stable (bots)
  updateMiis() {
    const map = {};
    for (const p of this.g?.players || []) {
      if (p.id === this.me && this.myMii) map[p.id] = this.myMii;
      else map[p.id] = this.peerMiis[p.id] || this.miis[p.id] || miiForId(p.id, p.name);
    }
    const sig = Object.entries(map).map(([id, m]) => id + ":" + m.id + ":" + m.updatedAt).join("|");
    if (sig === this.miiSig) return;
    this.miiSig = sig;
    this.miis = map;
    setRoomMiis(map);
    setRoomAdmins([...this.adminIds].filter((id) => map[id]));
    if (this.online && this.link && this.status === "ready") this.link.send("*", this.miisMsg());
  }
  // Mii de la salle + badges admin (chaque client les fait vérifier au serveur)
  miisMsg() {
    const b = {};
    for (const id of this.adminIds) if (this.miis[id] && this.badgeOf[id]) b[id] = this.badgeOf[id];
    return { t: "miis", m: this.miis, b };
  }
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
    clearHostRoom();
    setActiveHost(null);
    withdrawRoom();
    this.clearTimers();
    clearInterval(this.hb);
    this.link?.send("*", {
      t: "closed",
    });
    this.link?.close();
    this.status = "closed";
    setRoomMiis({});
    setRoomAdmins([]);
  }
}

export class ClientController extends Store {
  constructor(name, code, bankroll = 1000, mii = null, { spectate = false } = {}) {
    super();
    this.spectator = !!spectate;
    this.mii = mii ? sanitizeOwnMii(mii) : null;
    this.miiSeq = 0;
    this.role = "client";
    this.online = true;
    this.code = code.toUpperCase().trim();
    this.status = "connecting";
    this.name = name;
    this.bankroll = bankroll;
    this.attempt();
  }
  async attempt() {
    const uid = await myUid();
    this.uid = uid;
    this.key = clientKey();
    this.joinedAt = 0;
    this.failTimer = setTimeout(() => {
      if (!this.me) this.fail("Salle introuvable : vérifie le code, et que l'hôte a bien créé la salle et garde sa page ouverte.");
    }, 20000);
    this.connect();
    this.fail = (reason) => {
      if (!(this.status === "ready" || this.status === "closed" || this.status === "reconnecting")) {
        this.status = "error";
        this.error = reason;
        this.emit();
      }
    };
  }
  // (re)connexion au canal de la salle ; un joueur déjà accepté garde son identifiant
  connect() {
    clearInterval(this.helloTimer);
    clearInterval(this.pingTimer);
    this.link?.close();
    const link = new RoomChannel(this.code, (msg) => this.onMsg(msg), false, {
      id: this.me || null,
      onStatus: (st) => {
        if (st === "down" && this.status === "ready") {
          this.status = "reconnecting";
          this.lostAt = this.lostAt || Date.now();
          this.emit();
        }
        if (st === "up") this.sayHello();
      },
    });
    this.link = link;
    this.lastHost = Date.now();
    this.welcomed = false;
    link.ready
      .then(() => {
        this.sayHello();
        this.helloTimer = setInterval(() => !this.welcomed && this.sayHello(), 1500);
        this.pingTimer = setInterval(() => this.tick(), HEARTBEAT_MS);
      })
      .catch(() => {
        if (this.me) return setTimeout(() => this.status !== "closed" && this.connect(), 3000);
        this.fail("Serveur de jeu injoignable (réseau bloqué ?)");
      });
  }
  sayHello() {
    if (!this.link || this.status === "closed") return;
    this.link.send("host", {
      t: "hello",
      key: this.key,
      name: this.name,
      bankroll: this.bankroll,
      uid: this.uid,
      mii: this.mii,
      spectate: this.spectator || undefined,
    });
  }
  tick() {
    if (this.status === "closed") return;
    const silent = Date.now() - this.lastHost;
    if (this.me && silent > PEER_TIMEOUT_MS) {
      // plus de nouvelles de l'hôte : on se reconnecte (même identifiant, même place)
      if (this.status !== "reconnecting") {
        this.status = "reconnecting";
        this.lostAt = Date.now();
        this.emit();
      }
      if (Date.now() - this.lostAt > RECONNECT_MS) {
        this.status = "error";
        this.error = "Connexion à l'hôte perdue (l'hôte a peut-être fermé la salle).";
        this.emit();
        return;
      }
      // on ne recrée pas le canal (deux canaux du même nom se gênent) : il se rouvre seul s'il tombe ;
      // on se représente simplement à l'hôte jusqu'à ce qu'il réponde
      if (!this.link.joined && Date.now() - (this.reopenAt || 0) > 15000) {
        this.reopenAt = Date.now();
        this.link.open();
      }
      this.sayHello();
      return;
    }
    if (this.me) this.link.send("host", { t: "ping" });
  }
  onMsg(msg) {
    if (!(!msg || typeof msg != "object")) {
      this.lastHost = Date.now();
      if (msg.t === "welcome") {
        this.me = msg.id;
        this.welcomed = true;
        if (this.link && this.link.id !== msg.id) this.link.id = msg.id;
        if (this.status === "reconnecting") {
          this.status = this.state ? "ready" : "connecting";
          this.lostAt = 0;
          this.emit();
        }
        try { localStorage.setItem("casino-last-room", JSON.stringify({ at: Date.now(), code: this.code, spectate: this.spectator })); } catch {}
        if (!this.spectator) myBadge(`${this.code}:${msg.id}`).then((t) => t && this.link?.send("host", { t: "badge", token: t }), () => {});
        clearTimeout(this.failTimer);
        clearInterval(this.helloTimer);
      } else if (msg.t === "state" && this.me) {
        this.state = msg.s;
        this.status = "ready";
        this.lostAt = 0;
        this.emit();
      } else if (msg.t === "miis" && msg.m && typeof msg.m === "object") {
        // chapeau admin et pseudo rouge seulement si le serveur valide le badge de ce joueur dans cette salle
        const seq = ++this.miiSeq;
        const raw = Object.entries(msg.m).slice(0, 32);
        const build = (ids) => {
          const map = {};
          for (const [id, m] of raw) map[id] = sanitizeMii(m, { admin: ids.has(id) });
          this.miis = map;
          setRoomMiis(map);
          setRoomAdmins([...ids]);
          this.emit();
        };
        build(new Set());
        const b = msg.b && typeof msg.b === "object" ? Object.entries(msg.b).slice(0, 32) : [];
        if (b.length) {
          Promise.all(b.map(([id, t]) => verifyBadge(t, `${this.code}:${id}`).then((u) => (u ? id : null)))).then((r) => {
            const ids = new Set(r.filter(Boolean));
            if (seq === this.miiSeq && ids.size) build(ids);
          });
        }
      } else if (msg.t === "full") {
        if (this.spectator) return;
        this.fail("Table pleine");
      } else if (msg.t === "kicked") {
        this.kicked = true;
        this.status = "error";
        this.error = "Deconnecte pour inactivite (1 minute sans action).";
        this.emit();
      } else if (msg.t === "closed") {
        clearLastRoom();
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
    if (this.me && !this.spectator) {
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
    clearLastRoom();
    setRoomMiis({});
    setRoomAdmins([]);
    if (this.me) {
      this.link?.send("host", {
        t: "bye",
      });
    }
    this.link?.close();
  }
}

import { supabase } from "../lib/supabase.js";

// Canal de salle (relais Supabase Realtime, broadcast).
// Robustesse :
//  - file d'envoi limitée en débit (le client Realtime jette les messages au-delà de sa limite),
//    avec fusion des messages remplaçables (un nouvel état remplace l'ancien encore en attente)
//    et nouvel essai si le serveur répond « rate limited » / « timed out » ;
//  - reprise automatique si le canal tombe (CLOSED / CHANNEL_ERROR / TIMED_OUT) ;
//  - identifiant de pair réglable : un client qui revient reprend son ancien identifiant de joueur.

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const makeRoomCode = () =>
  Array.from({ length: 5 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");

const makePeerId = () =>
  Array.from({ length: 10 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");

// Clé stable de ce navigateur : permet à l'hôte de rendre sa place à un joueur qui revient
export function clientKey() {
  try {
    let k = localStorage.getItem("casino-client-key");
    if (!k) {
      k = makePeerId() + makePeerId();
      localStorage.setItem("casino-client-key", k);
    }
    return k;
  } catch {
    return "tmp-" + makePeerId();
  }
}

const RATE = 12; // messages / seconde max envoyés par ce canal
const PUMP_MS = 60;

export class RoomChannel {
  constructor(code, onMessage, isHost = false, { id = null, onStatus = null } = {}) {
    this.id = id || makePeerId();
    this.code = code;
    this.onMessage = onMessage;
    this.isHost = isHost;
    this.onStatus = onStatus;
    this.queue = [];
    this.tokens = RATE;
    this.closed = false;
    this.joined = false;
    this.ready = new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
    this.ready.catch(() => {});
    this.open();
    this.pump = setInterval(() => this.flush(), PUMP_MS);
  }
  open() {
    if (this.closed || this.opening) return;
    if (this.ch) {
      // on attend la fermeture de l'ancien canal avant d'en rouvrir un du même nom
      const old = this.ch;
      this.ch = null;
      this.joined = false;
      this.opening = true;
      Promise.resolve()
        .then(() => supabase.removeChannel(old))
        .catch(() => {})
        .finally(() => {
          this.opening = false;
          this.open();
        });
      return;
    }
    const ch = supabase.channel("casino-" + this.code, {
      config: { broadcast: { self: false, ack: false } },
    });
    this.ch = ch;
    ch.on("broadcast", { event: "m" }, ({ payload }) => {
      if (
        payload &&
        (payload.to === "*" || payload.to === this.id || (this.isHost && payload.to === "host"))
      ) {
        this.onMessage(payload.m, payload.from);
      }
    });
    let first = !this.joined;
    ch.subscribe((status) => {
      if (this.closed || ch !== this.ch) return;
      if (status === "SUBSCRIBED") {
        this.joined = true;
        this.retry = 0;
        this.onStatus?.("up");
        if (first) {
          first = false;
          this._resolve();
        }
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        if (!this.joined && first && (this.retry || 0) >= 3) {
          first = false;
          this._reject(new Error(status));
          return;
        }
        // le canal est tombé : on le rouvre (délai croissant, plafonné)
        this.joined = false;
        this.onStatus?.("down");
        this.retry = (this.retry || 0) + 1;
        clearTimeout(this.reopenT);
        this.reopenT = setTimeout(() => this.open(), Math.min(8000, 500 * 2 ** Math.min(this.retry, 4)));
      }
    });
  }
  // key : messages « remplaçables » (le plus récent suffit), ex. l'état de la partie
  send(to, msg, key = null) {
    if (this.closed) return;
    if (!key && msg && (msg.t === "state" || msg.t === "miis" || msg.t === "hb")) key = msg.t + ":" + to;
    if (key) {
      const i = this.queue.findIndex((q) => q.key === key);
      if (i >= 0) {
        this.queue[i].msg = msg;
        return;
      }
    }
    this.queue.push({ to, msg, key });
    if (this.queue.length > 400) this.queue.splice(0, this.queue.length - 400);
  }
  flush() {
    this.tokens = Math.min(RATE, this.tokens + (RATE * PUMP_MS) / 1000);
    if (!this.joined || this.sending || !this.ch) return;
    while (this.queue.length && this.tokens >= 1) {
      const item = this.queue.shift();
      this.tokens -= 1;
      this.sending = true;
      Promise.resolve(
        this.ch.send({ type: "broadcast", event: "m", payload: { to: item.to, from: this.id, m: item.msg } }),
      )
        .then((r) => {
          if (r && r !== "ok") {
            // refusé (limite de débit, délai) : on le remet en tête, on ralentit un peu
            if (!item.key || !this.queue.some((q) => q.key === item.key)) this.queue.unshift(item);
            this.tokens = Math.min(this.tokens, -2);
          }
        })
        .catch(() => this.queue.unshift(item))
        .finally(() => { this.sending = false; });
      return; // un envoi à la fois : l'ordre des messages est préservé
    }
  }
  close() {
    this.closed = true;
    clearInterval(this.pump);
    clearTimeout(this.reopenT);
    // dernier message éventuel (bye / closed) envoyé directement
    const last = this.queue.filter((q) => q.msg && (q.msg.t === "bye" || q.msg.t === "closed"));
    for (const q of last) {
      if (!this.ch) break;
      try { this.ch.send({ type: "broadcast", event: "m", payload: { to: q.to, from: this.id, m: q.msg } }); } catch {}
    }
    const ch = this.ch;
    if (ch) setTimeout(() => { try { supabase.removeChannel(ch); } catch {} }, 300);
  }
}

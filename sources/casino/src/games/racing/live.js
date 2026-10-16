// Joueurs en direct : les positions passent en P2P (WebRTC, canal de données non fiable),
// Supabase Realtime ne sert qu'à la mise en relation (quelques messages par joueur et par map).
// Si la connexion directe échoue (réseau qui bloque le P2P), repli sur un relais lent par Supabase.
import { supabase } from "../../lib/supabase.js";

const MAX_PEERS = 7; // 8 joueurs par salle
const SEND_MS = 100; // 10 positions par seconde en P2P
const RELAY_MS = 400; // repli Supabase : 2,5 par seconde
const DELAY_MS = 150; // tampon d'interpolation
const STALE_MS = 9000;
const RELAY_AFTER = 4000; // pas de canal direct au bout de 4 s : relais
const ICE = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }];
const PHASES = ["countdown", "race", "done"];

const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const num = (v, lim = 1e5) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) < lim;
const cleanName = (s) => (typeof s === "string" ? s.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 20) : "") || "Pilote";
const cleanColor = (c) => (typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c) ? c : "#9aa4b2");

// État (48 octets) : [1, seq, tempsMs, phase, cps, x, y, z, qx, qy, qz, qw]
function encode(seq, s) {
  const a = new Float32Array(12);
  a[0] = 1; a[1] = seq; a[2] = s.t; a[3] = PHASES.indexOf(s.phase); a[4] = s.cps;
  a[5] = s.x; a[6] = s.y; a[7] = s.z; a[8] = s.q[0]; a[9] = s.q[1]; a[10] = s.q[2]; a[11] = s.q[3];
  return a.buffer;
}
function decode(buf) {
  if (!(buf instanceof ArrayBuffer) || buf.byteLength !== 48) return null;
  const a = new Float32Array(buf);
  if (a[0] !== 1) return null;
  for (let i = 1; i < 12; i++) if (!num(a[i], 1e7)) return null;
  const ql = Math.hypot(a[8], a[9], a[10], a[11]);
  if (ql < 0.5 || ql > 1.5 || !num(a[5]) || !num(a[6]) || !num(a[7])) return null;
  return {
    seq: a[1], t: Math.max(0, a[2]), phase: PHASES[a[3]] || "race", cps: Math.max(0, Math.min(99, a[4] | 0)),
    x: a[5], y: a[6], z: a[7], q: [a[8] / ql, a[9] / ql, a[10] / ql, a[11] / ql],
  };
}

export class LiveRoom {
  constructor(mapId, { pseudo, color }, onChange) {
    this.id = rid();
    this.me = { pseudo: cleanName(pseudo), color: cleanColor(color) };
    this.onChange = onChange;
    this.peers = new Map(); // id -> { pc, dc, pseudo, color, buf: [], last, relay, cps, t, phase, fin }
    this.seq = 0;
    this.lastSend = 0;
    this.lastRelay = 0;
    this.closed = false;
    this.full = false;
    this.ch = supabase.channel("racing-live-" + String(mapId).slice(0, 60), { config: { broadcast: { self: false, ack: false } } });
    this.ch.on("broadcast", { event: "s" }, ({ payload }) => this.onSignal(payload));
    this.ch.subscribe((st) => { if (st === "SUBSCRIBED") this.signal("*", { t: "hello", ...this.me }); });
    this.gc = setInterval(() => this.sweep(), 2000);
    this.onUnload = () => this.close();
    addEventListener("pagehide", this.onUnload);
  }

  signal(to, m) {
    if (this.closed) return;
    try { this.ch.send({ type: "broadcast", event: "s", payload: { to, from: this.id, m } }); } catch {}
  }

  onSignal(p) {
    if (this.closed || !p || typeof p.from !== "string" || p.from.length > 20 || !p.m || typeof p.m !== "object") return;
    if (p.to !== "*" && p.to !== this.id) return;
    const { from, m } = p;
    if (m.t === "bye") return this.drop(from);
    if (m.t === "relay") return this.onRelay(from, m);
    if (m.t === "hello" || m.t === "hi") {
      if (!this.peers.has(from)) {
        if (this.peers.size >= MAX_PEERS) { this.full = true; this.emit(); return; }
        this.addPeer(from, m);
        // le plus petit identifiant ouvre la connexion, l'autre attend l'offre
        if (this.id < from) this.offer(from);
      }
      if (m.t === "hello") this.signal(from, { t: "hi", ...this.me });
      return;
    }
    const peer = this.peers.get(from);
    if (!peer) return;
    if (m.t === "offer" && typeof m.sdp === "string") this.answer(peer, m.sdp);
    else if (m.t === "answer" && typeof m.sdp === "string") peer.pc.setRemoteDescription({ type: "answer", sdp: m.sdp }).catch(() => {});
    else if (m.t === "ice" && m.c && typeof m.c === "object") peer.pc.addIceCandidate(m.c).catch(() => {});
  }

  addPeer(id, info) {
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const peer = { id, pc, dc: null, pseudo: cleanName(info.pseudo), color: cleanColor(info.color), buf: [], last: performance.now(), relay: false, born: performance.now(), cps: 0, t: 0, phase: "countdown", fin: null };
    pc.onicecandidate = (e) => { if (e.candidate) this.signal(id, { t: "ice", c: e.candidate.toJSON() }); };
    pc.ondatachannel = (e) => this.bindDc(peer, e.channel);
    pc.onconnectionstatechange = () => { if (pc.connectionState === "failed") peer.relay = true; };
    this.peers.set(id, peer);
    this.emit();
    return peer;
  }

  bindDc(peer, dc) {
    dc.binaryType = "arraybuffer";
    peer.dc = dc;
    dc.onopen = () => { peer.relay = false; this.emit(); };
    dc.onmessage = (e) => {
      if (typeof e.data === "string") {
        if (e.data.length > 200) return;
        try { this.onEvent(peer, JSON.parse(e.data)); } catch {}
        return;
      }
      const s = decode(e.data);
      if (s) this.push(peer, s);
    };
  }

  async offer(id) {
    const peer = this.peers.get(id);
    if (!peer) return;
    this.bindDc(peer, peer.pc.createDataChannel("pos", { ordered: false, maxRetransmits: 0 }));
    try {
      await peer.pc.setLocalDescription(await peer.pc.createOffer());
      this.signal(id, { t: "offer", sdp: peer.pc.localDescription.sdp });
    } catch { peer.relay = true; }
  }

  async answer(peer, sdp) {
    try {
      await peer.pc.setRemoteDescription({ type: "offer", sdp });
      await peer.pc.setLocalDescription(await peer.pc.createAnswer());
      this.signal(peer.id, { t: "answer", sdp: peer.pc.localDescription.sdp });
    } catch { peer.relay = true; }
  }

  onRelay(from, m) {
    const peer = this.peers.get(from);
    if (!peer || !Array.isArray(m.s) || m.s.length !== 11) return;
    if (peer.dc?.readyState === "open") return; // déjà reçu en direct
    peer.relay = true;
    const a = new Float32Array(12);
    a[0] = 1;
    for (let i = 0; i < 11; i++) a[i + 1] = Number(m.s[i]);
    const s = decode(a.buffer);
    if (s) this.push(peer, s);
  }

  onEvent(peer, e) {
    if (!e || typeof e !== "object") return;
    if (e.t === "fin" && num(e.ms, 3.6e6) && e.ms > 0) {
      peer.fin = Math.round(e.ms);
      this.onFinish?.(peer.pseudo, peer.fin);
      this.emit();
    }
  }

  push(peer, s) {
    const now = performance.now();
    if (s.seq < (peer.buf.at(-1)?.seq ?? -1) && s.seq > 5) return; // paquet en retard
    if (s.phase === "countdown" && peer.phase !== "countdown") peer.fin = null; // il a recommencé
    peer.buf.push({ ...s, at: now });
    if (peer.buf.length > 30) peer.buf.splice(0, peer.buf.length - 30);
    peer.last = now;
    const changed = peer.cps !== s.cps || peer.phase !== s.phase;
    peer.cps = s.cps; peer.t = s.t; peer.phase = s.phase;
    if (changed) this.emit();
  }

  // Envoi de mon état (appelé à chaque image, limité à 10 Hz)
  send(state) {
    if (this.closed) return;
    const now = performance.now();
    if (now - this.lastSend < SEND_MS) return;
    this.lastSend = now;
    const buf = encode(this.seq++, state);
    let relay = false;
    for (const p of this.peers.values()) {
      if (p.dc?.readyState === "open") { try { p.dc.send(buf); } catch {} }
      else if (p.relay || now - p.born > RELAY_AFTER) relay = true;
    }
    if (relay && now - this.lastRelay >= RELAY_MS) {
      this.lastRelay = now;
      const a = new Float32Array(buf);
      this.signal("*", { t: "relay", s: Array.from(a.slice(1), (v) => Math.round(v * 1000) / 1000) });
    }
  }

  finish(ms) {
    const msg = JSON.stringify({ t: "fin", ms });
    for (const p of this.peers.values()) if (p.dc?.readyState === "open") { try { p.dc.send(msg); } catch {} }
  }

  // Pose interpolée d'un joueur (null s'il n'a rien envoyé récemment)
  pose(id) {
    const p = this.peers.get(id);
    if (!p || !p.buf.length) return null;
    const now = performance.now();
    if (now - p.last > 3000) return null;
    const t = now - (p.relay ? RELAY_MS + DELAY_MS : DELAY_MS);
    const b = p.buf;
    let i = b.length - 1;
    while (i > 0 && b[i - 1].at > t) i--;
    const B = b[i], A = b[i - 1] || B;
    // téléportation ou réapparition : pas d'interpolation à travers la map
    if (A === B || B.at <= A.at || Math.hypot(B.x - A.x, B.y - A.y, B.z - A.z) > 40) return { x: B.x, y: B.y, z: B.z, q: B.q };
    const k = Math.max(0, Math.min(1, (t - A.at) / (B.at - A.at)));
    let q2 = B.q;
    if (A.q[0] * q2[0] + A.q[1] * q2[1] + A.q[2] * q2[2] + A.q[3] * q2[3] < 0) q2 = q2.map((v) => -v);
    const q = A.q.map((v, j) => v + (q2[j] - v) * k);
    const l = Math.hypot(...q) || 1;
    return { x: A.x + (B.x - A.x) * k, y: A.y + (B.y - A.y) * k, z: A.z + (B.z - A.z) * k, q: q.map((v) => v / l) };
  }

  list() {
    return [...this.peers.values()].map((p) => ({ id: p.id, pseudo: p.pseudo, color: p.color, cps: p.cps, t: p.t, phase: p.phase, fin: p.fin, relay: p.relay, live: !!p.buf.length }));
  }

  sweep() {
    const now = performance.now();
    for (const p of [...this.peers.values()]) {
      if (now - p.last > STALE_MS && now - p.born > STALE_MS) this.drop(p.id);
    }
    if (this.full && this.peers.size < MAX_PEERS) { this.full = false; this.emit(); }
  }

  drop(id) {
    const p = this.peers.get(id);
    if (!p) return;
    try { p.dc?.close(); } catch {}
    try { p.pc.close(); } catch {}
    this.peers.delete(id);
    this.emit();
  }

  emit() { if (!this.closed) this.onChange?.(this.list(), this.full); }

  close() {
    if (this.closed) return;
    this.signal("*", { t: "bye" });
    this.closed = true;
    clearInterval(this.gc);
    removeEventListener("pagehide", this.onUnload);
    for (const id of [...this.peers.keys()]) { const p = this.peers.get(id); try { p.dc?.close(); p.pc.close(); } catch {} }
    this.peers.clear();
    setTimeout(() => { try { supabase.removeChannel(this.ch); } catch {} }, 200);
  }
}

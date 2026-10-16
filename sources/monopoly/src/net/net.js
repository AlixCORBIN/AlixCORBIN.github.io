// Transport multijoueur : relais Supabase Realtime (broadcast), comme le Casino.
// Remplace PeerJS/WebRTC qui échouait selon les réseaux (NAT, 4G, pare-feu) et
// provoquait des déconnexions/reconnexions en boucle.
// L'API reste la même pour useGame : hostRoom() -> { broadcast, destroy } et
// joinRoom() -> { send, destroy }, avec des « conn » virtuelles côté hôte.
import { supabase } from './supabase.js'

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const newCode = () => Array.from({ length: 5 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('')
const rid = () => Math.random().toString(36).slice(2, 10)

export function getClientId() {
  try {
    let id = localStorage.getItem('mono-client-id')
    if (!id) { id = 'p-' + crypto.randomUUID().slice(0, 8); localStorage.setItem('mono-client-id', id) }
    return id
  } catch { return 'p-' + Math.random().toString(36).slice(2, 10) }
}

const HB_MS = 4000          // battement de cœur
const PEER_TIMEOUT = 25000  // silence toléré avant de considérer un joueur parti
const HOST_TIMEOUT = 20000  // silence toléré côté client avant de dire « connexion perdue »

function openChannel(code, onMsg) {
  const ch = supabase.channel('mono-' + code, { config: { broadcast: { self: false, ack: false } } })
  ch.on('broadcast', { event: 'm' }, ({ payload }) => payload && onMsg(payload))
  const ready = new Promise((res, rej) => ch.subscribe((st) => {
    if (st === 'SUBSCRIBED') res()
    else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') rej(new Error(st))
  }))
  ready.catch(() => {})
  return { ch, ready, send: (p) => ch.send({ type: 'broadcast', event: 'm', payload: p }), close: () => { try { supabase.removeChannel(ch) } catch {} } }
}

// ---------- Hôte ----------
export function hostRoom(code, { onOpen, onConn, onData, onClose, onError }) {
  const me = 'host-' + rid()
  const peers = new Map() // peerId -> { conn, seen }
  let alive = true, taken = false, hb = null
  const link = openChannel(code, (p) => {
    if (!alive) return
    if (p.t === 'probe' && opened) return link.send({ t: 'taken', to: p.from })
    if (p.t === 'taken' && p.to === me) { taken = true; return }
    if (p.to !== 'host' || !opened) return
    let peer = peers.get(p.from)
    if (!peer) {
      const conn = { peer: p.from, open: true, send: (m) => link.send({ t: 'msg', to: p.from, from: me, m }) }
      peer = { conn, seen: Date.now() }
      peers.set(p.from, peer)
      onConn?.(conn)
    }
    peer.seen = Date.now()
    if (p.m?.type === 'bye') return drop(p.from)
    if (p.m && p.m.type !== 'ping') onData?.(peer.conn, p.m)
  })
  let opened = false
  const drop = (id) => {
    const peer = peers.get(id)
    if (!peer) return
    peer.conn.open = false
    peers.delete(id)
    onClose?.(peer.conn)
  }
  link.ready.then(() => {
    // vérifie qu'aucune autre salle n'utilise déjà ce code
    link.send({ t: 'probe', from: me })
    setTimeout(() => {
      if (!alive) return
      if (taken) { onError?.({ type: 'unavailable-id' }); return }
      opened = true
      onOpen?.()
      hb = setInterval(() => {
        link.send({ t: 'hb', from: me })
        const now = Date.now()
        for (const [id, p] of peers) if (now - p.seen > PEER_TIMEOUT) drop(id)
      }, HB_MS)
    }, 1200)
  }).catch(() => onError?.({ type: 'network' }))

  // diffusion de l'état : regroupée (au plus ~7/s) pour ménager le quota Realtime
  let pending = null, timer = null
  const flush = () => { timer = null; if (pending) { link.send({ t: 'all', from: me, m: pending }); pending = null } }
  return {
    broadcast: (msg) => {
      if (!opened) return
      if (msg.type === 'state') { pending = msg; if (!timer) timer = setTimeout(flush, 140); return }
      link.send({ t: 'all', from: me, m: msg })
    },
    destroy: () => { alive = false; clearInterval(hb); clearTimeout(timer); try { link.send({ t: 'closed', from: me }) } catch {} ; setTimeout(link.close, 200) },
  }
}

// ---------- Client ----------
export function joinRoom(code, { onOpen, onData, onClose, onError, onLost }) {
  const me = 'c-' + rid()
  let alive = true, host = null, lastHost = 0, ping = null, hello = null, watchdog = null, lostAt = 0
  const link = openChannel(code, (p) => {
    if (!alive) return
    if (p.t === 'closed') { if (host) { alive = false; onClose?.() } ; return }
    if (p.t === 'hb' || p.t === 'all' || (p.t === 'msg' && p.to === me)) {
      lastHost = Date.now()
      if (!host) { host = p.from; clearInterval(hello); onOpen?.() }
      else if (lostAt) { lostAt = 0; onOpen?.() } // l'hôte répond de nouveau : on se représente (même joueur)
      if (p.m) onData?.(p.m)
    }
  })
  const sendRaw = (m) => link.send({ to: 'host', from: me, m })
  link.ready.then(() => {
    // on se signale jusqu'à la première réponse de l'hôte (onOpen enverra le vrai hello)
    const knock = () => sendRaw({ type: 'ping' })
    knock()
    hello = setInterval(knock, 1500)
    watchdog = setTimeout(() => { if (!host && alive) onError?.({ type: 'peer-unavailable' }) }, 10000)
    ping = setInterval(() => {
      if (!host) return
      if (Date.now() - lastHost > HOST_TIMEOUT) {
        // on garde le canal (en recréer un du même nom le perturbe) et on continue de frapper à la porte
        if (!lostAt) { lostAt = Date.now(); onLost?.() }
        if (Date.now() - lostAt > 60000) { alive = false; clearInterval(ping); onClose?.(); return }
      }
      sendRaw({ type: 'ping' })
    }, HB_MS)
  }).catch(() => onError?.({ type: 'network' }))
  return {
    send: (msg) => sendRaw(msg),
    destroy: () => { alive = false; clearInterval(ping); clearInterval(hello); clearTimeout(watchdog); try { sendRaw({ type: 'bye' }) } catch {} ; setTimeout(link.close, 200) },
  }
}

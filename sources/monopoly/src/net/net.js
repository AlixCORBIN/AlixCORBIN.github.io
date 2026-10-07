import Peer from 'peerjs'

const PREFIX = 'alixcorbin-mono-'
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const newCode = () => Array.from({ length: 5 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('')

export function getClientId() {
  try {
    let id = localStorage.getItem('mono-client-id')
    if (!id) { id = 'p-' + crypto.randomUUID().slice(0, 8); localStorage.setItem('mono-client-id', id) }
    return id
  } catch { return 'p-' + Math.random().toString(36).slice(2, 10) }
}

// Hôte : crée le pair et accepte les connexions
export function hostRoom(code, { onOpen, onConn, onData, onClose, onError }) {
  const peer = new Peer(PREFIX + code)
  const conns = new Set()
  peer.on('open', () => onOpen?.())
  peer.on('error', (e) => onError?.(e))
  peer.on('connection', (c) => {
    c.on('open', () => { conns.add(c); onConn?.(c) })
    c.on('data', (d) => onData?.(c, d))
    c.on('close', () => { conns.delete(c); onClose?.(c) })
    c.on('error', () => { conns.delete(c); onClose?.(c) })
  })
  return {
    broadcast: (msg) => conns.forEach((c) => c.open && c.send(msg)),
    destroy: () => peer.destroy(),
  }
}

// Client : se connecte à l'hôte
export function joinRoom(code, { onOpen, onData, onClose, onError }) {
  const peer = new Peer()
  let conn
  peer.on('error', (e) => onError?.(e))
  peer.on('open', () => {
    conn = peer.connect(PREFIX + code, { reliable: true })
    conn.on('open', () => onOpen?.())
    conn.on('data', (d) => onData?.(d))
    conn.on('close', () => onClose?.())
  })
  return {
    send: (msg) => conn?.open && conn.send(msg),
    destroy: () => peer.destroy(),
  }
}

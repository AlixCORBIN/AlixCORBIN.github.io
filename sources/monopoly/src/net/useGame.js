import { useCallback, useEffect, useRef, useState } from 'react'
import { hostRoom, joinRoom, newCode, getClientId } from './net.js'
import { createLobby, lobbyAdd, lobbyRemove, startGame, applyAction } from '../game/engine.js'
import { botDecide } from '../game/bot.js'
import { BOT_NAMES } from '../game/data.js'

export function useGame() {
  const myId = useRef(getClientId()).current
  const [game, setGame] = useState(null)
  const [role, setRole] = useState(null) // 'host' | 'client'
  const [code, setCode] = useState('')
  const [status, setStatus] = useState('')
  const [toast, setToast] = useState(null)
  const net = useRef(null)
  const gameRef = useRef(null)
  const connPlayer = useRef(new Map())

  const notify = useCallback((msg) => {
    setToast({ msg, k: Date.now() })
  }, [])

  // Hôte : applique une mise à jour et diffuse
  const commit = useCallback((next) => {
    gameRef.current = next
    setGame(next)
    net.current?.broadcast?.({ type: 'state', state: next })
  }, [])

  const hostApply = useCallback((actorId, action) => {
    const s = gameRef.current
    try {
      commit(applyAction(s, actorId, action))
      return null
    } catch (e) {
      return e.message
    }
  }, [commit])

  const create = useCallback((name) => {
    const c = newCode()
    setStatus('Création de la salle…')
    const s = createLobby({ id: myId, name })
    gameRef.current = s
    net.current = hostRoom(c, {
      onOpen: () => { setStatus(''); setRole('host'); setCode(c); commit(gameRef.current) },
      onError: (e) => setStatus('Erreur réseau : ' + (e.type || e.message)),
      onConn: (conn) => conn.send({ type: 'state', state: gameRef.current }),
      onData: (conn, d) => {
        const g = gameRef.current
        if (d.type === 'hello') {
          connPlayer.current.set(conn, d.id)
          const ex = g.players.find((p) => p.id === d.id)
          if (ex) {
            const next = structuredClone(g)
            next.players.find((p) => p.id === d.id).connected = true
            next.rev++
            commit(next)
          } else if (g.phase === 'lobby') {
            try { commit(lobbyAdd(g, { id: d.id, name: d.name })) }
            catch (e) { conn.send({ type: 'error', msg: e.message }) }
          } else conn.send({ type: 'error', msg: 'La partie a déjà commencé (spectateur).' })
          conn.send({ type: 'state', state: gameRef.current })
        } else if (d.type === 'action') {
          const pid = connPlayer.current.get(conn)
          const err = hostApply(pid, d.action)
          if (err) conn.send({ type: 'error', msg: err })
        } else if (d.type === 'chat') {
          const pid = connPlayer.current.get(conn)
          const p = gameRef.current.players.find((x) => x.id === pid)
          if (p) net.current.broadcast({ type: 'chat', from: p.name, msg: String(d.msg).slice(0, 200) })
          if (p) notify(`${p.name} : ${String(d.msg).slice(0, 200)}`)
        }
      },
      onClose: (conn) => {
        const pid = connPlayer.current.get(conn)
        connPlayer.current.delete(conn)
        const g = gameRef.current
        if (!pid || !g) return
        if (g.phase === 'lobby') commit(lobbyRemove(g, pid))
        else {
          const next = structuredClone(g)
          const p = next.players.find((x) => x.id === pid)
          if (p) { p.connected = false; next.rev++; commit(next) }
        }
      },
    })
  }, [myId, commit, hostApply, notify])

  const createOffline = useCallback((name) => {
    net.current = { broadcast: () => {}, destroy: () => {} }
    const s = createLobby({ id: myId, name })
    setRole('host'); setCode('SOLO'); setStatus('')
    commit(s)
  }, [myId, commit])

  const join = useCallback((c, name) => {
    c = c.trim().toUpperCase()
    setStatus('Connexion à la salle ' + c + '…')
    const t = setTimeout(() => setStatus('Salle introuvable ou hôte hors ligne.'), 12000)
    net.current = joinRoom(c, {
      onOpen: () => {
        clearTimeout(t)
        setStatus(''); setRole('client'); setCode(c)
        net.current.send({ type: 'hello', id: myId, name })
      },
      onData: (d) => {
        if (d.type === 'state') { gameRef.current = d.state; setGame(d.state) }
        else if (d.type === 'error') notify(d.msg)
        else if (d.type === 'chat') notify(`${d.from} : ${d.msg}`)
      },
      onClose: () => setStatus('Connexion perdue avec l’hôte.'),
      onError: (e) => { clearTimeout(t); setStatus(e.type === 'peer-unavailable' ? 'Salle introuvable.' : 'Erreur réseau : ' + (e.type || e.message)) },
    })
  }, [myId, notify])

  const act = useCallback((action) => {
    if (role === 'host') {
      const err = hostApply(myId, action)
      if (err) notify(err)
    } else net.current?.send({ type: 'action', action })
  }, [role, hostApply, myId, notify])

  const chat = useCallback((msg) => {
    if (!msg.trim()) return
    const me = gameRef.current?.players.find((p) => p.id === myId)
    if (role === 'host') { net.current.broadcast({ type: 'chat', from: me?.name, msg }); notify(`${me?.name} : ${msg}`) }
    else net.current?.send({ type: 'chat', msg })
  }, [role, myId, notify])

  // Actions de lobby (hôte)
  const lobby = {
    addBot: () => {
      const g = gameRef.current
      const used = new Set(g.players.map((p) => p.name))
      const name = BOT_NAMES.find((n) => !used.has(n)) || 'Bot'
      try { commit(lobbyAdd(g, { id: 'bot-' + Math.random().toString(36).slice(2, 7), name, isBot: true })) } catch (e) { notify(e.message) }
    },
    remove: (id) => commit(lobbyRemove(gameRef.current, id)),
    setRounds: (n) => { const g = structuredClone(gameRef.current); g.settings.maxRounds = n; g.rev++; commit(g) },
    start: () => { try { commit(startGame(gameRef.current)) } catch (e) { notify(e.message) } },
  }

  // Boucle des bots (hôte uniquement) : bots + joueurs déconnectés
  useEffect(() => {
    if (role !== 'host' || !game || game.phase !== 'playing') return
    const actors = game.players.filter((p) => !p.bankrupt && (p.isBot || !p.connected))
    for (const p of actors) {
      const a = botDecide(game, p.id)
      if (a) {
        const delay = a.type === 'ROLL' ? 1100 : a.type === 'END_TURN' ? 1500 : 800
        const t = setTimeout(() => {
          if (gameRef.current.rev !== game.rev) return
          const err = hostApply(p.id, a)
          if (err) console.warn('bot', p.name, a, err)
        }, delay)
        return () => clearTimeout(t)
      }
    }
  }, [game, role, hostApply])

  useEffect(() => () => net.current?.destroy(), [])

  return { myId, game, role, code, status, toast, create, createOffline, join, act, chat, lobby, notify }
}

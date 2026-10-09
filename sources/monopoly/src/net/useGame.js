import { useCallback, useEffect, useRef, useState } from 'react'
import { hostRoom, joinRoom, newCode, getClientId } from './net.js'
import { createLobby, lobbyAdd, lobbyRemove, startGame, applyAction, auctionTimeout } from '../game/engine.js'
import { botDecide, markTried } from '../game/bot.js'
import { aiPickTrade, aiReply } from './ai.js'
import { BOT_NAMES } from '../game/data.js'
import { saveMonopolyGame } from './stats.js'
import { DICE_MS, moveDelay } from '../ui/present.js'

// Session sauvegardée pour pouvoir reprendre une partie après un rechargement / une coupure
const SESSION_KEY = 'mono-session'
export function loadSession() {
  try {
    const x = JSON.parse(localStorage.getItem(SESSION_KEY))
    if (!x || Date.now() - x.t > 24 * 3600e3) return null
    if (x.state && x.state.phase === 'over') return null
    return x
  } catch { return null }
}
function saveSession(x) { try { localStorage.setItem(SESSION_KEY, JSON.stringify({ ...x, t: Date.now() })) } catch {} }
export function clearSession() { try { localStorage.removeItem(SESSION_KEY) } catch {} }

export function useGame() {
  const clientId = useRef(getClientId()).current
  const [myId, setMyId] = useState(clientId)
  const myIdRef = useRef(clientId)
  const setMe = (id) => { myIdRef.current = id; setMyId(id) }
  const session = useRef({})
  const [game, setGame] = useState(null)
  const [role, setRole] = useState(null) // 'host' | 'client'
  const [code, setCode] = useState('')
  const [status, setStatus] = useState('')
  const [toast, setToast] = useState(null)
  const [chats, setChats] = useState([])
  const pushChat = (from, msg) => setChats((c) => [...c.slice(-50), { t: Date.now(), from, msg }])
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
    if (session.current.role) saveSession({ ...session.current, state: next })
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

  const create = useCallback((name, resume, attempt = 0) => {
    const c = resume?.code || newCode()
    setStatus(resume ? 'Réouverture de la salle ' + c + '…' : 'Création de la salle…')
    const s = resume?.state || createLobby({ id: clientId, name })
    if (resume?.state) {
      // tout le monde est considéré déconnecté jusqu'à son retour (les bots jouent pour eux)
      s.players.forEach((p) => { if (!p.isBot && p.id !== clientId) p.connected = false })
    }
    gameRef.current = s
    session.current = { role: 'host', code: c, name }
    net.current = hostRoom(c, {
      onOpen: () => { setStatus(''); setRole('host'); setCode(c); commit(gameRef.current) },
      onError: (e) => {
        // l'ancien identifiant peut rester réservé quelques secondes après un rechargement
        if (e.type === 'unavailable-id' && attempt < 10) {
          setStatus(`Réouverture de la salle ${c}… (${attempt + 1})`)
          net.current?.destroy()
          setTimeout(() => create(name, { code: c, state: gameRef.current }, attempt + 1), 2500)
        } else setStatus('Erreur réseau : ' + (e.type || e.message))
      },
      onConn: (conn) => conn.send({ type: 'state', state: gameRef.current }),
      onData: (conn, d) => {
        const g = gameRef.current
        if (d.type === 'hello') {
          let ex = g.players.find((p) => p.id === d.id)
          // autre appareil / navigateur : on reprend la place d'un joueur déconnecté du même pseudo
          if (!ex && g.phase !== 'lobby') {
            const n = String(d.name || '').trim().toLowerCase()
            ex = g.players.find((p) => !p.isBot && !p.connected && !p.bankrupt && p.name.trim().toLowerCase() === n)
          }
          connPlayer.current.set(conn, ex ? ex.id : d.id)
          if (ex) {
            conn.send({ type: 'welcome', playerId: ex.id })
            const next = structuredClone(g)
            next.players.find((p) => p.id === ex.id).connected = true
            next.rev++
            commit(next)
          } else if (g.phase === 'lobby') {
            try { commit(lobbyAdd(g, { id: d.id, name: d.name })) }
            catch (e) { conn.send({ type: 'error', msg: e.message }) }
          } else conn.send({ type: 'error', msg: 'Partie en cours : utilise le même pseudo que dans la partie pour reprendre ta place (mode spectateur).' })
          conn.send({ type: 'state', state: gameRef.current })
        } else if (d.type === 'action') {
          const pid = connPlayer.current.get(conn)
          const err = hostApply(pid, d.action)
          if (err) conn.send({ type: 'error', msg: err })
        } else if (d.type === 'chat') {
          const pid = connPlayer.current.get(conn)
          const p = gameRef.current.players.find((x) => x.id === pid)
          if (p) net.current.broadcast({ type: 'chat', from: p.name, msg: String(d.msg).slice(0, 200) })
          if (p) { notify(`${p.name} : ${String(d.msg).slice(0, 200)}`); pushChat(p.name, String(d.msg).slice(0, 200)) }
        }
      },
      onClose: (conn) => {
        const pid = connPlayer.current.get(conn)
        connPlayer.current.delete(conn)
        const g = gameRef.current
        if (!pid || !g) return
        // une autre connexion (reconnexion) est déjà active pour ce joueur : on ne le marque pas absent
        if ([...connPlayer.current.values()].includes(pid)) return
        if (g.phase === 'lobby') commit(lobbyRemove(g, pid))
        else {
          const next = structuredClone(g)
          const p = next.players.find((x) => x.id === pid)
          if (p) { p.connected = false; next.rev++; commit(next) }
        }
      },
    })
  }, [clientId, commit, hostApply, notify])

  const createOffline = useCallback((name, resume) => {
    net.current = { broadcast: () => {}, destroy: () => {} }
    const s = resume?.state || createLobby({ id: clientId, name })
    session.current = { role: 'solo', code: 'SOLO', name }
    setRole('host'); setCode('SOLO'); setStatus('')
    commit(s)
  }, [clientId, commit])

  const join = useCallback((c, name) => {
    c = c.trim().toUpperCase()
    let attempts = 0, alive = true, everConnected = false, retryT = null
    const connect = () => {
      if (!alive) return
      net.current?.destroy?.()
      setStatus(everConnected ? `Connexion perdue, reconnexion… (${attempts})` : 'Connexion à la salle ' + c + '…')
      const t = setTimeout(() => fail('Salle introuvable ou hôte hors ligne.'), 12000)
      const fail = (msg) => {
        clearTimeout(t)
        if (!alive) return
        // en partie : on retente pendant ~2 min (l'hôte peut être en train de recharger)
        if (everConnected && attempts < 40) {
          attempts++
          setStatus(`Connexion perdue, reconnexion… (${attempts})`)
          clearTimeout(retryT)
          retryT = setTimeout(connect, 3000)
        } else setStatus(msg)
      }
      const conn = joinRoom(c, {
        onOpen: () => {
          clearTimeout(t)
          everConnected = true
          attempts = 0
          setStatus(''); setRole('client'); setCode(c)
          session.current = { role: 'client', code: c, name }
          saveSession(session.current)
          conn.send({ type: 'hello', id: myIdRef.current, name })
        },
        onData: (d) => {
          if (d.type === 'state') { gameRef.current = d.state; setGame(d.state) }
          else if (d.type === 'welcome') setMe(d.playerId)
          else if (d.type === 'error') notify(d.msg)
          else if (d.type === 'chat') { notify(`${d.from} : ${d.msg}`); pushChat(d.from, d.msg) }
        },
        onClose: () => fail('Connexion perdue avec l’hôte.'),
        onError: (e) => fail(e.type === 'peer-unavailable' ? 'Salle introuvable.' : 'Erreur réseau : ' + (e.type || e.message)),
      })
      net.current = { ...conn, destroy: () => conn.destroy() }
    }
    stopJoin.current?.()
    stopJoin.current = () => { alive = false; clearTimeout(retryT) }
    connect()
  }, [notify])
  const stopJoin = useRef(null)

  const act = useCallback((action) => {
    if (role === 'host') {
      const err = hostApply(myIdRef.current, action)
      if (err) notify(err)
    } else net.current?.send({ type: 'action', action })
  }, [role, hostApply, notify])

  const chat = useCallback((msg) => {
    if (!msg.trim()) return
    const me = gameRef.current?.players.find((p) => p.id === myIdRef.current)
    if (role === 'host') { net.current.broadcast({ type: 'chat', from: me?.name, msg }); notify(`${me?.name} : ${msg}`); pushChat(me?.name, msg) }
    else net.current?.send({ type: 'chat', msg })
  }, [role, notify])

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

  // Temps d'animation (dés + pion) à laisser passer avant qu'un bot rejoue
  const animUntil = useRef(0)
  const prevGame = useRef(null)
  useEffect(() => {
    const p = prevGame.current
    if (p && game && p.phase === 'playing' && game.diceRev !== p.diceRev) animUntil.current = Date.now() + DICE_MS + moveDelay(p, game)
    prevGame.current = game
  }, [game])

  const busyBot = useRef(false)
  const botSay = useCallback((from, msg) => {
    net.current?.broadcast?.({ type: 'chat', from, msg })
    notify(`${from} : ${msg}`)
    pushChat(from, msg)
  }, [notify])

  // Boucle des bots (hôte uniquement) : bots + joueurs déconnectés
  useEffect(() => {
    if (role !== 'host' || !game || game.phase !== 'playing' || busyBot.current) return
    const actors = game.players.filter((p) => !p.bankrupt && (p.isBot || !p.connected))
    for (const p of actors) {
      const a = botDecide(game, p.id)
      if (a) {
        const base = a.type === 'ROLL' ? 900 : a.type === 'END_TURN' ? 1100 : 700
        const delay = Math.max(base, animUntil.current - Date.now() + base)
        const t = setTimeout(async () => {
          if (gameRef.current.rev !== game.rev) return
          const g0 = gameRef.current
          let act = a
          // proposition d'échange : l'IA choisit le meilleur candidat et rédige le message
          if (a.type === 'PROPOSE_TRADE' && a.candidates) {
            busyBot.current = true
            const pick = await aiPickTrade(g0, p.id, a.candidates).catch(() => ({ index: 0 }))
            busyBot.current = false
            if (gameRef.current.rev !== g0.rev) return
            const c = a.candidates[pick.index].t
            a.candidates.forEach((x) => markTried(g0, x.t))
            act = { type: 'PROPOSE_TRADE', to: c.to, give: c.give, get: c.get }
            const err = hostApply(p.id, act)
            if (!err && pick.message) botSay(p.name, pick.message)
            if (err) console.warn('bot', p.name, act, err)
            return
          }
          const err = hostApply(p.id, act)
          if (err) console.warn('bot', p.name, act, err)
          // réplique à un échange proposé par un humain
          if (!err && (a.type === 'ACCEPT_TRADE' || a.type === 'REJECT_TRADE') && g0.trade) {
            const from = g0.players.find((x) => x.id === g0.trade.from)
            if (from && !from.isBot) aiReply(g0, p.id, g0.trade, a.type === 'ACCEPT_TRADE').then((m) => m && botSay(p.name, m))
          }
        }, delay)
        return () => clearTimeout(t)
      }
    }
  }, [game, role, hostApply, botSay])

  // Fin d'enchère au chrono (hôte)
  useEffect(() => {
    if (role !== 'host' || !game?.auction) return
    const t = setTimeout(() => {
      const next = auctionTimeout(gameRef.current)
      if (next !== gameRef.current) commit(next)
    }, Math.max(0, game.auction.deadline - Date.now()) + 50)
    return () => clearTimeout(t)
  }, [game, role, commit])

  // Fin de partie : l'hôte enregistre la partie une seule fois (id unique côté base)
  const savedGame = useRef(null)
  useEffect(() => {
    if (game?.phase === 'over') clearSession()
    if (role !== 'host' || game?.phase !== 'over' || savedGame.current === game.id) return
    savedGame.current = game.id
    saveMonopolyGame(game)
  }, [game, role])

  useEffect(() => () => { stopJoin.current?.(); net.current?.destroy() }, [])

  // Reprise d'une partie sauvegardée
  const resume = useCallback(() => {
    const x = loadSession()
    if (!x) return
    if (x.role === 'host') create(x.name, { code: x.code, state: x.state })
    else if (x.role === 'solo') createOffline(x.name, { state: x.state })
    else join(x.code, x.name)
  }, [create, createOffline, join])

  return { myId, game, role, code, status, toast, chats, create, createOffline, join, act, chat, lobby, notify, resume }
}

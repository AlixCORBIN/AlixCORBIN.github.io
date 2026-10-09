// Présentation différée : on attend la fin des dés puis du pion avant d'afficher le nouvel état
import { useEffect, useRef, useState } from 'react'
import { sfx } from './sfx.js'

export const DICE_MS = 1150
export const STEP_MS = 155

export const CARD_MS = 3300
const segDelay = (from, to) => {
  const fwd = (to - from + 40) % 40
  if (!fwd) return 150
  return fwd > 12 ? 950 : fwd * STEP_MS + 300
}
// Étapes d'un lancer : déplacement(s), carte, prison… jouées une par une
export function rollSteps(prev, next) {
  if (next.steps?.length) return next.steps
  const p = prev.players?.[prev.turn]
  const np = p && next.players.find((x) => x.id === p.id)
  return np ? [{ t: 'move', id: p.id, from: p.pos, to: np.pos }] : []
}
const stepDelay = (st) => (st.t === 'card' ? CARD_MS : st.t === 'jail' ? 1000 : segDelay(st.from, st.to))
export function moveDelay(prev, next) {
  return rollSteps(prev, next).reduce((a, st) => a + stepDelay(st), 0) + 200
}

function playDiff(prev, next, myId) {
  if (!prev || prev.phase !== 'playing') return
  if (next.phase === 'over') return sfx('win')
  const meP = prev.players.find((p) => p.id === myId), meN = next.players.find((p) => p.id === myId)
  const cnt = (s) => Object.keys(s.props || {}).length
  const houses = (s) => Object.values(s.props || {}).reduce((a, p) => a + p.houses, 0)
  const rolled = next.diceRev !== prev.diceRev
  if (!rolled && next.lastCard && next.lastCard.rev !== prev.lastCard?.rev) sfx('card')
  if (!rolled && next.players.some((p) => p.inJail && !prev.players.find((x) => x.id === p.id)?.inJail)) sfx('jail')
  else if (cnt(next) > cnt(prev)) sfx('buy')
  else if (houses(next) > houses(prev)) sfx('build')
  if (meP && meN && meN.money !== meP.money) setTimeout(() => sfx(meN.money > meP.money ? 'gain' : 'pay'), 120)
  if (next.auction && next.auction.bid !== prev.auction?.bid) sfx('bid')
  const tp = next.players[next.turn]
  if (tp?.id === myId && (prev.players[prev.turn]?.id !== myId)) setTimeout(() => sfx('turn'), 200)
}

export function usePresented(game, myId) {
  const [hud, setHud] = useState(game)
  const [scene, setScene] = useState(game)
  const [anim, setAnim] = useState(false)
  const shown = useRef(game)
  const latest = useRef(game)
  const busy = useRef(false)
  const timers = useRef([])

  const commit = (next) => {
    playDiff(shown.current, next, myId)
    shown.current = next
    setHud(next)
    setScene(next)
  }
  const [card, setCard] = useState(game?.lastCard)
  const advance = () => {
    const prev = shown.current, next = latest.current
    if (next === prev) return
    if (prev.phase === 'playing' && next.phase !== 'lobby' && next.diceRev !== prev.diceRev) {
      busy.current = true
      setAnim(true)
      sfx('roll')
      // 1) les dés roulent, rien d'autre ne bouge
      let view = { ...prev, dice: next.dice, diceRev: next.diceRev }
      setScene(view)
      const steps = rollSteps(prev, next)
      const run = (i) => {
        if (i >= steps.length) {
          busy.current = false
          setAnim(false)
          setCard(next.lastCard)
          commit(next)
          advance()
          return
        }
        const st = steps[i]
        if (st.t === 'card') {
          // 3) le pion est arrivé : on tire la carte, puis on applique son effet
          setCard(next.lastCard)
          sfx('card')
        } else {
          // 2) le pion se déplace (lancer, carte, prison)
          view = { ...view, players: view.players.map((p) => (p.id === st.id ? { ...p, pos: st.to, inJail: st.t === 'jail' } : p)) }
          setScene(view)
          if (st.t === 'jail') sfx('jail')
        }
        timers.current.push(setTimeout(() => run(i + 1), stepDelay(st)))
      }
      timers.current.push(setTimeout(() => {
        sfx('land')
        if (next.dice[0] === next.dice[1]) sfx('double')
        run(0)
      }, DICE_MS))
    } else { setCard(next.lastCard); commit(next) }
  }

  useEffect(() => {
    latest.current = game
    if (!busy.current) advance()
  }, [game])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  return { hud, scene, anim, card }
}

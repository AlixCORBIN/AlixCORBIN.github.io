// Présentation différée : on attend la fin des dés puis du pion avant d'afficher le nouvel état
import { useEffect, useRef, useState } from 'react'
import { sfx } from './sfx.js'

export const DICE_MS = 1150
export const STEP_MS = 155

export function moveDelay(prev, next) {
  const p = prev.players?.[prev.turn]
  const np = p && next.players.find((x) => x.id === p.id)
  if (!np) return 0
  const fwd = (np.pos - p.pos + 40) % 40
  if (!fwd) return 150
  return fwd > 12 ? 900 : fwd * STEP_MS + 250
}

function playDiff(prev, next, myId) {
  if (!prev || prev.phase !== 'playing') return
  if (next.phase === 'over') return sfx('win')
  const meP = prev.players.find((p) => p.id === myId), meN = next.players.find((p) => p.id === myId)
  const cnt = (s) => Object.keys(s.props || {}).length
  const houses = (s) => Object.values(s.props || {}).reduce((a, p) => a + p.houses, 0)
  if (next.lastCard && next.lastCard.rev !== prev.lastCard?.rev) sfx('card')
  if (next.players.some((p, i) => p.inJail && !prev.players.find((x) => x.id === p.id)?.inJail)) sfx('jail')
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
  const advance = () => {
    const prev = shown.current, next = latest.current
    if (next === prev) return
    if (prev.phase === 'playing' && next.phase !== 'lobby' && next.diceRev !== prev.diceRev) {
      busy.current = true
      setAnim(true)
      sfx('roll')
      setScene({ ...prev, dice: next.dice, diceRev: next.diceRev })
      timers.current.push(setTimeout(() => {
        sfx('land')
        if (next.dice[0] === next.dice[1]) sfx('double')
        setScene({ ...next, props: prev.props })
        timers.current.push(setTimeout(() => {
          busy.current = false
          setAnim(false)
          commit(next)
          advance()
        }, moveDelay(prev, next)))
      }, DICE_MS))
    } else commit(next)
  }

  useEffect(() => {
    latest.current = game
    if (!busy.current) advance()
  }, [game])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  return { hud, scene, anim }
}

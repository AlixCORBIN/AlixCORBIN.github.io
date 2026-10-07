import { SQUARES, GROUPS, groupMembers } from './data.js'
import { cur, ownsGroup } from './engine.js'

const mine = (s, id) => Object.entries(s.props).filter(([, p]) => p.owner === id).map(([k]) => +k)

// Valeur stratégique d'une propriété pour un joueur
function value(s, id, k, removing = []) {
  const sq = SQUARES[k]
  let v = sq.price
  if (sq.group) {
    const mem = groupMembers(sq.group)
    const owned = mem.filter((i) => i === k || (s.props[i]?.owner === id && !removing.includes(i))).length
    if (owned === mem.length) v *= 3
    else if (owned === mem.length - 1) v *= 1.6
  }
  if (s.props[k]?.mortgaged) v -= sq.price / 2
  return v
}

// Raise money: sell houses, then mortgage the cheapest
function raiseFunds(s, me) {
  const props = mine(s, me.id)
  const built = props.filter((k) => s.props[k].houses > 0)
    .sort((a, b) => s.props[b].houses - s.props[a].houses)
  if (built.length) return { type: 'SELL_HOUSE', square: built[0] }
  const free = props.filter((k) => !s.props[k].mortgaged && !(SQUARES[k].group && groupMembers(SQUARES[k].group).some((i) => s.props[i]?.houses)))
    .sort((a, b) => value(s, me.id, a) - value(s, me.id, b))
  if (free.length) return { type: 'MORTGAGE', square: free[0] }
  return null
}

export function botDecide(s, id) {
  const me = s.players.find((p) => p.id === id)
  if (!me || me.bankrupt || s.phase !== 'playing') return null

  // Répondre à un échange
  if (s.trade?.to === id) {
    const t = s.trade
    const gainV = t.give.money + t.give.props.reduce((a, k) => a + value(s, id, k), 0) + t.give.jailCards * 50
    const lossV = t.get.money + t.get.props.reduce((a, k) => a + value(s, id, k, t.get.props) * 1.2, 0) + t.get.jailCards * 50
    if (me.money - t.get.money + t.give.money < 0) return { type: 'REJECT_TRADE' }
    return gainV > lossV * 1.1 ? { type: 'ACCEPT_TRADE' } : { type: 'REJECT_TRADE' }
  }

  // Dette
  const debt = s.debts.find((d) => d.player === id)
  if (debt) return raiseFunds(s, me) || { type: 'BANKRUPT' }
  if (s.auction) {
    const A = s.auction
    if (A.passed.includes(id) || A.leader === id) return null
    const sq = SQUARES[A.square]
    const max = Math.min(value(s, id, A.square) * 0.95, me.money - 80)
    const step = A.bid < 100 ? 10 : 20
    const next = Math.max(A.bid + step, Math.round(sq.price * 0.3))
    return next <= max ? { type: 'BID', amount: next } : { type: 'PASS_AUCTION' }
  }
  if (s.debts.length) return null
  if (cur(s).id !== id) return null

  const reserve = 150 + s.round * 5
  if (s.pending?.type === 'buy') {
    const sq = SQUARES[s.pending.square]
    const completes = sq.group && groupMembers(sq.group).every((i) => i === s.pending.square || s.props[i]?.owner === id)
    if (me.money >= sq.price && (me.money - sq.price >= reserve * 0.6 || completes)) return { type: 'BUY' }
    return { type: 'DECLINE' }
  }

  if (s.turnPhase === 'roll' || s.turnPhase === 'end') {
    // Lever hypothèques si riche
    const mort = mine(s, id).filter((k) => s.props[k].mortgaged)
    for (const k of mort) {
      const cost = Math.ceil((SQUARES[k].price / 2) * 1.1)
      if (me.money - cost > reserve * 2) return { type: 'UNMORTGAGE', square: k }
    }
    // Construire
    for (const g of Object.keys(GROUPS)) {
      if (!ownsGroup(s, id, g)) continue
      const mem = groupMembers(g)
      if (mem.some((k) => s.props[k].mortgaged)) continue
      const min = Math.min(...mem.map((k) => s.props[k].houses))
      if (min >= 5) continue
      const k = mem.find((i) => s.props[i].houses === min)
      if (me.money - GROUPS[g].house > reserve && (min < 4 ? s.houses > 0 : s.hotels > 0)) return { type: 'BUILD', square: k }
    }
  }

  if (s.turnPhase === 'roll') {
    if (me.inJail) {
      if (me.jailCards.length) return { type: 'USE_JAIL_CARD' }
      if (s.round < 12 && me.money > 400) return { type: 'PAY_JAIL' }
    }
    return { type: 'ROLL' }
  }
  if (s.turnPhase === 'end') return { type: 'END_TURN' }
  return null
}

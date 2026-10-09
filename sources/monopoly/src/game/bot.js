// Bots stratèges : ils raisonnent sur la fréquentation des cases, la rentabilité
// des constructions, la menace des adversaires et l'effet d'un échange pour CHAQUE camp.
import { SQUARES, GROUPS, groupMembers, STATIONS, UTILITIES, CHANCE, CAISSE } from './data.js'
import { cur, ownsGroup } from './engine.js'

// ---------- Probabilités d'arrêt sur chaque case (Monte-Carlo, calculé une fois) ----------
export const LAND = (() => {
  const hits = new Array(40).fill(0)
  let pos = 0, jail = 0, dbl = 0, seed = 12345
  const r6 = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % 6) + 1
  const rc = (n) => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n
  for (let i = 0; i < 300000; i++) {
    const a = r6(), b = r6()
    if (jail) { if (a !== b && jail < 3) { jail++; continue } jail = 0 }
    dbl = a === b ? dbl + 1 : 0
    if (dbl === 3) { pos = 10; jail = 1; dbl = 0; hits[10]++; continue }
    pos = (pos + a + b) % 40
    const sq = SQUARES[pos]
    if (sq.type === 'chance' || sq.type === 'caisse') {
      const deck = sq.type === 'chance' ? CHANCE : CAISSE
      const c = deck[rc(deck.length)]
      if (c.kind === 'move') pos = c.to
      else if (c.kind === 'moveRel') pos = (pos + c.n + 40) % 40
      else if (c.kind === 'jail') { pos = 10; jail = 1 }
      else if (c.kind === 'nearest') { const l = c.what === 'station' ? STATIONS : UTILITIES; pos = l.find((k) => k > pos) ?? l[0] }
    }
    if (pos === 30) { pos = 10; jail = 1 }
    hits[pos]++
  }
  const tot = hits.reduce((x, y) => x + y, 0)
  return hits.map((h) => h / tot)
})()

// ---------- Personnalités ----------
const PERSONAS = {
  prudent: { label: 'prudent', reserve: 1.4, bid: 0.85, trade: 0.6, greed: 1.25 },
  agressif: { label: 'agressif', reserve: 0.7, bid: 1.15, trade: 1, greed: 1.1 },
  negociateur: { label: 'négociateur', reserve: 1, bid: 1, trade: 1.6, greed: 1.05 },
}
export function persona(id) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return Object.values(PERSONAS)[h % 3]
}

// ---------- Évaluation d'une position ----------
const mine = (s, id) => Object.keys(s.props).map(Number).filter((k) => s.props[k].owner === id)
const opponents = (s, id) => s.players.filter((p) => !p.bankrupt && p.id !== id)
const horizon = (s) => {
  const left = s.settings?.maxRounds ? Math.max(1, s.settings.maxRounds - s.round) : 40
  return Math.min(left, 40)
}

// Loyer espéré par tour adverse si l'on possède `owned` (Set) — pour une case donnée
function rentIf(k, owned, houses = 0) {
  const sq = SQUARES[k]
  if (sq.type === 'property') {
    const full = groupMembers(sq.group).every((i) => owned.has(i))
    return houses ? sq.rent[houses] : sq.rent[0] * (full ? 2 : 1)
  }
  if (sq.type === 'station') return 25 * 2 ** (STATIONS.filter((i) => owned.has(i)).length - 1)
  if (sq.type === 'utility') return (UTILITIES.filter((i) => owned.has(i)).length === 2 ? 10 : 4) * 7
  return 0
}

// Valeur (en €) de l'ensemble des biens d'un joueur, avec synergies de groupe et potentiel de construction
function holdingsValue(s, props, opp, H) {
  const owned = new Set(props)
  let v = 0
  for (const k of props) {
    const sq = SQUARES[k], pr = s.props[k]
    const houses = pr?.houses || 0
    v += pr?.mortgaged ? sq.price * 0.5 : sq.price * 0.85
    if (houses) v += houses * GROUPS[sq.group].house * 0.5
    if (!pr?.mortgaged) v += LAND[k] * rentIf(k, owned, houses) * opp * H
  }
  // potentiel des groupes : complet (constructible) ou presque
  for (const g of Object.keys(GROUPS)) {
    const mem = groupMembers(g)
    const n = mem.filter((i) => owned.has(i)).length
    if (!n) continue
    const pot = mem.reduce((a, i) => a + LAND[i] * SQUARES[i].rent[3], 0) * opp * H * 0.35
    if (n === mem.length) v += pot
    else if (n === mem.length - 1) {
      const missing = mem.find((i) => !owned.has(i))
      v += pot * (s.props[missing] ? 0.12 : 0.25)
    }
  }
  return v
}

// Score global d'un joueur (argent + biens) — l'argent liquide a un rendement décroissant
export function score(s, id, props = mine(s, id), money = s.players.find((p) => p.id === id)?.money || 0) {
  const opp = opponents(s, id).length
  const H = horizon(s)
  const m = money <= 0 ? money * 1.5 : money < 400 ? money * 1.15 : 460 + (money - 400) * 0.9
  return m + holdingsValue(s, props, opp, H)
}

// Menace : plus gros loyer que je risque de payer en un tour
function danger(s, id) {
  let mx = 0
  for (const [k, pr] of Object.entries(s.props)) {
    if (pr.owner === id || pr.mortgaged) continue
    const owned = new Set(mine(s, pr.owner))
    mx = Math.max(mx, rentIf(+k, owned, pr.houses))
  }
  return mx
}
const reserveFor = (s, me, P) => Math.max(120, danger(s, me.id) * 0.6) * P.reserve

// Effet d'un échange sur les deux camps
export function tradeDelta(s, t) {
  const A = s.players.find((p) => p.id === t.from), B = s.players.find((p) => p.id === t.to)
  const aProps = mine(s, A.id).filter((k) => !t.give.props.includes(k)).concat(t.get.props)
  const bProps = mine(s, B.id).filter((k) => !t.get.props.includes(k)).concat(t.give.props)
  const intr = (l) => l.filter((k) => s.props[k].mortgaged).reduce((x, k) => x + Math.ceil(SQUARES[k].price * 0.05), 0)
  const aMoney = A.money - t.give.money + t.get.money - intr(t.get.props)
  const bMoney = B.money - t.get.money + t.give.money - intr(t.give.props)
  return {
    from: score(s, A.id, aProps, aMoney) - score(s, A.id) + (t.get.jailCards - t.give.jailCards) * 40,
    to: score(s, B.id, bProps, bMoney) - score(s, B.id) + (t.give.jailCards - t.get.jailCards) * 40,
  }
}

// ---------- Recherche d'échanges intéressants ----------
const memory = new Map() // idPartie -> { tried: Set, lastRound: {botId: round} }
function mem(s) {
  if (!memory.has(s.id)) memory.set(s.id, { tried: new Set(), last: {} })
  return memory.get(s.id)
}
const tradeKey = (t) => `${t.from}>${t.to}:${t.give.props.sort()}|${t.get.props.sort()}`

export function tradeCandidates(s, id, max = 3) {
  const me = s.players.find((p) => p.id === id)
  const P = persona(id)
  const reserve = reserveFor(s, me, P)
  const myProps = mine(s, id)
  const tradable = (k) => !(SQUARES[k].group && groupMembers(SQUARES[k].group).some((i) => s.props[i]?.houses))
  const M = mem(s)
  const out = []
  for (const o of opponents(s, id)) {
    const theirs = mine(s, o.id).filter(tradable)
    // ce qu'ils ont et qui me rapproche d'un groupe
    const wants = theirs.filter((k) => {
      const g = SQUARES[k].group
      return g && groupMembers(g).some((i) => s.props[i]?.owner === id)
    })
    // ce que j'ai et qui les rapproche d'un groupe (monnaie d'échange)
    const offers = myProps.filter(tradable).filter((k) => {
      const g = SQUARES[k].group
      if (!g) return SQUARES[k].type === 'station' && STATIONS.some((i) => s.props[i]?.owner === o.id)
      return groupMembers(g).some((i) => s.props[i]?.owner === o.id)
    })
    for (const w of wants) {
      const g = SQUARES[w].group
      const take = theirs.filter((k) => SQUARES[k].group === g) // tout ce qu'ils ont du groupe
      const gives = [[], ...offers.filter((k) => SQUARES[k].group !== g).map((k) => [k])]
      for (const giveP of gives) {
        for (const cashMul of [0, 0.5, 1, 1.5, 2.2]) {
          const base = take.reduce((a, k) => a + SQUARES[k].price, 0)
          let cash = Math.round((base * cashMul) / 10) * 10
          if (me.money - cash < reserve * 0.5) continue
          const t = { from: id, to: o.id, give: { money: cash, props: giveP, jailCards: 0 }, get: { money: 0, props: take, jailCards: 0 } }
          if (M.tried.has(tradeKey(t) + cash)) continue
          const d = tradeDelta(s, t)
          // il faut que j'y gagne nettement ET que l'autre y trouve son compte (selon mon modèle)
          if (d.from > 40 && d.to > 15) out.push({ t, d, why: { group: g, completes: groupMembers(g).every((i) => take.includes(i) || s.props[i]?.owner === id) } })
        }
      }
    }
  }
  out.sort((a, b) => b.d.from - a.d.from)
  // un seul candidat par adversaire, les meilleurs
  const seen = new Set(), best = []
  for (const c of out) { if (seen.has(c.t.to)) continue; seen.add(c.t.to); best.push(c); if (best.length >= max) break }
  return best
}
export function markTried(s, t) { mem(s).tried.add(tradeKey(t) + t.give.money) }

// ---------- Finances ----------
function raiseFunds(s, me) {
  const props = mine(s, me.id)
  // vendre d'abord les maisons les moins rentables
  const built = props.filter((k) => s.props[k].houses > 0)
  if (built.length) {
    built.sort((a, b) => LAND[a] * SQUARES[a].rent[s.props[a].houses] - LAND[b] * SQUARES[b].rent[s.props[b].houses] || s.props[b].houses - s.props[a].houses)
    for (const k of built) {
      const mem = groupMembers(SQUARES[k].group)
      if (s.props[k].houses >= Math.max(...mem.map((i) => s.props[i].houses))) return { type: 'SELL_HOUSE', square: k }
    }
  }
  // hypothéquer ce qui coûte le moins de score
  const free = props.filter((k) => !s.props[k].mortgaged && !(SQUARES[k].group && groupMembers(SQUARES[k].group).some((i) => s.props[i]?.houses)))
  if (!free.length) return null
  const base = score(s, me.id)
  free.sort((a, b) => {
    const loss = (k) => base - score({ ...s, props: { ...s.props, [k]: { ...s.props[k], mortgaged: true } } }, me.id) - SQUARES[k].price / 2
    return loss(a) - loss(b)
  })
  return { type: 'MORTGAGE', square: free[0] }
}

function bestBuild(s, me, budget) {
  let best = null
  for (const g of Object.keys(GROUPS)) {
    if (!ownsGroup(s, me.id, g)) continue
    const mem = groupMembers(g)
    if (mem.some((k) => s.props[k].mortgaged)) continue
    const min = Math.min(...mem.map((k) => s.props[k].houses))
    if (min >= 5) continue
    const cost = GROUPS[g].house
    if (cost > budget) continue
    if (min < 4 ? s.houses < 1 : s.hotels < 1) continue
    const k = mem.filter((i) => s.props[i].houses === min).sort((a, b) => LAND[b] - LAND[a])[0]
    const gain = LAND[k] * (SQUARES[k].rent[min + 1] - (min ? SQUARES[k].rent[min] : SQUARES[k].rent[0] * 2))
    const roi = (gain / cost) * (min < 3 ? 1.3 : 1) // la 3e maison est le meilleur palier
    if (!best || roi > best.roi) best = { roi, k }
  }
  return best
}

// ---------- Décision ----------
export function botDecide(s, id) {
  const me = s.players.find((p) => p.id === id)
  if (!me || me.bankrupt || s.phase !== 'playing') return null
  const P = persona(id)

  // Répondre à un échange qu'on me propose : je compare MON gain à celui de l'autre
  if (s.trade?.to === id) {
    const t = s.trade
    const from = s.players.find((p) => p.id === t.from)
    const own = (pid, l) => l.every((k) => s.props[k]?.owner === pid)
    if (!from || from.money < t.give.money || me.money < t.get.money || !own(from.id, t.give.props) || !own(id, t.get.props)
      || from.jailCards.length < t.give.jailCards || me.jailCards.length < t.get.jailCards) return { type: 'REJECT_TRADE', reason: 'invalid' }
    if (me.money - t.get.money + t.give.money < 0) return { type: 'REJECT_TRADE', reason: 'money' }
    const d = tradeDelta(s, { ...t })
    const ok = d.to > 25 * P.greed && d.to >= d.from * 0.55 * P.greed
    return { type: ok ? 'ACCEPT_TRADE' : 'REJECT_TRADE', delta: d }
  }

  const debt = s.debts.find((x) => x.player === id)
  if (debt) return raiseFunds(s, me) || { type: 'BANKRUPT' }

  if (s.auction) {
    const A = s.auction
    if (A.passed.includes(id) || A.leader === id) return null
    const withIt = score(s, id, [...mine(s, id), A.square], me.money - SQUARES[A.square].price) + SQUARES[A.square].price
    // valeur pour moi + intérêt à bloquer l'adversaire le plus intéressé
    let block = 0
    for (const o of opponents(s, id)) {
      const gain = score(s, o.id, [...mine(s, o.id), A.square]) - score(s, o.id)
      block = Math.max(block, gain - SQUARES[A.square].price)
    }
    const worth = (withIt - score(s, id)) * P.bid + Math.max(0, block) * 0.4
    const max = Math.min(worth, me.money - reserveFor(s, me, P) * 0.4)
    const step = A.bid < 100 ? 10 : A.bid < 300 ? 20 : 50
    const next = Math.max(A.bid + step, Math.round(SQUARES[A.square].price * 0.25))
    return next <= max ? { type: 'BID', amount: next } : { type: 'PASS_AUCTION' }
  }
  if (s.debts.length) return null
  if (cur(s).id !== id) return null

  const reserve = reserveFor(s, me, P)

  if (s.pending?.type === 'buy') {
    const k = s.pending.square, sq = SQUARES[k]
    if (me.money < sq.price) return { type: 'DECLINE' }
    const gain = score(s, id, [...mine(s, id), k], me.money - sq.price) - score(s, id)
    const blocks = opponents(s, id).some((o) => sq.group && groupMembers(sq.group).filter((i) => i !== k).every((i) => s.props[i]?.owner === o.id))
    if (gain > 0 || blocks || me.money - sq.price >= reserve) return { type: 'BUY' }
    return { type: 'DECLINE' }
  }

  if (s.turnPhase === 'roll' || s.turnPhase === 'end') {
    // lever une hypothèque utile quand on est à l'aise
    const mort = mine(s, id).filter((k) => s.props[k].mortgaged)
      .sort((a, b) => (SQUARES[b].group && ownsGroup(s, id, SQUARES[b].group) ? 1 : 0) - (SQUARES[a].group && ownsGroup(s, id, SQUARES[a].group) ? 1 : 0))
    for (const k of mort) {
      const c = Math.ceil((SQUARES[k].price / 2) * 1.1)
      if (me.money - c > reserve * 1.6) return { type: 'UNMORTGAGE', square: k }
    }
    // construire là où c'est le plus rentable
    const b = bestBuild(s, me, me.money - reserve)
    if (b) return { type: 'BUILD', square: b.k }
  }

  if (s.turnPhase === 'roll') {
    // proposer un échange (une fois de temps en temps, selon la personnalité)
    const M = mem(s)
    const every = Math.round(3 / P.trade)
    if (!s.trade && s.round >= 3 && (M.last[id] ?? -99) + every <= s.round) {
      M.last[id] = s.round
      const cands = tradeCandidates(s, id)
      if (cands.length) return { type: 'PROPOSE_TRADE', to: cands[0].t.to, give: cands[0].t.give, get: cands[0].t.get, candidates: cands }
    }
    if (me.inJail) {
      // en fin de partie, la prison protège des loyers élevés
      const late = danger(s, id) > 400 && s.round > 8
      if (!late && me.jailCards.length) return { type: 'USE_JAIL_CARD' }
      if (!late && me.money > reserve + 50) return { type: 'PAY_JAIL' }
    }
    return { type: 'ROLL' }
  }
  if (s.turnPhase === 'end') return { type: 'END_TURN' }
  return null
}

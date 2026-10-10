import {
  SQUARES, GROUPS, groupMembers, STATIONS, UTILITIES, CHANCE, CAISSE,
  PLAYER_COLORS, PAWNS, START_MONEY, GO_SALARY, JAIL_FINE,
} from './data.js'

const rnd = (n) => {
  const a = new Uint32Array(1)
  crypto.getRandomValues(a)
  return a[0] % n
}
const shuffle = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const MAX_PLAYERS = 8
export const AUCTION_MS = 15000

export function createLobby(host) {
  return {
    phase: 'lobby',
    hostId: host.id,
    settings: { maxRounds: 30 },
    players: [makePlayer(host, 0)],
    rev: 0,
    log: [],
  }
}

function makePlayer({ id, name, isBot = false }, i) {
  return {
    id, name, isBot, connected: true,
    color: PLAYER_COLORS[i % PLAYER_COLORS.length],
    pawn: PAWNS[i % PAWNS.length],
    money: START_MONEY, pos: 0, inJail: false, jailTurns: 0, jailCards: [], bankrupt: false,
  }
}

// ---------- Lobby ----------
export function lobbyAdd(s, p) {
  s = structuredClone(s)
  if (s.phase !== 'lobby') throw new Error('Partie déjà commencée')
  if (s.players.length >= MAX_PLAYERS) throw new Error('Salle pleine')
  const used = new Set(s.players.map((x) => x.color))
  const i = PLAYER_COLORS.findIndex((c) => !used.has(c))
  const pl = makePlayer(p, i)
  pl.pawn = PAWNS.find((x) => !s.players.some((y) => y.pawn === x)) || pl.pawn
  s.players.push(pl)
  s.rev++
  return s
}
export function lobbyRemove(s, id) {
  s = structuredClone(s)
  s.players = s.players.filter((p) => p.id !== id)
  s.rev++
  return s
}

export function startGame(s) {
  s = structuredClone(s)
  if (s.players.length < 2) throw new Error('Il faut au moins 2 joueurs')
  s.players = shuffle(s.players)
  Object.assign(s, {
    phase: 'playing',
    props: {},
    turn: 0,
    round: 1,
    turnPhase: 'roll',
    dice: [1, 1],
    diceRev: 0,
    doublesCount: 0,
    extraRoll: false,
    pending: null,
    debts: [],
    trade: null,
    auction: null,
    auctionQueue: [],
    lastCard: null,
    decks: { chance: shuffle(CHANCE.map((_, i) => i)), caisse: shuffle(CAISSE.map((_, i) => i)) },
    houses: 32,
    hotels: 12,
    winner: null,
    log: [],
    id: crypto.randomUUID(),
    startedAt: Date.now(),
    stats: { buys: 0, hotels: 0, trades: 0, bankruptcies: 0 },
  })
  log(s, `La partie commence ! ${s.players[0].name} joue en premier.`)
  s.rev++
  return s
}

// ---------- Helpers ----------
export const cur = (s) => s.players[s.turn]
function log(s, msg) {
  s.log.push({ t: Date.now(), msg })
  if (s.log.length > 80) s.log.shift()
}
export const ownerOf = (s, i) => s.props?.[i]?.owner
export const ownsGroup = (s, pid, g) => groupMembers(g).every((i) => s.props[i]?.owner === pid)
export const fmt = (n) => `${n.toLocaleString('fr-FR')} €`

export function rentFor(s, i, diceSum) {
  const sq = SQUARES[i]
  const pr = s.props[i]
  if (!pr || pr.mortgaged) return 0
  if (sq.type === 'property') {
    if (pr.houses > 0) return sq.rent[pr.houses]
    return sq.rent[0] * (ownsGroup(s, pr.owner, sq.group) ? 2 : 1)
  }
  if (sq.type === 'station') {
    const n = STATIONS.filter((k) => s.props[k]?.owner === pr.owner).length
    return 25 * 2 ** (n - 1)
  }
  if (sq.type === 'utility') {
    const n = UTILITIES.filter((k) => s.props[k]?.owner === pr.owner).length
    return (n === 2 ? 10 : 4) * diceSum
  }
  return 0
}

export function netWorth(s, p) {
  let w = p.money
  for (const [k, pr] of Object.entries(s.props || {})) {
    if (pr.owner !== p.id) continue
    const sq = SQUARES[k]
    w += pr.mortgaged ? sq.price / 2 : sq.price
    if (pr.houses) w += pr.houses * GROUPS[sq.group].house
  }
  return w
}

const idxOf = (s, id) => s.players.findIndex((p) => p.id === id)

function pay(s, from, to, amount, why) {
  if (amount <= 0) return
  const a = s.players[from]
  a.money -= amount
  if (to != null) s.players[to].money += amount
  log(s, `${a.name} paie ${fmt(amount)}${to != null ? ` à ${s.players[to].name}` : ''}${why ? ` (${why})` : ''}.`)
  if (a.money < 0 && !s.debts.some((d) => d.player === a.id)) {
    s.debts.push({ player: a.id, creditor: to != null ? s.players[to].id : null })
    log(s, `${a.name} est à découvert : vendre, hypothéquer ou déclarer faillite.`)
  }
}
const gain = (s, p, amount, why) => {
  s.players[p].money += amount
  log(s, `${s.players[p].name} reçoit ${fmt(amount)}${why ? ` (${why})` : ''}.`)
}

function sendToJail(s, p) {
  const pl = s.players[p]
  if (s.steps) s.steps.push({ t: 'jail', id: pl.id, from: pl.pos, to: 10 })
  pl.pos = 10
  pl.inJail = true
  pl.jailTurns = 0
  s.extraRoll = false
  s.doublesCount = 0
  log(s, `${pl.name} va en prison.`)
}

function moveTo(s, p, target, collectGo = true) {
  const pl = s.players[p]
  if (collectGo && target < pl.pos) gain(s, p, GO_SALARY, 'case Départ')
  if (s.steps) s.steps.push({ t: 'move', id: pl.id, from: pl.pos, to: target })
  pl.pos = target
  land(s, p)
}
function moveBy(s, p, n) {
  const pl = s.players[p]
  const t = (pl.pos + n + 40) % 40
  if (n > 0 && t < pl.pos) gain(s, p, GO_SALARY, 'case Départ')
  if (s.steps) s.steps.push({ t: 'move', id: pl.id, from: pl.pos, to: t })
  pl.pos = t
  land(s, p)
}

function land(s, p) {
  const pl = s.players[p]
  const sq = SQUARES[pl.pos]
  if (sq.price) {
    const pr = s.props[pl.pos]
    if (!pr) {
      s.pending = { type: 'buy', square: pl.pos }
      return
    }
    if (pr.owner === pl.id || pr.mortgaged) { s.rentMod = null; return }
    let rent = rentFor(s, pl.pos, s.dice[0] + s.dice[1])
    if (s.rentMod === 'double') rent *= 2
    if (s.rentMod === 'utility10') {
      const d1 = rnd(6) + 1, d2 = rnd(6) + 1
      log(s, `${pl.name} relance les dés : ${d1} + ${d2}.`)
      rent = 10 * (d1 + d2)
    }
    s.rentMod = null
    pay(s, p, idxOf(s, pr.owner), rent, `loyer ${sq.name}`)
    return
  }
  if (sq.type === 'tax') return pay(s, p, null, sq.amount, sq.name)
  if (sq.type === 'gotojail') return sendToJail(s, p)
  if (sq.type === 'chance' || sq.type === 'caisse') return drawCard(s, p, sq.type)
}

function drawCard(s, p, deck) {
  const list = deck === 'chance' ? CHANCE : CAISSE
  const ci = s.decks[deck].shift()
  const c = list[ci]
  const pl = s.players[p]
  s.lastCard = { deck, text: c.text, player: pl.id, rev: s.rev + 1 }
  if (s.steps) s.steps.push({ t: 'card', id: pl.id })
  log(s, `${pl.name} tire ${deck === 'chance' ? 'Chance' : 'Caisse de communauté'} : « ${c.text} »`)
  if (c.kind === 'jailCard') pl.jailCards.push(deck)
  else s.decks[deck].push(ci)
  switch (c.kind) {
    case 'money':
      return c.amount > 0 ? gain(s, p, c.amount) : pay(s, p, null, -c.amount)
    case 'move':
      return moveTo(s, p, c.to, !c.noGo)
    case 'moveRel':
      return moveBy(s, p, c.n)
    case 'jail':
      return sendToJail(s, p)
    case 'nearest': {
      const list = c.what === 'station' ? STATIONS : UTILITIES
      const to = list.find((k) => k > pl.pos) ?? list[0]
      s.rentMod = c.what === 'station' ? 'double' : 'utility10'
      return moveTo(s, p, to, true)
    }
    case 'repairs': {
      let cost = 0
      for (const pr of Object.values(s.props)) {
        if (pr.owner !== pl.id) continue
        cost += pr.houses === 5 ? c.hotel : pr.houses * c.house
      }
      return pay(s, p, null, cost, 'réparations')
    }
    case 'each':
      s.players.forEach((o, i) => {
        if (i === p || o.bankrupt) return
        if (c.amount > 0) pay(s, i, p, c.amount, 'carte')
        else pay(s, p, i, -c.amount, 'carte')
      })
  }
}

function startAuction(s, square, fromLanding) {
  s.auction = { square, bid: 0, leader: null, passed: [], fromLanding, deadline: Date.now() + AUCTION_MS }
  log(s, `Enchères : ${SQUARES[square].name} (mise de départ 1 €).`)
  closeAuctionIfDone(s)
}
function nextAuction(s) {
  while (!s.auction && s.auctionQueue.length) {
    const k = s.auctionQueue.shift()
    if (!s.props[k]) startAuction(s, k, false)
  }
}
function closeAuctionIfDone(s) {
  const a = s.auction
  if (!a) return
  // passe automatiquement ceux qui ne peuvent pas surenchérir (moins que l'offre + 1 €)
  s.players.forEach((p) => {
    if (p.bankrupt || a.passed.includes(p.id) || p.id === a.leader) return
    if (p.money < a.bid + 1) { a.passed.push(p.id); log(s, `${p.name} passe (fonds insuffisants).`) }
  })
  const active = s.players.filter((p) => !p.bankrupt && !a.passed.includes(p.id))
  const done = a.leader ? active.every((p) => p.id === a.leader) : active.length === 0
  if (!done) return
  const sq = SQUARES[a.square]
  if (a.leader) {
    const w = s.players[idxOf(s, a.leader)]
    w.money -= a.bid
    s.props[a.square] = { owner: w.id, houses: 0, mortgaged: false }
    if (s.stats) s.stats.buys++
    log(s, `${w.name} remporte ${sq.name} aux enchères pour ${fmt(a.bid)}.`)
    if (w.money < 0 && !s.debts.some((d) => d.player === w.id)) s.debts.push({ player: w.id, creditor: null })
  } else log(s, `Aucune offre : ${sq.name} reste à la banque.`)
  s.auction = null
  if (a.fromLanding) finishMove(s)
  nextAuction(s)
}
export function auctionTimeout(s0) {
  const s = structuredClone(s0)
  const a = s.auction
  if (!a || Date.now() < a.deadline) return s0
  s.players.forEach((p) => { if (!p.bankrupt && p.id !== a.leader && !a.passed.includes(p.id)) a.passed.push(p.id) })
  closeAuctionIfDone(s)
  s.rev++
  return s
}

function finishMove(s) {
  if (s.pending || s.auction) return
  const pl = cur(s)
  s.turnPhase = s.extraRoll && !pl.inJail ? 'roll' : 'end'
}

function nextTurn(s) {
  s.doublesCount = 0
  s.extraRoll = false
  s.pending = null
  const n = s.players.length
  let i = s.turn
  for (let k = 0; k < n; k++) {
    const prev = i
    i = (i + 1) % n
    if (i <= prev) s.round++
    if (!s.players[i].bankrupt) break
  }
  s.turn = i
  s.turnPhase = 'roll'
  if (s.settings.maxRounds > 0 && s.round > s.settings.maxRounds) return endGame(s, 'Limite de tours atteinte')
  log(s, `— Au tour de ${cur(s).name} —`)
}

function endGame(s, why) {
  const alive = s.players.filter((p) => !p.bankrupt)
  const ranking = [...alive].sort((a, b) => netWorth(s, b) - netWorth(s, a))
  s.phase = 'over'
  s.endReason = why
  s.winner = ranking[0]?.id
  s.ranking = ranking.map((p) => ({ id: p.id, worth: netWorth(s, p) }))
  log(s, `${why}. ${ranking[0]?.name} remporte la partie !`)
}

function groupHasHouses(s, g) {
  return groupMembers(g).some((i) => s.props[i]?.houses > 0)
}

function bankrupt(s, p) {
  const pl = s.players[p]
  const debt = s.debts.find((d) => d.player === pl.id)
  const creditorIdx = debt?.creditor != null ? idxOf(s, debt.creditor) : -1
  // liquidation des bâtiments
  for (const [k, pr] of Object.entries(s.props)) {
    if (pr.owner !== pl.id || !pr.houses) continue
    const hc = GROUPS[SQUARES[k].group].house
    pl.money += (pr.houses * hc) / 2
    if (pr.houses === 5) s.hotels++
    else s.houses += pr.houses
    pr.houses = 0
  }
  if (creditorIdx >= 0) {
    const cr = s.players[creditorIdx]
    cr.money += pl.money // si négatif, récupère le découvert déjà versé
    let interest = 0
    for (const [k, pr] of Object.entries(s.props)) if (pr.owner === pl.id) {
      pr.owner = cr.id
      if (pr.mortgaged) interest += Math.ceil(SQUARES[k].price / 2 * 0.1)
    }
    cr.jailCards.push(...pl.jailCards)
    log(s, `${pl.name} fait faillite au profit de ${cr.name}.`)
    if (interest) pay(s, creditorIdx, null, interest, 'intérêts 10 % sur hypothèques reçues')
  } else {
    for (const k of Object.keys(s.props)) if (s.props[k].owner === pl.id) { delete s.props[k]; s.auctionQueue.push(+k) }
    for (const d of pl.jailCards) s.decks[d].push(d === 'chance' ? CHANCE.findIndex((c) => c.kind === 'jailCard') : CAISSE.findIndex((c) => c.kind === 'jailCard'))
    log(s, `${pl.name} fait faillite.`)
  }
  pl.jailCards = []
  pl.money = 0
  pl.bankrupt = true
  if (s.stats) s.stats.bankruptcies++
  s.debts = s.debts.filter((d) => d.player !== pl.id)
  if (s.trade && (s.trade.from === pl.id || s.trade.to === pl.id)) s.trade = null
  const alive = s.players.filter((x) => !x.bankrupt)
  if (alive.length <= 1) return endGame(s, 'Plus qu’un joueur en lice')
  if (s.auction) {
    if (!s.auction.passed.includes(pl.id)) s.auction.passed.push(pl.id)
    if (s.auction.leader === pl.id) { s.auction.leader = null; s.auction.bid = 0 }
  }
  if (s.turn === p) nextTurn(s)
  closeAuctionIfDone(s)
  nextAuction(s)
}

function validateSide(s, pid, side) {
  const pl = s.players[idxOf(s, pid)]
  if (side.money < 0 || side.money > Math.max(0, pl.money)) throw new Error('Montant invalide')
  for (const k of side.props) {
    const pr = s.props[k]
    if (!pr || pr.owner !== pid) throw new Error('Propriété non possédée')
    if (SQUARES[k].group && groupHasHouses(s, SQUARES[k].group)) throw new Error('Vendez les maisons du groupe avant d’échanger')
  }
  if ((side.jailCards || 0) > pl.jailCards.length) throw new Error('Carte prison indisponible')
}

// ---------- Actions ----------
export function applyAction(s0, actorId, a) {
  const s = structuredClone(s0)
  if (s.phase !== 'playing') throw new Error('Partie terminée')
  const ai = idxOf(s, actorId)
  if (ai < 0) throw new Error('Joueur inconnu')
  const me = s.players[ai]
  if (me.bankrupt) throw new Error('Vous êtes en faillite')
  const isTurn = ai === s.turn
  const blocked = s.debts.length > 0
  const needTurn = () => {
    if (!isTurn) throw new Error('Ce n’est pas votre tour')
    if (blocked) throw new Error('Un joueur doit régler sa dette')
    if (s.auction) throw new Error('Enchères en cours')
  }

  switch (a.type) {
    case 'ROLL': {
      needTurn()
      if (s.turnPhase !== 'roll' || s.pending) throw new Error('Impossible de lancer maintenant')
      const d1 = rnd(6) + 1, d2 = rnd(6) + 1
      const dbl = d1 === d2
      s.dice = [d1, d2]
      s.diceRev++
      s.steps = []
      log(s, `${me.name} lance ${d1} + ${d2}${dbl ? ' (double !)' : ''}.`)
      if (me.inJail) {
        if (dbl) {
          me.inJail = false
          s.extraRoll = false
          log(s, `${me.name} sort de prison.`)
          moveBy(s, ai, d1 + d2)
        } else {
          me.jailTurns++
          if (me.jailTurns >= 3) {
            pay(s, ai, null, JAIL_FINE, 'sortie de prison')
            me.inJail = false
            moveBy(s, ai, d1 + d2)
          } else {
            s.turnPhase = 'end'
            break
          }
        }
      } else {
        if (dbl) {
          s.doublesCount++
          if (s.doublesCount >= 3) {
            log(s, 'Trois doubles de suite !')
            sendToJail(s, ai)
            s.turnPhase = 'end'
            break
          }
          s.extraRoll = true
        } else s.extraRoll = false
        moveBy(s, ai, d1 + d2)
      }
      finishMove(s)
      break
    }
    case 'BUY': {
      needTurn()
      if (s.pending?.type !== 'buy') throw new Error('Rien à acheter')
      const sq = SQUARES[s.pending.square]
      if (me.money < sq.price) throw new Error('Fonds insuffisants')
      me.money -= sq.price
      s.props[s.pending.square] = { owner: me.id, houses: 0, mortgaged: false }
      if (s.stats) s.stats.buys++
      log(s, `${me.name} achète ${sq.name} pour ${fmt(sq.price)}.`)
      s.pending = null
      s.rentMod = null
      finishMove(s)
      break
    }
    case 'DECLINE': {
      needTurn()
      if (s.pending?.type !== 'buy') throw new Error('Rien à refuser')
      log(s, `${me.name} n’achète pas ${SQUARES[s.pending.square].name}.`)
      const sqI = s.pending.square
      s.pending = null
      s.rentMod = null
      startAuction(s, sqI, true)
      break
    }
    case 'END_TURN': {
      needTurn()
      if (s.turnPhase !== 'end' || s.pending) throw new Error('Terminez vos actions')
      nextTurn(s)
      break
    }
    case 'PAY_JAIL': {
      needTurn()
      if (!me.inJail || s.turnPhase !== 'roll') throw new Error('Pas en prison')
      if (me.money < JAIL_FINE) throw new Error('Fonds insuffisants')
      pay(s, ai, null, JAIL_FINE, 'sortie de prison')
      me.inJail = false
      break
    }
    case 'USE_JAIL_CARD': {
      needTurn()
      if (!me.inJail || !me.jailCards.length || s.turnPhase !== 'roll') throw new Error('Impossible')
      const d = me.jailCards.pop()
      s.decks[d].push((d === 'chance' ? CHANCE : CAISSE).findIndex((c) => c.kind === 'jailCard'))
      me.inJail = false
      log(s, `${me.name} utilise sa carte « Libéré de prison ».`)
      break
    }
    case 'BUILD': {
      const i = a.square, sq = SQUARES[i], pr = s.props[i]
      if (!pr || pr.owner !== me.id || sq.type !== 'property') throw new Error('Propriété invalide')
      const mem = groupMembers(sq.group)
      if (!ownsGroup(s, me.id, sq.group)) throw new Error('Il faut tout le groupe de couleur')
      if (mem.some((k) => s.props[k].mortgaged)) throw new Error('Une propriété du groupe est hypothéquée')
      if (pr.houses >= 5) throw new Error('Déjà un hôtel')
      if (pr.houses > Math.min(...mem.map((k) => s.props[k].houses))) throw new Error('Construisez de façon uniforme')
      const cost = GROUPS[sq.group].house
      if (me.money < cost) throw new Error('Fonds insuffisants')
      if (pr.houses === 4) {
        if (s.hotels < 1) throw new Error('Plus d’hôtels en banque')
        s.hotels--; s.houses += 4
        if (s.stats) s.stats.hotels++
      } else {
        if (s.houses < 1) throw new Error('Plus de maisons en banque')
        s.houses--
      }
      me.money -= cost
      pr.houses++
      log(s, `${me.name} construit ${pr.houses === 5 ? 'un hôtel' : 'une maison'} sur ${sq.name}.`)
      break
    }
    case 'SELL_HOUSE': {
      const i = a.square, sq = SQUARES[i], pr = s.props[i]
      if (!pr || pr.owner !== me.id || !pr.houses) throw new Error('Rien à vendre')
      const mem = groupMembers(sq.group)
      if (pr.houses < Math.max(...mem.map((k) => s.props[k].houses))) throw new Error('Vendez de façon uniforme')
      if (pr.houses === 5) {
        if (s.houses < 4) throw new Error('Pas assez de maisons en banque pour remplacer l’hôtel')
        s.houses -= 4; s.hotels++
      } else s.houses++
      pr.houses--
      me.money += GROUPS[sq.group].house / 2
      log(s, `${me.name} vend un bâtiment sur ${sq.name} (+${fmt(GROUPS[sq.group].house / 2)}).`)
      break
    }
    case 'MORTGAGE': {
      const i = a.square, sq = SQUARES[i], pr = s.props[i]
      if (!pr || pr.owner !== me.id || pr.mortgaged) throw new Error('Impossible d’hypothéquer')
      if (sq.group && groupHasHouses(s, sq.group)) throw new Error('Vendez d’abord les maisons du groupe')
      pr.mortgaged = true
      me.money += sq.price / 2
      log(s, `${me.name} hypothèque ${sq.name} (+${fmt(sq.price / 2)}).`)
      break
    }
    case 'UNMORTGAGE': {
      const i = a.square, sq = SQUARES[i], pr = s.props[i]
      if (!pr || pr.owner !== me.id || !pr.mortgaged) throw new Error('Pas hypothéquée')
      const cost = Math.ceil((sq.price / 2) * 1.1)
      if (me.money < cost) throw new Error('Fonds insuffisants')
      me.money -= cost
      pr.mortgaged = false
      log(s, `${me.name} lève l’hypothèque de ${sq.name} (-${fmt(cost)}).`)
      break
    }
    case 'BID': {
      const a2 = s.auction
      if (!a2) throw new Error('Pas d’enchères')
      if (a2.passed.includes(me.id)) throw new Error('Vous avez passé')
      const amt = Math.floor(+a.amount)
      if (!(amt > a2.bid) || amt < 1) throw new Error('Offre trop basse')
      if (amt > me.money) throw new Error('Fonds insuffisants')
      a2.bid = amt; a2.leader = me.id; a2.deadline = Date.now() + AUCTION_MS
      log(s, `${me.name} enchérit : ${fmt(amt)}.`)
      closeAuctionIfDone(s)
      break
    }
    case 'PASS_AUCTION': {
      const a2 = s.auction
      if (!a2 || a2.passed.includes(me.id) || a2.leader === me.id) throw new Error('Impossible de passer')
      a2.passed.push(me.id)
      log(s, `${me.name} passe.`)
      closeAuctionIfDone(s)
      break
    }
    case 'BANKRUPT': {
      bankrupt(s, ai)
      break
    }
    case 'PROPOSE_TRADE': {
      if (s.trade) throw new Error('Un échange est déjà en cours')
      const ti = idxOf(s, a.to)
      if (ti < 0 || ti === ai || s.players[ti].bankrupt) throw new Error('Destinataire invalide')
      const t = { from: me.id, to: a.to, give: norm(a.give), get: norm(a.get), id: s.rev }
      if (!t.give.money && !t.give.props.length && !t.give.jailCards && !t.get.money && !t.get.props.length && !t.get.jailCards) throw new Error('Échange vide')
      validateSide(s, me.id, t.give)
      validateSide(s, a.to, t.get)
      s.trade = t
      log(s, `${me.name} propose un échange à ${s.players[ti].name}.`)
      break
    }
    case 'COUNTER_TRADE': {
      // le destinataire renvoie une version modifiée : les rôles s'inversent
      const t0 = s.trade
      if (!t0 || t0.to !== me.id) throw new Error('Aucun échange à contre-proposer')
      if ((t0.counters || 0) >= 6) throw new Error('Trop de contre-propositions, acceptez ou refusez')
      const t = { from: me.id, to: t0.from, give: norm(a.give), get: norm(a.get), id: s.rev, counters: (t0.counters || 0) + 1 }
      if (!t.give.money && !t.give.props.length && !t.give.jailCards && !t.get.money && !t.get.props.length && !t.get.jailCards) throw new Error('Échange vide')
      validateSide(s, me.id, t.give)
      validateSide(s, t.to, t.get)
      s.trade = t
      log(s, `${me.name} fait une contre-proposition à ${s.players[idxOf(s, t.to)].name}.`)
      break
    }
    case 'ACCEPT_TRADE': {
      const t = s.trade
      if (!t || t.to !== me.id) throw new Error('Aucun échange')
      validateSide(s, t.from, t.give)
      validateSide(s, t.to, t.get)
      const A = s.players[idxOf(s, t.from)], B = me
      A.money += t.get.money - t.give.money
      B.money += t.give.money - t.get.money
      t.give.props.forEach((k) => (s.props[k].owner = B.id))
      t.get.props.forEach((k) => (s.props[k].owner = A.id))
      for (let k = 0; k < t.give.jailCards; k++) B.jailCards.push(A.jailCards.pop())
      for (let k = 0; k < t.get.jailCards; k++) A.jailCards.push(B.jailCards.pop())
      log(s, `${B.name} accepte l’échange avec ${A.name}.`)
      if (s.stats) s.stats.trades++
      const intr = (list) => list.filter((k) => s.props[k].mortgaged).reduce((x, k) => x + Math.ceil(SQUARES[k].price / 2 * 0.1), 0)
      const iB = intr(t.give.props), iA = intr(t.get.props)
      if (iB) pay(s, idxOf(s, B.id), null, iB, 'intérêts 10 % sur hypothèques reçues')
      if (iA) pay(s, idxOf(s, A.id), null, iA, 'intérêts 10 % sur hypothèques reçues')
      s.trade = null
      break
    }
    case 'REJECT_TRADE': {
      const t = s.trade
      if (!t || (t.to !== me.id && t.from !== me.id)) throw new Error('Aucun échange')
      log(s, t.to === me.id ? `${me.name} refuse l’échange.` : `${me.name} annule sa proposition.`)
      s.trade = null
      break
    }
    default:
      throw new Error('Action inconnue')
  }
  // dettes réglées ?
  s.debts = s.debts.filter((d) => {
    const p = s.players[idxOf(s, d.player)]
    return p && !p.bankrupt && p.money < 0
  })
  s.rev++
  return s
}

function norm(x = {}) {
  return { money: Math.floor(+x.money || 0), props: [...new Set(x.props || [])].map(Number), jailCards: +x.jailCards || 0 }
}

// Qui doit agir maintenant ? (pour bots et indicateurs)
export function whoMustAct(s) {
  if (s.phase !== 'playing') return null
  if (s.auction) return null
  if (s.debts.length) return s.debts[0].player
  return cur(s).id
}

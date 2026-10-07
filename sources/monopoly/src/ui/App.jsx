import { useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '../net/useGame.js'
import Scene from '../three/Scene.jsx'
import { SQUARES, GROUPS, groupMembers, JAIL_FINE } from '../game/data.js'
import { fmt, netWorth, ownsGroup, rentFor } from '../game/engine.js'

const back = () => (window.location.href = '../jeux/index.html')

export default function App() {
  const g = useGame()
  if (!g.game) return <Home g={g} />
  if (g.game.phase === 'lobby') return <Lobby g={g} />
  return <GameView g={g} />
}

function Toast({ toast }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!toast) return
    setShow(true)
    const t = setTimeout(() => setShow(false), 3200)
    return () => clearTimeout(t)
  }, [toast?.k])
  return show ? <div className="toast">{toast.msg}</div> : null
}

// ---------- Accueil ----------
function Home({ g }) {
  const [name, setName] = useState(() => { try { return localStorage.getItem('mono-name') || '' } catch { return '' } })
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('room') || '')
  const ok = name.trim().length >= 2
  useEffect(() => {
    const q = new URLSearchParams(location.search)
    const m = q.get('mode'), n = (q.get('name') || '').trim().slice(0, 16)
    if (!m || n.length < 2) return
    history.replaceState(null, '', location.pathname)
    try { localStorage.setItem('mono-name', n) } catch {}
    m === 'solo' ? g.createOffline(n) : g.create(n)
  }, [])
  const save = () => { try { localStorage.setItem('mono-name', name.trim()) } catch {} }
  return (
    <div className="screen home">
      <button className="back" onClick={back}>← Casino</button>
      <div className="panel center-panel">
        <div className="logo"><span>🎩</span><h1>Monopoly 3D</h1><p>Édition Paris · multijoueur en ligne</p></div>
        <label>Ton pseudo</label>
        <input value={name} maxLength={16} onChange={(e) => setName(e.target.value)} placeholder="Pseudo" />
        <button className="btn primary big" disabled={!ok} onClick={() => { save(); g.create(name.trim()) }}>Créer une salle</button>
        <div className="sep"><span>ou rejoindre</span></div>
        <div className="row">
          <input className="code-in" value={code} maxLength={5} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CODE" />
          <button className="btn" disabled={!ok || code.length !== 5} onClick={() => { save(); g.join(code, name.trim()) }}>Rejoindre</button>
        </div>
        {g.status && <p className="status">{g.status}</p>}
        <button className="btn ghost" disabled={!ok} onClick={() => { save(); g.createOffline(name.trim()) }}>Solo contre des bots (hors ligne)</button>
        <p className="hint">En ligne : crée une salle, partage le code, complète avec des bots.</p>
      </div>
      <Toast toast={g.toast} />
    </div>
  )
}

// ---------- Salon ----------
function Lobby({ g }) {
  const s = g.game
  const host = g.role === 'host'
  const link = `${location.origin}${location.pathname}?room=${g.code}`
  return (
    <div className="screen home">
      <button className="back" onClick={back}>← Casino</button>
      <div className="panel center-panel wide">
        <p className="muted">Code de la salle</p>
        <div className="room-code" onClick={() => navigator.clipboard?.writeText(link).then(() => g.notify('Lien copié !'))} title="Copier le lien">
          {g.code}
        </div>
        <p className="muted small">Clique pour copier le lien d’invitation</p>
        <ul className="lobby-list">
          {s.players.map((p) => (
            <li key={p.id}>
              <span className="dot" style={{ background: p.color }} />
              <b>{p.name}</b>
              {p.isBot && <span className="tag">BOT</span>}
              {p.id === s.hostId && <span className="tag gold">HÔTE</span>}
              {p.id === g.myId && <span className="tag">toi</span>}
              {host && p.id !== g.myId && <button className="x" onClick={() => g.lobby.remove(p.id)}>✕</button>}
            </li>
          ))}
          {Array.from({ length: 6 - s.players.length }).map((_, i) => <li key={i} className="empty">Place libre</li>)}
        </ul>
        {host ? (
          <>
            <div className="row">
              <button className="btn" disabled={s.players.length >= 6} onClick={g.lobby.addBot}>+ Ajouter un bot</button>
              <select value={s.settings.maxRounds} onChange={(e) => g.lobby.setRounds(+e.target.value)}>
                {[15, 20, 30, 50, 0].map((n) => <option key={n} value={n}>{n ? `${n} tours max` : 'Sans limite'}</option>)}
              </select>
            </div>
            <button className="btn primary big" disabled={s.players.length < 2} onClick={g.lobby.start}>Lancer la partie</button>
          </>
        ) : (
          <p className="muted">En attente de l’hôte… ({s.settings.maxRounds ? `${s.settings.maxRounds} tours max` : 'sans limite'})</p>
        )}
      </div>
      <Toast toast={g.toast} />
    </div>
  )
}

// ---------- Partie ----------
function GameView({ g }) {
  const s = g.game
  const me = s.players.find((p) => p.id === g.myId)
  const [sel, setSel] = useState(null)
  const [modal, setModal] = useState(null) // 'manage' | 'trade'
  const [logOpen, setLogOpen] = useState(true)

  return (
    <div className="game">
      <Scene game={s} selected={sel} onPick={setSel} myId={g.myId} />
      <div className="hud-top">
        <button className="back small" onClick={back}>←</button>
        <div className="pill">Salle <b>{g.code}</b></div>
        <div className="pill">Tour <b>{Math.min(s.round, s.settings.maxRounds || s.round)}</b>{s.settings.maxRounds ? ` / ${s.settings.maxRounds}` : ''}</div>
        <div className="pill">🏠 {s.houses} · 🏨 {s.hotels}</div>
      </div>
      <Players s={s} myId={g.myId} />
      <ActionBar g={g} me={me} onManage={() => setModal('manage')} onTrade={() => setModal('trade')} />
      {sel != null && <SquareCard s={s} i={sel} me={me} act={g.act} onClose={() => setSel(null)} />}
      <Log s={s} open={logOpen} setOpen={setLogOpen} chat={g.chat} />
      <CardPopup s={s} />
      {modal === 'manage' && me && <Manage s={s} me={me} act={g.act} onClose={() => setModal(null)} />}
      {modal === 'trade' && me && <TradeBuilder s={s} me={me} act={g.act} onClose={() => setModal(null)} />}
      <TradeIncoming s={s} me={me} act={g.act} />
      {s.phase === 'over' && <GameOver s={s} />}
      <Toast toast={g.toast} />
    </div>
  )
}

function Players({ s, myId }) {
  return (
    <div className="players">
      {s.players.map((p, i) => (
        <div key={p.id} className={`pl ${i === s.turn && s.phase === 'playing' ? 'turn' : ''} ${p.bankrupt ? 'out' : ''}`}>
          <span className="dot" style={{ background: p.color }} />
          <div className="pl-main">
            <div className="pl-name">
              {p.name}{p.id === myId && ' (toi)'} {p.isBot && <span className="tag">BOT</span>}
              {!p.isBot && !p.connected && <span className="tag red">hors ligne · bot</span>}
            </div>
            <div className="pl-sub">
              {p.bankrupt ? 'Faillite' : <>{fmt(p.money)} <span className="muted">· patrimoine {fmt(netWorth(s, p))}</span></>}
              {p.inJail && ' 🔒'}{p.jailCards.length > 0 && ' 🎟️'.repeat(p.jailCards.length)}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function ActionBar({ g, me, onManage, onTrade }) {
  const s = g.game
  if (s.phase !== 'playing') return null
  const cur = s.players[s.turn]
  const myTurn = me && cur.id === me.id
  const myDebt = me && s.debts.find((d) => d.player === me.id)
  const blocked = s.debts.length > 0
  const pend = s.pending?.type === 'buy' ? SQUARES[s.pending.square] : null
  const a = g.act
  let main
  if (!me || me.bankrupt) main = <span className="wait">Spectateur · tour de {cur.name}</span>
  else if (myDebt) main = (<>
    <span className="warn">Dette : {fmt(me.money)} — vends ou hypothèque</span>
    <button className="btn danger" onClick={() => confirm('Déclarer faillite ?') && a({ type: 'BANKRUPT' })}>Faillite</button>
  </>)
  else if (blocked) main = <span className="wait">{s.players.find((p) => p.id === s.debts[0].player)?.name} règle une dette…</span>
  else if (!myTurn) main = <span className="wait"><span className="dot" style={{ background: cur.color }} /> Tour de {cur.name}…</span>
  else if (pend) main = (<>
    <span className="buy-name" style={{ borderColor: pend.group ? GROUPS[pend.group].color : '#888' }}>{pend.name}</span>
    <button className="btn primary" disabled={me.money < pend.price} onClick={() => a({ type: 'BUY' })}>Acheter {fmt(pend.price)}</button>
    <button className="btn" onClick={() => a({ type: 'DECLINE' })}>Passer</button>
  </>)
  else if (s.turnPhase === 'roll') main = (<>
    {me.inJail && <button className="btn" disabled={me.money < JAIL_FINE} onClick={() => a({ type: 'PAY_JAIL' })}>Payer {JAIL_FINE} €</button>}
    {me.inJail && me.jailCards.length > 0 && <button className="btn" onClick={() => a({ type: 'USE_JAIL_CARD' })}>Carte prison</button>}
    <button className="btn primary big" onClick={() => a({ type: 'ROLL' })}>🎲 {me.inJail ? 'Tenter un double' : s.extraRoll ? 'Relancer (double)' : 'Lancer les dés'}</button>
  </>)
  else main = <button className="btn primary big" onClick={() => a({ type: 'END_TURN' })}>Fin du tour ➜</button>

  return (
    <div className="actionbar">
      <div className="dice-read">{s.dice[0]} + {s.dice[1]}</div>
      <div className="main-actions">{main}</div>
      {me && !me.bankrupt && (
        <div className="side-actions">
          <button className="btn ghost" onClick={onManage}>🏘️ Propriétés</button>
          <button className="btn ghost" disabled={!!s.trade} onClick={onTrade}>🤝 Échanger</button>
        </div>
      )}
    </div>
  )
}

function rentLines(sq) {
  if (sq.type === 'property')
    return [['Loyer', sq.rent[0]], ['Groupe complet', sq.rent[0] * 2], ['1 maison', sq.rent[1]], ['2 maisons', sq.rent[2]], ['3 maisons', sq.rent[3]], ['4 maisons', sq.rent[4]], ['Hôtel', sq.rent[5]]]
  if (sq.type === 'station') return [['1 gare', 25], ['2 gares', 50], ['3 gares', 100], ['4 gares', 200]]
  if (sq.type === 'utility') return [['1 compagnie', '4 × dés'], ['2 compagnies', '10 × dés']]
  return []
}

function SquareCard({ s, i, me, act, onClose }) {
  const sq = SQUARES[i]
  const pr = s.props[i]
  const owner = pr && s.players.find((p) => p.id === pr.owner)
  const mine = me && pr?.owner === me.id
  const desc = { go: 'Recevez 200 € à chaque passage.', jail: 'Simple visite… ou séjour forcé.', parking: 'Repos !', gotojail: 'Direction la prison, sans passer par Départ.', chance: 'Tirez une carte Chance.', caisse: 'Tirez une carte Caisse de communauté.', tax: `Payez ${sq.amount} €.` }[sq.type]
  return (
    <div className="sqcard">
      <button className="x" onClick={onClose}>✕</button>
      <div className="sq-head" style={{ background: sq.group ? GROUPS[sq.group].color : '#24453a', color: ['yellow', 'lightblue'].includes(sq.group) ? '#111' : '#fff' }}>
        {sq.name}
      </div>
      {desc && <p className="muted pad">{desc}</p>}
      {sq.price && (
        <div className="pad">
          <table className="rents"><tbody>
            {rentLines(sq).map(([k, v]) => <tr key={k}><td>{k}</td><td>{typeof v === 'number' ? fmt(v) : v}</td></tr>)}
          </tbody></table>
          <div className="kv"><span>Prix</span><b>{fmt(sq.price)}</b></div>
          {sq.group && <div className="kv"><span>Maison / hôtel</span><b>{fmt(GROUPS[sq.group].house)}</b></div>}
          <div className="kv"><span>Hypothèque</span><b>{fmt(sq.price / 2)}</b></div>
          <div className="kv"><span>Propriétaire</span><b style={{ color: owner?.color }}>{owner ? owner.name : 'Banque'}</b></div>
          {pr && <div className="kv"><span>Loyer actuel</span><b>{pr.mortgaged ? 'Hypothéquée' : sq.type === 'utility' ? (rentFor(s, i, 1) === 10 ? '10 × dés' : '4 × dés') : fmt(rentFor(s, i, 7))}</b></div>}
          {mine && <PropButtons s={s} i={i} act={act} />}
        </div>
      )}
    </div>
  )
}

function PropButtons({ s, i, act }) {
  const sq = SQUARES[i], pr = s.props[i]
  const full = sq.group && ownsGroup(s, pr.owner, sq.group)
  return (
    <div className="prop-btns">
      {sq.type === 'property' && full && !pr.mortgaged && pr.houses < 5 && <button className="btn sm" onClick={() => act({ type: 'BUILD', square: i })}>+ {pr.houses === 4 ? 'Hôtel' : 'Maison'}</button>}
      {pr.houses > 0 && <button className="btn sm" onClick={() => act({ type: 'SELL_HOUSE', square: i })}>− Vendre</button>}
      {!pr.mortgaged && !pr.houses && <button className="btn sm" onClick={() => act({ type: 'MORTGAGE', square: i })}>Hypothéquer</button>}
      {pr.mortgaged && <button className="btn sm" onClick={() => act({ type: 'UNMORTGAGE', square: i })}>Lever ({fmt(Math.ceil(sq.price * 0.55))})</button>}
    </div>
  )
}

function Manage({ s, me, act, onClose }) {
  const mine = Object.keys(s.props).map(Number).filter((k) => s.props[k].owner === me.id).sort((a, b) => a - b)
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose}>✕</button>
        <h2>Mes propriétés <span className="muted">· {fmt(me.money)}</span></h2>
        {!mine.length && <p className="muted">Aucune propriété pour l’instant.</p>}
        <div className="manage-list">
          {mine.map((k) => {
            const sq = SQUARES[k], pr = s.props[k]
            return (
              <div key={k} className={`mrow ${pr.mortgaged ? 'mort' : ''}`}>
                <span className="band" style={{ background: sq.group ? GROUPS[sq.group].color : '#777' }} />
                <div className="mname">{sq.name}<div className="muted small">{pr.mortgaged ? 'hypothéquée' : pr.houses === 5 ? '🏨 hôtel' : pr.houses ? '🏠'.repeat(pr.houses) : sq.type === 'property' ? 'terrain nu' : ''}</div></div>
                <PropButtons s={s} i={k} act={act} />
              </div>
            )
          })}
        </div>
        <p className="muted small">Construction pendant ton tour, de façon uniforme dans le groupe.</p>
      </div>
    </div>
  )
}

function PropPicker({ s, owner, value, onChange }) {
  const list = Object.keys(s.props).map(Number).filter((k) => s.props[k].owner === owner).sort((a, b) => a - b)
  if (!list.length) return <p className="muted small">Aucune propriété</p>
  return (
    <div className="picker">
      {list.map((k) => {
        const sq = SQUARES[k]
        const blocked = sq.group && groupMembers(sq.group).some((i) => s.props[i]?.houses)
        const on = value.includes(k)
        return (
          <button key={k} disabled={blocked} className={`chip ${on ? 'on' : ''}`} onClick={() => onChange(on ? value.filter((x) => x !== k) : [...value, k])}>
            <span className="band" style={{ background: sq.group ? GROUPS[sq.group].color : '#777' }} />{sq.name}{s.props[k].mortgaged ? ' (H)' : ''}
          </button>
        )
      })}
    </div>
  )
}

function TradeBuilder({ s, me, act, onClose }) {
  const others = s.players.filter((p) => p.id !== me.id && !p.bankrupt)
  const [to, setTo] = useState(others[0]?.id)
  const [give, setGive] = useState({ money: 0, props: [], jailCards: 0 })
  const [get, setGet] = useState({ money: 0, props: [], jailCards: 0 })
  const other = s.players.find((p) => p.id === to)
  useEffect(() => setGet({ money: 0, props: [], jailCards: 0 }), [to])
  const send = () => { act({ type: 'PROPOSE_TRADE', to, give, get }); onClose() }
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal trade" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose}>✕</button>
        <h2>Proposer un échange</h2>
        <div className="row">
          <span>Avec</span>
          <select value={to} onChange={(e) => setTo(e.target.value)}>
            {others.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="trade-cols">
          <div>
            <h3>Je donne</h3>
            <PropPicker s={s} owner={me.id} value={give.props} onChange={(props) => setGive({ ...give, props })} />
            <label className="small">Argent (max {fmt(Math.max(0, me.money))})</label>
            <input type="number" min={0} max={Math.max(0, me.money)} step={10} value={give.money} onChange={(e) => setGive({ ...give, money: Math.max(0, +e.target.value) })} />
            {me.jailCards.length > 0 && <label className="small"><input type="checkbox" checked={give.jailCards > 0} onChange={(e) => setGive({ ...give, jailCards: e.target.checked ? 1 : 0 })} /> Carte prison</label>}
          </div>
          <div>
            <h3>Je reçois</h3>
            {other && <PropPicker s={s} owner={other.id} value={get.props} onChange={(props) => setGet({ ...get, props })} />}
            <label className="small">Argent (max {fmt(Math.max(0, other?.money || 0))})</label>
            <input type="number" min={0} step={10} value={get.money} onChange={(e) => setGet({ ...get, money: Math.max(0, +e.target.value) })} />
            {other?.jailCards.length > 0 && <label className="small"><input type="checkbox" checked={get.jailCards > 0} onChange={(e) => setGet({ ...get, jailCards: e.target.checked ? 1 : 0 })} /> Carte prison</label>}
          </div>
        </div>
        <button className="btn primary big" onClick={send}>Envoyer la proposition</button>
      </div>
    </div>
  )
}

function TradeSummary({ s, side }) {
  const items = [...side.props.map((k) => SQUARES[k].name), side.money ? fmt(side.money) : null, side.jailCards ? 'Carte prison' : null].filter(Boolean)
  return <ul className="tsum">{items.length ? items.map((x) => <li key={x}>{x}</li>) : <li className="muted">rien</li>}</ul>
}

function TradeIncoming({ s, me, act }) {
  const t = s.trade
  if (!t || !me) return null
  const from = s.players.find((p) => p.id === t.from)
  const to = s.players.find((p) => p.id === t.to)
  if (t.from === me.id)
    return <div className="trade-wait">Échange proposé à {to?.name}… <button className="btn sm" onClick={() => act({ type: 'REJECT_TRADE' })}>Annuler</button></div>
  if (t.to !== me.id) return null
  return (
    <div className="modal-bg">
      <div className="modal">
        <h2>{from.name} te propose un échange</h2>
        <div className="trade-cols">
          <div><h3>Tu reçois</h3><TradeSummary s={s} side={t.give} /></div>
          <div><h3>Tu donnes</h3><TradeSummary s={s} side={t.get} /></div>
        </div>
        <div className="row">
          <button className="btn primary" onClick={() => act({ type: 'ACCEPT_TRADE' })}>Accepter</button>
          <button className="btn" onClick={() => act({ type: 'REJECT_TRADE' })}>Refuser</button>
        </div>
      </div>
    </div>
  )
}

function CardPopup({ s }) {
  const [card, setCard] = useState(null)
  const last = useRef(s.lastCard?.rev)
  useEffect(() => {
    if (!s.lastCard || s.lastCard.rev === last.current) return
    last.current = s.lastCard.rev
    setCard(s.lastCard)
    const t = setTimeout(() => setCard(null), 3800)
    return () => clearTimeout(t)
  }, [s.lastCard?.rev])
  if (!card) return null
  const who = s.players.find((p) => p.id === card.player)
  return (
    <div className={`cardpop ${card.deck}`} onClick={() => setCard(null)}>
      <div className="cp-title">{card.deck === 'chance' ? '? CHANCE' : 'CAISSE DE COMMUNAUTÉ'}</div>
      <div className="cp-text">{card.text}</div>
      <div className="cp-who">{who?.name}</div>
    </div>
  )
}

function Log({ s, open, setOpen, chat }) {
  const ref = useRef()
  const [msg, setMsg] = useState('')
  useEffect(() => { ref.current && (ref.current.scrollTop = 1e9) }, [s.log.length, open])
  return (
    <div className={`log ${open ? '' : 'closed'}`}>
      <div className="log-head" onClick={() => setOpen(!open)}>Journal {open ? '▾' : '▸'}</div>
      {open && (<>
        <div className="log-body" ref={ref}>{s.log.slice(-40).map((l, i) => <div key={i}>{l.msg}</div>)}</div>
        <form onSubmit={(e) => { e.preventDefault(); chat(msg); setMsg('') }}>
          <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Message…" maxLength={200} />
        </form>
      </>)}
    </div>
  )
}

function GameOver({ s }) {
  return (
    <div className="modal-bg">
      <div className="modal center">
        <h2>🏆 Fin de partie</h2>
        <ol className="ranking">
          {s.ranking?.map((r) => {
            const p = s.players.find((x) => x.id === r.id)
            return <li key={r.id}><span className="dot" style={{ background: p.color }} /> {p.name} <b>{fmt(r.worth)}</b></li>
          })}
        </ol>
        <div className="row">
          <button className="btn primary" onClick={() => location.reload()}>Nouvelle partie</button>
          <button className="btn" onClick={back}>Casino</button>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { useGame, loadSession, clearSession } from '../net/useGame.js'
import Scene from '../three/Scene.jsx'
import { SQUARES, GROUPS, groupMembers, JAIL_FINE } from '../game/data.js'
import { fmt, netWorth, ownsGroup, rentFor } from '../game/engine.js'
import { usePresented } from './present.js'
import { parseChat, suggest, mentionedIds } from './mentions.js'
import { sfx, getSfx, setSfx, onSfx, CATEGORIES } from './sfx.js'

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
  return show ? <div className={`toast ${toast.kind || ''}`}>{toast.kind === 'mention' ? '📣 ' : ''}{toast.msg}</div> : null
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
  const [saved, setSaved] = useState(() => loadSession())
  return (
    <div className="screen home">
      <button className="back" onClick={back}>← Casino</button>
      <div className="panel center-panel">
        <div className="logo"><span>🎩</span><h1>Monopoly 3D</h1><p>Édition Paris · multijoueur en ligne</p></div>
        {saved && (
          <div className="resume">
            <div>
              <b>Partie en cours</b>
              <small>{saved.role === 'solo' ? 'Solo contre des bots' : `Salle ${saved.code}${saved.role === 'host' ? ' · tu es l’hôte' : ''}`} · {saved.name}</small>
            </div>
            <button className="btn primary" onClick={() => g.resume()}>Reprendre</button>
            <button className="x" title="Oublier cette partie" onClick={() => { clearSession(); setSaved(null) }}>✕</button>
          </div>
        )}
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
          {Array.from({ length: 8 - s.players.length }).map((_, i) => <li key={i} className="empty">Place libre</li>)}
        </ul>
        {host ? (
          <>
            <div className="row">
              <button className="btn" disabled={s.players.length >= 8} onClick={g.lobby.addBot}>+ Ajouter un bot</button>
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
const textOn = (g) => (['yellow', 'lightblue'].includes(g) ? '#111' : '#fff')
const sqColor = (sq) => (sq.group ? GROUPS[sq.group].color : sq.type === 'station' ? '#3b4a42' : sq.type === 'utility' ? '#4a5a52' : '#24453a')

// Suivi des variations d'argent pour afficher +/- sur les joueurs
function useMoneyDeltas(players) {
  const prev = useRef({})
  const [deltas, setDeltas] = useState({})
  useEffect(() => {
    const d = {}
    players.forEach((p) => {
      const old = prev.current[p.id]
      if (old != null && old !== p.money) d[p.id] = { v: p.money - old, k: Date.now() + Math.random() }
      prev.current[p.id] = p.money
    })
    if (Object.keys(d).length) {
      setDeltas((x) => ({ ...x, ...d }))
      const t = setTimeout(() => setDeltas((x) => { const y = { ...x }; Object.keys(d).forEach((id) => { if (y[id]?.k === d[id].k) delete y[id] }); return y }), 2200)
      return () => clearTimeout(t)
    }
  }, [players.map((p) => p.money).join()])
  return deltas
}

function GameView({ g }) {
  const { hud: s, scene, anim, card: shownCard } = usePresented(g.game, g.myId)
  const me = s.players.find((p) => p.id === g.myId)
  const [sel, setSel] = useState(null)
  const [modal, setModal] = useState(null) // 'manage' | 'trade' | 'rules' | {player}
  const [logOpen, setLogOpen] = useState(() => window.innerWidth > 760)
  const [soundOpen, setSoundOpen] = useState(false)
  const close = () => setModal(null)
  const main = anim ? null : useMainAction(s, me, g.act)

  // Raccourcis clavier
  useEffect(() => {
    const h = (e) => {
      if (e.target.closest('input, textarea, select')) return
      if (e.key === 'Escape') { setModal(null); setSel(null) }
      else if (e.key === ' ' || e.key === 'Enter') { if (main?.run && !modal) { e.preventDefault(); main.run() } }
      else if (e.key.toLowerCase() === 'p') setModal((m) => (m === 'manage' ? null : 'manage'))
      else if (e.key.toLowerCase() === 'e' && !s.trade) setModal((m) => (m === 'trade' ? null : 'trade'))
      else if (e.key.toLowerCase() === 'j') setLogOpen((o) => !o)
      else if (e.key.toLowerCase() === 'm') setSfx({ muted: !getSfx().muted })
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [main, modal, s.trade])

  const pend = s.pending?.type === 'buy' && me && s.players[s.turn].id === me.id && !s.debts.length ? s.pending.square : null

  return (
    <div className="game">
      {g.status && <div className="netbanner"><span className="spinner" /> {g.status}</div>}
      <Scene game={scene} card={shownCard && { ...shownCard, who: s.players.find((p) => p.id === shownCard.player)?.name }} selected={sel} onPick={setSel} myId={g.myId} />
      <TopBar s={s} code={g.code} notify={g.notify} onSound={() => setSoundOpen(!soundOpen)} onRules={() => setModal('rules')} logOpen={logOpen} toggleLog={() => setLogOpen(!logOpen)} />
      <Players s={s} myId={g.myId} onPick={(p) => setModal({ player: p.id })} />
      <DebtBanner s={s} me={me} act={g.act} onManage={() => setModal('manage')} />
      <Dock s={s} me={me} act={g.act} main={main} anim={anim} onManage={() => setModal('manage')} onTrade={() => setModal('trade')} />
      {sel != null && !modal && <SquareCard s={s} i={sel} me={me} act={g.act} onClose={() => setSel(null)} />}
      {logOpen && <Log s={s} chats={g.chats} chat={g.chat} myId={g.myId} onPick={(i) => { setModal(null); setSel(i) }} onClose={() => setLogOpen(false)} />}
      {soundOpen && <SoundMenu onClose={() => setSoundOpen(false)} />}
      {pend != null && !modal && <BuyPrompt s={s} i={pend} me={me} act={g.act} />}
      {modal === 'manage' && me && <Manage s={s} me={me} act={g.act} onClose={close} />}
      {modal === 'trade' && me && <TradeBuilder s={s} me={me} act={g.act} onClose={close} />}
      {modal === 'rules' && <Rules onClose={close} />}
      {modal?.player && <PlayerSheet s={s} id={modal.player} me={me} onClose={close} onTrade={() => setModal('trade')} onPick={(i) => { setModal(null); setSel(i) }} />}
      <TradeIncoming s={s} me={me} act={g.act} />
      {s.auction && <Auction s={s} me={me} act={g.act} />}
      {s.phase === 'over' && <GameOver s={s} />}
      <Toast toast={g.toast} />
    </div>
  )
}

function useSfxSettings() {
  const [v, setV] = useState(getSfx())
  useEffect(() => onSfx(setV), [])
  return v
}

function SoundMenu({ onClose }) {
  const st = useSfxSettings()
  return (
    <>
      <div className="pop-bg" onClick={onClose} />
      <div className="soundmenu">
        <div className="sm-head">
          <b>Bruitages</b>
          <button className={`switch ${st.muted ? '' : 'on'}`} onClick={() => setSfx({ muted: !st.muted })} title="Activer / couper le son"><i /></button>
        </div>
        <label className="sm-vol">
          <span>{st.muted || st.volume === 0 ? '🔇' : st.volume < 0.4 ? '🔈' : '🔊'}</span>
          <input type="range" min={0} max={1} step={0.05} value={st.volume} disabled={st.muted} onChange={(e) => setSfx({ volume: +e.target.value })} onPointerUp={() => sfx('land')} />
          <small>{Math.round(st.volume * 100)}%</small>
        </label>
        <div className={`sm-cats ${st.muted ? 'off' : ''}`}>
          {Object.entries(CATEGORIES).map(([k, label]) => (
            <label key={k} className="sm-cat">
              <input type="checkbox" checked={st.cats[k]} disabled={st.muted} onChange={(e) => setSfx({ cats: { [k]: e.target.checked } })} />
              <span>{label}</span>
              <button className="ibtn sm" disabled={st.muted || !st.cats[k]} title="Écouter" onClick={(e) => { e.preventDefault(); sfx({ dice: 'roll', move: 'step', money: 'gain', events: 'buy', turn: 'turn' }[k]) }}>▶</button>
            </label>
          ))}
        </div>
      </div>
    </>
  )
}

function TopBar({ s, code, notify, onRules, onSound, logOpen, toggleLog }) {
  const st = useSfxSettings()
  const copy = () => {
    const link = `${location.origin}${location.pathname}?room=${code}`
    navigator.clipboard?.writeText(code === 'SOLO' ? code : link).then(() => notify(code === 'SOLO' ? 'Partie solo' : 'Lien d’invitation copié'))
  }
  return (
    <div className="topbar">
      <button className="ibtn" onClick={back} title="Retour au Casino">←</button>
      <button className="chip" onClick={copy} title="Copier le lien">Salle <b>{code}</b></button>
      <span className="chip">Tour <b>{Math.min(s.round, s.settings.maxRounds || s.round)}</b>{s.settings.maxRounds ? <span className="muted"> / {s.settings.maxRounds}</span> : null}</span>
      <span className="chip hide-m" title="Bâtiments disponibles à la banque">🏠 {s.houses} · 🏨 {s.hotels}</span>
      <span className="grow" />
      <button className="ibtn" onClick={() => setSfx({ muted: !st.muted })} title="Couper / remettre le son (M)">{st.muted ? '🔇' : '🔊'}</button>
      <button className="ibtn" onClick={onSound} title="Réglages des bruitages">⚙</button>
      <button className={`ibtn ${logOpen ? 'on' : ''}`} onClick={toggleLog} title="Journal (J)">💬</button>
      <button className="ibtn" onClick={onRules} title="Règles et raccourcis">?</button>
    </div>
  )
}

function OwnedStrip({ s, id }) {
  const owned = Object.keys(s.props).map(Number).filter((k) => s.props[k].owner === id).sort((a, b) => a - b)
  if (!owned.length) return null
  return (
    <div className="strip">
      {owned.map((k) => <i key={k} title={SQUARES[k].name} className={s.props[k].mortgaged ? 'mort' : ''} style={{ background: sqColor(SQUARES[k]) }} />)}
    </div>
  )
}

function Players({ s, myId, onPick }) {
  const deltas = useMoneyDeltas(s.players)
  return (
    <div className="players">
      {s.players.map((p, i) => {
        const turn = i === s.turn && s.phase === 'playing'
        const d = deltas[p.id]
        return (
          <button key={p.id} className={`pl ${turn ? 'turn' : ''} ${p.bankrupt ? 'out' : ''} ${p.id === myId ? 'me' : ''}`} style={{ '--c': p.color }} onClick={() => onPick(p)}>
            <span className="avatar">{p.name.replace('Bot ', '')[0]?.toUpperCase()}</span>
            <span className="pl-main">
              <span className="pl-name">
                {p.name}{p.id === myId && <em> · toi</em>}
                {p.isBot && <span className="tag">BOT</span>}
                {!p.isBot && !p.connected && <span className="tag red">hors ligne</span>}
                {p.inJail && <span className="tag" title="En prison">🔒</span>}
                {p.jailCards.length > 0 && <span className="tag" title="Carte libéré de prison">🎟️{p.jailCards.length > 1 ? p.jailCards.length : ''}</span>}
              </span>
              <span className="pl-money">{p.bankrupt ? 'Faillite' : fmt(p.money)}</span>
              {!p.bankrupt && <OwnedStrip s={s} id={p.id} />}
            </span>
            {d && <span key={d.k} className={`delta ${d.v > 0 ? 'pos' : 'neg'}`}>{d.v > 0 ? '+' : '−'}{fmt(Math.abs(d.v))}</span>}
          </button>
        )
      })}
    </div>
  )
}

// Action principale contextuelle (bouton du dock + Espace)
function useMainAction(s, me, a) {
  if (s.phase !== 'playing' || !me || me.bankrupt) return null
  const cur = s.players[s.turn]
  if (cur.id !== me.id || s.debts.length || s.auction || s.pending) return null
  if (s.turnPhase === 'roll') return { label: me.inJail ? 'Tenter un double' : s.extraRoll ? 'Relancer (double)' : 'Lancer les dés', icon: '🎲', run: () => a({ type: 'ROLL' }) }
  return { label: 'Fin du tour', icon: '➜', run: () => a({ type: 'END_TURN' }) }
}

function DiceMini({ d }) {
  return <span className="dmini">{d.map((v, i) => <i key={i}>{['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][v - 1]}</i>)}</span>
}

function Dock({ s, me, act, main, anim, onManage, onTrade }) {
  if (s.phase !== 'playing') return null
  const cur = s.players[s.turn]
  const myTurn = me && cur.id === me.id
  let status
  if (anim) status = <>🎲 {cur.name} lance les dés…</>
  else if (!me || me.bankrupt) status = <>Spectateur · tour de <b style={{ color: cur.color }}>{cur.name}</b></>
  else if (s.auction) status = 'Enchères en cours'
  else if (s.debts.length && !s.debts.some((d) => d.player === me.id)) status = <>{s.players.find((p) => p.id === s.debts[0].player)?.name} règle une dette…</>
  else if (myTurn) status = s.pending ? 'Décide de l’achat' : s.turnPhase === 'roll' ? (me.inJail ? 'Tu es en prison' : 'À toi de jouer') : 'Termine ton tour'
  else status = <>Tour de <b style={{ color: cur.color }}>{cur.name}</b></>
  return (
    <div className="dock">
      <div className="dock-status">
        <DiceMini d={s.dice} />
        <span>{status}</span>
      </div>
      <div className="dock-main">
        {!anim && myTurn && me.inJail && s.turnPhase === 'roll' && !s.debts.length && (
          <JailOptions me={me} act={act} />
        )}
        {main ? (
          <button className={`btn primary big ${main.icon === '🎲' ? 'roll' : ''}`} onClick={main.run}>
            <span>{main.icon}</span> {main.label} <kbd>Espace</kbd>
          </button>
        ) : (
          !myTurn && <span className="waiting"><span className="spinner" style={{ borderTopColor: cur.color }} /></span>
        )}
      </div>
      {me && !me.bankrupt && (
        <div className="dock-side">
          <button className="tool" onClick={onManage} title="Mes propriétés (P)"><span>🏘️</span><small>Propriétés</small></button>
          <button className="tool" disabled={!!s.trade} onClick={onTrade} title="Échanger (E)"><span>🤝</span><small>Échanger</small></button>
        </div>
      )}
    </div>
  )
}

function JailOptions({ me, act: g }) {
  return (
    <div className="jailopts">
      <button className="btn" disabled={me.money < JAIL_FINE} onClick={() => g({ type: 'PAY_JAIL' })}>Payer {JAIL_FINE} €</button>
      {me.jailCards.length > 0 && <button className="btn" onClick={() => g({ type: 'USE_JAIL_CARD' })}>🎟️ Utiliser la carte</button>}
    </div>
  )
}

function DebtBanner({ s, me, act, onManage }) {
  if (!me || !s.debts?.some((d) => d.player === me.id)) return null
  return (
    <div className="debt">
      <div><b>Tu es à découvert : {fmt(me.money)}</b><small>Vends des maisons ou hypothèque pour revenir à 0 €.</small></div>
      <button className="btn" onClick={onManage}>Gérer mes biens</button>
      <button className="btn danger" onClick={() => confirm('Déclarer faillite ? Tu seras éliminé.') && act({ type: 'BANKRUPT' })}>Faillite</button>
    </div>
  )
}

function rentLines(sq) {
  if (sq.type === 'property')
    return [['Terrain nu', sq.rent[0]], ['Groupe complet', sq.rent[0] * 2], ['1 maison', sq.rent[1]], ['2 maisons', sq.rent[2]], ['3 maisons', sq.rent[3]], ['4 maisons', sq.rent[4]], ['Hôtel', sq.rent[5]]]
  if (sq.type === 'station') return [['1 gare', 25], ['2 gares', 50], ['3 gares', 100], ['4 gares', 200]]
  if (sq.type === 'utility') return [['1 compagnie', '4 × dés'], ['2 compagnies', '10 × dés']]
  return []
}

// Titre de propriété façon carte
function Deed({ s, i, compact }) {
  const sq = SQUARES[i]
  const pr = s.props[i]
  const owner = pr && s.players.find((p) => p.id === pr.owner)
  const level = pr ? (sq.type === 'property' ? (pr.houses ? pr.houses + 1 : ownsGroup(s, pr.owner, sq.group) ? 1 : 0) : sq.type === 'station' ? [5, 15, 25, 35].filter((k) => s.props[k]?.owner === pr.owner).length - 1 : [12, 28].filter((k) => s.props[k]?.owner === pr.owner).length - 1) : -1
  return (
    <div className="deed">
      <div className="deed-head" style={{ background: sqColor(sq), color: textOn(sq.group) }}>
        <small>{sq.type === 'property' ? 'Titre de propriété' : sq.type === 'station' ? 'Gare' : 'Compagnie'}</small>
        <b>{sq.name}</b>
      </div>
      <table className="rents"><tbody>
        {rentLines(sq).map(([k, v], n) => <tr key={k} className={!pr?.mortgaged && n === level ? 'cur' : ''}><td>{k}</td><td>{typeof v === 'number' ? fmt(v) : v}</td></tr>)}
      </tbody></table>
      {!compact && (
        <div className="deed-foot">
          <span>Prix <b>{fmt(sq.price)}</b></span>
          {sq.group && <span>Maison <b>{fmt(GROUPS[sq.group].house)}</b></span>}
          <span>Hypothèque <b>{fmt(sq.price / 2)}</b></span>
        </div>
      )}
      {pr && <div className="deed-owner" style={{ '--c': owner?.color }}>{pr.mortgaged ? 'Hypothéquée · ' : ''}Propriétaire : <b>{owner?.name}</b></div>}
    </div>
  )
}

function SquareCard({ s, i, me, act, onClose }) {
  const sq = SQUARES[i]
  const pr = s.props[i]
  const mine = me && pr?.owner === me.id
  const here = s.players.filter((p) => !p.bankrupt && p.pos === i)
  const desc = { go: 'Recevez 200 € à chaque passage.', jail: 'Simple visite… ou séjour forcé.', parking: 'Case neutre, rien ne se passe.', gotojail: 'Direction la prison, sans passer par Départ.', chance: 'Tirez une carte Chance.', caisse: 'Tirez une carte Caisse de communauté.', tax: `Payez ${sq.amount} € à la banque.` }[sq.type]
  return (
    <div className="sqcard">
      <button className="x" onClick={onClose}>✕</button>
      {sq.price ? <Deed s={s} i={i} /> : (
        <div className="deed"><div className="deed-head" style={{ background: '#24453a', color: '#fff' }}><small>Case</small><b>{sq.name}</b></div><p className="pad muted">{desc}</p></div>
      )}
      {here.length > 0 && <div className="here">{here.map((p) => <span key={p.id}><i style={{ background: p.color }} />{p.name}</span>)}</div>}
      {mine && <div className="pad"><PropButtons s={s} i={i} act={act} me={me} /></div>}
    </div>
  )
}

function BuyPrompt({ s, i, me, act }) {
  const sq = SQUARES[i]
  const can = me.money >= sq.price
  return (
    <div className="modal-bg soft">
      <div className="buy">
        <Deed s={s} i={i} />
        <div className="buy-side">
          <h3>Acheter cette propriété ?</h3>
          <div className="kv"><span>Ton argent</span><b>{fmt(me.money)}</b></div>
          <div className="kv"><span>Après achat</span><b className={can ? '' : 'neg'}>{fmt(me.money - sq.price)}</b></div>
          {!can && <p className="small warn">Fonds insuffisants : hypothèque un bien ou passe aux enchères.</p>}
          <button className="btn primary big" disabled={!can} onClick={() => act({ type: 'BUY' })}>Acheter {fmt(sq.price)}</button>
          <button className="btn" onClick={() => act({ type: 'DECLINE' })}>Mettre aux enchères</button>
        </div>
      </div>
    </div>
  )
}

function Auction({ s, me, act }) {
  const A = s.auction
  const [now, setNow] = useState(Date.now())
  const [amt, setAmt] = useState('')
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 200); return () => clearInterval(t) }, [])
  const leader = s.players.find((p) => p.id === A.leader)
  const left = Math.max(0, (A.deadline - now) / 1000)
  const canAct = me && !me.bankrupt && !A.passed.includes(me.id) && A.leader !== me.id
  const bid = (n) => act({ type: 'BID', amount: n })
  const alive = s.players.filter((p) => !p.bankrupt)
  return (
    <div className="modal-bg soft">
      <div className="buy auction2">
        <Deed s={s} i={A.square} compact />
        <div className="buy-side">
          <h3>Enchères</h3>
          <div className="bidbox" style={{ '--c': leader?.color || '#5d6b63' }}>
            <small>Meilleure offre</small>
            <b>{A.bid ? fmt(A.bid) : '—'}</b>
            <span>{leader ? leader.name : 'Aucune offre'}</span>
          </div>
          <div className="timer"><i style={{ width: `${Math.min(100, (left / 15) * 100)}%` }} /></div>
          <div className="bidders">{alive.map((p) => <span key={p.id} className={A.passed.includes(p.id) ? 'passed' : p.id === A.leader ? 'lead' : ''} style={{ '--c': p.color }}>{p.name}</span>)}</div>
          {canAct ? (<>
            <div className="quick">
              {[1, 10, 50, 100].map((d) => <button key={d} className="btn" disabled={A.bid + d > me.money} onClick={() => bid(A.bid + d)}>+{d} €</button>)}
            </div>
            <form className="row" onSubmit={(e) => { e.preventDefault(); if (+amt > A.bid && +amt <= me.money) { bid(+amt); setAmt('') } }}>
              <input type="number" min={A.bid + 1} max={me.money} value={amt} placeholder={`> ${A.bid} €`} onChange={(e) => setAmt(e.target.value)} />
              <button className="btn primary" disabled={!(+amt > A.bid) || +amt > me.money}>Miser</button>
            </form>
            <button className="btn ghost" onClick={() => act({ type: 'PASS_AUCTION' })}>Je passe</button>
          </>) : <p className="muted small center">{!me ? '' : A.leader === me.id ? 'Tu mènes l’enchère.' : 'Tu as passé.'}</p>}
        </div>
      </div>
    </div>
  )
}

function PlayerSheet({ s, id, me, onClose, onTrade, onPick }) {
  const p = s.players.find((x) => x.id === id)
  if (!p) return null
  const owned = Object.keys(s.props).map(Number).filter((k) => s.props[k].owner === id).sort((a, b) => a - b)
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <span className="avatar lg" style={{ '--c': p.color }}>{p.name.replace('Bot ', '')[0]?.toUpperCase()}</span>
          <div><h2>{p.name}</h2><small className="muted">{p.bankrupt ? 'Faillite' : `${fmt(p.money)} en poche · patrimoine ${fmt(netWorth(s, p))}`}</small></div>
          <button className="x" onClick={onClose}>✕</button>
        </div>
        <div className="groups">
          {!owned.length && <p className="muted">Aucune propriété.</p>}
          <div className="tiles">
            {owned.map((k) => (
              <button key={k} className={`tile ${s.props[k].mortgaged ? 'mort' : ''}`} style={{ '--c': sqColor(SQUARES[k]) }} onClick={() => onPick(k)}>
                <span className="tname">{SQUARES[k].name}</span>
                <span className="tprice">{s.props[k].mortgaged ? 'Hypothéquée' : s.props[k].houses === 5 ? 'Hôtel' : s.props[k].houses ? `${s.props[k].houses} maison(s)` : fmt(SQUARES[k].price)}</span>
              </button>
            ))}
          </div>
        </div>
        {me && !me.bankrupt && p.id !== me.id && !p.bankrupt && (
          <div className="tfoot"><button className="btn primary" disabled={!!s.trade} onClick={onTrade}>🤝 Proposer un échange</button></div>
        )}
      </div>
    </div>
  )
}

function Rules({ onClose }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head"><h2>Aide</h2><button className="x" onClick={onClose}>✕</button></div>
        <div className="groups rules">
          <section><h4>Raccourcis</h4>
            <p><kbd>Espace</kbd> lancer les dés / fin du tour · <kbd>P</kbd> propriétés · <kbd>E</kbd> échange · <kbd>J</kbd> journal · <kbd>M</kbd> couper le son · <kbd>Échap</kbd> fermer</p></section>
          <section><h4>Tour de jeu</h4>
            <p>Lance les dés et avance. Un double permet de rejouer, trois doubles d’affilée envoient en prison. Passer par Départ rapporte 200 €.</p></section>
          <section><h4>Achat et enchères</h4>
            <p>Sur une propriété libre, tu peux l’acheter au prix affiché. Si tu refuses, elle part aux enchères (tout le monde peut miser, toi compris).</p></section>
          <section><h4>Construire</h4>
            <p>Il faut posséder tout le groupe de couleur, sans hypothèque. On construit uniformément : une maison sur chaque terrain avant la deuxième. Après 4 maisons, un hôtel. La revente rapporte la moitié du prix.</p></section>
          <section><h4>Hypothèques</h4>
            <p>Un terrain sans bâtiment s’hypothèque pour la moitié de son prix. Le lever coûte cette somme + 10 %. Recevoir un terrain hypothéqué coûte 10 % immédiatement.</p></section>
          <section><h4>Prison</h4>
            <p>Pour sortir : payer 50 €, utiliser une carte, ou faire un double (3 essais, puis amende obligatoire). Tu touches tes loyers même en prison.</p></section>
          <section><h4>Fin de partie</h4>
            <p>Le dernier joueur non ruiné gagne. Avec une limite de tours, le plus gros patrimoine l’emporte.</p></section>
        </div>
      </div>
    </div>
  )
}

function ChatText({ text, s, myId, onPick }) {
  return parseChat(text, s.players).map((t, i) => {
    if (t.type === 'user') {
      const p = s.players.find((x) => x.id === t.id)
      return <span key={i} className={`ment ${t.id === myId ? 'me' : ''}`} style={{ '--c': p?.color }}>{t.value}</span>
    }
    if (t.type === 'place') {
      const sq = SQUARES[t.i]
      return <button key={i} className="ment place" style={{ '--c': sqColor(sq) }} onClick={() => onPick?.(t.i)} title="Voir la case">{t.value}</button>
    }
    return <span key={i}>{t.value}</span>
  })
}

function ChatInput({ s, onSend }) {
  const [msg, setMsg] = useState('')
  const [sug, setSug] = useState(null)
  const [k, setK] = useState(0)
  const ref = useRef()
  const refresh = (text, caret) => { setSug(suggest(text, caret, s.players.filter((p) => !p.bankrupt))); setK(0) }
  const pick = (it) => {
    const next = msg.slice(0, sug.start) + it.insert + ' ' + msg.slice(sug.end)
    const caret = sug.start + it.insert.length + 1
    setMsg(next); setSug(null)
    requestAnimationFrame(() => { ref.current.focus(); ref.current.setSelectionRange(caret, caret) })
  }
  const onKey = (e) => {
    if (!sug) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setK((k + 1) % sug.items.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setK((k - 1 + sug.items.length) % sug.items.length) }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(sug.items[k]) }
    else if (e.key === 'Escape') { e.stopPropagation(); setSug(null) }
  }
  return (
    <form className="chatform" onSubmit={(e) => { e.preventDefault(); if (msg.trim()) onSend(msg.trim()); setMsg(''); setSug(null) }}>
      {sug && (
        <div className="suggest">
          <small>{sug.trig === '@' ? 'Mentionner un joueur' : 'Citer une case'}</small>
          {sug.items.map((it, i) => (
            <button type="button" key={it.insert} className={i === k ? 'on' : ''} onMouseDown={(e) => { e.preventDefault(); pick(it) }}>
              <i style={{ background: it.color || (it.group ? GROUPS[it.group].color : '#5d6b63') }} />
              {it.label}{it.sub && <em>{it.sub}</em>}
            </button>
          ))}
        </div>
      )}
      <input ref={ref} value={msg} maxLength={200} placeholder="Message… (@joueur, #case)"
        onChange={(e) => { setMsg(e.target.value); refresh(e.target.value, e.target.selectionStart) }}
        onKeyDown={onKey} onClick={(e) => refresh(msg, e.target.selectionStart)} onBlur={() => setTimeout(() => setSug(null), 150)} />
    </form>
  )
}

function Log({ s, chats = [], chat, onClose, myId, onPick }) {
  const ref = useRef()
  useEffect(() => { ref.current && (ref.current.scrollTop = 1e9) }, [s.log.length, chats.length])
  const items = [...s.log.slice(-60).map((l) => ({ ...l, kind: 'log' })), ...chats.map((c) => ({ ...c, kind: 'chat' }))].sort((a, b) => a.t - b.t)
  return (
    <div className="log">
      <div className="log-head"><b>Journal</b><button className="x" onClick={onClose}>✕</button></div>
      <div className="log-body" ref={ref}>
        {items.map((l, i) => l.kind === 'chat'
          ? <div key={i} className={`chatline ${mentionedIds(l.msg, s.players).includes(myId) ? 'tome' : ''}`}><b>{l.from}</b> <ChatText text={l.msg} s={s} myId={myId} onPick={onPick} /></div>
          : <div key={i} className={l.msg.startsWith('—') ? 'sep' : ''}>{l.msg.replace(/^— | —$/g, '')}</div>)}
      </div>
      <ChatInput s={s} onSend={chat} />
    </div>
  )
}

// ---------- Gestion des propriétés ----------
const HOUSE_LABEL = (h) => (h === 5 ? 'Hôtel' : h ? `${h} maison${h > 1 ? 's' : ''}` : 'Terrain nu')
const unmortgageCost = (sq) => Math.ceil((sq.price / 2) * 1.1)

// Calcule les actions possibles sur une propriété, avec prix et raison si bloqué
function propActions(s, i, me) {
  const sq = SQUARES[i], pr = s.props[i]
  const out = []
  if (!pr || pr.owner !== me.id) return out
  const mem = sq.group ? groupMembers(sq.group) : []
  const full = sq.group && ownsGroup(s, me.id, sq.group)
  const groupBuilt = mem.some((k) => s.props[k]?.houses)
  if (sq.type === 'property' && pr.houses < 5) {
    const cost = GROUPS[sq.group].house
    let why = null
    if (!full) why = 'Il faut tout le groupe'
    else if (mem.some((k) => s.props[k].mortgaged)) why = 'Groupe hypothéqué'
    else if (pr.houses > Math.min(...mem.map((k) => s.props[k].houses))) why = 'Construis d’abord sur les autres'
    else if (pr.houses === 4 ? s.hotels < 1 : s.houses < 1) why = 'Banque à court'
    else if (me.money < cost) why = 'Pas assez d’argent'
    out.push({ key: 'build', label: pr.houses === 4 ? 'Hôtel' : 'Maison', price: -cost, why, action: { type: 'BUILD', square: i }, primary: true })
  }
  if (pr.houses > 0) {
    const why = pr.houses < Math.max(...mem.map((k) => s.props[k].houses)) ? 'Vends d’abord sur les autres' : null
    out.push({ key: 'sell', label: pr.houses === 5 ? 'Vendre l’hôtel' : 'Vendre', price: GROUPS[sq.group].house / 2, why, action: { type: 'SELL_HOUSE', square: i } })
  }
  if (!pr.mortgaged && !pr.houses)
    out.push({ key: 'mort', label: 'Hypothéquer', price: sq.price / 2, why: groupBuilt ? 'Vends les maisons du groupe' : null, action: { type: 'MORTGAGE', square: i } })
  if (pr.mortgaged) {
    const c = unmortgageCost(sq)
    out.push({ key: 'unmort', label: 'Lever', price: -c, why: me.money < c ? 'Pas assez d’argent' : null, action: { type: 'UNMORTGAGE', square: i } })
  }
  return out
}

function ActBtn({ a, act }) {
  return (
    <button className={`abtn ${a.primary ? 'pri' : ''}`} disabled={!!a.why} title={a.why || ''} onClick={() => act(a.action)}>
      <span>{a.label}</span>
      <b className={a.price < 0 ? 'neg' : 'pos'}>{a.price < 0 ? '−' : '+'}{fmt(Math.abs(a.price))}</b>
    </button>
  )
}

function PropButtons({ s, i, act, me }) {
  if (!me) return null
  const acts = propActions(s, i, me)
  if (!acts.length) return null
  return <div className="prop-btns">{acts.map((a) => <ActBtn key={a.key} a={a} act={act} />)}</div>
}

function HouseDots({ h }) {
  if (h === 5) return <span className="hdots"><i className="hotel" /></span>
  return <span className="hdots">{[0, 1, 2, 3].map((k) => <i key={k} className={k < h ? 'on' : ''} />)}</span>
}

function Manage({ s, me, act, onClose }) {
  const mine = Object.keys(s.props).map(Number).filter((k) => s.props[k].owner === me.id).sort((a, b) => a - b)
  // regroupe par groupe de couleur (gares et compagnies à part)
  const groups = []
  for (const k of mine) {
    const g = SQUARES[k].group || SQUARES[k].type
    let e = groups.find((x) => x.g === g)
    if (!e) groups.push((e = { g, items: [] }))
    e.items.push(k)
  }
  const title = (g) => (g === 'station' ? 'Gares' : g === 'utility' ? 'Compagnies' : null)
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Mes propriétés</h2>
          <span className="cash">{fmt(me.money)}</span>
          <button className="x" onClick={onClose}>✕</button>
        </div>
        {!mine.length && <p className="muted empty-msg">Aucune propriété pour l’instant.</p>}
        <div className="groups">
          {groups.map(({ g, items }) => {
            const col = GROUPS[g]?.color || '#5d6b63'
            const total = GROUPS[g] ? groupMembers(g).length : items.length
            const full = GROUPS[g] && ownsGroup(s, me.id, g)
            return (
              <section key={g} className="grp" style={{ '--c': col }}>
                <header>
                  <span>{title(g) || (full ? 'Groupe complet' : `${items.length} / ${total}`)}</span>
                  {GROUPS[g] && <small>Maison / hôtel {fmt(GROUPS[g].house)}</small>}
                </header>
                {items.map((k) => {
                  const sq = SQUARES[k], pr = s.props[k]
                  return (
                    <div key={k} className={`prow ${pr.mortgaged ? 'mort' : ''}`}>
                      <div className="pinfo">
                        <b>{sq.name}</b>
                        <small>
                          {pr.mortgaged ? 'Hypothéquée' : <>Loyer {sq.type === 'utility' ? (rentFor(s, k, 1) === 10 ? '10× dés' : '4× dés') : fmt(rentFor(s, k, 7))}</>}
                          {sq.type === 'property' && <> · <HouseDots h={pr.houses} /></>}
                        </small>
                      </div>
                      <div className="pacts">{propActions(s, k, me).map((a) => <ActBtn key={a.key} a={a} act={act} />)}</div>
                    </div>
                  )
                })}
              </section>
            )
          })}
        </div>
        <p className="muted small foot">Règle : construction et vente uniformes dans un groupe. Un bouton grisé indique pourquoi au survol.</p>
      </div>
    </div>
  )
}

// ---------- Échanges ----------
function Tiles({ s, owner, value, onChange }) {
  const list = Object.keys(s.props).map(Number).filter((k) => s.props[k].owner === owner).sort((a, b) => a - b)
  if (!list.length) return <p className="muted small">Aucune propriété</p>
  return (
    <div className="tiles">
      {list.map((k) => {
        const sq = SQUARES[k]
        const blocked = sq.group && groupMembers(sq.group).some((i) => s.props[i]?.houses)
        const on = value.includes(k)
        return (
          <button key={k} disabled={blocked} title={blocked ? 'Groupe construit' : ''} className={`tile ${on ? 'on' : ''} ${s.props[k].mortgaged ? 'mort' : ''}`}
            style={{ '--c': sq.group ? GROUPS[sq.group].color : '#5d6b63' }}
            onClick={() => onChange(on ? value.filter((x) => x !== k) : [...value, k])}>
            <span className="tname">{sq.name}</span>
            <span className="tprice">{s.props[k].mortgaged ? 'Hyp.' : fmt(sq.price)}</span>
          </button>
        )
      })}
    </div>
  )
}

function MoneyField({ value, max, onChange }) {
  return (
    <div className="moneyf">
      <input type="range" min={0} max={Math.max(0, max)} step={10} value={Math.min(value, Math.max(0, max))} onChange={(e) => onChange(+e.target.value)} />
      <input type="number" min={0} max={Math.max(0, max)} step={10} value={value} onChange={(e) => onChange(Math.max(0, Math.min(+e.target.value || 0, Math.max(0, max))))} />
    </div>
  )
}

const sideValue = (side) => side.money + side.props.reduce((a, k) => a + SQUARES[k].price, 0)

function TradeSide({ s, who, side, set, mine }) {
  return (
    <div className="tside">
      <div className="tside-head"><span className="dot" style={{ background: who.color }} /><b>{mine ? 'Tu donnes' : `${who.name} donne`}</b><small>{fmt(who.money)}</small></div>
      <Tiles s={s} owner={who.id} value={side.props} onChange={(props) => set({ ...side, props })} />
      <label className="small muted">Argent</label>
      <MoneyField value={side.money} max={who.money} onChange={(money) => set({ ...side, money })} />
      {who.jailCards.length > 0 && (
        <label className="chk"><input type="checkbox" checked={side.jailCards > 0} onChange={(e) => set({ ...side, jailCards: e.target.checked ? 1 : 0 })} /> Carte « Libéré de prison »</label>
      )}
    </div>
  )
}

function TradeBuilder({ s, me, act, onClose }) {
  const others = s.players.filter((p) => p.id !== me.id && !p.bankrupt)
  const empty = { money: 0, props: [], jailCards: 0 }
  const [to, setTo] = useState(others[0]?.id)
  const [give, setGive] = useState(empty)
  const [get, setGet] = useState(empty)
  const other = s.players.find((p) => p.id === to)
  useEffect(() => setGet(empty), [to])
  const isEmpty = !give.money && !give.props.length && !give.jailCards && !get.money && !get.props.length && !get.jailCards
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal sheet trade" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Échange</h2>
          <button className="x" onClick={onClose}>✕</button>
        </div>
        <div className="partners">
          {others.map((p) => (
            <button key={p.id} className={`partner ${p.id === to ? 'on' : ''}`} style={{ '--c': p.color }} onClick={() => setTo(p.id)}>
              <span className="dot" style={{ background: p.color }} />{p.name}
            </button>
          ))}
        </div>
        {other && (
          <div className="tcols">
            <TradeSide s={s} who={me} side={give} set={setGive} mine />
            <div className="tarrow">⇄</div>
            <TradeSide s={s} who={other} side={get} set={setGet} />
          </div>
        )}
        <div className="tfoot">
          <span className="muted small">Valeur plateau : {fmt(sideValue(give))} ⇄ {fmt(sideValue(get))}</span>
          <button className="btn primary" disabled={isEmpty} onClick={() => { act({ type: 'PROPOSE_TRADE', to, give, get }); onClose() }}>Proposer</button>
        </div>
      </div>
    </div>
  )
}

function TradeSummary({ s, side }) {
  const items = [
    ...side.props.map((k) => ({ k, name: SQUARES[k].name, c: SQUARES[k].group ? GROUPS[SQUARES[k].group].color : '#5d6b63', sub: s.props[k]?.mortgaged ? 'hypothéquée' : fmt(SQUARES[k].price) })),
    side.money ? { k: 'm', name: fmt(side.money), c: '#e8c468', sub: 'argent' } : null,
    side.jailCards ? { k: 'j', name: 'Libéré de prison', c: '#9fb3a6', sub: 'carte' } : null,
  ].filter(Boolean)
  if (!items.length) return <p className="muted small">Rien</p>
  return <div className="tsum">{items.map((x) => <div key={x.k} className="tsum-item" style={{ '--c': x.c }}><b>{x.name}</b><small>{x.sub}</small></div>)}</div>
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
      <div className="modal sheet">
        <div className="sheet-head"><h2><span className="dot" style={{ background: from.color }} /> {from.name} propose un échange</h2></div>
        <div className="tcols">
          <div className="tside"><div className="tside-head"><b>Tu reçois</b></div><TradeSummary s={s} side={t.give} /></div>
          <div className="tarrow">⇄</div>
          <div className="tside"><div className="tside-head"><b>Tu donnes</b></div><TradeSummary s={s} side={t.get} /></div>
        </div>
        <div className="tfoot">
          <button className="btn" onClick={() => act({ type: 'REJECT_TRADE' })}>Refuser</button>
          <button className="btn primary" onClick={() => act({ type: 'ACCEPT_TRADE' })}>Accepter</button>
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

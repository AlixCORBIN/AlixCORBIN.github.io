// Appels à l'IA (Gemini via la fonction Supabase monopoly-ai). Toujours optionnels :
// en cas d'échec ou de quota atteint, les bots gardent leur choix calculé et un message type.
import { SQUARES } from '../game/data.js'
import { fmt } from '../game/engine.js'
import { persona } from '../game/bot.js'

const URL = 'https://njkbhgmwylletmdmsmyl.supabase.co/functions/v1/monopoly-ai'
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qa2JoZ213eWxsZXRtZG1zbXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NzQ2MzYsImV4cCI6MjA5MjQ1MDYzNn0.Vp6CfEi3dtUL1Z1h8kYkrCAXBMlBuSogocffaKE_9tw'
const MAX_CALLS = 30 // par partie, pour rester large dans le quota gratuit
const used = new Map()
let down = 0 // si la fonction ne répond pas, on arrête d'essayer quelques minutes

async function call(gameId, body) {
  const n = used.get(gameId) || 0
  if (n >= MAX_CALLS || Date.now() < down) return null
  used.set(gameId, n + 1)
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 6000)
  try {
    const r = await fetch(URL, { method: 'POST', signal: ctl.signal, headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!r.ok) { if (r.status >= 500) down = Date.now() + 3 * 60e3; return null }
    return await r.json()
  } catch { down = Date.now() + 60e3; return null } finally { clearTimeout(t) }
}

const side = (x) => [...x.props.map((k) => SQUARES[k].name), x.money ? fmt(x.money) : null, x.jailCards ? 'carte « libéré de prison »' : null].filter(Boolean).join(' + ') || 'rien'
export const describeTrade = (s, t) => {
  const A = s.players.find((p) => p.id === t.from)?.name, B = s.players.find((p) => p.id === t.to)?.name
  return `${A} donne ${side(t.give)} ; ${B} donne ${side(t.get)}`
}
function context(s, botId) {
  const lines = s.players.filter((p) => !p.bankrupt).map((p) => {
    const props = Object.keys(s.props).filter((k) => s.props[k].owner === p.id).map((k) => SQUARES[k].name + (s.props[k].houses ? ` (${s.props[k].houses === 5 ? 'hôtel' : s.props[k].houses + 'm'})` : ''))
    return `${p.name}${p.id === botId ? ' (toi)' : p.isBot ? ' (bot)' : ''} : ${fmt(p.money)} ; ${props.join(', ') || 'aucune propriété'}`
  })
  return `Tour ${s.round}${s.settings?.maxRounds ? '/' + s.settings.maxRounds : ''}. ` + lines.join(' | ')
}
const botInfo = (s, id) => ({ name: s.players.find((p) => p.id === id)?.name, persona: persona(id).label })

// Choisit parmi les échanges candidats et rédige le message d'accroche
export async function aiPickTrade(s, botId, cands) {
  const r = await call(s.id, {
    mode: 'pick', bot: botInfo(s, botId), context: context(s, botId),
    candidates: cands.map((c) => `Avec ${s.players.find((p) => p.id === c.t.to)?.name} : tu donnes ${side(c.t.give)}, tu reçois ${side(c.t.get)}${c.why?.completes ? ' (te complète le groupe)' : ''}`),
  })
  const i = Number.isInteger(r?.index) && r.index >= 0 && r.index < cands.length ? r.index : 0
  const fallback = cands[i].why?.completes
    ? `Je t’offre ${side(cands[i].t.give)} contre ${side(cands[i].t.get)}. Ça nous arrange tous les deux, non ?`
    : `Je t’offre ${side(cands[i].t.give)} contre ${side(cands[i].t.get)}, ça te tente ?`
  return { index: i, message: r?.message || fallback }
}

// Réplique d'un bot à un échange qu'on lui propose (décision déjà prise)
export async function aiReply(s, botId, trade, accept) {
  const r = await call(s.id, { mode: 'reply', bot: botInfo(s, botId), context: context(s, botId), trade: describeTrade(s, trade), verdict: accept ? 'accept' : 'reject' })
  return r?.message || (accept ? 'Marché conclu !' : 'Non merci, ça ne m’arrange pas. Ajoute un peu plus et on en reparle.')
}

// Réponse d'un bot qu'on interpelle dans le chat (@bot)
const FALLBACK = ['Hmm, on verra ça ! 😏', 'Joue ton tour au lieu de me parler 😄', 'Fais-moi une offre, je suis à l’écoute.', 'Je garde mes propriétés, désolé !', 'Tu crois que tu vas gagner ? On en reparle à la fin.']
export async function aiChat(s, botId, fromName, msg) {
  const r = await call(s.id, { mode: 'chat', bot: botInfo(s, botId), context: context(s, botId), from: fromName, message: msg })
  return r?.message || '@' + fromName + ' ' + FALLBACK[Math.floor(Math.random() * FALLBACK.length)]
}

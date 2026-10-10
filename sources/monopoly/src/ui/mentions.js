// @joueur et #case dans le chat : découpage du texte et suggestions
import { SQUARES } from '../game/data.js'

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export const PLACES = SQUARES.map((sq, i) => ({ i, name: sq.name, group: sq.group, type: sq.type }))
  .filter((p) => p.type !== 'chance' && p.type !== 'caisse')

// Découpe un message en morceaux texte / @joueur / #case (on prend le nom connu le plus long)
export function parseChat(text, players) {
  const names = players.map((p) => ({ kind: 'user', key: norm(p.name), p })).sort((a, b) => b.key.length - a.key.length)
  const places = PLACES.map((pl) => ({ kind: 'place', key: norm(pl.name), pl })).sort((a, b) => b.key.length - a.key.length)
  const out = []
  let buf = ''
  const n = norm(text)
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if ((c === '@' || c === '#') && (i === 0 || /\s|[(,.!?]/.test(text[i - 1]))) {
      const list = c === '@' ? names : places
      const hit = list.find((x) => n.startsWith(x.key, i + 1))
      if (hit) {
        if (buf) out.push({ type: 'text', value: buf }), (buf = '')
        out.push(hit.kind === 'user' ? { type: 'user', id: hit.p.id, value: '@' + hit.p.name } : { type: 'place', i: hit.pl.i, value: '#' + hit.pl.name })
        i += hit.key.length
        continue
      }
    }
    buf += c
  }
  if (buf) out.push({ type: 'text', value: buf })
  return out
}

export const mentionedIds = (text, players) => parseChat(text, players).filter((t) => t.type === 'user').map((t) => t.id)

// Suggestions pour le mot en cours de frappe (@xxx ou #xxx juste avant le curseur)
export function suggest(text, caret, players) {
  const before = text.slice(0, caret)
  const m = before.match(/(^|[\s(,.!?])([@#])([^@#]*)$/)
  if (!m) return null
  const trig = m[2], q = norm(m[3])
  if (q.length > 30) return null
  const start = before.length - m[3].length - 1
  const items = trig === '@'
    ? players.map((p) => ({ label: p.name, color: p.color, insert: '@' + p.name, sub: p.isBot ? 'bot' : '' }))
    : PLACES.map((pl) => ({ label: pl.name, group: pl.group, type: pl.type, insert: '#' + pl.name, sub: '' }))
  const f = items.filter((x) => norm(x.label).includes(q)).sort((a, b) => norm(a.label).indexOf(q) - norm(b.label).indexOf(q)).slice(0, 7)
  return f.length ? { trig, start, end: caret, items: f } : null
}

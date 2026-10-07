import { SQUARES, GROUPS } from '../game/data.js'

export const HALF = 6.1
export const CORNER = 1.6

// Centre (x,z) d'une case et angle de lecture
export function squareCenter(i) {
  const e = HALF - CORNER / 2 // 5.3
  if (i === 0) return [e, e]
  if (i < 10) return [5 - i, e]
  if (i === 10) return [-e, e]
  if (i < 20) return [-e, 5 - (i - 10)]
  if (i === 20) return [-e, -e]
  if (i < 30) return [-5 + (i - 20), -e]
  if (i === 30) return [e, -e]
  return [e, -5 + (i - 30)]
}
export const side = (i) => Math.floor(i / 10) // 0 bas, 1 gauche, 2 haut, 3 droite
export const sideAngle = (i) => [0, Math.PI / 2, Math.PI, -Math.PI / 2][side(i)]
// Direction vers l'intérieur du plateau
export function inward(i) {
  return [[0, -1], [1, 0], [0, 1], [-1, 0]][side(i)]
}
export const isCorner = (i) => i % 10 === 0

const ICON = { chance: '?', caisse: '💰', tax: '💎', station: '🚂', utility: '💡' }

export function drawBoard(S = 2048) {
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')
  const u = S / (HALF * 2)
  const toPx = (x) => (x + HALF) * u

  // fond
  g.fillStyle = '#cfe8d4'
  g.fillRect(0, 0, S, S)
  // centre
  const grd = g.createRadialGradient(S / 2, S / 2, 50, S / 2, S / 2, S * 0.42)
  grd.addColorStop(0, '#e6f4e8'); grd.addColorStop(1, '#c4e2ca')
  g.fillStyle = grd
  g.fillRect(CORNER * u, CORNER * u, S - 2 * CORNER * u, S - 2 * CORNER * u)

  g.save()
  g.translate(S / 2, S / 2)
  g.rotate(-Math.PI / 4)
  g.fillStyle = '#1b4d2b'
  const bw = S * 0.52, bh = S * 0.11
  g.fillRect(-bw / 2, -bh / 2, bw, bh)
  g.strokeStyle = '#fff'; g.lineWidth = 8
  g.strokeRect(-bw / 2 + 10, -bh / 2 + 10, bw - 20, bh - 20)
  g.fillStyle = '#fff'
  g.font = `900 ${S * 0.07}px "Arial Black", Arial, sans-serif`
  g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText('PARIS', 0, 4)
  g.fillStyle = '#1b4d2b'
  g.font = `700 ${S * 0.024}px Arial, sans-serif`
  g.fillText('ÉDITION PORTFOLIO · ALIX CORBIN', 0, bh * 0.95)
  g.restore()

  // cartes au centre
  const card = (x, y, rot, col, label) => {
    g.save(); g.translate(x, y); g.rotate(rot)
    g.fillStyle = col; g.strokeStyle = '#333'; g.lineWidth = 4
    g.fillRect(-170, -105, 340, 210); g.strokeRect(-170, -105, 340, 210)
    g.fillStyle = '#222'; g.font = `700 40px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'
    g.fillText(label, 0, 0)
    g.restore()
  }
  card(S * 0.33, S * 0.33, -Math.PI / 4, '#f9a8c8', '?  CHANCE')
  card(S * 0.67, S * 0.67, -Math.PI / 4 + Math.PI, '#a8d8f9', 'CAISSE')

  g.strokeStyle = '#1d2b20'
  g.lineWidth = 3
  SQUARES.forEach((sq, i) => {
    const [x, z] = squareCenter(i)
    g.save()
    g.translate(toPx(x), toPx(z))
    if (isCorner(i)) {
      g.rotate(sideAngle(i) + Math.PI / 4)
      g.fillStyle = '#1d2b20'
      g.textAlign = 'center'; g.textBaseline = 'middle'
      const lines = {
        go: ['DÉPART', '→ +200 €'], jail: ['PRISON', 'simple visite'],
        parking: ['PARC', 'GRATUIT'], gotojail: ['ALLEZ EN', 'PRISON'],
      }[sq.type]
      const icons = { go: '⬅', jail: '🔒', parking: '🚗', gotojail: '👮' }
      g.font = `900 ${u * 0.28}px Arial`
      g.fillText(lines[0], 0, -u * 0.28)
      g.font = `700 ${u * 0.17}px Arial`
      g.fillText(lines[1], 0, u * 0.02)
      g.font = `${u * 0.42}px "Segoe UI Emoji", "Noto Color Emoji", sans-serif`
      g.fillText(icons[sq.type], 0, u * 0.42)
      g.restore()
      return
    }
    g.rotate(sideAngle(i))
    const w = u, h = CORNER * u
    g.fillStyle = '#f4f8ef'
    g.fillRect(-w / 2, -h / 2, w, h)
    g.strokeRect(-w / 2, -h / 2, w, h)
    let y0 = -h / 2 + 8
    if (sq.group) {
      g.fillStyle = GROUPS[sq.group].color
      g.fillRect(-w / 2, -h / 2, w, h * 0.24)
      g.strokeRect(-w / 2, -h / 2, w, h * 0.24)
      y0 = -h / 2 + h * 0.24 + 8
    }
    g.fillStyle = '#1d2b20'
    g.textAlign = 'center'; g.textBaseline = 'top'
    g.font = `700 ${u * 0.13}px Arial`
    wrap(g, sq.name.toUpperCase(), w - 12).forEach((l, k) => g.fillText(l, 0, y0 + k * u * 0.15))
    if (ICON[sq.type]) {
      g.textBaseline = 'middle'
      g.font = `${sq.type === 'chance' ? '900 ' : ''}${u * 0.4}px "Segoe UI Emoji", "Noto Color Emoji", Arial`
      g.fillStyle = sq.type === 'chance' ? '#d63c95' : '#1d2b20'
      g.fillText(ICON[sq.type], 0, h * 0.12)
    }
    g.textBaseline = 'bottom'
    g.fillStyle = '#1d2b20'
    g.font = `600 ${u * 0.13}px Arial`
    const price = sq.price ? `${sq.price} €` : sq.amount ? `Payez ${sq.amount} €` : ''
    g.fillText(price, 0, h / 2 - 8)
    g.restore()
  })
  g.lineWidth = 6
  g.strokeRect(CORNER * u, CORNER * u, S - 2 * CORNER * u, S - 2 * CORNER * u)
  g.strokeRect(3, 3, S - 6, S - 6)
  return c
}

function wrap(g, text, max) {
  const words = text.split(' ')
  const lines = []
  let line = ''
  for (const w of words) {
    const t = line ? line + ' ' + w : w
    if (g.measureText(t).width > max && line) { lines.push(line); line = w } else line = t
  }
  if (line) lines.push(line)
  return lines
}

// Thèmes d'ambiance (arrière-plan, table, lumières) — choix mémorisé localement
import { useEffect, useState } from 'react'

export const THEMES = {
  salon: { label: 'Salon', icon: '🛋️', bg: '#0b1d14', fog: '#0b1d14', floor: '#3a2618', rough: 0.9, sun: '#ffffff', sunI: 1.6, amb: 0.45, sky: '#fff8e8', ground: '#2b1a10' },
  casino: { label: 'Casino', icon: '🎰', bg: '#1a0608', fog: '#1a0608', floor: '#0c4a2c', rough: 1, sun: '#ffe2b0', sunI: 1.5, amb: 0.4, sky: '#ffd9a0', ground: '#3a0d10', particles: '#e8c468' },
  nuit: { label: 'Nuit', icon: '🌙', bg: '#060a1c', fog: '#060a1c', floor: '#141a33', rough: 0.7, sun: '#9fb6ff', sunI: 1.1, amb: 0.3, sky: '#7f95ff', ground: '#0a0d20', stars: true },
  plage: { label: 'Plage', icon: '🏖️', bg: '#7cc6f2', fog: '#a9dcf7', floor: '#e8d29a', rough: 1, sun: '#fff6dc', sunI: 1.9, amb: 0.55, sky: '#bfe7ff', ground: '#d9c08a' },
  neige: { label: 'Neige', icon: '❄️', bg: '#c9d6e3', fog: '#dfe8f1', floor: '#f2f6fb', rough: 0.8, sun: '#ffffff', sunI: 1.4, amb: 0.6, sky: '#eef4ff', ground: '#c0cfe0', snow: true },
  espace: { label: 'Espace', icon: '🚀', bg: '#000004', fog: '#000004', floor: '#16112a', rough: 0.4, sun: '#d8c6ff', sunI: 1.3, amb: 0.3, sky: '#8a6cff', ground: '#05030c', stars: true, floorGlow: '#5b3cff' },
}
const KEY = 'mono-theme'
const listeners = new Set()
let current = (() => { try { const t = localStorage.getItem(KEY); return THEMES[t] ? t : 'salon' } catch { return 'salon' } })()
export const getTheme = () => current
export function setTheme(t) {
  if (!THEMES[t]) return
  current = t
  try { localStorage.setItem(KEY, t) } catch {}
  listeners.forEach((f) => f(t))
}
export function useTheme() {
  const [t, setT] = useState(current)
  useEffect(() => { listeners.add(setT); return () => listeners.delete(setT) }, [])
  return THEMES[t] ? { id: t, ...THEMES[t] } : { id: 'salon', ...THEMES.salon }
}

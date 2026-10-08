import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// Dimensions d'une carte (unités monde) et emplacements des pioches
const W = 2.0, D = 1.25, T = 0.012
const DECKS = {
  chance: { pos: [-2.07, 0, -2.07], rot: Math.PI / 4, color: '#f7a8c8', ink: '#b01e66', label: 'CHANCE', icon: '?' },
  caisse: { pos: [2.07, 0, 2.07], rot: Math.PI / 4 + Math.PI, color: '#a8d4f7', ink: '#1a5c96', label: 'CAISSE DE COMMUNAUTÉ', icon: '💰' },
}
const BASE_Y = 0.105
const COUNT = 14

function canvasTex(draw, w = 1024, h = 640) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath()
}

function backTex(d) {
  return canvasTex((g, w, h) => {
    g.fillStyle = d.color; g.fillRect(0, 0, w, h)
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 14; roundRect(g, 26, 26, w - 52, h - 52, 30); g.stroke()
    g.strokeStyle = d.ink; g.lineWidth = 4; roundRect(g, 48, 48, w - 96, h - 96, 22); g.stroke()
    g.fillStyle = d.ink; g.textAlign = 'center'; g.textBaseline = 'middle'
    g.font = `${d.icon === '?' ? '900 ' : ''}230px "Arial Black", "Segoe UI Emoji", "Noto Color Emoji", Arial`
    g.fillText(d.icon, w / 2, h / 2 - 40)
    g.font = `900 ${d.label.length > 10 ? 58 : 84}px "Arial Black", Arial`
    g.fillText(d.label, w / 2, h - 120)
  })
}

function wrap(g, text, max) {
  const out = []; let line = ''
  for (const word of text.split(' ')) {
    const t = line ? line + ' ' + word : word
    if (g.measureText(t).width > max && line) { out.push(line); line = word } else line = t
  }
  if (line) out.push(line)
  return out
}

function faceTex(d, text, who) {
  return canvasTex((g, w, h) => {
    g.fillStyle = '#fffdf6'; g.fillRect(0, 0, w, h)
    g.fillStyle = d.color; g.fillRect(0, 0, w, 120)
    g.strokeStyle = d.ink; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10)
    g.fillStyle = d.ink; g.textAlign = 'center'; g.textBaseline = 'middle'
    g.font = '900 64px "Arial Black", Arial'
    g.fillText(d.icon === '?' ? '? CHANCE' : d.label, w / 2, 64)
    g.fillStyle = '#1b1b1b'
    let size = 54
    let lines
    do { g.font = `700 ${size}px Arial`; lines = wrap(g, text, w - 140); size -= 4 } while (lines.length * size * 1.3 > h - 250 && size > 30)
    const lh = (size + 4) * 1.28
    const y0 = 120 + (h - 120 - 70) / 2 - ((lines.length - 1) * lh) / 2
    lines.forEach((l, i) => g.fillText(l, w / 2, y0 + i * lh))
    if (who) { g.font = 'italic 600 34px Arial'; g.fillStyle = '#6b6b6b'; g.fillText(who, w / 2, h - 52) }
  })
}

function Deck({ d, back, side }) {
  return (
    <group position={d.pos} rotation-y={d.rot}>
      {Array.from({ length: COUNT }).map((_, i) => (
        <mesh key={i} castShadow receiveShadow position={[(Math.sin(i * 7.3) * 0.02), BASE_Y + T / 2 + i * T, Math.cos(i * 3.1) * 0.02]} rotation-y={Math.sin(i * 1.7) * 0.03}
          material={i === COUNT - 1 ? [side, side, back, side, side, side] : side}>
          <boxGeometry args={[W, T, D]} />
        </mesh>
      ))}
    </group>
  )
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const TIMES = { lift: 0.35, fly: 0.75, hold: 2.6, back: 0.7 }

export default function Cards3D({ card }) {
  const { camera, size } = useThree()
  const side = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f4f1e6', roughness: 0.8 }), [])
  const backs = useMemo(() => ({ chance: backTex(DECKS.chance), caisse: backTex(DECKS.caisse) }), [])
  const backMats = useMemo(() => ({
    chance: new THREE.MeshStandardMaterial({ map: backs.chance, roughness: 0.6 }),
    caisse: new THREE.MeshStandardMaterial({ map: backs.caisse, roughness: 0.6 }),
  }), [backs])
  const fly = useRef()
  const anim = useRef(null)
  const faceMat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), [])
  const flyMats = useMemo(() => [side, side, backMats.chance, faceMat, side, side], [side, backMats, faceMat])
  const last = useRef(card?.rev)

  useEffect(() => {
    if (!card || card.rev === last.current) return
    last.current = card.rev
    const d = DECKS[card.deck]
    faceMat.map?.dispose()
    faceMat.map = faceTex(d, card.text, card.who)
    faceMat.needsUpdate = true
    flyMats[2] = backMats[card.deck]
    fly.current.material = [...flyMats]
    anim.current = { t: 0, start: performance.now(), d }
  }, [card?.rev])

  const tmp = useMemo(() => ({ q0: new THREE.Quaternion(), q1: new THREE.Quaternion(), p0: new THREE.Vector3(), p1: new THREE.Vector3(), fwd: new THREE.Vector3(), rx: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2) }), [])

  useFrame((_, dt) => {
    const m = fly.current
    const a = anim.current
    if (!a) { m.visible = false; return }
    m.visible = true
    a.t = (performance.now() - a.start) / 1000
    const { d } = a
    const top = BASE_Y + T * COUNT + T / 2
    tmp.p0.set(d.pos[0], top, d.pos[2])
    tmp.q0.setFromAxisAngle(new THREE.Vector3(0, 1, 0), d.rot)
    // position face caméra : la carte remplit ~45 % de la largeur
    const fov = (camera.fov * Math.PI) / 180
    const aspect = size.width / size.height
    const dist = Math.max(1.6, W / (2 * Math.tan(fov / 2) * aspect * (aspect < 1 ? 0.8 : 0.34)))
    camera.getWorldDirection(tmp.fwd)
    tmp.p1.copy(camera.position).addScaledVector(tmp.fwd, dist)
    tmp.q1.copy(camera.quaternion).multiply(tmp.rx)

    const { lift, fly: fl, hold, back } = TIMES
    let t = a.t
    if (t < lift) {
      const k = ease(t / lift)
      m.position.copy(tmp.p0).add(new THREE.Vector3(0, k * 0.5, 0))
      m.quaternion.copy(tmp.q0)
    } else if ((t -= lift) < fl) {
      const k = ease(t / fl)
      const start = tmp.p0.clone().add(new THREE.Vector3(0, 0.5, 0))
      m.position.lerpVectors(start, tmp.p1, k)
      m.position.y += Math.sin(Math.PI * k) * 0.8
      m.quaternion.slerpQuaternions(tmp.q0, tmp.q1, k)
    } else if ((t -= fl) < hold) {
      m.position.copy(tmp.p1)
      m.position.y += Math.sin(a.t * 2) * 0.01
      m.quaternion.copy(tmp.q1)
    } else if ((t -= hold) < back) {
      const k = ease(t / back)
      const end = tmp.p0.clone(); end.y = BASE_Y + T / 2 - T
      m.position.lerpVectors(tmp.p1, end, k)
      m.position.y += Math.sin(Math.PI * k) * 0.6
      m.quaternion.slerpQuaternions(tmp.q1, tmp.q0, k)
      m.scale.setScalar(1 - k * 0.15)
    } else {
      anim.current = null
      m.visible = false
      m.scale.setScalar(1)
    }
  })

  // clic sur la carte en vol : on écourte l'affichage
  const skip = (e) => {
    e.stopPropagation()
    const a = anim.current
    if (a && a.t < TIMES.lift + TIMES.fly + TIMES.hold) a.start = performance.now() - (TIMES.lift + TIMES.fly + TIMES.hold) * 1000
  }

  return (
    <group>
      <Deck d={DECKS.chance} back={backMats.chance} side={side} />
      <Deck d={DECKS.caisse} back={backMats.caisse} side={side} />
      <mesh ref={fly} visible={false} material={flyMats} onClick={skip} renderOrder={10}>
        <boxGeometry args={[W, T, D]} />
      </mesh>
    </group>
  )
}

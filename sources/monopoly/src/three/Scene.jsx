import { useMemo, useRef, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, ContactShadows, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { SQUARES } from '../game/data.js'
import { drawBoard, squareCenter, inward, isCorner, CORNER, HALF } from './layout.js'

const Y = 0.12 // hauteur de la surface du plateau

function Board({ onPick, selected }) {
  const tex = useMemo(() => {
    const t = new THREE.CanvasTexture(drawBoard(2048))
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [])
  return (
    <group>
      <RoundedBox args={[HALF * 2 + 0.5, 0.2, HALF * 2 + 0.5]} radius={0.08} position={[0, 0, 0]} receiveShadow castShadow>
        <meshStandardMaterial color="#0f2f1d" roughness={0.6} />
      </RoundedBox>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.101, 0]} receiveShadow>
        <planeGeometry args={[HALF * 2, HALF * 2]} />
        <meshStandardMaterial map={tex} roughness={0.75} />
      </mesh>
      {SQUARES.map((_, i) => {
        const [x, z] = squareCenter(i)
        const c = isCorner(i)
        const horiz = Math.floor(i / 10) % 2 === 0
        const w = c ? CORNER : horiz ? 1 : CORNER
        const d = c ? CORNER : horiz ? CORNER : 1
        return (
          <mesh key={i} position={[x, 0.105, z]} rotation-x={-Math.PI / 2}
            onClick={(e) => { e.stopPropagation(); onPick(i) }}
            onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer' }}
            onPointerOut={() => (document.body.style.cursor = '')}>
            <planeGeometry args={[w * 0.98, d * 0.98]} />
            <meshBasicMaterial color="#ffe44d" transparent opacity={selected === i ? 0.35 : 0} depthWrite={false} />
          </mesh>
        )
      })}
    </group>
  )
}

function House({ position, hotel }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, hotel ? 0.09 : 0.06, 0]}>
        <boxGeometry args={hotel ? [0.34, 0.18, 0.2] : [0.15, 0.12, 0.15]} />
        <meshStandardMaterial color={hotel ? '#d32f2f' : '#2e9e4f'} roughness={0.4} />
      </mesh>
      <mesh castShadow position={[0, hotel ? 0.24 : 0.17, 0]} rotation-y={Math.PI / 4}>
        <coneGeometry args={[hotel ? 0.24 : 0.12, 0.11, 4]} />
        <meshStandardMaterial color={hotel ? '#b71c1c' : '#1f7a3a'} roughness={0.4} />
      </mesh>
    </group>
  )
}

function Ownership({ game }) {
  const items = []
  for (const [k, pr] of Object.entries(game.props || {})) {
    const i = +k
    const [x, z] = squareCenter(i)
    const [ix, iz] = inward(i)
    const owner = game.players.find((p) => p.id === pr.owner)
    const horiz = Math.floor(i / 10) % 2 === 0
    // bande de couleur du propriétaire côté extérieur
    items.push(
      <mesh key={'o' + i} position={[x - ix * 0.72, Y - 0.005, z - iz * 0.72]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={horiz ? [0.9, 0.12] : [0.12, 0.9]} />
        <meshStandardMaterial color={owner?.color || '#999'} emissive={owner?.color || '#999'} emissiveIntensity={0.35} />
      </mesh>,
    )
    if (pr.mortgaged)
      items.push(
        <mesh key={'m' + i} position={[x, Y - 0.004, z]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={horiz ? [0.96, 1.56] : [1.56, 0.96]} />
          <meshBasicMaterial color="#000" transparent opacity={0.45} depthWrite={false} />
        </mesh>,
      )
    if (pr.houses) {
      const bx = x + ix * 0.6, bz = z + iz * 0.6
      const px = iz, pz = ix // axe perpendiculaire
      if (pr.houses === 5) items.push(<House key={'h' + i} hotel position={[bx, Y - 0.01, bz]} />)
      else
        for (let h = 0; h < pr.houses; h++) {
          const off = (h - (pr.houses - 1) / 2) * 0.22
          items.push(<House key={'h' + i + h} position={[bx + px * off, Y - 0.01, bz + pz * off]} />)
        }
    }
  }
  return <group>{items}</group>
}

function PawnShape({ type, color }) {
  const mat = <meshStandardMaterial color={color} metalness={0.55} roughness={0.25} />
  switch (type) {
    case 'chapeau':
      return (<group>
        <mesh castShadow position={[0, 0.03, 0]}><cylinderGeometry args={[0.2, 0.2, 0.04, 24]} />{mat}</mesh>
        <mesh castShadow position={[0, 0.17, 0]}><cylinderGeometry args={[0.12, 0.12, 0.26, 24]} />{mat}</mesh>
      </group>)
    case 'cone':
      return <mesh castShadow position={[0, 0.2, 0]}><coneGeometry args={[0.15, 0.4, 24]} />{mat}</mesh>
    case 'diamant':
      return <mesh castShadow position={[0, 0.2, 0]} scale={[1, 1.4, 1]}><octahedronGeometry args={[0.15]} />{mat}</mesh>
    case 'cube':
      return <mesh castShadow position={[0, 0.13, 0]}><boxGeometry args={[0.24, 0.24, 0.24]} />{mat}</mesh>
    case 'anneau':
      return <mesh castShadow position={[0, 0.17, 0]}><torusGeometry args={[0.13, 0.05, 12, 28]} />{mat}</mesh>
    default:
      return <mesh castShadow position={[0, 0.17, 0]}><dodecahedronGeometry args={[0.16]} />{mat}</mesh>
  }
}

function Pawn({ player, offset, active }) {
  const ref = useRef()
  const st = useRef({ from: player.pos, cur: player.pos, t: 1, direct: false, target: player.pos })
  useEffect(() => {
    const s = st.current
    if (s.target === player.pos) return
    s.target = player.pos
  }, [player.pos])
  useFrame((_, dt) => {
    const s = st.current
    if (s.t >= 1 && s.cur !== s.target) {
      const fwd = (s.target - s.cur + 40) % 40
      s.from = s.cur
      s.direct = fwd > 12 || fwd === 0
      s.cur = s.direct ? s.target : (s.cur + 1) % 40
      s.t = 0
    }
    if (s.t < 1) s.t = Math.min(1, s.t + dt * (s.direct ? 1.4 : 6.5))
    const [ax, az] = squareCenter(s.from)
    const [bx, bz] = squareCenter(s.cur)
    const e = s.t < 0.5 ? 2 * s.t * s.t : 1 - (-2 * s.t + 2) ** 2 / 2
    const hop = Math.sin(Math.PI * s.t) * (s.direct ? 1.2 : 0.35)
    const jail = player.inJail && s.cur === 10 && s.t >= 1 ? [0.25, -0.25] : [0, 0]
    ref.current.position.set(
      ax + (bx - ax) * e + offset[0] + jail[0],
      Y + hop + (active ? Math.sin(performance.now() / 300) * 0.04 + 0.04 : 0),
      az + (bz - az) * e + offset[1] + jail[1],
    )
    ref.current.rotation.y += active ? dt * 1.2 : 0
  })
  return (
    <group ref={ref}>
      <PawnShape type={player.pawn} color={player.color} />
      {active && (
        <mesh position={[0, 0.005, 0]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[0.22, 0.27, 32]} />
          <meshBasicMaterial color={player.color} transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  )
}

// ----- Dés -----
const PIPS = { 1: [[0.5, 0.5]], 2: [[0.25, 0.25], [0.75, 0.75]], 3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]], 4: [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]], 5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]], 6: [[0.25, 0.22], [0.75, 0.22], [0.25, 0.5], [0.75, 0.5], [0.25, 0.78], [0.75, 0.78]] }
function faceTex(n) {
  const c = document.createElement('canvas'); c.width = c.height = 128
  const g = c.getContext('2d')
  g.fillStyle = '#fbfbf6'; g.fillRect(0, 0, 128, 128)
  g.fillStyle = n === 1 ? '#c8102e' : '#151515'
  PIPS[n].forEach(([x, y]) => { g.beginPath(); g.arc(x * 128, y * 128, n === 1 ? 16 : 12, 0, Math.PI * 2); g.fill() })
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}
// ordre des faces BoxGeometry : +x,-x,+y,-y,+z,-z
const FACE_VALUES = [3, 4, 1, 6, 2, 5]
const ROT = { 1: [0, 0, 0], 6: [Math.PI, 0, 0], 2: [-Math.PI / 2, 0, 0], 5: [Math.PI / 2, 0, 0], 3: [0, 0, Math.PI / 2], 4: [0, 0, -Math.PI / 2] }

function Die({ value, rev, home, delay }) {
  const outer = useRef(), inner = useRef()
  const mats = useMemo(() => FACE_VALUES.map((v) => new THREE.MeshStandardMaterial({ map: faceTex(v), roughness: 0.35 })), [])
  const anim = useRef({ t: 1, spin: [0, 0, 0], yaw: 0 })
  useEffect(() => {
    if (!rev) return
    anim.current = { t: -delay, spin: [Math.random() * 12 + 6, Math.random() * 12 + 6, Math.random() * 6], yaw: Math.random() * Math.PI * 2 }
  }, [rev, delay])
  useFrame((_, dt) => {
    const a = anim.current
    const target = ROT[value]
    if (a.t < 1) a.t += dt * 1.1
    const t = Math.max(0, Math.min(1, a.t))
    const k = 1 - t
    inner.current.rotation.set(target[0] + a.spin[0] * k * k, target[1] + a.spin[1] * k * k, target[2] + a.spin[2] * k * k)
    const bounce = Math.abs(Math.sin(t * Math.PI * 3)) * k * 1.6
    outer.current.position.set(home[0] - k * 2.2, 0.25 + 0.2 + bounce, home[1] + k * 1.5)
    outer.current.rotation.y = a.yaw * k
  })
  return (
    <group ref={outer}>
      <mesh ref={inner} castShadow material={mats}>
        <boxGeometry args={[0.45, 0.45, 0.45]} />
      </mesh>
    </group>
  )
}

function FitCamera() {
  const { camera, size } = useThree()
  useEffect(() => {
    const a = size.width / size.height
    const k = a < 1 ? 1.1 / a : 1
    camera.position.set(0, 13 * k, (a < 1 ? 8 : 11) * k)
  }, [size.width > size.height])
  return null
}

export default function Scene({ game, selected, onPick, myId }) {
  const players = game.players.filter((p) => !p.bankrupt)
  const offsets = useMemo(() => {
    const by = {}
    players.forEach((p) => (by[p.pos] = [...(by[p.pos] || []), p.id]))
    const o = {}
    Object.values(by).forEach((ids) => ids.forEach((id, k) => {
      if (ids.length === 1) return (o[id] = [0, 0])
      const a = (k / ids.length) * Math.PI * 2
      o[id] = [Math.cos(a) * 0.25, Math.sin(a) * 0.25]
    }))
    return o
  }, [players.map((p) => p.id + p.pos).join()])
  const current = game.players[game.turn]?.id
  return (
    <Canvas shadows={{ type: THREE.PCFShadowMap }} dpr={[1, 2]} camera={{ position: [0, 13, 11], fov: 45 }}>
      <color attach="background" args={['#0b1d14']} />
      <fog attach="fog" args={['#0b1d14', 50, 90]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[6, 14, 8]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={9} shadow-camera-bottom={-9} />
      <hemisphereLight args={["#fff8e8", "#2b1a10", 0.6]} />
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.11, 0]} receiveShadow>
        <circleGeometry args={[30, 64]} />
        <meshStandardMaterial color="#3a2618" roughness={0.9} />
      </mesh>
      <FitCamera />
      <Board onPick={onPick} selected={selected} />
      <Ownership game={game} />
      {players.map((p) => (
        <Pawn key={p.id} player={p} offset={offsets[p.id] || [0, 0]} active={p.id === current} />
      ))}
      <Die value={game.dice[0]} rev={game.diceRev} home={[1.6, -2.4]} delay={0} />
      <Die value={game.dice[1]} rev={game.diceRev} home={[2.5, -2.0]} delay={0.08} />
      <ContactShadows position={[0, 0.106, 0]} opacity={0.35} scale={13} blur={2} far={2} />
      <OrbitControls makeDefault target={[0, 0, 0.5]} maxPolarAngle={1.25} minDistance={6} maxDistance={45} enablePan={false} />
    </Canvas>
  )
}

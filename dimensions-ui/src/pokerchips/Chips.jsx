import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { CHIP, DENOMINATIONS, chipGeometry, faceBump, faceTexture, sideTexture } from './chip.js'

// A row of chips, one stack per denomination from $1 to $1,000, each with a
// loose chip lying face up in front of it. Stacks are a little untidy, as
// real ones are. Click a stack to flick its top chip into the air: it turns
// over and drops back on the stack.

export const SPACING = 0.056
export const HEIGHTS = [16, 14, 12, 11, 9, 7, 5]
export const stackX = (i) => (i - (DENOMINATIONS.length - 1) / 2) * SPACING

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function Chip({ geo, mats, position, rotation }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={geo.rim} material={mats.side} castShadow receiveShadow />
      <mesh geometry={geo.topCap} material={mats.face} castShadow receiveShadow />
      <mesh geometry={geo.bottomCap} material={mats.face} receiveShadow />
    </group>
  )
}

function Stack({ x, count, geo, mats, seed }) {
  const invalidate = useThree((s) => s.invalidate)
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const r = useMemo(() => rng(seed), [seed])
  const chips = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        p: [(r() - 0.5) * 0.0007, CHIP.h * (i + 0.5) + 0.00001 * i, (r() - 0.5) * 0.0007],
        yaw: r() * Math.PI * 2,
      })),
    [count, r],
  )
  // the flicked top chip
  const top = useRef()
  const toss = useRef(null)
  const flips = useRef(0)
  const flick = () => {
    if (toss.current) return
    toss.current = { t: 0, spin: Math.PI * (1 + 2 * Math.floor(Math.random() * 3)) }
    invalidate()
  }
  useFrame((_, delta) => {
    const a = toss.current
    if (!a) return
    a.t = Math.min(1, a.t + Math.min(delta, 1 / 30) / 0.75)
    const t = a.t
    const c = chips[count - 1]
    const g = top.current
    g.position.set(c.p[0], c.p[1] + Math.sin(Math.PI * t) * 0.09, c.p[2])
    g.rotation.set(flips.current * Math.PI + a.spin * t, c.yaw + t * 1.3, 0)
    if (t >= 1) {
      flips.current += a.spin / Math.PI
      toss.current = null
    }
    invalidate()
  })
  const last = chips[count - 1]
  return (
    <group
      position-x={x}
      onClick={(e) => (e.stopPropagation(), flick())}
      onPointerOver={(e) => (e.stopPropagation(), setHover(true))}
      onPointerOut={() => setHover(false)}
    >
      {chips.slice(0, -1).map((c, i) => (
        <Chip key={i} geo={geo} mats={mats} position={c.p} rotation={[0, c.yaw, 0]} />
      ))}
      <group ref={top} position={last.p} rotation={[0, last.yaw, 0]}>
        <Chip geo={geo} mats={mats} position={[0, 0, 0]} rotation={[0, 0, 0]} />
      </group>
    </group>
  )
}

export default function Chips({ showValue = true, stacks = true }) {
  const geo = useMemo(() => chipGeometry(), [])
  const bump = useMemo(() => faceBump(), [])
  const mats = useMemo(
    () =>
      DENOMINATIONS.map((d) => ({
        // compression-moulded clay: matte, with a soft sheen at grazing angles
        face: new THREE.MeshPhysicalMaterial({ map: faceTexture(d, showValue), bumpMap: bump, bumpScale: 0.00004, roughness: 0.66, sheen: 0.35, sheenRoughness: 0.6, sheenColor: new THREE.Color('#ffffff') }),
        side: new THREE.MeshPhysicalMaterial({ map: sideTexture(d), roughness: 0.62, sheen: 0.3, sheenRoughness: 0.6, side: THREE.DoubleSide }),
      })),
    [bump, showValue],
  )
  useEffect(() => () => mats.forEach((m) => (m.face.map.dispose(), m.side.map.dispose(), m.face.dispose(), m.side.dispose())), [mats])
  useEffect(() => () => (Object.values(geo).forEach((g) => g.dispose()), bump.dispose()), [geo, bump])

  return (
    <group>
      {DENOMINATIONS.map((d, i) => (
        <group key={d.value}>
          {stacks && <Stack x={stackX(i)} count={HEIGHTS[i]} geo={geo} mats={mats[i]} seed={i * 97 + 11} />}
          {/* a loose chip in front, face up */}
          <Chip geo={geo} mats={mats[i]} position={[stackX(i), CHIP.h / 2, stacks ? 0.05 : 0]} rotation={[0, i * 0.7, 0]} />
        </group>
      ))}
    </group>
  )
}

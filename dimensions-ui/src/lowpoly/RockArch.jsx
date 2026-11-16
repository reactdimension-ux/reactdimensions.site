import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Stage, TAU, blob, facet, rng, useGeo, useTap } from './kit.jsx'

// A low-poly desert rock arch: two columns of stacked boulders bridged by a
// bent slab, on a round patch of sand with a saguaro, a barrel cactus and a
// few stones. Left alone, the sun swings slowly over the arch from front to
// back and the arch's shadow sweeps across the sand beneath it. Tap it and a
// tumbleweed bounces through the gap between the columns, kicking up little
// puffs of dust where it lands.

const LOOKS = {
  sandstone: { rock: ['#d9a66b', '#c98f58', '#e2b47c'], span: '#d29c62', sand: '#eccb90', shade: '#c49866', cactus: ['#5f9a4e', '#4f8742'], flower: '#f07aa0', weed: ['#b08d57', '#9a7745'], dust: '#e8d2a4', sun: '#ffe2b0' },
  red: { rock: ['#c4583a', '#b14a30', '#d26a45'], span: '#bf5537', sand: '#eaa978', shade: '#b86e48', cactus: ['#5c9450', '#4c8244'], flower: '#ffd36a', weed: ['#a88352', '#8f6c40'], dust: '#e8b48a', sun: '#ffd2a0' },
  dusk: { rock: ['#b0687a', '#9a5a72', '#c27a82'], span: '#a8627a', sand: '#e6b49c', shade: '#a87478', cactus: ['#4f7f5a', '#41704d'], flower: '#ffb35a', weed: ['#9a7652', '#836245'], dust: '#e7c0aa', sun: '#ff9f72' },
}

const SAND_Y = 0.08
const COL_X = 0.6
const SPAN_Y = 1.3
const ROLL = 2.7 // seconds the tumbleweed takes to cross
const HOP = 0.45 // seconds between its bounces
const R = 0.15 // its radius

// The arch: for each column, its boulders as [y, sx, sy, sz, yaw].
const COLUMNS = [
  [
    [0.27, 0.36, 0.28, 0.32, 0.2],
    [0.7, 0.3, 0.22, 0.28, 1.1],
    [1.06, 0.27, 0.2, 0.26, 2.3],
  ],
  [
    [0.25, 0.34, 0.26, 0.31, 0.9],
    [0.66, 0.31, 0.23, 0.27, 2.0],
    [1.04, 0.26, 0.21, 0.25, 0.4],
  ],
]

function roundedRect(w, h, r) {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + h - r)
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  s.lineTo(x + r, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  return new THREE.ShapeGeometry(s, 3).rotateX(-Math.PI / 2)
}

// The span: a long box bowed up in the middle, its underside bowed more.
function spanGeometry() {
  const g = new THREE.BoxGeometry(1.85, 0.3, 0.5, 10, 2, 2)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const y = p.getY(i)
    const u = 1 - (x / 0.925) ** 2
    p.setY(i, y + 0.1 * u + (y < 0 ? 0.08 * u : 0))
  }
  return facet(g, 0.035, 12)
}

// Where the tumbleweed is s seconds after the tap.
const weedAt = (s, out) => {
  const z = -2.3 + (4.6 * s) / ROLL
  const hop = Math.abs(Math.sin((s / HOP) * Math.PI))
  return out.set(Math.sin(s * 2) * 0.06, SAND_Y + R + hop * 0.2 * (0.7 + 0.3 * Math.cos(s)), z)
}

export function RockArch({ look = 'sandstone' }) {
  const L = LOOKS[look] || LOOKS.sandstone
  const { tap, handlers, clock } = useTap(1.5)
  const sun = useRef()
  const colShadows = useRef([])
  const spanShadow = useRef()
  const weed = useRef()
  const puffs = useRef([])
  const v = useMemo(() => new THREE.Vector3(), [])
  const onClick = (e) => {
    if (tap.since(clock.elapsedTime) < ROLL + 0.6) return e.stopPropagation()
    handlers.onClick(e)
  }

  const geo = useGeo(
    () => ({
      rock: [blob(1, 31), blob(1, 32), blob(1, 33)],
      span: spanGeometry(),
      sand: facet(new THREE.CylinderGeometry(1.6, 1.72, SAND_Y, 16, 1).translate(0, SAND_Y / 2, 0), 0.06, 4, [1, 0, 1]),
      oval: new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2),
      band: roundedRect(1.85, 0.46, 0.18),
      stem: facet(new THREE.CylinderGeometry(1, 1, 1, 8, 1).translate(0, 0.5, 0), 0.04, 6),
      cap: facet(new THREE.SphereGeometry(1, 8, 3, 0, TAU, 0, Math.PI / 2), 0.04, 7),
      barrel: facet(new THREE.SphereGeometry(1, 9, 5), 0.05, 8),
      petal: new THREE.ConeGeometry(1, 1, 5, 1).translate(0, 0.5, 0),
      stone: blob(1, 9, 0),
      ring: new THREE.TorusGeometry(R, 0.013, 3, 9),
      puff: new THREE.IcosahedronGeometry(1, 0),
    }),
    [],
  )

  const weedRings = useMemo(() => {
    const r = rng(17)
    return Array.from({ length: 7 }, () => [r() * TAU, r() * TAU, r() * TAU, 0.75 + r() * 0.3])
  }, [])
  const stones = useMemo(() => {
    const r = rng(3)
    return Array.from({ length: 6 }, () => {
      const a = r() * TAU
      const d = 1.05 + r() * 0.4
      return [Math.cos(a) * d, Math.sin(a) * d, 0.05 + r() * 0.06]
    })
  }, [])
  const dust = useMemo(() => {
    const r = rng(8)
    const hops = Math.floor(ROLL / HOP)
    return Array.from({ length: hops * 3 }, (_, i) => ({ hop: 1 + Math.floor(i / 3), dx: (r() - 0.5) * 0.3, dz: (r() - 0.5) * 0.2, s: 0.7 + r() * 0.5 }))
  }, [])

  useFrame(() => {
    const t = clock.elapsedTime
    // the sun swings over the arch from front to back and back again
    const e = Math.PI / 2 + 0.75 * Math.sin(t * 0.38)
    const reach = 1 / Math.tan(e) // shadow length per unit height, signed along z
    const ox = 0.22 * Math.abs(reach) + 0.05
    const oz = reach
    sun.current.position.set(-ox * 4, 4, -oz * 4)
    colShadows.current.forEach((m, i) => {
      if (!m) return
      const x = (i ? 1 : -1) * COL_X
      const h = 1.2
      const len = Math.hypot(ox, oz) * h
      m.position.set(x + (ox * h) / 2, SAND_Y + 0.002, (oz * h) / 2)
      m.rotation.y = Math.atan2(ox, oz)
      m.scale.set(0.3, 1, len / 2 + 0.3)
    })
    spanShadow.current.position.set(ox * SPAN_Y, SAND_Y + 0.003, oz * SPAN_Y)
    // the shadow fades as it slides off the sand
    spanShadow.current.visible = Math.abs(oz * SPAN_Y) < 1.3

    const s = tap.since(t)
    const w = weed.current
    w.visible = s >= 0 && s < ROLL
    if (w.visible) {
      weedAt(s, w.position)
      w.rotation.set((4.6 * s) / ROLL / R, s * 0.7, 0)
      const edge = Math.min(1, s / 0.25, (ROLL - s) / 0.25)
      w.scale.setScalar(Math.max(0.001, edge))
    }
    dust.forEach((d, i) => {
      const m = puffs.current[i]
      if (!m) return
      const age = s - d.hop * HOP
      m.visible = s >= 0 && age >= 0 && age < 0.8
      if (!m.visible) return
      weedAt(d.hop * HOP, v)
      const k = age / 0.8
      m.position.set(v.x + d.dx * (0.4 + k), SAND_Y + 0.03 + k * 0.12, v.z + d.dz * (0.4 + k) - 0.1)
      m.scale.setScalar(Math.max(0.001, 0.075 * d.s * (0.6 + k * 1.6)))
      m.material.opacity = 0.8 * (1 - k) ** 1.4
    })
  })

  const cactusSkin = (k) => <Flat color={L.cactus[k % 2]} />
  return (
    <group {...handlers} onClick={onClick}>
      <directionalLight ref={sun} intensity={0.9} color={L.sun} />
      <mesh geometry={geo.sand}>
        <Flat color={L.sand} />
      </mesh>
      {/* the arch's shadow, a darker sand laid flat on top */}
      {[0, 1].map((i) => (
        <mesh key={i} ref={(el) => (colShadows.current[i] = el)} geometry={geo.oval}>
          <meshStandardMaterial color={L.shade} roughness={1} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
        </mesh>
      ))}
      <mesh ref={spanShadow} geometry={geo.band}>
        <meshStandardMaterial color={L.shade} roughness={1} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
      </mesh>

      {COLUMNS.map((col, c) =>
        col.map(([y, sx, sy, sz, yaw], k) => (
          <mesh key={`${c}-${k}`} geometry={geo.rock[(c + k) % 3]} position={[(c ? 1 : -1) * COL_X + (k - 1) * 0.03 * (c ? -1 : 1), y, (k % 2) * 0.04 - 0.02]} rotation-y={yaw} scale={[sx, sy, sz]}>
            <Flat color={L.rock[(c + k) % 3]} />
          </mesh>
        )),
      )}
      <mesh geometry={geo.span} position-y={SPAN_Y} rotation-y={0.04}>
        <Flat color={L.span} />
      </mesh>

      {/* a saguaro with one arm */}
      <group position={[-1.08, SAND_Y, 0.62]} rotation-y={0.6}>
        <mesh geometry={geo.stem} scale={[0.085, 0.62, 0.085]}>
          {cactusSkin(0)}
        </mesh>
        <mesh geometry={geo.cap} position-y={0.62} scale={0.085}>
          {cactusSkin(0)}
        </mesh>
        <group position={[0.06, 0.28, 0]} rotation-z={-Math.PI / 2}>
          <mesh geometry={geo.stem} scale={[0.05, 0.14, 0.05]}>
            {cactusSkin(1)}
          </mesh>
        </group>
        <mesh geometry={geo.stem} position={[0.17, 0.28, 0]} scale={[0.05, 0.2, 0.05]}>
          {cactusSkin(1)}
        </mesh>
        <mesh geometry={geo.cap} position={[0.17, 0.48, 0]} scale={0.05}>
          {cactusSkin(1)}
        </mesh>
      </group>
      {/* a barrel cactus in flower */}
      <group position={[1.12, SAND_Y, -0.45]}>
        <mesh geometry={geo.barrel} position-y={0.1} scale={[0.15, 0.14, 0.15]}>
          {cactusSkin(0)}
        </mesh>
        {[0, 1, 2, 3, 4].map((k) => (
          <mesh key={k} geometry={geo.petal} position-y={0.23} rotation={[0.6, (k / 5) * TAU, 0, 'YXZ']} scale={[0.025, 0.06, 0.012]}>
            <Flat color={L.flower} />
          </mesh>
        ))}
      </group>
      {stones.map(([x, z, s], i) => (
        <mesh key={i} geometry={geo.stone} position={[x, SAND_Y + s * 0.3, z]} scale={[s, s * 0.6, s]}>
          <Flat color={L.rock[i % 3]} />
        </mesh>
      ))}

      <group ref={weed} visible={false}>
        {weedRings.map(([a, b, c, s], i) => (
          <mesh key={i} geometry={geo.ring} rotation={[a, b, c]} scale={s}>
            <Flat color={L.weed[i % 2]} />
          </mesh>
        ))}
      </group>
      {dust.map((d, i) => (
        <mesh key={i} ref={(el) => (puffs.current[i] = el)} geometry={geo.puff} visible={false}>
          <meshStandardMaterial color={L.dust} flatShading roughness={1} transparent depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

export default function RockArchScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.4, 2.4, 4.8]} target={[0, 0.7, 0]} hint="The sun swings slowly over the arch and its shadow sweeps across the sand beneath · tap it and a tumbleweed bounces through the gap, kicking up dust · Look swaps sandstone, red rock and dusk · drag to orbit">
      <RockArch {...props} />
    </Stage>
  )
}

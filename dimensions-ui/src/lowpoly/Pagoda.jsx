import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Ripple, Stage, Sway, facet, useGeo, useKick, useTap } from './kit.jsx'

// A low-poly pagoda on a stepped stone platform: four square storeys, each
// smaller than the one below, with red corner posts and lattice windows,
// each capped by a wide tiled roof whose eaves sweep up at the corners, and
// on top a gold spire (the sorin) of stacked rings and a jewel. Little gold
// wind bells hang from every eave corner. Left alone, the bells swing on
// their cords like pendulums and the windows glow faintly. Tap it and the
// windows light up storey by storey from the bottom up, the spire's jewel
// flashes and throws sparks, the bells jangle and a soft ring of light
// spreads across the ground; then the lights die down again.

const LOOKS = {
  red: { wall: '#f3ead6', post: '#c8392a', roof: '#3a3d45', stone: '#b9b4aa', stone2: '#a8a398', win: '#ffc870', glow: '#ffa53a', gold: '#d9ab3a', base: 0.3, peak: 2.4 },
  jade: { wall: '#efe6cf', post: '#b8442e', roof: '#3f8a6e', stone: '#aeb3a8', stone2: '#9ca297', win: '#ffd88a', glow: '#ffb84a', gold: '#d9ab3a', base: 0.3, peak: 2.4 },
  wood: { wall: '#c9a27a', post: '#6e4a30', roof: '#4a3a30', stone: '#a9a196', stone2: '#958d82', win: '#ffcf7a', glow: '#ffa53a', gold: '#c99a3a', base: 0.3, peak: 2.4 },
  night: { wall: '#3a3448', post: '#5a2a3a', roof: '#1c1f2a', stone: '#4a4a58', stone2: '#3c3c48', win: '#ffcf7a', glow: '#ffa53a', gold: '#e7b43c', base: 0.9, peak: 3.6 },
}

const BASE = 0.16 // top of the platform
const TIERS = [
  { w: 0.78, h: 0.3 },
  { w: 0.64, h: 0.22 },
  { w: 0.54, h: 0.2 },
  { w: 0.45, h: 0.19 },
]
const RH = 0.12 // roof height
const UP = 0.11 // how far the eave corners sweep up
const SPIRE = 0.46
const STEP = 0.3 // seconds between storeys lighting
const HOLD = 4.2 // seconds the lights stay up

// A square roof with concave slopes and corners that sweep up and out: a
// sixteen-sided cylinder pushed out to a square, its foot lifted at the
// corners, its middle ring sagged.
function roofGeo(rb, rt, h, up, seed) {
  const g = new THREE.CylinderGeometry(rt, rb, h, 16, 2).translate(0, h / 2, 0)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const y = p.getY(i)
    const z = p.getZ(i)
    const r = Math.hypot(x, z)
    const v = y / h // 0 at the eaves, 1 at the top
    let ny = y
    if (Math.abs(v - 0.5) < 0.01) ny -= h * 0.18
    if (r < 1e-6) {
      p.setY(i, ny)
      continue
    }
    const a = Math.atan2(z, x)
    const f = 1 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)))
    const c = (f - 1) / (Math.SQRT2 - 1) // 0 mid-edge, 1 at a corner
    const out = f * (1 + 0.1 * c * (1 - v))
    p.setXYZ(i, x * out, ny + up * c * c * (1 - v) ** 2, z * out)
  }
  g.computeVertexNormals()
  return facet(g, 0.004, seed)
}

// A wind bell on a cord, swinging both ways like a pendulum.
function Bell({ geo, L, tap, phase, ...props }) {
  return (
    <group {...props}>
      <Sway axis="x" rate={0.55 + (phase % 3) * 0.07} amp={0.22} i={phase} lag={1.3} kick={tap} kickAmp={0.6}>
        <Sway axis="z" rate={0.43 + (phase % 2) * 0.09} amp={0.18} i={phase * 1.7} lag={1.1}>
          <mesh geometry={geo.cord} position-y={-0.03}>
            <Flat color="#2a2622" />
          </mesh>
          <mesh geometry={geo.bell} position-y={-0.075}>
            <Flat color={L.gold} metalness={0.5} roughness={0.35} />
          </mesh>
          <mesh geometry={geo.tab} position-y={-0.125}>
            <Flat color={L.post} />
          </mesh>
        </Sway>
      </Sway>
    </group>
  )
}

export function Pagoda({ look = 'red' }) {
  const L = LOOKS[look] || LOOKS.red
  const { tap, handlers, clock } = useTap(1)
  const spark = useKick(2)
  const fired = useRef(-99)
  const wins = useRef([])
  const jewel = useRef()
  const lamp = useRef()

  // where each storey and its roof sit
  const layout = useMemo(() => {
    let y = BASE
    return TIERS.map((T, i) => {
      const next = TIERS[i + 1]
      const top = !next
      const eave = y + T.h - 0.01
      const tier = { ...T, y, eave, rb: T.w / 2 + 0.19, rt: top ? 0.05 : next.w / 2 - 0.02, rh: top ? 0.2 : RH }
      y = eave + tier.rh - 0.01
      return tier
    })
  }, [])
  const top = layout[layout.length - 1]
  const spireY = top.eave + top.rh - 0.02

  const geo = useGeo(
    () => ({
      step1: facet(new THREE.BoxGeometry(1.6, 0.08, 1.6).translate(0, 0.04, 0), 0.01, 1, [1, 0.3, 1]),
      step2: facet(new THREE.BoxGeometry(1.24, 0.08, 1.24).translate(0, 0.12, 0), 0.01, 2, [1, 0.3, 1]),
      stair: new THREE.BoxGeometry(0.34, 0.04, 0.12),
      bodies: TIERS.map((T, i) => facet(new THREE.BoxGeometry(T.w, T.h, T.w).translate(0, T.h / 2, 0), 0.004, 10 + i)),
      roofs: layout.map((T, i) => roofGeo(T.rb, T.rt, T.rh, T.rh > RH ? UP * 0.9 : UP, 20 + i)),
      sill: TIERS.map((T) => new THREE.BoxGeometry(T.w + 0.06, 0.03, T.w + 0.06)),
      post: new THREE.BoxGeometry(0.045, 1, 0.045),
      win: TIERS.map((T) => new THREE.BoxGeometry(T.w * 0.46, T.h * 0.56, 0.012)),
      bar: new THREE.BoxGeometry(0.012, 1, 0.016),
      cord: new THREE.CylinderGeometry(0.004, 0.004, 0.06, 3),
      bell: new THREE.CylinderGeometry(0.012, 0.03, 0.05, 6),
      tab: new THREE.BoxGeometry(0.025, 0.05, 0.004),
      spireBase: new THREE.BoxGeometry(0.11, 0.06, 0.11),
      mast: new THREE.CylinderGeometry(0.016, 0.02, SPIRE, 6).translate(0, SPIRE / 2, 0),
      ring: new THREE.CylinderGeometry(1, 1, 0.014, 10),
      jewel: facet(new THREE.OctahedronGeometry(0.045, 0).scale(1, 1.4, 1), 0.002, 31),
      spark: new THREE.OctahedronGeometry(1, 0),
      hit: new THREE.BoxGeometry(1.2, 2, 1.2).translate(0, 1, 0),
    }),
    [],
  )

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const lit = (i) => {
      if (s < 0) return 0
      const on = Math.min(1, Math.max(0, (s - 0.12 - i * STEP) / 0.22))
      const off = Math.max(0, 1 - Math.max(0, s - HOLD - i * 0.12) / 0.7)
      return on * off
    }
    // each storey's windows: a faint flicker at rest, blazing once lit
    let high = -1
    layout.forEach((T, i) => {
      const k = lit(i)
      if (k > 0.05) high = i
      const flick = 0.9 + 0.1 * Math.sin(t * 2.3 + i * 1.7)
      wins.current[i]?.forEach((m) => m && (m.material.emissiveIntensity = L.base * flick + k * L.peak))
    })
    // the jewel flashes as the light reaches the spire
    const ts = 0.12 + TIERS.length * STEP
    const flash = s >= ts ? Math.exp(-3.2 * (s - ts)) : 0
    const after = s >= ts && s < HOLD ? 0.6 : 0
    jewel.current.material.emissiveIntensity = 0.3 + flash * 4 + after
    jewel.current.scale.setScalar(1 + flash * 0.6)
    if (s >= ts && s < ts + 1 && Math.abs(fired.current - (t - s)) > 0.01) {
      fired.current = t - s
      spark.kick(t)
    }
    // a warm light climbs with the lit storeys
    const ly = high < 0 ? layout[0].y : high === layout.length - 1 && flash > 0 ? spireY + SPIRE : layout[high].y + layout[high].h / 2
    lamp.current.position.y += (ly - lamp.current.position.y) * 0.15
    lamp.current.intensity = (high < 0 ? 0 : 1.8) * lit(Math.max(0, high)) + flash * 2
  })

  return (
    <group {...handlers}>
      {/* the stepped stone platform and a stair up the front */}
      <mesh geometry={geo.step1}>
        <Flat color={L.stone2} />
      </mesh>
      <mesh geometry={geo.step2}>
        <Flat color={L.stone} />
      </mesh>
      {[0, 1].map((k) => (
        <mesh key={k} geometry={geo.stair} position={[0, 0.02 + k * 0.08, 0.68 + (1 - k) * 0.1 - 0.06]}>
          <Flat color={L.stone} />
        </mesh>
      ))}

      {layout.map((T, i) => (
        <group key={i}>
          <group position-y={T.y}>
            <mesh geometry={geo.bodies[i]}>
              <Flat color={L.wall} />
            </mesh>
            <mesh geometry={geo.sill[i]} position-y={0.015}>
              <Flat color={L.post} />
            </mesh>
            {/* corner posts */}
            {[-1, 1].map((mx) =>
              [-1, 1].map((mz) => (
                <mesh key={`${mx}${mz}`} geometry={geo.post} position={[(mx * T.w) / 2, T.h / 2, (mz * T.w) / 2]} scale={[1, T.h, 1]}>
                  <Flat color={L.post} />
                </mesh>
              )),
            )}
            {/* a lattice window on each face */}
            {[0, 1, 2, 3].map((k) => (
              <group key={k} rotation-y={(k * Math.PI) / 2}>
                <mesh
                  ref={(el) => {
                    if (!wins.current[i]) wins.current[i] = []
                    wins.current[i][k] = el
                  }}
                  geometry={geo.win[i]}
                  position={[0, T.h * 0.52, T.w / 2 + 0.004]}
                >
                  <Flat color={L.win} emissive={L.glow} emissiveIntensity={L.base} />
                </mesh>
                {[-1, 0, 1].map((b) => (
                  <mesh key={b} geometry={geo.bar} position={[b * T.w * 0.12, T.h * 0.52, T.w / 2 + 0.01]} scale={[1, T.h * 0.56, 1]}>
                    <Flat color={L.post} />
                  </mesh>
                ))}
              </group>
            ))}
          </group>
          {/* the roof, and a bell at each upturned corner */}
          <mesh geometry={geo.roofs[i]} position-y={T.eave}>
            <Flat color={L.roof} />
          </mesh>
          {[-1, 1].map((mx) =>
            [-1, 1].map((mz) => (
              <Bell key={`${mx}${mz}`} geo={geo} L={L} tap={tap} phase={i * 4 + (mx + 1) + (mz + 1) / 2} position={[mx * T.rb * 1.06, T.eave + (T.rh > RH ? UP * 0.9 : UP) - 0.01, mz * T.rb * 1.06]} />
            )),
          )}
        </group>
      ))}

      {/* the spire: a base, a mast of rings and a jewel */}
      <group position-y={spireY}>
        <mesh geometry={geo.spireBase} position-y={0.03}>
          <Flat color={L.gold} metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh geometry={geo.mast}>
          <Flat color={L.gold} metalness={0.5} roughness={0.4} />
        </mesh>
        {Array.from({ length: 7 }, (_, k) => (
          <mesh key={k} geometry={geo.ring} position-y={0.1 + k * 0.042} scale={[0.055 - k * 0.003, 1, 0.055 - k * 0.003]}>
            <Flat color={L.gold} metalness={0.5} roughness={0.4} />
          </mesh>
        ))}
        <mesh ref={jewel} geometry={geo.jewel} position-y={SPIRE + 0.04}>
          <Flat color={L.win} emissive={L.glow} emissiveIntensity={0.3} />
        </mesh>
      </group>
      <pointLight ref={lamp} color={L.glow} distance={2.2} decay={1.6} position={[0, BASE, 0.8]} intensity={0} />

      <Burst tap={spark} geometry={geo.spark} count={14} colors={[L.glow, L.win, L.gold]} speed={1.2} gravity={1.5} size={0.03} life={1.1} origin={[0, spireY + SPIRE + 0.04, 0]} spread={0.8} up={0.9} seed={7} />
      <Ripple tap={tap} count={3} color={L.glow} radius={2} life={1.8} opacity={0.35} y={BASE + 0.005} />
      {/* an invisible column round the pagoda, so a tap between the eaves lands */}
      <mesh geometry={geo.hit}>
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}

export default function PagodaScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.6, 2.4, 5]} target={[0, 0.95, 0]} hint="The wind bells swing from the eave corners on their own · tap it and the windows light storey by storey up to the spire, which flashes · Look swaps red, jade, wood and night · drag to orbit">
      <Pagoda {...props} />
    </Stage>
  )
}

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Flow, Particles, Ripple, Stage, Trail, blob, cone, facet, rng, useGeo, useTap, waveAt } from './kit.jsx'

// A low-poly stone bridge: a hump-backed bridge of dressed blocks, a ring of
// wedge-shaped voussoirs round its arch, parapets along the deck, spanning
// a stream that runs between two grassy banks lined with rocks and reeds,
// with trees on either side. The stream flows under the arch on a loop,
// streaks riding its rolling surface, and petals, leaves or snow drift
// down depending on the season. Tap it and a little boat floats in from
// upstream, bobbing on the current, slips under the arch and drifts away
// downstream, leaving a wake behind it.

const LOOKS = {
  spring: { path: '#d9c193', grass: '#7cc35a', grass2: '#6cb34c', earth: '#8b6a4a', stone: ['#bdb5a8', '#cbc4b8', '#aaa294', '#d6d0c4'], deck: '#9f978a', water: '#58b7e0', water2: '#a8e0f4', bed: '#3f8fb4', leaf: ['#f6a9c8', '#ee8cb6'], leaf2: '#f9c6da', drift: ['#ffd1e3', '#ffffff', '#f6a9c8'], gravity: 0.25, snow: false },
  autumn: { path: '#c9a878', grass: '#b6a24c', grass2: '#a59344', earth: '#8b6446', stone: ['#b3a998', '#c2b8a6', '#a09684', '#cfc6b4'], deck: '#958b7a', water: '#4fa6c8', water2: '#9fd6e8', bed: '#357f9e', leaf: ['#f08a2a', '#e0602a'], leaf2: '#f4b23a', drift: ['#f08a2a', '#e0602a', '#f4b23a'], gravity: 0.3, snow: false },
  winter: { path: '#d5dce5', grass: '#eef3f8', grass2: '#e1e8f0', earth: '#9a8a7a', stone: ['#aeb3ba', '#bfc4cb', '#9da2aa', '#cdd2d8'], deck: '#f4f7fb', water: '#6fbfe0', water2: '#c8ecf8', bed: '#4a92b2', leaf: ['#f4f7fb', '#e3eaf2'], leaf2: '#ffffff', drift: ['#ffffff', '#eef6ff'], gravity: 0.18, snow: true },
}

const W = 0.45 // half width of the stream
const SIZE = 1.5 // half size of the base
const BANK_H = 0.32
const WATER_Y = 0.14
const ARCH_Y = 0.18 // spring line of the arch
const ARCH_R = 0.56 // inner radius
const RING = 0.15 // voussoir depth
const DECK_HALF = 1.1 // the deck runs out to here along x
const DEPTH = 0.5 // bridge width along z
const deckY = (x) => BANK_H + (0.98 - BANK_H) * Math.max(0, 1 - (x / DECK_HALF) ** 2) ** 0.75
const BOAT_FOR = 6.5 // seconds the boat takes to drift through

// The bridge's body: the deck profile on top, the arch cut out beneath it.
function spandrelGeometry() {
  const s = new THREE.Shape()
  const N = 16
  s.moveTo(-DECK_HALF, BANK_H - 0.02)
  for (let i = 0; i <= N; i++) {
    const x = -DECK_HALF + (2 * DECK_HALF * i) / N
    s.lineTo(x, deckY(x))
  }
  s.lineTo(DECK_HALF, BANK_H - 0.02)
  const R = ARCH_R + RING
  const a0 = Math.asin((BANK_H - 0.02 - ARCH_Y) / R)
  for (let i = 0; i <= 12; i++) {
    const a = a0 + ((Math.PI - 2 * a0) * i) / 12
    s.lineTo(Math.cos(a) * R, ARCH_Y + Math.sin(a) * R)
  }
  s.closePath()
  return facet(new THREE.ExtrudeGeometry(s, { depth: DEPTH, bevelEnabled: false }).translate(0, 0, -DEPTH / 2), 0.008, 7, [1, 1, 0.3])
}

// one voussoir: a wedge of the ring between angles a0 and a1
function voussoirGeometry(a0, a1, seed) {
  const s = new THREE.Shape()
  const r0 = ARCH_R
  const r1 = ARCH_R + RING
  s.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0)
  s.lineTo(Math.cos(a0) * r1, Math.sin(a0) * r1)
  s.lineTo(Math.cos(a1) * r1, Math.sin(a1) * r1)
  s.lineTo(Math.cos(a1) * r0, Math.sin(a1) * r0)
  s.closePath()
  return facet(new THREE.ExtrudeGeometry(s, { depth: DEPTH + 0.04, bevelEnabled: false }).translate(0, 0, -(DEPTH + 0.04) / 2), 0.006, seed, [1, 1, 0.5])
}

// a strip of water down the channel whose surface rolls
function WaterStrip({ L, clock }) {
  const geo = useGeo(() => new THREE.PlaneGeometry(2 * W, 2 * SIZE, 5, 18).rotateX(-Math.PI / 2), [])
  const base = useMemo(() => Float32Array.from(geo.attributes.position.array), [geo])
  useFrame(() => {
    const p = geo.attributes.position
    const t = clock.elapsedTime
    for (let i = 0; i < p.count; i++) {
      const x = base[i * 3]
      const z = base[i * 3 + 2]
      const edge = Math.abs(x) > W - 0.01 ? 0.3 : 1
      p.setY(i, edge * waveAt(x * 1.5, z * 1.4 - t * 0.9, t, 0.012, 1.4))
    }
    p.needsUpdate = true
    geo.computeVertexNormals()
  })
  return (
    <group position-y={WATER_Y}>
      <mesh geometry={geo}>
        <meshStandardMaterial color={L.water} flatShading roughness={0.25} metalness={0.05} />
      </mesh>
      {/* the cut faces of the water at either end */}
      {[-1, 1].map((e) => (
        <mesh key={e} position={[0, -WATER_Y / 2 + 0.03, e * SIZE]}>
          <boxGeometry args={[2 * W, WATER_Y - 0.04, 0.002]} />
          <Flat color={L.bed} />
        </mesh>
      ))}
    </group>
  )
}

// the little boat: a flat-bottomed skiff with a seat, a mast and a pennant
function Boat({ geo, L, tap, clock, boatRef }) {
  const g = boatRef
  const flag = useRef()
  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const u = s / BOAT_FOR
    const on = s >= 0 && u < 1
    g.current.visible = on
    if (!on) return
    const z = -SIZE + 0.2 + u * (2 * SIZE - 0.4)
    const x = Math.sin(u * 5) * 0.06
    const pop = Math.min(1, u * 12, (1 - u) * 12)
    g.current.scale.setScalar(Math.max(0.001, pop * 1.3))
    g.current.position.set(x, WATER_Y + 0.01 + waveAt(x * 1.5, z * 1.4 - t * 0.9, t, 0.012, 1.4) + Math.sin(t * 3) * 0.008, z)
    g.current.rotation.set(Math.sin(t * 2.4) * 0.05, Math.cos(u * 5) * 0.3 * 0.4, Math.sin(t * 2.9 + 1) * 0.07)
    if (flag.current) flag.current.rotation.y = Math.PI + Math.sin(t * 8) * 0.25
  })
  return (
    <group ref={g} visible={false}>
      <mesh geometry={geo.hull}>
        <Flat color={L.snow ? '#c8382f' : '#b5793f'} />
      </mesh>
      <mesh geometry={geo.rim} position-y={0.075}>
        <Flat color={L.snow ? '#f4efe4' : '#7a4b26'} />
      </mesh>
      <mesh position={[0, 0.045, 0]}>
        <boxGeometry args={[0.15, 0.015, 0.04]} />
        <Flat color="#d8b07a" />
      </mesh>
      <mesh position={[0, 0.17, 0.05]}>
        <cylinderGeometry args={[0.006, 0.008, 0.28, 4]} />
        <Flat color="#6b4a30" />
      </mesh>
      <group ref={flag} position={[0, 0.29, 0.05]}>
        <mesh geometry={geo.flag}>
          <Flat color="#e8453a" side={THREE.DoubleSide} />
        </mesh>
      </group>
      <mesh geometry={geo.lantern} position={[0, 0.06, -0.12]}>
        <Flat color="#ffcf5a" emissive="#ffb52e" emissiveIntensity={0.6} />
      </mesh>
    </group>
  )
}

export function StoneBridge({ look = 'spring' }) {
  const L = LOOKS[look] || LOOKS.spring
  const { tap, handlers, clock } = useTap(1)
  const boatRef = useRef()
  const geo = useGeo(() => {
    const N = 11
    const gap = 0.012
    return {
      spandrel: spandrelGeometry(),
      voussoirs: Array.from({ length: N }, (_, i) => voussoirGeometry((i / N) * Math.PI + gap, ((i + 1) / N) * Math.PI - gap, 30 + i)),
      bank: facet(new THREE.BoxGeometry(SIZE - W, BANK_H, 2 * SIZE, 3, 1, 8).translate(0, BANK_H / 2, 0), 0.025, 5, [1, 0.25, 1], (x, y) => y < 0.001),
      bed: new THREE.BoxGeometry(2 * W + 0.02, 0.05, 2 * SIZE).translate(0, 0.025, 0),
      block: new THREE.BoxGeometry(1, 1, 1),
      cap: facet(new THREE.BoxGeometry(1, 1, 1, 1, 1, 1), 0.04, 9),
      rock: blob(1, 6, 0),
      reed: facet(new THREE.ConeGeometry(0.014, 1, 4, 1).translate(0, 0.5, 0), 0.003, 9),
      trunk: new THREE.CylinderGeometry(0.03, 0.045, 0.32, 5).translate(0, 0.16, 0),
      crown: blob(0.2, 4),
      pine: cone(0.16, 0.42, 6, 5),
      hull: (() => {
        const s = new THREE.Shape()
        s.moveTo(-0.08, -0.2)
        s.lineTo(0.08, -0.2)
        s.lineTo(0.09, 0.08)
        s.quadraticCurveTo(0.06, 0.2, 0, 0.26)
        s.quadraticCurveTo(-0.06, 0.2, -0.09, 0.08)
        s.closePath()
        const g = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: false, curveSegments: 3 }).rotateX(Math.PI / 2).translate(0, 0.08, 0)
        // taper the hull toward its keel
        const p = g.attributes.position
        for (let i = 0; i < p.count; i++) if (p.getY(i) < 0.01) p.setX(i, p.getX(i) * 0.7)
        g.computeVertexNormals()
        return g
      })(),
      rim: (() => {
        const s = new THREE.Shape()
        s.moveTo(-0.09, -0.21)
        s.lineTo(0.09, -0.21)
        s.lineTo(0.1, 0.08)
        s.quadraticCurveTo(0.07, 0.21, 0, 0.275)
        s.quadraticCurveTo(-0.07, 0.21, -0.1, 0.08)
        s.closePath()
        const h = new THREE.Path()
        h.moveTo(-0.065, -0.18)
        h.quadraticCurveTo(-0.045, 0.2, 0, 0.22)
        h.quadraticCurveTo(0.045, 0.2, 0.065, -0.18)
        h.closePath()
        s.holes.push(h)
        return new THREE.ExtrudeGeometry(s, { depth: 0.015, bevelEnabled: false, curveSegments: 3 }).rotateX(Math.PI / 2).translate(0, 0.015, 0)
      })(),
      lantern: new THREE.OctahedronGeometry(0.022, 0),
      petal: new THREE.TetrahedronGeometry(1, 0),
    }
  }, [])
  // the boat's pennant
  const flagGeo = useGeo(() => {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.07, 0), new THREE.Vector3(0.09, -0.035, 0)])
    g.computeVertexNormals()
    return g
  }, [])

  // masonry: blocks proud of the spandrel faces, in courses
  const blocks = useMemo(() => {
    const r = rng(23)
    const out = []
    for (const side of [-1, 1])
      for (let row = 0; row < 5; row++) {
        const y = BANK_H + 0.05 + row * 0.12
        for (let x = -DECK_HALF + 0.12 + (row % 2) * 0.1; x < DECK_HALF - 0.1; x += 0.2 + r() * 0.06) {
          // inside the face: under the deck, outside the arch ring
          if (y + 0.05 > deckY(x) - 0.03) continue
          if (Math.hypot(x, y - ARCH_Y) < ARCH_R + RING + 0.06) continue
          out.push({ p: [x, y, side * (DEPTH / 2 + 0.006)], s: [0.16 + r() * 0.04, 0.09, 0.02], c: Math.floor(r() * 4) })
        }
      }
    return out
  }, [])
  // the parapets: blocks along both edges, following the hump
  const parapet = useMemo(() => {
    const out = []
    const N = 14
    for (const side of [-1, 1])
      for (let i = 0; i < N; i++) {
        const x0 = -DECK_HALF + (2 * DECK_HALF * i) / N
        const x1 = -DECK_HALF + (2 * DECK_HALF * (i + 1)) / N
        const y0 = deckY(x0)
        const y1 = deckY(x1)
        out.push({ p: [(x0 + x1) / 2, (y0 + y1) / 2 + 0.05, side * (DEPTH / 2 - 0.035)], len: Math.hypot(x1 - x0, y1 - y0) + 0.004, rz: Math.atan2(y1 - y0, x1 - x0), c: i % 4 })
      }
    return out
  }, [])
  const rocks = useMemo(() => {
    const r = rng(41)
    return Array.from({ length: 14 }, (_, i) => {
      const side = i % 2 ? 1 : -1
      const z = -SIZE + 0.15 + (i / 14) * (2 * SIZE - 0.3) + (r() - 0.5) * 0.1
      if (Math.abs(z) < DEPTH / 2 + 0.1) return null
      const s = 0.05 + r() * 0.05
      return { p: [side * (W - 0.02), WATER_Y + 0.01, z], s: [s * 1.2, s * 0.8, s * 1.4], c: i % 3 }
    }).filter(Boolean)
  }, [])
  const reeds = useMemo(() => {
    const r = rng(7)
    return [[-0.62, 1.05], [0.66, -1.1], [0.62, 1.25]].flatMap(([x, z]) => Array.from({ length: 5 }, () => ({ p: [x + (r() - 0.5) * 0.15, BANK_H, z + (r() - 0.5) * 0.18], h: 0.18 + r() * 0.12, lean: (r() - 0.5) * 0.4, ph: r() * 6 })))
  }, [])
  const trees = [
    [-1.05, -0.95, 1.1, 'round'],
    [1.1, 0.95, 1, 'round'],
    [-1.15, 0.8, 0.9, 'pine'],
    [1.05, -1.0, 1.05, 'pine'],
  ]
  const flowPaths = useMemo(() => {
    const path = (u) => new THREE.Vector3(0, WATER_Y + 0.02, -SIZE + 0.05 + u * (2 * SIZE - 0.1))
    return path
  }, [])

  const reedRefs = useRef([])
  useFrame(() => {
    const t = clock.elapsedTime
    reedRefs.current.forEach((m, i) => m && (m.rotation.z = reeds[i].lean + Math.sin(t * 1.4 + reeds[i].ph) * 0.06))
  })

  return (
    <group {...handlers}>
      {/* banks, bed and water */}
      {[-1, 1].map((side) => (
        <mesh key={side} geometry={geo.bank} position-x={side * (W + (SIZE - W) / 2)}>
          {[0, 1, 2, 3, 4, 5].map((m) => (
            <Flat key={m} attach={`material-${m}`} color={m === 2 ? L.grass : L.earth} />
          ))}
        </mesh>
      ))}
      <mesh geometry={geo.bed}>
        <Flat color={L.bed} />
      </mesh>
      {/* the track up to the bridge on either bank */}
      {[-1, 1].map((side) => (
        <mesh key={side} geometry={geo.block} position={[side * (DECK_HALF - 0.12 + (SIZE - DECK_HALF + 0.12) / 2), BANK_H + 0.006, 0]} scale={[SIZE - DECK_HALF + 0.12, 0.014, DEPTH - 0.12]}>
          <Flat color={L.path} />
        </mesh>
      ))}
      <WaterStrip L={L} clock={clock} />
      <Flow path={flowPaths} count={34} speed={0.16} width={2 * W - 0.12} size={0.014} stretch={4} colors={['#ffffff', L.water2]} opacity={0.85} seed={3} />
      {[-0.95, 0.4].map((z, i) => (
        <group key={i} position={[i ? 0.2 : -0.15, WATER_Y + 0.02, z]}>
          <Ripple loop period={2.2 + i * 0.6} count={2} color="#ffffff" radius={0.22} opacity={0.45} y={0} />
        </group>
      ))}
      {rocks.map((r, i) => (
        <mesh key={i} geometry={geo.rock} position={r.p} scale={r.s} rotation-y={i}>
          <Flat color={L.stone[r.c]} />
        </mesh>
      ))}

      {/* the bridge */}
      <mesh geometry={geo.spandrel}>
        <Flat color={L.stone[2]} />
      </mesh>
      <group position-y={ARCH_Y}>
        {geo.voussoirs.map((g, i) => (
          <mesh key={i} geometry={g}>
            <Flat color={i === 5 ? L.stone[3] : L.stone[i % 2]} />
          </mesh>
        ))}
      </group>
      {blocks.map((b, i) => (
        <mesh key={i} geometry={geo.block} position={b.p} scale={b.s}>
          <Flat color={L.stone[b.c]} />
        </mesh>
      ))}
      {parapet.map((b, i) => (
        <group key={i} position={b.p} rotation-z={b.rz}>
          <mesh geometry={geo.block} scale={[b.len, 0.1, 0.07]}>
            <Flat color={L.stone[b.c]} />
          </mesh>
          <mesh geometry={geo.cap} position-y={0.06} scale={[b.len + 0.01, 0.025, 0.09]}>
            <Flat color={L.snow ? '#ffffff' : L.stone[3]} />
          </mesh>
        </group>
      ))}
      {/* the road over the top */}
      {parapet.slice(0, 14).map((b, i) => (
        <mesh key={i} geometry={geo.block} position={[b.p[0], b.p[1] - 0.045, 0]} rotation-z={b.rz} scale={[b.len, 0.012, DEPTH - 0.1]}>
          <Flat color={L.deck} />
        </mesh>
      ))}

      {/* trees and reeds on the banks */}
      {trees.map(([x, z, s, kind], i) => (
        <group key={i} position={[x, BANK_H - 0.01, z]} scale={s}>
          <mesh geometry={geo.trunk}>
            <Flat color="#6b4a30" />
          </mesh>
          {kind === 'round' ? (
            <>
              <mesh geometry={geo.crown} position-y={0.38} scale={[1.1, 0.95, 1.1]}>
                <Flat color={L.leaf[i % 2]} />
              </mesh>
              <mesh geometry={geo.crown} position={[0.12, 0.28, 0.06]} scale={0.6}>
                <Flat color={L.leaf2} />
              </mesh>
            </>
          ) : (
            <>
              <mesh geometry={geo.pine} position-y={0.1}>
                <Flat color={L.snow ? '#2f6a48' : '#3f8a45'} />
              </mesh>
              {L.snow && (
                <mesh geometry={geo.pine} position-y={0.33} scale={0.5}>
                  <Flat color="#ffffff" />
                </mesh>
              )}
            </>
          )}
        </group>
      ))}
      {reeds.map((r, i) => (
        <group key={i} ref={(el) => (reedRefs.current[i] = el)} position={r.p}>
          <mesh geometry={geo.reed} scale={[1, r.h, 1]}>
            <Flat color={L.snow ? '#b8a77a' : i % 2 ? '#6f9a3c' : '#86ad4a'} />
          </mesh>
        </group>
      ))}

      {/* petals, leaves or snow drifting down */}
      <Particles count={L.snow ? 30 : 18} life={5} origin={[0, 1.7, 0]} spread={1.3} velocity={[0.05, -0.32, 0.02]} scatter={0.05} drift={0.25} size={[0.022, 0.018]} colors={L.drift} opacity={[1, 0.6]} emissive={L.snow ? 0.7 : 0.15} geometry={geo.petal} spin={3} seed={12} />

      {/* the boat, and its wake */}
      <Boat geo={{ ...geo, flag: flagGeo }} L={L} tap={tap} clock={clock} boatRef={boatRef} />
      <Trail target={boatRef} count={22} every={0.05} color="#ffffff" size={0.035} grow={0.06} opacity={0.6} />
      <Burst tap={tap} geometry={geo.petal} count={10} colors={['#ffffff', L.water2]} speed={0.7} gravity={3} size={0.02} life={0.6} origin={[0, WATER_Y + 0.03, -SIZE + 0.25]} spread={0.6} up={1.2} seed={4} />
    </group>
  )
}

export default function StoneBridgeScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.4, 2.5, 4.8]} target={[0, 0.45, 0]} hint="The stream flows under the arch on a loop while petals, leaves or snow drift down · tap it and a little boat floats in from upstream, slips under the bridge and drifts away · Look swaps spring, autumn and winter · drag to orbit">
      <StoneBridge {...props} />
    </Stage>
  )
}

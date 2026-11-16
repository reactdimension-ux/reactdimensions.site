import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Particles, Stage, TAU, blob, facet, rng, terrainGeo, useGeo, useKick, useTap, wobble } from './kit.jsx'

// A low-poly patch of snowy pines: three cone-stack pines of different
// heights on a round of snow, every tier wearing a cap of snow with drips
// down its edge, a few snow-capped rocks and a line of little tracks across
// the drift. Left alone, snow falls softly and the trees sway. Tap a tree
// and the snow on the branch nearest the tap slides off in a puff; the
// branch, rid of the weight, springs up and wobbles, and the snow slowly
// settles back on it.

const LOOKS = {
  day: { snow: '#f6f9fd', shade: '#dfe8f2', pine: ['#2f6b4f', '#3a7d5a', '#2a6046'], trunk: '#6b4a35', rock: '#8e939c', track: '#c9d6e6', flake: ['#ffffff', '#eef5ff'], flakes: 40, wind: 0.05, fall: 0.42, sway: 1, light: null, bg: null },
  dusk: { snow: '#f7e6ea', shade: '#dccbdc', pine: ['#2c5a58', '#356a62', '#264e50'], trunk: '#5e3f36', rock: '#857f92', track: '#cbb6cc', flake: ['#fff4ee', '#ffe3d8'], flakes: 30, wind: 0.04, fall: 0.38, sway: 1, light: '#ff9a6a', bg: '#e6d4dc' },
  blizzard: { snow: '#f2f6fa', shade: '#d3dde8', pine: ['#2f5e52', '#3a6e60', '#294f48'], trunk: '#5d4838', rock: '#878d96', track: '#d5dfea', flake: ['#ffffff', '#e4edf7'], flakes: 160, wind: 0.75, flakeSize: [0.03, 0.042], spread: 2, fall: 0.85, sway: 2.6, light: null, bg: '#d7dee7' },
}
const DEFAULT_BG = '#eceaf1'

const GROUND_R = 1.55
const GROUND_H = 0.14
const groundY = (x, z) => GROUND_H * Math.max(0, 1 - (x * x + z * z) / (GROUND_R * GROUND_R))

// one pine's tiers at unit size: base height, radius, height
const TIERS = [
  [0.24, 0.55, 0.62],
  [0.58, 0.45, 0.56],
  [0.89, 0.34, 0.5],
  [1.16, 0.22, 0.46],
]
// the trees: x, z, scale, tiers
const TREES = [
  { x: -0.55, z: 0.22, s: 1.05, n: 4 },
  { x: 0.5, z: -0.45, s: 0.8, n: 4 },
  { x: 0.38, z: 0.55, s: 0.56, n: 3 },
]
const CAP_R = 0.72 // snow cap radius, height and seat, as shares of its tier
const CAP_H = 0.62
const CAP_Y = 0.4
const SLIDE = 0.5 // seconds the snow takes to slide off
const REGROW = [3.2, 5.5] // when the snow starts settling back, and is whole again

const clamp01 = (x) => Math.max(0, Math.min(1, x))

// A snow cap: a cone with its lower edge pulled down into drips, base at y = 0.
function capGeometry(seed) {
  const n = 14
  const g = new THREE.ConeGeometry(1, 1, n, 2).translate(0, 0.5, 0)
  const p = g.attributes.position
  const r = rng(seed)
  const dips = Array.from({ length: n + 1 }, (_, i) => (i % 2 ? 0.1 + r() * 0.22 : r() * 0.05))
  dips[n] = dips[0]
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i)
    if (y > 0.001) continue
    const x = p.getX(i)
    const z = p.getZ(i)
    const a = (Math.atan2(z, x) + TAU) % TAU
    const k = Math.round((a / TAU) * n) % n
    const d = dips[k]
    // follow the cone's slope out and down
    p.setXYZ(i, x * (1 + d), -d, z * (1 + d))
  }
  return facet(g, 0.025, seed, [1, 0.5, 1])
}

export function SnowyPines({ look = 'day' }) {
  const L = LOOKS[look] || LOOKS.day
  const { handlers, clock } = useTap(1.2)
  const shed = useKick(2)
  const root = useRef()
  const trees = useRef([])
  const tierRefs = useRef([])
  const capRefs = useRef([])
  const centers = useRef([])
  const puff = useRef()
  const puffBits = useRef([])
  const st = useRef({ t0: [], last: -1, tree: -1, tk: -99, pr: 0.3 })

  const geo = useGeo(
    () => ({
      ground: terrainGeo({ radius: GROUND_R, height: GROUND_H, seed: 5, rings: 5, segs: 20, rough: 0.35, profile: 'dome', bands: [[0, '#ffffff']] }),
      skirt: facet(new THREE.CylinderGeometry(GROUND_R, GROUND_R * 0.96, 0.1, 20, 1).translate(0, -0.05, 0), 0.02, 2, [1, 0.3, 1]),
      tier: TIERS.map((_, i) => facet(new THREE.ConeGeometry(1, 1, 8, 2).translate(0, 0.5, 0), 0.03, 10 + i, [1, 0.6, 1], (x, y) => y > 0.99)),
      cap: TIERS.map((_, i) => capGeometry(20 + i)),
      trunk: facet(new THREE.CylinderGeometry(0.05, 0.075, 0.34, 6, 1).translate(0, 0.17, 0), 0.008, 3),
      rock: blob(1, 7, 0),
      rockCap: facet(new THREE.SphereGeometry(1, 7, 3, 0, TAU, 0, Math.PI / 2.4), 0.06, 8),
      track: new THREE.CircleGeometry(1, 6).rotateX(-Math.PI / 2),
      flake: new THREE.OctahedronGeometry(1, 0),
      chunk: new THREE.IcosahedronGeometry(1, 0),
    }),
    [],
  )

  // every tier of every tree, flattened, with its place in the patch
  const tiers = useMemo(() => TREES.flatMap((T, ti) => TIERS.slice(0, T.n).map(([y, r, h], k) => ({ ti, k, y, r, h, last: k === T.n - 1 }))), [])
  const rocks = useMemo(() => {
    const r = rng(9)
    return [
      [-0.95, -0.45, 0.15],
      [0.95, -1.0, 0.1],
      [-0.25, -0.95, 0.09],
      [1.25, 0.08, 0.08],
    ].map(([x, z, s]) => ({ p: [x, groundY(x, z) - s * 0.25, z], s, ry: r() * TAU }))
  }, [])
  // a line of little paired prints curving across the drift
  const tracks = useMemo(() => {
    const out = []
    for (let i = 0; i < 9; i++) {
      const u = i / 8
      const ang = 1.75 - u * 1.4
      const x = Math.cos(ang) * 1.12
      const z = Math.sin(ang) * 1.12
      const a = Math.atan2(-Math.cos(ang), Math.sin(ang))
      for (const side of [-1, 1]) {
        const px = x + Math.sin(a) * side * 0.035 + (side > 0 ? 0.03 : 0)
        const pz = z - Math.cos(a) * side * 0.035
        out.push({ p: [px, groundY(px, pz) + 0.006, pz], ry: -a })
      }
    }
    return out
  }, [])
  const puffs = useMemo(() => {
    const r = rng(31)
    return Array.from({ length: 12 }, (_, i) => ({ a: (i / 12) * TAU + r() * 0.3, d: 0.8 + r() * 0.4, up: r() * 0.4, s: 0.7 + r() * 0.6 }))
  }, [])

  const _v = useMemo(() => new THREE.Vector3(), [])
  const onClick = (e) => {
    handlers.onClick(e)
    const t = clock.elapsedTime
    const S = st.current
    let best = -1
    let bd = Infinity
    tiers.forEach((_, i) => {
      const c = centers.current[i]
      if (!c || t - (S.t0[i] ?? -99) < REGROW[1]) return
      const d = c.getWorldPosition(_v).distanceTo(e.point)
      if (d < bd) (bd = d), (best = i)
    })
    if (best < 0) return
    S.t0[best] = t
    S.last = best
    S.tree = tiers[best].ti
    S.tk = t
    // the puff and the chunks go where the tier's rim is
    const T = TREES[tiers[best].ti]
    const tr = tiers[best]
    root.current.worldToLocal(tierRefs.current[best].getWorldPosition(_v))
    puff.current.position.copy(_v).setY(_v.y + tr.h * 0.15 * T.s)
    S.pr = tr.r * T.s
    shed.kick(t + 0.18)
  }

  useFrame(() => {
    const t = clock.elapsedTime
    const S = st.current
    // the trees sway, a beat apart; the struck tree shudders
    TREES.forEach((T, i) => {
      const g = trees.current[i]
      if (!g) return
      const w = S.tree === i ? wobble(t - S.tk, 16, 3.5) : 0
      g.rotation.z = Math.sin(t * 0.6 + i * 1.7) * 0.012 * L.sway + w * 0.025 + (L.sway > 1.5 ? 0.02 : 0)
      g.rotation.x = Math.sin(t * 0.47 + i * 2.3) * 0.01 * L.sway + w * 0.015
    })
    tiers.forEach((tr, i) => {
      const s = t - (S.t0[i] ?? -99)
      const g = tierRefs.current[i]
      const cap = capRefs.current[i]
      if (!g || !cap) return
      // weighed down, then rid of the snow it springs up and wobbles
      const load = s < 0.22 ? -0.1 * (s / 0.22) : s < REGROW[1] ? 0.16 * wobble(s - 0.22, 13, 2.6) : 0
      g.scale.set(1 - load * 0.25, 1 + load, 1 - load * 0.25)
      // the cap slides off down the slope and fades, then settles back
      const m = cap.material
      if (s < SLIDE) {
        const k = clamp01(s / SLIDE)
        cap.visible = true
        cap.position.y = tr.h * (CAP_Y - 0.75 * k * k)
        cap.scale.set(tr.r * CAP_R * (1 + 0.7 * k), tr.h * CAP_H * (1 - 0.5 * k), tr.r * CAP_R * (1 + 0.7 * k))
        m.opacity = 1 - k * k
      } else {
        const k = clamp01((s - REGROW[0]) / (REGROW[1] - REGROW[0]))
        cap.visible = k > 0.001
        cap.position.y = tr.h * CAP_Y
        cap.scale.set(tr.r * CAP_R * (0.6 + 0.4 * k), tr.h * CAP_H * k, tr.r * CAP_R * (0.6 + 0.4 * k))
        m.opacity = 1
      }
      m.transparent = m.opacity < 1
      m.depthWrite = m.opacity >= 1
    })
    // the puff: soft balls of powder blooming out from the tier's rim
    const ps = shed.since(t)
    puffBits.current.forEach((b, i) => {
      if (!b) return
      const P = puffs[i]
      const k = clamp01(ps / 1.3)
      b.visible = ps >= 0 && ps < 1.3
      if (!b.visible) return
      const d = 1 + (P.d - 0.6) * (1 - (1 - k) ** 3) * 0.9
      b.position.set(Math.cos(P.a) * d * S.pr, (P.up * k - 0.5 * k * k) * 0.5, Math.sin(P.a) * d * S.pr)
      b.scale.setScalar(Math.max(0.001, 0.075 * P.s * (0.6 + 1.2 * k)))
      b.material.opacity = 0.9 * (1 - k * k)
    })
  })

  return (
    <group ref={root} {...handlers} onClick={onClick}>
      {L.light && <directionalLight position={[-4, 1.5, 3]} intensity={1.1} color={L.light} />}
      {/* the drift: a snowy dome on a shallow slab */}
      <mesh geometry={geo.ground}>
        <Flat vertexColors color={L.snow} roughness={0.95} />
      </mesh>
      <mesh geometry={geo.skirt}>
        <Flat color={L.shade} />
      </mesh>
      {tracks.map((tk, i) => (
        <mesh key={i} geometry={geo.track} position={tk.p} rotation-y={tk.ry} scale={[0.028, 1, 0.018]}>
          <Flat color={L.track} />
        </mesh>
      ))}
      {rocks.map((r, i) => (
        <group key={i} position={r.p} rotation-y={r.ry}>
          <mesh geometry={geo.rock} scale={[r.s * 1.3, r.s, r.s * 1.1]}>
            <Flat color={L.rock} />
          </mesh>
          <mesh geometry={geo.rockCap} position-y={r.s * 0.45} scale={[r.s * 1.15, r.s * 0.5, r.s * 0.95]}>
            <Flat color={L.snow} />
          </mesh>
        </group>
      ))}
      {/* the pines */}
      {TREES.map((T, ti) => (
        <group key={ti} position={[T.x, groundY(T.x, T.z) - 0.02, T.z]} scale={T.s}>
          <group ref={(el) => (trees.current[ti] = el)}>
            <mesh geometry={geo.trunk}>
              <Flat color={L.trunk} />
            </mesh>
            {tiers.map((tr, i) =>
              tr.ti !== ti ? null : (
                <group key={i} ref={(el) => (tierRefs.current[i] = el)} position-y={tr.y}>
                  <mesh geometry={geo.tier[tr.k]} scale={[tr.r, tr.h, tr.r]}>
                    <Flat color={L.pine[(tr.k + ti) % L.pine.length]} />
                  </mesh>
                  <mesh ref={(el) => (capRefs.current[i] = el)} geometry={geo.cap[tr.k]} position-y={tr.h * CAP_Y}>
                    <Flat color={L.snow} roughness={0.9} transparent={false} />
                  </mesh>
                  <group ref={(el) => (centers.current[i] = el)} position-y={tr.h * 0.35} />
                </group>
              ),
            )}
          </group>
        </group>
      ))}
      {/* the puff and the chunks of snow thrown off */}
      <group ref={puff}>
        {puffs.map((_, i) => (
          <mesh key={i} ref={(el) => (puffBits.current[i] = el)} geometry={geo.chunk} visible={false}>
            <Flat color={L.snow} transparent depthWrite={false} />
          </mesh>
        ))}
        <Burst tap={shed} geometry={geo.chunk} count={14} colors={[L.snow, L.shade, '#ffffff']} speed={1.1} gravity={4} size={0.035} life={1.1} origin={[0, 0, 0]} spread={1} up={0.7} seed={8} />
      </group>
      {/* falling snow */}
      <Particles count={L.flakes} life={2.6 / L.fall} origin={[-L.wind * 1.3 / L.fall, 2.7, 0]} spread={L.spread || 1.4} velocity={[L.wind, -L.fall, 0]} scatter={0.05} drift={0.25} size={L.flakeSize || [0.022, 0.03]} colors={L.flake} opacity={[0.95, 0.75]} emissive={0.2} geometry={geo.flake} spin={1.5} seed={4} />
    </group>
  )
}

export default function SnowyPinesScene({ background, autoRotate, float, look = 'day', ...props }) {
  const L = LOOKS[look] || LOOKS.day
  const bg = L.bg && (!background || background.toLowerCase() === DEFAULT_BG) ? L.bg : background
  return (
    <Stage background={bg} autoRotate={autoRotate} float={float} camera={[3.2, 2.3, 4.3]} target={[0, 0.65, 0]} hint="Snow falls softly and the pines sway · tap a tree and the snow slides off the branch nearest your tap in a puff, the branch springs up and the snow slowly settles back · Look swaps day, dusk and blizzard · drag to orbit">
      <SnowyPines look={look} {...props} />
    </Stage>
  )
}

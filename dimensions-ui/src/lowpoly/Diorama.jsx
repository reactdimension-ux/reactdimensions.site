import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flame, Flat, Flow, Particles, Ripple, Stage, Sway, TAU, blob, cone, facet, lookAround, rng, ribbonGeo, useGeo, useKick, useTap } from './kit.jsx'

// A floating low-poly diorama: a square slab of grass on a block of earth,
// with a river that wells up at the foot of a white crag, winds across the
// meadow and spills off the front edge as a waterfall. Pines to the left,
// round trees and a bear to the right, two tents round a campfire, a
// signpost, and a goat keeping watch on the top of the crag while birds
// circle it. The river flows, the fire flickers, the trees stir and a fish
// leaps now and then. Tap it to make the fish jump and the fire flare.

const LOOKS = {
  summer: { grass: '#4faa48', grass2: '#5ab852', lip: '#3f963c', bank: '#a8925a', sand: '#dca25a', pine: '#2f8a45', pine2: '#3aa050', leaf: '#6cbf4a', leaf2: '#55ac3c', water: '#4ab4e6', flowers: ['#ffd23f', '#ffffff', '#ff8fb3'] },
  autumn: { grass: '#93a84a', grass2: '#a3b655', lip: '#7f923c', bank: '#a8885a', sand: '#d89a55', pine: '#2c7a44', pine2: '#368c4c', leaf: '#f08a2a', leaf2: '#e0602a', water: '#3fa2d2', flowers: ['#e0602a', '#ffd23f', '#b8442a'] },
  winter: { grass: '#eef3f8', grass2: '#e2e9f1', lip: '#cfd9e4', bank: '#c2ccd6', sand: '#e8e3dc', pine: '#2a6a48', pine2: '#337a52', leaf: '#f4f7fb', leaf2: '#dde5ee', water: '#7cc6e6', flowers: ['#ffffff', '#cfe6ff'] },
  spring: { grass: '#5cc456', grass2: '#6ad062', lip: '#4aac46', bank: '#b09a62', sand: '#e4b06a', pine: '#33944a', pine2: '#40a858', leaf: '#f6a9c8', leaf2: '#ee8cb6', water: '#52bdea', flowers: ['#ffd23f', '#ffffff', '#c58cff', '#ff8fb3'] },
}

const S = 1.5 // half the slab's width
const LIP = 0.1 // grass lip thickness
const SOIL = 0.75 // earth block depth
const LIFT = 0.3 + LIP + SOIL // the slab floats this high
const RW = 0.15 // river half width (full depth)
const BANK = 0.07 // bank slope width
const DEPTH = 0.07 // river bed depth
const WATER = -0.025 // river surface height
const ROCK = [-0.15, 0, -0.95] // crag centre
const SAND = [-0.5, 0.82] // campsite centre
const FIRE = [-0.42, 0.78]
const XE = 0.72 // where the river leaves the front edge

// the river: from the foot of the crag, across the meadow, out over the edge
const river = new THREE.CatmullRomCurve3(
  [
    [-0.25, -0.52],
    [0.02, -0.15],
    [0.15, 0.32],
    [0.6, 0.95],
    [XE, S + 0.05],
  ].map(([x, z]) => new THREE.Vector3(x, WATER, z)),
  false,
  'centripetal',
)
const riverPath = (u) => river.getPoint(u)
const RIVER_PTS = river.getSpacedPoints(120)
function riverDist(x, z) {
  let m = Infinity
  for (const p of RIVER_PTS) m = Math.min(m, (p.x - x) ** 2 + (p.z - z) ** 2)
  return Math.sqrt(m)
}
const channel = (d) => (d < RW ? -DEPTH : d < RW + BANK ? -DEPTH * 0.5 * (1 + Math.cos((Math.PI * (d - RW)) / BANK)) : 0)

// the fall: down the front face of the earth block, bowing out a little
const FALL_H = LIP + SOIL + 0.02
const fallPath = (u) => new THREE.Vector3(XE, WATER - u * FALL_H, S + 0.05 + 0.06 * Math.sin(u * Math.PI * 0.5))
const fallAcross = () => new THREE.Vector3(1, 0, 0)

// ---- geometry ----

const N = 48 // ground grid cells a side
function groundGeo(L) {
  const r = rng(11)
  const H = []
  for (let j = 0; j <= N; j++)
    for (let i = 0; i <= N; i++) {
      const x = -S + (2 * S * i) / N
      const z = -S + (2 * S * j) / N
      const edge = i === 0 || j === 0 || i === N || j === N
      H.push((edge ? 0 : (r() - 0.5) * 0.024) + channel(riverDist(x, z)))
    }
  const at = (i, j) => [-S + (2 * S * i) / N, H[j * (N + 1) + i], -S + (2 * S * j) / N]
  const pos = []
  const col = []
  const c = new THREE.Color()
  const face = (a, b, d) => {
    pos.push(...a, ...b, ...d)
    const cx = (a[0] + b[0] + d[0]) / 3
    const cz = (a[2] + b[2] + d[2]) / 3
    const rd = riverDist(cx, cz)
    const sd = Math.hypot(cx - SAND[0], cz - SAND[1])
    if (rd < RW + BANK * 0.85) c.set(L.bank)
    else if (sd < 0.46 + (r() - 0.5) * 0.12) c.set(L.sand)
    else c.set(r() < 0.5 ? L.grass : L.grass2)
    c.multiplyScalar(0.94 + r() * 0.12)
    for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b)
  }
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const a = at(i, j)
      const b = at(i + 1, j)
      const d = at(i, j + 1)
      const e = at(i + 1, j + 1)
      if ((i + j) % 2) {
        face(a, d, b)
        face(b, d, e)
      } else {
        face(a, d, e)
        face(a, e, b)
      }
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.computeVertexNormals()

  // the grass lip: a band round the edge, from the ground down to the earth
  const lip = []
  const sides = [
    Array.from({ length: N + 1 }, (_, i) => [i, 0]),
    Array.from({ length: N + 1 }, (_, i) => [i, N]),
    Array.from({ length: N + 1 }, (_, j) => [0, j]),
    Array.from({ length: N + 1 }, (_, j) => [N, j]),
  ]
  for (const side of sides)
    for (let k = 0; k < N; k++) {
      const a = at(...side[k])
      const b = at(...side[k + 1])
      const a2 = [a[0], -LIP, a[2]]
      const b2 = [b[0], -LIP, b[2]]
      lip.push(...a, ...b, ...a2, ...b, ...b2, ...a2)
    }
  const l = new THREE.BufferGeometry()
  l.setAttribute('position', new THREE.Float32BufferAttribute(lip, 3))
  l.computeVertexNormals()
  return { ground: g, lip: l }
}

// the block of earth: two tones of soil with darker stones set in the faces
function soilGeo() {
  const top = -LIP
  const g = facet(new THREE.BoxGeometry(2 * S, SOIL, 2 * S, 8, 4, 8).translate(0, top - SOIL / 2, 0), 0.03, 21, [1, 0.8, 1], (x, y) => y > top - 1e-4).toNonIndexed()
  g.computeVertexNormals()
  const p = g.attributes.position
  const r = rng(22)
  const col = new Float32Array(p.count * 3)
  const c = new THREE.Color()
  for (let f = 0; f < p.count; f += 3) {
    const y = (p.getY(f) + p.getY(f + 1) + p.getY(f + 2)) / 3
    c.set(r() < 0.14 ? '#4a3022' : y > top - SOIL * 0.45 ? '#6e4a33' : '#5a3b29').multiplyScalar(0.93 + r() * 0.14)
    for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (f + k) * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}

function prism(w, h, d) {
  const s = new THREE.Shape()
  s.moveTo(-w / 2, 0)
  s.lineTo(w / 2, 0)
  s.lineTo(0, h)
  s.closePath()
  return new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2)
}
function tri(w, h) {
  const s = new THREE.Shape()
  s.moveTo(-w / 2, 0)
  s.lineTo(w / 2, 0)
  s.lineTo(0, h)
  s.closePath()
  return new THREE.ShapeGeometry(s)
}

// ---- the set pieces ----

const PINES = [
  [-1.25, -1.2, 1.15],
  [-1.22, -0.58, 1.3],
  [-0.88, -1.0, 0.95],
  [-0.95, -0.25, 0.85],
  [-1.28, 0.12, 1.05],
  [-1.3, 0.72, 0.8],
  [0.24, 1.3, 0.9],
]
const ROUND = [
  [1.12, -0.88, 1.2],
  [0.72, -1.22, 0.95],
  [1.25, -0.25, 0.9],
  [0.6, -0.62, 0.7],
]
const BARE = [
  [-0.78, -1.32, 1, 0.4],
  [0.36, -1.28, 0.85, 2.1],
]
const BUSHES = [
  [0.32, -0.5, 1],
  [-0.62, -0.55, 0.9],
  [0.2, -0.72, 0.7],
  [-0.5, -0.38, 0.6],
  [1.3, 0.55, 0.8],
]
// reeds just off the water's edge, alternating banks
const REEDS = [0.22, 0.3, 0.46, 0.62, 0.7, 0.8].map((u, i) => {
  const p = river.getPoint(u)
  const d = river.getTangent(u)
  const k = (i % 2 ? 1 : -1) * (RW + BANK * 0.6)
  return [p.x - d.z * k, p.z + d.x * k]
})
const TENTS = [
  [-0.95, 0.5],
  [-0.22, 1.2],
]

function Pine({ geo, L, x, z, s, i }) {
  return (
    <group position={[x, 0, z]} scale={s}>
      <mesh geometry={geo.trunk}>
        <Flat color="#6a4430" />
      </mesh>
      <Sway rate={0.35} amp={0.025} i={i}>
        <mesh geometry={geo.pineA} position-y={0.08}>
          <Flat color={L.pine} />
        </mesh>
        <mesh geometry={geo.pineB} position-y={0.26}>
          <Flat color={L.pine2} />
        </mesh>
        <mesh geometry={geo.pineC} position-y={0.43}>
          <Flat color={L.pine} />
        </mesh>
      </Sway>
    </group>
  )
}

function RoundTree({ geo, L, x, z, s, i }) {
  return (
    <group position={[x, 0, z]} scale={s}>
      <mesh geometry={geo.oak}>
        <Flat color="#6a4430" />
      </mesh>
      <Sway rate={0.3} amp={0.03} i={i} axis="x">
        <mesh geometry={geo.crown} position={[0, 0.48, 0]}>
          <Flat color={L.leaf} />
        </mesh>
        <mesh geometry={geo.crown2} position={[0.13, 0.36, 0.08]}>
          <Flat color={L.leaf2} />
        </mesh>
        <mesh geometry={geo.crown2} position={[-0.12, 0.38, -0.06]} scale={0.9}>
          <Flat color={L.leaf2} />
        </mesh>
      </Sway>
    </group>
  )
}

function BareTree({ geo, x, z, s, ry }) {
  return (
    <group position={[x, 0, z]} scale={s} rotation-y={ry}>
      <mesh geometry={geo.bare}>
        <Flat color="#4f3d31" />
      </mesh>
      {[
        [0.4, 0.7, 0.6],
        [0.55, -0.8, 0.45],
        [0.7, 0.5, 0.35],
        [0.3, -0.4, 0.4],
      ].map(([y, a, l], k) => (
        <mesh key={k} geometry={geo.twig} position-y={y} rotation={[0, k * 1.9, a]} scale={[1, l, 1]}>
          <Flat color="#4f3d31" />
        </mesh>
      ))}
    </group>
  )
}

// the goat on the crag: a little boxy body that turns its head about
function Goat({ geo, clock, ...props }) {
  const head = useRef()
  useFrame(() => {
    const { yaw, pitch } = lookAround(clock.elapsedTime, 2)
    head.current.rotation.set(pitch, yaw * 1.4, 0)
  })
  const legs = [
    [0.035, 0.06],
    [-0.035, 0.06],
    [0.035, -0.06],
    [-0.035, -0.06],
  ]
  return (
    <group {...props}>
      <mesh geometry={geo.box} position-y={0.12} scale={[0.1, 0.08, 0.18]}>
        <Flat color="#f4f2ee" />
      </mesh>
      {legs.map(([x, z], k) => (
        <mesh key={k} geometry={geo.box} position={[x, 0.04, z]} scale={[0.025, 0.09, 0.025]}>
          <Flat color="#d8d4cc" />
        </mesh>
      ))}
      <mesh geometry={geo.box} position={[0, 0.14, -0.1]} rotation-x={-0.6} scale={[0.02, 0.06, 0.02]}>
        <Flat color="#f4f2ee" />
      </mesh>
      <group ref={head} position={[0, 0.17, 0.09]}>
        <mesh geometry={geo.box} position={[0, 0.03, 0.03]} rotation-x={0.35} scale={[0.06, 0.06, 0.08]}>
          <Flat color="#f4f2ee" />
        </mesh>
        {[-1, 1].map((sx) => (
          <mesh key={sx} geometry={geo.horn} position={[sx * 0.02, 0.06, 0.01]} rotation={[-0.7, 0, sx * -0.2]}>
            <Flat color="#5a5550" />
          </mesh>
        ))}
        <mesh geometry={geo.box} position={[0, -0.015, 0.07]} scale={[0.012, 0.03, 0.012]}>
          <Flat color="#d8d4cc" />
        </mesh>
      </group>
    </group>
  )
}

// the bear on the bank: breathes, and dips its head to the water now and then
function Bear({ geo, clock, kick, ...props }) {
  const body = useRef()
  const head = useRef()
  useFrame(() => {
    const t = clock.elapsedTime
    const k = kick.value(t)
    body.current.scale.y = 1 + 0.025 * Math.sin(t * 2.2)
    const dip = Math.max(0, Math.sin(t * 0.55)) ** 3
    head.current.rotation.x = 0.55 * dip - 0.5 * k
    head.current.rotation.y = 0.25 * Math.sin(t * 0.31)
  })
  const brown = '#6b4630'
  return (
    <group {...props}>
      <group ref={body}>
        <mesh geometry={geo.ball} position-y={0.17} scale={[0.13, 0.12, 0.2]}>
          <Flat color={brown} />
        </mesh>
        {[
          [0.07, 0.11],
          [-0.07, 0.11],
          [0.07, -0.11],
          [-0.07, -0.11],
        ].map(([x, z], k) => (
          <mesh key={k} geometry={geo.leg} position={[x, 0, z]}>
            <Flat color="#5a3a28" />
          </mesh>
        ))}
      </group>
      <group ref={head} position={[0, 0.22, 0.17]}>
        <mesh geometry={geo.ball} position={[0, 0, 0.05]} scale={[0.085, 0.08, 0.09]}>
          <Flat color={brown} />
        </mesh>
        <mesh geometry={geo.ball} position={[0, -0.02, 0.13]} scale={[0.04, 0.035, 0.045]}>
          <Flat color="#b08a62" />
        </mesh>
        <mesh geometry={geo.ball} position={[0, -0.005, 0.17]} scale={0.014}>
          <Flat color="#1b1a22" />
        </mesh>
        {[-1, 1].map((sx) => (
          <mesh key={sx} geometry={geo.ball} position={[sx * 0.055, 0.07, 0.03]} scale={0.028}>
            <Flat color={brown} />
          </mesh>
        ))}
        {[-1, 1].map((sx) => (
          <mesh key={`e${sx}`} geometry={geo.ball} position={[sx * 0.035, 0.025, 0.12]} scale={0.011}>
            <Flat color="#1b1a22" />
          </mesh>
        ))}
      </group>
    </group>
  )
}

// a bird flying circles round the crag, flapping
function Bird({ geo, clock, radius, height, speed, phase }) {
  const g = useRef()
  const wings = useRef([])
  useFrame(() => {
    const t = clock.elapsedTime * speed + phase
    g.current.position.set(ROCK[0] + Math.cos(t) * radius, height + 0.08 * Math.sin(t * 2.3), ROCK[2] + Math.sin(t) * radius * 0.8)
    g.current.rotation.y = -t
    g.current.rotation.z = 0.25
    const f = Math.sin(clock.elapsedTime * 9 + phase * 3) * 0.6
    wings.current.forEach((w, k) => w && (w.rotation.z = (k ? -1 : 1) * f))
  })
  return (
    <group ref={g}>
      {[1, -1].map((sx, k) => (
        <group key={sx} ref={(el) => (wings.current[k] = el)} scale={[sx, 1, 1]}>
          <mesh geometry={geo.wing}>
            <Flat color="#3a3a44" side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      <mesh geometry={geo.box} scale={[0.02, 0.02, 0.07]}>
        <Flat color="#2a2a32" />
      </mesh>
    </group>
  )
}

// a fish that leaps the river: every few seconds on its own, and on a tap
function Fish({ geo, clock, jump }) {
  const g = useRef()
  const spot = useMemo(() => {
    const p = river.getPoint(0.55)
    const d = river.getTangent(0.55)
    const a = new THREE.Vector3(-d.z, 0, d.x).normalize()
    return { p, a }
  }, [])
  useFrame(() => {
    const s = jump.since(clock.elapsedTime) / 0.85
    const m = g.current
    m.visible = s >= 0 && s <= 1
    if (!m.visible) return
    const { p, a } = spot
    const h = 0.32
    m.position.set(p.x + a.x * (s - 0.5) * 0.3, WATER + 4 * h * s * (1 - s) - 0.02, p.z + a.z * (s - 0.5) * 0.3)
    m.rotation.set(0, Math.atan2(a.x, a.z), 0)
    m.rotateX(-(1 - 2 * s) * 1.1)
    m.rotateZ(Math.sin(s * 30) * 0.2)
  })
  return (
    <group ref={g} visible={false}>
      <mesh geometry={geo.ball} scale={[0.025, 0.035, 0.07]}>
        <Flat color="#ff8a3a" />
      </mesh>
      <mesh geometry={geo.fin} position-z={-0.075} rotation-x={Math.PI / 2}>
        <Flat color="#f06a2a" side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

export function Diorama({ look = 'summer', flow = 0.6 }) {
  const L = LOOKS[look] || LOOKS.summer
  const { tap, handlers, clock } = useTap(1.2)
  const jump = useKick(1)
  const lastAuto = useRef(-1)

  const geo = useGeo(
    () => ({
      ...groundGeo(L),
      soil: soilGeo(),
      water: ribbonGeo(riverPath, 2 * (RW + 0.045), 90),
      fall: ribbonGeo(fallPath, 0.32, 16, fallAcross),
      rocks: [1, 2, 3, 4, 5, 6].map((s) => facet(new THREE.IcosahedronGeometry(1, 1), 0.09, s * 7)),
      stone: blob(0.05, 9),
      pineA: cone(0.24, 0.36, 7, 1),
      pineB: cone(0.19, 0.3, 7, 2),
      pineC: cone(0.13, 0.25, 7, 3),
      trunk: new THREE.CylinderGeometry(0.035, 0.045, 0.12, 5, 1).translate(0, 0.05, 0),
      oak: new THREE.CylinderGeometry(0.035, 0.05, 0.42, 5, 1).translate(0, 0.19, 0),
      crown: blob(0.22, 5),
      crown2: blob(0.15, 6),
      bush: blob(0.09, 12),
      bare: new THREE.CylinderGeometry(0.012, 0.032, 0.85, 5, 1).translate(0, 0.42, 0),
      twig: new THREE.CylinderGeometry(0.006, 0.012, 1, 4, 1).translate(0, 0.5, 0),
      tent: prism(0.42, 0.34, 0.5),
      door: tri(0.2, 0.26),
      log: facet(new THREE.CylinderGeometry(0.035, 0.04, 0.28, 6, 1).rotateZ(Math.PI / 2), 0.004, 4),
      seat: facet(new THREE.CylinderGeometry(0.055, 0.06, 0.4, 7, 1).rotateZ(Math.PI / 2), 0.006, 5),
      ring: new THREE.CylinderGeometry(0.052, 0.052, 0.005, 7, 1).rotateZ(Math.PI / 2),
      post: new THREE.BoxGeometry(0.035, 0.42, 0.035).translate(0, 0.19, 0),
      bar: new THREE.BoxGeometry(0.22, 0.035, 0.035),
      flower: new THREE.OctahedronGeometry(0.022, 0),
      reed: new THREE.CylinderGeometry(0.004, 0.006, 0.22, 3, 1).translate(0, 0.11, 0),
      cattail: new THREE.CylinderGeometry(0.013, 0.013, 0.06, 5, 1),
      box: new THREE.BoxGeometry(1, 1, 1),
      ball: blob(1, 31),
      leg: new THREE.CylinderGeometry(0.032, 0.036, 0.13, 6, 1).translate(0, 0.06, 0),
      horn: cone(0.008, 0.05, 4, 41),
      wing: (() => {
        const s = new THREE.Shape()
        s.moveTo(0, -0.025)
        s.lineTo(0.13, 0.01)
        s.lineTo(0, 0.03)
        s.closePath()
        return new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2)
      })(),
      fin: (() => {
        const s = new THREE.Shape()
        s.moveTo(0, 0)
        s.lineTo(-0.035, -0.045)
        s.lineTo(0.035, -0.045)
        s.closePath()
        return new THREE.ShapeGeometry(s).rotateY(Math.PI / 2)
      })(),
    }),
    [look],
  )

  // flowers scattered over the open grass
  const flowers = useMemo(() => {
    const r = rng(17)
    const out = []
    for (let n = 0; n < 400 && out.length < 26; n++) {
      const x = (r() - 0.5) * 2 * (S - 0.08)
      const z = (r() - 0.5) * 2 * (S - 0.08)
      if (riverDist(x, z) < 0.3 || Math.hypot(x - SAND[0], z - SAND[1]) < 0.58 || Math.hypot(x - ROCK[0], z - ROCK[2]) < 0.75) continue
      if (PINES.concat(ROUND).some(([px, pz]) => Math.hypot(x - px, z - pz) < 0.2)) continue
      out.push([x, z, L.flowers[out.length % L.flowers.length]])
    }
    return out
  }, [look]) // eslint-disable-line react-hooks/exhaustive-deps

  // the fish jumps every six seconds, and on a tap
  useFrame(() => {
    const t = clock.elapsedTime
    const n = Math.floor((t - 2.5) / 6)
    if (t > 2.5 && n > lastAuto.current) {
      lastAuto.current = n
      jump.kick(t)
    }
  })

  const fire = () => 1 + 1.4 * tap.value(clock.elapsedTime)
  const fishSpot = river.getPoint(0.55)

  return (
    <group
      {...handlers}
      onClick={(e) => {
        handlers.onClick(e)
        if (jump.since(clock.elapsedTime) > 0.9) jump.kick(clock.elapsedTime)
      }}
    >
      <group position-y={LIFT}>
        {/* the slab: grass, its lip and the earth beneath */}
        <mesh geometry={geo.ground}>
          <Flat vertexColors color="#ffffff" />
        </mesh>
        <mesh geometry={geo.lip}>
          <Flat color={L.lip} side={THREE.DoubleSide} />
        </mesh>
        <mesh geometry={geo.soil}>
          <Flat vertexColors color="#ffffff" />
        </mesh>

        {/* the river and the fall */}
        <mesh geometry={geo.water} renderOrder={1}>
          <meshStandardMaterial color={L.water} flatShading roughness={0.2} metalness={0.05} transparent opacity={0.88} depthWrite={false} />
        </mesh>
        <Flow path={riverPath} count={40} speed={0.05 + flow * 0.12} width={0.2} size={0.012} stretch={4} colors={['#ffffff', '#d8f2ff']} opacity={0.85} seed={2} />
        <mesh geometry={geo.fall} renderOrder={1}>
          <meshStandardMaterial color={L.water} flatShading roughness={0.2} transparent opacity={0.85} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <group position-z={0.012}>
          <Flow path={fallPath} across={fallAcross} count={26} speed={0.4 + flow * 0.6} width={0.26} size={0.014} stretch={4} colors={['#ffffff', '#e2f5ff']} opacity={0.9} seed={5} />
        </group>
        <Particles count={14} life={1.6} origin={[XE, -FALL_H + 0.02, S + 0.1]} spread={0.1} velocity={[0, -0.12, 0.12]} scatter={0.12} drift={0.1} size={[0.02, 0.055]} colors={['#ffffff', '#e8f6ff']} opacity={[0.45, 0]} active={0.4 + flow * 0.6} seed={6} />
        <Particles count={8} life={2} origin={[river.getPoint(0).x, WATER + 0.02, river.getPoint(0).z]} spread={0.08} velocity={[0, 0.12, 0.08]} scatter={0.08} drift={0.08} size={[0.02, 0.06]} colors={['#ffffff']} opacity={[0.6, 0]} seed={7} />

        {/* the leaping fish and its splash */}
        <Fish geo={geo} clock={clock} jump={jump} />
        <group position={[fishSpot.x, WATER + 0.005, fishSpot.z]}>
          <Ripple tap={jump} count={3} color="#ffffff" radius={0.35} life={1.1} opacity={0.6} />
          <Burst tap={jump} geometry={geo.flower} count={10} colors={['#ffffff', '#cfeaff']} speed={0.9} gravity={4} size={0.6} life={0.6} origin={[0, 0.02, 0]} up={1.2} spread={0.6} seed={8} />
        </group>

        {/* the crag, with a goat on top and birds circling it */}
        <group position={ROCK}>
          {[
            [0, 0.42, 0, 0.55, [1, 1.25, 0.9], '#ececf0'],
            [0.36, 0.28, 0.16, 0.38, [1, 0.9, 1], '#dcdce3'],
            [-0.4, 0.24, 0.08, 0.36, [1, 1, 0.9], '#e4e4ea'],
            [0.05, 0.92, -0.04, 0.3, [1, 0.95, 1], '#f4f4f7'],
            [0.22, 0.66, 0.2, 0.25, [1, 0.9, 1], '#d2d2da'],
            [-0.25, 0.7, -0.1, 0.24, [1, 1, 1], '#dedee5'],
          ].map(([x, y, z, rad, [sx, sy, sz], c], k) => (
            <mesh key={k} geometry={geo.rocks[k]} position={[x, y, z]} scale={[rad * sx, rad * sy, rad * sz]}>
              <Flat color={c} />
            </mesh>
          ))}
          {[
            [0.42, 0.56, 0.24, 0.8],
            [-0.36, 0.55, 0.22, 0.7],
            [0.22, 0.85, 0.3, 0.55],
          ].map(([x, y, z, s], k) => (
            <mesh key={k} geometry={geo.bush} position={[x, y, z]} scale={[s, s * 0.6, s]}>
              <Flat color={L.leaf2} />
            </mesh>
          ))}
          <Goat geo={geo} clock={clock} position={[0.05, 1.17, -0.04]} rotation-y={0.7} />
        </group>
        <Bird geo={geo} clock={clock} radius={0.75} height={2.0} speed={0.5} phase={0} />
        <Bird geo={geo} clock={clock} radius={0.95} height={2.25} speed={0.42} phase={2.4} />

        {/* trees */}
        {PINES.map(([x, z, s], i) => (
          <Pine key={i} geo={geo} L={L} x={x} z={z} s={s} i={i} />
        ))}
        {ROUND.map(([x, z, s], i) => (
          <RoundTree key={i} geo={geo} L={L} x={x} z={z} s={s} i={i + 2} />
        ))}
        {BARE.map(([x, z, s, ry], i) => (
          <BareTree key={i} geo={geo} x={x} z={z} s={s} ry={ry} />
        ))}
        {BUSHES.map(([x, z, s], i) => (
          <mesh key={i} geometry={geo.bush} position={[x, 0.03, z]} scale={[s, s * 0.7, s]}>
            <Flat color={i % 2 ? L.leaf2 : L.pine2} />
          </mesh>
        ))}

        {/* reeds on the banks */}
        {REEDS.map(([x, z], i) => (
          <group key={i} position={[x, 0, z]}>
            <Sway rate={0.6} amp={0.08} i={i} axis="x">
              <mesh geometry={geo.reed}>
                <Flat color="#5a8a3a" />
              </mesh>
              <mesh geometry={geo.cattail} position-y={0.2}>
                <Flat color="#6a4430" />
              </mesh>
            </Sway>
          </group>
        ))}

        {/* flowers */}
        {flowers.map(([x, z, c], i) => (
          <mesh key={i} geometry={geo.flower} position={[x, 0.025, z]}>
            <Flat color={c} emissive={c} emissiveIntensity={0.15} />
          </mesh>
        ))}

        {/* the bear on the far bank */}
        <Bear geo={geo} clock={clock} kick={tap} position={[0.78, 0, 0.26]} rotation-y={-Math.PI / 2 - 0.35} />

        {/* the campsite: two tents round a fire, logs to sit on */}
        {TENTS.map(([x, z], i) => (
          <group key={i} position={[x, 0, z]} rotation-y={Math.atan2(FIRE[0] - x, FIRE[1] - z)}>
            <mesh geometry={geo.tent}>
              <Flat color={i ? '#f29a2e' : '#ee8424'} side={THREE.DoubleSide} />
            </mesh>
            <mesh geometry={geo.door} position-z={0.252}>
              <Flat color="#5a2e14" />
            </mesh>
          </group>
        ))}
        <group position={[FIRE[0], 0, FIRE[1]]}>
          {Array.from({ length: 7 }, (_, i) => (
            <mesh key={i} geometry={geo.stone} position={[Math.cos((i / 7) * TAU) * 0.13, 0.02, Math.sin((i / 7) * TAU) * 0.13]} scale={[1, 0.7, 1]}>
              <Flat color={i % 2 ? '#8d8a85' : '#a6a29b'} />
            </mesh>
          ))}
          {[0, 1, 2].map((i) => (
            <mesh key={i} geometry={geo.log} position-y={0.03} rotation-y={(i / 3) * Math.PI} scale={0.75}>
              <Flat color="#5c3c2a" />
            </mesh>
          ))}
          <Flame size={0.32} position-y={0.02} power={fire} />
          <Particles count={8} life={1.4} origin={[0, 0.14, 0]} spread={0.04} velocity={[0, 0.5, 0]} scatter={0.06} drift={0.12} size={[0.012, 0.003]} colors={['#ffb02e', '#ff6a1f']} opacity={[1, 0.2]} emissive={1.5} />
          <Burst tap={tap} count={12} colors={['#ffb02e', '#ff6a1f', '#fff3b0']} speed={1.1} gravity={-0.5} size={0.03} life={1.2} origin={[0, 0.12, 0]} up={1.6} spread={0.4} seed={4} />
          <mesh geometry={geo.seat} position={[0.3, 0.05, 0.12]} rotation-y={1.2}>
            <Flat color="#6e4a34" />
          </mesh>
          <mesh geometry={geo.seat} position={[0.08, 0.05, -0.32]} rotation-y={0.15}>
            <Flat color="#6e4a34" />
          </mesh>
        </group>

        {/* a signpost, a fallen log */}
        <group position={[-0.62, 0, 0.05]} rotation={[0.04, 0.5, -0.06]}>
          <mesh geometry={geo.post}>
            <Flat color="#8a5a3a" />
          </mesh>
          <mesh geometry={geo.bar} position-y={0.3}>
            <Flat color="#9a6a46" />
          </mesh>
        </group>
        <group position={[1.08, 0.05, 1.08]} rotation-y={0.7}>
          <mesh geometry={geo.seat} scale={[1.3, 0.9, 0.9]}>
            <Flat color="#7a5038" />
          </mesh>
          {[-1, 1].map((sx) => (
            <mesh key={sx} geometry={geo.ring} position-x={sx * 0.262}>
              <Flat color="#d8b48a" />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  )
}

export default function DioramaScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[5.2, 3.8, 6.6]} target={[0, 1.25, 0]} hint="The river runs and spills off the edge, the fire flickers, trees stir, birds circle the crag and a fish leaps every few seconds on their own · tap it to make the fish jump and the fire flare · Flow sets how fast the river runs · Look swaps summer, autumn, winter and spring · drag to orbit">
      <Diorama {...props} />
    </Stage>
  )
}

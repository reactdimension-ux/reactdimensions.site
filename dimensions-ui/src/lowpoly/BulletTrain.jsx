import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Stage, blob, cone, facet, pulse, rng, useGeo, useTap } from './kit.jsx'

// A low-poly bullet train standing at a platform on a short stretch of
// line between two tunnel mouths: a long duck-billed lead car with a
// wraparound windscreen, a stripe running down its flank and onto the nose,
// a band of windows and a pantograph reaching up to the overhead wire,
// coupled to a short second car, on bogies over a ballasted track with
// sleepers and rails. Catenary masts carry the wire along the far side, and
// the platform on the near side has a yellow edge line, a bench, a sign and
// a lamp. Left alone, the train sits humming: it trembles very slightly, its
// headlamps and windows pulse softly and now and then the pantograph throws
// a crackle of blue sparks off the wire. Tap it and it shoots off along the
// track in a blur with speed lines streaming past, vanishes into the far
// tunnel, then glides back out of the near one and brakes to a stop in its
// place. The bogie wheels turn with every bit of travel.

const LOOKS = {
  white: { body: '#f5f5f1', stripe: '#2f6fd0', under: '#9aa1ac', skirt: '#5b616c', glow: '#bfe6ff' },
  red: { body: '#d8392f', stripe: '#f5f1e8', under: '#3d3f47', skirt: '#2d2e34', glow: '#ffe7b8' },
  midnight: { body: '#1f2b47', stripe: '#f2c23a', under: '#2c2d33', skirt: '#1c1d22', glow: '#ffd98a' },
}

const GY = 0.06 // top of the grass
const RT = 0.15 // rail tops, where the bogie wheels sit
const GAUGE = 0.13 // half the distance between the rails
const PORTAL = 1.6 // the tunnel mouths, at x = +-PORTAL
const W = 0.24 // half the car body's width
const BOT = 0.1 // body underside, above the rails
const TOP = 0.56 // roof
const WR = 0.055 // bogie wheel radius
const WIRE = 0.93 // contact wire height above the rails
const SHIFT = 0.5 // the train's rest position along x
const LEAD = { x0: -0.8, x1: 0.82, xn: 0.0 } // the lead car, nose from xn to x1
const CAR2 = { x0: -1.86, x1: -0.86 } // the second car
const GLASS = '#1b2535'

// keep the train between the tunnel mouths (world space clipping planes)
const CLIP = [new THREE.Plane(new THREE.Vector3(-1, 0, 0), PORTAL), new THREE.Plane(new THREE.Vector3(1, 0, 0), PORTAL)]

const clamp01 = (u) => Math.min(1, Math.max(0, u))

// The cross-section, one half from the belly centre round to the roof
// centre (z, y in -1..1). Each row between points is a band: 0-1 skirt,
// 4 the stripe, 6 the window band.
const PROFILE = [
  [0, -1],
  [0.72, -1],
  [0.95, -0.82],
  [1, -0.5],
  [1, -0.28],
  [1, -0.12],
  [0.985, 0.14],
  [0.95, 0.5],
  [0.78, 0.84],
  [0.42, 1],
  [0, 1],
]
const RING = [...PROFILE, ...PROFILE.slice(1, -1).reverse().map(([z, y]) => [-z, y])] // 20 points
const band = (j) => (j < 10 ? j : 19 - j)

// The nose: width, underside and roofline at t (0 where it starts, 1 at the tip).
const noseAt = (t) => ({ w: W * Math.sqrt(Math.max(0, 1 - 0.9 * t ** 2.2)), bot: BOT + 0.055 * t * t, top: TOP - 0.37 * t ** 1.1 })

// A car body lofted through cross-sections along x, every face painted by
// the band it falls in: skirt, body, stripe, and on the nose the
// wraparound windscreen.
function carGeo({ x0, x1, xn }, L) {
  const xs = []
  const bodyEnd = xn ?? x1
  const nb = Math.max(2, Math.round((bodyEnd - x0) / 0.1))
  for (let i = 0; i <= nb; i++) xs.push(x0 + ((bodyEnd - x0) * i) / nb)
  if (xn != null) for (let i = 1; i <= 12; i++) xs.push(xn + (x1 - xn) * (i / 12) ** 0.85)
  const sec = (x) => {
    const t = xn != null ? clamp01((x - xn) / (x1 - xn)) : 0
    const n = noseAt(t)
    const cy = (n.top + n.bot) / 2
    const hh = (n.top - n.bot) / 2
    return { t, pts: RING.map(([z, y]) => [x, cy + y * hh, z * n.w]) }
  }
  const S = xs.map(sec)
  const pos = []
  const col = []
  const c = new THREE.Color()
  const paint = (k, t, j) => {
    const b = band(j)
    if (t > 0.12 && t < 0.42 && b >= (t < 0.34 ? 6 : 7)) return GLASS
    if (b <= 1) return L.skirt
    if (b === 2) return L.under
    if (b === 4) return L.stripe
    return L.body
  }
  const tri = (a, b, d, color) => {
    pos.push(...a, ...b, ...d)
    c.set(color)
    for (let q = 0; q < 3; q++) col.push(c.r, c.g, c.b)
  }
  for (let i = 0; i < S.length - 1; i++) {
    const A = S[i].pts
    const B = S[i + 1].pts
    const t = (S[i].t + S[i + 1].t) / 2
    for (let j = 0; j < 20; j++) {
      const k = (j + 1) % 20
      const color = paint(i, t, j)
      tri(A[j], B[j], B[k], color)
      tri(A[j], B[k], A[k], color)
    }
  }
  // end caps: a flat back, and at the front either a flat end or the nose tip
  const cap = (s, dir, tip) => {
    const ctr = tip || [s.pts[0][0], (s.pts[0][1] + s.pts[10][1]) / 2, 0]
    for (let j = 0; j < 20; j++) {
      const k = (j + 1) % 20
      const color = band(j) <= 1 ? L.skirt : band(j) === 4 ? L.stripe : L.body
      if (dir > 0) tri(s.pts[j], s.pts[k], ctr, color)
      else tri(s.pts[k], s.pts[j], ctr, color)
    }
  }
  cap(S[0], 1)
  const last = S[S.length - 1]
  cap(last, -1, xn != null ? [x1 + 0.05, (last.pts[0][1] + last.pts[10][1]) / 2 - 0.005, 0] : null)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

// A tube from a to b in the x/y plane.
function tube(r, a, b, sides = 5) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  return new THREE.CylinderGeometry(r, r, len, sides).rotateZ(-Math.atan2(b[0] - a[0], b[1] - a[1])).translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0)
}

// Clipped flat material for every part of the train.
const C = (props) => <Flat clippingPlanes={CLIP} {...props} />

// when the pantograph sparks: every few seconds, at uneven times
const SPARK_EVERY = 2.6
const sparkHash = (n) => {
  const r = Math.sin(n * 91.7 + 3.1) * 43758.5453
  return r - Math.floor(r)
}
function lastSpark(t) {
  let n = Math.floor(t / SPARK_EVERY)
  let e = n * SPARK_EVERY + sparkHash(n) * 1.4
  if (e > t) {
    n -= 1
    e = n * SPARK_EVERY + sparkHash(n) * 1.4
  }
  return t - e
}

// the run: out through the far tunnel and back in through the near one
const OUT = 3.05 // travel until the last car is inside the far tunnel
const BACK = 3.0 // where it reappears, behind the near tunnel
function travel(s) {
  if (s < 0.2) return 0
  if (s < 1.1) return OUT * ((s - 0.2) / 0.9) ** 2.3
  if (s < 1.55) return OUT
  if (s < 4.1) return OUT + BACK * (1 - (1 - (s - 1.55) / 2.55) ** 2.6)
  return OUT + BACK
}

export function BulletTrain({ look = 'white' }) {
  const L = LOOKS[look] || LOOKS.white
  const gl = useThree((s) => s.gl)
  const { tap, handlers, clock } = useTap(1.2)
  const train = useRef()
  const wheels = useRef([])
  const lamps = useRef([])
  const arc = useRef()
  const arcLight = useRef()
  const lines = useRef([])
  const prev = useRef(0)

  useEffect(() => {
    gl.localClippingEnabled = true
  }, [gl])
  // one shared material for every window pane, so they pulse together
  const winMat = useMemo(() => new THREE.MeshStandardMaterial({ color: GLASS, emissive: L.glow, emissiveIntensity: 0.4, flatShading: true, roughness: 0.2, clippingPlanes: CLIP }), [L.glow])
  useEffect(() => () => winMat.dispose(), [winMat])

  const geo = useGeo(() => {
    const ring = new THREE.Shape()
    ring.moveTo(-0.62, 0)
    ring.lineTo(0.62, 0)
    ring.lineTo(0.62, 1.32)
    ring.lineTo(-0.62, 1.32)
    ring.closePath()
    const hole = new THREE.Path()
    hole.moveTo(-0.36, 0)
    hole.lineTo(0.36, 0)
    hole.lineTo(0.36, 0.74)
    hole.absarc(0, 0.74, 0.36, 0, Math.PI, false)
    hole.lineTo(-0.36, 0)
    ring.holes.push(hole)
    return {
      lead: carGeo(LEAD, L),
      car2: carGeo(CAR2, L),
      grass: facet(new THREE.CylinderGeometry(1, 1.02, GY, 22, 1).translate(0, GY / 2, 0), 0.02, 1, [1, 0.3, 1]),
      ballast: facet(new THREE.BoxGeometry(PORTAL * 2 + 0.1, 0.05, 0.6, 16, 1, 2), 0.012, 2, [0.4, 1, 0.4]),
      sleeper: new THREE.BoxGeometry(0.06, 0.025, 0.4),
      rail: new THREE.BoxGeometry(PORTAL * 2 + 0.1, 0.028, 0.025),
      wheel: facet(new THREE.CylinderGeometry(WR, WR, 0.03, 10).rotateX(Math.PI / 2), 0.002, 3),
      spoke: new THREE.BoxGeometry(WR * 1.5, 0.014, 0.034),
      bogie: facet(new THREE.BoxGeometry(0.34, 0.055, 0.2), 0.003, 4),
      axle: new THREE.CylinderGeometry(0.012, 0.012, GAUGE * 2 + 0.04, 5).rotateX(Math.PI / 2),
      gangway: new THREE.BoxGeometry(0.1, 0.34, 0.38),
      pane: new THREE.BoxGeometry(0.085, 0.07, 0.006),
      door: new THREE.BoxGeometry(0.07, 0.24, 0.005),
      lamp: new THREE.IcosahedronGeometry(1, 0),
      tail: new THREE.BoxGeometry(0.006, 0.03, 0.06),
      pBase: new THREE.BoxGeometry(0.16, 0.03, 0.18),
      pLow: tube(0.01, [-0.06, 0.02], [0.12, 0.2]),
      pUp: tube(0.008, [0.12, 0.2], [-0.02, WIRE - TOP - 0.01]),
      pHead: new THREE.BoxGeometry(0.03, 0.018, 0.34),
      pHorn: new THREE.BoxGeometry(0.02, 0.012, 0.06),
      insulator: new THREE.CylinderGeometry(0.018, 0.018, 0.035, 6),
      arc: new THREE.OctahedronGeometry(1, 0),
      // the line side
      mast: facet(new THREE.BoxGeometry(0.05, 1.12, 0.05).translate(0, 0.56, 0), 0.002, 5),
      boom: new THREE.BoxGeometry(0.03, 0.03, 0.72),
      wire: new THREE.BoxGeometry(PORTAL * 2, 0.008, 0.008),
      dropper: new THREE.BoxGeometry(0.006, 0.1, 0.006),
      platform: facet(new THREE.BoxGeometry(PORTAL * 2 - 0.3, 0.12, 0.5), 0.004, 6),
      edge: new THREE.BoxGeometry(PORTAL * 2 - 0.3, 0.006, 0.04),
      bench: new THREE.BoxGeometry(0.3, 0.025, 0.08),
      benchLeg: new THREE.BoxGeometry(0.02, 0.08, 0.06),
      post: new THREE.BoxGeometry(0.025, 0.36, 0.025),
      sign: facet(new THREE.BoxGeometry(0.42, 0.11, 0.03), 0.002, 7),
      signFace: new THREE.BoxGeometry(0.36, 0.05, 0.034),
      lampPost: new THREE.CylinderGeometry(0.012, 0.016, 0.5, 5).translate(0, 0.25, 0),
      lampHead: new THREE.BoxGeometry(0.07, 0.04, 0.07),
      portal: facet(new THREE.ExtrudeGeometry(ring, { depth: 0.24, bevelEnabled: false, curveSegments: 6 }).rotateY(Math.PI / 2), 0.008, 8),
      dark: new THREE.BoxGeometry(0.2, 1.1, 0.72),
      back: new THREE.BoxGeometry(0.012, 1.32, 1.24),
      mound: facet(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0.05, 9),
      tuft: cone(0.04, 0.09, 4, 9),
      rock: blob(1, 5, 0),
      streak: new THREE.BoxGeometry(1, 0.014, 0.014),
      spark: new THREE.TetrahedronGeometry(1, 0),
      hit: new THREE.BoxGeometry(2.8, 1.0, 0.6),
    }
  }, [look])

  // bogies: two under each car (x in train space)
  const BOGIES = [-0.58, 0.18, -1.66, -1.06]
  const sleepers = useMemo(() => Array.from({ length: 19 }, (_, i) => -PORTAL + 0.06 + (i * (PORTAL * 2 - 0.12)) / 18), [])
  const streaks = useMemo(() => {
    const r = rng(12)
    return Array.from({ length: 26 }, (_, i) => {
      const side = i % 3 === 0 ? 0 : i % 3 === 1 ? 1 : -1
      return { off: r(), len: 0.35 + r() * 0.5, y: side === 0 ? RT + TOP + 0.05 + r() * 0.25 : RT + 0.15 + r() * 0.5, z: side === 0 ? (r() - 0.5) * 0.4 : side * (0.3 + r() * 0.2), v: 0.8 + r() * 0.5 }
    })
  }, [])
  const tufts = useMemo(() => {
    const r = rng(4)
    return Array.from({ length: 12 }, (_, i) => [(r() - 0.5) * 3.4, (i % 2 ? -1 : 1) * (0.5 + r() * 0.5)]).filter(([x, z]) => (x / 2.1) ** 2 + (z / 1.2) ** 2 < 0.85 && !(z > 0.3 && z < 0.95 && Math.abs(x) < 1.5))
  }, [])

  // where the nose lamps sit on the nose's flank
  const lampPos = useMemo(() => {
    const t = 0.62
    const n = noseAt(t)
    return { x: LEAD.xn + (LEAD.x1 - LEAD.xn) * t, y: n.bot + (n.top - n.bot) * 0.3, z: n.w * 0.93 }
  }, [])

  const sparkSince = useMemo(
    () => ({
      since: (t) => {
        const s = tap.since(t)
        return s >= 0 && s < 4.4 ? 99 : lastSpark(t)
      },
    }),
    [tap],
  )

  useFrame((_, dt) => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const p = s >= 0 ? travel(s) : 0
    const x = p < OUT ? p : p - (OUT + BACK)
    const speed = Math.abs(p - prev.current) / Math.max(dt, 1e-3)
    prev.current = p
    const blur = clamp01(speed / 3.5)
    const T = train.current
    T.position.set(SHIFT + x, RT + 0.0015 * Math.sin(t * 61) + 0.001 * Math.sin(t * 37), 0)
    T.scale.x = 1 + 0.1 * blur
    // the wheels turn with the run
    wheels.current.forEach((w) => w && (w.rotation.z = -p / WR))
    // headlamps and windows pulse softly; a flare as it sets off
    const flare = s >= 0 && s < 1.2 ? Math.sin(Math.PI * clamp01(s / 1.2)) : 0
    const k = pulse(t, 0.45)
    lamps.current.forEach((m) => m && (m.material.emissiveIntensity = 0.9 + 0.8 * k + 1.5 * flare))
    winMat.emissiveIntensity = 0.3 + 0.35 * pulse(t, 0.3, 1)
    // the pantograph's spark: a brief blue flash at the wire
    const ss = sparkSince.since(t)
    const on = ss >= 0 && ss < 0.16
    arc.current.visible = on
    if (on) arc.current.scale.setScalar(0.02 + 0.03 * Math.abs(Math.sin(ss * 90)))
    arcLight.current.intensity = on ? 1.6 * (1 - ss / 0.16) : 0
    // speed lines streaming past while it rushes
    streaks.forEach((st, i) => {
      const m = lines.current[i]
      if (!m) return
      m.visible = blur > 0.05
      if (!m.visible) return
      const span = PORTAL * 2 - 0.2
      const u = (st.off + t * 2.2 * st.v) % 1
      m.position.set(PORTAL - 0.1 - u * span, st.y, st.z)
      m.scale.set(st.len * (0.5 + blur), 1, 1)
      m.material.opacity = 0.9 * blur * Math.min(1, u * 6, (1 - u) * 6)
    })
  })

  const bogie = (bx, i) => (
    <group key={bx} position-x={bx}>
      <mesh geometry={geo.bogie} position-y={WR + 0.02}>
        <C color="#2b2c32" />
      </mesh>
      {[-0.1, 0.1].map((ax, a) => (
        <group key={ax} position={[ax, WR, 0]}>
          <mesh geometry={geo.axle}>
            <C color="#55585f" />
          </mesh>
          {[-1, 1].map((sz, si) => (
            <group key={sz} ref={(el) => (wheels.current[i * 4 + a * 2 + si] = el)} position-z={sz * GAUGE}>
              <mesh geometry={geo.wheel}>
                <C color="#6b6f78" metalness={0.4} roughness={0.45} />
              </mesh>
              <mesh geometry={geo.spoke} position-z={sz * 0.002}>
                <C color="#2b2c32" />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </group>
  )

  // window panes along the window band, both sides
  const winY = (BOT + TOP) / 2 + ((TOP - BOT) / 2) * 0.32
  const panes = (from, to) => {
    const out = []
    for (let x = from; x <= to + 1e-6; x += 0.12) out.push(x)
    return out
  }
  const leadPanes = panes(-0.66, -0.06)
  const car2Panes = panes(-1.74, -0.98)

  return (
    <group {...handlers}>
      {/* ground, ballast, sleepers and rails */}
      <mesh geometry={geo.grass} scale={[2.3, 1, 1.25]}>
        <Flat color="#7cb84f" />
      </mesh>
      <mesh geometry={geo.ballast} position-y={GY + 0.025}>
        <Flat color="#a39d94" />
      </mesh>
      {sleepers.map((x) => (
        <mesh key={x} geometry={geo.sleeper} position={[x, GY + 0.06, 0]}>
          <Flat color="#6f6a64" />
        </mesh>
      ))}
      {[-1, 1].map((sz) => (
        <mesh key={sz} geometry={geo.rail} position={[0, RT - 0.014, sz * GAUGE]}>
          <Flat color="#9aa0a8" metalness={0.55} roughness={0.35} />
        </mesh>
      ))}

      {/* the platform on the near side */}
      <group position={[0, GY, 0.68]}>
        <mesh geometry={geo.platform} position-y={0.06}>
          <Flat color="#cfcbc4" />
        </mesh>
        <mesh geometry={geo.edge} position={[0, 0.123, -0.2]}>
          <Flat color="#f2cf3a" />
        </mesh>
        <group position={[-0.55, 0.12, 0.1]}>
          <mesh geometry={geo.bench} position-y={0.08}>
            <Flat color="#8a5c36" />
          </mesh>
          {[-0.12, 0.12].map((x) => (
            <mesh key={x} geometry={geo.benchLeg} position={[x, 0.04, 0]}>
              <Flat color="#3a3b42" />
            </mesh>
          ))}
        </group>
        <group position={[-1.05, 0.12, 0.05]} rotation-y={Math.PI / 2}>
          {[-0.17, 0.17].map((x) => (
            <mesh key={x} geometry={geo.post} position={[x, 0.18, 0]}>
              <Flat color="#3a3b42" />
            </mesh>
          ))}
          <mesh geometry={geo.sign} position-y={0.38}>
            <Flat color="#2f4a7a" />
          </mesh>
          <mesh geometry={geo.signFace} position-y={0.38}>
            <Flat color="#f5f5f1" emissive="#ffffff" emissiveIntensity={0.15} />
          </mesh>
        </group>
        {[0.15].map((x) => (
          <group key={x} position={[x, 0.12, 0.17]}>
            <mesh geometry={geo.lampPost}>
              <Flat color="#3a3b42" />
            </mesh>
            <mesh geometry={geo.lampHead} position-y={0.5}>
              <Flat color="#fff4c4" emissive="#ffe08a" emissiveIntensity={0.8} />
            </mesh>
          </group>
        ))}
      </group>

      {/* catenary masts on the far side, the wire over the track */}
      {[-1.15, 0, 1.15].map((x) => (
        <group key={x} position={[x, GY, -0.5]}>
          <mesh geometry={geo.mast}>
            <Flat color="#7d828c" />
          </mesh>
          <mesh geometry={geo.boom} position={[0, 1.08, 0.33]}>
            <Flat color="#7d828c" />
          </mesh>
          <mesh geometry={geo.insulator} position={[0, 1.04, 0.5]}>
            <Flat color="#b5653a" />
          </mesh>
          <mesh geometry={geo.dropper} position={[0, RT + WIRE - GY + 0.05, 0.5]}>
            <Flat color="#4a4d55" />
          </mesh>
        </group>
      ))}
      <mesh geometry={geo.wire} position={[0, RT + WIRE + 0.004, 0]}>
        <Flat color="#3a3b42" />
      </mesh>
      <mesh geometry={geo.wire} position={[0, GY + 1.08, 0]}>
        <Flat color="#4a4d55" />
      </mesh>

      {/* tunnel mouths in grassy mounds at both ends */}
      {[-1, 1].map((sx) => (
        <group key={sx} scale={[sx, 1, 1]}>
          <mesh geometry={geo.portal} position={[PORTAL, GY, 0]}>
            <Flat color="#b9b1a4" />
          </mesh>
          <mesh geometry={geo.dark} position={[PORTAL + 0.13, GY + 0.55, 0]}>
            <Flat color="#17161c" />
          </mesh>
          <mesh geometry={geo.back} position={[PORTAL + 0.235, GY + 0.66, 0]}>
            <Flat color="#a9a194" />
          </mesh>
          <mesh geometry={geo.mound} position={[PORTAL + 0.52, GY, 0]} scale={[0.52, 1.15, 0.98]}>
            <Flat color="#6aa846" />
          </mesh>
        </group>
      ))}
      {tufts.map(([x, z], i) => (
        <mesh key={i} geometry={geo.tuft} position={[x, GY, z]} rotation-y={i}>
          <Flat color={i % 2 ? '#5f9a3e' : '#6fae48'} />
        </mesh>
      ))}
      {[
        [-0.9, -0.95, 0.07],
        [0.75, -1.0, 0.06],
      ].map(([x, z, sc], i) => (
        <mesh key={i} geometry={geo.rock} position={[x, GY + sc * 0.3, z]} scale={[sc * 1.3, sc, sc]} rotation-y={i}>
          <Flat color={i % 2 ? '#b4b2ae' : '#a5a29c'} />
        </mesh>
      ))}

      {/* the train, in its own frame: x along the track, rail tops at y = 0 */}
      <group ref={train} position={[SHIFT, RT, 0]}>
        <mesh geometry={geo.lead}>
          <C vertexColors color="#ffffff" />
        </mesh>
        <mesh geometry={geo.car2}>
          <C vertexColors color="#ffffff" />
        </mesh>
        <mesh geometry={geo.gangway} position={[-0.83, (BOT + TOP) / 2, 0]}>
          <C color="#2b2c32" />
        </mesh>
        {BOGIES.map(bogie)}
        {/* window panes and doors */}
        {[-1, 1].map((sz) => (
          <group key={sz}>
            {[...leadPanes, ...car2Panes].map((x) => (
              <mesh key={x} geometry={geo.pane} material={winMat} position={[x, winY, sz * (W * 0.975 + 0.003)]} />
            ))}
            {[-0.74, -1.8].map((x) => (
              <mesh key={x} geometry={geo.door} position={[x, (BOT + TOP) / 2 + 0.02, sz * (W + 0.002)]}>
                <C color={L.under} />
              </mesh>
            ))}
          </group>
        ))}
        {/* headlamps on the nose, tail lamps on the back */}
        {[-1, 1].map((sz, i) => (
          <mesh key={sz} ref={(el) => (lamps.current[i] = el)} geometry={geo.lamp} position={[lampPos.x, lampPos.y, sz * lampPos.z]} scale={[0.05, 0.022, 0.03]} rotation-y={sz * 0.3}>
            <C color="#fff6d8" emissive="#fff0b8" emissiveIntensity={1.2} />
          </mesh>
        ))}
        {[-1, 1].map((sz) => (
          <mesh key={sz} geometry={geo.tail} position={[CAR2.x0 - 0.002, BOT + 0.12, sz * 0.14]}>
            <C color="#e0323a" emissive="#ff2a2a" emissiveIntensity={0.8} />
          </mesh>
        ))}
        {/* the pantograph reaching up to the wire */}
        <group position={[-0.5, TOP, 0]}>
          <mesh geometry={geo.pBase} position-y={0.015}>
            <C color="#55585f" />
          </mesh>
          {[-0.06, 0.06].map((z) => (
            <mesh key={z} geometry={geo.insulator} position={[z * 1.2, 0.035, z]}>
              <C color="#b5653a" />
            </mesh>
          ))}
          <mesh geometry={geo.pLow}>
            <C color="#4a4d55" />
          </mesh>
          <mesh geometry={geo.pUp}>
            <C color="#4a4d55" />
          </mesh>
          <mesh geometry={geo.pHead} position={[-0.02, WIRE - TOP - 0.012, 0]}>
            <C color="#33343a" />
          </mesh>
          {[-1, 1].map((sz) => (
            <mesh key={sz} geometry={geo.pHorn} position={[-0.02, WIRE - TOP - 0.02, sz * 0.19]} rotation-x={sz * 0.6}>
              <C color="#33343a" />
            </mesh>
          ))}
          <mesh ref={arc} geometry={geo.arc} position={[-0.02, WIRE - TOP, 0.05]} visible={false}>
            <meshBasicMaterial color="#d8f2ff" />
          </mesh>
          <pointLight ref={arcLight} color="#8fd0ff" distance={1.4} decay={2} position={[-0.02, WIRE - TOP + 0.02, 0.05]} intensity={0} />
          <Burst tap={sparkSince} geometry={geo.spark} count={9} colors={['#e8f8ff', '#9fdcff', '#ffffff']} speed={1.1} gravity={5} size={0.018} life={0.45} origin={[-0.02, WIRE - TOP, 0.05]} spread={0.8} up={0.5} seed={5} />
        </group>
      </group>

      {/* speed lines, streaming past while it rushes */}
      {streaks.map((st, i) => (
        <mesh key={i} ref={(el) => (lines.current[i] = el)} geometry={geo.streak} visible={false}>
          <meshBasicMaterial color="#ffffff" transparent depthWrite={false} />
        </mesh>
      ))}
      {/* an invisible box over the train, so every tap lands */}
      <mesh geometry={geo.hit} position={[SHIFT - 0.5, RT + 0.4, 0]}>
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}

export default function BulletTrainScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.3, 2.3, 5.9]} target={[0, 0.5, 0]} hint="The train sits humming on its own: its lamps and windows pulse and the pantograph now and then throws blue sparks off the wire · tap it and it shoots off along the track in a blur, vanishes into the far tunnel and glides back out of the near one to stop in its place · Look swaps white, red and midnight · drag to orbit">
      <BulletTrain {...props} />
    </Stage>
  )
}

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Cloth, Flat, Flow, Particles, Ripple, Stage, TAU, Water, facet, useGeo, useTap, waveAt } from './kit.jsx'

// A low-poly paddle steamer on a round of water: a lofted hull with a boot
// stripe at the waterline, a main deck with a long cabin, an upper deck with
// railings, a saloon and a wheelhouse, twin tall chimneys side by side with
// flared crowns and a brace between them, and a paddle wheel each side in a
// half-round box with a sunburst on its face, the floats dipping into the
// water below. Left alone, the boat bobs on the swell, the wheels churn
// (throwing up spray and spreading rings), foam slides past the hull and the
// chimneys puff. Tap it and the horn sounds: a jet of steam from the brass
// horn, sound rings rolling out ahead, the wheels churn harder and each
// chimney blows a big smoke ring that rises and spreads.

const LOOKS = {
  classic: { hull: '#26262c', boot: '#c8352b', cabin: '#f4f1ea', trim: '#c8352b', deck: '#c9a27a', stack: '#c8352b', crown: '#26262c', box: '#f4f1ea', boxTrim: '#c8352b', wheel: '#c8352b', roof: '#3a3a42', flag: '#c8352b', water: '#4aa3d8', edge: '#2f7fb0', smoke: '#5a5a62' },
  river: { hull: '#f4f1ea', boot: '#2f7a46', cabin: '#fbf8ef', trim: '#2f7a46', deck: '#c9a27a', stack: '#2a2a30', crown: '#e2b04a', box: '#2f7a46', boxTrim: '#f4f1ea', wheel: '#c8352b', roof: '#2f7a46', flag: '#2f5fae', water: '#5fae9a', edge: '#3f8a78', smoke: '#4a4a52' },
  royal: { hull: '#1f2d55', boot: '#e2b04a', cabin: '#f2ead8', trim: '#e2b04a', deck: '#b98a5a', stack: '#f2ead8', crown: '#1f2d55', box: '#1f2d55', boxTrim: '#e2b04a', wheel: '#e2b04a', roof: '#8a2a3a', flag: '#8a2a3a', water: '#3b8fd0', edge: '#276fa8', smoke: '#6a6a74' },
}

const SEA_Y = 0.06
const AMP = 0.02
const FREE = 0.11 // main deck above the water
// hull stations from stern to bow: x, half-beam, depth below the deck
const STATIONS = [
  [-0.92, 0.22, 0.12],
  [-0.8, 0.27, 0.17],
  [-0.45, 0.3, 0.19],
  [0.25, 0.3, 0.19],
  [0.62, 0.24, 0.17],
  [0.86, 0.13, 0.14],
  [1.0, 0.0, 0.1],
]
const BX = -0.05 // paddle wheel axle (x)
const BZ = 0.37 // paddle wheel centre (z)
const BR = 0.3 // paddle box radius
const WR = 0.26 // paddle wheel radius
const AXLE_Y = 0.06 // above the deck
const UD = 0.2 // upper deck height
const CH = [0.15, 0.12] // chimneys at x, +-z
const CH_TOP = 0.92
const HORN = [0.46, UD + 0.25, 0]

const halfAt = (x) => {
  for (let i = 1; i < STATIONS.length; i++)
    if (x <= STATIONS[i][0]) {
      const [x0, w0] = STATIONS[i - 1]
      const [x1, w1] = STATIONS[i]
      return w0 + ((w1 - w0) * (x - x0)) / (x1 - x0)
    }
  return 0
}

function hullGeo() {
  const pos = []
  const rings = STATIONS.map(([x, w, d]) => [
    [x, 0, -w],
    [x, -d * 0.6, -w * 0.88],
    [x, -d, 0],
    [x, -d * 0.6, w * 0.88],
    [x, 0, w],
  ])
  const tri = (a, b, c) => pos.push(...a, ...b, ...c)
  for (let s = 0; s < rings.length - 1; s++)
    for (let k = 0; k < 4; k++) {
      const a = rings[s][k]
      const b = rings[s][k + 1]
      const c = rings[s + 1][k]
      const d = rings[s + 1][k + 1]
      tri(a, b, c)
      tri(b, d, c)
    }
  const st = rings[0]
  for (let k = 1; k < 4; k++) tri(st[0], st[k + 1], st[k])
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return g
}

function deckGeo(inset = 0) {
  const s = new THREE.Shape()
  STATIONS.forEach(([x, w], i) => (i ? s.lineTo(x, Math.max(0, w - inset)) : s.moveTo(x, w - inset)))
  for (let i = STATIONS.length - 1; i >= 0; i--) s.lineTo(STATIONS[i][0], -Math.max(0, STATIONS[i][1] - inset))
  return new THREE.ShapeGeometry(s).rotateX(Math.PI / 2)
}

// The rail round the deck edge, one side, as a tube.
function edgeRail(side, y, from, to, k = 1, inset = 0.012, r = 0.008) {
  const pts = []
  for (let i = 0; i <= 16; i++) {
    const x = from + ((to - from) * i) / 16
    pts.push(new THREE.Vector3(x, y, side * (halfAt(x) * k - inset)))
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, r, 4, false)
}

// A paddle wheel turning about z: two rims, spokes and the floats.
function PaddleWheel({ geo, L, wheelRef }) {
  return (
    <group ref={wheelRef}>
      {[-1, 1].map((k) => (
        <mesh key={k} geometry={geo.rimRing} position-z={k * 0.055}>
          <Flat color={L.wheel} />
        </mesh>
      ))}
      {Array.from({ length: 5 }, (_, k) =>
        [-1, 1].map((s) => (
          <mesh key={`${k}${s}`} geometry={geo.spoke} rotation-z={(k / 5) * Math.PI} position-z={s * 0.055}>
            <Flat color={L.wheel} />
          </mesh>
        )),
      )}
      {Array.from({ length: 10 }, (_, k) => (
        <group key={k} rotation-z={(k / 10) * TAU}>
          <mesh geometry={geo.float} position-x={WR * 0.84}>
            <Flat color="#7a5232" />
          </mesh>
        </group>
      ))}
      <mesh geometry={geo.hub}>
        <Flat color="#2a2a30" />
      </mesh>
    </group>
  )
}

// A smoke ring that leaves a chimney top on the horn, rises, spreads and fades.
function SmokeRing({ tap, geo, color, origin, delay = 0 }) {
  const m = useRef()
  useFrame(({ clock }) => {
    const s = tap.since(clock.elapsedTime) - delay
    const life = 2.6
    const on = s >= 0 && s < life
    m.current.visible = on
    if (!on) return
    const u = s / life
    const e = 1 - Math.exp(-s * 2.2)
    m.current.position.set(origin[0] - s * 0.18, origin[1] + 0.04 + e * 0.32 + s * 0.06, origin[2] + Math.sin(s * 2) * 0.02)
    m.current.scale.setScalar(0.06 + e * 0.17 + s * 0.03)
    m.current.rotation.set(Math.PI / 2 + Math.sin(s * 1.7) * 0.15, 0, s * 0.6)
    m.current.material.opacity = 0.9 * (1 - u) ** 1.3
  })
  return (
    <mesh ref={m} geometry={geo} visible={false}>
      <meshStandardMaterial color={color} flatShading roughness={0.9} transparent depthWrite={false} />
    </mesh>
  )
}

// Arcs rolling out ahead of the horn while it sounds.
function SoundRings({ tap, geo, origin }) {
  const refs = useRef([])
  useFrame(({ clock }) => {
    const s = tap.since(clock.elapsedTime)
    refs.current.forEach((m, i) => {
      if (!m) return
      const u = (s - i * 0.22) / 0.9
      m.visible = u >= 0 && u < 1 && s < 1.6
      if (!m.visible) return
      m.position.set(origin[0] + u * 0.25, origin[1], origin[2])
      m.scale.setScalar(0.08 + u * 0.32)
      m.material.opacity = 0.8 * (1 - u)
    })
  })
  return Array.from({ length: 4 }, (_, i) => (
    <mesh key={i} ref={(el) => (refs.current[i] = el)} geometry={geo} visible={false}>
      <meshBasicMaterial color="#ffffff" transparent depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  ))
}

export function PaddleSteamer({ look = 'classic' }) {
  const L = LOOKS[look] || LOOKS.classic
  const { tap, handlers, clock } = useTap(1)
  const boat = useRef()
  const wheels = useRef([])
  const st = useRef({ y: SEA_Y + FREE, pitch: 0, roll: 0, a: 0 })

  const geo = useGeo(() => {
    // the sunburst on a paddle box's face: rays fanning from the axle
    return {
      hull: hullGeo(),
      deck: deckGeo(0.004),
      boot: [1, -1].map((sd) => edgeRail(sd, -FREE + 0.012, -0.9, 0.97, 0.9, -0.004, 0.016)),
      strake: [1, -1].map((sd) => edgeRail(sd, -0.014, -0.92, 0.99, 1, -0.006, 0.012)),
      cabin: facet(new THREE.BoxGeometry(1.17, UD, 0.44), 0.004, 2),
      win: new THREE.BoxGeometry(0.06, 0.08, 0.006),
      door: new THREE.BoxGeometry(0.006, 0.13, 0.08),
      upper: facet(new THREE.BoxGeometry(1.4, 0.025, 0.58), 0.003, 3),
      post: new THREE.BoxGeometry(0.012, 0.09, 0.012),
      railX: new THREE.BoxGeometry(1.4, 0.012, 0.012),
      railZ: new THREE.BoxGeometry(0.012, 0.012, 0.58),
      saloon: facet(new THREE.BoxGeometry(0.55, 0.13, 0.34), 0.003, 4),
      saloonRoof: facet(new THREE.BoxGeometry(0.62, 0.025, 0.4), 0.003, 5),
      sWin: new THREE.BoxGeometry(0.05, 0.06, 0.006),
      house: facet(new THREE.BoxGeometry(0.2, 0.16, 0.22), 0.003, 6),
      houseRoof: facet(new THREE.BoxGeometry(0.27, 0.025, 0.29), 0.003, 7),
      hWin: new THREE.BoxGeometry(0.006, 0.06, 0.16),
      hWinSide: new THREE.BoxGeometry(0.15, 0.06, 0.006),
      stack: facet(new THREE.CylinderGeometry(0.045, 0.05, CH_TOP - UD, 9, 1).translate(0, (CH_TOP - UD) / 2, 0), 0.002, 8),
      crown: new THREE.CylinderGeometry(0.08, 0.05, 0.09, 9, 1, true).translate(0, 0.045, 0),
      band: new THREE.CylinderGeometry(0.052, 0.052, 0.03, 9),
      brace: new THREE.BoxGeometry(0.014, 0.014, CH[1] * 2),
      horn: new THREE.CylinderGeometry(0.026, 0.008, 0.09, 7).rotateZ(-Math.PI / 2),
      hornStem: new THREE.CylinderGeometry(0.006, 0.006, 0.06, 4),
      box: facet(new THREE.CylinderGeometry(BR, BR, 0.15, 14, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2), 0.003, 9),
      ray: new THREE.BoxGeometry(0.018, BR * 0.8, 0.006).translate(0, BR * 0.45, 0),
      boxRim: new THREE.TorusGeometry(BR, 0.012, 3, 14, Math.PI),
      rimRing: new THREE.TorusGeometry(WR * 0.92, 0.01, 3, 16),
      spoke: new THREE.BoxGeometry(0.012, WR * 1.84, 0.012),
      float: new THREE.BoxGeometry(WR * 0.34, 0.025, 0.13),
      hub: new THREE.CylinderGeometry(0.03, 0.03, 0.16, 6).rotateX(Math.PI / 2),
      bowRail: [edgeRail(1, 0.07, 0.55, 0.98), edgeRail(-1, 0.07, 0.55, 0.98), edgeRail(1, 0.07, -0.9, -0.62), edgeRail(-1, 0.07, -0.9, -0.62)],
      flagPole: new THREE.CylinderGeometry(0.006, 0.008, 0.36, 4).translate(0, 0.18, 0),
      buoy: new THREE.TorusGeometry(0.035, 0.012, 4, 10),
      puff: facet(new THREE.IcosahedronGeometry(1, 0), 0.08, 11),
      ring: new THREE.TorusGeometry(1, 0.26, 5, 14),
      arc: new THREE.TorusGeometry(1, 0.03, 3, 10, 1.5).rotateZ(-0.75),
      drop: new THREE.IcosahedronGeometry(1, 0),
    }
  }, [])

  // foam sliding past each side of the hull, as if the boat were under way
  const foam = useMemo(
    () =>
      [-1, 1].map((side) => (u) => {
        const x = 1.02 - u * 2.6
        const w = halfAt(Math.max(-0.92, Math.min(1, x))) + 0.04
        const out = Math.min(1, Math.max(0, (0.95 - x) / 0.6))
        return new THREE.Vector3(x, SEA_Y + 0.012, side * (w + (0.48 - w) * out + Math.max(0, -x - 0.4) * 0.2))
      }),
    [],
  )
  const busy = () => {
    const s = tap.since(clock.elapsedTime)
    return s >= 0 && s < 1.4 ? 1 : 0
  }
  const sRight = useMemo(() => ({ since: (t) => tap.since(t) - 0.3 }), [tap])

  useFrame((_, dtRaw) => {
    const d = Math.min(dtRaw, 0.05)
    if (!(d > 0)) return
    const t = clock.elapsedTime
    const S = st.current
    const k = tap.value(t)
    // the wheels churn, harder for a moment after the horn
    S.a += d * (2.2 + 3 * k)
    wheels.current.forEach((w) => w && (w.rotation.z = -S.a))
    // ride the swell: height, pitch and roll from the water under the hull
    const yaw = Math.sin(t * 0.13) * 0.12
    const c = Math.cos(yaw)
    const s = Math.sin(yaw)
    const at = (lx, lz) => SEA_Y + waveAt(lx * c + lz * s, -lx * s + lz * c, t, AMP)
    const bow = at(0.8, 0)
    const stern = at(-0.8, 0)
    const port = at(0, -0.3)
    const stbd = at(0, 0.3)
    const e = 1 - Math.exp(-d / 0.4)
    S.y += ((bow + stern + port + stbd) / 4 + FREE - S.y) * e
    S.pitch += (Math.atan2(bow - stern, 1.6) * 0.8 - S.pitch) * e
    S.roll += (Math.atan2(stbd - port, 0.6) * 0.6 - S.roll) * e
    // each turn of the wheels shoves the hull a touch
    const shove = Math.sin(S.a * 5) * 0.004
    boat.current.position.set(0, S.y + shove + Math.sin(t * 0.8) * 0.006, 0)
    boat.current.rotation.set(-S.roll + Math.sin(t * 0.6) * 0.012, yaw, S.pitch + k * 0.03, 'YXZ')
  })

  const stackTops = [-1, 1].map((sz) => [CH[0], CH_TOP + 0.1, sz * CH[1]])

  return (
    <group {...handlers}>
      <Water radius={1.6} color={L.water} edge={L.edge} amp={AMP} y={SEA_Y} />
      {/* wake rings off the paddles and stern */}
      {[-1, 1].map((sz) => (
        <group key={sz} position={[BX - 0.2, 0, sz * (BZ + 0.05)]}>
          <Ripple loop period={1.6} count={2} color="#ffffff" radius={0.8} y={SEA_Y + 0.02} opacity={0.45} />
        </group>
      ))}
      <group position={[-1.05, 0, 0]}>
        <Ripple loop period={2.2} count={3} color="#ffffff" radius={0.9} y={SEA_Y + 0.02} opacity={0.4} />
      </group>
      {foam.map((p, i) => (
        <Flow key={i} path={p} count={14} speed={0.22} width={0.06} size={0.018} stretch={3} colors={['#ffffff', '#e6f4ff']} opacity={0.85} seed={i + 2} />
      ))}

      <group ref={boat}>
        {/* the hull, its stripe and the main deck */}
        <mesh geometry={geo.hull}>
          <Flat color={L.hull} side={THREE.DoubleSide} />
        </mesh>
        {[0, 1].map((i) => (
          <group key={i}>
            <mesh geometry={geo.boot[i]}>
              <Flat color={L.boot} />
            </mesh>
            <mesh geometry={geo.strake[i]}>
              <Flat color={L.trim} />
            </mesh>
          </group>
        ))}
        <mesh geometry={geo.deck} position-y={0.002}>
          <Flat color={L.deck} side={THREE.DoubleSide} />
        </mesh>
        {geo.bowRail.map((g, i) => (
          <mesh key={i} geometry={g}>
            <Flat color={L.cabin} />
          </mesh>
        ))}
        {[0.6, 0.72, 0.84, -0.7, -0.82].flatMap((x) =>
          [-1, 1].map((sz) => (
            <mesh key={`${x}${sz}`} geometry={geo.post} position={[x, 0.035, sz * (halfAt(x) - 0.012)]} scale-y={0.8}>
              <Flat color={L.cabin} />
            </mesh>
          )),
        )}

        {/* the main cabin with its row of windows */}
        <mesh geometry={geo.cabin} position={[-0.04, UD / 2, 0]}>
          <Flat color={L.cabin} />
        </mesh>
        {[-0.55, -0.44, 0.3, 0.41].flatMap((x) =>
          [-1, 1].map((sz) => (
            <mesh key={`${x}${sz}`} geometry={geo.win} position={[x, 0.12, sz * 0.222]}>
              <Flat color="#2a3a4c" roughness={0.3} />
            </mesh>
          )),
        )}
        <mesh geometry={geo.door} position={[0.553, 0.08, 0]}>
          <Flat color={L.trim} />
        </mesh>

        {/* the upper deck, its railings, saloon and wheelhouse */}
        <mesh geometry={geo.upper} position={[-0.05, UD + 0.012, 0]}>
          <Flat color={L.roof} />
        </mesh>
        {Array.from({ length: 12 }, (_, i) => -0.73 + i * 0.124).flatMap((x) =>
          [-1, 1].map((sz) => (
            <mesh key={`${x}${sz}`} geometry={geo.post} position={[x, UD + 0.07, sz * 0.28]}>
              <Flat color={L.cabin} />
            </mesh>
          )),
        )}
        {[-1, 1].map((sz) => (
          <mesh key={sz} geometry={geo.railX} position={[-0.05, UD + 0.115, sz * 0.28]}>
            <Flat color={L.trim} />
          </mesh>
        ))}
        <mesh geometry={geo.railZ} position={[-0.745, UD + 0.115, 0]}>
          <Flat color={L.trim} />
        </mesh>
        <mesh geometry={geo.saloon} position={[-0.32, UD + 0.09, 0]}>
          <Flat color={L.cabin} />
        </mesh>
        {[-0.5, -0.4, -0.3, -0.2, -0.1].flatMap((x) =>
          [-1, 1].map((sz) => (
            <mesh key={`${x}${sz}`} geometry={geo.sWin} position={[x, UD + 0.1, sz * 0.171]}>
              <Flat color="#2a3a4c" roughness={0.3} />
            </mesh>
          )),
        )}
        <mesh geometry={geo.saloonRoof} position={[-0.32, UD + 0.168, 0]}>
          <Flat color={L.roof} />
        </mesh>
        <mesh geometry={geo.house} position={[0.42, UD + 0.105, 0]}>
          <Flat color={L.cabin} />
        </mesh>
        <mesh geometry={geo.hWin} position={[0.521, UD + 0.13, 0]}>
          <Flat color="#2a3a4c" roughness={0.3} />
        </mesh>
        {[-1, 1].map((sz) => (
          <mesh key={sz} geometry={geo.hWinSide} position={[0.42, UD + 0.13, sz * 0.111]}>
            <Flat color="#2a3a4c" roughness={0.3} />
          </mesh>
        ))}
        <mesh geometry={geo.houseRoof} position={[0.42, UD + 0.197, 0]}>
          <Flat color={L.roof} />
        </mesh>
        {/* the brass horn on the wheelhouse roof */}
        <mesh geometry={geo.hornStem} position={[HORN[0] - 0.04, UD + 0.23, 0]}>
          <Flat color="#c99a3a" metalness={0.5} roughness={0.35} />
        </mesh>
        <mesh geometry={geo.horn} position={HORN}>
          <Flat color="#e2b04a" metalness={0.5} roughness={0.35} />
        </mesh>
        {/* a lifebuoy on each rail */}
        {[-1, 1].map((sz) => (
          <mesh key={sz} geometry={geo.buoy} position={[0.05, UD + 0.075, sz * 0.29]}>
            <Flat color={sz > 0 ? '#f26a2a' : '#ffffff'} />
          </mesh>
        ))}

        {/* twin chimneys with flared crowns and a brace between them */}
        {[-1, 1].map((sz) => (
          <group key={sz} position={[CH[0], UD + 0.025, sz * CH[1]]}>
            <mesh geometry={geo.stack}>
              <Flat color={L.stack} />
            </mesh>
            <mesh geometry={geo.band} position-y={CH_TOP - UD - 0.12}>
              <Flat color={L.crown} />
            </mesh>
            <mesh geometry={geo.crown} position-y={CH_TOP - UD - 0.03}>
              <Flat color={L.crown} side={THREE.DoubleSide} />
            </mesh>
          </group>
        ))}
        <mesh geometry={geo.brace} position={[CH[0], CH_TOP - 0.25, 0]}>
          <Flat color={L.crown} />
        </mesh>

        {/* the paddle boxes and wheels, port and starboard */}
        {[-1, 1].map((sz, i) => (
          <group key={sz} position={[BX, AXLE_Y, sz * BZ]}>
            <mesh geometry={geo.box}>
              <Flat color={L.box} side={THREE.DoubleSide} />
            </mesh>
            <mesh geometry={geo.boxRim} position-z={sz * 0.076}>
              <Flat color={L.boxTrim} />
            </mesh>
            {[-1.15, -0.58, 0, 0.58, 1.15].map((a) => (
              <mesh key={a} geometry={geo.ray} position-z={sz * 0.077} rotation-z={a}>
                <Flat color={L.boxTrim} />
              </mesh>
            ))}
            <PaddleWheel geo={geo} L={L} wheelRef={(el) => (wheels.current[i] = el)} />
          </group>
        ))}

        {/* the ensign at the stern */}
        <group position={[-0.86, 0.02, 0]}>
          <mesh geometry={geo.flagPole}>
            <Flat color="#e8e2d4" />
          </mesh>
          <group position-y={0.35}>
            <Cloth width={0.16} height={0.1} segs={[6, 3]} amp={0.02} speed={7} waves={1.2} rotation-y={Math.PI} color={L.flag} />
          </group>
        </group>

        {/* smoke: idle puffs, a thick plume on the horn, the rings, the steam */}
        {stackTops.map((o, i) => (
          <Particles key={i} geometry={geo.puff} count={10} life={2} origin={o} spread={0.02} velocity={[-0.22, 0.35, 0]} scatter={0.06} drift={0.08} size={[0.03, 0.11]} colors={['#e6e6ea', '#d0d0d8']} opacity={[0.75, 0]} seed={i + 3} />
        ))}
        {stackTops.map((o, i) => (
          <Particles key={i} geometry={geo.puff} count={10} life={1.1} origin={o} spread={0.02} velocity={[-0.35, 0.55, 0]} scatter={0.12} drift={0.08} size={[0.035, 0.1]} colors={[L.smoke, '#3a3a42', '#7a7a84']} opacity={[0.85, 0]} active={busy} seed={i + 7} />
        ))}
        {stackTops.map((o, i) => (
          <SmokeRing key={i} tap={tap} geo={geo.ring} color={L.smoke} origin={o} delay={0.1 + i * 0.35} />
        ))}
        <Particles geometry={geo.puff} count={16} life={0.8} origin={[HORN[0] + 0.05, HORN[1] + 0.02, 0]} spread={0.01} velocity={[0.25, 1.0, 0]} scatter={0.12} drift={0.05} size={[0.025, 0.1]} colors={['#ffffff', '#f2f4f6']} opacity={[0.95, 0]} active={busy} seed={4} />
        <Burst tap={tap} geometry={geo.puff} count={12} colors={['#ffffff', '#eef1f4']} speed={0.8} gravity={-1.2} size={0.09} life={1.3} origin={[HORN[0], HORN[1] + 0.04, 0]} spread={0.6} up={1.6} seed={3} />
        <SoundRings tap={tap} geo={geo.arc} origin={[HORN[0] + 0.06, HORN[1], 0]} />
      </group>

      {/* spray thrown up behind each wheel */}
      {[-1, 1].map((sz) => (
        <Particles key={sz} geometry={geo.drop} count={12} life={0.6} origin={[BX - 0.18, SEA_Y + 0.02, sz * BZ]} spread={0.05} velocity={[-0.45, 0.6, 0]} scatter={0.12} gravity={2.4} drift={0.02} size={[0.018, 0.008]} colors={['#ffffff', '#d8f0ff']} opacity={[0.95, 0.2]} seed={sz + 11} />
      ))}
      {[-1, 1].map((sz) => (
        <Burst key={sz} tap={sRight} geometry={geo.drop} count={10} colors={['#ffffff', L.water, '#bfe6ff']} speed={1.2} gravity={4.5} size={0.035} life={0.8} origin={[BX - 0.15, SEA_Y + 0.03, sz * BZ]} spread={0.8} seed={sz + 5} />
      ))}
    </group>
  )
}

export default function PaddleSteamerScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.8, 1.75, 3.45]} target={[0, 0.6, 0]} hint="The steamer bobs on the swell on its own: the paddle wheels churn, spray flies, foam slides past and the chimneys puff · tap it to sound the horn: a jet of steam, a big smoke ring from each chimney and the wheels churn harder · Look swaps classic, river and royal · drag to orbit">
      <PaddleSteamer {...props} />
    </Stage>
  )
}

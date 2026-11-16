import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Hinge, Particles, Ripple, Stage, Sway, TAU, Water, blob, facet, rng, terrainGeo, useGeo, useTap, waveAt } from './kit.jsx'

// A low-poly lily pond: a round of rolling water in a ring of faceted
// stones on a grassy bank, with a clump of reeds and cattails at the back,
// six lily pads (flat discs, each with its notch) and a lotus bud standing
// up from the largest pad. Left alone, the pads bob and turn on the water
// and rings spread out from them on a loop. Tap it and the lotus opens,
// petal by petal from the outside in, glowing and throwing off a few
// sparkles; tap again to close it, or it folds shut by itself after a while.

const LOOKS = {
  pink: { petals: ['#ef7fae', '#f6a6c7', '#fcd6e6'], pod: '#ffd23a', glow: '#ff9cc6' },
  white: { petals: ['#e9e6ef', '#f5f3f8', '#ffffff'], pod: '#ffd84a', glow: '#fff4d6' },
  purple: { petals: ['#8f62d0', '#ab84e2', '#d2bdf3'], pod: '#ffd23a', glow: '#c9a6ff' },
  yellow: { petals: ['#eeb722', '#f5d04e', '#fbe9a2'], pod: '#ff9a2a', glow: '#ffe07a' },
}
const WATER = '#4ea7b2'
const EDGE = '#2f7f88'
const PAD = ['#4f9a3c', '#62ad46', '#3f8a34']
const POND_R = 1.05
const OPEN_FOR = 7 // seconds the lotus stays open before it folds

// the pads: [x, z, radius, turn]; the first carries the lotus
const PADS = [
  [0.12, 0.1, 0.3, 0.4],
  [-0.52, 0.36, 0.22, 2.2],
  [0.54, -0.4, 0.24, 4.1],
  [-0.36, -0.5, 0.2, 1.1],
  [0.6, 0.44, 0.17, 5.3],
  [-0.74, -0.06, 0.16, 3.2],
]
// the lotus, three rings of petals: count, length, width, distance out,
// how far each one swings open, and when the ring starts to open
const RINGS = [
  { n: 8, len: 0.3, w: 0.12, r: 0.05, open: 1.25, delay: 0, c: 0 },
  { n: 7, len: 0.26, w: 0.1, r: 0.035, open: 0.85, delay: 0.55, c: 1 },
  { n: 5, len: 0.2, w: 0.08, r: 0.02, open: 0.45, delay: 1.0, c: 2 },
]

// A lily pad: a disc with a wedge cut out, a little thick, top at y = depth.
function padGeometry() {
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.absarc(0, 0, 1, 0.32, TAU - 0.32, false)
  s.lineTo(0, 0)
  return facet(new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: false, curveSegments: 7 }).rotateX(-Math.PI / 2), 0.025, 6, [1, 0.3, 1])
}

// A lotus petal: a pointed oval from its base at the origin up +y, cupped so
// its tip and edges curl in toward -z (the flower's middle).
function petalGeometry(len, w) {
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.quadraticCurveTo(w, len * 0.4, 0, len)
  s.quadraticCurveTo(-w, len * 0.4, 0, 0)
  const g = new THREE.ShapeGeometry(s, 3)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i)
    const x = p.getX(i)
    p.setZ(i, -1.3 * y * y - 2.2 * x * x)
  }
  g.computeVertexNormals()
  return g
}

export function LilyPond({ look = 'pink' }) {
  const L = LOOKS[look] || LOOKS.pink
  const { tap, handlers, clock } = useTap(1.2)
  const st = useRef({ open: false, t: -99, amt: 0 })
  const pads = useRef([])
  const lamp = useRef()
  const pod = useRef()
  const bank = useGeo(() => terrainGeo({ radius: 1.65, height: 0.05, seed: 3, rings: 4, segs: 18, rough: 0.3, profile: 'dome', bands: [[0, '#8fbf5e']] }), [])
  const geo = useGeo(
    () => ({
      pad: padGeometry(),
      stone: blob(1, 8, 0),
      stem: new THREE.CylinderGeometry(0.018, 0.024, 0.2, 5).translate(0, 0.1, 0),
      pod: facet(new THREE.CylinderGeometry(0.055, 0.035, 0.05, 7).translate(0, 0.025, 0), 0.004, 2),
      cup: facet(new THREE.IcosahedronGeometry(0.07, 0).scale(1, 0.5, 1), 0.006, 3),
      petals: RINGS.map((R) => petalGeometry(R.len, R.w)),
      reed: facet(new THREE.ConeGeometry(0.018, 1, 4, 1).translate(0, 0.5, 0), 0.003, 9),
      cattail: facet(new THREE.CylinderGeometry(0.03, 0.03, 0.14, 6).translate(0, 0.07, 0), 0.004, 10),
      spark: new THREE.OctahedronGeometry(1, 0),
    }),
    [],
  )
  const stones = useMemo(() => {
    const r = rng(12)
    return Array.from({ length: 20 }, (_, i) => {
      const a = (i / 20) * TAU + (r() - 0.5) * 0.15
      const d = POND_R + 0.08 + r() * 0.06
      const s = 0.12 + r() * 0.08
      return { p: [Math.cos(a) * d, 0.05, Math.sin(a) * d], s: [s * 1.2, s * 0.75, s], ry: r() * TAU, c: ['#a8a39a', '#928d85', '#bab5ac'][i % 3] }
    })
  }, [])
  const reeds = useMemo(() => {
    const r = rng(4)
    return [
      [-0.85, -0.85],
      [0.95, -0.7],
    ].flatMap(([x, z], k) =>
      Array.from({ length: 6 }, (_, i) => ({ p: [x + (r() - 0.5) * 0.25, 0.03, z + (r() - 0.5) * 0.2], h: 0.7 + r() * 0.5, lean: [(r() - 0.5) * 0.25, (r() - 0.5) * 0.25], tail: i % 2 === 0, i: k * 6 + i })),
    )
  }, [])

  const onClick = (e) => {
    handlers.onClick(e)
    const S = st.current
    S.open = !S.open
    S.t = clock.elapsedTime
  }
  // how open the petal that starts at delay d should be, read every frame
  const petalOpen = (d) => () => {
    const S = st.current
    const s = clock.elapsedTime - S.t
    return S.open ? (s > d ? 1 : 0) : s > (1.5 - d) * 0.5 ? 0 : 1
  }

  useFrame((_, dt) => {
    const t = clock.elapsedTime
    const S = st.current
    if (S.open && t - S.t > OPEN_FOR) {
      S.open = false
      S.t = t
    }
    S.amt += ((S.open ? 1 : 0) - S.amt) * Math.min(1, dt * 2.5)
    // the pads ride the waves, turning slowly
    PADS.forEach(([x, z, , turn], i) => {
      const m = pads.current[i]
      if (!m) return
      const e = 0.1
      m.position.set(x, 0.065 + waveAt(x, z, t, 0.022) + Math.sin(t * 1.1 + i) * 0.006, z)
      m.rotation.set((waveAt(x, z + e, t, 0.022) - waveAt(x, z - e, t, 0.022)) * 2, turn + Math.sin(t * 0.3 + i * 1.7) * 0.15, -(waveAt(x + e, z, t, 0.022) - waveAt(x - e, z, t, 0.022)) * 2)
    })
    if (lamp.current) lamp.current.intensity = S.amt * (2.2 + Math.sin(t * 3) * 0.3)
    if (pod.current) pod.current.material.emissiveIntensity = 0.15 + S.amt * 0.9
  })

  return (
    <group {...handlers} onClick={onClick}>
      {/* the bank, the stone ring and the water */}
      <mesh geometry={bank}>
        <Flat vertexColors color="#ffffff" roughness={0.95} />
      </mesh>
      {stones.map((s, i) => (
        <mesh key={i} geometry={geo.stone} position={s.p} scale={s.s} rotation-y={s.ry}>
          <Flat color={s.c} />
        </mesh>
      ))}
      <Water radius={POND_R} color={WATER} edge={EDGE} amp={0.022} y={0.065} />
      {/* rings spreading from the pads on a loop */}
      {[PADS[1], PADS[2], PADS[0]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Ripple tap={tap} loop period={2.6 + i * 0.5} count={2} radius={0.55} color="#e8fbff" y={0.075} opacity={0.5} />
        </group>
      ))}
      {/* reeds and cattails behind the pond */}
      {reeds.map((rd, k) => (
        <group key={k} position={rd.p} rotation={[rd.lean[0], 0, rd.lean[1]]}>
          <Sway i={rd.i * 0.7} rate={0.35} amp={0.04} lag={0.6}>
            <mesh geometry={geo.reed} scale={[1, rd.h, 1]}>
              <Flat color={k % 3 ? '#6f9a3c' : '#86ad4a'} />
            </mesh>
            {rd.tail && (
              <mesh geometry={geo.cattail} position-y={rd.h * 0.68}>
                <Flat color="#6b4529" />
              </mesh>
            )}
          </Sway>
        </group>
      ))}
      {/* the pads; the first carries the lotus */}
      {PADS.map(([, , r], i) => (
        <group key={i} ref={(el) => (pads.current[i] = el)}>
          <mesh geometry={geo.pad} scale={[r, 1, r]}>
            <Flat color={PAD[i % PAD.length]} roughness={0.6} />
          </mesh>
          {i === 0 && (
            <group position-y={0.05}>
              <mesh geometry={geo.stem}>
                <Flat color="#5a9a3a" />
              </mesh>
              <group position-y={0.2}>
                <mesh geometry={geo.cup}>
                  <Flat color="#6aa848" />
                </mesh>
                {RINGS.map((R, k) =>
                  Array.from({ length: R.n }, (_, j) => (
                    <group key={`${k}-${j}`} rotation-y={(j / R.n) * TAU + k * 0.4}>
                      <group position={[0, 0.01 + k * 0.012, R.r]} rotation-x={-0.06}>
                        <Hinge open={petalOpen(R.delay + j * 0.06)} angle={R.open} axis="x" stiffness={55} damping={7}>
                          <mesh geometry={geo.petals[k]}>
                            <Flat color={L.petals[R.c]} emissive={L.glow} emissiveIntensity={0.08} side={THREE.DoubleSide} roughness={0.6} />
                          </mesh>
                        </Hinge>
                      </group>
                    </group>
                  )),
                )}
                <mesh ref={pod} geometry={geo.pod} position-y={0.02}>
                  <Flat color={L.pod} emissive={L.pod} emissiveIntensity={0.15} />
                </mesh>
                <pointLight ref={lamp} color={L.glow} distance={1.6} decay={2} position-y={0.2} intensity={0} />
                <Particles count={10} life={2.2} origin={[0, 0.12, 0]} spread={0.12} velocity={[0, 0.3, 0]} scatter={0.12} drift={0.1} size={[0.018, 0.008]} colors={['#ffffff', L.glow, L.pod]} opacity={[1, 0]} emissive={1.5} geometry={geo.spark} active={() => st.current.amt} seed={6} />
                <Burst tap={tap} geometry={geo.spark} count={14} colors={['#ffffff', L.glow, L.pod]} speed={0.9} gravity={-0.4} size={0.03} life={1.4} origin={[0, 0.1, 0]} spread={0.8} up={0.9} seed={7} />
              </group>
            </group>
          )}
        </group>
      ))}
    </group>
  )
}

export default function LilyPondScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3, 2.2, 4]} target={[0, 0.3, 0]} hint="The lily pads bob on the water and ripples spread on their own · tap the pond and the lotus opens petal by petal and glows; tap again to close it · Look swaps pink, white, purple and yellow lotus · drag to orbit">
      <LilyPond {...props} />
    </Stage>
  )
}

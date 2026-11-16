import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Particles, Stage, TAU, blinkAt, blob, cone, facet, rng, terrainGeo, useGeo, useTap } from './kit.jsx'

// A low-poly seahorse beside a tall strand of seagrass on a little sandy
// base: a segmented body with a round belly and ridged rings, a long snout,
// a spiky crown, a fluttering dorsal fin and a tail that curls into a
// spiral. Left alone it bobs upright, its tail slowly curling and uncurling
// and its dorsal fin fluttering, while the seagrass sways. Tap it and it
// spins round the strand in a rising spiral, tail streaming out, then sinks
// back to its place and settles with a little bob.

const LOOKS = {
  orange: { body: '#ef8a3c', belly: '#f8c07a', ridge: '#cf6526', fin: '#ffd89a', crown: '#d8601f' },
  yellow: { body: '#f1c232', belly: '#fae38a', ridge: '#d39f1a', fin: '#fff2b8', crown: '#cf9416' },
  purple: { body: '#9a70d8', belly: '#c9adf2', ridge: '#7552b8', fin: '#e6d8ff', crown: '#6c48ae' },
}

const ORBIT = 0.36 // distance from the seagrass
const HOME = 0.3 // resting angle round the strand (towards the camera)
const BASE_Y = 0.78 // height of the tail root
const SPIN = 3 // seconds for the spiral
const NTAIL = 11
const TL = 0.055 // tail link length
// the trunk's spine, bottom to top, in the side plane (y up, z forward): [y, z, radius]
const SPINE = [
  [0, 0, 0.075],
  [0.09, 0.035, 0.105],
  [0.19, 0.055, 0.125],
  [0.29, 0.045, 0.12],
  [0.38, 0.01, 0.1],
  [0.46, -0.03, 0.08],
  [0.53, -0.035, 0.07],
]
const HEAD = [0.6, 0.0]

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))

// a faceted ring segment along +y from 0 to len, lighter on its +z (belly) side
function segGeo(rBot, rTop, len, L, seed, sides = 7, down = false) {
  const g = facet((down ? new THREE.CylinderGeometry(rBot, rTop, len, sides, 1).translate(0, -len / 2, 0) : new THREE.CylinderGeometry(rTop, rBot, len, sides, 1).translate(0, len / 2, 0)), rBot * 0.06, seed).toNonIndexed()
  g.computeVertexNormals()
  const n = g.attributes.normal
  const col = new Float32Array(n.count * 3)
  const c = new THREE.Color()
  for (let f = 0; f < n.count; f += 3) {
    const nz = (n.getZ(f) + n.getZ(f + 1) + n.getZ(f + 2)) / 3
    c.set(nz > 0.45 ? L.belly : L.body)
    for (let j = 0; j < 3; j++) col.set([c.r, c.g, c.b], (f + j) * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}

// a scalloped fan in the xy plane, spreading out along +x from the origin
function fanGeo(len, spread, n = 5) {
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  for (let i = 0; i <= n * 2; i++) {
    const a = -spread / 2 + (i / (n * 2)) * spread
    const r = len * (i % 2 ? 0.82 : 1)
    s.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  s.closePath()
  return new THREE.ShapeGeometry(s)
}

export function Seahorse({ look = 'orange' }) {
  const L = LOOKS[look] || LOOKS.orange
  const { tap, handlers, clock } = useTap(1)
  const horse = useRef()
  const lean = useRef()
  const tail = useRef([])
  const grass = useRef([])
  const fins = useRef({})
  const eyes = useRef([])

  const geo = useGeo(() => {
    const up = new THREE.Vector3(0, 1, 0)
    const trunk = SPINE.slice(1).map(([y, z, r], i) => {
      const [y0, z0, r0] = SPINE[i]
      const d = new THREE.Vector3(0, y - y0, z - z0)
      return { g: segGeo(r0, r, d.length() * 1.12, L, 10 + i), p: [0, y0, z0], q: new THREE.Quaternion().setFromUnitVectors(up, d.clone().normalize()), r0 }
    })
    return {
      trunk,
      tail: Array.from({ length: NTAIL }, (_, i) => {
        const a = 0.072 * (1 - i / NTAIL) + 0.012
        const b = 0.072 * (1 - (i + 1) / NTAIL) + 0.012
        return segGeo(a, b, TL * 1.15, L, 30 + i, 6, true)
      }),
      ring: new THREE.TorusGeometry(1, 0.13, 3, 7).rotateX(Math.PI / 2),
      head: blob(0.085, 3),
      snout: facet(new THREE.CylinderGeometry(0.022, 0.032, 0.17, 6, 1).translate(0, 0.085, 0), 0.003, 4),
      lip: new THREE.CylinderGeometry(0.034, 0.028, 0.03, 6, 1),
      crown: cone(0.022, 0.07, 4, 6),
      eye: blob(0.036, 5, 0),
      pupil: new THREE.IcosahedronGeometry(0.021, 0),
      shine: new THREE.IcosahedronGeometry(0.006, 0),
      dorsal: fanGeo(0.15, 1.2, 5),
      pec: fanGeo(0.06, 1.1, 3),
      blade: facet(new THREE.BoxGeometry(0.075, 0.2, 0.014).translate(0, 0.1, 0), 0.004, 9),
      bladeTip: cone(0.037, 0.12, 4, 11).scale(1, 1, 0.2),
      sand: terrainGeo({ radius: 0.9, height: 0.13, seed: 7, rings: 4, segs: 13, rough: 0.25, profile: 'dome', bands: [[0, '#e3c48c'], [0.45, '#ecd29e'], [0.8, '#f3deb0']] }),
      rock: blob(0.08, 12, 0),
      bubble: new THREE.IcosahedronGeometry(1, 0),
      hit: new THREE.CylinderGeometry(0.6, 0.6, 1.5, 8).translate(0, 0.95, 0),
    }
  }, [look])

  // the seagrass: a main strand and two shorter ones, each a chain of blades
  const BLADES = [
    { p: [0, 0.1, 0], n: 8, ry: 0.2, ph: 0, c: ['#4aa860', '#5bbd6e'] },
    { p: [-0.22, 0.08, -0.16], n: 5, ry: 1.3, ph: 1.4, c: ['#3f9a55', '#52b066'] },
    { p: [0.2, 0.08, -0.26], n: 4, ry: -0.7, ph: 2.6, c: ['#57b36a', '#6cc47c'] },
  ]
  const rocks = useMemo(() => {
    const r = rng(5)
    return Array.from({ length: 5 }, (_, i) => ({ p: [Math.cos(i * 1.4 + 2) * (0.45 + r() * 0.25), 0.06, Math.sin(i * 1.4 + 2) * (0.45 + r() * 0.25)], s: 0.6 + r() * 0.6, c: ['#a39b90', '#c4baae', '#8f8a84', '#f2b8a8', '#b8b0a4'][i] }))
  }, [])

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const u = s >= 0 && s < SPIN ? s / SPIN : s >= SPIN ? 1 : 0
    const spinning = s >= 0 && s < SPIN
    // spiral: two turns round the strand, rising and sinking back
    const e = smooth(u)
    const ang = HOME + e * TAU * 2
    const rise = spinning ? Math.sin(Math.PI * u) * 0.38 : 0
    const settle = s >= SPIN && s < SPIN + 2 ? Math.exp(-(s - SPIN) * 2.5) * Math.sin((s - SPIN) * 9) * 0.05 : 0
    const rad = ORBIT * (1 - 0.15 * Math.sin(Math.PI * u))
    const h = horse.current
    h.position.set(Math.sin(ang) * rad, BASE_Y + Math.sin(t * 1.25) * 0.045 + rise + settle, Math.cos(ang) * rad)
    // face along the orbit, side on to the strand
    h.rotation.y = ang + Math.PI / 2
    const sp = spinning ? Math.sin(Math.PI * u) : 0
    lean.current.rotation.set(0.08 + Math.sin(t * 0.9) * 0.05 + sp * 0.35, 0, Math.sin(t * 0.7) * 0.04 - sp * 0.3)

    // the tail curls and uncurls; it streams out straighter in the spin
    const curl = (0.55 + 0.35 * Math.sin(t * 0.8)) * (1 - 0.75 * sp)
    tail.current.forEach((m, i) => m && (m.rotation.x = -curl * (0.25 + (i / NTAIL) * 0.9)))

    // fins flutter
    const F = fins.current
    F.dorsal.rotation.y = Math.PI / 2 + Math.sin(t * 16) * 0.35
    F.pec0.rotation.y = -0.6 + Math.sin(t * 14) * 0.4
    F.pec1.rotation.y = 0.6 - Math.sin(t * 14 + 1) * 0.4
    // a slow blink
    const b = blinkAt(t, 4.8, 2.2)
    eyes.current.forEach((m) => m && (m.scale.y = b))

    // the seagrass sways, and shivers as the seahorse whips round it
    const shake = spinning ? Math.sin(Math.PI * u) : 0
    BLADES.forEach((B, k) =>
      grass.current[k]?.forEach((m, i) => {
        if (!m) return
        m.rotation.z = 0.06 * Math.sin(t * 0.55 * TAU * 0.5 - i * 0.45 + B.ph) + (k === 0 ? shake * 0.05 * Math.sin(t * 9 - i) : 0)
        m.rotation.x = 0.04 * Math.sin(t * 0.4 * TAU * 0.5 - i * 0.5 + B.ph * 2)
      }),
    )
  })

  // a chain of tail links, each hanging below the one before
  const tailLink = (i) =>
    i === NTAIL ? null : (
      <group ref={(el) => (tail.current[i] = el)} position-y={i === 0 ? 0 : -TL}>
        <mesh geometry={geo.tail[i]}>
          <Flat vertexColors color="#ffffff" />
        </mesh>
        <mesh geometry={geo.ring} scale={0.072 * (1 - i / NTAIL) + 0.016}>
          <Flat color={L.ridge} />
        </mesh>
        {tailLink(i + 1)}
      </group>
    )
  const blade = (k, i) => {
    const B = BLADES[k]
    if (!grass.current[k]) grass.current[k] = []
    return i === B.n ? (
      <mesh geometry={geo.bladeTip}>
        <Flat color={B.c[i % 2]} />
      </mesh>
    ) : (
      <group ref={(el) => (grass.current[k][i] = el)} position-y={i === 0 ? 0 : 0.19}>
        <mesh geometry={geo.blade}>
          <Flat color={B.c[i % 2]} />
        </mesh>
        {blade(k, i + 1)}
      </group>
    )
  }

  return (
    <group {...handlers}>
      <mesh geometry={geo.sand}>
        <Flat vertexColors color="#ffffff" />
      </mesh>
      {rocks.map((k, i) => (
        <mesh key={i} geometry={geo.rock} position={k.p} scale={[k.s * 1.2, k.s * 0.7, k.s]}>
          <Flat color={k.c} />
        </mesh>
      ))}
      {BLADES.map((B, k) => (
        <group key={k} position={B.p} rotation-y={B.ry}>
          {blade(k, 0)}
        </group>
      ))}

      {/* the seahorse: snout along +z, upright */}
      <group ref={horse}>
        <group ref={lean}>
          {geo.trunk.map((s, i) => (
            <group key={i} position={s.p} quaternion={s.q}>
              <mesh geometry={s.g}>
                <Flat vertexColors color="#ffffff" />
              </mesh>
              <mesh geometry={geo.ring} scale={s.r0 * 1.02}>
                <Flat color={L.ridge} />
              </mesh>
            </group>
          ))}
          {/* head, snout and crown */}
          <group position={[0, HEAD[0], HEAD[1]]} rotation-x={0.25}>
            <mesh geometry={geo.head} scale={[0.85, 0.95, 1.1]}>
              <Flat color={L.body} />
            </mesh>
            <group position={[0, -0.02, 0.05]} rotation-x={1.6}>
              <mesh geometry={geo.snout}>
                <Flat color={L.body} />
              </mesh>
              <mesh geometry={geo.lip} position-y={0.17}>
                <Flat color={L.ridge} />
              </mesh>
            </group>
            {[
              [0, 0.08, -0.02, -0.3],
              [0, 0.06, -0.06, -0.8],
              [0.03, 0.065, -0.03, -0.4],
              [-0.03, 0.065, -0.03, -0.4],
            ].map(([x, y, z, rx], i) => (
              <mesh key={i} geometry={geo.crown} position={[x, y, z]} rotation={[rx, 0, -x * 8]} scale={i < 2 ? 1 : 0.7}>
                <Flat color={L.crown} />
              </mesh>
            ))}
            {[-1, 1].map((x, i) => (
              <group key={x} ref={(el) => (eyes.current[i] = el)} position={[x * 0.064, 0.015, 0.02]} rotation-y={x * 0.9}>
                <mesh geometry={geo.eye}>
                  <Flat color="#ffffff" roughness={0.4} />
                </mesh>
                <mesh geometry={geo.pupil} position-z={0.025} scale={[1, 1, 0.6]}>
                  <Flat color="#1b1a22" roughness={0.3} />
                </mesh>
                <mesh geometry={geo.shine} position={[0.007, 0.009, 0.037]}>
                  <meshBasicMaterial color="#ffffff" />
                </mesh>
              </group>
            ))}
          </group>
          {/* the dorsal fin on its back, and two little pectoral fins */}
          <group ref={(el) => (fins.current.dorsal = el)} position={[0, 0.22, -0.08]}>
            <mesh geometry={geo.dorsal} rotation-z={0.15}>
              <Flat color={L.fin} side={THREE.DoubleSide} transparent opacity={0.85} />
            </mesh>
          </group>
          {[-1, 1].map((x, i) => (
            <group key={x} ref={(el) => (fins.current['pec' + i] = el)} position={[x * 0.075, 0.47, -0.02]}>
              <mesh geometry={geo.pec} scale={[x, 1, 1]}>
                <Flat color={L.fin} side={THREE.DoubleSide} transparent opacity={0.85} />
              </mesh>
            </group>
          ))}
          {tailLink(0)}
        </group>
        <Burst tap={tap} geometry={geo.bubble} count={10} colors={['#e4f4ff', '#a8d8f2']} speed={0.5} gravity={-0.8} size={0.025} life={1.6} origin={[0, 0.55, 0.2]} spread={0.6} up={0.8} />
      </group>

      <Particles count={7} life={3.8} origin={[-0.4, 0.12, 0.25]} spread={0.04} velocity={[0, 0.55, 0]} scatter={0.03} drift={0.06} size={[0.016, 0.032]} colors={['#cfeafa', '#a8d8f2']} opacity={[0.85, 0]} emissive={0.3} seed={4} />
      <mesh geometry={geo.hit}>
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}

export default function SeahorseScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.8, 1.75, 3.8]} target={[0, 0.88, 0]} hint="The seahorse bobs upright beside its seagrass, tail curling and uncurling, dorsal fin fluttering · tap it and it spins round the strand in a rising spiral, then settles · Look swaps orange, yellow and purple · drag to orbit">
      <Seahorse {...props} />
    </Stage>
  )
}

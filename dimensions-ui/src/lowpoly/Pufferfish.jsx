import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Particles, Stage, Sway, blinkAt, blob, cone, facet, rng, terrainGeo, useGeo, useTap } from './kit.jsx'

// A low-poly pufferfish hovering over a little sandy patch: a round faceted
// body, pale belly, big eyes, a small pursed mouth, fluttering pectoral fins,
// a fan tail and a ring of spikes lying flat along its skin. Bubbles trickle
// up from the sand and a sprig of weed sways beside it. Left alone it hovers,
// bobbing and turning a little, fins fluttering. Tap it and it gulps water
// and inflates into a spiky ball (the body swells round and the spikes spring
// up along its normals), holds there quivering, then slowly deflates.

const LOOKS = {
  yellow: { top: '#f2c230', belly: '#fff0c0', fin: '#f6a93a', spike: '#d99a1e', lip: '#ef8a5a', spot: null },
  spotted: { top: '#cdb68a', belly: '#f5eedc', fin: '#dcb878', spike: '#a88e60', lip: '#d98b6a', spot: '#4a3828' },
  blue: { top: '#4b8fd8', belly: '#e4f1fb', fin: '#86c6f2', spike: '#346fb2', lip: '#f09aa8', spot: '#dff0ff' },
}

const R = 0.4 // body radius
const CY = 0.95 // hover height
const REST = [1, 0.9, 1.1] // the deflated body: a little long and flat
const PUFF = 1.48 // inflated scale
const UP = new THREE.Vector3(0, 1, 0)
const BACK = new THREE.Vector3(0, 0, -1)

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))
const easeOutBack = (x) => 1 + 2.7 * (x - 1) ** 3 + 1.7 * (x - 1) ** 2

// a scalloped fan in the xy plane, spreading out along +x from the origin
function fanGeo(len, spread, n = 5) {
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  for (let i = 0; i <= n * 2; i++) {
    const a = -spread / 2 + (i / (n * 2)) * spread
    const r = len * (i % 2 ? 0.8 : 1)
    s.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  s.closePath()
  return new THREE.ShapeGeometry(s)
}

// the body, one colour per face: back, pale belly and (for some looks) spots
function bodyGeo(L) {
  const g = facet(new THREE.IcosahedronGeometry(R, 1), R * 0.05, 11).toNonIndexed()
  const p = g.attributes.position
  const col = new Float32Array(p.count * 3)
  const r = rng(7)
  const c = new THREE.Color()
  for (let f = 0; f < p.count; f += 3) {
    const cy = (p.getY(f) + p.getY(f + 1) + p.getY(f + 2)) / 3 / R
    const cz = (p.getZ(f) + p.getZ(f + 1) + p.getZ(f + 2)) / 3 / R
    let pick = cy < -0.02 + cz * 0.15 ? L.belly : L.top
    if (L.spot && pick === L.top && cy > 0.05 && r() < 0.24) pick = L.spot
    c.set(pick).multiplyScalar(0.93 + r() * 0.12)
    for (let j = 0; j < 3; j++) col.set([c.r, c.g, c.b], (f + j) * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}

export function Pufferfish({ look = 'yellow' }) {
  const L = LOOKS[look] || LOOKS.yellow
  const { tap, handlers, clock } = useTap(1)
  const fish = useRef()
  const body = useRef()
  const spikes = useRef([])
  const parts = useRef({})
  const eyes = useRef([])
  const st = useRef({ last: 99, k: 0, k0: 0 })

  const geo = useGeo(
    () => ({
      body: bodyGeo(L),
      spike: cone(0.032, 0.17, 4, 3),
      eye: blob(0.085, 4),
      pupil: new THREE.IcosahedronGeometry(0.048, 1),
      shine: new THREE.IcosahedronGeometry(0.016, 0),
      lip: new THREE.TorusGeometry(0.035, 0.016, 4, 8),
      pec: fanGeo(0.17, 1.3, 4),
      tail: fanGeo(0.24, 1.4, 5),
      dorsal: fanGeo(0.13, 0.9, 3),
      sand: terrainGeo({ radius: 1.05, height: 0.14, seed: 4, rings: 4, segs: 14, rough: 0.25, profile: 'dome', bands: [[0, '#e3c48c'], [0.45, '#ecd29e'], [0.8, '#f3deb0']] }),
      rock: blob(0.09, 8, 0),
      shell: facet(new THREE.ConeGeometry(0.06, 0.05, 7, 1).translate(0, 0.025, 0), 0.004, 2).scale(1, 0.7, 1.2),
      weed: cone(0.05, 0.17, 4, 5).scale(1, 1, 0.45),
      bubble: new THREE.IcosahedronGeometry(1, 0),
      hit: new THREE.SphereGeometry(0.75, 8, 6),
    }),
    [look],
  )

  // spikes spread evenly over the skin, leaving the face and the belly bare
  const S = useMemo(() => {
    const out = []
    const n = 70
    for (let i = 0; i < n; i++) {
      const y = 1 - (2 * (i + 0.5)) / n
      const rr = Math.sqrt(1 - y * y)
      const a = i * 2.39996
      const v = new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr)
      if (v.z > 0.6 || v.y < -0.75) continue
      // lying flat: along the skin, pointing back towards the tail
      const flat = BACK.clone().addScaledVector(v, -BACK.dot(v))
      if (flat.lengthSq() < 0.02) flat.set(0, -Math.sign(v.y) || 1, 0).addScaledVector(v, -v.y)
      flat.normalize()
      out.push({ n: v, flat, d: new THREE.Vector3(), ph: i * 0.37 })
    }
    return out
  }, [])
  const EYES = useMemo(() => [-1, 1].map((x) => new THREE.Vector3(x * 0.52, 0.34, 0.78).normalize()), [])
  const eyeQ = useMemo(() => EYES.map((n) => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n)), [EYES])

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const T = st.current
    // a fresh tap starts the puff from wherever it is now
    if (s < T.last) T.k0 = T.k
    T.last = s
    let k = 0
    if (s >= 0 && s < 0.4) k = T.k0 + (1 - T.k0) * easeOutBack(s / 0.4)
    else if (s >= 0.4 && s < 2.3) k = 1 + 0.025 * Math.sin(s * 22) * Math.exp(-(s - 0.4) * 1.5)
    else if (s >= 2.3 && s < 5) k = 1 - smooth((s - 2.3) / 2.7)
    T.k = k
    const kc = Math.max(0, Math.min(1, k))

    // hover: bob, drift and turn a little; it rises a touch when puffed
    const f = fish.current
    f.position.set(Math.sin(t * 0.45) * 0.06, CY + Math.sin(t * 1.4) * 0.05 + 0.12 * kc, Math.cos(t * 0.37) * 0.04)
    f.rotation.set(Math.sin(t * 0.9) * 0.06, 0.55 + Math.sin(t * 0.5) * 0.25 + Math.sin(t * 3.1) * 0.06 * kc, Math.sin(t * 1.1) * 0.04)

    const sc = [0, 1, 2].map((i) => REST[i] + (PUFF - REST[i]) * k)
    body.current.scale.set(sc[0], sc[1], sc[2])
    const on = (v, out = 1) => [v.x * R * sc[0] * out, v.y * R * sc[1] * out, v.z * R * sc[2] * out]

    // spikes: flat and short at rest, standing out along the normal when puffed
    const pk = smooth((kc - 0.1) / 0.75)
    S.forEach((p, i) => {
      const m = spikes.current[i]
      if (!m) return
      m.position.set(...on(p.n, 0.97))
      p.d.copy(p.flat).lerp(p.n, pk).normalize()
      m.quaternion.setFromUnitVectors(UP, p.d)
      const len = 0.45 + 0.55 * pk + 0.06 * pk * Math.sin(t * 18 + p.ph)
      m.scale.set(0.8 + 0.3 * pk, len, 0.8 + 0.3 * pk)
    })

    // eyes ride the swelling skin, staying the same size (and blink now and then)
    const blink = blinkAt(t, 4.6, 1.7)
    EYES.forEach((n, i) => {
      const e = eyes.current[i]
      if (!e) return
      e.position.set(...on(n, 0.9))
      e.scale.set(1, blink, 1)
    })
    const P = parts.current
    // mouth: a little pursed o, puckering on the gulp
    P.mouth.position.set(0, -0.06 * sc[1], R * sc[2] * 0.97)
    P.mouth.scale.setScalar(1 + 0.5 * Math.max(0, Math.sin(Math.min(1, s / 0.4) * Math.PI)) * (s >= 0 ? 1 : 0))
    // fins: quick flutter, faster and stubbier when puffed
    const fl = 12 + 10 * kc
    ;[-1, 1].forEach((x, i) => {
      const m = P['pec' + i]
      m.position.set(x * R * sc[0] * 0.92, -0.04 * sc[1], 0.05 * sc[2])
      m.rotation.y = x * (-0.55 + Math.sin(t * fl + i * 1.4) * 0.45)
      m.scale.setScalar(1 - 0.3 * kc)
    })
    P.tail.position.z = -R * sc[2] * 0.92
    P.tail.rotation.y = Math.PI / 2 + Math.sin(t * 3.2) * 0.4 + Math.sin(t * 9) * 0.15 * kc
    P.tail.scale.setScalar(1 - 0.25 * kc)
    P.dorsal.position.set(0, R * sc[1] * 0.72, -R * sc[2] * 0.62)
    P.dorsal.rotation.y = Math.PI / 2 + Math.sin(t * 5) * 0.2
    P.anal.position.set(0, -R * sc[1] * 0.68, -R * sc[2] * 0.62)
    P.anal.rotation.y = Math.PI / 2 + Math.sin(t * 5 + 1) * 0.2
  })

  const set = (name) => (el) => (parts.current[name] = el)
  const sand = useMemo(() => {
    const r = rng(21)
    return {
      rocks: Array.from({ length: 4 }, (_, i) => ({ p: [Math.cos(i * 1.9 + 0.6) * (0.55 + r() * 0.3), 0.06, Math.sin(i * 1.9 + 0.6) * (0.55 + r() * 0.3)], s: 0.6 + r() * 0.7, c: ['#9a948c', '#b5ada2', '#8b8780', '#c2b8aa'][i] })),
    }
  }, [])

  return (
    <group {...handlers}>
      {/* the sandy patch */}
      <mesh geometry={geo.sand}>
        <Flat vertexColors color="#ffffff" />
      </mesh>
      {sand.rocks.map((k, i) => (
        <mesh key={i} geometry={geo.rock} position={k.p} scale={[k.s * 1.2, k.s * 0.7, k.s]}>
          <Flat color={k.c} />
        </mesh>
      ))}
      <mesh geometry={geo.shell} position={[0.42, 0.11, 0.5]} rotation={[0.2, 0.8, 0.1]}>
        <Flat color="#f3b6a8" />
      </mesh>
      <mesh geometry={geo.shell} position={[-0.55, 0.08, 0.38]} rotation={[0.1, -0.6, -0.15]} scale={0.75}>
        <Flat color="#f7e6d6" />
      </mesh>
      {/* a sprig of weed */}
      {[
        [-0.5, -0.35, 0],
        [-0.38, -0.5, 2],
        [0.58, -0.3, 4],
      ].map(([x, z, k]) => (
        <group key={k} position={[x, 0.07, z]}>
          {[0, 1, 2, 3].reduceRight(
            (child, i) => (
              <group position-y={i === 0 ? 0 : 0.16 * (1 - (i - 1) * 0.15)}>
                <Sway i={i + k} rate={0.3} amp={0.16} lag={0.7} axis="z">
                  <mesh geometry={geo.weed} scale={1 - i * 0.15}>
                    <Flat color={i % 2 ? '#3f9a5a' : '#52b06a'} />
                  </mesh>
                  {child}
                </Sway>
              </group>
            ),
            null,
          )}
        </group>
      ))}

      {/* the fish, facing +z */}
      <group ref={fish} position-y={CY}>
        <mesh ref={body} geometry={geo.body}>
          <Flat vertexColors color="#ffffff" />
        </mesh>
        {S.map((p, i) => (
          <mesh key={i} ref={(el) => (spikes.current[i] = el)} geometry={geo.spike}>
            <Flat color={L.spike} />
          </mesh>
        ))}
        {EYES.map((n, i) => (
          <group key={i} ref={(el) => (eyes.current[i] = el)} quaternion={eyeQ[i]}>
            <mesh geometry={geo.eye}>
              <Flat color="#ffffff" roughness={0.4} />
            </mesh>
            <mesh geometry={geo.pupil} position-z={0.058} scale={[1, 1, 0.6]}>
              <Flat color="#1b1a22" roughness={0.3} />
            </mesh>
            <mesh geometry={geo.shine} position={[0.018, 0.022, 0.09]}>
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          </group>
        ))}
        <mesh ref={set('mouth')} geometry={geo.lip}>
          <Flat color={L.lip} />
        </mesh>
        {[0, 1].map((i) => (
          <group key={i} ref={set('pec' + i)}>
            <mesh geometry={geo.pec} scale={[i ? 1 : -1, 1, 1]}>
              <Flat color={L.fin} side={THREE.DoubleSide} transparent opacity={0.88} />
            </mesh>
          </group>
        ))}
        <group ref={set('tail')}>
          <mesh geometry={geo.tail}>
            <Flat color={L.fin} side={THREE.DoubleSide} />
          </mesh>
        </group>
        <group ref={set('dorsal')}>
          <mesh geometry={geo.dorsal} rotation-z={1.0}>
            <Flat color={L.fin} side={THREE.DoubleSide} />
          </mesh>
        </group>
        <group ref={set('anal')}>
          <mesh geometry={geo.dorsal} rotation-z={-1.0} scale={0.8}>
            <Flat color={L.fin} side={THREE.DoubleSide} />
          </mesh>
        </group>
        <Burst tap={tap} geometry={geo.bubble} count={12} colors={['#e4f4ff', '#a8d8f2']} speed={0.7} gravity={-0.9} size={0.03} life={1.6} origin={[0, -0.05, R + 0.05]} spread={0.7} up={0.8} />
        <mesh geometry={geo.hit}>
          <meshBasicMaterial visible={false} />
        </mesh>
      </group>

      {/* bubbles trickling up from the sand */}
      <Particles count={7} life={3.6} origin={[0.32, 0.12, -0.4]} spread={0.04} velocity={[0, 0.55, 0]} scatter={0.03} drift={0.06} size={[0.018, 0.035]} colors={['#cfeafa', '#a8d8f2']} opacity={[0.85, 0]} emissive={0.3} seed={3} />
      <Particles count={5} life={4.2} origin={[-0.62, 0.1, 0.05]} spread={0.04} velocity={[0, 0.5, 0]} scatter={0.03} drift={0.06} size={[0.015, 0.03]} colors={['#cfeafa', '#a8d8f2']} opacity={[0.8, 0]} emissive={0.3} seed={8} />
    </group>
  )
}

export default function PufferfishScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.2, 2.0, 4.4]} target={[0, 0.75, 0]} hint="The pufferfish hovers over its patch of sand, fins fluttering · tap it and it gulps water and puffs up into a spiky ball, holds, then slowly deflates · Look swaps yellow, spotted and blue · drag to orbit">
      <Pufferfish {...props} />
    </Stage>
  )
}

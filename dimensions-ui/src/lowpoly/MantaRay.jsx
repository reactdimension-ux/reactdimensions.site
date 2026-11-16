import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Particles, Stage, Sway, TAU, Tail, blob, cone, facet, rng, terrainGeo, useGeo, useTap } from './kit.jsx'

// A low-poly manta ray gliding over a patch of seabed: one wide, flat
// diamond of a body built as a faceted grid, thick at the middle and thin
// out to pointed, swept-back wing tips, with a pair of cephalic fins curling
// forward either side of the mouth, small side eyes and a thin whip of a
// tail. Below it sits a sandy mound with a few corals, rocks and swaying sea
// grass. Left alone, the wings beat in slow waves that travel out from the
// body to the tips and back along each wing, the body rising a touch on
// each downstroke, while specks drift past and bubbles rise. Tap it and it
// does a barrel roll, rising as it turns over, with a puff of bubbles.

const LOOKS = {
  reef: { top: '#2c3b57', patch: '#e9eef5', belly: '#f4f6f9', rim: '#a9b4c6', spot: '#4a5670', eye: '#12141c', sand: ['#f0dcac', '#e6cc92', '#f7e8c4'], coral: ['#ff7a6b', '#ffb43a', '#a65de2'], brain: '#f5c94a', grass: ['#5fb872', '#7cc884'], rock: '#9c9284' },
  midnight: { top: '#161a24', patch: null, belly: '#2c3242', rim: '#1e2330', spot: '#161a24', eye: '#05060a', sand: ['#7d8aa6', '#6e7b98', '#8d9ab4'], coral: ['#3fd1c8', '#7a6cf0', '#e2508c'], brain: '#4f8fe0', grass: ['#3a8f8a', '#4fa8a0'], rock: '#4a5068' },
  sand: { top: '#86664a', patch: '#cdb48c', belly: '#f5ede0', rim: '#c9b28e', spot: '#86664a', eye: '#20170e', sand: ['#f2d49a', '#e8c27c', '#f8e2b4'], coral: ['#e8543e', '#ff9a3c', '#c2367a'], brain: '#f7b733', grass: ['#8fae4a', '#a8c060'], rock: '#a58e72' },
}

const CY = 1.0 // the ray's cruising height
const SPAN = 1.0 // half its wingspan
const NX = 24 // grid columns across the span (even)
const NZ = 6 // grid rows from the trailing to the leading edge
const FLAP = 1.65 // wingbeat, radians a second
const ROLL = 1.9 // seconds a barrel roll takes
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u))

// The outline seen from above, at a = |x| / SPAN: the leading edge sweeps
// back to the tip, the trailing edge bows forward into a sickle.
const zFront = (a) => 0.42 - 0.74 * a ** 1.15
const zBack = (a) => -0.36 + 0.04 * a + 0.07 * Math.sin(Math.PI * a)
// Thickness: a raised body in the middle, a thin wing outside, blunt at the
// head and tapering to a knife edge round the rim.
const thick = (a, u) => (0.012 + 0.12 * Math.exp(-((a / 0.22) ** 2))) * Math.sin(Math.PI * Math.min(1, Math.max(0, u))) ** (0.35 + 0.5 * a)
// The wingbeat: a wave running out to the tips and back along the chord.
const beat = (a, u, t, amp) => amp * a ** 1.5 * Math.sin(t * FLAP - a * 2.4 - (1 - u) * 1.1) + 0.018 * a * Math.sin(t * FLAP * 2 - (1 - u) * 4)

// One surface (top or underside) as a grid, unshared per face so every
// facet can carry its own colour. Returns the geometry and, for each
// vertex, the grid point it follows.
function wingSurface(top, colorAt, seed) {
  const r = rng(seed)
  const idx = []
  const at = (i, j) => i * (NZ + 1) + j
  for (let i = 0; i < NX; i++)
    for (let j = 0; j < NZ; j++) {
      const q = [at(i, j), at(i + 1, j), at(i, j + 1), at(i + 1, j + 1)]
      const tris = (i + j) % 2 ? [[q[0], q[2], q[1]], [q[1], q[2], q[3]]] : [[q[0], q[2], q[3]], [q[0], q[3], q[1]]]
      tris.forEach((tr) => idx.push(top ? tr : [tr[0], tr[2], tr[1]]))
    }
  const map = new Int32Array(idx.length * 3)
  const col = new Float32Array(idx.length * 9)
  const c = new THREE.Color()
  idx.forEach((tr, f) => {
    // the face centre in (signed a, u) terms picks its colour
    let x = 0
    let u = 0
    tr.forEach((k) => {
      x += (Math.floor(k / (NZ + 1)) / NX) * 2 - 1
      u += (k % (NZ + 1)) / NZ
    })
    c.set(colorAt(x / 3, u / 3, r)).multiplyScalar(0.93 + r() * 0.12)
    tr.forEach((k, v) => {
      map[f * 3 + v] = k
      col.set([c.r, c.g, c.b], (f * 3 + v) * 3)
    })
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(idx.length * 9), 3))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return { g, map }
}

export function MantaRay({ look = 'reef' }) {
  const L = LOOKS[look] || LOOKS.reef
  const { tap, handlers, clock } = useTap(1.2)
  const yaw = useRef()
  const roll = useRef()
  const eyes = useRef([])
  const cephs = useRef([])
  const specks = useRef([])

  // the grid's resting points, a little jittered for the faceted look
  const grid = useMemo(() => {
    const r = rng(7)
    return Array.from({ length: (NX + 1) * (NZ + 1) }, (_, k) => {
      const i = Math.floor(k / (NZ + 1))
      const j = k % (NZ + 1)
      const x = (i / NX) * 2 - 1
      const a = Math.abs(x)
      const edge = i === 0 || i === NX || j === 0 || j === NZ
      return { x: x * SPAN + (edge ? 0 : (r() - 0.5) * 0.02), a, u: j / NZ, jy: (r() - 0.5) * 0.012, jz: edge ? 0 : (r() - 0.5) * 0.016 }
    })
  }, [])

  const geo = useGeo(() => {
    const topColor = (x, u, r) => {
      const a = Math.abs(x)
      // chevron shoulder patches, pale against the dark back
      if (L.patch && a > 0.1 && a < 0.46 && u > 0.42 && u < 0.92 - a * 0.55) return L.patch
      if (a < 0.06 && u > 0.1 && u < 0.8) return new THREE.Color(L.top).multiplyScalar(0.8)
      return L.top
    }
    const bellyColor = (x, u, r) => {
      const a = Math.abs(x)
      if (a > 0.78 || u < 0.1 || (u > 0.9 && a > 0.2)) return L.rim
      if (a < 0.3 && u > 0.2 && u < 0.6 && r() < 0.18) return L.spot
      return L.belly
    }
    const fin = (len, r, seed) => facet(new THREE.ConeGeometry(r, len, 5, 1).translate(0, len / 2, 0).rotateX(Math.PI / 2).scale(1, 0.38, 1), r * 0.06, seed)
    return {
      top: wingSurface(true, topColor, 3),
      belly: wingSurface(false, bellyColor, 4),
      ceph: fin(0.19, 0.05, 11),
      pelvic: fin(0.12, 0.04, 12).rotateY(Math.PI),
      dorsal: facet(new THREE.ConeGeometry(0.03, 0.06, 4, 1).translate(0, 0.03, 0).scale(0.4, 1, 1.6), 0.002, 13),
      mouth: new THREE.BoxGeometry(0.17, 0.025, 0.02),
      eye: new THREE.IcosahedronGeometry(0.022, 0),
      glint: new THREE.IcosahedronGeometry(0.007, 0),
      // the seabed
      sand: terrainGeo({ radius: 1.4, height: 0.13, seed: 5, rings: 5, segs: 16, rough: 0.35, profile: 'dome', bands: [[0, L.sand[0]], [0.4, L.sand[1]], [0.75, L.sand[2]]] }),
      base: facet(new THREE.CylinderGeometry(1.43, 1.5, 0.068, 16, 1).translate(0, 0.023, 0), 0.02, 19),
      limb: facet(new THREE.CylinderGeometry(0.6, 1, 1, 5, 1).translate(0, 0.5, 0), 0.04, 20),
      tip: new THREE.IcosahedronGeometry(1, 0),
      brain: facet(new THREE.IcosahedronGeometry(0.16, 1).scale(1, 0.62, 1), 0.014, 21),
      rock: blob(0.14, 22, 0),
      blade: cone(0.03, 0.34, 4, 23),
      speck: new THREE.IcosahedronGeometry(1, 0),
      bubble: new THREE.IcosahedronGeometry(1, 0),
      hit: new THREE.BoxGeometry(2.1, 0.5, 1.4).translate(0, 0, -0.05),
    }
  }, [look])

  // staghorn corals: a stem and a fan of short limbs, each tipped pale
  const CORALS = useMemo(
    () => [
      { p: [0.62, 0.06, -0.38], s: 1, c: 0, n: 4, ph: 0 },
      { p: [-0.74, 0.05, 0.3], s: 0.8, c: 1, n: 3, ph: 1.4 },
      { p: [-0.2, 0.1, -0.78], s: 0.7, c: 2, n: 3, ph: 2.6 },
    ],
    [],
  )
  // specks drifting past, so the water itself seems to flow
  const SP = useMemo(() => {
    const r = rng(41)
    return Array.from({ length: 24 }, () => ({ x: (r() - 0.5) * 3, y: 0.3 + r() * 1.8, z: (r() - 0.5) * 3, s: 0.008 + r() * 0.01, v: 0.08 + r() * 0.08, ph: r() * TAU }))
  }, [])

  const point = (x, a, u, t, amp, top, out) => {
    const zf = zFront(a)
    const zb = zBack(a)
    const h = thick(a, u)
    out.x = x
    out.y = (top ? h : -h * 0.55) + beat(a, u, t, amp)
    out.z = zb + u * (zf - zb)
    return out
  }

  const P = useMemo(() => ({ x: 0, y: 0, z: 0 }), [])
  const onClick = (e) => {
    e.stopPropagation()
    if (tap.since(clock.elapsedTime) > ROLL) tap.kick(clock.elapsedTime)
  }

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const rolling = s >= 0 && s < ROLL
    const u = rolling ? ease(s / ROLL) : 0
    const amp = 0.2 * (1 + 0.5 * Math.sin(Math.PI * u))
    // deform both surfaces from the same grid points
    const pos = grid.map((g) => {
      point(g.x, g.a, g.u, t, amp, true, P)
      const yt = P.y + g.jy
      const z = P.z + g.jz
      point(g.x, g.a, g.u, t, amp, false, P)
      return [g.x, yt, P.y + g.jy * 0.5, z]
    })
    for (const [k, top] of [['top', true], ['belly', false]]) {
      const { g, map } = geo[k]
      const arr = g.attributes.position.array
      for (let v = 0; v < map.length; v++) {
        const q = pos[map[v]]
        arr[v * 3] = q[0]
        arr[v * 3 + 1] = top ? q[1] : q[2]
        arr[v * 3 + 2] = q[3]
      }
      g.attributes.position.needsUpdate = true
      g.computeBoundingSphere()
    }
    // eyes and cephalic fins ride the wave near the head
    ;[-1, 1].forEach((sx, i) => {
      point(sx * 0.2, 0.2, 0.86, t, amp, true, P)
      eyes.current[i]?.position.set(P.x, P.y - 0.01, P.z)
      const c = cephs.current[i]
      if (c) {
        point(sx * 0.11, 0.11, 0.97, t, amp, true, P)
        c.position.set(P.x, -0.01 + beat(0.11, 1, t, amp), zFront(0.11) - 0.02)
        c.rotation.set(0.38 + 0.08 * Math.sin(t * 1.3 + i), sx * 0.12, sx * 0.15 + 0.06 * Math.sin(t * 1.7 + i * 2))
      }
    })
    // a slow glide: rising on each downstroke, drifting on a lazy curve
    const g = yaw.current
    g.position.set(Math.sin(t * 0.21) * 0.16, CY + 0.035 * Math.sin(t * FLAP + Math.PI) + 0.16 * Math.sin(Math.PI * u), Math.sin(t * 0.17 + 1) * 0.12)
    g.rotation.y = -0.85 + Math.sin(t * 0.21) * 0.18
    const r = roll.current
    r.rotation.z = TAU * u + Math.sin(t * 0.21 + 0.6) * 0.07
    r.rotation.x = -0.04 * Math.cos(t * FLAP) - 0.25 * Math.sin(Math.PI * u)
    // the drifting specks
    SP.forEach((p, i) => {
      const m = specks.current[i]
      if (!m) return
      const z = ((p.z + t * p.v + 1.5) % 3) - 1.5
      m.position.set(p.x + Math.sin(t * 0.5 + p.ph) * 0.05, p.y + Math.sin(t * 0.4 + p.ph) * 0.05, z)
      m.material.opacity = 0.6 * Math.min(1, (1.5 - Math.abs(z)) * 2)
    })
  })

  const topMat = <Flat vertexColors color="#ffffff" side={THREE.DoubleSide} roughness={0.7} />

  return (
    <group {...handlers} onClick={onClick}>
      {/* the seabed: a sandy mound with corals, rocks and sea grass */}
      <mesh geometry={geo.sand} position-y={0.06}>
        <Flat vertexColors color="#ffffff" />
      </mesh>
      <mesh geometry={geo.base}>
        <Flat color={L.sand[1]} />
      </mesh>
      <group position-y={0.05}>
      {CORALS.map((c, n) => (
        <group key={n} position={c.p} scale={c.s}>
          <Sway rate={0.25} amp={0.04} axis="z" i={c.ph}>
            <mesh geometry={geo.limb} scale={[0.035, 0.18, 0.035]}>
              <Flat color={L.coral[c.c]} />
            </mesh>
            {Array.from({ length: c.n }, (_, k) => (
              <group key={k} position-y={0.15} rotation-y={(k / c.n) * TAU + c.ph}>
                <group rotation-z={0.55 + (k % 2) * 0.25}>
                  <mesh geometry={geo.limb} scale={[0.024, 0.2, 0.024]}>
                    <Flat color={L.coral[c.c]} />
                  </mesh>
                  <mesh geometry={geo.tip} position-y={0.2} scale={0.026}>
                    <Flat color="#ffe8d8" />
                  </mesh>
                </group>
              </group>
            ))}
          </Sway>
        </group>
      ))}
      <mesh geometry={geo.brain} position={[0.28, 0.1, 0.62]}>
        <Flat color={L.brain} />
      </mesh>
      <mesh geometry={geo.rock} position={[0.85, 0.05, 0.2]} scale={[1.2, 0.7, 1]}>
        <Flat color={L.rock} />
      </mesh>
      <mesh geometry={geo.rock} position={[-0.5, 0.06, -0.3]} scale={[0.8, 0.6, 0.9]} rotation-y={1}>
        <Flat color={L.rock} />
      </mesh>
      {[
        [-0.42, 0.62],
        [-0.3, 0.7],
        [-0.5, 0.74],
        [0.95, -0.2],
        [1.02, -0.08],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0.04, z]} rotation-y={i}>
          <Sway rate={0.35} amp={0.18} i={i * 0.7} axis="x">
            <mesh geometry={geo.blade} scale={[1, 0.8 + (i % 3) * 0.25, 0.4]}>
              <Flat color={L.grass[i % 2]} />
            </mesh>
          </Sway>
        </group>
      ))}
      </group>
      <Particles count={7} life={4.2} origin={[-0.55, 0.15, -0.3]} spread={0.04} velocity={[0, 0.45, 0]} scatter={0.03} drift={0.06} size={[0.018, 0.032]} colors={['#ffffff', '#d8f0ff']} opacity={[0.7, 0]} emissive={0.3} seed={4} />
      <Particles count={5} life={4.8} origin={[0.62, 0.3, -0.38]} spread={0.04} velocity={[0, 0.4, 0]} scatter={0.03} drift={0.06} size={[0.015, 0.028]} colors={['#ffffff', '#d8f0ff']} opacity={[0.6, 0]} emissive={0.3} seed={8} />
      {SP.map((p, i) => (
        <mesh key={i} ref={(el) => (specks.current[i] = el)} geometry={geo.speck} scale={p.s}>
          <meshBasicMaterial color="#ffffff" transparent opacity={0.5} depthWrite={false} />
        </mesh>
      ))}

      {/* the ray */}
      <group ref={yaw} position-y={CY}>
        <group ref={roll}>
          <mesh geometry={geo.top.g}>{topMat}</mesh>
          <mesh geometry={geo.belly.g}>{topMat}</mesh>
          <mesh geometry={geo.mouth} position={[0, -0.012, zFront(0) - 0.004]}>
            <Flat color="#15161c" />
          </mesh>
          {[-1, 1].map((sx, i) => (
            <group key={sx}>
              <group ref={(el) => (eyes.current[i] = el)}>
                <mesh geometry={geo.eye} scale={[0.7, 1, 1]}>
                  <Flat color={L.eye} roughness={0.3} />
                </mesh>
                <mesh geometry={geo.glint} position={[sx * 0.008, 0.008, 0.016]}>
                  <meshBasicMaterial color="#ffffff" />
                </mesh>
              </group>
              <group ref={(el) => (cephs.current[i] = el)}>
                <mesh geometry={geo.ceph}>
                  <Flat color={L.top} />
                </mesh>
              </group>
              <mesh geometry={geo.pelvic} position={[sx * 0.07, -0.01, zBack(0.07) + 0.02]} rotation-y={sx * 0.3}>
                <Flat color={L.top} />
              </mesh>
            </group>
          ))}
          <mesh geometry={geo.dorsal} position={[0, 0.012, zBack(0) + 0.05]}>
            <Flat color={L.top} />
          </mesh>
          <Tail position={[0, 0, zBack(0) + 0.02]} segs={7} length={0.68} r0={0.018} r1={0.004} sides={4} colors={[L.top]} rate={0.45} amp={0.1} lag={0.5} axis="y" kick={tap} kickAmp={0.12} />
          <mesh geometry={geo.hit}>
            <meshBasicMaterial visible={false} />
          </mesh>
        </group>
      </group>
      <Burst tap={tap} geometry={geo.bubble} count={16} colors={['#ffffff', '#d8f0ff', '#bfe6ff']} speed={0.9} gravity={-1.2} size={0.04} life={1.4} origin={[0, CY, 0]} spread={1.2} up={0.4} />
    </group>
  )
}

export default function MantaRayScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.1, 3.5, 3.25]} target={[0, 0.72, 0]} hint="It glides above the seabed on slow waves of its wide wings, each wave running out to the tips and back · tap it and it does a barrel roll with a puff of bubbles · Look swaps reef, midnight and sand · drag to orbit">
      <MantaRay {...props} />
    </Stage>
  )
}

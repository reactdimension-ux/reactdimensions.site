import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Stage, TAU, blob, facet, followPath, ribbonGeo, useGeo, useTap, wobble } from './kit.jsx'

// A low-poly snail on a big leaf: a spiral shell wound from a tapering tube
// along a logarithmic spiral, ringed with growth bands and a pale stripe,
// riding on a soft slug-like body with a broad foot, two long eye stalks
// tipped with eyes and two short feelers. The leaf is veined, curls up at
// its tip and holds a few dew drops. Left alone, the snail glides slowly
// round the leaf, its body stretching and contracting in a travelling wave,
// its eye stalks wobbling, and a glistening slime trail shining behind it.
// Tap it and it pulls into its shell (the body and stalks shrink away and
// the shell drops onto the leaf), stays hidden a moment, then peeks back
// out stalks first and carries on.

const LOOKS = {
  garden: { shell: '#b9773f', band: '#6e3d1e', stripe: '#e6c08a', body: '#c9b394', foot: '#dccab0', eye: '#2a2220', leaf: ['#5fae45', '#549f3d'], vein: '#a6d987' },
  sea: { shell: '#5fb4c4', band: '#24607a', stripe: '#e8f6f2', body: '#d7c2b6', foot: '#e8d9cf', eye: '#1f2a33', leaf: ['#4aa38a', '#3f937b'], vein: '#a5e0cc' },
  autumn: { shell: '#d9822b', band: '#7a2f18', stripe: '#f6d27a', body: '#a8896a', foot: '#bfa182', eye: '#2a1e18', leaf: ['#e0a63a', '#d39530'], vein: '#f6d68a' },
  candy: { shell: '#f58bb8', band: '#8f5fe0', stripe: '#fff1a8', body: '#ffd2e2', foot: '#ffe4ee', eye: '#5a2a48', leaf: ['#7fd6a0', '#6fc690'], vein: '#d2f6dc' },
}

const LEAF_L = 1.15 // half the leaf's length (along z)
const LEAF_W = 0.78 // half its widest width
const SHELL_Y = 0.4
const SPEED = 0.14 // path radians a second
const HIDE = 3.1 // seconds from the tap until it is fully out again

const halfW = (z) => {
  const u = Math.max(0, Math.min(1, (z + LEAF_L) / (2 * LEAF_L)))
  return LEAF_W * Math.sin(Math.PI * u) ** 0.75
}
// the leaf surface: a shallow trough that curls up at the tip
const leafY = (x, z) => {
  const v = x / Math.max(halfW(z), 1e-3)
  const tip = Math.max(0, (z - 0.55) / 0.6)
  return 0.03 + 0.14 * v * v + 0.2 * tip * tip
}
// the snail's loop round the leaf
const pathAt = (p) => {
  const x = Math.cos(p) * 0.32
  const z = Math.sin(p) * 0.5
  return new THREE.Vector3(x, leafY(x, z), z)
}

const ease = (u) => {
  const x = Math.max(0, Math.min(1, u))
  return x * x * (3 - 2 * x)
}
// how far into the shell the body is (0 out .. 1 hidden), s seconds after a tap
function hidden(s) {
  if (s < 0 || s > HIDE) return 0
  if (s < 0.3) return ease(s / 0.3)
  if (s < 1.4) return 1
  if (s < 1.8) return 1 - 0.4 * ease((s - 1.4) / 0.4)
  return 0.6 * (1 - ease((s - 1.8) / 1.0))
}
// the eye stalks: in first, out first
function stalkOut(s) {
  if (s < 0 || s > HIDE) return 1
  if (s < 0.2) return 1 - ease(s / 0.2)
  if (s < 1.5) return 0
  return ease((s - 1.5) / 0.6)
}

// The leaf: a grid laid over the trough, the two halves either side of the
// midrib a touch different in tone.
function leafGeo(colors) {
  const NZ = 18
  const NX = 10
  const pos = []
  for (let i = 0; i <= NZ; i++) {
    const z = -LEAF_L + (2 * LEAF_L * i) / NZ
    const w = halfW(z)
    for (let j = 0; j <= NX; j++) {
      const x = (-1 + (2 * j) / NX) * w
      pos.push(x, leafY(x, z), z)
    }
  }
  const idx = []
  for (let i = 0; i < NZ; i++)
    for (let j = 0; j < NX; j++) {
      const a = i * (NX + 1) + j
      idx.push(a, a + 1, a + NX + 1, a + 1, a + NX + 2, a + NX + 1)
    }
  let g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g = facet(g, 0.012, 4, [0.6, 0.5, 0.6]).toNonIndexed()
  g.computeVertexNormals()
  const p = g.attributes.position
  const col = new Float32Array(p.count * 3)
  const c = new THREE.Color()
  for (let f = 0; f < p.count; f += 3) {
    const x = p.getX(f) + p.getX(f + 1) + p.getX(f + 2)
    c.set(colors[x < 0 ? 0 : 1]).multiplyScalar(0.94 + ((f * 7919) % 13) / 100)
    for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (f + k) * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}

// The shell: a tube wound along a logarithmic spiral in the y/z plane, the
// mouth at the bottom opening forward (+z), the spire poking out to +x.
// Every few rings a dark growth band; a pale stripe runs along the outside.
function shellGeo(L) {
  const a = 0.028
  const b = Math.log(2.2) / TAU
  const TH = 5 * Math.PI
  const steps = 64
  const sides = 8
  const rMax = a * Math.exp(b * TH)
  const ring = []
  for (let i = 0; i <= steps; i++) {
    const th = (i / steps) * TH
    const r = a * Math.exp(b * th)
    const A = th - TH - Math.PI / 2
    const ny = Math.sin(A)
    const nz = Math.cos(A)
    const cx = 0.4 * (rMax - r)
    const rho = 0.47 * r
    const pts = []
    for (let j = 0; j < sides; j++) {
      const q = (j / sides) * TAU
      pts.push([cx + Math.sin(q) * rho, ny * r + ny * Math.cos(q) * rho, nz * r + nz * Math.cos(q) * rho])
    }
    ring.push({ pts, c: [cx, ny * r, nz * r] })
  }
  const pos = []
  const col = []
  const C = { shell: new THREE.Color(L.shell), band: new THREE.Color(L.band), stripe: new THREE.Color(L.stripe), mouth: new THREE.Color(L.band).multiplyScalar(0.6) }
  const tri = (p1, p2, p3, c) => {
    pos.push(...p1, ...p2, ...p3)
    for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b)
  }
  for (let i = 0; i < steps; i++)
    for (let j = 0; j < sides; j++) {
      const j2 = (j + 1) % sides
      const A0 = ring[i].pts[j]
      const B0 = ring[i].pts[j2]
      const A1 = ring[i + 1].pts[j]
      const B1 = ring[i + 1].pts[j2]
      const c = i % 5 === 4 ? C.band : j === 0 || j === 7 ? C.stripe : C.shell
      const shade = c.clone().multiplyScalar(0.93 + ((i * 3 + j) % 4) * 0.035)
      tri(A0, A1, B0, shade)
      tri(B0, A1, B1, shade)
    }
  // the mouth, capped dark
  const last = ring[steps]
  for (let j = 0; j < sides; j++) tri(last.c, last.pts[(j + 1) % sides], last.pts[j], C.mouth)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  facet(g, 0.004, 9)
  return g
}

// the body, tail to head: [z, y, sx, sy, sz]
const BODY = [
  [-0.32, 0.045, 0.5, 0.32, 1.3],
  [-0.18, 0.06, 0.82, 0.55, 1.7],
  [-0.03, 0.075, 0.98, 0.72, 1.8],
  [0.12, 0.082, 1, 0.76, 1.7],
  [0.25, 0.1, 0.94, 0.82, 1.5],
  [0.35, 0.15, 0.86, 0.95, 1.2],
  [0.43, 0.2, 0.78, 0.8, 0.95],
]
const PIVOT = [0, 0.14, -0.06] // where the body shrinks back into the shell
const TRAIL_N = 48

export function Snail({ look = 'garden' }) {
  const L = LOOKS[look] || LOOKS.garden
  const { tap, handlers, clock } = useTap(1)
  const snail = useRef()
  const shell = useRef()
  const body = useRef()
  const segs = useRef([])
  const stalks = useRef([])
  const eyes = useRef([])
  const feelers = useRef([])
  const st = useRef({ phase: 0 })

  const geo = useGeo(
    () => ({
      leaf: leafGeo(L.leaf),
      rib: ribbonGeo((u) => new THREE.Vector3(0, leafY(0, -LEAF_L + 0.1 + u * (2 * LEAF_L - 0.25)) + 0.006, -LEAF_L + 0.1 + u * (2 * LEAF_L - 0.25)), 0.03, 24),
      veins: [-0.75, -0.45, -0.15, 0.15, 0.42].flatMap((z0) =>
        [-1, 1].map((s) =>
          ribbonGeo((u) => {
            const z = z0 + u * 0.32
            const x = s * u * 0.8 * halfW(z)
            return new THREE.Vector3(x, leafY(x, z) + 0.006, z)
          }, 0.014, 8),
        ),
      ),
      stem: new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.035, -LEAF_L + 0.06), new THREE.Vector3(0.03, 0.03, -LEAF_L - 0.14), new THREE.Vector3(0.1, 0.022, -LEAF_L - 0.3)]), 6, 0.022, 5),
      drop: blob(1, 21, 1),
      shell: shellGeo(L),
      seg: blob(0.1, 11, 1),
      foot: blob(0.1, 12, 1),
      stalk: new THREE.CylinderGeometry(0.009, 0.013, 0.22, 5, 1).translate(0, 0.11, 0),
      feeler: new THREE.CylinderGeometry(0.008, 0.012, 0.07, 5, 1).translate(0, 0.035, 0),
      eye: new THREE.IcosahedronGeometry(0.022, 1),
      knob: new THREE.IcosahedronGeometry(0.012, 0),
      hit: new THREE.CylinderGeometry(0.85, 0.85, 0.85, 10).translate(0, 0.42, 0),
      trail: (() => {
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_N * 2 * 3), 3))
        const c = new Float32Array(TRAIL_N * 2 * 4)
        for (let i = 0; i < TRAIL_N; i++) {
          const a = 0.95 * (1 - i / TRAIL_N) ** 1.1
          c.set([1, 1, 1, a, 1, 1, 1, a], i * 8)
        }
        g.setAttribute('color', new THREE.BufferAttribute(c, 4))
        const idx = []
        for (let i = 0; i < TRAIL_N - 1; i++) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2)
        g.setIndex(idx)
        return g
      })(),
    }),
    [look],
  )

  const drops = useMemo(
    () =>
      [
        [0.5, 0.1, 0.045],
        [-0.48, -0.3, 0.038],
        [0.16, 0.85, 0.03],
        [-0.2, -0.85, 0.034],
        [-0.55, 0.2, 0.026],
      ].map(([x, z, r]) => ({ p: [x, leafY(x, z) + r * 0.35, z], r })),
    [],
  )

  const onClick = (e) => {
    e.stopPropagation()
    const s = tap.since(clock.elapsedTime)
    if (s >= 0 && s < HIDE) return // already hiding
    handlers.onClick(e)
  }

  useFrame((_, dt) => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const R = hidden(s)
    const E = stalkOut(s)
    const S = st.current
    // glide on, in surges with the body's wave, and stop while hidden
    S.phase += Math.min(dt, 0.05) * SPEED * (1 - R) * (0.75 + 0.35 * Math.sin(t * 2.4))
    followPath(snail.current, pathAt, S.phase, 0)

    // the travelling wave along the body
    segs.current.forEach((m, i) => {
      if (!m) return
      const [z, y, sx, sy, sz] = BODY[i]
      const w = Math.sin(t * 2.4 - i * 0.8)
      m.position.set(0, y, z + 0.022 * w)
      m.scale.set(sx, sy * (1 - 0.05 * w), sz * (1 + 0.12 * Math.sin(t * 2.4 - i * 0.8 + 1)))
    })
    const k = 1 - 0.86 * R
    body.current.scale.set(Math.max(0.05, 1 - 0.6 * R), Math.max(0.05, k), Math.max(0.05, k))

    // the shell drops onto the leaf as the body goes in, with a little rock
    const sh = shell.current
    sh.position.y = SHELL_Y - 0.1 * R
    sh.rotation.x = 0.12 * R + 0.06 * wobble(s - 0.25, 12, 4) + 0.015 * Math.sin(t * 2.4 - 2)
    sh.rotation.z = 0.025 * Math.sin(t * 1.2)

    // eye stalks out (or in), wobbling as they look about
    stalks.current.forEach((g, i) => {
      if (!g) return
      const side = i ? 1 : -1
      g.rotation.x = 0.45 + 0.14 * Math.sin(t * 1.7 + i * 1.3) + 0.25 * (1 - E)
      g.rotation.z = -side * 0.28 + 0.1 * Math.sin(t * 1.3 + i * 2.1)
      g.children[0].scale.y = Math.max(0.02, E)
      eyes.current[i].position.y = 0.22 * E
      eyes.current[i].scale.setScalar(Math.max(0.2, E))
    })
    feelers.current.forEach((g, i) => {
      if (!g) return
      const f = Math.max(0.02, Math.min(1, E * 1.2))
      g.rotation.x = 1.15 + 0.12 * Math.sin(t * 2.2 + i)
      g.scale.setScalar(f)
    })

    // the slime trail: the path just walked, tapering away behind
    const p = geo.trail.attributes.position
    for (let i = 0; i < TRAIL_N; i++) {
      const ph = S.phase - 0.05 - i * 0.052
      const c = pathAt(ph)
      const n = pathAt(ph + 0.01).sub(pathAt(ph - 0.01))
      const ax = -n.z
      const az = n.x
      const len = Math.hypot(ax, az) || 1
      const w = 0.075 * (1 - i / TRAIL_N) ** 0.5
      const y = c.y + 0.008
      p.setXYZ(2 * i, c.x - (ax / len) * w, y, c.z - (az / len) * w)
      p.setXYZ(2 * i + 1, c.x + (ax / len) * w, y, c.z + (az / len) * w)
    }
    p.needsUpdate = true
    geo.trail.computeVertexNormals()
    geo.trail.computeBoundingSphere()
  })

  return (
    <group {...handlers} onClick={onClick}>
      <mesh geometry={geo.hit}>
        <meshBasicMaterial visible={false} />
      </mesh>
      {/* the leaf, its veins and dew */}
      <mesh geometry={geo.leaf}>
        <Flat vertexColors color="#ffffff" side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geo.rib}>
        <Flat color={L.vein} side={THREE.DoubleSide} />
      </mesh>
      {geo.veins.map((v, i) => (
        <mesh key={i} geometry={v}>
          <Flat color={L.vein} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh geometry={geo.stem}>
        <Flat color={L.leaf[1]} />
      </mesh>
      {drops.map((d, i) => (
        <mesh key={i} geometry={geo.drop} position={d.p} scale={[d.r, d.r * 0.7, d.r]}>
          <meshStandardMaterial color="#e6f6ff" emissive="#bfe6ff" emissiveIntensity={0.25} flatShading roughness={0.05} metalness={0.1} transparent opacity={0.7} />
        </mesh>
      ))}
      <mesh geometry={geo.trail}>
        <meshStandardMaterial color="#f2faff" emissive="#d8eeff" emissiveIntensity={0.55} vertexColors roughness={0.08} metalness={0.15} transparent depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      {/* the snail, heading along +z */}
      <group ref={snail}>
        <group position={PIVOT}>
          <group ref={body}>
            <group position={PIVOT.map((v) => -v)}>
              <mesh geometry={geo.foot} position={[0, 0.022, 0.02]} scale={[1.2, 0.22, 4.3]}>
                <Flat color={L.foot} />
              </mesh>
              {BODY.map((b, i) => (
                <mesh key={i} ref={(el) => (segs.current[i] = el)} geometry={geo.seg} position={[0, b[1], b[0]]} scale={[b[2], b[3], b[4]]}>
                  <Flat color={L.body} />
                </mesh>
              ))}
              {[-1, 1].map((x, i) => (
                <group key={x} ref={(el) => (stalks.current[i] = el)} position={[x * 0.035, 0.24, 0.42]}>
                  <mesh geometry={geo.stalk}>
                    <Flat color={L.body} />
                  </mesh>
                  <mesh ref={(el) => (eyes.current[i] = el)} geometry={geo.eye} position-y={0.22}>
                    <Flat color={L.eye} roughness={0.3} />
                  </mesh>
                </group>
              ))}
              {[-1, 1].map((x, i) => (
                <group key={x} ref={(el) => (feelers.current[i] = el)} position={[x * 0.045, 0.17, 0.48]} rotation-z={-x * 0.4}>
                  <mesh geometry={geo.feeler}>
                    <Flat color={L.body} />
                  </mesh>
                  <mesh geometry={geo.knob} position-y={0.07}>
                    <Flat color={L.foot} />
                  </mesh>
                </group>
              ))}
            </group>
          </group>
        </group>
        <group ref={shell} position={[0, SHELL_Y, -0.08]}>
          <mesh geometry={geo.shell}>
            <Flat vertexColors color="#ffffff" roughness={0.55} side={THREE.DoubleSide} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

export default function SnailScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.3, 1.7, 3.0]} target={[0, 0.3, 0]} hint="The snail glides slowly round its leaf, body rippling, eye stalks wobbling, a slime trail glistening behind · tap it and it pulls into its shell, waits, then peeks back out stalks first · Look swaps garden, sea, autumn and candy · drag to orbit">
      <Snail {...props} />
    </Stage>
  )
}

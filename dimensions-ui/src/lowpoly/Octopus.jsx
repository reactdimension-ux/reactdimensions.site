import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Particles, Stage, TAU, Tail, blinkAt, blob, facet, rng, squash, useGeo, useTap } from './kit.jsx'

// A low-poly octopus hovering over a sandy sea floor: a bulbous faceted
// mantle, two big eyes with dark pupils, a little siphon at its side and
// eight tapering tentacles spreading from beneath, each a chain of links
// with pale suckers along its underside. Rocks and swaying seaweed sit on
// the sand and bubbles rise past. Left alone, its tentacles wave in a wave
// that rolls round the circle, one arm after the next, while it bobs gently
// and blinks. Tap it and it squeezes its mantle, puffs out a dark cloud of
// ink that hangs and fades where it was, and jets upward with its tentacles
// streaming straight behind, then drifts back down and spreads them again.

const LOOKS = {
  coral: { skin: '#f0765f', dark: '#c9503e', pale: '#ffd2c2', iris: '#ffe6a8' },
  purple: { skin: '#8d5cc4', dark: '#6a3e9e', pale: '#e2cdf6', iris: '#f4e08a' },
  teal: { skin: '#2fa7a0', dark: '#1f7f7a', pale: '#c4f0e8', iris: '#ffe08a' },
  gold: { skin: '#e8b23a', dark: '#c08a22', pale: '#fff0c4', iris: '#fff6dc' },
}

const CY = 1.05 // the body's resting height
const ARMS = 8
const SEGS = 7
const ARM_LEN = 0.95
const LINK = ARM_LEN / SEGS
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))

export function Octopus({ look = 'coral' }) {
  const L = LOOKS[look] || LOOKS.coral
  const { tap, handlers, clock } = useTap(1)
  const body = useRef()
  const mantle = useRef()
  const lids = useRef([])
  const arms = useRef([]) // arms[a][i]: the link pivots
  const bases = useRef([])
  const inks = useRef([])
  const inkAt = useRef(CY)

  const geo = useGeo(
    () => ({
      mantle: facet(new THREE.IcosahedronGeometry(1, 2).scale(0.36, 0.44, 0.38).translate(0, 0.26, -0.05), 0.02, 2),
      head: facet(new THREE.IcosahedronGeometry(1, 1).scale(0.3, 0.2, 0.3), 0.012, 3),
      white: new THREE.IcosahedronGeometry(0.095, 1),
      iris: new THREE.IcosahedronGeometry(0.06, 1),
      pupil: new THREE.IcosahedronGeometry(0.038, 1),
      glint: new THREE.IcosahedronGeometry(0.014, 0),
      siphon: facet(new THREE.CylinderGeometry(0.035, 0.05, 0.11, 6, 1, true).translate(0, 0.055, 0), 0.004, 4),
      links: Array.from({ length: SEGS }, (_, i) => {
        const a = 0.085 * (1 - (i / SEGS) * 0.82)
        const b = 0.085 * (1 - ((i + 1) / SEGS) * 0.82)
        return facet(new THREE.CylinderGeometry(b, a, LINK * 1.12, 6, 1).translate(0, LINK / 2, 0).rotateX(-Math.PI / 2), a * 0.05, 10 + i)
      }),
      sucker: new THREE.IcosahedronGeometry(1, 0),
      ink: new THREE.IcosahedronGeometry(1, 1),
      sand: facet(new THREE.CylinderGeometry(1.7, 1.85, 0.14, 20, 1).translate(0, -0.08, 0), 0.03, 30),
      rock: blob(0.22, 31, 1),
      hit: new THREE.IcosahedronGeometry(0.55, 0).scale(1, 1.3, 1).translate(0, 0.05, 0),
    }),
    [],
  )

  // the ink cloud: puffs scattered about where it squirted
  const INK = useMemo(() => {
    const r = rng(17)
    return Array.from({ length: 9 }, () => ({ p: [(r() - 0.5) * 0.5, -0.3 - r() * 0.35, (r() - 0.5) * 0.5], d: [(r() - 0.5) * 0.4, -0.08 - r() * 0.12, (r() - 0.5) * 0.4], s: 0.14 + r() * 0.12, delay: r() * 0.25 }))
  }, [])

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const on = s >= 0 && s < 4
    // squeeze, jet up, drift down
    let lift = 0
    let k = 0
    let stream = 0
    if (on) {
      if (s < 0.22) k = 0.18 * ease(s / 0.22) // fill up
      else if (s < 0.6) k = 0.18 - 0.48 * ease((s - 0.22) / 0.2) // squeeze hard
      else k = -0.3 * Math.exp(-3 * (s - 0.6)) * Math.cos((s - 0.6) * 6)
      lift = s < 0.25 ? -0.04 * ease(s / 0.25) : s < 1 ? 0.85 * ease((s - 0.25) / 0.75) : 0.85 * (1 - ease((s - 1) / 3))
      stream = s < 0.25 ? 0 : s < 0.4 ? ease((s - 0.25) / 0.15) : s < 1.2 ? 1 : 1 - ease((s - 1.2) / 1.3)
    }
    const y = CY + Math.sin(t * 1.1) * 0.05 + lift
    body.current.position.y = y
    body.current.rotation.y = Math.sin(t * 0.3) * 0.25
    body.current.rotation.z = Math.sin(t * 0.7) * 0.04 * (1 - stream)
    squash(mantle.current, k + Math.sin(t * 2.2) * 0.03)
    // the arms: a wave rolling round the circle, or streamed straight down
    arms.current.forEach((links, a) => {
      if (!links) return
      bases.current[a].rotation.x = -0.75 * (1 - stream) - 1.45 * stream
      links.forEach((g, i) => {
        if (!g) return
        const wave = Math.sin(t * 1.4 - i * 0.55 - (a / ARMS) * TAU) * (0.12 + i * 0.03)
        g.rotation.x = (0.15 + wave) * (1 - stream) + stream * Math.sin(t * 9 - i * 0.8) * 0.03
      })
    })
    // blink
    const b = blinkAt(t, 3.8)
    lids.current.forEach((l) => l && (l.scale.y = b))
    // ink: puffs that swell and fade where it squirted, left behind as it rises
    if (s >= 0 && s < 0.3) inkAt.current = y
    inks.current.forEach((m, i) => {
      if (!m) return
      const u = (s - 0.3 - INK[i].delay) / 2.8
      m.visible = u >= 0 && u < 1
      if (!m.visible) return
      const P = INK[i]
      m.position.set(P.p[0] + P.d[0] * u, inkAt.current + P.p[1] + P.d[1] * u, P.p[2] + P.d[2] * u)
      m.scale.setScalar(P.s * (0.3 + 1.4 * Math.sqrt(u)))
      m.material.opacity = 0.85 * (1 - u) ** 1.3
    })
  })

  return (
    <group {...handlers}>
      {/* the sea floor: sand, rocks and seaweed */}
      <mesh geometry={geo.sand}>
        <Flat color="#c8b48a" />
      </mesh>
      <mesh geometry={geo.rock} position={[-0.95, 0.05, -0.45]} scale={[1.2, 0.7, 1]}>
        <Flat color="#6a7480" />
      </mesh>
      <mesh geometry={geo.rock} position={[1.0, 0.03, 0.35]} scale={[0.7, 0.5, 0.8]}>
        <Flat color="#7e8690" />
      </mesh>
      <mesh geometry={geo.rock} position={[0.75, 0.02, -0.85]} scale={[0.5, 0.35, 0.5]}>
        <Flat color="#5e6872" />
      </mesh>
      {[
        [-0.75, -0.15, 0.9, 0],
        [-0.6, -0.65, 0.7, 1],
        [1.15, -0.1, 0.8, 2],
        [0.4, -1.05, 0.65, 3],
      ].map(([x, z, len, i]) => (
        <group key={i} position={[x, 0, z]}>
          {[0, 1].map((j) => (
            <group key={j} position-x={j * 0.07} rotation={[Math.PI / 2 - j * 0.25, 0, j * 0.3]}>
              <Tail segs={6} length={len * (1 - j * 0.3)} r0={0.05} r1={0.012} sides={4} colors={['#3f9a4e', '#56b062']} rate={0.3 + i * 0.05 + j * 0.07} amp={0.22} lag={0.7} axis={(i + j) % 2 ? 'x' : 'y'} />
            </group>
          ))}
        </group>
      ))}
      <Particles count={7} life={4.5} origin={[0.85, 0.1, 0.15]} spread={0.06} velocity={[0, 0.55, 0]} scatter={0.04} drift={0.08} size={[0.02, 0.04]} colors={['#ffffff', '#cfeaff']} opacity={[0.75, 0]} emissive={0.4} seed={3} />
      <Particles count={6} life={5} origin={[-0.7, 0.15, -0.3]} spread={0.06} velocity={[0, 0.5, 0]} scatter={0.04} drift={0.08} size={[0.018, 0.035]} colors={['#ffffff', '#cfeaff']} opacity={[0.65, 0]} emissive={0.4} seed={9} />

      {/* the ink cloud stays where it was squirted */}
      {INK.map((p, i) => (
        <mesh key={i} ref={(el) => (inks.current[i] = el)} geometry={geo.ink} visible={false}>
          <meshStandardMaterial color={i % 3 ? '#1c1626' : '#2c2438'} flatShading roughness={1} transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}

      <group ref={body} position-y={CY}>
        <mesh geometry={geo.hit}>
          <meshBasicMaterial visible={false} />
        </mesh>
        <group ref={mantle}>
          <mesh geometry={geo.mantle}>
            <Flat color={L.skin} />
          </mesh>
          {/* a few darker spots on the mantle */}
          {[
            [0.18, 0.42, 0.18],
            [-0.2, 0.36, 0.2],
            [0.05, 0.6, 0.02],
            [-0.12, 0.5, -0.25],
            [0.24, 0.3, -0.2],
          ].map((p, i) => (
            <mesh key={i} geometry={geo.sucker} position={p} scale={[0.04, 0.03, 0.04]}>
              <Flat color={L.dark} />
            </mesh>
          ))}
        </group>
        <mesh geometry={geo.head}>
          <Flat color={L.skin} />
        </mesh>
        {/* eyes: white, iris, pupil, with lids that blink */}
        {[-1, 1].map((x, i) => (
          <group key={x} position={[x * 0.17, 0.08, 0.22]} rotation-y={x * 0.35}>
            <group ref={(el) => (lids.current[i] = el)}>
              <mesh geometry={geo.white} scale={[1, 1.1, 0.7]}>
                <Flat color="#fbfaf4" roughness={0.4} />
              </mesh>
              <mesh geometry={geo.iris} position-z={0.045} scale={[1, 1.1, 0.5]}>
                <Flat color={L.iris} roughness={0.4} />
              </mesh>
              <mesh geometry={geo.pupil} position-z={0.07} scale={[1, 1.15, 0.5]}>
                <Flat color="#141218" roughness={0.3} />
              </mesh>
              <mesh geometry={geo.glint} position={[x * 0.012, 0.022, 0.09]}>
                <meshBasicMaterial color="#ffffff" />
              </mesh>
            </group>
          </group>
        ))}
        {/* the siphon at its side */}
        <mesh geometry={geo.siphon} position={[0.27, 0.0, 0.05]} rotation-z={-1.1}>
          <Flat color={L.dark} side={THREE.DoubleSide} />
        </mesh>
        {/* eight tapering arms with suckers on their undersides */}
        {Array.from({ length: ARMS }, (_, a) => (
          <group key={a} rotation-y={(a / ARMS) * TAU + Math.PI / ARMS}>
            <group ref={(el) => (bases.current[a] = el)} position={[0, -0.1, -0.16]} rotation-x={-0.75}>
              <Arm a={a} geo={geo} L={L} arms={arms} />
            </group>
          </group>
        ))}
      </group>
    </group>
  )
}

// One arm: a chain of links pointing along -z, each a pivot for the next.
function Arm({ a, geo, L, arms }) {
  const link = (i) =>
    i === SEGS ? null : (
      <group
        position-z={i === 0 ? 0 : -LINK}
        ref={(el) => {
          if (!arms.current[a]) arms.current[a] = []
          arms.current[a][i] = el
        }}
      >
        <mesh geometry={geo.links[i]}>
          <Flat color={i > SEGS - 3 ? L.dark : L.skin} />
        </mesh>
        {/* suckers on the underside */}
        {[0.3, 0.75].map((f) => {
          const r = 0.085 * (1 - ((i + f) / SEGS) * 0.82)
          return (
            <mesh key={f} geometry={geo.sucker} position={[0, -r * 0.92, -LINK * f]} scale={[r * 0.45, r * 0.2, r * 0.45]}>
              <Flat color={L.pale} />
            </mesh>
          )
        })}
        {link(i + 1)}
      </group>
    )
  return link(0)
}

export default function OctopusScene({ background = '#16263a', autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.4, 1.9, 4.8]} target={[0, 0.95, 0]} hint="Its arms wave in a ripple that rolls round the circle as it bobs and blinks · tap it and it squeezes, puffs a cloud of ink and jets upward, arms streaming, then drifts back down · Look swaps coral, purple, teal and gold · drag to orbit">
      <Octopus {...props} />
    </Stage>
  )
}

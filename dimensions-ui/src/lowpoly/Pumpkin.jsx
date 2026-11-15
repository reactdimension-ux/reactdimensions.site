import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Stage, TAU, blob, facet, squash, useGeo, useTap, wobble } from './kit.jsx'

// A low-poly jack-o'-lantern: eight faceted lobes round a squat core, a
// twisted stem, a leaf and a curl of vine, and a carved face that glows and
// flickers as if a candle burned inside, lighting the floor in front. Tap it
// and it hops and pulls a new face: happy, spooky, then surprised.

const SKINS = {
  orange: { lobe: '#ec7a22', lobe2: '#d9661a', core: '#c95a14' },
  ghost: { lobe: '#f1ece2', lobe2: '#e2dccf', core: '#d4ccbd' },
  green: { lobe: '#5f9a4a', lobe2: '#4e863d', core: '#3f7032' },
  heirloom: { lobe: '#e8b48a', lobe2: '#d9a077', core: '#c78e66' },
}
const GLOW = '#ffb02e'
const LOBES = 8
const FRONT_Z = 0.56

// set a cut back into the curved skin: the further from the face centre,
// the deeper
function sink(g) {
  g.computeBoundingBox()
  const c = g.boundingBox.getCenter(new THREE.Vector3())
  return g.translate(0, 0, -1.6 * (c.x * c.x + c.y * c.y))
}
const poly = (pts) => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)))
const circ = (cx, cy, r, n = 6) => poly(Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * TAU) * r, cy + Math.sin((i / n) * TAU) * r]))
const mirror = (pts) => pts.map(([x, y]) => [-x, y]).reverse()

// each expression is a list of cut-outs, in face units (about 0.5 wide)
const LEFT_SLANT = [
  [-0.22, 0.13],
  [-0.05, 0.05],
  [-0.19, 0.0],
]
const EXPRESSIONS = [
  // happy: triangle eyes and nose, a gap-toothed grin
  [
    poly([[-0.2, 0.02], [-0.06, 0.02], [-0.13, 0.14]]),
    poly([[0.06, 0.02], [0.2, 0.02], [0.13, 0.14]]),
    poly([[-0.04, -0.06], [0.04, -0.06], [0, 0.0]]),
    poly([[-0.24, -0.1], [-0.15, -0.13], [-0.11, -0.09], [-0.04, -0.14], [0.04, -0.14], [0.11, -0.09], [0.15, -0.13], [0.24, -0.1], [0.13, -0.23], [-0.13, -0.23]]),
  ],
  // spooky: slanted eyes and a jagged mouth
  [
    poly(LEFT_SLANT),
    poly(mirror(LEFT_SLANT)),
    poly([[-0.22, -0.1], [-0.15, -0.06], [-0.09, -0.12], [0, -0.06], [0.09, -0.12], [0.15, -0.06], [0.22, -0.1], [0.11, -0.22], [0.04, -0.17], [-0.04, -0.22], [-0.11, -0.17]]),
  ],
  // surprised: round eyes and an O
  [circ(-0.12, 0.07, 0.065), circ(0.12, 0.07, 0.065), circ(0, -0.14, 0.075, 7)],
]

export function Pumpkin({ skin = 'orange' }) {
  const S = SKINS[skin] || SKINS.orange
  const { tap, handlers, clock } = useTap(2)
  const body = useRef()
  const faces = useRef([])
  const glowMats = useRef([])
  const light = useRef()
  const expr = useRef(0)

  const geo = useGeo(
    () => ({
      lobe: blob(0.34, 1),
      core: blob(0.4, 2),
      stem: facet(new THREE.CylinderGeometry(0.04, 0.065, 0.2, 5, 2).translate(0, 0.1, 0), 0.01, 3),
      leaf: facet(new THREE.IcosahedronGeometry(0.12, 0), 0.008, 4).scale(1, 0.15, 1.3).translate(0, 0, 0.13),
      vine: new THREE.TorusGeometry(0.07, 0.012, 3, 10, Math.PI * 1.6),
      cuts: EXPRESSIONS.map((set) => set.map((sh) => sink(new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: false }).translate(0, 0, -0.03)))),
      // a dark rim round each cut, scaled about the cut's own centre
      rims: EXPRESSIONS.map((set) =>
        set.map((sh) => {
          const g = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: false })
          g.computeBoundingBox()
          const c = g.boundingBox.getCenter(new THREE.Vector3())
          return sink(g.translate(-c.x, -c.y, 0).scale(1.3, 1.3, 1).translate(c.x, c.y, -0.04))
        }),
      ),
    }),
    [],
  )

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    // a hop: up on a quick arc, with a squash on take-off and landing
    const hop = s >= 0 && s < 0.45 ? Math.sin((s / 0.45) * Math.PI) * 0.22 : 0
    body.current.position.y = hop
    squash(body.current, wobble(s, 18, 4) * 0.1)
    body.current.rotation.y = Math.sin(t * 0.5) * 0.15
    // the new face appears at the top of the hop
    faces.current.forEach((f, i) => f && (f.visible = i === expr.current))
    // candle flicker
    const f = 0.75 + 0.12 * Math.sin(t * 11) + 0.08 * Math.sin(t * 17.3 + 1) + 0.05 * Math.sin(t * 3.1)
    glowMats.current.forEach((m) => m && (m.emissiveIntensity = 1.4 * f))
    light.current.intensity = 1.2 * f
  })

  return (
    <group
      {...handlers}
      onClick={(e) => {
        handlers.onClick(e)
        expr.current = (expr.current + 1) % EXPRESSIONS.length
      }}
    >
      <group ref={body}>
        <mesh geometry={geo.core} position-y={0.36} scale={[1, 0.82, 1]}>
          <Flat color={S.core} />
        </mesh>
        {Array.from({ length: LOBES }, (_, i) => {
          const a = (i / LOBES) * TAU + Math.PI / 2
          return (
            <mesh key={i} geometry={geo.lobe} position={[Math.cos(a) * 0.26, 0.37, Math.sin(a) * 0.26]} rotation-y={-a} scale={[0.95, 1.05, 0.62]}>
              <Flat color={i % 2 ? S.lobe2 : S.lobe} />
            </mesh>
          )
        })}
        <mesh geometry={geo.stem} position-y={0.7} rotation={[0.15, 0, -0.2]}>
          <Flat color="#5c6a2e" />
        </mesh>
        <mesh geometry={geo.leaf} position={[0.05, 0.74, 0.02]} rotation={[-0.3, 0.8, 0.2]}>
          <Flat color="#4f8a3a" />
        </mesh>
        <mesh geometry={geo.vine} position={[-0.1, 0.78, 0]} rotation={[0, 0.6, 0.4]}>
          <Flat color="#4f8a3a" />
        </mesh>

        {/* the carved face, one set per expression */}
        <group position={[0, 0.38, FRONT_Z]} scale={[0.78, 0.78, 1]}>
          {geo.cuts.map((set, i) => (
            <group key={i} ref={(el) => (faces.current[i] = el)} visible={i === 0}>
              {set.map((g, j) => (
                <group key={j}>
                  <mesh geometry={geo.rims[i][j]}>
                    <Flat color="#5a2408" />
                  </mesh>
                  <mesh geometry={g} position-z={0.012}>
                    <meshStandardMaterial ref={(m) => (glowMats.current[i * 10 + j] = m)} color="#ffcf5a" emissive={GLOW} flatShading />
                  </mesh>
                </group>
              ))}
            </group>
          ))}
        </group>
        <pointLight ref={light} color={GLOW} distance={1.6} decay={2} position={[0, 0.06, 0.85]} />
      </group>
    </group>
  )
}

export default function PumpkinScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.2, 1.8, 4]} target={[0, 0.4, 0]} hint="The face glows and flickers like a candle on its own · tap it and it hops and pulls a new face: happy, spooky, surprised · Skin swaps orange, ghost, green and heirloom · drag to orbit">
      <Pumpkin {...props} />
    </Stage>
  )
}

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flame, Flat, Stage, TAU, facet, rng, squash, useGeo, useTap, wobble } from './kit.jsx'

// A low-poly cupcake: a fluted paper case whose pleats stand in and out
// round the side, a domed cake top, a tall swirl of icing built from
// stacked, shrinking faceted rings scattered with sprinkles, and a striped
// candle on top. The candle flame flickers on its own. Tap it and a burst of
// sprinkles flies out, the cupcake squashes and springs back, and the flame
// gusts up.

const LOOKS = {
  strawberry: { icing: '#f6a3c0', icing2: '#f28bb0', case: '#e8607f', cake: '#d9a066' },
  chocolate: { icing: '#6e412b', icing2: '#5e3523', case: '#e2bf8e', cake: '#5a3322' },
  vanilla: { icing: '#fbf1d8', icing2: '#f4e6c2', case: '#7fb7e6', cake: '#e3b071' },
  mint: { icing: '#a6e8c9', icing2: '#8fdcb8', case: '#5a3a2c', cake: '#6b4030' },
}
const SPRINKLES = ['#e3393f', '#f6c22e', '#3d7fe0', '#5ac74a', '#ffffff', '#9a5ce0']
const PLEATS = 24
// radius, tube, height of each ring of the icing swirl
const SWIRL = [
  [0.36, 0.145, 0.64],
  [0.27, 0.13, 0.84],
  [0.17, 0.11, 1.01],
  [0.07, 0.085, 1.13],
]

// a paper case: a tapered cylinder whose rim points step in and out
function paperCase() {
  const g = new THREE.CylinderGeometry(0.5, 0.38, 0.48, PLEATS, 2, false).translate(0, 0.24, 0)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const z = p.getZ(i)
    if (Math.hypot(x, z) < 0.01) continue
    const a = Math.atan2(z, x)
    const k = ((Math.round(a / (TAU / PLEATS)) % 2) + 2) % 2 ? 0.93 : 1.04
    p.setXYZ(i, x * k, p.getY(i), z * k)
  }
  g.computeVertexNormals()
  return g
}

export function Cupcake({ look = 'strawberry' }) {
  const L = LOOKS[look] || LOOKS.strawberry
  const { tap, handlers, clock } = useTap(2)
  const body = useRef()

  const geo = useGeo(
    () => ({
      case: paperCase(),
      lip: new THREE.TorusGeometry(0.5, 0.025, 3, PLEATS).rotateX(Math.PI / 2),
      dome: facet(new THREE.SphereGeometry(0.5, 12, 4, 0, TAU, 0, Math.PI / 2).scale(1, 0.4, 1), 0.015, 3),
      rings: SWIRL.map(([r, tube], i) => facet(new THREE.TorusGeometry(r, tube, 6, 14).rotateX(Math.PI / 2), 0.012, 10 + i)),
      tip: facet(new THREE.ConeGeometry(0.08, 0.14, 7, 1), 0.008, 20),
      sprinkle: new THREE.BoxGeometry(0.07, 0.02, 0.02),
      stripe: new THREE.CylinderGeometry(0.035, 0.035, 0.065, 7, 1),
      wick: new THREE.CylinderGeometry(0.006, 0.006, 0.05, 4, 1),
    }),
    [],
  )

  // sprinkles scattered over the outer faces of the lower three rings
  const sprinkles = useMemo(() => {
    const r = rng(7)
    return Array.from({ length: 30 }, (_, i) => {
      const lv = i % 3
      const [R, tube, y] = SWIRL[lv]
      const a = r() * TAU
      const b = 0.15 + r() * 1.25 // from the outer side up over the top
      const rr = R + tube * Math.cos(b) * 1.02
      return { p: [Math.cos(a) * rr, y + tube * Math.sin(b) * 1.02, Math.sin(a) * rr], rot: [r() * TAU, r() * TAU, r() * TAU], c: SPRINKLES[i % SPRINKLES.length] }
    })
  }, [])

  const gust = () => 1 + 1.3 * tap.value(clock.elapsedTime)

  useFrame(() => {
    const s = tap.since(clock.elapsedTime)
    squash(body.current, wobble(s, 13, 3.2) * 0.2)
  })

  const candleBase = 1.19
  return (
    <group {...handlers}>
      <group ref={body}>
        <mesh geometry={geo.case}>
          <Flat color={L.case} />
        </mesh>
        <mesh geometry={geo.lip} position-y={0.48}>
          <Flat color={L.case} />
        </mesh>
        <mesh geometry={geo.dome} position-y={0.47}>
          <Flat color={L.cake} />
        </mesh>
        {SWIRL.map(([, , y], i) => (
          <mesh key={i} geometry={geo.rings[i]} position-y={y} rotation-y={i * 0.7}>
            <Flat color={i % 2 ? L.icing2 : L.icing} roughness={0.6} />
          </mesh>
        ))}
        <mesh geometry={geo.tip} position-y={1.2}>
          <Flat color={L.icing} roughness={0.6} />
        </mesh>
        {sprinkles.map((s, i) => (
          <mesh key={i} geometry={geo.sprinkle} position={s.p} rotation={s.rot}>
            <Flat color={s.c} roughness={0.5} />
          </mesh>
        ))}
        {/* striped candle */}
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} geometry={geo.stripe} position-y={candleBase + 0.0325 + i * 0.065}>
            <Flat color={i % 2 ? '#ffffff' : '#3d8fe0'} />
          </mesh>
        ))}
        <mesh geometry={geo.wick} position-y={candleBase + 0.35}>
          <Flat color="#2a2420" />
        </mesh>
        <Flame size={0.3} power={gust} position-y={candleBase + 0.36} />
      </group>
      <Burst tap={tap} geometry={geo.sprinkle} count={26} colors={SPRINKLES} speed={2.2} gravity={4} size={1} life={1.2} origin={[0, 0.9, 0]} up={1.3} />
    </group>
  )
}

export default function CupcakeScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} target={[0, 0.85, 0]} hint="The candle flame flickers on its own · tap it and sprinkles burst out, the cupcake squashes and springs and the flame gusts · Look swaps strawberry, chocolate, vanilla and mint · drag to orbit">
      <Cupcake {...props} />
    </Stage>
  )
}

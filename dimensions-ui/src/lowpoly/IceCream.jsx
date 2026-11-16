import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Stage, TAU, blob, facet, useGeo, useTap, wobble } from './kit.jsx'

// A low-poly ice cream cone: a waffle cone, tip down, checked in light and
// dark facets so the criss-cross reads, with a rolled rim, holding three
// stacked faceted scoops, each sitting on a lumpy collar where it meets the
// one below, and a cherry on top. The whole cone sways gently, and a drip
// slowly runs from the lower scoop down the side of the cone, grows and
// starts again. Tap it and the top scoop wobbles hard on a damped spring,
// tipping far over before it recovers, and flicks off a couple of drops.

const LOOKS = {
  strawberry: { scoops: ['#f6a3c0', '#f394b6', '#f8b2ca'], cone: '#d9a05a', cone2: '#b97f3e' },
  mint: { scoops: ['#a6e8c9', '#96e0bd', '#b4eed3'], cone: '#d9a05a', cone2: '#b97f3e' },
  chocolate: { scoops: ['#7a4a30', '#6a3f28', '#86543a'], cone: '#d9a05a', cone2: '#b97f3e' },
  rainbow: { scoops: ['#f6a3c0', '#a6e8c9', '#fbe08a'], cone: '#d9a05a', cone2: '#b97f3e' },
}
const CH = 0.8 // cone height
const CR = 0.3 // cone radius at the rim
const SIDES = 12
const ROWS = 5
// radius and centre height of each scoop, bottom to top
const SCOOPS = [
  [0.31, 0.93],
  [0.27, 1.26],
  [0.23, 1.54],
]

// a cone with its tip at the origin, each quad's two triangles one colour,
// in a checker of light and dark: a waffle pattern
function waffle(a, b) {
  const prof = Array.from({ length: ROWS + 1 }, (_, j) => new THREE.Vector2(Math.max(0.001, (CR * j) / ROWS), (CH * j) / ROWS))
  const g = facet(new THREE.LatheGeometry(prof, SIDES), 0.008, 4).toNonIndexed()
  g.computeVertexNormals()
  const p = g.attributes.position
  const col = new Float32Array(p.count * 3)
  const ca = new THREE.Color(a)
  const cb = new THREE.Color(b)
  for (let f = 0; f < p.count; f += 3) {
    let x = 0
    let y = 0
    let z = 0
    for (let j = 0; j < 3; j++) {
      x += p.getX(f + j) / 3
      y += p.getY(f + j) / 3
      z += p.getZ(f + j) / 3
    }
    const i = Math.floor((((Math.atan2(z, x) + TAU) % TAU) / TAU) * SIDES)
    const row = Math.floor((y / CH) * ROWS)
    const c = (i + row) % 2 ? ca : cb
    for (let j = 0; j < 3; j++) col.set([c.r, c.g, c.b], (f + j) * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}

// the lumpy collar where a scoop meets what is below: a ring of small blobs
function Collar({ radius, y, color, n = 10, size = 0.075 }) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * TAU
    return (
      <mesh key={i} position={[Math.cos(a) * radius, y + (i % 2) * 0.015, Math.sin(a) * radius]} scale={[size * 1.3, size * (i % 3 ? 0.75 : 0.95), size * 1.3]} rotation={[0, a + i, 0]}>
        <icosahedronGeometry args={[1, 0]} />
        <Flat color={color} roughness={0.6} />
      </mesh>
    )
  })
}

export function IceCream({ look = 'strawberry' }) {
  const L = LOOKS[look] || LOOKS.strawberry
  const { tap, handlers, clock } = useTap(1.5)
  const root = useRef()
  const middle = useRef()
  const top = useRef()
  const drip = useRef()

  const geo = useGeo(
    () => ({
      cone: waffle(L.cone, L.cone2),
      rim: facet(new THREE.TorusGeometry(CR + 0.01, 0.04, 4, SIDES).rotateX(Math.PI / 2), 0.006, 5),
      scoops: SCOOPS.map(([r], i) => blob(r, 30 + i * 7, 1).scale(1, 0.85, 1)),
      cherry: blob(0.075, 60, 1),
      stem: new THREE.CylinderGeometry(0.008, 0.008, 0.14, 4, 1).translate(0, 0.07, 0),
      drip: blob(1, 70, 1).translate(0, -1, 0),
      drop: new THREE.IcosahedronGeometry(1, 0),
    }),
    [L.cone, L.cone2],
  )

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    root.current.rotation.z = Math.sin(t * 0.8) * 0.04
    root.current.rotation.x = Math.sin(t * 0.6 + 1) * 0.025
    // the top scoop swings far over on a soft spring, the middle one less
    const w = wobble(s, 6.5, 1.4)
    top.current.rotation.z = w * 0.85
    top.current.rotation.x = wobble(s - 0.08, 5.5, 1.6) * 0.3
    top.current.position.x = w * 0.06
    middle.current.rotation.z = wobble(s - 0.04, 9, 2.5) * 0.12
    // the drip grows down the cone over five seconds, then starts again
    const u = (t % 5) / 5
    const len = u < 0.9 ? 0.015 + u * 0.2 : (1 - (u - 0.9) / 0.1) * 0.195
    drip.current.scale.set(0.024 + u * 0.012, Math.max(0.001, len), 0.022)
  })

  const C = L.scoops
  // the drip starts at the rim and runs down the cone's slope, toward the tip
  const slope = -Math.atan2(CR, CH)
  return (
    <group {...handlers}>
      <group ref={root}>
        <mesh geometry={geo.cone}>
          <Flat vertexColors color="#ffffff" />
        </mesh>
        <mesh geometry={geo.rim} position-y={CH}>
          <Flat color={L.cone2} />
        </mesh>
        <group position={[CR + 0.03, CH + 0.02, 0.06]} rotation-z={slope}>
          <mesh ref={drip} geometry={geo.drip}>
            <Flat color={C[0]} roughness={0.4} />
          </mesh>
        </group>
        <Collar radius={0.28} y={CH + 0.04} color={C[0]} n={14} />
        <mesh geometry={geo.scoops[0]} position-y={SCOOPS[0][1]}>
          <Flat color={C[0]} roughness={0.6} />
        </mesh>
        <group ref={middle} position-y={SCOOPS[0][1] + 0.2}>
          <Collar radius={0.23} y={0} color={C[1]} n={13} size={0.065} />
          <mesh geometry={geo.scoops[1]} position-y={SCOOPS[1][1] - SCOOPS[0][1] - 0.2}>
            <Flat color={C[1]} roughness={0.6} />
          </mesh>
          <group ref={top} position-y={SCOOPS[1][1] - SCOOPS[0][1] - 0.2 + 0.17}>
            <Collar radius={0.19} y={0} color={C[2]} n={11} size={0.055} />
            <mesh geometry={geo.scoops[2]} position-y={SCOOPS[2][1] - SCOOPS[1][1] - 0.17}>
              <Flat color={C[2]} roughness={0.6} />
            </mesh>
            <group position-y={SCOOPS[2][1] - SCOOPS[1][1] - 0.17 + 0.23}>
              <mesh geometry={geo.cherry} position-y={0.04}>
                <Flat color="#d0202f" roughness={0.3} />
              </mesh>
              <mesh geometry={geo.stem} position-y={0.1} rotation-z={-0.35}>
                <Flat color="#4f7a2a" />
              </mesh>
            </group>
          </group>
        </group>
      </group>
      <Burst tap={tap} geometry={geo.drop} count={4} colors={[C[2], C[1]]} speed={1.8} gravity={4.5} size={0.04} life={1} origin={[0.1, 1.6, 0]} up={1.2} seed={11} />
    </group>
  )
}

export default function IceCreamScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.2, 2.2, 4.4]} target={[0, 0.95, 0]} hint="The cone sways and a drip slowly runs down the side · tap it and the top scoop wobbles and nearly topples, flicking off drops · Look swaps strawberry, mint, chocolate and rainbow · drag to orbit">
      <IceCream {...props} />
    </Stage>
  )
}

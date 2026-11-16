import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Stage, facet, squash, useGeo, useTap } from './kit.jsx'

// A low-poly watermelon slice standing on its rind on a little plate: a thick
// faceted wedge of flesh, a pale band, a green rind round the curve and black
// seeds on both faces. The rind is an arc centred on the tip, so the slice
// rocks on it like a rocking chair. Tap it and a bite is taken out of the tip:
// a scalloped chunk vanishes with a squash and a few drops of juice, then the
// slice slowly fills back in.

const LOOKS = {
  classic: { flesh: '#ef4b5a', band: '#f4f1d0', rind: '#3f9a46', dark: '#2b7a37', seed: '#1d1a1f', plate: '#f4f6fa', A: 0.56, R: 0.98, bite: 0.4 },
  yellow: { flesh: '#ffd34d', band: '#fbf5d6', rind: '#3f9a46', dark: '#2b7a37', seed: '#1d1a1f', plate: '#eef6f8', A: 0.56, R: 0.98, bite: 0.4 },
  mini: { flesh: '#f2566a', band: '#f4f1d0', rind: '#46a24c', dark: '#2f7f3b', seed: '#1d1a1f', plate: '#fbf3f0', A: Math.PI / 2, R: 0.5, bite: 0.17 },
}
const DEPTH = 0.3 // the slice's thickness
const BAND = 0.06
const RIND = 0.08

// points round the arc of radius r, from angle -A to A (0 = straight down)
const arc = (r, A, n = 8) => Array.from({ length: n + 1 }, (_, i) => new THREE.Vector2(r * Math.sin(-A + (2 * A * i) / n), -r * Math.cos(-A + (2 * A * i) / n)))
// three tooth-marks from p to q, each a little scoop dipping down
const scallop = (p, q, dip) => Array.from({ length: 19 }, (_, i) => new THREE.Vector2(p.x + ((q.x - p.x) * i) / 18, p.y + ((q.y - p.y) * i) / 18 - dip * Math.sqrt(1 - (((i % 6) / 3 - 1) ** 2))))
const slab = (pts, seed, amt = 0.008) => facet(new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: DEPTH, bevelEnabled: false }).translate(0, 0, -DEPTH / 2), amt, seed, [0, 0, 1])

function sliceGeometry({ A, R, bite }) {
  // the bite's two ends: down the wedge's sides (or along the half-moon's top)
  const wedge = A < 1.4
  const L = wedge ? new THREE.Vector2(-bite * Math.tan(A), -bite) : new THREE.Vector2(-bite * 1.3, 0)
  const Q = new THREE.Vector2(-L.x, L.y)
  const cut = scallop(Q, L, R * 0.08)
  const ring = (r0, r1) => [...arc(r1, A), ...arc(r0, A).reverse()]
  return {
    body: slab([L, ...arc(R, A), Q, ...cut.slice(1, -1)], 1, 0),
    chunk: slab([new THREE.Vector2(0, 0), L, ...[...cut].reverse().slice(1, -1), Q], 2, 0),
    band: slab(ring(R, R + BAND), 3),
    rind: slab(ring(R + BAND, R + BAND + RIND), 4),
    seed: new THREE.IcosahedronGeometry(1, 0),
    drop: new THREE.OctahedronGeometry(1, 0),
    plate: facet(new THREE.CylinderGeometry(R * 0.8 + 0.3, R * 0.8 + 0.16, 0.07, 14).translate(0, 0.035, 0), 0.01, 5),
    well: new THREE.CylinderGeometry(R * 0.8 + 0.12, R * 0.8 + 0.12, 0.012, 14).translate(0, 0.072, 0),
  }
}

export function Watermelon({ look = 'classic' }) {
  const L = LOOKS[look] || LOOKS.classic
  const { tap, handlers, clock } = useTap(2)
  const rock = useRef()
  const sq = useRef()
  const chunk = useRef()
  const top = L.R + BAND + RIND // the arc's centre, above the plate
  const geo = useGeo(() => sliceGeometry(L), [look])
  // seeds on both faces, in a ring through the flesh, pointing at the tip
  const n = L.A < 1.4 ? 7 : 9
  const seeds = Array.from({ length: n }, (_, i) => {
    const ang = -L.A * 0.72 + (1.44 * L.A * i) / (n - 1)
    const r = L.R * (i % 2 ? 0.58 : 0.74)
    return [Math.sin(ang) * r, -Math.cos(ang) * r, ang]
  })

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    // rock on the rind: turning about the arc's centre rolls it along the plate
    const a = Math.sin(t * 1.1) * 0.09 + Math.sin(t * 0.43) * 0.04
    rock.current.rotation.z = a
    rock.current.position.x = -top * a
    // the bite: a quick squash, the chunk gone, then grown back after a pause
    squash(sq.current, s >= 0 && s < 0.5 ? 0.16 * Math.sin((s / 0.5) * Math.PI) * (1 - s) : 0)
    const back = Math.min(1, Math.max(0, (s - 1.8) / 0.7))
    chunk.current.scale.setScalar(s >= 0 && s < 1.8 ? Math.max(0.001, 1 - s / 0.06) : Math.max(0.001, back * (1 + 0.5 * back * (1 - back))))
  })

  return (
    <group {...handlers}>
      <mesh geometry={geo.plate}>
        <Flat color={L.plate} roughness={0.4} />
      </mesh>
      <mesh geometry={geo.well}>
        <Flat color="#ffffff" roughness={0.3} />
      </mesh>
      <group position-y={0.078}>
        <group ref={sq}>
          <group ref={rock} position-y={top}>
            <mesh geometry={geo.body}>
              <Flat color={L.flesh} roughness={0.6} />
            </mesh>
            <mesh ref={chunk} geometry={geo.chunk}>
              <Flat color={L.flesh} roughness={0.6} />
            </mesh>
            <mesh geometry={geo.band}>
              <Flat color={L.band} />
            </mesh>
            <mesh geometry={geo.rind}>
              <Flat color={L.rind} />
            </mesh>
            {seeds.map(([x, y, ang], i) =>
              [-1, 1].map((f) => (
                <mesh key={`${i}${f}`} geometry={geo.seed} position={[x, y, f * (DEPTH / 2 + 0.004)]} rotation-z={ang} scale={[0.022, 0.04, 0.012]}>
                  <Flat color={L.seed} roughness={0.3} />
                </mesh>
              )),
            )}
          </group>
        </group>
      </group>
      <Burst tap={tap} geometry={geo.drop} count={9} colors={[L.flesh, '#ffffff', L.flesh]} speed={1.5} gravity={5} size={0.04} life={0.8} origin={[0, top - L.bite * 0.5, 0]} spread={0.9} />
    </group>
  )
}

export default function WatermelonScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3, 2, 4.2]} target={[0, 0.55, 0]} hint="The slice rocks gently on its rind by itself · tap it to take a bite: a chunk vanishes with a squash and a few drops of juice, then it fills back in · Look swaps classic, yellow and mini · drag to orbit">
      <Watermelon {...props} />
    </Stage>
  )
}

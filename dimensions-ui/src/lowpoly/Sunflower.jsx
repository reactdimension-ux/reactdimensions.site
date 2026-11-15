import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Stage, Sway, TAU, blob, cone, facet, useGeo, useTap, wobble } from './kit.jsx'

// A tall low-poly sunflower on a mound of soil: a faceted stem with broad
// leaves and a big head with two rings of petals round a seed disc set in a
// golden-angle spiral. The head turns to follow the cursor (or the camera,
// when the pointer is still) and the stem sways. Tap it and the petals
// shake.

const KINDS = {
  classic: { petal: '#f6c22e', petal2: '#f0a51f', disc: '#5a3a1f', seed: '#3e2614' },
  lemon: { petal: '#f7e37a', petal2: '#efd257', disc: '#4a3a22', seed: '#2e2416' },
  copper: { petal: '#e0662a', petal2: '#b8401f', disc: '#3e2416', seed: '#2a170e' },
  cream: { petal: '#f6efd8', petal2: '#eadfbe', disc: '#6a4a26', seed: '#4a3218' },
}
const STEM = '#4f9a3f'
const LEAF = '#3f8a3a'
const PETALS = 14
const DISC = 0.2
const GOLDEN = Math.PI * (3 - Math.sqrt(5))

export function Sunflower({ kind = 'classic' }) {
  const K = KINDS[kind] || KINDS.classic
  const { tap, handlers, clock } = useTap(1.4)
  const head = useRef()
  const rings = useRef([])
  const tmp = useMemo(() => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), o: new THREE.Object3D(), q: new THREE.Quaternion(), pq: new THREE.Quaternion() }), [])

  const geo = useGeo(
    () => ({
      stem: facet(new THREE.CylinderGeometry(0.035, 0.05, 1.3, 5, 4).translate(0, 0.65, 0), 0.01, 1),
      leaf: facet(new THREE.IcosahedronGeometry(0.2, 0), 0.012, 2).scale(0.75, 0.12, 1.3).translate(0, 0, 0.22),
      back: facet(new THREE.CylinderGeometry(DISC * 1.12, DISC * 0.7, 0.08, 10, 1).rotateX(Math.PI / 2).translate(0, 0, -0.05), 0.006, 3),
      disc: new THREE.CylinderGeometry(DISC, DISC, 0.05, 10, 1).rotateX(Math.PI / 2),
      seed: new THREE.IcosahedronGeometry(0.018, 0),
      petal: facet(new THREE.IcosahedronGeometry(0.1, 0), 0.006, 4).scale(0.55, 1.6, 0.2).translate(0, DISC + 0.13, 0),
      mound: facet(new THREE.SphereGeometry(0.55, 9, 4, 0, TAU, 0, Math.PI / 2), 0.03, 5, [1, 0.5, 1], (x, y) => y < 0.001),
      tuft: cone(0.035, 0.18, 3, 6),
    }),
    [],
  )
  // seeds in a golden-angle spiral
  const seeds = useMemo(() => Array.from({ length: 34 }, (_, i) => {
    const r = Math.sqrt((i + 0.5) / 34) * DISC * 0.88
    return [Math.cos(i * GOLDEN) * r, Math.sin(i * GOLDEN) * r]
  }), [])

  useFrame(({ camera, pointer }, dt) => {
    const t = clock.elapsedTime
    const h = head.current
    // turn toward a point under the cursor, at the head's own depth
    h.getWorldPosition(tmp.p)
    tmp.v.set(pointer.x, pointer.y, 0.5).unproject(camera).sub(camera.position).normalize()
    tmp.v.multiplyScalar(camera.position.distanceTo(tmp.p) * 0.75).add(camera.position)
    tmp.o.position.copy(tmp.p)
    tmp.o.lookAt(tmp.v)
    h.parent.getWorldQuaternion(tmp.pq).invert()
    tmp.q.copy(tmp.pq).multiply(tmp.o.quaternion)
    h.quaternion.slerp(tmp.q, 1 - Math.exp(-3 * Math.min(dt, 0.05)))
    // petals shake on a tap, the outer ring a moment after the inner
    rings.current.forEach((r, i) => {
      if (!r) return
      const w = wobble(tap.since(t) - i * 0.06, 24, 3)
      r.rotation.z = w * 0.12
      r.scale.setScalar(1 + Math.abs(w) * 0.08)
    })
  })

  return (
    <group {...handlers}>
      <mesh geometry={geo.mound} scale={[1, 0.45, 1]}>
        <Flat color="#6b4a32" />
      </mesh>
      {[
        [0.38, 0.1],
        [-0.32, 0.2],
        [0.05, -0.4],
        [-0.2, -0.3],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0.1, z]}>
          {[-0.3, 0, 0.3].map((a) => (
            <mesh key={a} geometry={geo.tuft} rotation-z={a}>
              <Flat color="#5a9a3a" />
            </mesh>
          ))}
        </group>
      ))}

      <Sway position-y={0.2} i={0} rate={0.3} amp={0.04} axis="z">
        <Sway i={1} rate={0.25} amp={0.03} axis="x">
          <mesh geometry={geo.stem}>
            <Flat color={STEM} />
          </mesh>
          {[
            [0.35, 0.4, 0.55],
            [0.6, -2.6, 0.5],
            [0.85, 1.2, 0.4],
          ].map(([y, a, pitch], i) => (
            <mesh key={i} geometry={geo.leaf} position-y={y} rotation={[pitch, a, 0]} scale={1 - i * 0.15}>
              <Flat color={i % 2 ? STEM : LEAF} />
            </mesh>
          ))}

          <group position-y={1.32}>
            <group ref={head}>
              <mesh geometry={geo.back}>
                <Flat color={LEAF} />
              </mesh>
              <mesh geometry={geo.disc}>
                <Flat color={K.disc} />
              </mesh>
              {seeds.map(([x, y], i) => (
                <mesh key={i} geometry={geo.seed} position={[x, y, 0.028]}>
                  <Flat color={i % 3 ? K.seed : K.disc} />
                </mesh>
              ))}
              {[0, 1].map((ring) => (
                <group key={ring} ref={(el) => (rings.current[ring] = el)} position-z={ring ? -0.02 : 0}>
                  {Array.from({ length: PETALS }, (_, i) => (
                    <mesh key={i} geometry={geo.petal} rotation-z={((i + ring * 0.5) / PETALS) * TAU} scale={ring ? 1.08 : 1}>
                      <Flat color={ring ? K.petal2 : K.petal} />
                    </mesh>
                  ))}
                </group>
              ))}
            </group>
          </group>
        </Sway>
      </Sway>
    </group>
  )
}

export default function SunflowerScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.6, 2, 4.6]} target={[0, 0.95, 0]} hint="The head turns to follow your cursor and the stem sways on its own · tap it and the petals shake · Kind swaps classic, lemon, copper and cream · drag to orbit">
      <Sunflower {...props} />
    </Stage>
  )
}

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Stage, Trail, blob, followPath, useGeo, useTap } from './kit.jsx'

// A folded paper dart gliding a lazy figure of eight among three small
// clouds: two flat wings with a little dihedral over a creased keel, banking
// into every turn and rising and sinking on the air, with a dotted trail
// behind it. Tap it and it pulls up into a full loop and carries on.

const PAPERS = {
  white: { wing: '#fbfaf6', keel: '#e3e0d6', trail: '#ffffff' },
  blue: { wing: '#8fc0f2', keel: '#6fa4dc', trail: '#cfe6ff' },
  pink: { wing: '#f7b2c8', keel: '#e891ad', trail: '#ffe0ea' },
  note: { wing: '#fbe9a0', keel: '#ecd47a', trail: '#fff6cc' },
}
const LOOP = 1.5 // seconds for the loop
const LOOP_R = 0.45

// a dart: nose, a tail point on each wing tip, the spine and the keel
function dartGeo() {
  const N = [0, 0, 0.45]
  const L = [-0.34, 0.05, -0.35]
  const Rr = [0.34, 0.05, -0.35]
  const C = [0, 0, -0.35]
  const K = [0, -0.11, -0.3]
  const wings = new THREE.BufferGeometry()
  wings.setAttribute('position', new THREE.Float32BufferAttribute([...N, ...C, ...L, ...N, ...Rr, ...C], 3))
  wings.computeVertexNormals()
  const keel = new THREE.BufferGeometry()
  keel.setAttribute('position', new THREE.Float32BufferAttribute([...N, ...K, ...C, ...N, ...C, ...K], 3))
  keel.computeVertexNormals()
  return { wings, keel }
}

const path = (t) => new THREE.Vector3(Math.sin(t * 0.55) * 1.25, 1.05 + Math.sin(t * 1.1 + 1) * 0.18, Math.sin(t * 1.1) * 0.7)

export function PaperPlane({ paper = 'white', trail = true }) {
  const P = PAPERS[paper] || PAPERS.white
  const { tap, handlers, clock } = useTap(1)
  const plane = useRef()
  const geo = useGeo(() => ({ ...dartGeo(), puff: blob(0.16, 3) }), [])

  useFrame(() => {
    const t = clock.elapsedTime
    const o = plane.current
    followPath(o, path, t, 1.4)
    // a loop: swing round a vertical circle in the plane's own frame
    const s = tap.since(t)
    if (s >= 0 && s < LOOP) {
      const u = s / LOOP
      const th = (u * u * (3 - 2 * u)) * Math.PI * 2
      o.translateY(LOOP_R * (1 - Math.cos(th)))
      o.translateZ(LOOP_R * Math.sin(th))
      o.rotateX(-th)
    }
  })

  return (
    <group {...handlers}>
      <group ref={plane}>
        <mesh geometry={geo.wings}>
          <Flat color={P.wing} side={THREE.DoubleSide} roughness={0.9} />
        </mesh>
        <mesh geometry={geo.keel}>
          <Flat color={P.keel} side={THREE.DoubleSide} roughness={0.9} />
        </mesh>
      </group>
      {trail && <Trail target={plane} count={24} every={0.035} color={P.trail} size={0.025} grow={0} opacity={0.8} />}

      {/* three small clouds to fly among */}
      {[
        [-0.9, 0.55, -0.6, 1],
        [1.0, 1.55, -0.3, 0.8],
        [0.2, 0.35, 0.9, 0.7],
      ].map(([x, y, z, s], i) => (
        <group key={i} position={[x, y, z]} scale={s}>
          <mesh geometry={geo.puff} scale={[1.5, 0.85, 1]}>
            <Flat color="#ffffff" />
          </mesh>
          <mesh geometry={geo.puff} position={[0.18, -0.03, 0.03]} scale={[0.9, 0.7, 0.8]}>
            <Flat color="#f2f4f8" />
          </mesh>
          <mesh geometry={geo.puff} position={[-0.17, -0.04, -0.02]} scale={[0.85, 0.65, 0.8]}>
            <Flat color="#f2f4f8" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export default function PaperPlaneScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.2, 2.2, 4.4]} target={[0, 0.95, 0]} hint="The dart glides a figure of eight, banking into each turn, on its own · tap it and it pulls up into a loop · Paper swaps white, blue, pink and note · Trail turns the dotted trail on and off · drag to orbit">
      <PaperPlane {...props} />
    </Stage>
  )
}

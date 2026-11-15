import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Particles, Ripple, Stage, Tail, Water, blob, facet, useGeo, useTap } from './kit.jsx'

// A low-poly whale basking in a round of rolling sea: a broad head with a
// pale throat, a tapering body that is a lag chain of links ending in wide
// flukes, pectoral fins, a blowhole and small side eyes. Like a real whale
// it swims by beating its tail up and down, each link a beat behind the
// last, while the body rides gently on the swell and it takes a small
// breath now and then. Tap it and it blows a tall spout and the sea rings.

const KINDS = {
  blue: { back: '#4a6f9a', belly: '#c9d6e2', fin: '#4a6f9a', patch: null },
  humpback: { back: '#2c3440', belly: '#eef2f6', fin: '#eef2f6', patch: null },
  orca: { back: '#1b1d24', belly: '#ffffff', fin: '#1b1d24', patch: '#ffffff' },
  beluga: { back: '#eef2f6', belly: '#ffffff', fin: '#e2e8ee', patch: null },
}
const SEA = 0.06

export function Whale({ kind = 'blue' }) {
  const K = KINDS[kind] || KINDS.blue
  const { tap, handlers, clock } = useTap(1)
  const body = useRef()

  const geo = useGeo(
    () => ({
      head: blob(0.26, 1),
      throat: blob(0.2, 2),
      fluke: (() => {
        const s = new THREE.Shape()
        s.moveTo(0, 0.02)
        s.lineTo(0.22, -0.08)
        s.lineTo(0.18, -0.12)
        s.lineTo(0.05, -0.08)
        s.lineTo(0, -0.04)
        s.lineTo(-0.05, -0.08)
        s.lineTo(-0.18, -0.12)
        s.lineTo(-0.22, -0.08)
        s.closePath()
        return facet(new THREE.ExtrudeGeometry(s, { depth: 0.025, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, 0, 0), 0.004, 3)
      })(),
      fin: facet(new THREE.IcosahedronGeometry(0.08, 0), 0.004, 4).scale(0.35, 0.18, 1.6).translate(0, 0, -0.1),
      eye: new THREE.IcosahedronGeometry(0.018, 0),
      hole: new THREE.IcosahedronGeometry(0.02, 0),
      patch: blob(0.05, 5, 0),
    }),
    [],
  )
  const spouting = () => {
    const s = tap.since(clock.elapsedTime)
    return s >= 0 && s < 1.6 ? 1 : clock.elapsedTime % 7 < 0.5 ? 0.25 : 0
  }

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const lift = s >= 0 && s < 2 ? Math.sin(Math.min(1, s / 0.4) * Math.PI * 0.5) * Math.exp(-Math.max(0, s - 0.8) * 2) * 0.05 : 0
    body.current.position.y = SEA + 0.01 + Math.sin(t * 0.8) * 0.02 + lift // about half its height above the water
    body.current.rotation.x = Math.sin(t * 0.7) * 0.04 - lift
    body.current.rotation.z = Math.sin(t * 0.5) * 0.03
  })

  return (
    <group {...handlers}>
      <Water radius={1.5} color="#3f8fc8" edge="#2a6aa0" amp={0.022} y={SEA} opacity={0.82} />
      <Ripple loop period={3} count={2} color="#ffffff" radius={1.1} opacity={0.3} y={SEA + 0.03} />
      <Ripple tap={tap} count={3} color="#ffffff" radius={1.4} y={SEA + 0.03} />

      <group ref={body} rotation-y={-0.5}>
        <group position-z={0.3}>
          <mesh geometry={geo.head} scale={[0.95, 0.72, 1.35]}>
            <Flat color={K.back} />
          </mesh>
          <mesh geometry={geo.throat} position={[0, -0.07, 0.04]} scale={[0.95, 0.6, 1.4]}>
            <Flat color={K.belly} />
          </mesh>
          {[-1, 1].map((x) => (
            <group key={x}>
              <mesh geometry={geo.eye} position={[x * 0.22, -0.02, 0.12]}>
                <Flat color="#1b1a22" />
              </mesh>
              {K.patch && (
                <mesh geometry={geo.patch} position={[x * 0.2, 0.04, 0.05]} scale={[0.4, 0.6, 1.4]}>
                  <Flat color={K.patch} />
                </mesh>
              )}
              <group position={[x * 0.2, -0.1, -0.08]} rotation={[0.2, x * 0.6, x * -0.5]}>
                <mesh geometry={geo.fin}>
                  <Flat color={K.fin} />
                </mesh>
              </group>
            </group>
          ))}
          <mesh geometry={geo.hole} position={[0, 0.18, -0.05]} scale={[1.4, 0.4, 1]}>
            <Flat color="#1b1a22" />
          </mesh>
          <Particles count={26} life={1.1} origin={[0, 0.2, -0.05]} spread={0.02} velocity={[0, 1.9, 0]} scatter={0.22} gravity={3.4} drift={0.03} size={[0.025, 0.06]} colors={['#ffffff', '#dff3ff', '#bfe6ff']} opacity={[0.95, 0]} active={spouting} />
        </group>
        {/* the body: a lag chain beating up and down, flukes at the end */}
        <Tail
          position={[0, 0.0, 0.1]}
          segs={5}
          length={0.95}
          r0={0.22}
          r1={0.05}
          sides={8}
          colors={[K.back]}
          axis="x"
          rate={0.35}
          amp={0.12}
          lag={0.55}
          kick={tap}
          kickAmp={0.1}
          tip={
            <group position-z={-0.18}>
              <mesh geometry={geo.fluke}>
                <Flat color={K.fin === K.belly ? K.back : K.fin} />
              </mesh>
            </group>
          }
        />
      </group>
    </group>
  )
}

export default function WhaleScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={false} camera={[3, 1.8, 3.6]} target={[0, 0.15, 0]} hint="It swims by beating its tail up and down, each link a beat behind the last, rides the swell and takes a small breath now and then · tap it and it blows a tall spout · Kind swaps blue, humpback, orca and beluga · drag to orbit">
      <Whale {...props} />
    </Stage>
  )
}

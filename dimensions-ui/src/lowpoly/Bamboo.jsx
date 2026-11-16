import { useMemo } from 'react'
import * as THREE from 'three'
import { Burst, Flat, Stage, Sway, TAU, blob, facet, rng, useGeo, useTap } from './kit.jsx'

// A low-poly bamboo grove: a clump of six segmented stalks rising from a
// mound of soil and stones, each stalk a stack of faceted joints with a
// raised ring at every node and thin blade leaves fanning out near the top.
// Left alone, the stalks sway in the breeze, each on its own beat, the tops
// moving more than the base. Tap it and the stalks knock together: a quick
// shake that runs up each stalk and dies away, and a few leaves tear loose
// and flutter down.

const LOOKS = {
  green: { stalk: ['#7db544', '#8cc34e', '#6ea53a'], node: '#5b8a2d', leaf: ['#5f9e35', '#79bb45', '#4c8a2c'], soil: '#7a5a3e', stone: ['#a8a59d', '#8f8c86'] },
  golden: { stalk: ['#e2b93e', '#edc954', '#d4a934'], node: '#8a9a3a', leaf: ['#7aa83c', '#93bf4a', '#668f30'], soil: '#82603f', stone: ['#b3aa98', '#978e7f'] },
  black: { stalk: ['#3a3336', '#463d40', '#2d2729'], node: '#1c1819', leaf: ['#4d7f3a', '#5f9447', '#3f6c30'], soil: '#5e4838', stone: ['#8f8d8a', '#76736f'] },
  jade: { stalk: ['#62c2a2', '#77cfb2', '#50ae90'], node: '#3a8e75', leaf: ['#4aae86', '#68c79c', '#3a9a74'], soil: '#6f5a46', stone: ['#b6c2bc', '#97a49e'] },
}

const SEG = 0.27 // length of one joint

// The clump: where each stalk stands, how tall, how thick and how it sways.
function makeStalks() {
  const r = rng(11)
  return Array.from({ length: 6 }, (_, k) => {
    const a = (k / 6) * TAU + (r() - 0.5) * 0.6
    const d = k === 0 ? 0.02 : 0.19 + r() * 0.12
    return {
      x: Math.cos(a) * d,
      z: Math.sin(a) * d,
      yaw: r() * TAU,
      lean: (r() - 0.5) * 0.14,
      n: 5 + Math.floor(r() * 2.6) + (k === 0 ? 1 : 0),
      rad: 0.038 + r() * 0.016,
      rate: 0.32 + r() * 0.22,
      off: k * 1.4,
      knock: k % 2 ? 1 : -1,
    }
  })
}

// A thin lance-shaped blade lying in the x/z plane, pointing along +x, with
// a slight fold down its middle.
function leafGeometry() {
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.lineTo(0.07, 0.032)
  s.lineTo(0.2, 0.022)
  s.lineTo(0.34, 0)
  s.lineTo(0.2, -0.022)
  s.lineTo(0.07, -0.032)
  s.closePath()
  const g = new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2)
  // fold: the midline rides a touch higher than the edges
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) p.setY(i, Math.abs(p.getZ(i)) < 0.001 ? 0.012 : 0)
  g.computeVertexNormals()
  return g
}

function Stalk({ s, L, geo, tap }) {
  const link = (i) => {
    if (i === s.n) return null
    const top = i >= s.n - 3
    const taper = 1 - (i / s.n) * 0.25
    return (
      <Sway i={s.off + i} rate={s.rate} amp={0.012 + i * 0.006} lag={0.45} kick={tap} kickAmp={s.knock * (0.02 + i * 0.006)} position-y={i === 0 ? 0 : SEG}>
        <mesh geometry={geo.seg} scale={[s.rad * taper, SEG, s.rad * taper]}>
          <Flat color={L.stalk[i % L.stalk.length]} roughness={0.55} />
        </mesh>
        <mesh geometry={geo.node} position-y={SEG} scale={[s.rad * taper * 1.22, 1, s.rad * taper * 1.22]}>
          <Flat color={L.node} roughness={0.6} />
        </mesh>
        {top &&
          [0, 1, 2].map((j) => (
            <group key={j} position-y={SEG * 0.98} rotation-y={j * 2.2 + i * 1.3 + s.yaw}>
              <mesh geometry={geo.leaf} position-x={s.rad} rotation-z={-0.35 - j * 0.15} scale={0.8 + ((i + j) % 3) * 0.14}>
                <Flat color={L.leaf[(i + j) % L.leaf.length]} side={THREE.DoubleSide} />
              </mesh>
            </group>
          ))}
        {i === s.n - 1 && (
          <mesh geometry={geo.tip} position-y={SEG} scale={[s.rad * 0.7, 0.07, s.rad * 0.7]}>
            <Flat color={L.stalk[0]} />
          </mesh>
        )}
        {link(i + 1)}
      </Sway>
    )
  }
  return (
    <group position={[s.x, 0.05, s.z]} rotation-y={s.yaw}>
      <group rotation-z={s.lean}>{link(0)}</group>
    </group>
  )
}

export function Bamboo({ look = 'green' }) {
  const L = LOOKS[look] || LOOKS.green
  const { tap, handlers } = useTap(1.5)
  const stalks = useMemo(makeStalks, [])
  const geo = useGeo(
    () => ({
      seg: facet(new THREE.CylinderGeometry(1, 1.04, 0.96, 7, 2).translate(0, 0.48, 0), 0.05, 3, [1, 0, 1]),
      node: new THREE.CylinderGeometry(1, 1, 0.028, 7),
      tip: new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0),
      leaf: leafGeometry(),
      mound: facet(new THREE.IcosahedronGeometry(1, 1).scale(0.6, 0.17, 0.56), 0.025, 7),
      stone: blob(1, 9, 0),
      hit: new THREE.CylinderGeometry(0.45, 0.45, 1.9, 8).translate(0, 0.95, 0),
    }),
    [],
  )
  const stones = [
    [0.52, 0.03, 0.12, 0.08, 0],
    [-0.42, 0.03, 0.36, 0.065, 1],
    [0.12, 0.03, -0.54, 0.075, 0],
    [-0.54, 0.02, -0.18, 0.05, 1],
    [0.34, 0.02, 0.46, 0.045, 1],
  ]

  return (
    <group {...handlers}>
      {/* the soil mound and a few stones round its foot */}
      <mesh geometry={geo.mound}>
        <Flat color={L.soil} />
      </mesh>
      {stones.map(([x, y, z, s, c], i) => (
        <mesh key={i} geometry={geo.stone} position={[x, y, z]} scale={[s, s * 0.7, s]} rotation-y={i}>
          <Flat color={L.stone[c]} />
        </mesh>
      ))}
      {stalks.map((s, k) => (
        <Stalk key={k} s={s} L={L} geo={geo} tap={tap} />
      ))}
      {/* an invisible sleeve round the clump, so a tap anywhere on it lands */}
      <mesh geometry={geo.hit}>
        <meshBasicMaterial visible={false} />
      </mesh>
      <Burst tap={tap} geometry={geo.leaf} count={7} colors={L.leaf} speed={0.9} gravity={1.1} size={0.9} life={1.9} origin={[0, 1.5, 0]} spread={1.1} up={0.5} seed={5} />
    </group>
  )
}

export default function BambooScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.4, 2.2, 4.6]} target={[0, 0.9, 0]} hint="The stalks sway in the breeze on their own, each out of step · tap the grove and the stalks knock together and a few leaves fall · Look swaps green, golden, black and jade · drag to orbit">
      <Bamboo {...props} />
    </Stage>
  )
}

import { useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { Flat, Stage, facet, rng, useGeo, useKick } from './kit.jsx'

// A low-poly ground tile, the kind a game map is built from: a block of soil
// in two layers under a thick, lumpy slab of turf, a few grey pebbles and
// tufts of grass. The blades sway on their own; tap it and the tile squashes
// down and springs back, and the pebbles hop.

const GRASS = {
  spring: ['#7cc24c', '#6aae3f', '#9ad85c'],
  summer: ['#5fa83a', '#4f9330', '#7fc24a'],
  autumn: ['#a7a63e', '#8e8d34', '#c7b95a'],
}
const S = 1.6 // tile size
const SOIL = 0.5
const TURF = 0.18
const TOP = SOIL + TURF

// [x, z, scale] for the pebbles and [x, z, blades, height] for the tufts
const PEBBLES = [
  [-0.38, 0.05, 1.1],
  [0.05, -0.32, 0.85],
  [0.38, 0.28, 0.7],
  [-0.12, 0.45, 0.6],
]
const TUFTS = [
  [-0.45, -0.42, 5, 0.42],
  [0.48, -0.1, 3, 0.28],
  [0.1, 0.25, 3, 0.22],
]

export function GrassTile({ grass = 'spring' }) {
  const G = GRASS[grass] || GRASS.spring
  const clock = useThree((s) => s.clock)
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const bump = useKick(3.2)
  const tile = useRef()
  const pebbles = useRef([])
  const tufts = useRef([])

  const geo = useGeo(
    () => {
      const r = rng(4)
      return {
        // the turf: lumpy on top, flat underneath
        turf: facet(new THREE.BoxGeometry(S, TURF, S, 4, 1, 4).translate(0, TURF / 2, 0), 0.035, 1, [0.4, 1, 0.4], (x, y) => y < 0.001),
        soilTop: facet(new THREE.BoxGeometry(S - 0.04, SOIL * 0.55, S - 0.04, 3, 1, 3), 0.02, 2, [1, 0.3, 1]),
        soilLow: facet(new THREE.BoxGeometry(S - 0.12, SOIL * 0.5, S - 0.12, 3, 1, 3), 0.025, 3, [1, 0.3, 1]),
        pebble: facet(new THREE.IcosahedronGeometry(0.1, 0), 0.015, 5),
        // a tuft: a fan of thin blades, each leaning out a little
        tufts: TUFTS.map(([, , n, h], k) => {
          const parts = []
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + r()
            const hh = h * (0.65 + r() * 0.45)
            const b = new THREE.ConeGeometry(0.045, hh, 4, 1).translate(0, hh / 2, 0)
            b.rotateZ(Math.cos(a) * 0.3).rotateX(Math.sin(a) * 0.3).translate(Math.cos(a) * 0.04, 0, Math.sin(a) * 0.04)
            parts.push(b.toNonIndexed())
          }
          return mergeSimple(parts, k)
        }),
      }
    },
    [],
  )

  useFrame(() => {
    const t = clock.elapsedTime
    const k = bump.value(t)
    const since = bump.since(t)
    // squash and stretch: down on the tap, then a springy settle
    const sq = k * Math.cos(since * 16)
    tile.current.scale.set(1 + sq * 0.08, 1 - sq * 0.16, 1 + sq * 0.08)
    pebbles.current.forEach((p, i) => {
      if (!p) return
      const hop = Math.max(0, Math.sin(Math.min(Math.PI, (since - 0.06 - i * 0.03) * 7))) * (since < 0.6 ? 0.14 + i * 0.03 : 0)
      p.position.y = TOP + 0.03 + hop
      p.rotation.y = i * 1.7 + hop * 6
    })
    tufts.current.forEach((g, i) => {
      if (!g) return
      g.rotation.z = Math.sin(t * 1.8 + i * 1.3) * 0.1 + Math.sin(since * 18) * k * 0.3
      g.rotation.x = Math.sin(t * 1.3 + i) * 0.07
    })
  })

  return (
    <group
      ref={tile}
      onClick={(e) => {
        e.stopPropagation()
        bump.kick(clock.elapsedTime)
      }}
      onPointerOver={(e) => (e.stopPropagation(), setHover(true))}
      onPointerOut={() => setHover(false)}
    >
      <mesh geometry={geo.soilLow} position-y={SOIL * 0.25}>
        <Flat color="#6b3f25" />
      </mesh>
      <mesh geometry={geo.soilTop} position-y={SOIL * 0.72}>
        <Flat color="#86532f" />
      </mesh>
      <mesh geometry={geo.turf} position-y={SOIL}>
        <Flat color={G[0]} />
      </mesh>
      {PEBBLES.map(([x, z, s], i) => (
        <mesh key={i} ref={(m) => (pebbles.current[i] = m)} geometry={geo.pebble} position={[x, TOP + 0.03, z]} scale={[s, s * 0.55, s]}>
          <Flat color={i % 2 ? '#8d8c96' : '#a3a2ab'} />
        </mesh>
      ))}
      {TUFTS.map(([x, z], i) => (
        <group key={i} ref={(g) => (tufts.current[i] = g)} position={[x, TOP - 0.02, z]}>
          <mesh geometry={geo.tufts[i]}>
            <Flat color={G[i % 2 ? 1 : 2]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// join non-indexed position-only geometries into one
function mergeSimple(parts) {
  const n = parts.reduce((a, p) => a + p.attributes.position.count, 0)
  const pos = new Float32Array(n * 3)
  let o = 0
  parts.forEach((p) => {
    pos.set(p.attributes.position.array, o)
    o += p.attributes.position.array.length
    p.dispose()
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return g
}

export default function GrassTileScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} target={[0, 0.4, 0]} camera={[3.2, 2.7, 4.2]} hint="The grass sways on its own · tap the tile and it squashes and springs back, and the pebbles hop · Grass changes the season of the turf · drag to orbit">
      <GrassTile {...props} />
    </Stage>
  )
}

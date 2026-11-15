import * as THREE from 'three'
import { Burst, Flat, Stage, Sway, blob, facet, useGeo, useTap } from './kit.jsx'

// A low-poly bonsai in a shallow glazed tray on little feet: an S-curved
// trunk of three tapering links, two side branches and four cloud-pruned
// canopy pads, with moss and a pebble on the soil. The trunk and pads sway a
// beat apart. Tap it and the canopy shivers and petals or leaves fall.

const KINDS = {
  pine: { pad: ['#3f7f4a', '#4f9a52'], fall: ['#4f9a52', '#6aae5a'] },
  maple: { pad: ['#c8382f', '#e2553a'], fall: ['#e2553a', '#f08a3a'] },
  blossom: { pad: ['#f2a6c4', '#f8c7d8'], fall: ['#f8c7d8', '#ffffff'] },
  autumn: { pad: ['#e08a2a', '#f2b23a'], fall: ['#f2b23a', '#c9631f'] },
}
const BARK = '#6e4a34'
const BARK2 = '#5c3c2a'
const TRAY = '#2f5d7a'
const link = (rb, rt, h, seed) => facet(new THREE.CylinderGeometry(rt, rb, h, 6, 1).translate(0, h / 2, 0), 0.008, seed)

function Pad({ geo, colors, position, scale = 1, i, tap }) {
  return (
    <group position={position} scale={scale}>
      <Sway i={i} rate={0.4} amp={0.05} lag={0.9} axis="x" kick={tap} kickAmp={0.18}>
        <mesh geometry={geo.pad} scale={[1.5, 0.55, 1.15]}>
          <Flat color={colors[0]} />
        </mesh>
        <mesh geometry={geo.pad} position={[0.16, 0.06, 0.05]} scale={[0.9, 0.45, 0.8]}>
          <Flat color={colors[1]} />
        </mesh>
        <mesh geometry={geo.pad} position={[-0.15, 0.05, -0.04]} scale={[0.85, 0.45, 0.8]}>
          <Flat color={colors[1]} />
        </mesh>
      </Sway>
    </group>
  )
}

export function Bonsai({ kind = 'pine' }) {
  const K = KINDS[kind] || KINDS.pine
  const { tap, handlers } = useTap(1.2)

  const geo = useGeo(
    () => ({
      tray: facet(new THREE.BoxGeometry(1.1, 0.16, 0.7), 0.008, 1),
      lip: new THREE.BoxGeometry(1.18, 0.04, 0.78),
      foot: new THREE.BoxGeometry(0.12, 0.06, 0.12),
      soil: new THREE.BoxGeometry(1.02, 0.02, 0.62),
      pad: blob(0.2, 2),
      moss: blob(0.1, 3),
      pebble: blob(0.07, 4, 0),
      petal: facet(new THREE.IcosahedronGeometry(1, 0), 0.05, 5).scale(1, 0.25, 1.4),
    }),
    [],
  )
  const L = useGeo(
    () => ({
      a: link(0.1, 0.075, 0.38, 11),
      b: link(0.075, 0.055, 0.32, 12),
      c: link(0.055, 0.04, 0.26, 13),
      br1: link(0.045, 0.025, 0.36, 14),
      br2: link(0.04, 0.022, 0.3, 15),
    }),
    [],
  )

  return (
    <group {...handlers}>
      {/* tray on feet */}
      {[
        [-0.45, -0.25],
        [0.45, -0.25],
        [-0.45, 0.25],
        [0.45, 0.25],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} geometry={geo.foot} position={[x, 0.03, z]}>
          <Flat color="#23485f" />
        </mesh>
      ))}
      <mesh geometry={geo.tray} position-y={0.14}>
        <Flat color={TRAY} roughness={0.45} />
      </mesh>
      <mesh geometry={geo.lip} position-y={0.22}>
        <Flat color="#3b7092" roughness={0.45} />
      </mesh>
      <mesh geometry={geo.soil} position-y={0.24}>
        <Flat color="#4a3424" />
      </mesh>
      <mesh geometry={geo.moss} position={[0.28, 0.25, 0.12]} scale={[1.6, 0.4, 1.2]}>
        <Flat color="#6c9a3a" />
      </mesh>
      <mesh geometry={geo.moss} position={[-0.32, 0.25, -0.1]} scale={[1.3, 0.35, 1]}>
        <Flat color="#7fb04a" />
      </mesh>
      <mesh geometry={geo.pebble} position={[0.4, 0.27, -0.16]} scale={[1.3, 0.7, 1]}>
        <Flat color="#b5aea4" />
      </mesh>

      {/* the trunk: three links in an S, each swaying a beat behind */}
      <group position={[-0.08, 0.24, 0]} rotation-z={-0.35}>
        <Sway i={0} rate={0.3} amp={0.02} kick={tap} kickAmp={0.03}>
          <mesh geometry={L.a}>
            <Flat color={BARK} />
          </mesh>
          {/* a branch out to the left */}
          <group position-y={0.3} rotation={[0.2, 0, 1.25]}>
            <mesh geometry={L.br1}>
              <Flat color={BARK2} />
            </mesh>
            <Pad geo={geo} colors={K.pad} position={[0, 0.38, 0]} scale={0.85} i={1} tap={tap} />
          </group>
          <group position-y={0.38} rotation-z={0.75}>
            <Sway i={1} rate={0.3} amp={0.025} kick={tap} kickAmp={0.04}>
              <mesh geometry={L.b}>
                <Flat color={BARK2} />
              </mesh>
              {/* a branch out to the right */}
              <group position-y={0.26} rotation={[-0.3, 0, -1.35]}>
                <mesh geometry={L.br2}>
                  <Flat color={BARK} />
                </mesh>
                <Pad geo={geo} colors={K.pad} position={[0, 0.32, 0]} scale={0.75} i={2} tap={tap} />
              </group>
              <group position-y={0.32} rotation-z={-0.55}>
                <Sway i={2} rate={0.3} amp={0.03} kick={tap} kickAmp={0.05}>
                  <mesh geometry={L.c}>
                    <Flat color={BARK} />
                  </mesh>
                  <Pad geo={geo} colors={K.pad} position={[0, 0.3, 0]} scale={1.05} i={3} tap={tap} />
                  <Pad geo={geo} colors={K.pad} position={[0.12, 0.12, 0.2]} scale={0.55} i={4} tap={tap} />
                </Sway>
              </group>
            </Sway>
          </group>
        </Sway>
      </group>

      <Burst tap={tap} geometry={geo.petal} count={14} colors={K.fall} speed={0.9} gravity={0.9} size={0.035} life={2.6} origin={[0, 1.05, 0]} spread={1.6} up={0.6} />
    </group>
  )
}

export default function BonsaiScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3, 2.2, 4]} target={[0, 0.6, 0]} hint="The trunk and canopy sway a beat apart on their own · tap it and the canopy shivers and drops petals or leaves · Kind swaps pine, maple, blossom and autumn · drag to orbit">
      <Bonsai {...props} />
    </Stage>
  )
}

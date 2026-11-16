import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Particles, Stage, Sway, TAU, Tail, blob, cone, facet, followPath, rng, terrainGeo, useGeo, useTap } from './kit.jsx'

// A little low-poly coral reef on a sandy mound: branching staghorn corals
// built from stacked tapering limbs, a flat faceted sea fan, a pair of
// bumpy brain-coral domes, a cluster of tube corals and an anemone with a
// crown of soft fronds, with bubbles drifting up from the rocks. Left
// alone, the anemone's fronds sway in the current, each a beat behind the
// next, the fan rocks gently and bubbles rise. Tap it and a small shoal of
// fish darts out from the coral, swims a quick loop round the reef and
// darts back into hiding.

const LOOKS = {
  tropical: { sand: ['#f3dca6', '#e9cc8e', '#f8e7bf'], branch: ['#ff7a6b', '#ff9466'], tip: '#ffd0b5', branch2: ['#ffb43a', '#ffc95a'], fan: '#a65de2', brain: ['#f5c94a', '#9bd36a'], tube: '#36c4bd', tubeIn: '#1f7f84', anemone: ['#ff8fc0', '#ffaad0'], anTip: '#fff2a8', anBase: '#d4588f', rock: ['#a59a8c', '#8e8478'], fish: [['#ffa62b', '#ffffff'], ['#3fb6ff', '#ffe14d'], ['#ff5d73', '#ffd0d8'], ['#ffe14d', '#3f7fe0']] },
  pastel: { sand: ['#f7e9d3', '#efdcc2', '#fbf2e4'], branch: ['#f6b6c8', '#f9c8d6'], tip: '#ffffff', branch2: ['#b9d8f5', '#cbe3f8'], fan: '#c8b2ef', brain: ['#fbe3a2', '#bfe8c8'], tube: '#a9e4dc', tubeIn: '#77bdb4', anemone: ['#f7c6e0', '#fbd9ea'], anTip: '#ffffff', anBase: '#e2a2c4', rock: ['#c9c1b8', '#b5aca2'], fish: [['#ffc79a', '#ffffff'], ['#a9d8ff', '#ffffff'], ['#f9b3c6', '#ffffff'], ['#d9c8ff', '#ffffff']] },
  deep: { sand: ['#5a6a8a', '#4c5a78', '#6a7a98'], branch: ['#3fd1c8', '#5ae0d6'], tip: '#c8fff8', branch2: ['#7a6cf0', '#9284ff'], fan: '#e2508c', brain: ['#4f8fe0', '#58c08a'], tube: '#f0d050', tubeIn: '#8a6a20', anemone: ['#b878ff', '#cc96ff'], anTip: '#7dffe8', anBase: '#6a3fb0', rock: ['#3f4660', '#343a52'], fish: [['#7dffe8', '#ffffff'], ['#ffd54a', '#2a2f4a'], ['#ff7ab0', '#ffffff'], ['#9ab8ff', '#ffffff']] },
  sunset: { sand: ['#f2c08f', '#e8ab78', '#f7d2a8'], branch: ['#e8543e', '#f06a46'], tip: '#ffd08a', branch2: ['#ff9a3c', '#ffb257'], fan: '#c2367a', brain: ['#f7b733', '#e8735a'], tube: '#7a4fb8', tubeIn: '#46287a', anemone: ['#ff6f91', '#ff8fa6'], anTip: '#ffe08a', anBase: '#b8355e', rock: ['#9a7a6e', '#866760'], fish: [['#ffe14d', '#ff7a3c'], ['#ffffff', '#e8543e'], ['#ffb257', '#ffffff'], ['#ff6f91', '#ffe08a']] },
}

const MOUND_R = 1.0
const MOUND_H = 0.22
const groundAt = (x, z) => MOUND_H * Math.max(0, 1 - (x * x + z * z) / (MOUND_R * MOUND_R))
const SWIM = 2.8 // seconds the shoal is out

// A branching coral as a little tree of tapering limbs.
function makeTree(r, depth, len, rad) {
  const kids = depth > 0 ? Array.from({ length: depth > 1 ? 3 : 2 }, (_, i) => ({ ry: (i / (depth > 1 ? 3 : 2)) * TAU + r() * 1.2, rz: 0.35 + r() * 0.35, node: makeTree(r, depth - 1, len * (0.72 + r() * 0.12), rad * 0.72) })) : []
  return { len, rad, kids }
}

function Branch({ n, geo, colors, tip, d = 0 }) {
  return (
    <>
      <mesh geometry={geo.limb} scale={[n.rad, n.len, n.rad]}>
        <Flat color={colors[d % colors.length]} />
      </mesh>
      <group position-y={n.len * 0.94}>
        {n.kids.length ? (
          n.kids.map((k, i) => (
            <group key={i} rotation-y={k.ry}>
              <group rotation-z={k.rz}>
                <Branch n={k.node} geo={geo} colors={colors} tip={tip} d={d + 1} />
              </group>
            </group>
          ))
        ) : (
          <mesh geometry={geo.tip} scale={n.rad * 1.25}>
            <Flat color={tip} />
          </mesh>
        )}
      </group>
    </>
  )
}

// A loop out of the coral and back: a circle that passes through home.
const _v = new THREE.Vector3()
function fishAt(f, s) {
  const u = s / SWIM
  const th = TAU * u
  return _v.set(f.home[0] + f.R * (Math.cos(f.a0 + f.dir * th) - Math.cos(f.a0)), f.home[1] + 0.22 * Math.sin(Math.PI * Math.min(1, Math.max(0, u))) + 0.05 * Math.sin(th * 2), f.home[2] + f.R * (Math.sin(f.a0 + f.dir * th) - Math.sin(f.a0))).clone()
}

export function CoralReef({ look = 'tropical' }) {
  const L = LOOKS[look] || LOOKS.tropical
  const { tap, handlers, clock } = useTap(1)
  const fishRefs = useRef([])

  const geo = useGeo(
    () => ({
      mound: terrainGeo({ radius: MOUND_R, height: MOUND_H, seed: 4, rings: 5, segs: 14, rough: 0.2, profile: 'dome', bands: [[0, L.sand[0]], [0.35, L.sand[1]], [0.75, L.sand[2]]] }),
      limb: facet(new THREE.CylinderGeometry(0.72, 1, 1, 5, 1).translate(0, 0.5, 0), 0.06, 2),
      tip: blob(1, 3, 0),
      fan: facet(new THREE.RingGeometry(0.03, 0.36, 9, 3, 0, Math.PI), 0.025, 5, [0.6, 0.6, 1]),
      rib: new THREE.BoxGeometry(0.012, 0.34, 0.018).translate(0, 0.17, 0),
      stem: cone(0.025, 0.1, 5, 6),
      brain: facet(new THREE.IcosahedronGeometry(1, 2), 0.07, 8),
      tube: facet(new THREE.CylinderGeometry(1, 0.85, 1, 7, 1, true).translate(0, 0.5, 0), 0.04, 9),
      tubeIn: new THREE.CircleGeometry(0.9, 7).rotateX(-Math.PI / 2),
      anBase: facet(new THREE.CylinderGeometry(0.11, 0.14, 0.14, 8, 1).translate(0, 0.07, 0), 0.008, 11),
      anTip: blob(0.022, 12, 0),
      rock: blob(1, 13, 1),
      body: facet(new THREE.IcosahedronGeometry(0.045, 1), 0.004, 14).scale(0.55, 0.95, 1.6),
      stripe: new THREE.TorusGeometry(0.038, 0.008, 3, 8).scale(0.6, 1.1, 1),
      tail: (() => {
        const s = new THREE.Shape()
        s.moveTo(0, 0)
        s.lineTo(0.045, -0.06)
        s.lineTo(0, -0.04)
        s.lineTo(-0.045, -0.06)
        s.closePath()
        return new THREE.ShapeGeometry(s).rotateX(Math.PI / 2).rotateZ(Math.PI / 2)
      })(),
      eye: new THREE.IcosahedronGeometry(0.009, 0),
      hit: new THREE.CylinderGeometry(0.95, 0.95, 0.95, 10).translate(0, 0.47, 0),
    }),
    [look],
  )

  const trees = useMemo(() => {
    const r = rng(21)
    return [
      { pos: [-0.32, -0.18], n: makeTree(r, 3, 0.2, 0.05), colors: L.branch, yaw: 0.3 },
      { pos: [0.42, -0.36], n: makeTree(r, 2, 0.17, 0.042), colors: L.branch2, yaw: 1.1 },
      { pos: [0.08, 0.52], n: makeTree(r, 2, 0.13, 0.035), colors: L.branch, yaw: 2.2 },
    ]
  }, [L])

  // where each fish hides, and the loop it swims
  const shoal = useMemo(
    () => [
      { home: [-0.3, 0.42, -0.15], a0: 0.6, dir: 1, R: 0.42, delay: 0 },
      { home: [0.4, 0.38, -0.3], a0: 2.2, dir: -1, R: 0.38, delay: 0.12 },
      { home: [0.25, 0.3, 0.2], a0: 4.0, dir: 1, R: 0.34, delay: 0.22 },
      { home: [-0.42, 0.32, 0.3], a0: 5.3, dir: -1, R: 0.36, delay: 0.08 },
    ],
    [],
  )

  const fronds = useMemo(() => Array.from({ length: 14 }, (_, i) => ({ a: (i / 14) * TAU, tilt: 0.25 + (i % 3) * 0.18, len: 0.24 + (i % 4) * 0.03 })), [])

  useFrame(() => {
    const t = clock.elapsedTime
    shoal.forEach((f, i) => {
      const m = fishRefs.current[i]
      if (!m) return
      const s = tap.since(t) - f.delay
      m.visible = s > 0 && s < SWIM
      if (!m.visible) return
      followPath(m, (x) => fishAt(f, x), s, 0.8, 0.03)
      m.scale.setScalar(Math.max(0.001, Math.min(1, s * 7, (SWIM - s) * 7)))
    })
  })

  const anX = -0.44
  const anZ = 0.3
  const anY = groundAt(anX, anZ) - 0.02

  return (
    <group {...handlers}>
      <mesh geometry={geo.mound}>
        <Flat vertexColors color="#ffffff" />
      </mesh>
      {[
        [0.62, 0.15, 0.4, 0.12],
        [-0.65, -0.3, 0.6, 0.1],
        [0.0, -0.55, 1.4, 0.09],
        [0.66, 0.0, 2.0, 0.07],
      ].map(([x, z, ry, s], i) => (
        <mesh key={i} geometry={geo.rock} position={[x, groundAt(x, z) + s * 0.25, z]} rotation-y={ry} scale={[s * 1.3, s * 0.8, s]}>
          <Flat color={L.rock[i % 2]} />
        </mesh>
      ))}

      {/* branching corals */}
      {trees.map((c, i) => (
        <group key={i} position={[c.pos[0], groundAt(c.pos[0], c.pos[1]) - 0.02, c.pos[1]]} rotation-y={c.yaw}>
          <Branch n={c.n} geo={geo} colors={c.colors} tip={L.tip} />
        </group>
      ))}

      {/* a sea fan rocking in the current */}
      <group position={[0.02, groundAt(0.02, -0.5) - 0.02, -0.5]} rotation-y={0.25}>
        <mesh geometry={geo.stem}>
          <Flat color={L.fan} />
        </mesh>
        <Sway rate={0.35} amp={0.1} axis="x" position-y={0.08}>
          <mesh geometry={geo.fan}>
            <Flat color={L.fan} side={THREE.DoubleSide} />
          </mesh>
          {[-1.1, -0.55, 0, 0.55, 1.1].map((a) => (
            <mesh key={a} geometry={geo.rib} rotation-z={a}>
              <Flat color={L.tip} />
            </mesh>
          ))}
        </Sway>
      </group>

      {/* brain corals */}
      {[
        [0.3, 0.18, 0.17, 0],
        [-0.05, -0.12, 0.12, 1],
      ].map(([x, z, s, c], i) => (
        <mesh key={i} geometry={geo.brain} position={[x, groundAt(x, z) + s * 0.25, z]} scale={[s, s * 0.7, s]} rotation-y={i * 2}>
          <Flat color={L.brain[c]} />
        </mesh>
      ))}

      {/* tube corals */}
      <group position={[0.58, groundAt(0.58, -0.05) - 0.03, -0.05]}>
        {[
          [0, 0, 0.05, 0.26, 0],
          [0.07, 0.04, 0.04, 0.2, 0.15],
          [-0.05, 0.06, 0.035, 0.16, -0.2],
          [0.02, -0.07, 0.038, 0.18, 0.1],
        ].map(([x, z, r, h, lean], i) => (
          <group key={i} position={[x, 0, z]} rotation={[lean, 0, -lean]}>
            <mesh geometry={geo.tube} scale={[r, h, r]}>
              <Flat color={L.tube} side={THREE.DoubleSide} />
            </mesh>
            <mesh geometry={geo.tubeIn} position-y={h * 0.85} scale={r}>
              <Flat color={L.tubeIn} />
            </mesh>
          </group>
        ))}
      </group>

      {/* the anemone and its swaying fronds */}
      <group position={[anX, anY, anZ]}>
        <mesh geometry={geo.anBase}>
          <Flat color={L.anBase} />
        </mesh>
        {fronds.map((f, i) => (
          <group key={i} position={[-Math.sin(f.a) * 0.07, 0.13, -Math.cos(f.a) * 0.07]} rotation-y={f.a}>
            <group rotation-x={Math.PI / 2 - f.tilt}>
              <Tail segs={4} length={f.len} r0={0.02} r1={0.009} sides={5} colors={L.anemone} rate={0.45} amp={0.32} lag={0.8} axis="y" curl={-0.9} kick={tap} kickAmp={0.25} tip={<mesh geometry={geo.anTip} position-z={-f.len / 4}><Flat color={L.anTip} emissive={L.anTip} emissiveIntensity={0.25} /></mesh>} />
            </group>
          </group>
        ))}
      </group>

      {/* bubbles rising from the reef */}
      <Particles count={8} life={3.2} origin={[0.3, 0.3, 0.17]} spread={0.04} velocity={[0, 0.32, 0]} scatter={0.03} drift={0.05} size={[0.018, 0.03]} colors={['#ffffff', '#dff3ff']} opacity={[0.85, 0]} seed={2} />
      <Particles count={6} life={3.6} origin={[-0.36, 0.4, -0.2]} spread={0.03} velocity={[0, 0.28, 0]} scatter={0.03} drift={0.05} size={[0.014, 0.026]} colors={['#ffffff', '#dff3ff']} opacity={[0.8, 0]} seed={7} />

      {/* the shoal that darts out on a tap */}
      {shoal.map((f, i) => {
        const [c, c2] = L.fish[i % L.fish.length]
        return (
          <group key={i} ref={(el) => (fishRefs.current[i] = el)} visible={false}>
            <Sway rate={2.6} amp={0.18} axis="y">
              <mesh geometry={geo.body}>
                <Flat color={c} />
              </mesh>
              <mesh geometry={geo.stripe} position-z={0.012}>
                <Flat color={c2} />
              </mesh>
              {[-1, 1].map((x) => (
                <mesh key={x} geometry={geo.eye} position={[x * 0.022, 0.012, 0.045]}>
                  <Flat color="#1b1a22" />
                </mesh>
              ))}
              <group position-z={-0.065}>
                <Sway rate={4} amp={0.5} axis="y" i={1} lag={1}>
                  <mesh geometry={geo.tail}>
                    <Flat color={c2} side={THREE.DoubleSide} />
                  </mesh>
                </Sway>
              </group>
            </Sway>
          </group>
        )
      })}

      {/* an invisible dome over the reef, so a tap anywhere on it lands */}
      <mesh geometry={geo.hit}>
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}

export default function CoralReefScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.7, 1.9, 3.6]} target={[0, 0.4, 0]} hint="The anemone's fronds sway in the current and bubbles rise on their own · tap the reef and a few little fish dart out, swim a loop and dart back in · Look swaps tropical, pastel, deep and sunset · drag to orbit">
      <CoralReef {...props} />
    </Stage>
  )
}

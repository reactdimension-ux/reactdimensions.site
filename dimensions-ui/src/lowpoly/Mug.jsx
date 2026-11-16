import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Particles, Stage, TAU, facet, ribbonGeo, useGeo, useTap } from './kit.jsx'

// A low-poly coffee mug on a saucer: a chunky faceted body with a thick
// rolled rim and a hollow, a C-shaped handle, and dark coffee inside with a
// lighter ring of crema and a faint swirl. Steam curls up from it in soft,
// fading wisps. Tap it and a spoon dips in and stirs two circles, the swirl
// spinning round with it and the steam puffing up stronger, then the spoon
// lifts out again.

const LOOKS = {
  white: { glaze: '#f4f1ea', inner: '#e6e1d6', saucer: '#ece8df' },
  teal: { glaze: '#2f9e9a', inner: '#f0ece2', saucer: '#e8e4da' },
  terracotta: { glaze: '#c8643f', inner: '#f0e6d8', saucer: '#e6dccd' },
  black: { glaze: '#2c2a30', inner: '#3a383f', saucer: '#e8e4da' },
}
const BASE = 0.07 // the mug stands on the saucer
const COFFEE = 0.93 // coffee level, mug local
const IN_R = 0.431 // inner radius at the coffee level
// outer wall up and over the rim, then down the inside to the floor
const BODY = [
  [0.001, 0],
  [0.43, 0],
  [0.49, 0.05],
  [0.51, 0.92],
  [0.52, 0.99],
  [0.49, 1.035],
  [0.45, 1.02],
  [0.435, 0.97],
  [0.42, 0.14],
  [0.001, 0.14],
]
const STIR = 2.6 // seconds the spoon is in

// where the spoon is s seconds after a tap: [height lift, stir angle], or
// null when it is out of the mug
function spoonAt(s) {
  if (s < 0 || s > STIR + 0.5) return null
  const a = s < 0.4 ? 0 : s < STIR ? ((s - 0.4) / (STIR - 0.4)) * 2 * TAU : 2 * TAU
  const lift = s < 0.4 ? 1 - s / 0.4 : s < STIR ? 0 : (s - STIR) / 0.5
  return [lift * lift * (3 - 2 * lift), a]
}

export function Mug({ look = 'white' }) {
  const L = LOOKS[look] || LOOKS.white
  const { tap, handlers, clock } = useTap(1)
  const swirl = useRef()
  const spoon = useRef()
  const spin = useRef(0)

  const geo = useGeo(
    () => ({
      body: facet(new THREE.LatheGeometry(BODY.map(([r, y]) => new THREE.Vector2(r, y)), 14), 0.008, 2),
      handle: facet(new THREE.TorusGeometry(0.24, 0.065, 6, 10, Math.PI * 1.15).rotateZ(-Math.PI * 0.575), 0.006, 3),
      saucer: facet(new THREE.LatheGeometry([[0.001, 0], [0.5, 0], [0.74, 0.06], [0.78, 0.085], [0.72, 0.085], [0.5, 0.045], [0.001, 0.045]].map(([r, y]) => new THREE.Vector2(r, y)), 16), 0.006, 4),
      coffee: new THREE.CircleGeometry(IN_R, 14).rotateX(-Math.PI / 2),
      crema: new THREE.RingGeometry(0.3, IN_R, 14, 1).rotateX(-Math.PI / 2),
      swirl: ribbonGeo((u) => new THREE.Vector3(Math.cos(u * 2.5 * TAU) * (0.03 + u * 0.27), 0, Math.sin(u * 2.5 * TAU) * (0.03 + u * 0.27)), 0.035, 60),
      spoonBowl: facet(new THREE.SphereGeometry(0.07, 8, 4).scale(1, 0.35, 1.4), 0.004, 5),
      spoonHandle: new THREE.BoxGeometry(0.05, 0.8, 0.022).translate(0, 0.4, 0),
      puff: new THREE.IcosahedronGeometry(1, 0),
    }),
    [],
  )
  const strong = () => (tap.since(clock.elapsedTime) < STIR + 0.6 ? 1 : 0)

  useFrame((_, dt) => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const sp = spoonAt(s)
    // the swirl drifts slowly, and races round while the spoon stirs
    spin.current += Math.min(dt, 0.05) * (0.25 + (sp && sp[0] < 0.5 ? 5.5 : 0))
    swirl.current.rotation.y = -spin.current
    const stirring = s >= 0 && s < STIR + 0.8
    swirl.current.material.opacity = 0.45 + (stirring ? 0.45 * Math.min(1, s * 3, (STIR + 0.8 - s) * 2) : 0)
    spoon.current.visible = !!sp
    if (sp) {
      const [lift, a] = sp
      spoon.current.position.set(Math.cos(-a) * 0.17, COFFEE - 0.04 + lift * 0.75, Math.sin(-a) * 0.17)
      spoon.current.rotation.set(0, a, 0.45)
    }
  })

  return (
    <group {...handlers}>
      <mesh geometry={geo.saucer}>
        <Flat color={L.saucer} roughness={0.5} side={THREE.DoubleSide} />
      </mesh>
      <group position-y={BASE}>
        <mesh geometry={geo.body}>
          <Flat color={L.glaze} roughness={0.45} side={THREE.DoubleSide} />
        </mesh>
        <mesh geometry={geo.handle} position={[0.5, 0.52, 0]}>
          <Flat color={L.glaze} roughness={0.45} />
        </mesh>
        <mesh geometry={geo.coffee} position-y={COFFEE}>
          <Flat color="#3a2216" roughness={0.3} />
        </mesh>
        <mesh geometry={geo.crema} position-y={COFFEE + 0.003}>
          <Flat color="#a8714a" roughness={0.4} />
        </mesh>
        <mesh ref={swirl} geometry={geo.swirl} position-y={COFFEE + 0.006}>
          <meshStandardMaterial color="#d9a77a" flatShading roughness={0.4} transparent side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <group ref={spoon} visible={false}>
          <group rotation-z={0}>
            <mesh geometry={geo.spoonBowl}>
              <Flat color="#c9ccd4" roughness={0.25} metalness={0.6} />
            </mesh>
            <mesh geometry={geo.spoonHandle}>
              <Flat color="#c9ccd4" roughness={0.25} metalness={0.6} />
            </mesh>
          </group>
        </group>
        <Particles geometry={geo.puff} count={14} life={2.8} origin={[0, COFFEE + 0.12, 0]} spread={0.18} velocity={[0, 0.3, 0]} scatter={0.04} drift={0.2} size={[0.04, 0.16]} colors={['#ffffff', '#eceef2']} opacity={[0.6, 0]} seed={3} />
        <Particles geometry={geo.puff} count={14} life={1.6} origin={[0, COFFEE + 0.12, 0]} spread={0.2} velocity={[0, 0.7, 0]} scatter={0.12} drift={0.25} size={[0.06, 0.2]} colors={['#ffffff', '#f2f3f6']} opacity={[0.75, 0]} active={strong} seed={8} />
      </group>
    </group>
  )
}

export default function MugScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.8, 3.1, 4.0]} target={[0, 0.7, 0]} hint="Steam curls up from the coffee on its own · tap it and a spoon dips in and stirs, the swirl spins and the steam puffs up, then the spoon lifts out · Look swaps white, teal, terracotta and black · drag to orbit">
      <Mug {...props} />
    </Stage>
  )
}

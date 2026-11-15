import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Face, Flat, Stage, Sway, TAU, blob, cone, facet, rng, squash, useGeo, useTap, wobble } from './kit.jsx'

// A low-poly snowman on a drift of snow: three faceted snowballs, coal eyes,
// smile and buttons, a carrot nose, stick arms with twig fingers, a top hat
// with a band and a knitted scarf whose two tails flutter as a lag chain.
// Snow falls round him. Tap him and he wobbles on his base, head last.

const SCARVES = {
  red: ['#d8383f', '#f0f0f0'],
  blue: ['#2f6fd0', '#f0f0f0'],
  green: ['#2f9a5a', '#f6e27a'],
  purple: ['#8350c8', '#f2b0d0'],
}
const SNOW = '#f7f9fc'
const SNOW2 = '#e6edf6'
const COAL = '#22222a'
const STICK = '#6e4a34'
const FLAKES = 26

function Tail({ geo, colors, side }) {
  // three knitted links, each swaying a beat behind the one above
  const link = (i) => (
    <group position-y={i === 0 ? 0 : -0.1}>
      <Sway i={i} rate={0.9} amp={0.12} lag={0.7} axis="x">
        <mesh geometry={geo.knit} position-y={-0.05}>
          <Flat color={colors[i % 2]} />
        </mesh>
        {i < 2 && link(i + 1)}
      </Sway>
    </group>
  )
  return (
    <group position={[side * 0.1, 0, 0.17]} rotation-z={side * 0.15}>
      {link(0)}
    </group>
  )
}

export function Snowman({ scarf = 'red', snow = true }) {
  const C = SCARVES[scarf] || SCARVES.red
  const { tap, handlers, clock } = useTap(2)
  const body = useRef()
  const head = useRef()
  const flakes = useRef([])

  const geo = useGeo(
    () => ({
      drift: facet(new THREE.SphereGeometry(0.9, 10, 4, 0, TAU, 0, Math.PI / 2), 0.04, 1, [1, 0.5, 1], (x, y) => y < 0.001),
      b1: blob(0.42, 2),
      b2: blob(0.3, 3),
      b3: blob(0.22, 4),
      coal: new THREE.IcosahedronGeometry(0.03, 0),
      nose: cone(0.035, 0.22, 5, 5).rotateX(Math.PI / 2),
      stick: facet(new THREE.CylinderGeometry(0.014, 0.022, 0.5, 4, 1).translate(0, 0.25, 0), 0.004, 6),
      twig: new THREE.CylinderGeometry(0.008, 0.012, 0.12, 4, 1).translate(0, 0.06, 0),
      hat: facet(new THREE.CylinderGeometry(0.13, 0.14, 0.22, 8, 1).translate(0, 0.11, 0), 0.004, 7),
      brim: new THREE.CylinderGeometry(0.22, 0.22, 0.025, 10, 1),
      band: new THREE.CylinderGeometry(0.142, 0.142, 0.05, 8, 1),
      wrap: new THREE.TorusGeometry(0.2, 0.06, 4, 10).rotateX(Math.PI / 2),
      knit: new THREE.BoxGeometry(0.1, 0.11, 0.035),
      flake: new THREE.OctahedronGeometry(0.022, 0),
    }),
    [],
  )
  const fall = useMemo(() => {
    const r = rng(5)
    return Array.from({ length: FLAKES }, () => [(r() - 0.5) * 2.4, r(), (r() - 0.5) * 2.4, 0.2 + r() * 0.25, r() * TAU])
  }, [])

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const w = wobble(s, 12, 2.6)
    body.current.rotation.z = w * 0.16
    body.current.rotation.x = wobble(s - 0.04, 10, 2.6) * 0.07
    squash(body.current, w * 0.06)
    head.current.rotation.z = wobble(s - 0.12, 12, 2.4) * 0.22 + Math.sin(t * 0.7) * 0.05
    head.current.rotation.y = Math.sin(t * 0.45) * 0.25
    flakes.current.forEach((f, i) => {
      if (!f) return
      f.visible = snow
      const [x, off, z, v, ph] = fall[i]
      const y = 2.6 - ((t * v + off) % 1) * 2.6
      f.position.set(x + Math.sin(t * 0.8 + ph) * 0.1, y, z)
      f.rotation.set(t + ph, t * 0.7, 0)
    })
  })

  return (
    <group {...handlers}>
      <mesh geometry={geo.drift} scale={[1, 0.22, 0.9]}>
        <Flat color={SNOW2} />
      </mesh>

      <group ref={body} position-y={0.12}>
        <mesh geometry={geo.b1} position-y={0.3}>
          <Flat color={SNOW} />
        </mesh>
        <mesh geometry={geo.b2} position-y={0.84}>
          <Flat color={SNOW} />
        </mesh>
        {[0.95, 0.83, 0.71].map((y, i) => (
          <mesh key={y} geometry={geo.coal} position={[0, y, 0.28 - i * 0.012]}>
            <Flat color={COAL} />
          </mesh>
        ))}

        {/* stick arms */}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.24, 0.9, 0]} rotation-z={-s * 1.05}>
            <mesh geometry={geo.stick}>
              <Flat color={STICK} />
            </mesh>
            <mesh geometry={geo.twig} position-y={0.42} rotation-z={s * 0.7}>
              <Flat color={STICK} />
            </mesh>
            <mesh geometry={geo.twig} position-y={0.48} rotation-z={-s * 0.5}>
              <Flat color={STICK} />
            </mesh>
          </group>
        ))}

        {/* scarf */}
        <group position-y={1.08}>
          <mesh geometry={geo.wrap}>
            <Flat color={C[0]} />
          </mesh>
          <Tail geo={geo} colors={C} side={1} />
          <Tail geo={geo} colors={[C[1], C[0]]} side={-0.4} />
        </group>

        {/* head */}
        <group ref={head} position-y={1.25}>
          <mesh geometry={geo.b3}>
            <Flat color={SNOW} />
          </mesh>
          <Face position={[0, 0.04, 0.2]} spacing={0.13} size={0.028} color={COAL} mouth="dots" mouthWidth={0.15} mouthY={-0.1} />
          <mesh geometry={geo.nose} position={[0, -0.01, 0.2]}>
            <Flat color="#f0782a" />
          </mesh>
          <group position-y={0.16} rotation-z={-0.12}>
            <mesh geometry={geo.brim}>
              <Flat color={COAL} />
            </mesh>
            <mesh geometry={geo.hat}>
              <Flat color={COAL} />
            </mesh>
            <mesh geometry={geo.band} position-y={0.05}>
              <Flat color={C[0]} />
            </mesh>
          </group>
        </group>
      </group>

      {fall.map((_, i) => (
        <mesh key={i} ref={(el) => (flakes.current[i] = el)} geometry={geo.flake}>
          <Flat color="#ffffff" emissive="#ffffff" emissiveIntensity={0.3} />
        </mesh>
      ))}
    </group>
  )
}

export default function SnowmanScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3, 2.2, 4.2]} target={[0, 0.85, 0]} hint="His scarf flutters, he looks about and snow falls on its own · tap him and he wobbles, head last · Scarf swaps red, blue, green and purple · Snow turns the snowfall on and off · drag to orbit">
      <Snowman {...props} />
    </Stage>
  )
}

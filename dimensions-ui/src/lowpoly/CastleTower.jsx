import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Particles, Stage, TAU, blob, facet, rng, useGeo, useTap } from './kit.jsx'

// A low-poly castle tower on a grassy knoll: a round ten-sided keep with
// jutting stones, arrow slits and an arched door, a corbelled parapet with
// merlons, a stub of curtain wall, a flag rippling on a pole and a cannon
// poking through the battlements. Tap it and the cannon fires: it kicks
// back, flashes, belches smoke and lobs a ball out over the field.

const STONES = {
  grey: { wall: '#a6a29b', dark: '#8d8a85', light: '#bdb9b1', flag: '#d8383f', roof: '#5a5f6e' },
  sand: { wall: '#d9c39a', dark: '#c4ab80', light: '#e8d6b0', flag: '#2f6fd0', roof: '#8a5a3a' },
  brick: { wall: '#b8644a', dark: '#9a4f3a', light: '#cc7a5e', flag: '#f2c23a', roof: '#4a3a36' },
  ice: { wall: '#cfe8f7', dark: '#a8d2ec', light: '#eef8fd', flag: '#8350c8', roof: '#5a7fa8' },
}
const R = 0.42 // tower radius
const H = 1.3 // tower height
const MERLONS = 10
const FLAG_W = 0.42
const FLAG_H = 0.26

export function CastleTower({ stone = 'grey' }) {
  const S = STONES[stone] || STONES.grey
  const { tap, handlers, clock } = useTap(1)
  const flag = useRef()
  const cannon = useRef()
  const ball = useRef()
  const flash = useRef()

  const geo = useGeo(
    () => ({
      knoll: facet(new THREE.SphereGeometry(1.2, 12, 4, 0, TAU, 0, Math.PI / 2), 0.04, 1, [1, 0.4, 1], (x, y) => y < 0.001),
      tower: facet(new THREE.CylinderGeometry(R, R * 1.08, H, 10, 3).translate(0, H / 2, 0), 0.01, 2),
      corbel: new THREE.CylinderGeometry(R + 0.08, R, 0.1, 10, 1),
      deck: new THREE.CylinderGeometry(R + 0.06, R + 0.06, 0.04, 10, 1),
      merlon: facet(new THREE.BoxGeometry(0.13, 0.15, 0.1), 0.006, 3),
      block: new THREE.BoxGeometry(0.12, 0.07, 0.04),
      slit: new THREE.BoxGeometry(0.035, 0.16, 0.03),
      door: new THREE.BoxGeometry(0.2, 0.24, 0.04),
      arch: new THREE.CylinderGeometry(0.1, 0.1, 0.04, 8, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(-Math.PI / 2),
      wall: facet(new THREE.BoxGeometry(0.75, 0.6, 0.22), 0.01, 4),
      pole: new THREE.CylinderGeometry(0.012, 0.012, 0.65, 4, 1).translate(0, 0.325, 0),
      flag: new THREE.PlaneGeometry(FLAG_W, FLAG_H, 8, 2).translate(FLAG_W / 2, -FLAG_H / 2, 0),
      barrel: new THREE.CylinderGeometry(0.045, 0.055, 0.32, 8, 1).rotateX(Math.PI / 2),
      carriage: new THREE.BoxGeometry(0.14, 0.07, 0.2),
      wheel: new THREE.CylinderGeometry(0.05, 0.05, 0.025, 8, 1).rotateZ(Math.PI / 2),
      ball: new THREE.IcosahedronGeometry(0.04, 0),
      flash: new THREE.OctahedronGeometry(0.09, 0),
      puff: new THREE.IcosahedronGeometry(1, 0),
      bush: blob(0.12, 5),
    }),
    [],
  )
  const flagBase = useMemo(() => Float32Array.from(geo.flag.attributes.position.array), [geo])
  const blocks = useMemo(() => {
    const r = rng(9)
    return Array.from({ length: 16 }, () => [r() * TAU, 0.15 + r() * (H - 0.3)])
  }, [])

  useFrame(() => {
    const t = clock.elapsedTime
    // the flag ripples: a wave running out from the pole, bigger at the tip
    const p = geo.flag.attributes.position
    for (let i = 0; i < p.count; i++) {
      const x = flagBase[i * 3]
      const y = flagBase[i * 3 + 1]
      p.setZ(i, Math.sin(x * 14 - t * 6) * 0.05 * (x / FLAG_W) + Math.sin(y * 9 + t * 3) * 0.01 * (x / FLAG_W))
    }
    p.needsUpdate = true
    geo.flag.computeVertexNormals()
    flag.current.rotation.y = Math.sin(t * 0.7) * 0.2 - 0.3

    // the shot: recoil, a flash, and a ball on a ballistic arc
    const s = tap.since(t)
    cannon.current.position.z = 0.22 - (s >= 0 && s < 0.6 ? Math.exp(-6 * s) * Math.sin(Math.min(s * 20, Math.PI)) * 0.08 : 0)
    flash.current.visible = s >= 0 && s < 0.1
    flash.current.scale.setScalar(1 + s * 8)
    const inAir = s >= 0 && s < 1.3
    ball.current.visible = inAir
    if (inAir) ball.current.position.set(0, H + 0.17 + 1.1 * s - 0.5 * 2.6 * s * s, 0.62 + 1.6 * s)
  })

  const smoking = () => (tap.since(clock.elapsedTime) < 0.9 ? 1 : 0)

  return (
    <group {...handlers}>
      <mesh geometry={geo.knoll} scale={[1, 0.18, 1]}>
        <Flat color="#6fb04f" />
      </mesh>
      {[
        [0.8, 0.4],
        [-0.7, 0.55],
        [0.55, -0.75],
      ].map(([x, z], i) => (
        <mesh key={i} geometry={geo.bush} position={[x, 0.12, z]} scale={[1.2, 0.8, 1]}>
          <Flat color={i % 2 ? '#4f8a42' : '#5f9a4a'} />
        </mesh>
      ))}

      {/* curtain wall stub */}
      <group position={[-0.62, 0.15, -0.1]} rotation-y={0.35}>
        <mesh geometry={geo.wall} position-y={0.3}>
          <Flat color={S.dark} />
        </mesh>
        {[-0.3, -0.1, 0.1, 0.3].map((x) => (
          <mesh key={x} geometry={geo.merlon} position={[x, 0.66, 0]} scale={[0.8, 0.8, 1.6]}>
            <Flat color={S.wall} />
          </mesh>
        ))}
      </group>

      <group position-y={0.15}>
        <mesh geometry={geo.tower}>
          <Flat color={S.wall} />
        </mesh>
        {blocks.map(([a, y], i) => (
          <mesh key={i} geometry={geo.block} position={[Math.cos(a) * (R + 0.01), y, Math.sin(a) * (R + 0.01)]} rotation-y={-a + Math.PI / 2}>
            <Flat color={i % 2 ? S.light : S.dark} />
          </mesh>
        ))}
        <mesh geometry={geo.door} position={[0, 0.12, R + 0.02]}>
          <Flat color="#4a3424" />
        </mesh>
        <mesh geometry={geo.arch} position={[0, 0.24, R + 0.02]}>
          <Flat color="#4a3424" />
        </mesh>
        {[
          [0.6, 0.5],
          [-0.5, 0.85],
          [2.2, 0.7],
        ].map(([a, y], i) => (
          <mesh key={i} geometry={geo.slit} position={[Math.sin(a) * (R + 0.005), y, Math.cos(a) * (R + 0.005)]} rotation-y={a}>
            <Flat color="#2a2622" />
          </mesh>
        ))}

        {/* parapet */}
        <mesh geometry={geo.corbel} position-y={H + 0.05}>
          <Flat color={S.dark} />
        </mesh>
        <mesh geometry={geo.deck} position-y={H + 0.1}>
          <Flat color={S.roof} />
        </mesh>
        {Array.from({ length: MERLONS }, (_, i) => {
          const a = (i / MERLONS) * TAU + Math.PI / MERLONS
          return (
            <mesh key={i} geometry={geo.merlon} position={[Math.sin(a) * (R + 0.03), H + 0.19, Math.cos(a) * (R + 0.03)]} rotation-y={a}>
              <Flat color={S.wall} />
            </mesh>
          )
        })}

        {/* flag */}
        <group position={[-0.12, H + 0.1, -0.12]}>
          <mesh geometry={geo.pole}>
            <Flat color="#4a3424" />
          </mesh>
          <group ref={flag} position-y={0.63}>
            <mesh geometry={geo.flag}>
              <Flat color={S.flag} side={THREE.DoubleSide} />
            </mesh>
          </group>
        </group>

        {/* the cannon, through the gap at the front */}
        <group ref={cannon} position={[0, H + 0.17, 0.22]}>
          <mesh geometry={geo.carriage} position-y={-0.04}>
            <Flat color="#6e4a34" />
          </mesh>
          {[-1, 1].map((x) => (
            <mesh key={x} geometry={geo.wheel} position={[x * 0.08, -0.06, 0]}>
              <Flat color="#4a3424" />
            </mesh>
          ))}
          <mesh geometry={geo.barrel} position={[0, 0.02, 0.12]} rotation-x={-0.2}>
            <Flat color="#2c2a33" metalness={0.4} roughness={0.5} />
          </mesh>
          <mesh ref={flash} geometry={geo.flash} position={[0, 0.06, 0.32]} visible={false}>
            <Flat color="#ffd84a" emissive="#ffb02e" emissiveIntensity={2} />
          </mesh>
        </group>
        <mesh ref={ball} geometry={geo.ball} visible={false}>
          <Flat color="#2c2a33" />
        </mesh>
        <Particles geometry={geo.puff} count={10} life={1.2} origin={[0, H + 0.24, 0.55]} spread={0.06} velocity={[0, 0.3, 0.35]} scatter={0.25} drift={0.12} size={[0.05, 0.18]} colors={['#d8d8dc', '#b8b8c0']} opacity={[0.8, 0]} active={smoking} />
      </group>
      <Burst tap={tap} count={8} colors={['#ffd84a', '#ff8a2e']} speed={1.4} gravity={2} size={0.03} life={0.5} origin={[0, H + 0.4, 0.6]} spread={0.5} up={0.6} />
    </group>
  )
}

export default function CastleTowerScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.4, 2.4, 4.6]} target={[0, 0.8, 0]} hint="The flag ripples on its own · tap it and the cannon fires: recoil, flash, smoke and a lobbed ball · Stone swaps grey, sand, brick and ice · drag to orbit">
      <CastleTower {...props} />
    </Stage>
  )
}

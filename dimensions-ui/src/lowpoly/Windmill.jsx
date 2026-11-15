import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Spin, Stage, TAU, cone, facet, useGeo, useTap } from './kit.jsx'

// A low-poly tower windmill on a round of grass: a tapering eight-sided
// tower with a door, windows and a gallery band, a conical cap, and four
// lattice sails on a hub. The sails turn steadily with the wind and the cap
// creaks round a little to face it. Tap it and a gust whirls the sails and
// blows a few leaves past.

const STYLES = {
  classic: { tower: '#f3efe6', band: '#d9d2c4', cap: '#c8423a', sail: '#f7f4ec', frame: '#6e4a34' },
  timber: { tower: '#9a6b45', band: '#7d5536', cap: '#3a2c26', sail: '#efe4cc', frame: '#3a2c26' },
  stone: { tower: '#b9b4ab', band: '#9d978d', cap: '#4b5563', sail: '#e9e2d0', frame: '#4a3a30' },
  pastel: { tower: '#bfe3d6', band: '#a3d0c2', cap: '#f29bb0', sail: '#ffffff', frame: '#7a6a8a' },
}
const H = 1.25 // tower height
const HUB = [0, 1.3, 0.56]

export function Windmill({ look = 'classic', wind = 0.6 }) {
  const S = STYLES[look] || STYLES.classic
  const { tap, handlers, clock } = useTap(0.9)
  const cap = useRef()

  const geo = useGeo(
    () => ({
      grass: facet(new THREE.CylinderGeometry(0.95, 1.0, 0.1, 10, 1).translate(0, 0.05, 0), 0.02, 1, [1, 0.3, 1]),
      path: new THREE.BoxGeometry(0.22, 0.02, 0.5),
      tower: facet(new THREE.CylinderGeometry(0.3, 0.44, H, 8, 2).translate(0, H / 2, 0), 0.008, 2),
      band: new THREE.CylinderGeometry(0.4, 0.4, 0.06, 8, 1),
      roof: cone(0.38, 0.42, 8, 3),
      finial: new THREE.OctahedronGeometry(0.04, 0),
      door: new THREE.BoxGeometry(0.16, 0.26, 0.04),
      window: new THREE.BoxGeometry(0.1, 0.12, 0.03),
      axle: new THREE.CylinderGeometry(0.05, 0.05, 0.42, 6, 1).rotateX(Math.PI / 2),
      hub: new THREE.OctahedronGeometry(0.07, 0),
      spar: new THREE.BoxGeometry(0.04, 0.95, 0.03).translate(0, 0.5, 0),
      sail: new THREE.BoxGeometry(0.2, 0.68, 0.015),
      rung: new THREE.BoxGeometry(0.22, 0.015, 0.025),
      leaf: facet(new THREE.IcosahedronGeometry(1, 0), 0.05, 4).scale(1, 0.25, 1.5),
    }),
    [],
  )

  useFrame(() => {
    const t = clock.elapsedTime
    cap.current.rotation.y = Math.sin(t * 0.25) * 0.12
  })

  return (
    <group {...handlers}>
      <mesh geometry={geo.grass}>
        <Flat color="#6fb04f" />
      </mesh>
      <mesh geometry={geo.path} position={[0, 0.105, 0.62]}>
        <Flat color="#d8c39a" />
      </mesh>

      <group position-y={0.1}>
        <mesh geometry={geo.tower}>
          <Flat color={S.tower} />
        </mesh>
        <mesh geometry={geo.band} position-y={0.48}>
          <Flat color={S.band} />
        </mesh>
        <mesh geometry={geo.door} position={[0, 0.13, 0.42]} rotation-x={-0.11}>
          <Flat color={S.frame} />
        </mesh>
        {[
          [0, 0.72, 0.355, 0],
          [0.3, 0.3, 0.3, 0.8],
          [-0.27, 0.95, 0.2, -0.95],
        ].map(([x, y, z, ry], i) => (
          <mesh key={i} geometry={geo.window} position={[x, y, z]} rotation={[-0.11, ry, 0]}>
            <Flat color="#3a4a5c" roughness={0.4} />
          </mesh>
        ))}
      </group>

      {/* the cap, turning a little into the wind, carries the sails */}
      <group ref={cap} position-y={0.1 + H}>
        <mesh geometry={geo.roof} position-y={-0.04}>
          <Flat color={S.cap} />
        </mesh>
        <mesh geometry={geo.finial} position-y={0.42}>
          <Flat color={S.frame} />
        </mesh>
        <group position={[HUB[0], HUB[1] - 0.1 - H, HUB[2]]}>
          <mesh geometry={geo.axle} position-z={-0.19}>
            <Flat color={S.frame} />
          </mesh>
          <Spin tap={tap} axis="z" rate={-(0.4 + wind * 2.2)} boost={-12}>
            <mesh geometry={geo.hub}>
              <Flat color={S.frame} />
            </mesh>
            {[0, 1, 2, 3].map((k) => (
              <group key={k} rotation-z={(k / 4) * TAU}>
                <mesh geometry={geo.spar}>
                  <Flat color={S.frame} />
                </mesh>
                <mesh geometry={geo.sail} position={[0.12, 0.6, -0.01]}>
                  <Flat color={S.sail} />
                </mesh>
                {[0.32, 0.48, 0.64, 0.8].map((y) => (
                  <mesh key={y} geometry={geo.rung} position={[0.12, y, 0.005]}>
                    <Flat color={S.frame} />
                  </mesh>
                ))}
              </group>
            ))}
          </Spin>
        </group>
      </group>

      <Burst tap={tap} geometry={geo.leaf} count={10} colors={['#6fb04f', '#9ccf4f', '#e8b13a']} speed={2.4} gravity={0.8} size={0.035} life={1.8} origin={[-0.9, 0.9, 0.5]} spread={0.5} up={0.4} />
    </group>
  )
}

export default function WindmillScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.4, 2.2, 4.8]} target={[0, 0.95, 0]} hint="The sails turn with the wind and the cap creaks round on its own · tap it and a gust whirls the sails · Wind sets the sail speed · Look swaps classic, timber, stone and pastel · drag to orbit">
      <Windmill {...props} />
    </Stage>
  )
}

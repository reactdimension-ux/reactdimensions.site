import { useEffect, useMemo } from 'react'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

// A low media console (TV table) 118 in wide, its top 20 in off the floor.
// Units are inches. Use it on its own, or alongside <Tv /> via its `table` prop.
export default function TvTable({ color = '#9a7550', z = 0 }) {
  const consoleGeo = useMemo(() => new RoundedBoxGeometry(118, 14, 16, 3, 0.35), [])
  useEffect(() => () => consoleGeo.dispose(), [consoleGeo])
  const consoleColor = color
  return (
    <group position={[0, 0, z]}>
      <mesh geometry={consoleGeo} position={[0, 13, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={consoleColor} roughness={0.6} />
      </mesh>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * 55, 3, sz * 6]} castShadow>
            <cylinderGeometry args={[1.1, 0.8, 6, 12]} />
            <meshStandardMaterial color="#2a2623" roughness={0.6} />
          </mesh>
        )),
      )}
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * 29, 13, 8.05]}>
          <boxGeometry args={[55, 10.5, 0.2]} />
          <meshStandardMaterial color={consoleColor} roughness={0.5} metalness={0.05} />
        </mesh>
      ))}
      <mesh position={[0, 13, 8.18]}>
        <boxGeometry args={[0.5, 11, 0.2]} />
        <meshStandardMaterial color="#1c1a18" roughness={0.6} />
      </mesh>
    </group>
  )
}

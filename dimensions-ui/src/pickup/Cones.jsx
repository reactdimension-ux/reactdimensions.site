import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { vehicle } from './controls.js'

// Default footprint for collisions (the pickup's half length / half width,
// metres); other vehicles pass their own as halfL / halfW.
const HALF_L = 2.95
const HALF_WIDTH = 1.1
const CONE_R = 0.2

// A slalom line in front of the truck plus a ring further out.
function layout() {
  const cones = []
  const fx = Math.cos(-0.65)
  const fz = -Math.sin(-0.65)
  for (let i = 0; i < 7; i++) {
    const d = 9 + i * 5
    const side = i % 2 ? 1.2 : -1.2
    cones.push([fx * d - fz * side, fz * d + fx * side])
  }
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2
    cones.push([-14 + Math.cos(a) * 7, 10 + Math.sin(a) * 7])
  }
  return cones
}

function coneMaterials() {
  const orange = new THREE.MeshPhysicalMaterial({ color: '#ff5a1a', roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.3 })
  const white = new THREE.MeshPhysicalMaterial({ color: '#f4f4f4', roughness: 0.3, metalness: 0.2, clearcoat: 0.6 })
  const base = new THREE.MeshStandardMaterial({ color: '#1b1c1e', roughness: 0.9 })
  return { orange, white, base }
}

export default function Cones({ reset = 0, halfL = HALF_L, halfW = HALF_WIDTH }) {
  const start = useMemo(layout, [])
  const mats = useMemo(coneMaterials, [])
  const refs = useRef([])
  const state = useRef([])

  const resetCones = () => {
    state.current = start.map(([x, z]) => ({
      x,
      z,
      vx: 0,
      vz: 0,
      yaw: Math.random() * Math.PI,
      spin: 0,
      tip: 0, // how far it has fallen over (0 = upright, PI/2 = lying)
      tipVel: 0,
      tipDir: 0,
    }))
  }
  if (!state.current.length) resetCones()
  useEffect(() => {
    if (reset) resetCones()
  }, [reset])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30)
    const h = vehicle.heading
    const fwd = [Math.cos(h), -Math.sin(h)]
    const side = [Math.sin(h), Math.cos(h)]
    for (let i = 0; i < state.current.length; i++) {
      const c = state.current[i]
      // Cone position in the truck's frame
      const dx = c.x - vehicle.x
      const dz = c.z - vehicle.z
      const lx = dx * fwd[0] + dz * fwd[1]
      const lz = dx * side[0] + dz * side[1]
      const px = halfL + CONE_R - Math.abs(lx)
      const pz = halfW + CONE_R - Math.abs(lz)
      if (px > 0 && pz > 0) {
        // Push out along the shallowest axis and take the truck's velocity
        // plus a kick, like an elastic hit with a much heavier body.
        let nx, nz, depth
        if (px < pz) {
          ;[nx, nz] = [fwd[0] * Math.sign(lx), fwd[1] * Math.sign(lx)]
          depth = px
        } else {
          ;[nx, nz] = [side[0] * Math.sign(lz), side[1] * Math.sign(lz)]
          depth = pz
        }
        c.x += nx * depth
        c.z += nz * depth
        const tvx = fwd[0] * vehicle.speed
        const tvz = fwd[1] * vehicle.speed
        const closing = (tvx - c.vx) * nx + (tvz - c.vz) * nz
        if (closing > 0) {
          const impulse = closing * 1.6 + 0.4
          c.vx += nx * impulse + (Math.random() - 0.5) * 0.6
          c.vz += nz * impulse + (Math.random() - 0.5) * 0.6
          c.spin += (Math.random() - 0.5) * impulse * 3
          if (impulse > 2.2) c.tipVel += impulse * 0.9
          vehicle.speed *= 0.97 // a little resistance for the truck
        }
      }
      // Sliding friction (stronger once it's lying on its side)
      const fr = c.tip > 0.6 ? 2.2 : 3.5
      const k = Math.exp(-fr * dt)
      c.vx *= k
      c.vz *= k
      c.spin *= Math.exp(-2 * dt)
      c.x += c.vx * dt
      c.z += c.vz * dt
      c.yaw += c.spin * dt
      if (Math.hypot(c.vx, c.vz) > 0.3) c.tipDir = Math.atan2(c.vx, c.vz)
      // Tipping: gravity pulls it over past the balance point, and the
      // ground stops it at 90 degrees with a small bounce.
      const g = c.tip > 0.35 ? 18 * Math.sin(c.tip) : -14 * c.tip
      c.tipVel += g * dt
      c.tipVel *= Math.exp(-1.5 * dt)
      c.tip += c.tipVel * dt
      if (c.tip > Math.PI / 2) {
        c.tip = Math.PI / 2
        c.tipVel *= -0.25
      }
      if (c.tip < 0) {
        c.tip = 0
        c.tipVel = 0
      }

      const o = refs.current[i]
      if (o) {
        o.position.set(c.x, 0, c.z)
        o.rotation.set(0, c.tipDir, 0)
        o.children[0].rotation.set(c.tip, c.yaw - c.tipDir, 0)
        // Lying cones rest on their side, raised by the cone radius
        o.children[0].position.y = Math.sin(c.tip) * 0.16
      }
    }
  })

  return start.map((_, i) => (
    <group key={i} ref={(el) => (refs.current[i] = el)}>
      <group>
        <mesh position={[0, 0.02, 0]} material={mats.base} castShadow receiveShadow>
          <boxGeometry args={[0.42, 0.04, 0.42]} />
        </mesh>
        <mesh position={[0, 0.39, 0]} material={mats.orange} castShadow>
          <cylinderGeometry args={[0.035, 0.17, 0.7, 24]} />
        </mesh>
        <mesh position={[0, 0.42, 0]} material={mats.white}>
          <cylinderGeometry args={[0.083, 0.11, 0.14, 24, 1, true]} />
        </mesh>
      </group>
    </group>
  ))
}

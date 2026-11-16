import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Stage, TAU, facet, rng, useGeo, useTap, wobble } from './kit.jsx'

// A low-poly pancake stack on a plate: four faceted discs with browned tops,
// each set a touch off centre, a pool of syrup on top with a pat of butter,
// syrup between the layers and a fork laid beside. Syrup drips grow down the
// side of the stack and drop onto the plate, and the butter slowly slumps
// and slides. Tap it and the top pancake crouches, flips high with a full
// turn and lands back on the stack with a squash.

const LOOKS = {
  maple: { cake: '#eab067', crust: '#b86a2e', syrup: '#a8501a', butter: '#f7dc74' },
  berry: { cake: '#eab067', crust: '#b86a2e', syrup: '#6a2a7a', butter: '#f7dc74', berries: true },
  chocolate: { cake: '#8a5532', crust: '#5a311c', syrup: '#4e2716', butter: '#f7dc74', chips: true },
}
const PLATE = 0.045 // plate top
const R = 0.6 // pancake radius
const T = 0.12 // pancake thickness
const N = 4 // pancakes
const STACK = Array.from({ length: N }, (_, i) => {
  const r = rng(30 + i)
  return { x: (r() - 0.5) * 0.06, z: (r() - 0.5) * 0.06, rot: r() * TAU, s: 1 - i * 0.025 }
})
const TOP = PLATE + (N - 1) * T // bottom of the top pancake
const FLIGHT = 1.0 // seconds in the air
const HEIGHT = 0.62 // how high the flip goes
const CROUCH = 0.12
const DRIPS = [0.4, 1.5, 2.6, 3.9, 5.1] // angles round the stack

// a flat disc whose edge bulges in a few lobes, like a poured puddle
function puddle(r, h, seed, lobes = 5) {
  const g = new THREE.CylinderGeometry(r, r, h, 14, 1)
  const p = g.attributes.position
  const rnd = rng(seed)
  const ph = rnd() * TAU
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const z = p.getZ(i)
    const d = Math.hypot(x, z)
    if (d < 1e-4) continue
    const a = Math.atan2(z, x)
    const k = 1 + 0.12 * Math.sin(a * lobes + ph) + 0.05 * Math.sin(a * 3 - ph)
    p.setXYZ(i, x * k, p.getY(i), z * k)
  }
  return facet(g, h * 0.15, seed)
}

const ease = (u) => u * u * (3 - 2 * u)

export function PancakeStack({ look = 'maple' }) {
  const L = LOOKS[look] || LOOKS.maple
  const { tap, handlers, clock } = useTap(1)
  const top = useRef()
  const topInner = useRef()
  const lower = useRef()
  const butter = useRef()
  const melt = useRef()
  const drips = useRef([])
  const drops = useRef([])
  const pools = useRef([])

  const geo = useGeo(
    () => ({
      plate: facet(new THREE.LatheGeometry([[0.001, 0], [0.7, 0], [0.98, 0.05], [1.08, 0.1], [1.03, 0.11], [0.74, PLATE], [0.001, PLATE]].map(([r, y]) => new THREE.Vector2(r, y)), 18), 0.006, 2),
      cakes: STACK.map((_, i) => facet(new THREE.CylinderGeometry(R, R * 1.02, T, 13, 1).translate(0, T / 2, 0), 0.018, 40 + i, [1, 0.35, 1])),
      syrupTop: puddle(R * 0.78, 0.03, 7),
      syrupMid: puddle(R * 0.86, 0.02, 9, 4),
      drip: new THREE.CylinderGeometry(0.038, 0.03, 1, 6, 1).translate(0, -0.5, 0),
      drop: facet(new THREE.IcosahedronGeometry(0.05, 0), 0.006, 3).scale(1, 1.25, 1),
      pool: puddle(0.11, 0.012, 11, 3),
      butter: facet(new THREE.BoxGeometry(0.24, 0.13, 0.2, 1, 1, 1), 0.012, 5),
      melt: puddle(0.2, 0.012, 13, 4),
      blue: facet(new THREE.IcosahedronGeometry(0.055, 0), 0.008, 14),
      straw: facet(new THREE.ConeGeometry(0.075, 0.13, 6, 1), 0.01, 15),
      leaf: new THREE.ConeGeometry(0.05, 0.02, 5, 1),
      chip: new THREE.ConeGeometry(0.035, 0.04, 5, 1).translate(0, 0.02, 0),
      handle: facet(new THREE.BoxGeometry(0.5, 0.025, 0.07, 3, 1, 1), 0.004, 16),
      neck: new THREE.BoxGeometry(0.14, 0.022, 0.1),
      tine: new THREE.BoxGeometry(0.16, 0.02, 0.016),
    }),
    [],
  )

  // toppings on the top pancake: berries or chips scattered round the butter
  const bits = useMemo(() => {
    const r = rng(look === 'berry' ? 21 : 22)
    return Array.from({ length: look === 'berry' ? 7 : 10 }, (_, i) => {
      const a = (i / (look === 'berry' ? 7 : 10)) * TAU + r() * 0.4
      const d = 0.24 + r() * 0.16
      return { p: [Math.cos(a) * d, Math.sin(a) * d], rot: r() * TAU, straw: look === 'berry' && i % 3 === 0 }
    })
  }, [look])

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)

    // the flip: crouch, up and over, land with a squash
    let lift = 0
    let spin = 0
    let sq = 0
    let land = 0
    if (s >= 0 && s < CROUCH) sq = Math.sin((s / CROUCH) * Math.PI) * 0.25
    else if (s >= CROUCH && s < CROUCH + FLIGHT) {
      const u = (s - CROUCH) / FLIGHT
      lift = 4 * HEIGHT * u * (1 - u)
      spin = -TAU * ease(u)
      sq = -0.12 * Math.sin(u * Math.PI)
    } else if (s >= CROUCH + FLIGHT) {
      const b = s - CROUCH - FLIGHT
      sq = wobble(b + 0.11, 14, 4.5) * 0.35
      land = wobble(b, 16, 6) * 0.06
    }
    top.current.position.y = TOP + T / 2 + lift
    top.current.rotation.x = spin
    top.current.rotation.z = spin * 0.08
    topInner.current.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5)
    lower.current.scale.set(1 + Math.max(0, land) * 0.4, 1 - Math.max(0, land), 1 + Math.max(0, land) * 0.4)

    // the butter slumps and slides a little, its melt spreading under it
    const m = 0.5 - 0.5 * Math.cos(t * 0.45)
    butter.current.position.set(0.04 + m * 0.07, 0.03 + 0.065 * (1 - m * 0.18), -0.02 + m * 0.03)
    butter.current.scale.set(1 + m * 0.08, 1 - m * 0.18, 1 + m * 0.06)
    butter.current.rotation.set(0, 0.5 + m * 0.12, -m * 0.06)
    melt.current.scale.set(0.8 + m * 0.5, 1, 0.8 + m * 0.45)

    // drips run down the side, a drop falls from the tip onto the plate
    DRIPS.forEach((a, i) => {
      const per = 3.2 + i * 0.37
      const u = ((t + i * 1.13) % per) / per
      const grow = Math.min(1, u / 0.7)
      const maxLen = TOP - PLATE - 0.04 - (i % 2) * 0.12
      const len = 0.05 + ease(grow) * maxLen * (0.55 + 0.45 * ((i * 37) % 10) / 10)
      const dr = drips.current[i]
      const dp = drops.current[i]
      const pl = pools.current[i]
      if (!dr || !dp || !pl) return
      dr.scale.set(1, len, 1)
      const fall = u > 0.7 ? (u - 0.7) / 0.3 : 0
      const tipY = TOP - len
      if (fall === 0) {
        dp.position.y = tipY - 0.01
        dp.scale.setScalar(0.5 + grow * 0.6)
      } else {
        const y = tipY - 4.5 * (fall * 0.6) ** 2
        dp.position.y = Math.max(PLATE + 0.01, y)
        dp.scale.setScalar(y <= PLATE + 0.01 ? Math.max(0.001, 1.1 - (fall - 0.3) * 3) : 1.1)
      }
      dr.scale.x = dr.scale.z = 1 - fall * 0.3
      pl.scale.setScalar(0.6 + 0.4 * Math.sin(((t + i * 1.13) / per) * 0.2 * TAU) ** 2)
    })
  })

  return (
    <group {...handlers}>
      <mesh geometry={geo.plate}>
        <Flat color="#f4f1ea" roughness={0.45} side={THREE.DoubleSide} />
      </mesh>
      {/* a little puddle of syrup on the plate under each drip */}
      {DRIPS.map((a, i) => (
        <mesh key={a} ref={(el) => (pools.current[i] = el)} geometry={geo.pool} position={[Math.cos(a) * (R + 0.12), PLATE + 0.006, Math.sin(a) * (R + 0.12)]} rotation-y={a}>
          <Flat color={L.syrup} roughness={0.15} />
        </mesh>
      ))}

      {/* the lower pancakes, with syrup soaked between the layers */}
      <group ref={lower} position-y={PLATE}>
        <group position-y={-PLATE}>
          {STACK.slice(0, N - 1).map((c, i) => (
            <group key={i} position={[c.x, PLATE + i * T, c.z]} rotation-y={c.rot} scale={[c.s, 1, c.s]}>
              <mesh geometry={geo.cakes[i]}>
                <meshStandardMaterial attach="material-0" color={L.cake} flatShading roughness={0.85} />
                <meshStandardMaterial attach="material-1" color={L.crust} flatShading roughness={0.85} />
                <meshStandardMaterial attach="material-2" color={L.crust} flatShading roughness={0.85} />
              </mesh>
            </group>
          ))}
          <mesh geometry={geo.syrupMid} position-y={TOP - 0.004}>
            <Flat color={L.syrup} roughness={0.15} />
          </mesh>
          {/* the drips down the side */}
          {DRIPS.map((a, i) => (
            <group key={a} position={[Math.cos(a) * (R * 0.99), 0, Math.sin(a) * (R * 0.99)]}>
              <mesh ref={(el) => (drips.current[i] = el)} geometry={geo.drip} position-y={TOP}>
                <Flat color={L.syrup} roughness={0.15} />
              </mesh>
              <mesh ref={(el) => (drops.current[i] = el)} geometry={geo.drop} position-y={TOP}>
                <Flat color={L.syrup} roughness={0.15} />
              </mesh>
            </group>
          ))}
        </group>
      </group>

      {/* the top pancake, which flips, with everything on it */}
      <group ref={top} position={[STACK[N - 1].x, TOP + T / 2, STACK[N - 1].z]}>
        <group ref={topInner}>
          <group position-y={-T / 2} rotation-y={STACK[N - 1].rot}>
            <mesh geometry={geo.cakes[N - 1]} scale={[STACK[N - 1].s, 1, STACK[N - 1].s]}>
              <meshStandardMaterial attach="material-0" color={L.cake} flatShading roughness={0.85} />
              <meshStandardMaterial attach="material-1" color={L.crust} flatShading roughness={0.85} />
              <meshStandardMaterial attach="material-2" color={L.crust} flatShading roughness={0.85} />
            </mesh>
            <group position-y={T}>
              <mesh geometry={geo.syrupTop} position-y={0.012}>
                <Flat color={L.syrup} roughness={0.15} />
              </mesh>
              <mesh ref={melt} geometry={geo.melt} position={[0.08, 0.03, 0]}>
                <Flat color="#fbe9a0" roughness={0.2} />
              </mesh>
              <mesh ref={butter} geometry={geo.butter}>
                <Flat color={L.butter} roughness={0.45} />
              </mesh>
              {L.berries &&
                bits.map((b, i) =>
                  b.straw ? (
                    <group key={i} position={[b.p[0], 0.06, b.p[1]]} rotation={[0.3, b.rot, Math.PI - 0.4]}>
                      <mesh geometry={geo.straw}>
                        <Flat color="#e2343f" roughness={0.5} />
                      </mesh>
                      <mesh geometry={geo.leaf} position-y={0.07}>
                        <Flat color="#5ab04a" />
                      </mesh>
                    </group>
                  ) : (
                    <mesh key={i} geometry={geo.blue} position={[b.p[0], 0.07, b.p[1]]} rotation-y={b.rot}>
                      <Flat color="#3a3f8f" roughness={0.45} />
                    </mesh>
                  ),
                )}
              {L.chips &&
                bits.map((b, i) => (
                  <mesh key={i} geometry={geo.chip} position={[b.p[0], 0.03, b.p[1]]} rotation-y={b.rot}>
                    <Flat color="#2a160c" roughness={0.6} />
                  </mesh>
                ))}
            </group>
          </group>
        </group>
      </group>

      {/* the fork on the plate */}
      <group position={[0.5, PLATE + 0.03, 0.6]} rotation-y={0.69}>
        <mesh geometry={geo.handle} position-x={-0.2}>
          <Flat color="#c9ced8" metalness={0.4} roughness={0.35} />
        </mesh>
        <mesh geometry={geo.neck} position-x={0.11}>
          <Flat color="#c9ced8" metalness={0.4} roughness={0.35} />
        </mesh>
        {[-0.036, -0.012, 0.012, 0.036].map((z) => (
          <mesh key={z} geometry={geo.tine} position={[0.24, 0.004, z]}>
            <Flat color="#c9ced8" metalness={0.4} roughness={0.35} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

export default function PancakeStackScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.0, 2.2, 3.6]} target={[0, 0.48, 0]} hint="Syrup drips down the side and the butter slowly melts and slides on its own · tap it and the top pancake flips high with a spin and lands back with a squash · Look swaps maple, berry and chocolate · drag to orbit">
      <PancakeStack {...props} />
    </Stage>
  )
}

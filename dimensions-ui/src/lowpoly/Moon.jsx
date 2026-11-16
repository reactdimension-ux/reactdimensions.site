import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Stage, TAU, facet, pulse, rng, useGeo, useKick, useTap, wobble } from './kit.jsx'

// A low-poly moon: a faceted sphere pressed with craters, turning slowly
// above the floor. Its phases sweep round on their own: every facet is lit
// or in shadow by which side of a turning terminator it faces, so the moon
// waxes from a sliver to full and wanes again. A few stars twinkle round it.
// Tap it and a meteor streaks in, strikes, throws up a puff of dust, and the
// moon judders from the blow.

const LOOKS = {
  silver: { lit: '#ece9df', dark: '#3b4058', crater: '#9d988c', glow: '#fff6dc', star: '#fff3c0' },
  harvest: { lit: '#f3c27a', dark: '#4a3a3a', crater: '#c0843f', glow: '#ffd79a', star: '#fff0c8' },
  blue: { lit: '#cfe0ff', dark: '#28304f', crater: '#8199c6', glow: '#d8e6ff', star: '#e6f0ff' },
  blood: { lit: '#d8674a', dark: '#3a2228', crater: '#b04a33', glow: '#ff9c7a', star: '#ffd6c0' },
}

const R = 0.72
const Y = 1.0
const PHASE_PERIOD = 12 // seconds from new to new

// A faceted sphere with craters pressed into it: each crater a dish with a
// raised rim. Returns the geometry and, per vertex, how deep in a crater it is.
function moonGeometry() {
  const g = new THREE.IcosahedronGeometry(R, 2)
  const p = g.attributes.position
  const r = rng(11)
  const craters = Array.from({ length: 11 }, () => {
    const u = r() * 2 - 1
    const a = r() * TAU
    const s = Math.sqrt(1 - u * u)
    return { c: new THREE.Vector3(s * Math.cos(a), u, s * Math.sin(a)), size: 0.26 + r() * 0.3, depth: 0.09 + r() * 0.07 }
  })
  const v = new THREE.Vector3()
  const pit = new Float32Array(p.count)
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    const n = v.clone().normalize()
    let d = 0
    let k = 0
    for (const cr of craters) {
      const ang = n.angleTo(cr.c) / cr.size
      if (ang < 1) {
        d -= cr.depth * (1 - ang * ang) // the dish
        k = Math.max(k, 1 - ang)
      } else if (ang < 1.4) d += cr.depth * 0.35 * Math.sin(((ang - 1) / 0.4) * Math.PI) // the rim
    }
    v.copy(n).multiplyScalar(R + d)
    p.setXYZ(i, v.x, v.y, v.z)
    pit[i] = k
  }
  facet(g, 0.02, 4)
  return { g, pit }
}

export function Moon({ look = 'silver' }) {
  const L = LOOKS[look] || LOOKS.silver
  const { tap, handlers, clock } = useTap(2)
  const hit = useKick(3)
  const body = useRef()
  const shake = useRef()
  const meteor = useRef()
  const stars = useRef([])
  const struck = useRef(-99)

  const geo = useGeo(() => {
    const { g, pit } = moonGeometry()
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3))
    g.userData.pit = pit
    return { moon: g, star: new THREE.OctahedronGeometry(0.05, 0), rock: facet(new THREE.IcosahedronGeometry(0.07, 0), 0.015, 2), dust: new THREE.IcosahedronGeometry(1, 0) }
  }, [])
  const cols = useMemo(() => ({ lit: new THREE.Color(L.lit), dark: new THREE.Color(L.dark), crater: new THREE.Color(L.crater) }), [L])
  const starAt = useMemo(() => {
    const r = rng(5)
    return Array.from({ length: 6 }, () => {
      const a = r() * TAU
      return [Math.cos(a) * (1.25 + r() * 0.5), Y + (r() - 0.3) * 1.2, Math.sin(a) * (1.25 + r() * 0.5), r() * 6]
    })
  }, [])
  // the meteor's line in: from high on one side to a point on the moon's face
  const path = useMemo(() => ({ from: new THREE.Vector3(2.6, Y + 2.2, 1.4), at: new THREE.Vector3(0.42, Y + 0.38, 0.42) }), [])

  const sun = new THREE.Vector3()
  const n = new THREE.Vector3()
  const c = new THREE.Color()
  useFrame(() => {
    const t = clock.elapsedTime
    // the phase: the sun's direction swings round the moon (in the moon's own frame)
    const ph = (t / PHASE_PERIOD) * TAU
    sun.set(Math.sin(ph), 0.15, -Math.cos(ph)).normalize()
    const g = geo.moon
    const p = g.attributes.position
    const col = g.attributes.color
    const nor = g.attributes.normal
    const pit = g.userData.pit
    for (let i = 0; i < p.count; i++) {
      n.fromBufferAttribute(nor, i)
      const lit = THREE.MathUtils.smoothstep(n.dot(sun), -0.08, 0.12)
      c.copy(cols.lit).lerp(cols.crater, Math.min(1, pit[i] * 1.8))
      c.lerp(cols.dark, 1 - lit)
      col.setXYZ(i, c.r, c.g, c.b)
    }
    col.needsUpdate = true

    // the meteor: streaks in over 0.45 s, then the impact
    const s = tap.since(t)
    const m = meteor.current
    m.visible = s >= 0 && s < 0.45
    if (m.visible) {
      m.position.lerpVectors(path.from, path.at, (s / 0.45) ** 1.4)
      m.rotation.set(s * 9, s * 7, 0)
    }
    if (s >= 0.45 && s < 1 && struck.current !== tap.since(0)) {
      struck.current = tap.since(0)
      hit.kick(t)
    }
    const w = wobble(hit.since(t), 22, 4)
    shake.current.position.set(-w * 0.06, 0, -w * 0.05)
    shake.current.rotation.z = w * 0.05
    body.current.material.emissiveIntensity = 0.08 + pulse(t, 0.25) * 0.05 + hit.value(t) * 0.5

    stars.current.forEach((st, i) => {
      if (!st) return
      st.scale.setScalar(0.6 + pulse(t, 0.6, starAt[i][3]) * 0.8)
      st.rotation.y = t * 0.8 + i
    })
  })

  return (
    <group {...handlers}>
      <group ref={shake}>
        <group position-y={Y} rotation={[0.25, 0, 0.12]}>
          <mesh ref={body} geometry={geo.moon} rotation-y={0}>
            <Flat color="#ffffff" vertexColors emissive={L.glow} emissiveIntensity={0.1} />
          </mesh>
        </group>
      </group>
      {starAt.map((s, i) => (
        <mesh key={i} ref={(el) => (stars.current[i] = el)} geometry={geo.star} position={[s[0], s[1], s[2]]}>
          <Flat color={L.star} emissive={L.star} emissiveIntensity={0.9} />
        </mesh>
      ))}
      <mesh ref={meteor} geometry={geo.rock} visible={false}>
        <Flat color="#8a7d72" emissive="#ff8a3d" emissiveIntensity={0.9} />
      </mesh>
      <Burst tap={hit} geometry={geo.dust} count={14} colors={[L.crater, L.lit, '#9a948a']} speed={1.6} gravity={0.8} size={0.06} life={1.1} origin={[path.at.x, path.at.y, path.at.z]} spread={0.9} />
    </group>
  )
}

export default function MoonScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} target={[0, 0.95, 0]} hint="The moon turns through its phases on its own, waxing to full and waning again · tap it and a meteor strikes, throwing up dust · Look swaps silver, harvest, blue and blood moons · drag to orbit">
      <Moon {...props} />
    </Stage>
  )
}

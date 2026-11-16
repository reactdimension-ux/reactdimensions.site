import { forwardRef, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  EYES, LEGS, PALETTES, TAIL_ROOT, chestGeometry, craniumGeometry, earGeometry, eyeGeometry, haunchGeometry, legGeometry, legHip,
  maneCoreGeometry, maneLayout, mouthGeometry, muzzleGeometry, noseGeometry, pawGeometry, tailGeometry, torsoGeometry, tuftGeometry,
} from './geometry.js'

// A low-poly male lion made of procedural geometry only, split into one
// component per part of the body. It faces +x and stands on y = 0.
//
// Hierarchy: Lion > body, chest, four legs (each with its paw) swinging at
// the hip, the tail swaying at its root, and one head group (head + mane)
// that turns and nods at the neck.

// Geometries and materials are built once per colour scheme and shared.
const CACHE = new Map()
function useParts(palette) {
  return useMemo(() => {
    if (CACHE.has(palette)) return CACHE.get(palette)
    const P = PALETTES[palette] || PALETTES.golden
    const parts = {
      P,
      torso: torsoGeometry(P),
      haunch: haunchGeometry(P),
      chest: chestGeometry(P),
      legs: LEGS.map((L) => ({ L, hip: legHip(L), leg: legGeometry(L, P), paw: pawGeometry(L, P) })),
      cranium: craniumGeometry(P),
      muzzle: muzzleGeometry(P),
      nose: noseGeometry(P),
      mouth: mouthGeometry(P),
      ears: earGeometry(P),
      eyes: eyeGeometry(P),
      maneCore: maneCoreGeometry(P),
      tufts: maneLayout(P),
      tuft: tuftGeometry(),
      tail: tailGeometry(P),
      // one faceted material for everything coloured per face
      skin: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.88, metalness: 0 }),
      tuftMat: new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 0.92, metalness: 0 }),
      iris: new THREE.MeshStandardMaterial({ color: P.eyes, flatShading: true, roughness: 0.35, emissive: P.eyes, emissiveIntensity: 0.12 }),
      pupil: new THREE.MeshStandardMaterial({ color: '#120b08', flatShading: true, roughness: 0.25 }),
      glint: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    }
    CACHE.set(palette, parts)
    return parts
  }, [palette])
}

const Part = ({ geo, mat, ...rest }) => <mesh geometry={geo} material={mat} castShadow receiveShadow {...rest} />

// ---- the parts ----

export const LionBody = forwardRef(function LionBody({ parts }, ref) {
  return (
    <group ref={ref}>
      <Part geo={parts.torso} mat={parts.skin} />
      <Part geo={parts.haunch} mat={parts.skin} />
    </group>
  )
})

export const LionChest = forwardRef(function LionChest({ parts }, ref) {
  return (
    <group ref={ref} position={[0.62, 0.9, 0]}>
      <Part geo={parts.chest} mat={parts.skin} position={[-0.62, -0.9, 0]} />
    </group>
  )
})

export function LionPaw({ geo, mat }) {
  return <Part geo={geo} mat={mat} />
}

// Four legs, each a group pivoting at its hip so it can walk.
export function LionLegs({ parts, legRefs }) {
  return parts.legs.map(({ L, hip, leg, paw }, i) => (
    <group key={L.key} ref={(el) => (legRefs.current[i] = el)} position={hip}>
      <Part geo={leg} mat={parts.skin} />
      <LionPaw geo={paw} mat={parts.skin} />
    </group>
  ))
}

export function LionEyes({ parts }) {
  const e = parts.eyes
  return (
    <group>
      <Part geo={e.socket} mat={parts.skin} />
      <Part geo={e.brow} mat={parts.skin} />
      <Part geo={e.tear} mat={parts.skin} />
      {EYES.map(({ s, at, yaw }) => (
        <group key={s} position={at} rotation={[0, -yaw, 0]}>
          {/* the iris sits just proud of the socket, the pupil on it, then a catch-light */}
          <mesh geometry={e.iris} material={parts.iris} scale={0.032} position={[0.013, 0, 0]} />
          <mesh geometry={e.pupil} material={parts.pupil} scale={0.0165} position={[0.02, 0.001, 0]} />
          <mesh geometry={e.pupil} material={parts.glint} scale={0.0055} position={[0.026, 0.012, -0.008 * s]} />
        </group>
      ))}
    </group>
  )
}

export function LionEars({ parts }) {
  return (
    <group>
      <Part geo={parts.ears.outer} mat={parts.skin} />
      <Part geo={parts.ears.inner} mat={parts.skin} />
    </group>
  )
}

export function LionMuzzle({ parts }) {
  return (
    <group>
      <Part geo={parts.muzzle} mat={parts.skin} />
      <Part geo={parts.nose} mat={parts.skin} />
      <Part geo={parts.mouth} mat={parts.skin} />
    </group>
  )
}

export function LionHead({ parts }) {
  return (
    <group>
      <Part geo={parts.cranium} mat={parts.skin} />
      <LionEars parts={parts} />
      <LionEyes parts={parts} />
      <LionMuzzle parts={parts} />
    </group>
  )
}

// The mane: a solid ruff plus 40-odd pointed tufts drawn as one instanced mesh.
export function LionMane({ parts }) {
  const inst = useRef()
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const roll = new THREE.Quaternion()
    const Y = new THREE.Vector3(0, 1, 0)
    parts.tufts.forEach((t, i) => {
      q.setFromUnitVectors(Y, t.dir).multiply(roll.setFromAxisAngle(Y, t.roll))
      m.compose(t.base, q, new THREE.Vector3(t.wid, t.len, t.wid * 0.72))
      inst.current.setMatrixAt(i, m)
      inst.current.setColorAt(i, t.col)
    })
    inst.current.instanceMatrix.needsUpdate = true
    if (inst.current.instanceColor) inst.current.instanceColor.needsUpdate = true
    inst.current.computeBoundingSphere()
  }, [parts])
  return (
    <group>
      <Part geo={parts.maneCore} mat={parts.skin} />
      <instancedMesh ref={inst} args={[parts.tuft, parts.tuftMat, parts.tufts.length]} castShadow receiveShadow />
    </group>
  )
}

export const LionTail = forwardRef(function LionTail({ parts }, ref) {
  return (
    <group ref={ref} position={TAIL_ROOT}>
      <Part geo={parts.tail.tube} mat={parts.skin} />
      <Part geo={parts.tail.tuft} mat={parts.skin} />
    </group>
  )
})

// ---- the whole lion ----

const NECK = new THREE.Vector3(0.78, 1.12, 0) // the head turns about here
const HEAD = new THREE.Vector3(0.24, 0.2, 0) // head centre, from the neck

// Gait: a lateral walk, each foot a quarter cycle after the last
// (left hind, left fore, right hind, right fore).
const PHASE = { hl: 0, fl: Math.PI / 2, hr: Math.PI, fr: (3 * Math.PI) / 2 }

export default function Lion({ palette = 'golden', walk = false, idle = true, ...props }) {
  const parts = useParts(palette)
  const body = useRef()
  const chest = useRef()
  const head = useRef()
  const tail = useRef()
  const root = useRef()
  const legRefs = useRef([])
  const st = useRef({ t: 0, w: 0, a: 0 })

  useFrame((_, dt) => {
    dt = Math.min(dt, 0.05)
    if (!(dt > 0)) return
    const s = st.current
    s.t += dt
    s.w += ((walk ? 1 : 0) - s.w) * Math.min(1, dt * 3) // ease in and out of walking
    s.a += ((idle ? 1 : 0) - s.a) * Math.min(1, dt * 3)
    const t = s.t
    const w = s.w
    const a = s.a
    s.phase = (s.phase ?? 0) + dt * 3.4 * w
    const P = s.phase

    // breathing: the chest and barrel swell a little
    const br = Math.sin(t * 1.7) * a
    chest.current.scale.set(1, 1 + 0.018 * br, 1 + 0.024 * br)
    body.current.scale.set(1, 1 + 0.008 * br, 1 + 0.012 * br)

    // legs
    for (let i = 0; i < LEGS.length; i++) {
      const g = legRefs.current[i]
      if (!g) continue
      const L = LEGS[i]
      const p = P + PHASE[L.key]
      g.rotation.z = Math.sin(p) * (L.front ? 0.3 : 0.26) * w
      // the foot comes up while it swings forward, stays down while it pushes
      g.position.y = legHip(L).y + Math.max(0, Math.cos(p)) ** 2 * 0.06 * w
    }
    // the body bobs twice a stride and rolls a touch
    root.current.position.y = -Math.abs(Math.sin(P)) * 0.018 * w + 0.009 * w
    root.current.rotation.x = Math.sin(P) * 0.015 * w

    // head: a slow look about, a small nod; while walking it bobs with the stride
    head.current.rotation.y = (Math.sin(t * 0.37) * 0.16 + Math.sin(t * 1.13) * 0.04) * a * (1 - 0.6 * w)
    head.current.rotation.z = Math.sin(t * 0.61) * 0.035 * a + Math.sin(P * 2) * 0.025 * w
    head.current.rotation.x = Math.sin(t * 0.29) * 0.04 * a

    // tail: a lazy swing, faster and wider on the move
    tail.current.rotation.y = Math.sin(t * (1.1 + w)) * (0.22 + 0.1 * w) * Math.max(a, w)
    tail.current.rotation.z = (Math.sin(t * 0.8) * 0.07 + 0.04 * w) * Math.max(a, w)
    tail.current.rotation.x = Math.sin(t * 1.9) * 0.05 * Math.max(a, w)
  })

  return (
    <group {...props}>
      <group ref={root}>
        <LionBody ref={body} parts={parts} />
        <LionChest ref={chest} parts={parts} />
        <LionLegs parts={parts} legRefs={legRefs} />
        <group ref={head} position={NECK}>
          <group position={HEAD} rotation={[0, 0, -0.08]}>
            <LionMane parts={parts} />
            <LionHead parts={parts} />
          </group>
        </group>
        <LionTail ref={tail} parts={parts} />
      </group>
    </group>
  )
}

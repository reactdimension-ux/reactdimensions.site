import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Sway, Stage, TAU, blob, cone, facet, rng, useGeo, useTap } from './kit.jsx'

// A low-poly dandelion clock in a little tuft of grass: a thin bowed stem,
// two toothy leaves at its foot and a faceted puffball head made of tiny seed
// tufts, each a hair-thin stalk with an open parachute at its tip. It sways
// in a light breeze. Tap it and the seeds are blown off, a few at a time, and
// drift away on the wind; then the bald head slowly grows a new clock.

const LOOKS = {
  meadow: { stem: '#5f9e45', leaf: '#4f8f3a', grass: '#73b552', soil: '#7a5a3c', core: '#c8ab6e', fluff: '#ffffff', glow: 0 },
  golden: { stem: '#8fa040', leaf: '#7c9536', grass: '#b6b04a', soil: '#8a6438', core: '#d79a3a', fluff: '#fff0c8', glow: 0.15 },
  night: { stem: '#3f6f52', leaf: '#356246', grass: '#3f7a5a', soil: '#4a3c46', core: '#a9b8d6', fluff: '#dff2ff', glow: 1.1 },
}

const HEAD = 1.42 // the seed head's height
const SEEDS = 46
const R = 0.3 // the clock's radius
const BLOW = 4.4 // seconds from the tap until the new clock starts to grow

export function Dandelion({ look = 'meadow' }) {
  const L = LOOKS[look] || LOOKS.meadow
  const { tap, handlers, clock } = useTap(2)
  const seeds = useRef([])
  const shell = useRef()
  const geo = useGeo(() => {
    // a stem bowed a little, as a tube along a curve
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.04, 0.5, 0.02), new THREE.Vector3(-0.03, 1.0, 0), new THREE.Vector3(0, HEAD, 0)])
    // a toothed leaf: a flat lance, zig-zag edged, lying along +x
    const s = new THREE.Shape().moveTo(0, 0)
    for (let i = 1; i <= 5; i++) s.lineTo(i * 0.11 - 0.05, (i % 2 ? 0.075 : 0.045) * (1 - i / 7))
    s.lineTo(0.6, 0)
    for (let i = 5; i >= 1; i--) s.lineTo(i * 0.11 - 0.05, -(i % 2 ? 0.075 : 0.045) * (1 - i / 7))
    return {
      stem: new THREE.TubeGeometry(curve, 10, 0.016, 5, false),
      leaf: facet(new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: false }).rotateX(-Math.PI / 2), 0.008, 4),
      blade: cone(0.035, 0.34, 3, 5),
      hit: new THREE.CylinderGeometry(0.3, 0.3, HEAD + 0.4, 6).translate(0, (HEAD + 0.4) / 2, 0),
      soil: facet(new THREE.CylinderGeometry(0.32, 0.4, 0.08, 9).translate(0, 0.04, 0), 0.02, 6),
      core: blob(0.075, 3, 0),
      shell: facet(new THREE.IcosahedronGeometry(R * 0.96, 1), 0.012, 8),
      stalk: new THREE.CylinderGeometry(0.0035, 0.0035, R, 3).translate(0, R / 2, 0),
      // the parachute: a shallow open cone, a star of hairs from below
      chute: new THREE.ConeGeometry(0.05, 0.028, 6, 1, true).rotateX(Math.PI).translate(0, R + 0.005, 0),
    }
  }, [])

  // each seed: its direction on the clock, when it lets go and how it drifts
  const S = useMemo(() => {
    const r = rng(11)
    return Array.from({ length: SEEDS }, (_, i) => {
      const y = 1 - (2 * (i + 0.5)) / SEEDS
      const a = i * 2.39996
      const d = new THREE.Vector3(Math.cos(a) * Math.sqrt(1 - y * y), y, Math.sin(a) * Math.sqrt(1 - y * y))
      return { q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d), d, delay: (1 - d.x) * 0.35 + r() * 0.5, v: 0.75 + r() * 0.5, lift: 0.02 + r() * 0.1, ph: r() * TAU, regrow: r() * 0.8 }
    })
  }, [])
  const onTap = { ...handlers, onClick: (e) => (tap.since(clock.elapsedTime) > BLOW + 1.6 || tap.since(clock.elapsedTime) < 0 ? handlers.onClick(e) : e.stopPropagation()) }

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    let held = 0
    S.forEach((p, i) => {
      const m = seeds.current[i]
      if (!m) return
      const d = s - p.delay
      if (s < 0 || s > BLOW + 1.6 || d < 0) {
        // on the head (trembling just before it goes)
        m.position.set(0, 0, 0)
        m.quaternion.copy(p.q)
        m.scale.setScalar(1)
        held++
      } else if (s < BLOW) {
        // off on the wind: out, downwind (+x), up, swinging as it goes
        const w = d * p.v
        m.position.set(p.d.x * 0.12 * w + 0.32 * w + 0.05 * w * w, p.d.y * 0.08 * w + p.lift * w + 0.06 * Math.sin(d * 2.4 + p.ph), p.d.z * 0.4 * w + 0.12 * Math.sin(d * 1.5 + p.ph))
        m.quaternion.copy(p.q).slerp(_UPQ, Math.min(1, d * 1.5))
        m.rotateY(d * 2 + p.ph)
        m.rotateZ(Math.sin(d * 4 + p.ph) * 0.3)
        m.scale.setScalar(Math.max(0.001, 1 - Math.max(0, (d - 2.2) / 1.2)))
      } else {
        // the new clock: each seed pushes out from the core again
        const u = Math.min(1, Math.max(0, (s - BLOW - p.regrow * 0.6) / 0.9))
        m.position.set(0, 0, 0)
        m.quaternion.copy(p.q)
        m.scale.setScalar(Math.max(0.001, u * (1 + 1.6 * u * (1 - u))))
        held += u
      }
    })
    const k = held / SEEDS
    shell.current.scale.setScalar(Math.max(0.001, k))
    shell.current.material.opacity = 0.22 * k
  })

  return (
    <group {...onTap}>
      {/* an invisible sleeve round the whole plant, so a tap need not find the thin stem */}
      <mesh geometry={geo.hit}>
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* the tuft: a mound of soil, blades of grass and two leaves */}
      <mesh geometry={geo.soil}>
        <Flat color={L.soil} />
      </mesh>
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} geometry={geo.blade} position={[Math.cos(i * 2.3) * 0.22, 0.05, Math.sin(i * 2.3) * 0.22]} rotation={[Math.sin(i * 2.3) * 0.35, i, -Math.cos(i * 2.3) * 0.35]} scale-y={0.7 + (i % 3) * 0.25}>
          <Flat color={i % 2 ? L.grass : L.leaf} />
        </mesh>
      ))}
      {[0.4, 3.3].map((a, i) => (
        <mesh key={a} geometry={geo.leaf} position-y={0.08} rotation={[0, a, 0.35 + i * 0.12]}>
          <Flat color={L.leaf} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* the stem sways from its foot, the head a beat behind */}
      <Sway rate={0.35} amp={0.07} lag={0.5} kick={tap} kickAmp={0.12} position-y={0.07}>
        <mesh geometry={geo.stem}>
          <Flat color={L.stem} />
        </mesh>
        <Sway i={1} rate={0.35} amp={0.06} lag={0.5} axis="x" position-y={HEAD}>
          <mesh geometry={geo.core}>
            <Flat color={L.core} />
          </mesh>
          <mesh ref={shell} geometry={geo.shell}>
            <Flat color={L.fluff} emissive={L.fluff} emissiveIntensity={L.glow * 0.6} transparent opacity={0.22} depthWrite={false} />
          </mesh>
          {S.map((p, i) => (
            <group key={i} ref={(el) => (seeds.current[i] = el)}>
              <mesh geometry={geo.stalk}>
                <Flat color={L.fluff} emissive={L.fluff} emissiveIntensity={L.glow * 0.5} />
              </mesh>
              <mesh geometry={geo.chute}>
                <Flat color={L.fluff} emissive={L.fluff} emissiveIntensity={Math.max(0.3, L.glow)} side={THREE.DoubleSide} />
              </mesh>
            </group>
          ))}
          {L.glow > 0.5 && <pointLight color={L.fluff} intensity={1.2} distance={2.2} decay={2} />}
        </Sway>
      </Sway>
    </group>
  )
}

const _UPQ = new THREE.Quaternion()

export default function DandelionScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.6, 2.2, 4.6]} target={[0, 0.85, 0]} hint="The dandelion sways in a light breeze by itself · tap it to blow the seeds off: they drift away on the wind and a new clock grows back · Look swaps meadow, golden and night · drag to orbit">
      <Dandelion {...props} />
    </Stage>
  )
}

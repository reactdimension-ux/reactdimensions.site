import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Particles, Stage, Sway, TAU, blob, facet, pulse, rng, terrainGeo, useGeo, useTap } from './kit.jsx'

// A low-poly torii gate on a gravel round: two posts on stone footings with
// dark bands at their feet, a tie beam (nuki) through them, a name tablet
// in the middle, and on top the great beam (kasagi) with its ends swept
// up, capped in black. Two paper lanterns hang from the tie beam, and a
// small tree stands to one side. Left alone, the lanterns sway on their
// cords and glow softly. Tap it and a gust blows a swirl of petals through
// the gate, setting the lanterns swinging.

const LOOKS = {
  vermilion: { wood: '#e0452a', cap: '#24222a', band: '#24222a', stone: '#b9b4aa', ground: '#d6cdb9', paper: '#fff1d8', glow: '#ffb347', plaque: '#24222a', gold: '#e7b43c', petals: ['#ffc4d6', '#ffdbe6', '#ff9fbf'], leaf: ['#4f8a3a', '#62a046'], trunk: '#6b4a34' },
  black: { wood: '#2b2930', cap: '#16151a', band: '#c9a23a', stone: '#a9a49c', ground: '#c9c4bb', paper: '#e04a33', glow: '#ff8a3c', plaque: '#16151a', gold: '#d9ab3a', petals: ['#ffffff', '#ffd8e2', '#f3c4d4'], leaf: ['#3f6f35', '#4f8540'], trunk: '#4d3a2c' },
  spring: { wood: '#e65236', cap: '#2a2730', band: '#2a2730', stone: '#bdb8ae', ground: '#a9cf80', paper: '#fff4f6', glow: '#ffc27a', plaque: '#2a2730', gold: '#e7b43c', petals: ['#ffb7cf', '#ffd6e4', '#ff92b8'], leaf: ['#ffb3cc', '#ffcfe0'], trunk: '#6b4a3a' },
  autumn: { wood: '#d4402a', cap: '#2a2420', band: '#2a2420', stone: '#b7ad9d', ground: '#cfa96a', paper: '#ffe2b0', glow: '#ff9a3c', plaque: '#2a2420', gold: '#e7b43c', petals: ['#ff8a2a', '#e8541f', '#ffc23a', '#c23a1c'], leaf: ['#ee7a26', '#d9461e'], trunk: '#5e4030' },
}

const PX = 0.6 // posts at x = +-PX
const POST_H = 1.62
const NUKI_Y = 1.22
const SHIMA_Y = 1.535
const KASA_Y = 1.585 // underside of the kasagi at the middle
const PETALS = 48
const GUST = 2.4 // seconds the swirl takes to pass through

// The kasagi's side profile: a beam whose underside and top both sweep up
// toward the ends, the ends cut on a slant. lo/hi offset the two edges.
function beamShape(lo, hi, half = 1.08, flare = 0.03) {
  const up = (x) => 0.13 * (Math.abs(x) / half) ** 2.6
  const s = new THREE.Shape()
  const n = 8
  for (let i = 0; i <= n; i++) {
    const x = -half + (2 * half * i) / n
    if (i === 0) s.moveTo(x, lo + up(x))
    else s.lineTo(x, lo + up(x))
  }
  for (let i = n; i >= 0; i--) {
    const x = (-half - flare + (2 * (half + flare) * i) / n) * 1
    s.lineTo(x, hi + up(x))
  }
  s.closePath()
  return s
}

// A paper lantern turned on a lathe, hanging from y = 0 down.
function lanternGeometry() {
  const p = [
    [0.001, -0.135],
    [0.05, -0.135],
    [0.078, -0.17],
    [0.09, -0.25],
    [0.078, -0.33],
    [0.05, -0.365],
    [0.001, -0.365],
  ].map(([r, y]) => new THREE.Vector2(r, y))
  return facet(new THREE.LatheGeometry(p, 8), 0.004, 9)
}

// A petal: a little five-sided blade, unit sized.
function petalGeometry() {
  const s = new THREE.Shape()
  s.moveTo(0, -1)
  s.lineTo(0.7, -0.3)
  s.lineTo(0.55, 0.7)
  s.lineTo(0, 0.45)
  s.lineTo(-0.55, 0.7)
  s.lineTo(-0.7, -0.3)
  s.closePath()
  return new THREE.ShapeGeometry(s).scale(1, 0.75, 1)
}

function Lantern({ L, geo, tap, x, phase }) {
  const body = useRef()
  useFrame(({ clock: c }) => {
    if (body.current) body.current.material.emissiveIntensity = 0.55 + pulse(c.elapsedTime, 0.35, phase) * 0.35
  })
  return (
    <group position={[x, NUKI_Y - 0.04, 0]}>
      <Sway axis="x" rate={0.31} amp={0.05} i={phase} kick={tap} kickAmp={0.35}>
        <Sway axis="z" rate={0.43} amp={0.06} i={phase * 1.7}>
          <mesh geometry={geo.cord} position-y={-0.06}>
            <Flat color="#2a2622" />
          </mesh>
          <mesh geometry={geo.lidTop} position-y={-0.135}>
            <Flat color={L.cap} />
          </mesh>
          <mesh ref={body} geometry={geo.lantern}>
            <meshStandardMaterial color={L.paper} emissive={L.glow} emissiveIntensity={0.7} flatShading roughness={0.9} />
          </mesh>
          <mesh geometry={geo.lidTop} position-y={-0.365}>
            <Flat color={L.cap} />
          </mesh>
          <mesh geometry={geo.tassel} position-y={-0.38}>
            <Flat color={L.gold} />
          </mesh>
        </Sway>
      </Sway>
    </group>
  )
}

export function Torii({ look = 'vermilion' }) {
  const L = LOOKS[look] || LOOKS.vermilion
  const { tap, handlers, clock } = useTap(1.4)
  const lamp = useRef()
  const petals = useRef([])
  const ground = useGeo(() => terrainGeo({ radius: 1.7, height: 0.05, seed: 6, rings: 4, segs: 16, rough: 0.3, profile: 'dome', bands: [[0, L.ground]] }), [look])
  const geo = useGeo(
    () => ({
      post: facet(new THREE.CylinderGeometry(0.058, 0.07, POST_H, 8, 2).translate(0, POST_H / 2, 0), 0.004, 2, [1, 0, 1]),
      band: new THREE.CylinderGeometry(0.078, 0.08, 0.14, 8),
      footing: facet(new THREE.CylinderGeometry(0.1, 0.12, 0.08, 8), 0.006, 3),
      plinth: facet(new THREE.BoxGeometry(0.3, 0.07, 0.3), 0.01, 4),
      nuki: facet(new THREE.BoxGeometry(1.66, 0.075, 0.07), 0.004, 5),
      shimaki: facet(new THREE.BoxGeometry(1.86, 0.06, 0.1), 0.004, 6),
      kasagi: new THREE.ExtrudeGeometry(beamShape(KASA_Y, KASA_Y + 0.085), { depth: 0.14, bevelEnabled: false }).translate(0, 0, -0.07),
      cap: new THREE.ExtrudeGeometry(beamShape(KASA_Y + 0.085, KASA_Y + 0.12, 1.08 + 0.03, 0.025), { depth: 0.16, bevelEnabled: false }).translate(0, 0, -0.08),
      strut: new THREE.BoxGeometry(0.06, SHIMA_Y - NUKI_Y, 0.05),
      plaque: new THREE.BoxGeometry(0.19, 0.24, 0.04),
      plaqueIn: new THREE.BoxGeometry(0.14, 0.19, 0.01),
      lantern: lanternGeometry(),
      lidTop: new THREE.CylinderGeometry(0.052, 0.052, 0.022, 8),
      cord: new THREE.CylinderGeometry(0.006, 0.006, 0.12, 4),
      tassel: new THREE.ConeGeometry(0.02, 0.05, 5).rotateX(Math.PI),
      stone: facet(new THREE.CylinderGeometry(1, 1.05, 1, 7), 0.06, 8),
      trunk: facet(new THREE.CylinderGeometry(0.035, 0.06, 0.7, 6).translate(0, 0.35, 0), 0.006, 12),
      canopy: blob(0.26, 13),
      petal: petalGeometry(),
      hit: new THREE.BoxGeometry(1.5, 1.75, 0.3).translate(0, 0.875, 0),
    }),
    [],
  )
  // each petal of the gust: when it sets off, its height, radius and spin
  const P = useMemo(() => {
    const r = rng(23)
    return Array.from({ length: PETALS }, (_, i) => ({ d: r() * 0.45, h: 0.35 + r() * 1.05, rad: 0.25 + r() * 0.4, ph: r() * TAU, sp: [(r() - 0.5) * 14, (r() - 0.5) * 10, (r() - 0.5) * 8], s: 0.055 + r() * 0.03, c: i }))
  }, [])

  useFrame(() => {
    const t = clock.elapsedTime
    if (lamp.current) lamp.current.intensity = 0.7 + pulse(t, 0.35) * 0.4
    // the gust: petals spiral in from behind, through the gate and out front
    const s = tap.since(t)
    P.forEach((p, i) => {
      const m = petals.current[i]
      if (!m) return
      const u = (s - p.d) / GUST
      m.visible = u > 0 && u < 1
      if (!m.visible) return
      const a = p.ph + u * TAU * 1.4
      const w = p.rad * (0.5 + u * 0.9)
      m.position.set(Math.cos(a) * w + Math.sin(u * 3) * 0.2, p.h + Math.sin(a) * w * 0.6 + u * 0.2, -1.25 + u * 3.3)
      m.rotation.set(u * p.sp[0], u * p.sp[1], u * p.sp[2])
      m.scale.setScalar(p.s * Math.min(1, u * 8, (1 - u) * 6))
    })
  })

  const drift = look === 'spring' || look === 'autumn'
  return (
    <group {...handlers}>
      {/* the ground, and stepping stones running through the gate */}
      <mesh geometry={ground}>
        <Flat vertexColors color="#ffffff" roughness={0.95} />
      </mesh>
      {[-1.15, -0.45, 0.3, 1.05].map((z, i) => (
        <mesh key={z} geometry={geo.stone} position={[(i % 2 ? 0.05 : -0.05), 0.04, z]} scale={[0.2, 0.04, 0.17]} rotation-y={i}>
          <Flat color={L.stone} />
        </mesh>
      ))}
      {/* the posts, on footings, with bands at their feet */}
      {[-1, 1].map((sx) => (
        <group key={sx} position-x={sx * PX}>
          <mesh geometry={geo.plinth} position-y={0.06}>
            <Flat color={L.stone} />
          </mesh>
          <mesh geometry={geo.footing} position-y={0.13}>
            <Flat color={L.stone} />
          </mesh>
          <mesh geometry={geo.post} position-y={0.1}>
            <Flat color={L.wood} roughness={0.6} />
          </mesh>
          <mesh geometry={geo.band} position-y={0.24}>
            <Flat color={L.band} />
          </mesh>
        </group>
      ))}
      {/* the tie beam, the tablet and the beams on top */}
      <mesh geometry={geo.nuki} position-y={NUKI_Y}>
        <Flat color={L.wood} roughness={0.6} />
      </mesh>
      <mesh geometry={geo.strut} position-y={(NUKI_Y + SHIMA_Y) / 2}>
        <Flat color={L.wood} roughness={0.6} />
      </mesh>
      <group position={[0, (NUKI_Y + SHIMA_Y) / 2, 0.045]}>
        <mesh geometry={geo.plaque}>
          <Flat color={L.gold} roughness={0.5} metalness={0.3} />
        </mesh>
        {[-1, 1].map((sz) => (
          <mesh key={sz} geometry={geo.plaqueIn} position-z={sz * 0.02}>
            <Flat color={L.plaque} />
          </mesh>
        ))}
      </group>
      <mesh geometry={geo.shimaki} position-y={SHIMA_Y}>
        <Flat color={L.wood} roughness={0.6} />
      </mesh>
      <mesh geometry={geo.kasagi}>
        <Flat color={L.wood} roughness={0.6} />
      </mesh>
      <mesh geometry={geo.cap}>
        <Flat color={L.cap} roughness={0.55} />
      </mesh>
      {/* the lanterns and their glow */}
      <Lantern L={L} geo={geo} tap={tap} x={-0.3} phase={0} />
      <Lantern L={L} geo={geo} tap={tap} x={0.3} phase={2.1} />
      <pointLight ref={lamp} position={[0, NUKI_Y - 0.3, 0.25]} color={L.glow} distance={2.4} decay={1.8} />
      {/* a small tree to one side */}
      <group position={[1.18, 0.02, -0.55]}>
        <mesh geometry={geo.trunk} rotation-z={0.08}>
          <Flat color={L.trunk} />
        </mesh>
        <mesh geometry={geo.canopy} position={[0.03, 0.78, 0]} scale={[1.2, 0.85, 1.1]}>
          <Flat color={L.leaf[0]} />
        </mesh>
        <mesh geometry={geo.canopy} position={[-0.14, 0.66, 0.08]} scale={0.75}>
          <Flat color={L.leaf[1]} />
        </mesh>
        <mesh geometry={geo.canopy} position={[0.17, 0.64, -0.06]} scale={0.7}>
          <Flat color={L.leaf[1]} />
        </mesh>
      </group>
      {drift && <Particles count={7} life={4} origin={[1.18, 0.9, -0.55]} spread={0.25} velocity={[-0.15, -0.2, 0.08]} scatter={0.08} drift={0.25} size={[0.035, 0.03]} colors={L.petals} opacity={[1, 0]} geometry={geo.petal} spin={2.5} seed={4} />}
      {/* the gust of petals */}
      {P.map((p, i) => (
        <mesh key={i} ref={(el) => (petals.current[i] = el)} geometry={geo.petal} visible={false}>
          <Flat color={L.petals[i % L.petals.length]} emissive={L.petals[i % L.petals.length]} emissiveIntensity={0.15} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* an invisible pane across the gateway, so a tap through it lands */}
      <mesh geometry={geo.hit}>
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}

export default function ToriiScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.2, 2.1, 4.4]} target={[0, 0.9, 0]} hint="The paper lanterns sway on their cords and glow softly on their own · tap the gate and a swirl of petals blows through it · Look swaps vermilion, black, spring and autumn · drag to orbit">
      <Torii {...props} />
    </Stage>
  )
}

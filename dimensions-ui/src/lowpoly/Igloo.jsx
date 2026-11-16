import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Stage, TAU, blob, cone, facet, rng, terrainGeo, useGeo, useTap } from './kit.jsx'

// A low-poly igloo on a drift of snow: a dome laid up from rows of faceted
// snow blocks, each row offset half a block from the one below so the seams
// show, a cap block on top, and a low arched tunnel leading in at the front.
// Left alone, snow drifts down round it and melts away into the drift. Tap
// it and a penguin pokes its head out of the tunnel, looks left, looks
// right, and ducks back inside.

const LOOKS = {
  day: { block: ['#eef4fa', '#e2ecf5', '#f8fbfd'], seam: '#9fb6cf', ground: '#f2f7fb', hole: '#24364e', glow: 0, light: '#ffffff', flake: '#ffffff' },
  dawn: { block: ['#fbeee9', '#f4dfda', '#fff6f2'], seam: '#c99aa8', ground: '#fcefea', hole: '#4a2f48', glow: 0, light: '#ffab80', flake: '#fff3ee' },
  night: { block: ['#c3cdea', '#b4c0e0', '#d0daf2'], seam: '#5f6e9c', ground: '#c6d0ec', hole: '#ffad45', glow: 1, light: '#ffa340', flake: '#eef2ff' },
  blue: { block: ['#cbe8fb', '#b2daf4', '#e0f3ff'], seam: '#5f9cc9', ground: '#e0f1fc', hole: '#1d3a58', glow: 0, light: '#bfe4ff', flake: '#ffffff' },
}

const RD = 0.82 // dome radius
const ROWS = 6
const TOP = Math.PI / 2 - 0.2 // latitude where the cap block takes over
const BASE = 0.04 // the dome sits on the drift
const TR = 0.36 // tunnel arch radius (to the middle of the blocks)
const MOUTH = RD + 0.4 // z of the tunnel mouth
const PEEK = 2.6 // seconds the penguin stays out

// Every block of the dome: where it sits, how it turns and how big it is.
function domeBlocks() {
  const r = rng(5)
  const o = new THREE.Object3D()
  const out = []
  const h = (RD * TOP) / ROWS
  for (let k = 0; k < ROWS; k++) {
    const lat = ((k + 0.5) / ROWS) * TOP
    const n = Math.max(6, Math.round(Math.cos(lat) * 17))
    for (let j = 0; j < n; j++) {
      const az = ((j + (k % 2) * 0.5) / n) * TAU
      o.position.set(Math.cos(lat) * Math.sin(az) * RD, Math.sin(lat) * RD + BASE, Math.cos(lat) * Math.cos(az) * RD)
      o.lookAt(o.position.x * 2, (o.position.y - BASE) * 2 + BASE, o.position.z * 2)
      out.push({ p: o.position.toArray(), q: o.quaternion.clone(), s: [((TAU * RD * Math.cos(lat)) / n) * 0.93, h * 0.9, 0.15], v: Math.floor(r() * 3), c: Math.floor(r() * 3) })
    }
  }
  return out
}

// A falling flake per entry: where it drops, how fast, and its phase.
function flakes(n) {
  const r = rng(31)
  return Array.from({ length: n }, () => {
    const a = r() * TAU
    const d = Math.sqrt(r()) * 1.65
    return { x: Math.cos(a) * d, z: Math.sin(a) * d, v: 0.25 + r() * 0.2, off: r() * 10, ph: r() * TAU, s: 0.018 + r() * 0.018 }
  })
}

// The penguin peeking out: a black head, a white face, an orange beak and
// two beady eyes, looking along +z.
function PenguinHead({ geo }) {
  return (
    <group>
      <mesh geometry={geo.pHead}>
        <Flat color="#23242c" roughness={0.6} />
      </mesh>
      <mesh geometry={geo.pFace} position={[0, -0.015, 0.062]}>
        <Flat color="#f6f4ef" />
      </mesh>
      <mesh geometry={geo.beak} position={[0, -0.02, 0.15]} rotation-x={Math.PI / 2}>
        <Flat color="#ff9a26" />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.052, 0.035, 0.122]}>
          <mesh geometry={geo.eye} scale={0.024}>
            <Flat color="#ffffff" roughness={0.4} />
          </mesh>
          <mesh geometry={geo.eye} position-z={0.014} scale={0.014}>
            <Flat color="#15151b" roughness={0.3} />
          </mesh>
        </group>
      ))}
      {/* a black shoulder below the head */}
      <mesh geometry={geo.pBody} position={[0, -0.15, -0.03]}>
        <Flat color="#23242c" roughness={0.6} />
      </mesh>
    </group>
  )
}

const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u))

export function Igloo({ look = 'day' }) {
  const L = LOOKS[look] || LOOKS.day
  const { tap, handlers, clock } = useTap(1.5)
  const peng = useRef()
  const lamp = useRef()
  const hole = useRef()
  const snow = useRef([])
  const blocks = useMemo(domeBlocks, [])
  const F = useMemo(() => flakes(46), [])
  const ground = useGeo(() => terrainGeo({ radius: 1.75, height: 0.09, seed: 4, rings: 4, segs: 16, rough: 0.25, profile: 'dome', bands: [[0, L.ground]] }), [look])
  const geo = useGeo(
    () => ({
      block: [0, 1, 2].map((i) => facet(new THREE.BoxGeometry(1, 1, 1, 1, 1, 1), 0.05, 10 + i)),
      cap: facet(new THREE.SphereGeometry(RD * Math.cos(TOP) + 0.05, 8, 3, 0, TAU, 0, Math.PI / 2).scale(1, 0.55, 1), 0.012, 3),
      inner: new THREE.SphereGeometry(RD - 0.05, 16, 6, 0, TAU, 0, Math.PI / 2),
      tunnel: new THREE.CylinderGeometry(TR - 0.04, TR - 0.04, MOUTH - RD * 0.6, 10, 1, true, Math.PI / 2, Math.PI).rotateX(Math.PI / 2),
      hole: new THREE.CircleGeometry(TR - 0.05, 10, 0, Math.PI),
      flake: new THREE.OctahedronGeometry(1, 0),
      pHead: facet(new THREE.IcosahedronGeometry(0.13, 1).scale(1, 1.05, 0.95), 0.008, 41),
      pFace: facet(new THREE.IcosahedronGeometry(0.1, 1).scale(0.95, 0.9, 0.6), 0.006, 42),
      pBody: blob(0.15, 43),
      beak: cone(0.035, 0.08, 5, 44),
      eye: new THREE.IcosahedronGeometry(1, 0),
      puff: new THREE.IcosahedronGeometry(1, 0),
      hit: new THREE.SphereGeometry(RD + 0.05, 10, 5, 0, TAU, 0, Math.PI / 2),
    }),
    [],
  )
  // the tunnel: three rings of five arch blocks each
  const len = MOUTH - RD * 0.62
  const arch = useMemo(() => {
    const out = []
    for (let k = 0; k < 3; k++)
      for (let j = 0; j < 5; j++) {
        const phi = ((j + 0.5) / 5) * Math.PI
        out.push({ p: [Math.cos(phi) * TR, Math.sin(phi) * TR + BASE * 0.5, RD * 0.62 + ((k + 0.5) / 3) * len], rz: phi - Math.PI / 2, s: [((Math.PI * TR) / 5) * 0.92, 0.13, (len / 3) * 0.92], v: (j + k) % 3, c: (j * 2 + k) % 3 })
      }
    return out
  }, [len])

  useFrame(() => {
    const t = clock.elapsedTime
    // snow: each flake drops, swaying, and shrinks away as it lands
    F.forEach((f, i) => {
      const m = snow.current[i]
      if (!m) return
      const y = 2.5 - ((t * f.v + f.off) % 2.5)
      m.position.set(f.x + Math.sin(t * 0.9 + f.ph) * 0.08, y, f.z + Math.cos(t * 0.7 + f.ph) * 0.08)
      m.rotation.set(t + f.ph, t * 0.7, 0)
      m.scale.setScalar(f.s * Math.min(1, y / 0.25 + 0.05, (2.5 - y) / 0.2))
    })
    // the glow from inside on a winter night
    if (lamp.current) lamp.current.intensity = L.glow * (1.6 + 0.25 * Math.sin(t * 7) + 0.15 * Math.sin(t * 13))
    if (hole.current) hole.current.material.emissiveIntensity = L.glow * (1.1 + 0.15 * Math.sin(t * 7))
    // the penguin: out, a look left, a look right, and back in
    const s = tap.since(t)
    const p = peng.current
    p.visible = s >= 0 && s < PEEK
    if (p.visible) {
      const out = ease(s / 0.4) * (1 - ease((s - (PEEK - 0.45)) / 0.4))
      p.position.set(0, 0.17 + out * 0.04 + Math.max(0, Math.sin(s * 14)) * 0.012 * (1 - out * 0.5), MOUTH - 0.42 + out * 0.5)
      const look = s > 0.45 && s < 2.05 ? Math.sin(((s - 0.45) / 1.6) * TAU) : 0
      p.rotation.set(-0.08 * out + Math.sin(s * 3) * 0.04, look * 0.75, look * 0.12)
    }
  })

  return (
    <group {...handlers}>
      {/* the snow drift */}
      <mesh geometry={ground}>
        <Flat vertexColors color="#ffffff" roughness={0.95} />
      </mesh>
      {/* the dome: seams show as the darker shell behind the blocks */}
      <mesh geometry={geo.inner} position-y={BASE}>
        <Flat color={L.seam} />
      </mesh>
      {blocks.map((b, i) => (
        <mesh key={i} geometry={geo.block[b.v]} position={b.p} quaternion={b.q} scale={b.s}>
          <Flat color={L.block[b.c]} roughness={0.7} />
        </mesh>
      ))}
      <mesh geometry={geo.cap} position-y={BASE + RD * Math.sin(TOP) - 0.02}>
        <Flat color={L.block[2]} roughness={0.7} />
      </mesh>
      {/* the tunnel: an arch of blocks, a seam shell inside, a dark way in */}
      <mesh geometry={geo.tunnel} position={[0, BASE * 0.5, RD * 0.6 + (MOUTH - RD * 0.6) / 2]}>
        <Flat color={L.seam} side={THREE.DoubleSide} />
      </mesh>
      {arch.map((b, i) => (
        <mesh key={i} geometry={geo.block[b.v]} position={b.p} rotation-z={b.rz} scale={b.s}>
          <Flat color={L.block[b.c]} roughness={0.7} />
        </mesh>
      ))}
      <mesh ref={hole} geometry={geo.hole} position={[0, BASE * 0.5, MOUTH - 0.14]}>
        <Flat color={L.hole} emissive={L.hole} emissiveIntensity={L.glow} />
      </mesh>
      {L.glow > 0 && <pointLight ref={lamp} position={[0, 0.2, MOUTH + 0.25]} color={L.light} distance={2.6} decay={1.8} />}
      {/* the penguin, hidden in the tunnel until a tap */}
      <group ref={peng} visible={false}>
        <PenguinHead geo={geo} />
      </group>
      <Burst tap={tap} geometry={geo.puff} count={9} colors={[L.flake, L.block[1]]} speed={0.9} gravity={2.2} size={0.035} life={0.8} origin={[0, 0.12, MOUTH + 0.05]} spread={0.9} up={0.8} />
      {/* falling snow */}
      {F.map((f, i) => (
        <mesh key={i} ref={(el) => (snow.current[i] = el)} geometry={geo.flake}>
          <Flat color={L.flake} emissive={L.flake} emissiveIntensity={0.25} />
        </mesh>
      ))}
      {/* a sun-coloured wash for dawn */}
      {look === 'dawn' && <directionalLight position={[-4, 1.5, 3]} intensity={0.9} color={L.light} />}
      <mesh geometry={geo.hit} position-y={BASE}>
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}

export default function IglooScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.1, 2.1, 4.1]} target={[0, 0.5, 0]} hint="Snow drifts down round the igloo on its own · tap it and a penguin pokes its head out of the tunnel, looks left and right, and ducks back in · Look swaps day, dawn, night and blue · drag to orbit">
      <Igloo {...props} />
    </Stage>
  )
}

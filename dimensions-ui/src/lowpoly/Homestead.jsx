import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Particles, Stage, Sway, blob, cone, facet, rng, useGeo, useKick, useTap } from './kit.jsx'

// A low-poly homestead on a floating diorama: an L-shaped plot of grass on a
// thick block of earth, a cottage with a red gable roof, a smoking chimney,
// shuttered windows and a porch under a striped awning. Round it: a split-rail
// fence, a log pile, chopping blocks with axes, rocks and tufts, pines down
// the front arm of the plot, and a stream running between the plot and a
// little islet of pines, crossed by a plank bridge. Clouds drift overhead.
// Smoke curls from the chimney, the stream flows and the pines stir. Tap it
// and the axe comes down on the chopping block: the log splits and flies
// apart, chips spray, and the chimney puffs.

const LOOKS = {
  summer: { grass: '#5cc24e', grass2: '#4fb244', soil: '#d8cfb8', band: '#c4b99c', roof: '#e2473a', roof2: '#c93a30', wall: '#e2bf86', timber: '#8a5a36', shutter: '#3f9a5a', pine: '#2f8a4a', pine2: '#3ca058', water: '#46c4d6', glass: '#9fd4ea', glow: 0, cloud: '#ffffff', awning: ['#e2473a', '#fbf4ea'] },
  autumn: { grass: '#a8b84a', grass2: '#98a640', soil: '#d8c8a8', band: '#c2ad88', roof: '#c2452e', roof2: '#a33a26', wall: '#e0b77a', timber: '#7a4c2c', shutter: '#b8682e', pine: '#3a7a44', pine2: '#d27a2a', water: '#3fb0c4', glass: '#a6cfe0', glow: 0.15, cloud: '#fdf6ec', awning: ['#d2632e', '#fbf0de'] },
  winter: { grass: '#eef3f8', grass2: '#e0e8f0', soil: '#cfd2d6', band: '#b9bec5', roof: '#d8463a', roof2: '#bf3a30', wall: '#e4c48e', timber: '#7a5034', shutter: '#3a7ab0', pine: '#2a6a48', pine2: '#e8eef4', water: '#7ccbe0', glass: '#ffd98a', glow: 0.7, cloud: '#ffffff', awning: ['#d8463a', '#ffffff'] },
  evening: { grass: '#4aa848', grass2: '#3f963e', soil: '#c9bea4', band: '#b2a68a', roof: '#c8443c', roof2: '#a9372f', wall: '#d8b27a', timber: '#704a2e', shutter: '#367f52', pine: '#26703f', pine2: '#2f844b', water: '#3a9fc4', glass: '#ffcf7a', glow: 1.4, cloud: '#ffe2d0', awning: ['#c8443c', '#f6e9dc'] },
}

const Y = 1.0 // the grass surface
const BASE = 0.32 // the foot of the earth block
const GRASS_T = 0.09
// the plots: the main plot, the arm that runs toward the viewer, and the islet across the stream
const PLOTS = [
  [-1.7, 0.7, -1.2, 0.35],
  [-0.55, 0.7, 0.35, 1.3],
  [1.02, 1.9, -0.78, 0.48],
]
const STREAM = [0.7, 1.02, -0.78, 0.48]
const WATER_Y = Y - 0.17

// the house
const H = { x: -0.45, z: -0.62, w: 1.0, d: 0.62, h: 0.5, roofH: 0.36, eave: 0.12 }
const CHOP = [-0.86, 0.16]
const LOGS = [-1.37, 0.15] // the log pile, lying along x
const STUMP2 = [-0.58, -0.06]
const FENCE_X = -1.645
const FENCE_Z = -1.15 // chopping block with the log on it

// a gable: the triangle under the roof, and the roof itself as two slanted slabs
function gableGeo(w, d, h) {
  const s = new THREE.Shape()
  s.moveTo(-d / 2, 0)
  s.lineTo(d / 2, 0)
  s.lineTo(0, h)
  s.closePath()
  return new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false }).translate(0, 0, -w / 2).rotateY(Math.PI / 2)
}
function roofGeo(w, d, h, t) {
  const half = d / 2
  const len = Math.hypot(half, h)
  const a = Math.atan2(h, half)
  const slab = (side) => {
    const g = new THREE.BoxGeometry(w, t, len)
    g.rotateX(-side * a)
    g.translate(0, h / 2 + t * 0.4, (-side * half) / 2)
    return g
  }
  return [slab(1), slab(-1)]
}

const PINES = [
  [-0.25, 1.0, 1.0],
  [0.02, 1.15, 0.8],
  [0.22, 0.66, 1.1],
  [0.45, 1.05, 0.8],
  [1.5, -0.42, 1.05],
  [1.68, 0.1, 0.85],
  [1.28, 0.28, 0.7],
  [1.72, -0.62, 0.6],
  [0.45, -0.95, 0.75],
]
const ROCKS = [
  [0.12, 0.2, 0.08],
  [-0.12, 0.6, 0.07],
  [0.5, 0.25, 0.06],
  [-0.25, -1.08, 0.06],
  [1.2, -0.55, 0.06],
  [0.22, -1.13, 0.06],
]
const TUFTS = Array.from({ length: 22 }, (_, i) => {
  const r = rng(40 + i)
  const p = PLOTS[i % 3 === 2 ? 2 : i % 2]
  return [p[0] + 0.08 + r() * (p[1] - p[0] - 0.16), p[2] + 0.08 + r() * (p[3] - p[2] - 0.16)]
}).filter(([x, z]) => !(x > H.x - 1.15 && x < H.x + 0.7 && z > H.z - 0.45 && z < H.z + 0.45) && !(x < -0.6 && z > -0.25) && !(x < -1.5))

function Pine({ geo, L, x, z, s, i }) {
  return (
    <group position={[x, Y, z]} scale={s}>
      <mesh geometry={geo.trunk}>
        <Flat color="#6a4430" />
      </mesh>
      <Sway rate={0.3} amp={0.03} i={i}>
        <mesh geometry={geo.pineA} position-y={0.07}>
          <Flat color={L.pine} />
        </mesh>
        <mesh geometry={geo.pineB} position-y={0.22}>
          <Flat color={L.pine2} />
        </mesh>
        <mesh geometry={geo.pineC} position-y={0.36}>
          <Flat color={L.pine} />
        </mesh>
      </Sway>
    </group>
  )
}

function Cloud({ geo, color, x, y, z, s, phase }) {
  const g = useRef()
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase
    g.current.position.set(x + Math.sin(t * 0.12) * 0.35, y + Math.sin(t * 0.5) * 0.05, z)
  })
  return (
    <group ref={g} scale={s}>
      {[
        [0, 0, 0, 0.28],
        [0.26, -0.05, 0.04, 0.22],
        [-0.25, -0.06, -0.02, 0.2],
        [0.08, 0.14, -0.04, 0.2],
      ].map(([a, b, c, r], k) => (
        <mesh key={k} geometry={geo.puff} position={[a, b, c]} scale={r}>
          <Flat color={color} emissive={color} emissiveIntensity={0.15} />
        </mesh>
      ))}
    </group>
  )
}

export function Homestead({ look = 'summer' }) {
  const L = LOOKS[look] || LOOKS.summer
  const { tap, handlers, clock } = useTap(1.5)
  const hit = useKick(3)
  const struck = useRef(-99)
  const axe = useRef()
  const halves = useRef([])
  const ripples = useRef([])

  const geo = useGeo(() => {
    const roof = roofGeo(H.w + H.eave * 2, H.d + H.eave * 2, H.roofH, 0.06)
    return {
      puff: facet(new THREE.IcosahedronGeometry(1, 1), 0.06, 3),
      trunk: new THREE.CylinderGeometry(0.03, 0.045, 0.12, 6).translate(0, 0.06, 0),
      pineA: cone(0.2, 0.26, 7, 1),
      pineB: cone(0.15, 0.22, 7, 2),
      pineC: cone(0.1, 0.2, 7, 3),
      gable: gableGeo(H.w, H.d, H.roofH),
      roofA: roof[0],
      roofB: roof[1],
      log: new THREE.CylinderGeometry(0.055, 0.055, 0.5, 8).rotateX(Math.PI / 2),
      halfLog: new THREE.CylinderGeometry(0.06, 0.06, 0.16, 8, 1, false, 0, Math.PI),
      stump: facet(new THREE.CylinderGeometry(0.11, 0.13, 0.13, 9), 0.008, 5),
      ring: new THREE.CircleGeometry(0.1, 9).rotateX(-Math.PI / 2),
      rock: blob(1, 7),
      tuft: cone(0.035, 0.08, 4, 9),
      chip: new THREE.BoxGeometry(1, 0.4, 0.7),
    }
  }, [])

  // split-rail fence posts round the back-left corner
  const fence = useMemo(() => {
    const posts = []
    for (let z = FENCE_Z; z <= 0.3; z += 0.29) posts.push([FENCE_X, z])
    for (let x = FENCE_X + 0.3; x <= -0.95; x += 0.3) posts.push([x, FENCE_Z])
    return posts
  }, [])

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    // the axe: swings back, then comes down on the log at 0.38 s
    const REST = 0.75 // the blade resting in the log
    const BACK = -1.3
    let a = REST
    if (s >= 0 && s < 0.3) a = REST + (BACK - REST) * Math.sin((s / 0.3) * (Math.PI / 2))
    else if (s >= 0.3 && s < 0.38) a = BACK + ((s - 0.3) / 0.08) * (REST - BACK)
    else if (s >= 0.38 && s < 2.6) a = REST + Math.exp(-(s - 0.38) * 9) * Math.sin((s - 0.38) * 40) * 0.1
    axe.current.rotation.z = a
    if (s >= 0.38 && s < 1 && struck.current !== tap.since(0)) {
      struck.current = tap.since(0)
      hit.kick(t)
    }
    // the log: split halves fly apart, then a fresh log is back on the block
    const h = hit.since(t)
    const split = h >= 0 && h < 2.2
    halves.current.forEach((m, k) => {
      if (!m) return
      const side = k ? 1 : -1
      if (split) {
        const u = Math.min(h, 0.6)
        m.position.set(side * (0.03 + u * 0.55), 0.21 + u * 0.9 - u * u * 1.8 + (h > 0.6 ? 0 : 0), side * u * 0.12)
        if (h >= 0.6) m.position.y = Math.max(0.03, m.position.y)
        m.rotation.set(0, k ? Math.PI : 0, side * Math.min(h * 6, Math.PI / 2))
        m.scale.setScalar(h > 1.8 ? Math.max(0.001, (2.2 - h) / 0.4) : 1)
      } else {
        const grow = h >= 2.2 && h < 2.5 ? (h - 2.2) / 0.3 : 1
        m.position.set(0, 0.21, 0)
        m.rotation.set(0, k ? Math.PI : 0, 0)
        m.scale.setScalar(Math.max(0.001, grow))
      }
    })
    // the stream: ripple lines carried along it
    ripples.current.forEach((m, k) => {
      if (!m) return
      const u = (t * 0.12 + k / ripples.current.length) % 1
      m.position.z = STREAM[2] + 0.06 + u * (STREAM[3] - STREAM[2] - 0.12)
      m.material.opacity = 0.5 * Math.sin(u * Math.PI)
    })
  })

  const roofTop = Y + H.h + H.roofH
  const chimney = [H.x + 0.24, roofTop - 0.12, H.z - 0.12]
  return (
    <group {...handlers}>
      {/* the plots: grass on a block of earth with a darker band through it */}
      {PLOTS.map(([x0, x1, z0, z1], k) => {
        const w = x1 - x0
        const d = z1 - z0
        const cx = (x0 + x1) / 2
        const cz = (z0 + z1) / 2
        return (
          <group key={k} position={[cx, 0, cz]}>
            <mesh position-y={Y - GRASS_T / 2}>
              <boxGeometry args={[w + 0.03, GRASS_T, d + 0.03]} />
              <Flat color={k === 2 ? L.grass2 : L.grass} />
            </mesh>
            <mesh position-y={(Y - GRASS_T + BASE) / 2}>
              <boxGeometry args={[w, Y - GRASS_T - BASE, d]} />
              <Flat color={L.soil} />
            </mesh>
            <mesh position-y={BASE + 0.16}>
              <boxGeometry args={[w + 0.008, 0.06, d + 0.008]} />
              <Flat color={L.band} />
            </mesh>
          </group>
        )
      })}
      {/* the stream between the plot and the islet */}
      <group position={[(STREAM[0] + STREAM[1]) / 2, 0, (STREAM[2] + STREAM[3]) / 2]}>
        <mesh position-y={(WATER_Y + BASE + 0.06) / 2}>
          <boxGeometry args={[STREAM[1] - STREAM[0], WATER_Y - BASE - 0.06, STREAM[3] - STREAM[2]]} />
          <Flat color={L.water} transparent opacity={0.88} roughness={0.25} />
        </mesh>
        {[0, 1, 2, 3].map((k) => (
          <mesh key={k} ref={(el) => (ripples.current[k] = el)} position={[(k % 2 ? 0.05 : -0.05), WATER_Y + 0.002, 0]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[0.16, 0.025]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.4} depthWrite={false} />
          </mesh>
        ))}
      </group>
      {/* the bridge over the stream */}
      <group position={[(STREAM[0] + STREAM[1]) / 2, Y + 0.02, -0.42]}>
        {Array.from({ length: 6 }, (_, k) => (
          <mesh key={k} position={[-0.21 + k * 0.084, 0, 0]}>
            <boxGeometry args={[0.075, 0.035, 0.3]} />
            <Flat color={k % 2 ? '#b98a56' : '#a87a48'} />
          </mesh>
        ))}
        {[-1, 1].map((s) => (
          <group key={s} position-z={s * 0.15}>
            {[-0.22, 0, 0.22].map((x) => (
              <mesh key={x} position={[x, 0.09, 0]}>
                <boxGeometry args={[0.03, 0.18, 0.03]} />
                <Flat color="#8a5e38" />
              </mesh>
            ))}
            <mesh position-y={0.17}>
              <boxGeometry args={[0.5, 0.025, 0.025]} />
              <Flat color="#a87a48" />
            </mesh>
          </group>
        ))}
      </group>
      {/* stepping stones from the door to the bridge */}
      {[
        [-0.1, -0.18],
        [0.15, -0.28],
        [0.42, -0.38],
      ].map(([x, z], k) => (
        <mesh key={k} position={[x, Y + 0.008, z]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.07, 7]} />
          <Flat color="#c9c4ba" />
        </mesh>
      ))}

      {/* the cottage */}
      <group position={[H.x, Y, H.z]}>
        {/* stone footing, walls and corner timbers */}
        <mesh position-y={0.04}>
          <boxGeometry args={[H.w + 0.04, 0.08, H.d + 0.04]} />
          <Flat color="#b8ad98" />
        </mesh>
        <mesh position-y={H.h / 2 + 0.04}>
          <boxGeometry args={[H.w, H.h - 0.08, H.d]} />
          <Flat color={L.wall} />
        </mesh>
        {[-1, 1].map((sx) =>
          [-1, 1].map((sz) => (
            <mesh key={`${sx}${sz}`} position={[(sx * H.w) / 2, H.h / 2, (sz * H.d) / 2]}>
              <boxGeometry args={[0.05, H.h, 0.05]} />
              <Flat color={L.timber} />
            </mesh>
          )),
        )}
        <mesh position-y={H.h - 0.02}>
          <boxGeometry args={[H.w + 0.03, 0.04, H.d + 0.03]} />
          <Flat color={L.timber} />
        </mesh>
        {/* gable ends and roof */}
        <mesh geometry={geo.gable} position-y={H.h}>
          <Flat color={L.wall} />
        </mesh>
        <group position-y={H.h - 0.01}>
          <mesh geometry={geo.roofA}>
            <Flat color={L.roof} />
          </mesh>
          <mesh geometry={geo.roofB}>
            <Flat color={L.roof2} />
          </mesh>
          <mesh position-y={H.roofH + 0.03}>
            <boxGeometry args={[H.w + H.eave * 2 + 0.02, 0.05, 0.07]} />
            <Flat color={L.roof2} />
          </mesh>
        </group>
        {/* door, windows with shutters, window boxes */}
        <mesh position={[0.16, 0.2, H.d / 2 + 0.012]}>
          <boxGeometry args={[0.16, 0.32, 0.02]} />
          <Flat color={L.timber} />
        </mesh>
        {[-0.24, 0.38].map((x) => (
          <group key={x} position={[x, 0.28, H.d / 2 + 0.012]}>
            <mesh>
              <boxGeometry args={[0.14, 0.14, 0.015]} />
              <Flat color={L.glass} emissive={L.glass} emissiveIntensity={L.glow} />
            </mesh>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[s * 0.1, 0, 0.005]}>
                <boxGeometry args={[0.06, 0.16, 0.015]} />
                <Flat color={L.shutter} />
              </mesh>
            ))}
            <mesh position={[0, -0.1, 0.02]}>
              <boxGeometry args={[0.18, 0.04, 0.05]} />
              <Flat color={L.timber} />
            </mesh>
            {[-0.06, 0, 0.06].map((fx, k) => (
              <mesh key={fx} geometry={geo.rock} position={[fx, -0.07, 0.025]} scale={0.022}>
                <Flat color={['#ff6a7a', '#ffd23f', '#ff8fd0'][k]} />
              </mesh>
            ))}
          </group>
        ))}
        {/* a side window on the right wall */}
        <mesh position={[H.w / 2 + 0.01, 0.28, 0]}>
          <boxGeometry args={[0.015, 0.13, 0.13]} />
          <Flat color={L.glass} emissive={L.glass} emissiveIntensity={L.glow} />
        </mesh>
        {/* chimney */}
        <mesh position={[0.24, H.h + H.roofH - 0.06, -0.12]}>
          <boxGeometry args={[0.13, 0.4, 0.13]} />
          <Flat color="#b45a3c" />
        </mesh>
        <mesh position={[0.24, H.h + H.roofH + 0.15, -0.12]}>
          <boxGeometry args={[0.16, 0.04, 0.16]} />
          <Flat color="#8a4430" />
        </mesh>
        {/* the porch on the left: deck, posts and a striped awning sloping away */}
        <group position={[-H.w / 2 - 0.27, 0, 0.02]}>
          <mesh position-y={0.025}>
            <boxGeometry args={[0.52, 0.05, H.d + 0.1]} />
            <Flat color="#b98a56" />
          </mesh>
          {[-1, 1].map((sz) => (
            <mesh key={sz} position={[-0.22, 0.19, (sz * (H.d + 0.02)) / 2]}>
              <boxGeometry args={[0.04, 0.34, 0.04]} />
              <Flat color={L.timber} />
            </mesh>
          ))}
          <group position={[0, 0.4, 0]} rotation-z={0.32}>
            {Array.from({ length: 8 }, (_, k) => (
              <mesh key={k} position={[0, 0, -H.d / 2 - 0.06 + (k + 0.5) * ((H.d + 0.12) / 8)]}>
                <boxGeometry args={[0.62, 0.025, (H.d + 0.12) / 8]} />
                <Flat color={L.awning[k % 2]} />
              </mesh>
            ))}
          </group>
          {/* a table and a bench under it */}
          <mesh position={[0.02, 0.15, 0.05]}>
            <boxGeometry args={[0.18, 0.025, 0.24]} />
            <Flat color="#a87a48" />
          </mesh>
          <mesh position={[0.02, 0.1, 0.05]}>
            <boxGeometry args={[0.03, 0.1, 0.03]} />
            <Flat color="#8a5e38" />
          </mesh>
          <mesh position={[-0.14, 0.09, 0.05]}>
            <boxGeometry args={[0.07, 0.025, 0.22]} />
            <Flat color="#a87a48" />
          </mesh>
          {L.glow > 0.5 && <pointLight position={[0, 0.3, 0.1]} color="#ffb860" intensity={0.8} distance={1.2} />}
        </group>
        {/* a little porch roof over the side door on the right */}
        <group position={[H.w / 2 + 0.11, 0, 0.18]}>
          <mesh position={[-0.098, 0.17, 0]}>
            <boxGeometry args={[0.012, 0.28, 0.14]} />
            <Flat color={L.timber} />
          </mesh>
          <mesh position={[0, 0.36, 0]} rotation-z={-0.4}>
            <boxGeometry args={[0.26, 0.025, 0.24]} />
            <Flat color={L.roof} />
          </mesh>
          <mesh position={[0.08, 0.17, 0.1]}>
            <boxGeometry args={[0.025, 0.34, 0.025]} />
            <Flat color={L.timber} />
          </mesh>
        </group>
      </group>
      <Particles geometry={geo.puff} count={12} life={3.4} origin={chimney.map((v, k) => (k === 1 ? v + 0.25 : v))} spread={0.03} velocity={[0.05, 0.3, 0]} scatter={0.05} drift={0.2} size={[0.035, 0.13]} colors={['#e4e4e8', '#cfcfd6']} opacity={[0.75, 0]} />
      <Burst tap={tap} geometry={geo.puff} count={8} colors={['#e4e4e8', '#d8d8de']} speed={0.5} gravity={-0.6} size={0.1} life={1.6} origin={[chimney[0], chimney[1] + 0.3, chimney[2]]} spread={0.6} />

      {/* fence */}
      {fence.map(([x, z], k) => (
        <mesh key={k} position={[x, Y + 0.12, z]}>
          <boxGeometry args={[0.045, 0.24, 0.045]} />
          <Flat color="#c9a46a" />
        </mesh>
      ))}
      {[0.1, 0.19].map((y) => (
        <group key={y}>
          <mesh position={[FENCE_X, Y + y, (FENCE_Z + 0.3) / 2]}>
            <boxGeometry args={[0.025, 0.035, 0.3 - FENCE_Z]} />
            <Flat color="#d8b47a" />
          </mesh>
          <mesh position={[(FENCE_X - 0.95) / 2, Y + y, FENCE_Z]}>
            <boxGeometry args={[-0.95 - FENCE_X, 0.035, 0.025]} />
            <Flat color="#d8b47a" />
          </mesh>
        </group>
      ))}
      {/* the log pile */}
      <group position={[LOGS[0], Y, LOGS[1]]}>
        {[
          [0, 0.055, -0.12],
          [0, 0.055, 0],
          [0, 0.055, 0.12],
          [0, 0.15, -0.06],
          [0, 0.15, 0.06],
          [0, 0.245, 0],
        ].map(([x, y, z], k) => (
          <group key={k} position={[x, y, z * 0.95]} rotation-y={Math.PI / 2}>
            <mesh geometry={geo.log}>
              <Flat color={k % 2 ? '#9a6a40' : '#8a5c36'} />
            </mesh>
          </group>
        ))}
      </group>
      {/* chopping blocks: one with the log and the working axe, one with an axe left in it */}
      <group position={[CHOP[0], Y, CHOP[1]]}>
        <mesh geometry={geo.stump} position-y={0.065}>
          <Flat color="#8a5c36" />
        </mesh>
        <mesh geometry={geo.ring} position-y={0.132}>
          <Flat color="#e2c08a" />
        </mesh>
        {[0, 1].map((k) => (
          <mesh key={k} ref={(el) => (halves.current[k] = el)} geometry={geo.halfLog} position-y={0.21}>
            <Flat color="#c9a06a" side={THREE.DoubleSide} />
          </mesh>
        ))}
        {/* the axe pivots at the near edge of the block */}
        <group ref={axe} position={[0.16, 0.14, 0]} rotation-z={0.75}>
          <mesh position={[0, 0.16, 0]} rotation-z={0.15}>
            <boxGeometry args={[0.028, 0.36, 0.028]} />
            <Flat color="#c9a06a" />
          </mesh>
          <mesh position={[-0.06, 0.32, 0]}>
            <boxGeometry args={[0.1, 0.07, 0.022]} />
            <meshStandardMaterial color="#9aa0a8" metalness={0.5} roughness={0.35} flatShading />
          </mesh>
        </group>
        <Burst tap={hit} geometry={geo.chip} count={12} colors={['#e2c08a', '#c9a06a', '#8a5c36']} speed={1.2} gravity={4} size={0.03} life={0.8} origin={[0, 0.2, 0]} spread={1} />
      </group>
      <group position={[STUMP2[0], Y, STUMP2[1]]}>
        <mesh geometry={geo.stump} position-y={0.065} scale={0.85}>
          <Flat color="#8a5c36" />
        </mesh>
        <mesh geometry={geo.ring} position-y={0.12} scale={0.85}>
          <Flat color="#e2c08a" />
        </mesh>
        <group position={[0.02, 0.13, 0]} rotation={[0, 0.6 + Math.PI, 0.5]}>
          <mesh position={[0.03, 0.15, 0]} rotation-z={0.15}>
            <boxGeometry args={[0.025, 0.32, 0.025]} />
            <Flat color="#c9a06a" />
          </mesh>
          <mesh position={[-0.02, 0.01, 0]}>
            <boxGeometry args={[0.09, 0.06, 0.02]} />
            <meshStandardMaterial color="#9aa0a8" metalness={0.5} roughness={0.35} flatShading />
          </mesh>
        </group>
      </group>
      {/* rocks, tufts and pines */}
      {ROCKS.map(([x, z, s], k) => (
        <mesh key={k} geometry={geo.rock} position={[x, Y + s * 0.4, z]} scale={[s * 1.3, s, s * 1.1]} rotation-y={k}>
          <Flat color={k % 2 ? '#c8c6c2' : '#b4b2ae'} />
        </mesh>
      ))}
      {TUFTS.map(([x, z], k) => (
        <mesh key={k} geometry={geo.tuft} position={[x, Y, z]}>
          <Flat color={L.pine} />
        </mesh>
      ))}
      {PINES.map(([x, z, s], i) => (
        <Pine key={i} geo={geo} L={L} x={x} z={z} s={s} i={i} />
      ))}
      {/* clouds */}
      <Cloud geo={geo} color={L.cloud} x={-1.2} y={2.75} z={-0.6} s={0.9} phase={0} />
      <Cloud geo={geo} color={L.cloud} x={0.9} y={2.95} z={-0.9} s={1.0} phase={2} />
      <Cloud geo={geo} color={L.cloud} x={1.7} y={2.45} z={0.2} s={0.6} phase={4} />
    </group>
  )
}

export default function HomesteadScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[4.6, 4.2, 6.2]} target={[0, 1.15, 0]} hint="Smoke curls from the chimney, the stream flows, the pines stir and the clouds drift · tap the homestead and the axe splits the log on the chopping block · Look swaps summer, autumn, winter and evening · drag to orbit">
      <Homestead {...props} />
    </Stage>
  )
}

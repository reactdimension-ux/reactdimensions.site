import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Particles, Stage, TAU, blob, cone, facet, rng, terrainGeo, useGeo, useTap } from './kit.jsx'

// A low-poly treehouse on a grassy mound: a big tree with a thick trunk,
// roots, branches and a lush canopy of faceted leaf clumps, holding a plank
// deck with a little hut on it (plank walls, a gabled roof, a door and
// windows), a railing round the porch and a rolled-up rope ladder at its
// edge. A rope swing with a plank seat hangs from a long low branch, and
// flowers and mushrooms dot the grass. Left alone, the swing sways like a
// pendulum, the canopy rustles and now and then a leaf drifts down. Tap it
// and the windows glow warm, a lamp comes on inside, the rope ladder unrolls
// rung by rung down to the grass and fireflies come out; after a few seconds
// the ladder rolls back up and the lights dim (at night the windows stay
// lit and the fireflies stay out).

const LOOKS = {
  summer: { grass: '#6cb84c', grass2: '#7cc456', leaves: ['#3f9a44', '#4aab4c', '#5cbc52'], trunk: '#7a5034', wood: '#c9955a', wood2: '#b5824a', roof: '#c8473a', roof2: '#a83a30', glass: '#9fcde0', flowers: ['#ff6a7a', '#ffd23f', '#ffffff'], night: false },
  autumn: { grass: '#a5ad4c', grass2: '#b6b656', leaves: ['#e0782a', '#d2502e', '#efb23a'], trunk: '#6e4630', wood: '#c48e56', wood2: '#ad7a46', roof: '#7a5a8a', roof2: '#634a72', glass: '#a6cfe0', flowers: ['#ffb23f', '#e8582e', '#fff2d0'], night: false },
  spring: { grass: '#7fcf5c', grass2: '#94dc6a', leaves: ['#8fd36a', '#f4a6c8', '#a8e07a'], trunk: '#82583a', wood: '#d6a468', wood2: '#c39156', roof: '#4f9ad8', roof2: '#3d82be', glass: '#a8d6ea', flowers: ['#ff8fd0', '#ffe35a', '#b48cff'], night: false },
  night: { grass: '#355e4a', grass2: '#3e6a52', leaves: ['#24503f', '#2c5c48', '#1f4637'], trunk: '#4a3428', wood: '#7a5a40', wood2: '#694c36', roof: '#5a3a4a', roof2: '#4a2f3d', glass: '#ffd27a', flowers: ['#c8b8ff', '#8fd0ff', '#fff2a0'], night: true },
}

const MOUND_R = 1.65
const MOUND_H = 0.22
const groundY = (x, z) => MOUND_H * Math.max(0, 1 - (Math.hypot(x, z) / MOUND_R) ** 2)
const DECK_Y = 0.76 // top of the deck
const DECK = [-0.48, 0.78, -0.42, 0.6] // x0, x1, z0, z1
const HUT = { x: 0.4, z: -0.08, w: 0.56, d: 0.5, h: 0.42, roofH: 0.26, eave: 0.08 }
const SWING = [-0.78, 1.36, 0.18] // the pivot under the swing branch
const ROPE = 1.0
const LADDER = [-0.26, DECK_Y - 0.02, DECK[3] + 0.02]
const LADDER_LEN = LADDER[1] - groundY(LADDER[0], LADDER[2]) - 0.02
const RUNGS = 7
const HOLD = 4.5 // seconds the ladder stays down

const CANOPY = [
  [0.05, 2.12, 0.0, 0.56],
  [-0.52, 1.92, 0.12, 0.42],
  [0.55, 1.98, -0.12, 0.44],
  [0.12, 1.94, 0.48, 0.4],
  [-0.12, 1.96, -0.5, 0.42],
  [0.28, 2.45, 0.12, 0.36],
  [-0.32, 2.36, -0.18, 0.34],
  [-0.62, 1.78, -0.32, 0.3],
  [0.62, 1.82, 0.36, 0.3],
]

function gableGeo(w, d, h) {
  const s = new THREE.Shape()
  s.moveTo(-d / 2, 0)
  s.lineTo(d / 2, 0)
  s.lineTo(0, h)
  s.closePath()
  return new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false }).translate(0, 0, -w / 2).rotateY(Math.PI / 2)
}
function roofSlab(w, d, h, t, side) {
  const half = d / 2
  const g = new THREE.BoxGeometry(w, t, Math.hypot(half, h))
  g.rotateX(-side * Math.atan2(h, half))
  g.translate(0, h / 2 + t * 0.4, (-side * half) / 2)
  return g
}

export function Treehouse({ look = 'summer' }) {
  const L = LOOKS[look] || LOOKS.summer
  const { tap, handlers, clock } = useTap(1.2)
  const swing = useRef()
  const clumps = useRef([])
  const panes = useRef([])
  const lamp = useRef()
  const ropes = useRef([])
  const rungs = useRef([])
  const roll = useRef()
  const st = useRef({ u: 0, g: L.night ? 1 : 0 })

  const ground = useGeo(() => terrainGeo({ radius: MOUND_R, height: MOUND_H, seed: 3, rings: 5, segs: 18, rough: 0.25, profile: 'dome', bands: [[0, L.grass], [0.55, L.grass2]] }), [look])
  const geo = useGeo(() => {
    const w = HUT.w + HUT.eave * 2
    const d = HUT.d + HUT.eave * 2
    return {
      trunk: facet(new THREE.CylinderGeometry(0.15, 0.24, 1.95, 9, 4).translate(0, 0.975, 0), 0.025, 2),
      root: facet(new THREE.ConeGeometry(0.09, 0.45, 5, 1).translate(0, 0.225, 0), 0.01, 3),
      branch: facet(new THREE.CylinderGeometry(0.045, 0.08, 1, 6, 2).translate(0, 0.5, 0), 0.01, 4),
      clump: facet(new THREE.IcosahedronGeometry(1, 1), 0.08, 5),
      plank: new THREE.BoxGeometry(DECK[1] - DECK[0], 0.05, (DECK[3] - DECK[2]) / 8 - 0.008),
      joist: new THREE.BoxGeometry(DECK[1] - DECK[0] + 0.04, 0.06, 0.06),
      post: new THREE.BoxGeometry(0.06, 1, 0.06),
      wallPlank: new THREE.BoxGeometry(HUT.w, HUT.h / 5 - 0.006, HUT.d),
      corner: new THREE.BoxGeometry(0.05, HUT.h, 0.05),
      gable: gableGeo(HUT.w, HUT.d, HUT.roofH),
      roofA: roofSlab(w, d, HUT.roofH, 0.045, 1),
      roofB: roofSlab(w, d, HUT.roofH, 0.045, -1),
      ridge: new THREE.BoxGeometry(w + 0.02, 0.04, 0.06),
      pane: new THREE.BoxGeometry(0.13, 0.12, 0.012),
      frame: new THREE.BoxGeometry(0.17, 0.16, 0.01),
      door: new THREE.BoxGeometry(0.14, 0.27, 0.014),
      rail: new THREE.BoxGeometry(1, 0.025, 0.025),
      baluster: new THREE.BoxGeometry(0.025, 0.2, 0.025),
      rope: new THREE.CylinderGeometry(0.008, 0.008, 1, 4).translate(0, -0.5, 0),
      seat: facet(new THREE.BoxGeometry(0.3, 0.03, 0.12), 0.004, 6),
      rung: new THREE.BoxGeometry(0.24, 0.022, 0.03),
      roll: new THREE.CylinderGeometry(1, 1, 0.26, 7).rotateZ(Math.PI / 2),
      stem: new THREE.CylinderGeometry(0.006, 0.006, 0.12, 3).translate(0, 0.06, 0),
      petal: blob(1, 7, 0),
      shroom: new THREE.CylinderGeometry(0.018, 0.024, 0.07, 6).translate(0, 0.035, 0),
      cap: cone(0.06, 0.05, 7, 8),
      rock: blob(1, 9, 0),
      leaf: new THREE.OctahedronGeometry(1, 0).scale(1, 0.25, 0.6),
      spark: new THREE.OctahedronGeometry(1, 0),
      hit: new THREE.CylinderGeometry(0.8, 0.8, 2.3, 8).translate(0, 1.15, 0),
    }
  }, [])

  const flowers = useMemo(() => {
    const r = rng(11)
    return Array.from({ length: 9 }, (_, i) => {
      const a = r() * TAU
      const d = 0.75 + r() * 0.75
      const x = Math.cos(a) * d
      const z = Math.sin(a) * d
      return [x, groundY(x, z), z, L.flowers[i % L.flowers.length]]
    }).filter(([x, , z]) => !(Math.abs(x - LADDER[0]) < 0.2 && Math.abs(z - LADDER[2]) < 0.2) && !(Math.abs(x - SWING[0]) < 0.25 && Math.abs(z - SWING[2]) < 0.3))
  }, [look]) // eslint-disable-line react-hooks/exhaustive-deps
  const shrooms = useMemo(
    () =>
      [
        [0.3, 0.32, 1],
        [0.38, 0.22, 0.75],
        [-0.38, -0.3, 0.9],
        [1.05, 0.7, 0.8],
      ].map(([x, z, s]) => [x, groundY(x, z), z, s]),
    [],
  )
  const glass = useMemo(() => ({ off: new THREE.Color(L.glass), on: new THREE.Color('#ffd27a') }), [L.glass])

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05)
    const t = clock.elapsedTime
    const s = tap.since(t)
    const S = st.current
    // the swing: a pendulum, with a lazy second beat so it never repeats
    swing.current.rotation.x = 0.28 * Math.sin(t * 1.7) + 0.04 * Math.sin(t * 0.63)
    // leaves rustle
    clumps.current.forEach((m, i) => {
      if (!m) return
      const [x, y, z, r] = CANOPY[i]
      m.position.set(x + Math.sin(t * 1.3 + i * 1.7) * 0.015, y + Math.sin(t * 1.9 + i) * 0.012, z + Math.cos(t * 1.1 + i * 2.3) * 0.015)
      m.scale.setScalar(r * (1 + 0.025 * Math.sin(t * 2.4 + i * 1.3)))
    })
    // the ladder unrolls while the tap holds, then rolls back up
    const down = s >= 0 && s < HOLD
    S.u += ((down ? 1 : 0) - S.u) * Math.min(1, d * (down ? 2.6 : 1.8))
    const len = Math.max(0.001, S.u * LADDER_LEN)
    ropes.current.forEach((m) => m && (m.scale.y = len))
    rungs.current.forEach((m, i) => m && (m.visible = (i + 0.7) * (LADDER_LEN / RUNGS) <= len))
    if (roll.current) {
      roll.current.position.y = -len - 0.03
      roll.current.scale.set(1, 0.025 + 0.035 * (1 - S.u), 0.025 + 0.035 * (1 - S.u))
      roll.current.rotation.x = -len * 20
    }
    // the windows glow
    const lit = L.night || (s >= 0 && s < HOLD + 0.3)
    S.g += ((lit ? 1 : 0) - S.g) * Math.min(1, d * (lit ? 5 : 1.5))
    const flick = 1 + 0.06 * Math.sin(t * 13) * S.g
    panes.current.forEach((m) => {
      if (!m) return
      m.color.lerpColors(glass.off, glass.on, S.g)
      m.emissiveIntensity = (0.05 + 1.3 * S.g) * flick
    })
    if (lamp.current) lamp.current.intensity = 2.2 * S.g * flick
  })

  const fireflies = () => (L.night ? 1 : Math.min(1, st.current.g * 1.2))

  // a window: a frame with a glowing pane, facing +z
  const win = (key, props) => (
    <group key={key} {...props}>
      <mesh geometry={geo.frame}>
        <Flat color={L.wood2} />
      </mesh>
      <mesh geometry={geo.pane} position-z={0.008}>
        <meshStandardMaterial ref={(el) => (panes.current[key] = el)} color={L.glass} emissive="#ffb84a" emissiveIntensity={0.05} flatShading roughness={0.3} />
      </mesh>
    </group>
  )

  const railX = (x0, x1, z) => (
    <group key={`x${x0}${z}`}>
      {[0.1, 0.2].map((y) => (
        <mesh key={y} geometry={geo.rail} position={[(x0 + x1) / 2, DECK_Y + y, z]} scale={[x1 - x0, 1, 1]}>
          <Flat color={L.wood2} />
        </mesh>
      ))}
      {[x0, x1].map((x) => (
        <mesh key={x} geometry={geo.baluster} position={[x, DECK_Y + 0.1, z]} scale={[1.4, 1.1, 1.4]}>
          <Flat color={L.wood2} />
        </mesh>
      ))}
    </group>
  )
  const railZ = (z0, z1, x) => (
    <group key={`z${z0}${x}`}>
      {[0.1, 0.2].map((y) => (
        <mesh key={y} geometry={geo.rail} position={[x, DECK_Y + y, (z0 + z1) / 2]} rotation-y={Math.PI / 2} scale={[z1 - z0, 1, 1]}>
          <Flat color={L.wood2} />
        </mesh>
      ))}
      {[z0, (z0 + z1) / 2, z1].map((z) => (
        <mesh key={z} geometry={geo.baluster} position={[x, DECK_Y + 0.1, z]} scale={[1.4, 1.1, 1.4]}>
          <Flat color={L.wood2} />
        </mesh>
      ))}
    </group>
  )

  const deckW = DECK[3] - DECK[2]
  return (
    <group {...handlers}>
      <mesh geometry={ground}>
        <Flat vertexColors color="#ffffff" />
      </mesh>

      {/* the tree: trunk, roots, branches and the canopy */}
      <mesh geometry={geo.trunk} position-y={0.08}>
        <Flat color={L.trunk} />
      </mesh>
      {[0.3, 1.9, 3.5, 5.0].map((a, i) => (
        <mesh key={a} geometry={geo.root} position={[Math.cos(a) * 0.16, 0.12, Math.sin(a) * 0.16]} rotation={[Math.sin(a) * 1.25, 0, -Math.cos(a) * 1.25]} scale={[1, 0.8 + (i % 2) * 0.3, 1]}>
          <Flat color={L.trunk} />
        </mesh>
      ))}
      {/* the long swing branch, and branches up into the leaves */}
      <mesh geometry={geo.branch} position={[-0.05, SWING[1] - 0.06, SWING[2]]} rotation-z={Math.PI / 2 - 0.1} scale={[1, 0.98, 1]}>
        <Flat color={L.trunk} />
      </mesh>
      {[
        [0.05, 1.7, 0.05, 0.6, -0.7, 0.7],
        [-0.05, 1.65, -0.05, 0.45, 0.8, 0.6],
        [0, 1.75, 0.05, -0.6, 0, 0.55],
      ].map(([x, y, z, rx, rz, l], i) => (
        <mesh key={i} geometry={geo.branch} position={[x, y, z]} rotation={[rx, 0, rz]} scale={[0.8, l, 0.8]}>
          <Flat color={L.trunk} />
        </mesh>
      ))}
      {CANOPY.map(([x, y, z, r], i) => (
        <mesh key={i} ref={(el) => (clumps.current[i] = el)} geometry={geo.clump} position={[x, y, z]} scale={r} rotation={[i, i * 2, 0]}>
          <Flat color={L.leaves[i % L.leaves.length]} />
        </mesh>
      ))}

      {/* the deck: joists, planks and posts down to the ground */}
      {[DECK[2] + 0.05, (DECK[2] + DECK[3]) / 2, DECK[3] - 0.05].map((z) => (
        <mesh key={z} geometry={geo.joist} position={[(DECK[0] + DECK[1]) / 2, DECK_Y - 0.075, z]}>
          <Flat color={L.wood2} />
        </mesh>
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} geometry={geo.plank} position={[(DECK[0] + DECK[1]) / 2, DECK_Y - 0.025, DECK[2] + (i + 0.5) * (deckW / 8)]}>
          <Flat color={i % 2 ? L.wood : L.wood2} />
        </mesh>
      ))}
      {[
        [DECK[1] - 0.04, DECK[2] + 0.05],
        [DECK[1] - 0.04, DECK[3] - 0.05],
        [DECK[0] + 0.04, DECK[3] - 0.05],
      ].map(([x, z], i) => {
        const gy = groundY(x, z)
        const h = DECK_Y - 0.08 - gy + 0.02
        return (
          <mesh key={i} geometry={geo.post} position={[x, gy + h / 2 - 0.02, z]} scale={[1, h, 1]}>
            <Flat color={L.trunk} />
          </mesh>
        )
      })}
      {/* the railing round the porch, with a gap for the ladder */}
      {railX(-0.08, DECK[1] - 0.02, DECK[3] - 0.015)}
      {railZ(DECK[2] + 0.02, DECK[3] - 0.015, DECK[0] + 0.015)}
      {railX(DECK[0] + 0.015, -0.42, DECK[3] - 0.015)}

      {/* the hut: plank walls, corner posts, gables and roof */}
      <group position={[HUT.x, DECK_Y, HUT.z]}>
        {Array.from({ length: 5 }, (_, i) => (
          <mesh key={i} geometry={geo.wallPlank} position-y={(i + 0.5) * (HUT.h / 5)} scale={[1, 1, i % 2 ? 1 : 1.03]}>
            <Flat color={i % 2 ? L.wood : L.wood2} />
          </mesh>
        ))}
        {[-1, 1].map((sx) =>
          [-1, 1].map((sz) => (
            <mesh key={`${sx}${sz}`} geometry={geo.corner} position={[(sx * HUT.w) / 2, HUT.h / 2, (sz * HUT.d) / 2]}>
              <Flat color={L.trunk} />
            </mesh>
          )),
        )}
        <mesh geometry={geo.gable} position-y={HUT.h}>
          <Flat color={L.wood} />
        </mesh>
        <group position-y={HUT.h - 0.01}>
          <mesh geometry={geo.roofA}>
            <Flat color={L.roof} />
          </mesh>
          <mesh geometry={geo.roofB}>
            <Flat color={L.roof2} />
          </mesh>
          <mesh geometry={geo.ridge} position-y={HUT.roofH + 0.03}>
            <Flat color={L.roof2} />
          </mesh>
        </group>
        {/* door and windows */}
        <mesh geometry={geo.door} position={[0.13, 0.145, HUT.d / 2 + 0.008]}>
          <Flat color={L.trunk} />
        </mesh>
        {win(0, { position: [-0.11, 0.24, HUT.d / 2 + 0.01] })}
        {win(1, { position: [HUT.w / 2 + 0.01, 0.24, 0], rotation: [0, Math.PI / 2, 0] })}
        {win(2, { position: [-HUT.w / 2 - 0.01, 0.24, 0], rotation: [0, -Math.PI / 2, 0] })}
        <pointLight ref={lamp} position={[0, 0.25, HUT.d / 2 + 0.25]} color="#ffb860" intensity={0} distance={1.8} decay={2} />
      </group>

      {/* the rope ladder: two ropes and rungs, unrolling from a bundle */}
      <group position={LADDER}>
        {[-1, 1].map((sx, i) => (
          <mesh key={sx} ref={(el) => (ropes.current[i] = el)} geometry={geo.rope} position-x={sx * 0.1} scale={[1, 0.001, 1]}>
            <Flat color="#d8c08a" />
          </mesh>
        ))}
        {Array.from({ length: RUNGS }, (_, i) => (
          <mesh key={i} ref={(el) => (rungs.current[i] = el)} geometry={geo.rung} position-y={-(i + 0.7) * (LADDER_LEN / RUNGS)} visible={false}>
            <Flat color={L.wood} />
          </mesh>
        ))}
        <mesh ref={roll} geometry={geo.roll} position-y={-0.03} scale={[1, 0.06, 0.06]}>
          <Flat color="#c9ad74" />
        </mesh>
      </group>

      {/* the rope swing */}
      <group ref={swing} position={SWING}>
        {[-1, 1].map((sx) => (
          <mesh key={sx} geometry={geo.rope} position-x={sx * 0.12} scale={[1, ROPE, 1]}>
            <Flat color="#d8c08a" />
          </mesh>
        ))}
        <mesh geometry={geo.seat} position-y={-ROPE}>
          <Flat color={L.wood} />
        </mesh>
      </group>

      {/* flowers, mushrooms and a couple of stones */}
      {flowers.map(([x, y, z, c], i) => (
        <group key={i} position={[x, y, z]}>
          <mesh geometry={geo.stem}>
            <Flat color="#4a8a3a" />
          </mesh>
          <mesh geometry={geo.petal} position-y={0.125} scale={[0.035, 0.022, 0.035]}>
            <Flat color={c} emissive={L.night ? c : '#000000'} emissiveIntensity={L.night ? 0.4 : 0} />
          </mesh>
          <mesh geometry={geo.petal} position-y={0.135} scale={0.012}>
            <Flat color="#ffd23f" />
          </mesh>
        </group>
      ))}
      {shrooms.map(([x, y, z, s], i) => (
        <group key={i} position={[x, y, z]} scale={s}>
          <mesh geometry={geo.shroom}>
            <Flat color="#f4ecdc" />
          </mesh>
          <mesh geometry={geo.cap} position-y={0.06}>
            <Flat color={i % 2 ? '#d8a050' : '#d8433a'} />
          </mesh>
        </group>
      ))}
      {[
        [0.95, -0.85, 0.07],
        [-1.1, -0.5, 0.06],
      ].map(([x, z, s], i) => (
        <mesh key={i} geometry={geo.rock} position={[x, groundY(x, z) + s * 0.3, z]} scale={[s * 1.3, s, s]} rotation-y={i}>
          <Flat color={L.night ? '#7a8088' : '#b4b2ae'} />
        </mesh>
      ))}

      {/* leaves drifting down now and then */}
      <Particles geometry={geo.leaf} count={5} life={6} origin={[0, 1.7, 0]} spread={0.75} velocity={[0.06, -0.24, 0.04]} scatter={0.05} drift={0.3} size={[0.045, 0.04]} colors={L.leaves} opacity={[1, 0.2]} spin={3} seed={3} />
      {/* fireflies round the hut, and a flurry of sparkles on a tap */}
      <Particles geometry={geo.spark} count={14} life={3.2} origin={[0.1, DECK_Y + 0.05, 0.4]} spread={0.75} velocity={[0, 0.1, 0]} scatter={0.12} drift={0.35} size={[0.018, 0.012]} colors={['#fff3a0', '#ffe066', '#d8ff8a']} opacity={[1, 0]} emissive={2} active={fireflies} seed={8} />
      <Burst tap={tap} geometry={geo.spark} count={14} colors={['#fff3a0', '#ffd860', '#ffffff']} speed={0.5} gravity={-0.4} size={0.03} life={1.8} origin={[HUT.x, DECK_Y + 0.25, HUT.z + 0.4]} spread={0.9} up={1.2} seed={5} />

      {/* an invisible core round the trunk and hut, so a tap there lands */}
      <mesh geometry={geo.hit}>
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}

export default function TreehouseScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[4.2, 2.8, 5.8]} target={[0, 1.15, 0]} hint="The swing sways, the leaves rustle and now and then one drifts down · tap it and the windows light up, the rope ladder unrolls to the grass and fireflies come out, then it all rolls back up · Look swaps summer, autumn, spring and night · drag to orbit">
      <Treehouse {...props} />
    </Stage>
  )
}

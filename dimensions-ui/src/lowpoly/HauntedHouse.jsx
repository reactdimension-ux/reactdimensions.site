import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Flat, Particles, Stage, TAU, blob, facet, followPath, rng, terrainGeo, terrainShape, useGeo, useTap } from './kit.jsx'

// A low-poly haunted house on a dark grassy mound: a crooked two-storey
// house whose walls lean and whose steep roof sags along its ridge, a
// crooked chimney, a corner tower with a bent pointed roof, glowing windows
// with broken shutters (one hanging from a single hinge), a boarded-up
// window, a bare twisted tree, a broken picket fence and a few tilted
// gravestones, with a full moon hanging behind and mist creeping over the
// grass. Left alone, the windows flicker and every few seconds a sheet ghost
// with hollow eyes rises to peek out of an upstairs window, then sinks back.
// Tap it and a swarm of bats bursts from the tower and roof and flaps away
// in all directions on curving paths, every window flashes bright, and the
// ghost pops right out and floats about before slipping back inside.

const LOOKS = {
  classic: { glow: '#ffb347', moon: '#fff1c2', wall: '#5d566b', wall2: '#524b60', roof: '#2b2735', trim: '#1d1a24', grass: ['#2c3629', '#36422f', '#404d38'], ghost: '#eef4ff', mist: '#a9a6ba', mistAmt: 0.5 },
  green: { glow: '#8dff6a', moon: '#e6ffd0', wall: '#4b5a51', wall2: '#424f48', roof: '#232c27', trim: '#171d19', grass: ['#22301f', '#2b3a26', '#33452c'], ghost: '#dcffe4', mist: '#9fc2a6', mistAmt: 0.5 },
  purple: { glow: '#d77bff', moon: '#f3dcff', wall: '#5a4a6e', wall2: '#4f4062', roof: '#2a2040', trim: '#1a1328', grass: ['#2a2638', '#332e44', '#3c3650'], ghost: '#f4e8ff', mist: '#b29cc8', mistAmt: 0.5 },
  fog: { glow: '#ffe2a0', moon: '#f4f4ff', wall: '#68666f', wall2: '#5d5b64', roof: '#33313b', trim: '#22212a', grass: ['#38403a', '#414a42', '#4a544b'], ghost: '#ffffff', mist: '#d4d6de', mistAmt: 1 },
}

const MOUND_R = 1.55
const MOUND_H = 0.18
const shape = terrainShape('mesa')
const groundAt = (x, z) => MOUND_H * shape(Math.min(1, Math.hypot(x, z) / MOUND_R))
const W1 = 0.92 // ground floor
const H1 = 0.5
const D = 0.66
const H2 = 0.42 // upper floor
const LEAN = 0.06 // the ground floor's lean (x per unit of height)
const PEEK = 5.6 // seconds between ghost peeks
const BATS = 14
const SWARM = 2.8 // seconds the bats are out

const ease = (u) => {
  const x = Math.max(0, Math.min(1, u))
  return x * x * (3 - 2 * x)
}
// lean a geometry: x (and z) shift with height
function lean(g, kx, kz = 0) {
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + kx * p.getY(i), p.getY(i), p.getZ(i) + kz * p.getY(i))
  g.computeVertexNormals()
  return g
}

// the steep gable roof, ridge along x, sagging in the middle
function roofGeo(len, half, h) {
  const s = new THREE.Shape()
  s.moveTo(-half, 0)
  s.lineTo(half, 0)
  s.lineTo(0, h)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: len, steps: 6, bevelEnabled: false }).translate(0, 0, -len / 2).rotateY(Math.PI / 2)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const y = p.getY(i)
    const sag = Math.sin(Math.PI * (x / len + 0.5))
    p.setY(i, y - (y > h * 0.8 ? 0.08 : 0.025) * sag)
  }
  return facet(g, 0.008, 41)
}

// a sheet ghost: a domed lathe with a wavy hem
function ghostGeo() {
  const prof = [[0.001, 0.34], [0.06, 0.33], [0.1, 0.29], [0.122, 0.22], [0.126, 0.12], [0.138, 0.04], [0.16, -0.01]]
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 12)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i)
    if (y < 0) p.setY(i, y + 0.03 * Math.sin(Math.atan2(p.getX(i), p.getZ(i)) * 6))
  }
  g.computeVertexNormals()
  return facet(g, 0.004, 51)
}

// a glowing window in a dark frame with a cross of glazing bars
function Win({ w = 0.14, h = 0.2, L, geo, mat, ...props }) {
  return (
    <group {...props}>
      <mesh geometry={geo.box} scale={[w + 0.04, h + 0.04, 0.02]}>
        <Flat color={L.trim} />
      </mesh>
      <mesh geometry={geo.pane} position-z={0.011} scale={[w, h, 1]}>
        <meshStandardMaterial ref={mat} color={L.glow} emissive={L.glow} emissiveIntensity={1.4} flatShading roughness={0.6} />
      </mesh>
      <mesh geometry={geo.box} position-z={0.014} scale={[0.014, h, 0.008]}>
        <Flat color={L.trim} />
      </mesh>
      <mesh geometry={geo.box} position-z={0.014} scale={[w, 0.014, 0.008]}>
        <Flat color={L.trim} />
      </mesh>
    </group>
  )
}

// one bat: a dark body, pointed ears and two scalloped wings, facing +z
function Bat({ geo, wings, i }) {
  return (
    <group>
      <mesh geometry={geo.batBody} scale={[0.8, 0.7, 1.2]}>
        <Flat color="#3b3148" />
      </mesh>
      {[-1, 1].map((x) => (
        <mesh key={x} geometry={geo.ear} position={[x * 0.012, 0.018, 0.016]}>
          <Flat color="#3b3148" />
        </mesh>
      ))}
      {[-1, 1].map((x, k) => (
        <group key={x} position-x={x * 0.01} scale={[x, 1, 1]}>
          <group ref={(el) => (wings.current[i * 2 + k] = el)}>
            <mesh geometry={geo.batWing}>
              <Flat color="#4d3f60" emissive="#2a2036" side={THREE.DoubleSide} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  )
}

export function HauntedHouse({ look = 'classic' }) {
  const L = LOOKS[look] || LOOKS.classic
  const { tap, handlers, clock } = useTap(1.4)
  const glows = useRef([])
  const lamp = useRef()
  const ghost = useRef()
  const ghostMat = useRef()
  const bats = useRef([])
  const batWings = useRef([])

  const geo = useGeo(() => {
    const wing = new THREE.Shape()
    ;[[0, 0.02], [0.05, 0.035], [0.1, 0.03], [0.12, 0.005], [0.095, -0.012], [0.075, 0.0], [0.055, -0.02], [0.035, -0.004], [0, -0.02]].forEach(([x, y], i) => (i ? wing.lineTo(x, y) : wing.moveTo(x, y)))
    wing.closePath()
    const stone = new THREE.Shape()
    stone.moveTo(-0.08, 0)
    stone.lineTo(0.08, 0)
    stone.lineTo(0.08, 0.16)
    stone.absarc(0, 0.16, 0.08, 0, Math.PI, false)
    stone.closePath()
    const trunk = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.05, 0), new THREE.Vector3(0.06, 0.35, 0.02), new THREE.Vector3(-0.05, 0.7, -0.03), new THREE.Vector3(0.04, 1.0, 0.04), new THREE.Vector3(-0.02, 1.2, 0)])
    const branch = (pts) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 6, 0.018, 4)
    return {
      mound: terrainGeo({ radius: MOUND_R, height: MOUND_H, seed: 7, rings: 6, segs: 16, rough: 0.12, profile: 'mesa', bands: [[0, L.grass[0]], [0.4, L.grass[1]], [0.85, L.grass[2]]] }),
      floor1: lean(facet(new THREE.BoxGeometry(W1, H1, D, 2, 2, 2).translate(0, H1 / 2, 0), 0.01, 1), LEAN),
      floor2: facet(new THREE.BoxGeometry(0.88, H2, 0.63, 2, 2, 2).translate(0, H2 / 2, 0), 0.01, 2),
      band: new THREE.BoxGeometry(1, 1, 1),
      roof: roofGeo(1.04, 0.43, 0.56),
      chimney: lean(facet(new THREE.BoxGeometry(0.12, 0.38, 0.12, 1, 2, 1).translate(0, 0.19, 0), 0.006, 3), -0.12),
      tower: facet(new THREE.CylinderGeometry(0.19, 0.21, 1.4, 8, 3).rotateY(Math.PI / 8).translate(0, 0.7, 0), 0.008, 4),
      towerRoof: (() => {
        const g = new THREE.ConeGeometry(0.28, 0.66, 8, 4).rotateY(Math.PI / 8).translate(0, 0.33, 0)
        const p = g.attributes.position
        for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + 0.1 * Math.max(0, p.getY(i) / 0.66) ** 2.2)
        return facet(g, 0.01, 5)
      })(),
      finial: new THREE.CylinderGeometry(0.006, 0.01, 0.14, 4, 1).translate(0, 0.07, 0),
      box: new THREE.BoxGeometry(1, 1, 1),
      pane: new THREE.PlaneGeometry(1, 1),
      round: new THREE.CircleGeometry(0.07, 8),
      ring: new THREE.RingGeometry(0.07, 0.09, 8),
      ghost: ghostGeo(),
      eye: new THREE.IcosahedronGeometry(1, 0),
      batBody: blob(0.024, 61, 0),
      ear: new THREE.ConeGeometry(0.007, 0.02, 3, 1),
      batWing: new THREE.ShapeGeometry(wing).rotateX(-Math.PI / 2),
      trunk: facet(new THREE.TubeGeometry(trunk, 10, 0.055, 5), 0.008, 6),
      branches: [
        branch([[0.03, 0.55, 0], [0.2, 0.72, 0.05], [0.28, 0.9, 0.02], [0.4, 0.95, 0.08]]),
        branch([[-0.04, 0.75, -0.02], [-0.22, 0.9, 0.0], [-0.3, 1.1, -0.06], [-0.42, 1.16, -0.02]]),
        branch([[0.02, 0.98, 0.03], [0.14, 1.15, 0.1], [0.12, 1.32, 0.16]]),
        branch([[-0.02, 1.15, 0], [-0.1, 1.32, -0.08], [-0.06, 1.42, -0.14]]),
        branch([[0.04, 0.4, 0.01], [-0.12, 0.5, 0.12], [-0.2, 0.62, 0.2]]),
      ],
      stone: facet(new THREE.ExtrudeGeometry(stone, { depth: 0.05, bevelEnabled: false, curveSegments: 3 }).translate(0, 0, -0.025), 0.004, 8),
      moon: new THREE.IcosahedronGeometry(0.32, 1),
      halo: new THREE.CircleGeometry(0.5, 16),
      mist: new THREE.IcosahedronGeometry(1, 0),
      hit: new THREE.BoxGeometry(1.5, 2.1, 1.1).translate(0, 1.05, 0),
    }
  }, [look])

  // the fence along the front: pickets on the slope, some lost, some leaning
  const fence = useMemo(() => {
    const r = rng(12)
    const n = 15
    const posts = Array.from({ length: n }, (_, i) => {
      const x = -0.8 + (1.6 * i) / (n - 1)
      const z = 1.02 + 0.08 * Math.sin(i * 0.7)
      return { x, z, y: groundAt(x, z), tilt: (r() - 0.5) * 0.35, lost: i === 4 || i === 9 || i === 10, h: 0.2 + r() * 0.05 }
    })
    const rails = []
    for (let i = 0; i < n - 1; i++) {
      if (i === 9 || i === 3) continue // broken spans
      const a = posts[i]
      const b = posts[i + 1]
      for (const k of [0.06, 0.15]) {
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dz = b.z - a.z
        rails.push({ p: [(a.x + b.x) / 2, (a.y + b.y) / 2 + k, (a.z + b.z) / 2 + 0.015], len: Math.hypot(dx, dz) + 0.01, rz: Math.atan2(dy, dx), ry: -Math.atan2(dz, dx) })
      }
    }
    return { posts, rails }
  }, [])

  const graves = useMemo(
    () =>
      [
        [-0.5, 0.72, 0.15, 0.12, 1],
        [0.08, 0.82, -0.12, -0.18, 0.85],
        [0.62, 0.62, 0.22, 0.3, 1.1],
        [-0.85, 0.5, -0.2, 0.5, 0.9],
      ].map(([x, z, tilt, ry, s]) => ({ p: [x, groundAt(x, z) - 0.02, z], tilt, ry, s })),
    [],
  )

  // each bat's flight: a direction, a climb, a curl and a delay
  const swarm = useMemo(() => {
    const r = rng(23)
    return Array.from({ length: BATS }, (_, i) => ({
      a: (i / BATS) * TAU + r() * 0.4,
      climb: 0.02 + r() * 0.4,
      reach: 0.5 + r() * 0.35,
      curl: (r() - 0.5) * 1.6,
      delay: r() * 0.25,
      ph: r() * TAU,
      from: i % 3 === 0 ? [-0.15, 1.5, -0.1] : [0.47, 2.0, 0.27],
    }))
  }, [])

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const flash = tap.value(t)

    // the windows flicker, now and then dipping, and flash on a tap
    glows.current.forEach((m, i) => {
      if (!m) return
      const dip = (t * 0.7 + i * 0.37) % 3.1 < 0.09 ? 0.35 : 1
      m.emissiveIntensity = (1.25 + 0.25 * Math.sin(t * 7.3 + i * 2) + 0.15 * Math.sin(t * 13.1 + i * 5)) * dip + 4 * flash
    })
    if (lamp.current) lamp.current.intensity = (1.6 + 0.4 * Math.sin(t * 9.1) + 0.2 * Math.sin(t * 17)) * (1 + 5 * flash)

    // the ghost: a peek every few seconds, or the full show after a tap
    const f = t % PEEK
    const peek = f < 1.6 ? 0 : f < 2.4 ? ease((f - 1.6) / 0.8) : f < 3.7 ? 1 : 1 - ease((f - 3.7) / 0.8)
    const out = s >= 0 && s < 3.2 ? ease(s / 0.3) * (1 - ease((s - 2.5) / 0.7)) : 0
    const g = ghost.current
    const a = Math.max(peek * 0.7, out)
    g.visible = a > 0.01
    if (g.visible) {
      const sway = Math.sin(t * 2.2)
      g.position.set(-0.24 + 0.05 * sway * out + 0.3 * Math.sin(s * 2.4) * out, H1 + 0.06 + 0.14 * peek * (1 - out) + 0.5 * out + 0.04 * Math.sin(t * 3), D / 2 + 0.03 + 0.04 * peek + 0.38 * out)
      g.scale.setScalar(0.4 + 0.75 * a)
      g.rotation.set(0.1 * out, 0.25 * Math.sin(t * 1.3), 0.12 * sway)
      ghostMat.current.opacity = 0.88 * Math.min(1, a * 1.6)
    }

    // the bats burst out and flap away on curving paths
    bats.current.forEach((o, i) => {
      if (!o) return
      const B = swarm[i]
      const u = s - B.delay
      o.visible = s >= 0 && u >= 0 && u < SWARM
      if (!o.visible) return
      const fn = (v) => {
        const d = B.reach * v * (1 + 0.35 * v)
        const ang = B.a + B.curl * v
        return new THREE.Vector3(B.from[0] + Math.cos(ang) * d, B.from[1] + B.climb * v + 0.08 * Math.sin(v * 5 + B.ph), B.from[2] + Math.sin(ang) * d)
      }
      followPath(o, fn, u, 1)
      o.scale.setScalar(Math.max(0.001, Math.min(1, u * 6)) * (1 - ease((u - SWARM + 0.6) / 0.6)) * 2.1)
    })
    batWings.current.forEach((w, i) => w && (w.rotation.z = Math.sin(t * 26 + i * 0.7) * 0.9))
  })

  const mat = (i) => (m) => (glows.current[i] = m)
  const wx = (x, y) => x + LEAN * y // a spot on the leaning ground-floor front

  return (
    <group {...handlers}>
      <mesh geometry={geo.hit}>
        <meshBasicMaterial visible={false} />
      </mesh>
      {/* the moon behind */}
      <group position={[-1.35, 1.95, -1.9]}>
        <mesh geometry={geo.moon}>
          <meshBasicMaterial color={L.moon} />
        </mesh>
        <mesh geometry={geo.halo} position-z={-0.05}>
          <meshBasicMaterial color={L.moon} transparent opacity={0.12} depthWrite={false} />
        </mesh>
      </group>
      <mesh geometry={geo.mound}>
        <Flat vertexColors color="#ffffff" />
      </mesh>

      {/* the house */}
      <group position={[0, MOUND_H - 0.01, -0.12]} rotation-y={-0.08}>
        <mesh geometry={geo.floor1}>
          <Flat color={L.wall} />
        </mesh>
        {/* ground floor front: a window with shutters, the door, a side window */}
        <Win L={L} geo={geo} mat={mat(0)} position={[wx(-0.24, 0.28), 0.28, D / 2]} />
        {[-1, 1].map((x) => (
          <mesh key={x} geometry={geo.box} position={[wx(-0.24 + x * 0.12, 0.28), 0.28, D / 2 + 0.02]} rotation-y={x * 0.5} scale={[0.07, 0.22, 0.015]}>
            <Flat color={L.trim} />
          </mesh>
        ))}
        <group position={[wx(0.12, 0.2), 0, D / 2]}>
          <mesh geometry={geo.box} position-y={0.19} scale={[0.22, 0.38, 0.03]}>
            <Flat color={L.trim} />
          </mesh>
          <mesh geometry={geo.box} position={[0, 0.18, 0.01]} scale={[0.17, 0.34, 0.03]}>
            <Flat color="#3a2a26" />
          </mesh>
          <mesh geometry={geo.pane} position={[0, 0.3, 0.027]} scale={[0.1, 0.05, 1]}>
            <meshStandardMaterial ref={mat(1)} color={L.glow} emissive={L.glow} emissiveIntensity={1.4} flatShading />
          </mesh>
          <mesh geometry={geo.box} position={[0, 0.0, 0.07]} scale={[0.3, 0.04, 0.12]}>
            <Flat color={L.trim} />
          </mesh>
        </group>
        <Win L={L} geo={geo} mat={mat(2)} position={[-W1 / 2 + LEAN * 0.28 - 0.001, 0.28, 0.0]} rotation-y={-Math.PI / 2} />
        <mesh geometry={geo.box} position={[0.02 + LEAN * H1, H1, 0]} scale={[1.0, 0.04, 0.72]}>
          <Flat color={L.trim} />
        </mesh>

        {/* the upper floor, set crooked on the one below */}
        <group position={[0.03 + LEAN * H1, H1 + 0.02, 0]} rotation={[0, 0.03, 0.035]}>
          <mesh geometry={geo.floor2}>
            <Flat color={L.wall2} />
          </mesh>
          {/* the ghost's window, a shutter hanging from one hinge */}
          <Win L={L} geo={geo} mat={mat(3)} position={[-0.24, 0.22, 0.315]} />
          <mesh geometry={geo.box} position={[-0.36, 0.22, 0.33]} rotation-y={-0.4} scale={[0.07, 0.22, 0.015]}>
            <Flat color={L.trim} />
          </mesh>
          <group position={[-0.1, 0.33, 0.335]} rotation-z={0.75}>
            <mesh geometry={geo.box} position-y={-0.11} scale={[0.07, 0.22, 0.015]}>
              <Flat color={L.trim} />
            </mesh>
          </group>
          {/* the boarded-up window */}
          <group position={[0.18, 0.22, 0.315]}>
            <mesh geometry={geo.box} scale={[0.18, 0.24, 0.02]}>
              <Flat color={L.trim} />
            </mesh>
            {[0.6, -0.5, 0.05].map((r, i) => (
              <mesh key={i} geometry={geo.box} position={[0, (i - 1) * 0.05, 0.016]} rotation-z={r} scale={[0.24, 0.035, 0.012]}>
                <Flat color="#6a5446" />
              </mesh>
            ))}
          </group>
          <Win L={L} geo={geo} mat={mat(4)} position={[-0.441, 0.22, -0.05]} rotation-y={-Math.PI / 2} w={0.12} h={0.18} />

          {/* the sagging roof, a round attic window in its gable, the chimney */}
          <group position-y={H2} rotation-z={-0.02}>
            <mesh geometry={geo.roof}>
              <Flat color={L.roof} />
            </mesh>
            <group position={[-0.525, 0.2, 0]} rotation-y={-Math.PI / 2}>
              <mesh geometry={geo.ring}>
                <Flat color={L.trim} side={THREE.DoubleSide} />
              </mesh>
              <mesh geometry={geo.round} position-z={0.001}>
                <meshStandardMaterial ref={mat(5)} color={L.glow} emissive={L.glow} emissiveIntensity={1.4} flatShading side={THREE.DoubleSide} />
              </mesh>
            </group>
            <mesh geometry={geo.chimney} position={[-0.28, 0.2, -0.12]} rotation-z={0.06}>
              <Flat color="#4a3a3c" />
            </mesh>
          </group>
        </group>

        {/* the corner tower */}
        <group position={[0.5, 0, 0.26]} rotation-z={-0.035}>
          <mesh geometry={geo.tower}>
            <Flat color={L.wall} />
          </mesh>
          <Win L={L} geo={geo} mat={mat(6)} position={[0, 0.78, 0.19]} w={0.1} h={0.18} />
          <Win L={L} geo={geo} mat={mat(7)} position={[0, 1.12, 0.183]} w={0.08} h={0.14} />
          <mesh geometry={geo.box} position-y={1.4} scale={[0.46, 0.04, 0.46]} rotation-y={Math.PI / 8}>
            <Flat color={L.trim} />
          </mesh>
          <group position-y={1.42}>
            <mesh geometry={geo.towerRoof}>
              <Flat color={L.roof} />
            </mesh>
            <mesh geometry={geo.finial} position={[0.1, 0.64, 0]} rotation-z={-0.4}>
              <Flat color={L.trim} />
            </mesh>
          </group>
        </group>
        <pointLight ref={lamp} color={L.glow} position={[0, 0.5, 0.75]} distance={2.6} decay={2} intensity={1.6} />

        {/* the ghost, in front of the upstairs window */}
        <group ref={ghost} visible={false}>
          <mesh geometry={geo.ghost}>
            <meshStandardMaterial ref={ghostMat} color={L.ghost} emissive={L.ghost} emissiveIntensity={0.45} flatShading roughness={0.7} transparent opacity={0.88} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
          {[-1, 1].map((x) => (
            <mesh key={x} geometry={geo.eye} position={[x * 0.045, 0.22, 0.112]} scale={[0.022, 0.032, 0.012]}>
              <meshBasicMaterial color="#120f18" />
            </mesh>
          ))}
          <mesh geometry={geo.eye} position={[0, 0.14, 0.12]} scale={[0.018, 0.024, 0.01]}>
            <meshBasicMaterial color="#120f18" />
          </mesh>
        </group>

        {/* the bats, hidden until a tap */}
        {swarm.map((b, i) => (
          <group key={i} ref={(el) => (bats.current[i] = el)} visible={false}>
            <Bat geo={geo} wings={batWings} i={i} />
          </group>
        ))}
      </group>

      {/* the bare twisted tree */}
      <group position={[-0.95, groundAt(-0.95, 0.25), 0.25]} rotation-y={0.6}>
        <mesh geometry={geo.trunk}>
          <Flat color="#2e2833" />
        </mesh>
        {geo.branches.map((b, i) => (
          <mesh key={i} geometry={b}>
            <Flat color="#2e2833" />
          </mesh>
        ))}
      </group>

      {/* the broken picket fence */}
      {fence.posts.map((p, i) =>
        p.lost ? null : (
          <group key={i} position={[p.x, p.y - 0.02, p.z]} rotation-z={p.tilt}>
            <mesh geometry={geo.box} position-y={p.h / 2} scale={[0.035, p.h, 0.015]}>
              <Flat color="#6d6470" />
            </mesh>
            <mesh geometry={geo.box} position-y={p.h} rotation-z={Math.PI / 4} scale={[0.025, 0.025, 0.015]}>
              <Flat color="#6d6470" />
            </mesh>
          </group>
        ),
      )}
      {fence.rails.map((r, i) => (
        <mesh key={i} geometry={geo.box} position={r.p} rotation={[0, r.ry, r.rz + (i % 5 === 2 ? 0.25 : 0)]} scale={[r.len, 0.025, 0.012]}>
          <Flat color="#5b5360" />
        </mesh>
      ))}

      {/* the gravestones */}
      {graves.map((g, i) => (
        <group key={i} position={g.p} rotation={[g.tilt, g.ry, g.tilt * 0.5]} scale={g.s}>
          <mesh geometry={geo.stone}>
            <Flat color={i % 2 ? '#8a8794' : '#7a7784'} />
          </mesh>
        </group>
      ))}

      {/* mist creeping over the grass */}
      <Particles count={Math.round(10 + 14 * L.mistAmt)} life={6} origin={[0, MOUND_H + 0.02, 0.2]} spread={1.0} velocity={[0.06, 0.02, 0.03]} scatter={0.05} drift={0.2} size={[0.04, 0.1 + 0.14 * L.mistAmt]} colors={[L.mist]} opacity={[0.12 + 0.25 * L.mistAmt, 0]} geometry={geo.mist} spin={0.3} seed={9} />
    </group>
  )
}

export default function HauntedHouseScene({ background = '#1d1b26', autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.6, 2.3, 5.2]} target={[0, 1.0, 0]} hint="The windows flicker and every few seconds a ghost peeks out of an upstairs window, then sinks back · tap it and bats burst from the tower and roof, the windows flash and the ghost pops right out · Look swaps classic, green, purple and fog · drag to orbit">
      <HauntedHouse {...props} />
    </Stage>
  )
}

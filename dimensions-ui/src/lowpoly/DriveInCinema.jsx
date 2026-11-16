import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Beam, Flat, Flow, Stage, TAU, blob, facet, useGeo, useTap } from './kit.jsx'

// A low-poly drive-in cinema on a square of grass: a big screen on posts
// with braces behind, a tarmac lot with painted bays and speaker posts,
// four little finned cars parked facing the screen, and a projector booth
// at the back with a striped snack awning and a marquee of chasing bulbs.
// Left alone, the screen plays a simple cartoon (a sun setting over hills,
// a rocket past a planet, a fish under the waves, a beating heart) and
// flickers like old film, while the projector beam shimmers with drifting
// dust and the screen's colour washes over the cars. Tap it and every car
// flashes its headlights and hops as it honks, the screen flashes white and
// the next film comes on in a new colour scheme.

const LOOKS = {
  retro: { sky: '#262a45', grass: '#4f7a4a', grass2: '#456d41', lot: '#4a4a55', line: '#f2efe6', frame: '#ece6d8', post: '#8a7f74', booth: '#f1e2c4', trim: '#c8423a', roof: '#3f3a44', awning: ['#c8423a', '#f6f1e6'], bulb: '#ffd36a', beam: '#fff2c4', cars: ['#7fd6c2', '#ff9fb2', '#f2dfa6', '#8fb8ff'], neon: 0 },
  neon: { sky: '#120f24', grass: '#232a3f', grass2: '#1d2336', lot: '#2a2838', line: '#38f0ff', frame: '#2a2440', post: '#3a3452', booth: '#2e2a48', trim: '#ff3fa4', roof: '#1b1830', awning: ['#ff3fa4', '#2e2a48'], bulb: '#ff5fd0', beam: '#9ff4ff', cars: ['#7a4cff', '#ff3fa4', '#21c8ef', '#ffd23f'], neon: 1 },
  dusk: { sky: '#5a4064', grass: '#6b7a48', grass2: '#5f6e40', lot: '#5a5058', line: '#f4e6cf', frame: '#f0dcc6', post: '#7a6458', booth: '#e8c9a8', trim: '#8e3b46', roof: '#4a3440', awning: ['#e0703a', '#f6e8d6'], bulb: '#ffc46a', beam: '#ffd9a8', cars: ['#d9534f', '#f0a04b', '#5b8fb9', '#ede0c4'], neon: 0 },
}

const SW = 1.5 // screen width
const SH = 0.82 // screen height
const SCREEN = [0, 0.97, -0.95] // screen centre
const XR = SW / 2
const BOOTH = [-0.48, 0, 1.12]
// the booth turns to face the screen; its projector port sits 0.2 in front
const BOOTH_RY = -Math.atan2(SCREEN[0] - BOOTH[0], BOOTH[2] - SCREEN[2])
const LENS = [BOOTH[0] - Math.sin(BOOTH_RY) * 0.21, 0.27, BOOTH[2] - Math.cos(BOOTH_RY) * 0.21]
const CARS = [
  { x: -0.62, z: 0.04, ry: 0.08 },
  { x: 0, z: -0.02, ry: -0.03 },
  { x: 0.62, z: 0.03, ry: -0.08 },
  { x: 0.62, z: 0.68, ry: -0.12 },
]

const fade = (x) => Math.max(0, Math.min(1, (XR - 0.04 - Math.abs(x)) / 0.1))
const shapeGeo = (pts) => {
  const s = new THREE.Shape()
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)))
  s.closePath()
  return new THREE.ShapeGeometry(s)
}

// The films: a background that washes between two colours and a few flat
// shapes, each moved by m(t) -> { x, y, r, s, sx, sy } in screen units.
const FILMS = [
  {
    bg: ['#ff8a4a', '#ffb65e'],
    items: [
      { g: 'disc', c: '#fff07a', m: (t) => ({ x: 0.06, y: -0.04 + 0.13 * Math.sin(t * 0.7), s: 0.15 }) },
      { g: 'disc', c: '#ffffff', m: (t) => ({ x: -0.45 + 0.08 * Math.sin(t * 0.3), y: 0.27, sx: 0.12, sy: 0.035 }) },
      { g: 'tri', c: '#7b3577', m: () => ({ x: -0.36, y: -SH / 2, sx: 0.38, sy: 0.46 }) },
      { g: 'tri', c: '#55225f', m: () => ({ x: 0.36, y: -SH / 2, sx: 0.38, sy: 0.36 }) },
    ],
  },
  {
    bg: ['#1b2466', '#26307e'],
    items: [
      { g: 'disc', c: '#ff7ab8', m: (t) => ({ x: 0.22 + 0.24 * Math.cos(t * 0.8), y: 0.03 + 0.12 * Math.sin(t * 0.8), s: 0.11 }) },
      { g: 'star', c: '#ffe36a', m: (t) => ({ x: -0.45, y: 0.17, r: t * 1.4, s: 0.12 * (1 + 0.15 * Math.sin(t * 5)) }) },
      { g: 'star', c: '#ffffff', m: (t) => ({ x: 0.52, y: 0.28, r: -t, s: 0.04 * (1 + 0.4 * Math.sin(t * 7)) }) },
      { g: 'tri', c: '#7ff0ff', m: (t) => { const x = -XR + 2 * XR * ((t * 0.22) % 1); return { x, y: -0.2 + 0.05 * Math.sin(t * 3), r: -Math.PI / 2, sx: 0.06 * fade(x), sy: 0.14 * fade(x) } } },
    ],
  },
  {
    bg: ['#22a6c0', '#33c3cf'],
    items: [
      { g: 'box', c: '#16679c', m: (t) => ({ x: 0, y: -0.33 + 0.02 * Math.sin(t * 2), sx: SW, sy: 0.16 }) },
      { g: 'tri', c: '#ffad33', m: (t) => { const x = XR - 2 * XR * ((t * 0.18) % 1); return { x, y: 0.04 + 0.08 * Math.sin(t * 2.2), r: Math.PI / 2 + 0.2 * Math.sin(t * 9), sx: 0.08 * fade(x), sy: 0.16 * fade(x) } } },
      { g: 'disc', c: '#e8fbff', m: (t) => { const u = (t * 0.3) % 1; return { x: -0.3 + 0.04 * Math.sin(t * 3), y: -0.25 + 0.6 * u, s: 0.035 * Math.min(1, (1 - u) * 5) } } },
      { g: 'disc', c: '#e8fbff', m: (t) => { const u = (t * 0.3 + 0.5) % 1; return { x: 0.35 + 0.04 * Math.sin(t * 2.6), y: -0.25 + 0.6 * u, s: 0.025 * Math.min(1, (1 - u) * 5) } } },
    ],
  },
  {
    bg: ['#ff5f93', '#ff86ad'],
    items: [
      { g: 'heart', c: '#ffffff', m: (t) => ({ x: 0, y: -0.02, s: 0.17 * (1 + 0.16 * Math.max(0, Math.sin(t * 5.5)) ** 6) }) },
      { g: 'disc', c: '#ffd3e2', m: (t) => ({ x: 0.36 * Math.cos(t * 1.2), y: 0.2 * Math.sin(t * 1.2), s: 0.04 }) },
      { g: 'disc', c: '#ffd3e2', m: (t) => ({ x: -0.36 * Math.cos(t * 1.2), y: -0.2 * Math.sin(t * 1.2), s: 0.04 }) },
    ],
  },
]

const ease = (u) => {
  const x = Math.max(0, Math.min(1, u))
  return x * x * (3 - 2 * x)
}

function Car({ geo, color, L, refs, i }) {
  return (
    <group ref={(el) => (refs.car.current[i] = el)}>
      {/* wheels */}
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} geometry={geo.wheel} position={[x * 0.125, 0.045, z * 0.15]}>
          <Flat color="#25232b" />
        </mesh>
      ))}
      <mesh geometry={geo.body} position-y={0.1}>
        <Flat color={color} roughness={0.5} />
      </mesh>
      {/* cabin: glass under a roof */}
      <mesh geometry={geo.cabin} position={[0, 0.18, 0.04]}>
        <Flat color="#2b3550" roughness={0.25} />
      </mesh>
      <mesh geometry={geo.carRoof} position={[0, 0.225, 0.05]}>
        <Flat color={color} roughness={0.5} />
      </mesh>
      {/* tail fins and bumpers */}
      {[-1, 1].map((x) => (
        <mesh key={x} geometry={geo.fin} position={[x * 0.11, 0.15, 0.2]}>
          <Flat color={color} roughness={0.5} />
        </mesh>
      ))}
      {[-1, 1].map((z) => (
        <mesh key={z} geometry={geo.bumper} position={[0, 0.07, z * 0.255]}>
          <Flat color="#d8d8de" metalness={0.5} roughness={0.3} />
        </mesh>
      ))}
      {/* headlights (front, towards the screen) and tail lights */}
      {[-1, 1].map((x, k) => (
        <mesh key={x} geometry={geo.lamp} position={[x * 0.085, 0.11, -0.247]}>
          <meshStandardMaterial ref={(m) => (refs.head.current[i * 2 + k] = m)} color="#fff6d0" emissive="#fff0b0" emissiveIntensity={0.25} flatShading />
        </mesh>
      ))}
      {[-1, 1].map((x, k) => (
        <mesh key={x} geometry={geo.tail} position={[x * 0.1, 0.12, 0.246]}>
          <meshStandardMaterial ref={(m) => (refs.tail.current[i * 2 + k] = m)} color="#ff3a3a" emissive="#ff2a2a" emissiveIntensity={0.5} flatShading />
        </mesh>
      ))}
      <group position={[0, 0.11, -0.26]} rotation-y={Math.PI}>
        {[-1, 1].map((x, k) => (
          <Beam key={x} ref={(el) => (refs.beam.current[i * 2 + k] = el)} position-x={x * 0.085} rotation-x={-0.08} length={0.85} radius={0.16} color="#fff2c0" opacity={0} />
        ))}
      </group>
    </group>
  )
}

export function DriveInCinema({ look = 'retro' }) {
  const L = LOOKS[look] || LOOKS.retro
  const { tap, handlers, clock } = useTap(1.2)
  const bg = useRef()
  const items = useRef([])
  const glow = useRef()
  const beam = useRef()
  const bulbs = useRef([])
  const port = useRef()
  const refs = { car: useRef([]), head: useRef([]), tail: useRef([]), beam: useRef([]) }
  const st = useRef({ film: 0, last: null, switched: true })
  const c0 = useMemo(() => new THREE.Color(), [])
  const c1 = useMemo(() => new THREE.Color(), [])
  const white = useMemo(() => new THREE.Color('#ffffff'), [])

  const geo = useGeo(() => {
    const star = []
    for (let k = 0; k < 10; k++) {
      const a = Math.PI / 2 + (k * Math.PI) / 5
      const r = k % 2 ? 0.45 : 1
      star.push([Math.cos(a) * r, Math.sin(a) * r])
    }
    const heart = []
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * TAU
      heart.push([(16 * Math.sin(a) ** 3) / 16, (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 16])
    }
    return {
      grass: facet(new THREE.BoxGeometry(2.7, 0.1, 2.75, 6, 1, 6).translate(0, -0.05, 0.15), 0.025, 3, [1, 0.3, 1], (x, y) => y < -0.09),
      lot: new THREE.BoxGeometry(2.25, 0.03, 1.95).translate(0, 0.015, 0.33),
      box: new THREE.BoxGeometry(1, 1, 1),
      face: new THREE.PlaneGeometry(SW, SH),
      disc: new THREE.CircleGeometry(1, 12),
      tri: shapeGeo([[-1, 0], [1, 0], [0, 1]]),
      star: shapeGeo(star),
      heart: shapeGeo(heart),
      plane: new THREE.PlaneGeometry(1, 1),
      body: facet(new THREE.BoxGeometry(0.27, 0.09, 0.5, 2, 1, 3), 0.006, 5),
      cabin: new THREE.BoxGeometry(0.22, 0.08, 0.23),
      carRoof: facet(new THREE.BoxGeometry(0.24, 0.025, 0.26), 0.004, 6),
      fin: new THREE.BoxGeometry(0.025, 0.06, 0.12).translate(0, 0, 0).rotateX(-0.35),
      bumper: new THREE.BoxGeometry(0.28, 0.025, 0.02),
      wheel: new THREE.CylinderGeometry(0.045, 0.045, 0.04, 8, 1).rotateZ(Math.PI / 2),
      lamp: new THREE.CylinderGeometry(0.022, 0.022, 0.012, 8, 1).rotateX(Math.PI / 2),
      tail: new THREE.BoxGeometry(0.04, 0.025, 0.012),
      speaker: facet(new THREE.BoxGeometry(0.07, 0.06, 0.045), 0.004, 7),
      pole: new THREE.CylinderGeometry(0.012, 0.012, 0.24, 5, 1).translate(0, 0.12, 0),
      bulb: new THREE.IcosahedronGeometry(0.018, 0),
      lens: new THREE.CylinderGeometry(0.035, 0.045, 0.08, 8, 1).rotateX(Math.PI / 2),
      bush: blob(0.16, 9, 1),
      hit: new THREE.BoxGeometry(2.5, 1.5, 2.5).translate(0, 0.7, 0.15),
    }
  }, [])

  const dust = useMemo(() => {
    const a = new THREE.Vector3(LENS[0], LENS[1], LENS[2] - 0.05)
    const b = new THREE.Vector3(SCREEN[0], SCREEN[1], SCREEN[2] + 0.05)
    return (u) => a.clone().lerp(b, u * 0.85)
  }, [])
  const beamRot = useMemo(() => {
    const d = new THREE.Vector3(...SCREEN).sub(new THREE.Vector3(...LENS))
    return [-Math.asin(d.y / d.length()), Math.atan2(d.x, d.z), d.length()]
  }, [])

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const S = st.current
    // a new tap: flash the screen, then roll the next film
    if (S.last !== null && s < S.last) S.switched = false
    S.last = s
    if (!S.switched && s >= 0.18) {
      S.film = (S.film + 1) % FILMS.length
      S.switched = true
    }
    const F = FILMS[S.film]
    const flash = s >= 0 && s < 0.4 ? Math.max(0, 1 - Math.abs(s - 0.18) / 0.2) : 0

    // the screen flickers like old film
    const dip = (t * 1.3) % 3.7 < 0.06 ? 0.7 : 1
    const f = (0.92 + 0.06 * Math.sin(t * 31) * Math.sin(t * 7.3)) * dip
    c0.set(F.bg[0]).lerp(c1.set(F.bg[1]), 0.5 + 0.5 * Math.sin(t * 0.9)).multiplyScalar(f).lerp(white, flash)
    bg.current.color.copy(c0)
    glow.current.color.copy(c0)
    glow.current.intensity = 2.2 * f + 3 * flash

    let n = 0
    FILMS.forEach((film, fi) =>
      film.items.forEach((it) => {
        const m = items.current[n++]
        if (!m) return
        m.visible = fi === S.film && flash < 0.5
        if (!m.visible) return
        const p = it.m(t)
        m.position.set(p.x, p.y, 0.004 * (film.items.indexOf(it) + 1))
        m.rotation.z = p.r || 0
        m.scale.set(Math.max(0.001, p.sx ?? p.s), Math.max(0.001, p.sy ?? p.s), 1)
      }),
    )

    // the projector beam shimmers
    beam.current.material.opacity = 0.2 + 0.04 * Math.sin(t * 23) + 0.03 * Math.sin(t * 9.7) + 0.2 * flash
    port.current.emissiveIntensity = 1.3 + 0.3 * Math.sin(t * 23) + 2 * flash

    // the marquee bulbs chase round
    bulbs.current.forEach((m, i) => m && (m.emissiveIntensity = (i + Math.floor(t * 6)) % 3 === 0 ? 2.2 : 0.35))

    // on a tap the cars flash their headlights and hop as they honk
    const on = s >= 0 && s < 1.5 && Math.floor(s * 5) % 2 === 0 ? 1 : 0
    refs.head.current.forEach((m) => m && (m.emissiveIntensity = 0.25 + 3 * on))
    refs.tail.current.forEach((m) => m && (m.emissiveIntensity = 0.5 + 1.5 * on))
    refs.beam.current.forEach((m) => m && (m.material.opacity = 0.32 * on))
    refs.car.current.forEach((g, i) => {
      if (!g) return
      const u = s - i * 0.12
      const hop = u >= 0 && u < 1.4 ? Math.abs(Math.sin(u * 9)) * Math.exp(-2.5 * u) : 0
      g.position.y = 0.05 * hop
      g.rotation.x = -0.06 * hop
    })
  })

  const filmItems = FILMS.flatMap((film) => film.items)
  const glowMat = (props) => (L.neon ? { emissive: props.color, emissiveIntensity: 0.9 } : {})

  return (
    <group {...handlers}>
      <mesh geometry={geo.hit}>
        <meshBasicMaterial visible={false} />
      </mesh>
      <mesh geometry={geo.grass}>
        <Flat color={L.grass} />
      </mesh>
      <mesh geometry={geo.lot}>
        <Flat color={L.lot} roughness={0.95} />
      </mesh>
      {[
        [-1.15, -0.95, 1.1],
        [1.12, -1.0, 0.9],
        [-1.18, 1.3, 0.8],
        [1.2, 1.28, 1],
      ].map(([x, z, k], i) => (
        <mesh key={i} geometry={geo.bush} position={[x, 0.06, z]} scale={[k, k * 0.75, k]}>
          <Flat color={i % 2 ? L.grass2 : L.grass} />
        </mesh>
      ))}

      {/* the screen on its posts, braced behind */}
      <group position={SCREEN}>
        <mesh geometry={geo.box} position-z={-0.035} scale={[SW + 0.1, SH + 0.1, 0.06]}>
          <Flat color={L.frame} {...glowMat({ color: L.trim })} />
        </mesh>
        <mesh geometry={geo.box} position={[0, SH / 2 + 0.07, -0.035]} scale={[SW + 0.2, 0.05, 0.1]}>
          <Flat color={L.trim} />
        </mesh>
        <mesh geometry={geo.face} position-z={0.0}>
          <meshBasicMaterial ref={bg} color={FILMS[0].bg[0]} />
        </mesh>
        {filmItems.map((it, i) => (
          <mesh key={i} ref={(el) => (items.current[i] = el)} geometry={it.g === 'box' ? geo.plane : geo[it.g]}>
            <meshBasicMaterial color={it.c} />
          </mesh>
        ))}
        <pointLight ref={glow} position={[0, -0.1, 0.9]} distance={3} decay={1.6} intensity={2} />
      </group>
      {[-0.6, 0, 0.6].map((x) => (
        <group key={x} position={[x, 0, SCREEN[2] - 0.06]}>
          <mesh geometry={geo.box} position-y={0.29} scale={[0.07, 0.58, 0.07]}>
            <Flat color={L.post} />
          </mesh>
          <mesh geometry={geo.box} position={[0, 0.48, -0.2]} rotation-x={-0.75} scale={[0.04, 0.62, 0.04]}>
            <Flat color={L.post} />
          </mesh>
        </group>
      ))}
      <mesh geometry={geo.box} position={[0, 0.5, SCREEN[2] - 0.09]} scale={[1.3, 0.04, 0.04]}>
        <Flat color={L.post} />
      </mesh>

      {/* the parked cars, their bays and speaker posts */}
      {CARS.map((c, i) => (
        <group key={i} position={[c.x, 0.03, c.z]}>
          {[-1, 1].map((x) => (
            <mesh key={x} geometry={geo.box} position={[x * 0.31, 0.003, 0]} scale={[0.025, 0.004, 0.6]}>
              <Flat color={L.line} {...glowMat({ color: L.line })} />
            </mesh>
          ))}
          <group position={[0.31, 0, -0.1]}>
            <mesh geometry={geo.pole}>
              <Flat color="#6c6872" />
            </mesh>
            <mesh geometry={geo.speaker} position-y={0.25}>
              <Flat color="#3c3a44" />
            </mesh>
          </group>
          <group rotation-y={c.ry}>
            <Car geo={geo} color={L.cars[i]} L={L} refs={refs} i={i} />
          </group>
        </group>
      ))}

      {/* the projector booth */}
      <group position={BOOTH} rotation-y={BOOTH_RY}>
        <mesh geometry={geo.box} position-y={0.2} scale={[0.56, 0.4, 0.38]}>
          <Flat color={L.booth} />
        </mesh>
        <mesh geometry={geo.box} position-y={0.42} scale={[0.64, 0.04, 0.46]}>
          <Flat color={L.roof} />
        </mesh>
        <mesh geometry={geo.box} position={[0, 0.27, -0.19]} scale={[0.16, 0.1, 0.02]}>
          <Flat color="#2a2630" />
        </mesh>
        <mesh geometry={geo.lens} position={[0, 0.27, -0.2]}>
          <meshStandardMaterial ref={port} color={L.beam} emissive={L.beam} emissiveIntensity={1.4} flatShading />
        </mesh>
        {/* the snack bar side: a door and a striped awning */}
        <mesh geometry={geo.box} position={[0.12, 0.12, 0.192]} scale={[0.1, 0.22, 0.01]}>
          <Flat color={L.roof} />
        </mesh>
        <mesh geometry={geo.box} position={[-0.11, 0.2, 0.192]} scale={[0.18, 0.1, 0.01]}>
          <meshStandardMaterial color={L.bulb} emissive={L.bulb} emissiveIntensity={0.9} flatShading />
        </mesh>
        {Array.from({ length: 6 }, (_, k) => (
          <mesh key={k} geometry={geo.box} position={[-0.25 + k * 0.1, 0.3, 0.25]} rotation-x={0.5} scale={[0.1, 0.012, 0.15]}>
            <Flat color={L.awning[k % 2]} />
          </mesh>
        ))}
        {/* the marquee on the roof, ringed with chasing bulbs */}
        <group position={[0, 0.58, 0.05]}>
          <mesh geometry={geo.box} scale={[0.5, 0.22, 0.04]}>
            <Flat color={L.trim} {...glowMat({ color: L.trim })} />
          </mesh>
          <mesh geometry={geo.box} position-z={0.022} scale={[0.4, 0.12, 0.01]}>
            <Flat color={L.booth} />
          </mesh>
          {[-0.12, 0, 0.12].map((x) => (
            <mesh key={x} geometry={geo.box} position={[x, 0, 0.03]} scale={[0.07, 0.05, 0.01]}>
              <Flat color={L.trim} />
            </mesh>
          ))}
          {Array.from({ length: 16 }, (_, k) => {
            // round the board's rim, both faces
            const side = k < 8 ? 1 : -1
            const j = k % 8
            const x = -0.21 + (j % 4) * 0.14
            const y = j < 4 ? 0.1 : -0.1
            return (
              <mesh key={k} geometry={geo.bulb} position={[x, y, side * 0.03]}>
                <meshStandardMaterial ref={(m) => (bulbs.current[k] = m)} color={L.bulb} emissive={L.bulb} emissiveIntensity={0.4} flatShading />
              </mesh>
            )
          })}
          {[-1, 1].map((x) => (
            <mesh key={x} geometry={geo.box} position={[x * 0.18, -0.12, 0]} scale={[0.025, 0.08, 0.025]}>
              <Flat color={L.roof} />
            </mesh>
          ))}
        </group>
      </group>

      {/* the projector beam and the dust drifting through it */}
      <group position={LENS}>
        <Beam ref={beam} rotation={[beamRot[0], beamRot[1], 0, 'YXZ']} length={beamRot[2] - 0.05} radius={0.6} color={L.beam} opacity={0.2} />
      </group>
      <Flow path={dust} count={16} speed={0.12} width={0.35} size={0.01} stretch={1} colors={[L.beam]} opacity={0.7} emissive={1} seed={4} />
    </group>
  )
}

export default function DriveInCinemaScene({ background, autoRotate, float, look = 'retro', ...props }) {
  // the library's pale default would wash out the evening, so swap it for the look's own sky
  const sky = !background || background.toLowerCase() === '#eceaf1' ? (LOOKS[look] || LOOKS.retro).sky : background
  return (
    <Stage background={sky} autoRotate={autoRotate} float={float} camera={[3.4, 2.5, 4.9]} target={[0, 0.5, 0]} hint="The screen plays a little cartoon and flickers like old film, the projector beam shimmers and the marquee bulbs chase on their own · tap it and the cars flash their headlights and hop as they honk, and the next film comes on · Look swaps retro, neon and dusk · drag to orbit">
      <DriveInCinema look={look} {...props} />
    </Stage>
  )
}

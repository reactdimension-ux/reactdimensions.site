import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Stage, TAU, cone, rng, terrainGeo, useGeo, useTap } from './kit.jsx'

// A low-poly patch of snowy hills under the northern lights: a flat snowy
// shelf with a frozen lake on it, two faceted hills behind, a stand of dark
// pines in silhouette, and above them three wide curtains of aurora that
// glow brightest along their lower hems and fade away to nothing at the top.
// Stars twinkle round the sky. Left alone, the curtains ripple and fold in
// slow waves along their length, bands of light running through them. Tap
// it and the aurora flares: the curtains blaze brighter, stretch taller and
// ripple faster for a couple of seconds, and a spray of sparkles bursts out.

const LOOKS = {
  green: { sky: ['#5dffa8', '#2fe0b0', '#8a5cff'], alt: ['#9dff6a', '#3dffb0', '#ff6fd0'], snow: ['#c6d3e6', '#dbe4f1', '#eef3fa'], pine: '#16262a', lake: '#7da6cc', spark: ['#c8ffe0', '#ffffff', '#b89cff'] },
  violet: { sky: ['#c08aff', '#8f5cff', '#ff6fd0'], alt: ['#ff8ae6', '#a070ff', '#5fb8ff'], snow: ['#cac6e4', '#ddd9f0', '#f0eefa'], pine: '#1b1830', lake: '#9a92d0', spark: ['#f0d8ff', '#ffffff', '#ff9ae6'] },
  pink: { sky: ['#ff6fb8', '#ff9ad6', '#9a6cff'], alt: ['#ffb070', '#ff70a8', '#c08aff'], snow: ['#e0cad8', '#ecdce6', '#faf0f5'], pine: '#2a1a26', lake: '#c494b8', spark: ['#ffd8ec', '#ffffff', '#ffc0a0'] },
  arctic: { sky: ['#7ff0ff', '#5fbfff', '#c9f4ff'], alt: ['#8affd8', '#6fa8ff', '#e8fbff'], snow: ['#c4d6ea', '#d8e6f4', '#eef6fd'], pine: '#13232e', lake: '#8ac4e4', spark: ['#e0fbff', '#ffffff', '#a8e4ff'] },
}

const COLS = 30 // columns along each curtain
const ROWS = 6 // rows up each curtain
// each curtain: width, depth, base height, height, bend, colour set and phase
const CURTAINS = [
  { w: 2.9, z: -0.6, y: 0.78, h: 1.45, bend: 0.4, set: 'sky', ph: 0, k: 1.6 },
  { w: 2.5, z: -1.15, y: 0.95, h: 1.25, bend: -0.3, set: 'alt', ph: 2.1, k: 1.2 },
  { w: 2.0, z: -0.05, y: 1.2, h: 0.95, bend: 0.3, set: 'sky', ph: 4.2, k: 2.0 },
]
const PINES = [
  [-0.55, 0.3, 0.42],
  [-0.72, -0.08, 0.34],
  [-0.38, 0.68, 0.28],
  [0.78, -0.12, 0.4],
  [0.62, 0.22, 0.3],
  [-0.15, -0.3, 0.36],
]
const SHELF = 0.12 // the flat top of the snowy shelf
const STARS = 40

// A curtain of light: a grid of quads COLS along by ROWS up, its vertex
// colours carrying alpha so the hem is bright and the top fades out.
function curtainGeo() {
  const g = new THREE.BufferGeometry()
  const n = (COLS + 1) * (ROWS + 1)
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 4), 4))
  const idx = []
  const at = (i, j) => j * (COLS + 1) + i
  for (let j = 0; j < ROWS; j++)
    for (let i = 0; i < COLS; i++) idx.push(at(i, j), at(i + 1, j), at(i, j + 1), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1))
  g.setIndex(idx)
  return g
}

const _c = new THREE.Color()
const _a = new THREE.Color()
const _b = new THREE.Color()

export function Aurora({ look = 'green' }) {
  const L = LOOKS[look] || LOOKS.green
  const { tap, handlers, clock } = useTap(0.8)
  const stars = useRef([])
  const lake = useRef()
  const glow = useRef()
  const phase = useRef(0)
  const geo = useGeo(
    () => ({
      curtains: CURTAINS.map(curtainGeo),
      shelf: terrainGeo({ radius: 1.55, height: SHELF, seed: 6, rings: 5, segs: 16, rough: 0.08, profile: 'mesa', bands: [[0, L.snow[1]]] }),
      hillA: terrainGeo({ radius: 0.8, height: 0.62, seed: 11, rings: 4, segs: 10, rough: 0.2, profile: 'peak', bands: [[0, L.snow[0]], [0.4, L.snow[1]], [0.75, L.snow[2]]] }),
      hillB: terrainGeo({ radius: 0.66, height: 0.46, seed: 17, rings: 4, segs: 9, rough: 0.2, profile: 'peak', bands: [[0, L.snow[0]], [0.45, L.snow[1]], [0.8, L.snow[2]]] }),
      lake: new THREE.CircleGeometry(0.36, 9).rotateX(-Math.PI / 2),
      tier: [0, 1, 2].map((i) => cone(0.13 - i * 0.03, 0.2, 6, 30 + i)),
      trunk: new THREE.CylinderGeometry(0.018, 0.024, 0.08, 5).translate(0, 0.04, 0),
      star: new THREE.OctahedronGeometry(1, 0),
      hit: new THREE.BoxGeometry(3, 2.6, 2.6).translate(0, 1.2, -0.2),
    }),
    [look],
  )
  // the stars, scattered over a dome behind and above the hills
  const S = useMemo(() => {
    const r = rng(23)
    return Array.from({ length: STARS }, () => {
      const a = r() * TAU
      const e = 0.35 + r() * 0.9
      const d = 2.3 + r() * 0.6
      return { p: [Math.cos(a) * Math.cos(e) * d, 0.6 + Math.sin(e) * d * 0.85, Math.sin(a) * Math.cos(e) * d], s: 0.012 + r() * 0.02, rate: 1 + r() * 2.5, ph: r() * TAU }
    })
  }, [])
  // the three colours each curtain runs through, bottom to top
  const cols = useMemo(() => CURTAINS.map((c) => L[c.set].map((x) => new THREE.Color(x))), [L])

  useFrame((_, dt) => {
    const t = clock.elapsedTime
    const k = tap.value(t)
    const sp = 1 + 2.6 * k
    phase.current += Math.min(dt, 0.05) * sp
    const ph = phase.current
    CURTAINS.forEach((c, n) => {
      const g = geo.curtains[n]
      const p = g.attributes.position
      const col = g.attributes.color
      const [c0, c1, c2] = cols[n]
      const H = c.h * (1 + 0.5 * k)
      for (let j = 0; j <= ROWS; j++) {
        const v = j / ROWS
        // bottom to middle to top colour
        if (v < 0.5) _c.copy(c0).lerp(c1, v * 2)
        else _c.copy(c1).lerp(c2, (v - 0.5) * 2)
        for (let i = 0; i <= COLS; i++) {
          const u = i / COLS
          const id = j * (COLS + 1) + i
          // the curtain folds in waves running along it, more at the top
          const wave = Math.sin(u * c.k * TAU - ph * 1.1 + c.ph) * 0.16 + Math.sin(u * c.k * 2.3 * TAU + ph * 0.7 + c.ph * 2) * 0.06
          const x = (u - 0.5) * c.w + Math.sin(u * 7 + ph * 0.9 + c.ph) * 0.04 * v
          const z = c.z + c.bend * Math.cos((u - 0.5) * Math.PI) + wave * (0.6 + v * 1.1)
          const y = c.y + Math.sin(u * 5 + ph * 0.8 + c.ph) * 0.05 + v * H * (1 + 0.12 * Math.sin(u * 6 - ph * 1.3 + c.ph))
          p.setXYZ(id, x, y, z)
          // brightest along the hem, fading up and out at both ends, with
          // bands of light running along
          const hem = v < 0.12 ? 0.35 + (v / 0.12) * 0.65 : 1
          const fade = hem * (1 - v) ** 1.05 * Math.sin(Math.PI * u) ** 0.7
          const band = (0.6 + 0.4 * Math.sin(u * 11 - ph * 2 + c.ph) * Math.sin(u * 4.3 + ph * 0.6)) * (0.75 + 0.25 * Math.sin(u * 37 + c.ph * 3 - ph * 0.5))
          col.setXYZW(id, _c.r, _c.g, _c.b, Math.min(1, fade * band * (0.8 + 1.1 * k)))
        }
      }
      p.needsUpdate = true
      col.needsUpdate = true
    })
    // stars twinkle
    S.forEach((s, i) => {
      const m = stars.current[i]
      if (m) m.scale.setScalar(s.s * (0.55 + 0.45 * Math.sin(t * s.rate + s.ph)) * (1 + k * 0.6))
    })
    // the frozen lake and the snow catch the light of the aurora
    _a.copy(cols[0][0])
    _b.copy(cols[1][0])
    _a.lerp(_b, 0.5 + 0.5 * Math.sin(t * 0.7))
    if (lake.current) {
      lake.current.material.emissive.copy(_a)
      lake.current.material.emissiveIntensity = 0.2 + 0.6 * k
    }
    if (glow.current) {
      glow.current.color.copy(_a)
      glow.current.intensity = 2.2 + 5 * k
    }
  })

  return (
    <group {...handlers}>
      {/* the snowy shelf, the hills behind and the frozen lake */}
      <mesh geometry={geo.shelf}>
        <Flat vertexColors color="#ffffff" roughness={0.9} />
      </mesh>
      <mesh geometry={geo.hillA} position={[-0.55, 0, -0.6]}>
        <Flat vertexColors color="#ffffff" roughness={0.9} />
      </mesh>
      <mesh geometry={geo.hillB} position={[0.5, 0, -0.78]}>
        <Flat vertexColors color="#ffffff" roughness={0.9} />
      </mesh>
      <mesh ref={lake} geometry={geo.lake} position={[0.22, SHELF + 0.025, 0.36]}>
        <Flat color={L.lake} roughness={0.15} metalness={0.25} emissive={L.sky[0]} emissiveIntensity={0.2} />
      </mesh>
      {/* dark pines in silhouette */}
      {PINES.map(([x, z, h], i) => (
        <group key={i} position={[x, SHELF - 0.01, z]} scale={h / 0.36} rotation-y={i * 1.7}>
          <mesh geometry={geo.trunk}>
            <Flat color="#2a1e1a" />
          </mesh>
          {geo.tier.map((g, j) => (
            <mesh key={j} geometry={g} position-y={0.06 + j * 0.1}>
              <Flat color={L.pine} roughness={0.95} />
            </mesh>
          ))}
        </group>
      ))}
      {/* the aurora curtains */}
      {geo.curtains.map((g, i) => (
        <mesh key={i} geometry={g} frustumCulled={false} renderOrder={2}>
          <meshBasicMaterial vertexColors transparent blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      ))}
      <pointLight ref={glow} position={[0, 1.4, -0.4]} distance={4} decay={1.6} intensity={2.2} />
      {/* stars */}
      {S.map((s, i) => (
        <mesh key={i} ref={(el) => (stars.current[i] = el)} geometry={geo.star} position={s.p} scale={s.s}>
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
      ))}
      <Burst tap={tap} geometry={geo.star} count={18} colors={L.spark} speed={1.3} gravity={0} size={0.05} life={1.3} origin={[0, 1.6, -0.5]} spread={1.2} up={0.7} />
      <mesh geometry={geo.hit}>
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}

export default function AuroraScene({ background = '#1c2333', autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[3.6, 2.2, 4.8]} target={[0, 1.05, 0]} hint="Curtains of aurora ripple across the sky over the snowy hills while the stars twinkle · tap it and the aurora flares brighter, taller and faster with a burst of sparkles · Look swaps green, violet, pink and arctic · drag to orbit">
      <Aurora {...props} />
    </Stage>
  )
}

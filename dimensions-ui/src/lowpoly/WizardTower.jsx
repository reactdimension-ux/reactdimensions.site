import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Cloth, Flat, Particles, Stage, TAU, blob, facet, rng, terrainGeo, useGeo, useTap } from './kit.jsx'

// A low-poly wizard tower on a floating rocky island: four crooked stone
// segments stacked off true, each leaning its own way on a corbelled ledge,
// with pointed glowing windows, two little railed balconies, a door with
// steps, and a tall bent cone roof with a pennant flying from its tip.
// A crystal floats beside it, ringed by tiny orbiting shards; glowing
// mushrooms and loose rocks drift round the island. Left alone, the windows
// glow and pulse, the crystal bobs and turns and sparkles drift up. Tap it
// and a ribbon of sparks spirals up round the tower and bursts into three
// fireworks above the roof, while every window flares.

const LOOKS = {
  arcane: { sky: '#1d1836', stone: ['#8a86a8', '#7a7699', '#9a96b6'], ledge: '#5d5980', roof: '#4b3a8c', roof2: '#5d4aa6', glow: '#b27cff', orb: '#4fd2ff', flag: '#ffd24a', grass: ['#3f6a5a', '#4a7a64', '#568a6e'], rock: ['#6e6a8a', '#7e7a9a'], wood: '#5a4636', shells: ['#ff7ad9', '#7fe3ff', '#ffd24a'] },
  emerald: { sky: '#10251f', stone: ['#9aa69a', '#8a968a', '#aab6a8'], ledge: '#5f6e62', roof: '#2f7a55', roof2: '#3a9066', glow: '#5ef08e', orb: '#2fe8a8', flag: '#f2c94a', grass: ['#3d6e3a', '#4a8044', '#58904e'], rock: ['#6a7468', '#7a8476'], wood: '#5a4636', shells: ['#5affc8', '#f2e86a', '#ffffff'] },
  ember: { sky: '#26140f', stone: ['#a08a7c', '#90796c', '#b29c8c'], ledge: '#6a4e44', roof: '#8c2f2a', roof2: '#a63c32', glow: '#ffa030', orb: '#ff7a3a', flag: '#ffe08a', grass: ['#6a6a3a', '#7a7840', '#888646'], rock: ['#6e5a52', '#806a60'], wood: '#4a3428', shells: ['#ff8a3a', '#ffd04a', '#ff4a5a'] },
}

const ISLE = 0.62 // the island's rim height
const ISLE_R = 1.02
const SEGS = [
  { r0: 0.37, r1: 0.33, h: 0.46, tilt: [0, 0], off: 0 },
  { r0: 0.32, r1: 0.29, h: 0.38, tilt: [0.07, 0.13], off: 0.035 },
  { r0: 0.28, r1: 0.25, h: 0.34, tilt: [-0.08, -0.17], off: -0.04 },
  { r0: 0.24, r1: 0.22, h: 0.28, tilt: [0.06, 0.15], off: 0.03 },
]
const ROOF_H = 0.68
const ROOF_BEND = 0.13
const ORB = [0.72, 2.05, 0.2]
const SPARKS = 18
const RISE = 1.3 // seconds for a spark to spiral to the top
const SHELLS = [
  { at: 1.35, p: [0.1, 2.85, 0.1] },
  { at: 1.6, p: [-0.7, 2.45, 0.35] },
  { at: 1.85, p: [0.7, 2.55, -0.3] },
]
const CHIPS = 22

// a pointed (lancet) window outline, base on y = 0
function lancet(w, h) {
  const s = new THREE.Shape()
  s.moveTo(-w, 0)
  s.lineTo(w, 0)
  s.lineTo(w, h)
  s.lineTo(w * 0.55, h + w * 0.75)
  s.lineTo(0, h + w * 1.25)
  s.lineTo(-w * 0.55, h + w * 0.75)
  s.lineTo(-w, h)
  s.closePath()
  return new THREE.ShapeGeometry(s)
}

// a stack of n segments, each standing on the one before
function Stack({ i, children, geo, L, glows }) {
  if (i >= SEGS.length) return children
  const S = SEGS[i]
  const mid = (S.r0 + S.r1) / 2
  const wins = i === 0 ? [0.9, -1.4, 2.7] : [0.5 + i * 1.3, 2.6 + i * 1.1, 4.5 + i * 0.9]
  return (
    <group>
      <mesh geometry={geo.seg[i]}>
        <Flat color={L.stone[i % 3]} />
      </mesh>
      {/* jutting stones */}
      {geo.blocks[i].map(([a, y], k) => (
        <mesh key={k} geometry={geo.block} position={[Math.sin(a) * (mid + 0.005), y, Math.cos(a) * (mid + 0.005)]} rotation-y={a}>
          <Flat color={L.stone[(i + k + 1) % 3]} />
        </mesh>
      ))}
      {wins.map((a, k) => (
        <group key={k} position={[Math.sin(a) * (mid + 0.012), S.h * 0.38, Math.cos(a) * (mid + 0.012)]} rotation-y={a}>
          <mesh geometry={geo.winFrame} position={[0, -0.012, -0.002]}>
            <Flat color={L.ledge} side={THREE.DoubleSide} />
          </mesh>
          <mesh geometry={geo.win}>
            <meshStandardMaterial ref={(m) => (glows.current[i * 3 + k] = m)} color={L.glow} emissive={L.glow} emissiveIntensity={1.3} flatShading side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      {/* the ledge it ends in, then the next segment, set off true */}
      <group position-y={S.h}>
        <mesh geometry={geo.ledge[i]}>
          <Flat color={L.ledge} />
        </mesh>
        {(i === 1 || i === 2) && <Balcony geo={geo} L={L} r={S.r1} a={i === 1 ? 0.25 : -2.2} />}
        <group position={[SEGS[i + 1] ? SEGS[i + 1].off : 0, 0.03, 0]} rotation={SEGS[i + 1] ? [SEGS[i + 1].tilt[0], 0, SEGS[i + 1].tilt[1]] : [0, 0, 0]}>
          <Stack i={i + 1} geo={geo} L={L} glows={glows}>
            {children}
          </Stack>
        </group>
      </group>
    </group>
  )
}

function Balcony({ geo, L, r, a }) {
  return (
    <group rotation-y={a}>
      <group position-z={r}>
        <mesh geometry={geo.deck}>
          <Flat color={L.wood} />
        </mesh>
        <mesh geometry={geo.rail} position-y={0.1}>
          <Flat color={L.wood} />
        </mesh>
        {[-1.2, -0.6, 0, 0.6, 1.2].map((b) => (
          <mesh key={b} geometry={geo.post} position={[Math.sin(b) * 0.15, 0.05, Math.cos(b) * 0.15 - 0.02]}>
            <Flat color={L.wood} />
          </mesh>
        ))}
        {[-1, 1].map((x) => (
          <mesh key={x} geometry={geo.strut} position={[x * 0.08, -0.06, 0.04]} rotation-x={0.7}>
            <Flat color={L.wood} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

export function WizardTower({ look = 'arcane' }) {
  const L = LOOKS[look] || LOOKS.arcane
  const { tap, handlers, clock } = useTap(1)
  const glows = useRef([])
  const orb = useRef()
  const orbMat = useRef()
  const shards = useRef()
  const lamp = useRef()
  const rocks = useRef([])
  const sparks = useRef([])
  const chips = useRef([])
  const flashes = useRef([])
  const shrooms = useRef([])

  const geo = useGeo(() => {
    const r = rng(17)
    const roof = new THREE.ConeGeometry(0.32, ROOF_H, 8, 3).translate(0, ROOF_H / 2, 0)
    const p = roof.attributes.position
    for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + ROOF_BEND * Math.max(0, p.getY(i) / ROOF_H) ** 2.2)
    roof.computeVertexNormals()
    const under = facet(new THREE.ConeGeometry(ISLE_R, 0.58, 14, 3).rotateX(Math.PI).translate(0, -0.29, 0), 0.06, 12, [1, 0.6, 1], (x, y) => y > -0.001)
    return {
      top: terrainGeo({ radius: ISLE_R, height: 0.14, seed: 6, rings: 4, segs: 14, rough: 0.12, profile: 'dome', bands: [[0, L.grass[0]], [0.45, L.grass[1]], [0.8, L.grass[2]]] }),
      under,
      seg: SEGS.map((S, i) => facet(new THREE.CylinderGeometry(S.r1, S.r0, S.h, 9, 2).translate(0, S.h / 2, 0), 0.008, 3 + i)),
      ledge: SEGS.map((S, i) => facet(new THREE.CylinderGeometry(S.r1 + 0.045, S.r1 + 0.005, 0.06, 9, 1).translate(0, 0.0, 0), 0.006, 20 + i)),
      blocks: SEGS.map((S) => Array.from({ length: 5 }, () => [r() * TAU, 0.06 + r() * (S.h - 0.14)])),
      block: new THREE.BoxGeometry(0.09, 0.05, 0.03),
      win: lancet(0.042, 0.085),
      winFrame: lancet(0.06, 0.1),
      roof: facet(roof, 0.004, 30),
      brim: facet(new THREE.CylinderGeometry(0.34, 0.3, 0.05, 8, 1), 0.006, 31),
      pole: new THREE.CylinderGeometry(0.008, 0.008, 0.26, 4, 1).translate(0, 0.13, 0),
      deck: new THREE.CylinderGeometry(0.17, 0.17, 0.025, 8, 1, false, -Math.PI / 2, Math.PI),
      rail: new THREE.TorusGeometry(0.15, 0.008, 3, 8, Math.PI).rotateX(Math.PI / 2),
      post: new THREE.BoxGeometry(0.012, 0.1, 0.012),
      strut: new THREE.BoxGeometry(0.02, 0.14, 0.02),
      door: lancet(0.07, 0.12),
      step: new THREE.BoxGeometry(1, 1, 1),
      crystal: facet(new THREE.OctahedronGeometry(0.13, 0).scale(1, 1.7, 1), 0.006, 40),
      shard: new THREE.OctahedronGeometry(0.03, 0).scale(1, 1.6, 1),
      halo: new THREE.TorusGeometry(0.24, 0.006, 3, 24).rotateX(Math.PI / 2),
      rock: blob(0.1, 41, 0),
      bush: blob(0.1, 42, 1),
      stem: new THREE.CylinderGeometry(0.012, 0.016, 0.06, 5, 1).translate(0, 0.03, 0),
      cap: facet(new THREE.SphereGeometry(0.045, 6, 2, 0, TAU, 0, Math.PI / 2), 0.003, 43),
      spark: new THREE.OctahedronGeometry(1, 0),
      chip: new THREE.TetrahedronGeometry(1, 0),
      hit: new THREE.CylinderGeometry(0.55, 0.9, 2.6, 8, 1).translate(0, 1.2, 0),
    }
  }, [look])

  const swirl = useMemo(() => {
    const r = rng(5)
    return Array.from({ length: SPARKS }, (_, k) => ({ d: k * 0.045, a: (k % 3) * (TAU / 3) + r() * 0.3, c: [L.glow, L.orb, '#ffffff'][k % 3] }))
  }, [L])
  const shells = useMemo(() => {
    // directions spread evenly round a sphere
    const dirs = Array.from({ length: CHIPS }, (_, k) => {
      const y = 1 - (2 * (k + 0.5)) / CHIPS
      const rr = Math.sqrt(1 - y * y)
      const a = k * 2.39996
      return [Math.cos(a) * rr, y, Math.sin(a) * rr]
    })
    return SHELLS.map((S, i) => ({ ...S, c: L.shells[i], dirs }))
  }, [L])
  const floaters = useMemo(
    () =>
      [
        [1.35, 0.45, 0.9, 0.0],
        [1.5, 0.75, 0.6, 2.2],
        [1.3, 0.25, 0.7, 4.1],
      ].map(([rad, y, s, a]) => ({ rad, y, s, a })),
    [],
  )

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const k = tap.value(t)
    const fw = s >= 0 && s < 3.4 ? Math.max(0, 1 - Math.abs(s - 1.7) / 1.4) : 0

    // the windows glow and pulse, each on its own beat, and flare on a tap
    glows.current.forEach((m, i) => m && (m.emissiveIntensity = 0.55 + 0.6 * (0.5 + 0.5 * Math.sin(t * 1.4 + i * 1.7)) + 0.12 * Math.sin(t * 5.3 + i) + 1.6 * fw))

    // the crystal floats and turns, its shards wheel round it
    orb.current.position.y = ORB[1] + 0.08 * Math.sin(t * 1.3) + 0.25 * k
    orb.current.rotation.y = t * 0.8 + k * 6
    shards.current.rotation.y = -t * 1.2
    shards.current.rotation.z = 0.25 * Math.sin(t * 0.7)
    orbMat.current.emissiveIntensity = 0.45 + 0.2 * Math.sin(t * 2.2) + 1.2 * k
    lamp.current.intensity = 1.6 + 0.4 * Math.sin(t * 2.2) + 4 * fw

    // loose rocks drift round the island
    rocks.current.forEach((m, i) => {
      if (!m) return
      const F = floaters[i]
      const a = F.a + t * 0.12
      m.position.set(Math.cos(a) * F.rad, F.y + 0.06 * Math.sin(t * 0.9 + i * 2), Math.sin(a) * F.rad)
      m.rotation.set(t * 0.3 + i, t * 0.2, 0)
    })
    shrooms.current.forEach((m, i) => m && (m.emissiveIntensity = 0.8 + 0.5 * Math.sin(t * 1.8 + i * 2.1) + 1.5 * fw))

    // the sparks spiral up round the tower
    sparks.current.forEach((m, j) => {
      if (!m) return
      const k2 = Math.floor(j / 3)
      const lag = (j % 3) * 0.035
      const S = swirl[k2]
      const u = (s - S.d - lag) / RISE
      m.visible = s >= 0 && u > 0 && u < 1
      if (!m.visible) return
      const ang = S.a + u * TAU * 1.6
      const rad = 0.62 - 0.4 * u
      m.position.set(Math.cos(ang) * rad, ISLE + 0.2 + u * 2.3, Math.sin(ang) * rad)
      m.scale.setScalar(0.028 * (1 - (j % 3) * 0.3) * Math.min(1, u * 8))
      m.rotation.set(t * 8, t * 6, 0)
    })

    // and burst into fireworks above the roof
    let n = 0
    shells.forEach((S, si) => {
      const tau = s - S.at
      const life = 1.3
      const live = s >= 0 && tau > 0 && tau < life
      const f = flashes.current[si]
      if (f) {
        f.visible = s >= 0 && tau > 0 && tau < 0.12
        f.scale.setScalar(0.05 + tau * 0.5)
      }
      S.dirs.forEach((d) => {
        const m = chips.current[n++]
        if (!m) return
        m.visible = live
        if (!live) return
        const out = 0.6 * (1 - Math.exp(-6 * tau))
        m.position.set(S.p[0] + d[0] * out, S.p[1] + d[1] * out - 0.35 * tau * tau, S.p[2] + d[2] * out)
        m.scale.setScalar(Math.max(0.001, 0.045 * (1 - (tau / life) ** 2)))
        m.rotation.set(tau * 9, tau * 7, 0)
      })
    })
  })

  return (
    <group {...handlers}>
      <mesh geometry={geo.hit}>
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* the floating island */}
      <group position-y={ISLE}>
        <mesh geometry={geo.top}>
          <Flat vertexColors color="#ffffff" />
        </mesh>
        <mesh geometry={geo.under}>
          <Flat color={L.rock[1]} emissive={L.rock[0]} emissiveIntensity={0.35} />
        </mesh>
        {[
          [0.7, 0.45, 1],
          [-0.75, 0.3, 0.8],
          [-0.35, -0.72, 1.1],
          [0.55, -0.62, 0.7],
        ].map(([x, z, sc], i) => (
          <mesh key={i} geometry={i % 2 ? geo.rock : geo.bush} position={[x, 0.05, z]} scale={[sc, sc * 0.8, sc]}>
            <Flat color={i % 2 ? L.rock[1] : L.grass[0]} />
          </mesh>
        ))}
        {[
          [-0.55, 0.62],
          [-0.66, 0.5],
          [0.78, -0.2],
          [0.3, 0.8],
        ].map(([x, z], i) => (
          <group key={i} position={[x, 0.06 - Math.hypot(x, z) * 0.06, z]} scale={0.8 + (i % 2) * 0.4}>
            <mesh geometry={geo.stem}>
              <Flat color="#efe6d6" />
            </mesh>
            <mesh geometry={geo.cap} position-y={0.05}>
              <meshStandardMaterial ref={(m) => (shrooms.current[i] = m)} color={L.orb} emissive={L.orb} emissiveIntensity={1} flatShading />
            </mesh>
          </group>
        ))}

        {/* the door and its steps */}
        <group position={[0, 0.1, SEGS[0].r0 + 0.004]}>
          <mesh geometry={geo.door}>
            <Flat color={L.wood} side={THREE.DoubleSide} />
          </mesh>
          {[0, 1].map((i) => (
            <mesh key={i} geometry={geo.step} position={[0, -0.03 - i * 0.03, 0.04 + i * 0.06]} scale={[0.2 + i * 0.04, 0.04, 0.07]}>
              <Flat color={L.stone[1]} />
            </mesh>
          ))}
        </group>

        {/* the crooked tower */}
        <group position-y={0.08}>
          <Stack i={0} geo={geo} L={L} glows={glows}>
            <mesh geometry={geo.brim} position-y={0.0}>
              <Flat color={L.roof2} />
            </mesh>
            <mesh geometry={geo.roof} position-y={0.02}>
              <Flat color={L.roof} />
            </mesh>
            <group position={[ROOF_BEND, ROOF_H, 0]}>
              <mesh geometry={geo.pole}>
                <Flat color={L.wood} />
              </mesh>
              <Cloth width={0.24} height={0.11} segs={[8, 3]} amp={0.03} speed={6} color={L.flag} position-y={0.25} />
            </group>
          </Stack>
        </group>
      </group>

      {/* loose rocks drifting round */}
      {floaters.map((F, i) => (
        <mesh key={i} ref={(el) => (rocks.current[i] = el)} geometry={geo.rock} scale={F.s}>
          <Flat color={L.rock[i % 2]} />
        </mesh>
      ))}

      {/* the floating crystal */}
      <group ref={orb} position={ORB}>
        <mesh geometry={geo.crystal}>
          <meshStandardMaterial ref={orbMat} color={L.orb} emissive={L.orb} emissiveIntensity={1} flatShading roughness={0.2} />
        </mesh>
        <group ref={shards}>
          <mesh geometry={geo.halo}>
            <meshBasicMaterial color={L.orb} transparent opacity={0.5} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} geometry={geo.shard} position={[Math.cos((i * TAU) / 3) * 0.24, 0, Math.sin((i * TAU) / 3) * 0.24]}>
              <meshStandardMaterial color={L.orb} emissive={L.orb} emissiveIntensity={1.2} flatShading />
            </mesh>
          ))}
        </group>
        <pointLight ref={lamp} color={L.orb} distance={2.6} decay={2} intensity={1.6} />
      </group>

      {/* sparkles drifting up */}
      <Particles geometry={geo.spark} count={16} life={3.5} origin={[0, ISLE + 0.3, 0]} spread={0.75} velocity={[0, 0.45, 0]} scatter={0.08} drift={0.15} size={[0.022, 0.004]} colors={[L.glow, L.orb, '#ffffff']} opacity={[1, 0.2]} emissive={1.5} spin={4} seed={7} />

      {/* the spiral of sparks and the fireworks */}
      {Array.from({ length: SPARKS * 3 }, (_, j) => (
        <mesh key={j} ref={(el) => (sparks.current[j] = el)} geometry={geo.spark} visible={false}>
          <meshBasicMaterial color={swirl[Math.floor(j / 3)].c} />
        </mesh>
      ))}
      {shells.map((S, si) => (
        <group key={si}>
          <mesh ref={(el) => (flashes.current[si] = el)} geometry={geo.spark} position={S.p} visible={false}>
            <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
          </mesh>
          {S.dirs.map((d, k) => (
            <mesh key={k} ref={(el) => (chips.current[si * CHIPS + k] = el)} geometry={geo.chip} visible={false}>
              <meshBasicMaterial color={k % 4 === 0 ? '#ffffff' : S.c} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

export default function WizardTowerScene({ background, autoRotate, float, look = 'arcane', ...props }) {
  // the library's pale default would drown the glow, so swap it for the look's own sky
  const sky = !background || background.toLowerCase() === '#eceaf1' ? (LOOKS[look] || LOOKS.arcane).sky : background
  return (
    <Stage background={sky} autoRotate={autoRotate} float={float} camera={[4.1, 2.3, 5.7]} target={[0, 1.68, 0]} hint="The windows glow and pulse, the crystal floats and turns and sparkles drift up on their own · tap it and sparks spiral up round the tower and burst into fireworks · Look swaps arcane, emerald and ember · drag to orbit">
      <WizardTower look={look} {...props} />
    </Stage>
  )
}

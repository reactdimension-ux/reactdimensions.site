import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Stage, TAU, Wing, blob, facet, pulse, rng, terrainGeo, useGeo, useTap } from './kit.jsx'

// A low-poly dragon egg in a twig nest on a rocky ledge, a few crystals
// growing from the stone beside it. The egg is spotted and scaled, rocks now
// and then as something stirs inside, and pulses with an inner glow. Tap it
// and glowing cracks run round it, the top breaks into three pieces that
// lift away, and a tiny dragon pops its head and wings out, looks about,
// blinks and puffs a little cloud of sparks, then tucks back in as the shell
// closes again, ready to hatch once more.

const LOOKS = {
  ember: { shell: '#b8432e', shell2: '#9a3524', spot: '#f2a33a', scale: '#7e2a1e', glow: '#ff8a2a', crystal: '#ff7a2e', rock: ['#6a6272', '#7f7886', '#99929f'], dragon: '#ea6a3a', belly: '#f8c77e', horn: '#f6e3c0', puff: ['#ffd04a', '#ff8a2a', '#fff1b0'] },
  frost: { shell: '#9cc4e4', shell2: '#86b0d4', spot: '#f4fbff', scale: '#6f9cc6', glow: '#8fe8ff', crystal: '#a9e8ff', rock: ['#8d97a8', '#a3adbd', '#eef3f9'], dragon: '#7cc0e8', belly: '#e8f7ff', horn: '#ffffff', puff: ['#ffffff', '#c8f0ff', '#9fe2ff'] },
  jade: { shell: '#3f8f6a', shell2: '#347a5a', spot: '#d9e88a', scale: '#2a6449', glow: '#7dffb0', crystal: '#6fe0a8', rock: ['#6f6a5e', '#7f7a6c', '#79a05a'], dragon: '#58b884', belly: '#eef4bc', horn: '#f4ecd2', puff: ['#d9ff9a', '#9df0b8', '#ffffff'] },
}

const EH = 0.62 // egg height
const ER = 0.26 // egg radius
const SPLIT = 0.58 // crack height, as a share of the egg's height
const LEDGE = 0.32 // height of the ledge top
const BASE = LEDGE + 0.05 // where the egg sits
const HATCH = 4.6 // seconds the whole hatching takes

// the egg's outline: a little narrower at the top than the bottom
const eggAt = (th) => {
  const y = (EH / 2) * (1 - Math.cos(th))
  return [ER * Math.sin(th) * (1 - 0.16 * (y / EH)), y]
}
const TH_SPLIT = Math.acos(1 - 2 * SPLIT)
const YC = eggAt(TH_SPLIT)[1]
const RIM = eggAt(TH_SPLIT)[0] // the shell's radius at the crack
function eggGeo(th0, th1, n, phiStart, phiLength, seed) {
  const pts = []
  for (let i = 0; i <= n; i++) {
    const [r, y] = eggAt(th0 + ((th1 - th0) * i) / n)
    pts.push(new THREE.Vector2(Math.max(r, 0.0005), y))
  }
  // the pieces share their edges, so only the whole bottom is roughened
  const g = new THREE.LatheGeometry(pts, phiLength < TAU - 0.01 ? 4 : 12, phiStart, phiLength)
  return seed ? facet(g, 0.006, seed, [1, 0.5, 1], (x, y) => Math.abs(y - YC) < 0.002) : (g.computeVertexNormals(), g)
}

// where a point on the shell is, and the way it faces, from its angles
const _n = new THREE.Vector3()
function onShell(th, phi, lift = 0) {
  const [r, y] = eggAt(th)
  _n.set(Math.sin(phi) * Math.sin(th), -Math.cos(th) * 0.8, Math.cos(phi) * Math.sin(th)).normalize()
  const p = new THREE.Vector3(Math.sin(phi) * r, y, Math.cos(phi) * r).addScaledVector(_n, lift)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), _n)
  return { p, q }
}

// the top pieces are turned so that none opens straight at the default camera
const PIECE0 = Math.PI / 3 + 0.6

const ease = (x) => THREE.MathUtils.smoothstep(x, 0, 1)

export function DragonEgg({ look = 'ember' }) {
  const L = LOOKS[look] || LOOKS.ember
  const { tap, handlers, clock } = useTap(1)
  const egg = useRef()
  const pieces = useRef([])
  const shellMats = useRef([])
  const cracks = useRef([])
  const light = useRef()
  const dragon = useRef()
  const head = useRef()
  const eyes = useRef([])
  const crystals = useRef([])
  const sparks = useMemo(() => ({ since: (t) => tap.since(t) - 2.15 }), [tap])

  const geo = useGeo(
    () => ({
      ledge: terrainGeo({ radius: 0.92, height: LEDGE, seed: 4, rings: 5, segs: 12, rough: 0.1, profile: 'mesa', bands: [[0, L.rock[0]], [0.55, L.rock[1]], [0.85, L.rock[2]]] }),
      boulder: blob(0.12, 5),
      bottom: eggGeo(0, TH_SPLIT, 6, 0, TAU, 1),
      top: eggGeo(TH_SPLIT, Math.PI, 5, -Math.PI / 3, TAU / 3, 0),
      spot: new THREE.IcosahedronGeometry(1, 0).scale(1, 1, 0.3),
      scale: new THREE.OctahedronGeometry(1, 0).scale(0.8, 1, 0.25),
      crack: new THREE.BoxGeometry(1, 0.012, 0.012),
      bowl: facet(new THREE.TorusGeometry(0.31, 0.11, 5, 14).rotateX(Math.PI / 2).scale(1, 0.55, 1), 0.02, 6),
      stick: new THREE.CylinderGeometry(0.012, 0.014, 0.34, 4).rotateZ(Math.PI / 2),
      crystal: new THREE.CylinderGeometry(1, 1, 1, 6).translate(0, 0.5, 0),
      tip: new THREE.ConeGeometry(1, 1, 6).translate(0, 0.5, 0),
      // the dragon
      neck: facet(new THREE.CylinderGeometry(0.075, 0.1, 0.34, 7).translate(0, -0.1, 0), 0.006, 11),
      bellyPlate: new THREE.BoxGeometry(0.1, 0.24, 0.03),
      head: facet(new THREE.IcosahedronGeometry(0.105, 1).scale(1.12, 0.92, 1), 0.006, 12),
      snout: facet(new THREE.IcosahedronGeometry(0.065, 1).scale(1.05, 0.75, 1), 0.004, 13),
      eye: new THREE.IcosahedronGeometry(0.03, 1),
      pupil: new THREE.IcosahedronGeometry(0.018, 0),
      glint: new THREE.IcosahedronGeometry(0.006, 0),
      nostril: new THREE.IcosahedronGeometry(0.008, 0),
      horn: new THREE.ConeGeometry(0.022, 0.08, 5),
      spike: new THREE.ConeGeometry(0.018, 0.04, 4),
      cheek: new THREE.IcosahedronGeometry(0.016, 0).scale(1, 0.6, 0.3),
      paw: blob(0.032, 14, 0),
      puff: new THREE.OctahedronGeometry(1, 0),
    }),
    [look],
  )

  // spots and scales over the shell, each on the bottom or on one of the
  // three top pieces, so they travel with the bit of shell they sit on
  const marks = useMemo(() => {
    const r = rng(8)
    const out = []
    for (let i = 0; i < 44; i++) {
      const th = 0.45 + r() * 2.45
      const phi = r() * TAU
      const big = r() < 0.35
      const piece = th < TH_SPLIT - 0.08 ? -1 : th > TH_SPLIT + 0.08 ? Math.floor((((phi + Math.PI / 3) % TAU) + TAU) % TAU / (TAU / 3)) : null
      if (piece === null) continue
      out.push({ ...onShell(th, piece < 0 ? phi : phi - piece * (TAU / 3), 0.002), s: big ? 0.05 : 0.032, piece, c: r() < 0.72 ? 'spot' : 'spot2' })
    }
    // a band of overlapping scales round the base
    for (let k = 0; k < 2; k++)
      for (let i = 0; i < 12; i++) {
        const th = 0.75 + k * 0.28
        const phi = (i / 12) * TAU + k * (TAU / 24)
        out.push({ ...onShell(th, phi, 0.004), s: 0.03, piece: -1, c: 'scale' })
      }
    return out
  }, [])

  // a zigzag crack right round the egg at the split
  const crackSegs = useMemo(() => {
    const n = 18
    const pts = Array.from({ length: n }, (_, i) => {
      const phi = (i / n) * TAU
      const [r, y] = eggAt(TH_SPLIT)
      const dy = i % 2 ? 0.035 : -0.03
      return new THREE.Vector3(Math.sin(phi) * (r + 0.006), y + dy, Math.cos(phi) * (r + 0.006))
    })
    return pts.map((a, i) => {
      const b = pts[(i + 1) % n]
      const mid = a.clone().add(b).multiplyScalar(0.5)
      const len = a.distanceTo(b)
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), b.clone().sub(a).normalize())
      return { mid, len, q, order: Math.abs(((i + 4) % n) - n / 2) }
    })
  }, [])

  const sticks = useMemo(() => {
    const r = rng(21)
    return Array.from({ length: 30 }, (_, i) => {
      const layer = i % 2
      const a = (i / 30) * TAU + r() * 0.2
      const rad = 0.31 + layer * 0.05 + (r() - 0.5) * 0.04
      return { p: [Math.cos(a) * rad, 0.05 + layer * 0.06 + r() * 0.03, Math.sin(a) * rad], r: [(r() - 0.5) * 0.5, -a + Math.PI / 2 + (r() - 0.5) * 0.5, (r() - 0.5) * 0.6], c: ['#7a5232', '#8e6440', '#6a4628'][i % 3], s: 0.8 + r() * 0.4 }
    })
  }, [])

  // x, z, radius, height, lean
  const CRYSTALS = [
    [-0.5, -0.24, 0.075, 0.42, 0.15, 0.3],
    [-0.4, -0.4, 0.055, 0.28, -0.35, 0.35],
    [-0.62, -0.06, 0.05, 0.22, 0.3, 0.55],
    [0.5, 0.26, 0.05, 0.24, 0.3, -0.35],
    [0.58, 0.1, 0.038, 0.15, -0.15, -0.6],
  ]

  useFrame(() => {
    const t = clock.elapsedTime
    const s = tap.since(t)
    const hatching = s >= 0 && s < HATCH
    // how open the shell is: cracks for 0.6 s, the top lifts, then closes
    const crackK = hatching ? Math.min(1, s / 0.6) : 0
    const open = !hatching ? 0 : s < 0.6 ? 0 : s < 1.0 ? ease((s - 0.6) / 0.4) : s < 3.7 ? 1 : 1 - ease((s - 3.7) / 0.6)
    // the egg rocks now and then on its own, and shakes hard as it cracks
    const stir = Math.max(0, Math.sin(t * 0.95)) ** 6
    let rz = 0.015 * Math.sin(t * 1.3) + 0.07 * stir * Math.sin(t * 9)
    let rx = 0.012 * Math.sin(t * 1.1 + 1) + 0.04 * stir * Math.sin(t * 7 + 1)
    if (hatching && s < 0.7) {
      rz += 0.12 * Math.sin(s * 34) * (1 - s / 0.7)
      rx += 0.06 * Math.sin(s * 27 + 1) * (1 - s / 0.7)
    }
    egg.current.rotation.set(rx * (1 - open), 0, rz * (1 - open))
    // the inner glow: a slow pulse, flaring as it hatches
    const glow = 0.22 + 0.3 * pulse(t, 0.45) + 0.25 * stir + (hatching ? 1.4 * crackK * (1 - open * 0.5) * (s < 4 ? 1 : 1 - (s - 4) / 0.6) : 0)
    shellMats.current.forEach((m) => m && (m.material.emissiveIntensity = glow * 0.55))
    light.current.intensity = 0.6 + glow * 1.6
    crystals.current.forEach((m, i) => m && (m.material.emissiveIntensity = 0.15 + 0.3 * pulse(t, 0.3, i * 1.3) + (hatching ? 0.6 * crackK * (1 - s / HATCH) : 0)))
    // glowing cracks spread round from the front
    cracks.current.forEach((c, i) => {
      if (!c) return
      const show = hatching && s < 4.3 && crackK * 9 > crackSegs[i].order
      c.visible = show
      c.material.emissiveIntensity = 1.5 + Math.sin(t * 12 + i) * 0.4
    })
    // the three top pieces lift and tip outward
    pieces.current.forEach((p, i) => {
      if (!p) return
      const o = open * (1 + 0.03 * Math.sin(t * 3 + i * 2))
      p.position.set(0, YC + o * (0.08 + i * 0.02), RIM + o * 0.1)
      p.rotation.set(o * (1.85 + i * 0.1), 0, o * 0.12 * (i - 1))
    })
    // the dragon rises out, looks about, and sinks back in
    const up = !hatching ? 0 : s < 0.85 ? 0 : s < 1.35 ? ease((s - 0.85) / 0.5) * 1.08 - Math.max(0, (s - 1.2) / 0.15) * 0.08 : s < 3.5 ? 1 : 1 - ease((s - 3.5) / 0.45)
    const d = dragon.current
    d.visible = up > 0.002
    d.position.y = -0.2 + up * 0.5
    const hs = s - 1.3
    head.current.rotation.set(hatching ? -0.15 + 0.12 * Math.sin(hs * 2.2) - (s > 2.05 && s < 2.4 ? 0.25 * Math.sin(((s - 2.05) / 0.35) * Math.PI) : 0) : 0, hatching ? 0.45 * Math.sin(hs * 1.6) * Math.min(1, Math.max(0, hs)) : 0, hatching ? 0.18 * Math.sin(hs * 1.1) : 0)
    // two quick blinks, kept clear of the moments a screenshot might catch
    const blink = (s > 1.62 && s < 1.74) || (s > 2.95 && s < 3.07) ? 0.12 : 1
    eyes.current.forEach((e) => e && (e.scale.y = blink))
  })

  const wingAngle = () => {
    const s = tap.since(clock.elapsedTime)
    if (s < 1.0 || s > 3.5) return 1.2
    return 0.35 + 0.18 * Math.sin((s - 1.0) * 9) * Math.exp(-(s - 1.0) * 1.2)
  }
  const wingFold = () => {
    const s = tap.since(clock.elapsedTime)
    return s < 1.0 || s > 3.45 ? 1 : Math.max(0, 1 - (s - 1.0) * 3)
  }

  const shellMat = <Flat color={L.shell} emissive={L.glow} emissiveIntensity={0.15} side={THREE.DoubleSide} />
  const markMesh = (m, i) => (
    <mesh key={i} geometry={m.c === 'scale' ? geo.scale : geo.spot} position={m.p} quaternion={m.q} scale={m.s}>
      <Flat color={m.c === 'spot' ? L.spot : L.shell2} />
    </mesh>
  )

  return (
    <group {...handlers}>
      {/* the rocky ledge, a few boulders and the crystals */}
      <mesh geometry={geo.ledge}>
        <Flat vertexColors color="#ffffff" />
      </mesh>
      {[
        [0.7, -0.42, 1.1],
        [-0.74, 0.36, 0.8],
        [0.18, 0.84, 0.6],
      ].map(([x, z, k], i) => (
        <mesh key={i} geometry={geo.boulder} position={[x, 0.07 * k, z]} scale={[k, k * 0.75, k]} rotation-y={i}>
          <Flat color={L.rock[i % 2]} />
        </mesh>
      ))}
      {CRYSTALS.map(([x, z, r, h, tx, tz], i) => (
        <group key={i} position={[x, LEDGE * (Math.hypot(x, z) < 0.5 ? 1 : 0.8) - 0.04, z]} rotation={[tx, i * 0.7, tz]}>
          <mesh ref={(el) => (crystals.current[i] = el)} geometry={geo.crystal} scale={[r, h, r]}>
            <Flat color={L.crystal} emissive={L.crystal} emissiveIntensity={0.3} roughness={0.25} metalness={0.1} transparent opacity={0.92} />
          </mesh>
          <mesh geometry={geo.tip} scale={[r, r * 1.8, r]} position-y={h}>
            <Flat color={L.crystal} emissive={L.crystal} emissiveIntensity={0.4} roughness={0.25} metalness={0.1} />
          </mesh>
        </group>
      ))}

      {/* the twig nest */}
      <group position-y={LEDGE - 0.02}>
        <mesh geometry={geo.bowl} position-y={0.06}>
          <Flat color="#6e4a2c" />
        </mesh>
        {sticks.map((st, i) => (
          <mesh key={i} geometry={geo.stick} position={st.p} rotation={st.r} scale={[st.s, 1, 1]}>
            <Flat color={st.c} />
          </mesh>
        ))}
      </group>

      {/* the egg: a bottom, three top pieces, marks and cracks, a glow inside */}
      <group ref={egg} position-y={BASE}>
        <mesh ref={(el) => (shellMats.current[0] = el)} geometry={geo.bottom}>
          {shellMat}
        </mesh>
        {marks.filter((m) => m.piece < 0).map(markMesh)}
        {crackSegs.map((c, i) => (
          <mesh key={i} ref={(el) => (cracks.current[i] = el)} geometry={geo.crack} position={c.mid} quaternion={c.q} scale={[c.len * 1.1, 1, 1]} visible={false}>
            <meshStandardMaterial color={L.glow} emissive={L.glow} emissiveIntensity={1.5} flatShading />
          </mesh>
        ))}
        {[0, 1, 2].map((k) => (
          <group key={k} rotation-y={(k * TAU) / 3 + PIECE0}>
            <group ref={(el) => (pieces.current[k] = el)} position={[0, YC, RIM]}>
              <group position={[0, -YC, -RIM]}>
                <mesh ref={(el) => (shellMats.current[k + 1] = el)} geometry={geo.top}>
                  {shellMat}
                </mesh>
                {marks.filter((m) => m.piece === k).map(markMesh)}
              </group>
            </group>
          </group>
        ))}
        <pointLight ref={light} color={L.glow} distance={2.2} decay={2} position={[0, YC, 0.0]} intensity={1} />

        {/* the hatchling */}
        <group ref={dragon} visible={false} scale={1.22}>
          <mesh geometry={geo.neck}>
            <Flat color={L.dragon} />
          </mesh>
          <mesh geometry={geo.bellyPlate} position={[0, -0.06, 0.075]} rotation-x={-0.08}>
            <Flat color={L.belly} />
          </mesh>
          {[-1, 1].map((sx) => (
            <Wing key={sx} side={sx} span={0.24} chord={0.15} color={L.dragon} tipColor={L.belly} angle={wingAngle} fold={wingFold} position={[sx * 0.07, 0.0, -0.04]} rotation-x={-0.35} />
          ))}
          {[-1, 1].map((sx) => (
            <mesh key={sx} geometry={geo.paw} position={[sx * 0.09, -0.05, 0.1]} scale={[1, 0.8, 1.1]}>
              <Flat color={L.dragon} />
            </mesh>
          ))}
          <group ref={head} position-y={0.17}>
            <mesh geometry={geo.head}>
              <Flat color={L.dragon} />
            </mesh>
            <mesh geometry={geo.snout} position={[0, -0.03, 0.085]}>
              <Flat color={L.dragon} />
            </mesh>
            {[-1, 1].map((sx) => (
              <group key={sx}>
                <mesh geometry={geo.nostril} position={[sx * 0.022, -0.02, 0.145]}>
                  <Flat color="#2a1d1a" />
                </mesh>
                <group ref={(el) => (eyes.current[(sx + 1) / 2] = el)} position={[sx * 0.052, 0.025, 0.075]}>
                  <mesh geometry={geo.eye}>
                    <Flat color="#ffffff" roughness={0.3} />
                  </mesh>
                  <mesh geometry={geo.pupil} position={[sx * 0.002, 0, 0.018]}>
                    <Flat color="#1b1a22" roughness={0.3} />
                  </mesh>
                  <mesh geometry={geo.glint} position={[sx * 0.004 + 0.006, 0.008, 0.033]}>
                    <meshBasicMaterial color="#ffffff" />
                  </mesh>
                </group>
                <mesh geometry={geo.cheek} position={[sx * 0.07, -0.025, 0.07]} rotation-y={sx * 0.6}>
                  <Flat color="#ff8f9a" />
                </mesh>
                <mesh geometry={geo.horn} position={[sx * 0.05, 0.09, -0.03]} rotation={[-0.6, 0, -sx * 0.35]}>
                  <Flat color={L.horn} />
                </mesh>
              </group>
            ))}
            {[0, 1, 2].map((k) => (
              <mesh key={k} geometry={geo.spike} position={[0, 0.085 - k * 0.04, -0.07 - k * 0.025]} rotation-x={-0.7 - k * 0.35}>
                <Flat color={L.belly} />
              </mesh>
            ))}
          </group>
        </group>
        <Burst tap={sparks} geometry={geo.puff} count={14} colors={L.puff} speed={0.7} gravity={-0.6} size={0.03} life={1.2} origin={[0, 0.56, 0.26]} spread={0.5} up={0.8} seed={9} />
      </group>
    </group>
  )
}

export default function DragonEggScene({ background, autoRotate, float, ...props }) {
  return (
    <Stage background={background} autoRotate={autoRotate} float={float} camera={[2.3, 1.6, 3.2]} target={[0, 0.6, 0]} hint="The egg rocks now and then and pulses with a glow from inside, and the crystals shimmer · tap it and it cracks open: the shell lifts away, a tiny dragon pops out, looks about, blinks and puffs some sparks, then tucks back in as the shell closes · Look swaps ember, frost and jade · drag to orbit">
      <DragonEgg {...props} />
    </Stage>
  )
}

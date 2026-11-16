import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Burst, Flat, Stage, TAU, blob, facet, followPath, rng, useGeo, useKick, useTap, wobble } from './kit.jsx'

// A low-poly Venus flytrap in a terracotta pot: flat leaves spread over the
// soil and three stems rise from it, each ending in a trap of two hinged,
// cupped jaws, red inside, fringed with teeth and set with trigger hairs.
// Left alone the jaws breathe, slowly opening and closing on their own
// beats. Tap it and a fly buzzes in on a looping path to the trap nearest
// the tap; the moment it lands the jaws snap shut, the stem shudders, and
// after a while the trap slowly opens again (the fly is gone).

const LOOKS = {
  classic: { outer: '#6fae3d', stem: '#5f9e36', inner: '#d8343b', lip: '#b9cf52', tooth: '#a8c84a', hair: '#ffe08a', leaf: ['#5f9e36', '#77b845'], pot: '#c96f45', rim: '#d9845a', soil: '#4a3326', glow: 0, fly: '#2a2a30' },
  red: { outer: '#a83a32', stem: '#8e2e2c', inner: '#e3263c', lip: '#d4584a', tooth: '#c8483c', hair: '#ffd0a0', leaf: ['#8e2e2c', '#a8403a'], pot: '#5d6f8f', rim: '#6f82a2', soil: '#3f2f28', glow: 0, fly: '#2a2a30' },
  night: { outer: '#2f7048', stem: '#2a6040', inner: '#e81e52', lip: '#6fe0a0', tooth: '#5ec98a', hair: '#ffe9a0', leaf: ['#285c3c', '#33704a'], pot: '#3d4a6a', rim: '#4b5a7e', soil: '#2a2230', glow: 1, fly: '#3a3a44' },
}
const NIGHT_BG = '#151a26'

const W = 0.24 // jaw depth, hinge to rim
const HL = 0.2 // half the jaw's length along the midrib
const CUP = 0.07 // how far each jaw bulges out
const SOIL = 0.48
const OPEN = 0.72 // idle jaw angle (radians above level)
const SHUT = 1.53
const FLIGHT = 1.5 // seconds for the fly to reach the trap
const HOLD = 2.8 // seconds the trap stays shut

// the traps: yaw round the pot, stem height, outward lean, trap scale, tilt
const TRAPS = [
  { a: 0.5, h: 0.72, lean: 0.3, s: 1.35, tilt: 0.3 },
  { a: 2.6, h: 0.56, lean: 0.55, s: 1.15, tilt: 0.25 },
  { a: 4.6, h: 0.44, lean: 0.68, s: 1.0, tilt: 0.2 },
]
const LEAVES = [1.5, 3.5, 5.6, 0.0, 2.9]

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))

// One jaw: a cupped semi-ellipse hinged along the z axis, reaching out
// along +x. Its front face (+y) is the inside of the trap, coloured from
// red at the middle to the lip colour at the rim.
function jawGeometry(inner, lip) {
  const nu = 4
  const nv = 10
  const pos = []
  const col = []
  const a = new THREE.Color(inner)
  const b = new THREE.Color(lip)
  const c = new THREE.Color()
  for (let i = 0; i <= nu; i++) {
    const u = i / nu
    for (let j = 0; j <= nv; j++) {
      const f = -Math.PI / 2 + (Math.PI * j) / nv
      pos.push(u * W * Math.cos(f), -CUP * Math.sin(Math.PI * u) * Math.cos(f), HL * Math.sin(f))
      c.copy(a).lerp(b, smooth((u - 0.7) / 0.3))
      col.push(c.r, c.g, c.b)
    }
  }
  const idx = []
  const at = (i, j) => i * (nv + 1) + j
  for (let i = 0; i < nu; i++)
    for (let j = 0; j < nv; j++) {
      idx.push(at(i, j), at(i, j + 1), at(i + 1, j))
      idx.push(at(i + 1, j), at(i, j + 1), at(i + 1, j + 1))
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  return facet(g, 0.008, 4, [1, 1, 0.6], (x) => Math.abs(x) < 0.001)
}

// A flat leaf lying out along +z from the origin, drooping as it goes.
function leafGeometry() {
  const s = new THREE.Shape()
  s.moveTo(-0.025, 0)
  s.quadraticCurveTo(-0.09, 0.3, 0, 0.46)
  s.quadraticCurveTo(0.09, 0.3, 0.025, 0)
  s.closePath()
  const g = new THREE.ShapeGeometry(s, 4).rotateX(Math.PI / 2)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i)
    p.setY(i, 0.06 * Math.sin(z * 5) - 0.5 * Math.max(0, z - 0.25) ** 2 * 6)
  }
  g.computeVertexNormals()
  return g
}

// the teeth round a jaw's rim and the trigger hairs inside it
const _Y = new THREE.Vector3(0, 1, 0)
function jawBits() {
  const teeth = []
  const n = 11
  for (let k = 0; k < n; k++) {
    const f = -Math.PI / 2 + (Math.PI * (k + 0.5)) / n
    const d = new THREE.Vector3(Math.cos(f) / W, 0.25 / W, Math.sin(f) / HL).normalize()
    teeth.push({ p: [W * Math.cos(f), 0, HL * Math.sin(f)], q: new THREE.Quaternion().setFromUnitVectors(_Y, d), l: 0.8 + 0.4 * Math.sin(k * 2.3) ** 2 })
  }
  const hairs = [-0.55, 0, 0.55].map((f) => {
    const u = 0.42
    return [u * W * Math.cos(f), -CUP * Math.sin(Math.PI * u) * Math.cos(f), HL * Math.sin(f) * 0.9]
  })
  return { teeth, hairs }
}

function Jaw({ geo, bits, L, innerMat }) {
  return (
    <group>
      <mesh geometry={geo.jaw}>{innerMat}</mesh>
      <mesh geometry={geo.jaw}>
        <Flat color={L.outer} side={THREE.BackSide} />
      </mesh>
      {bits.teeth.map((t, k) => (
        <mesh key={k} geometry={geo.tooth} position={t.p} quaternion={t.q} scale={[1, t.l, 1]}>
          <Flat color={L.tooth} emissive={L.tooth} emissiveIntensity={L.glow * 0.5} />
        </mesh>
      ))}
      {bits.hairs.map((h, k) => (
        <mesh key={k} geometry={geo.hair} position={h}>
          <Flat color={L.hair} emissive={L.hair} emissiveIntensity={0.2 + L.glow} />
        </mesh>
      ))}
    </group>
  )
}

function Fly({ L, flyRef, wings }) {
  const geo = useGeo(
    () => ({
      body: facet(new THREE.IcosahedronGeometry(0.03, 0).scale(0.85, 0.8, 1.35), 0.003, 5),
      head: new THREE.IcosahedronGeometry(0.02, 0),
      eye: new THREE.IcosahedronGeometry(0.011, 0),
      wing: new THREE.CircleGeometry(1, 6).scale(0.035, 0.016, 1).translate(0.035, 0, 0).rotateX(-Math.PI / 2),
    }),
    [],
  )
  return (
    <group ref={flyRef} visible={false} scale={1.5}>
      <mesh geometry={geo.body}>
        <Flat color={L.fly} />
      </mesh>
      <mesh geometry={geo.head} position-z={0.045}>
        <Flat color={L.fly} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={geo.eye} position={[s * 0.013, 0.006, 0.055]}>
          <Flat color="#b8322a" emissive="#b8322a" emissiveIntensity={0.3 + L.glow} />
        </mesh>
      ))}
      {L.glow > 0 && (
        <mesh geometry={geo.eye} position-z={-0.04} scale={1.6}>
          <Flat color="#fff17a" emissive="#ffe94a" emissiveIntensity={2.5} />
        </mesh>
      )}
      {[-1, 1].map((s) => (
        <group key={s} ref={(el) => (wings.current[s > 0 ? 1 : 0] = el)} position={[s * 0.012, 0.018, 0]} scale-x={s}>
          <mesh geometry={geo.wing}>
            <meshStandardMaterial color="#eaf4ff" transparent opacity={0.55} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export function VenusFlytrap({ look = 'classic' }) {
  const L = LOOKS[look] || LOOKS.classic
  const { handlers, clock } = useTap(1.2)
  const snap = useKick(2)
  const root = useRef()
  const fly = useRef()
  const wings = useRef([])
  const jaws = useRef([])
  const stems = useRef([])
  const mouths = useRef([])
  const burstAt = useRef()
  const st = useRef({ traps: TRAPS.map(() => ({ th: OPEN, v: 0, shut: -99 })), fly: null })

  const geo = useGeo(
    () => ({
      jaw: jawGeometry(L.inner, L.lip),
      tooth: new THREE.ConeGeometry(0.007, 0.075, 3).translate(0, 0.0375, 0),
      hair: new THREE.CylinderGeometry(0.003, 0.004, 0.05, 3).translate(0, 0.025, 0),
      stem: facet(new THREE.CylinderGeometry(0.022, 0.034, 1, 5, 3).translate(0, 0.5, 0), 0.005, 7),
      blade: facet(new THREE.CylinderGeometry(0.018, 0.026, HL * 2, 5, 2).rotateX(Math.PI / 2).translate(0, -0.005, HL), 0.003, 8),
      leaf: leafGeometry(),
      pot: facet(new THREE.CylinderGeometry(0.34, 0.26, 0.42, 10, 2).translate(0, 0.21, 0), 0.012, 1, [1, 0.3, 1]),
      rim: facet(new THREE.CylinderGeometry(0.4, 0.38, 0.1, 10, 1).translate(0, 0.45, 0), 0.01, 2, [1, 0.3, 1]),
      soil: facet(new THREE.CylinderGeometry(0.36, 0.36, 0.04, 10, 1).translate(0, SOIL - 0.02, 0), 0.012, 3, [1, 0.8, 1]),
      pebble: blob(1, 9, 0),
      spark: new THREE.TetrahedronGeometry(1, 0),
    }),
    [L.inner, L.lip],
  )
  const bits = useMemo(jawBits, [])
  const pebbles = useMemo(() => {
    const r = rng(14)
    return Array.from({ length: 6 }, () => {
      const a = r() * TAU
      const d = 0.12 + r() * 0.18
      const s = 0.025 + r() * 0.02
      return { p: [Math.cos(a) * d, SOIL, Math.sin(a) * d], s: [s * 1.3, s * 0.7, s] }
    })
  }, [])

  const innerMat = <Flat vertexColors color="#ffffff" emissive={L.inner} emissiveIntensity={L.glow * 0.4} roughness={0.6} />

  const _v = useMemo(() => new THREE.Vector3(), [])
  const onClick = (e) => {
    handlers.onClick(e)
    const S = st.current
    const t = clock.elapsedTime
    if (S.fly && t - S.fly.t0 < FLIGHT + 0.2) return
    // the trap nearest the tap, that is not already shut
    let best = -1
    let bd = Infinity
    mouths.current.forEach((m, i) => {
      if (!m || t - S.traps[i].shut < HOLD + 1.2) return
      const d = m.getWorldPosition(_v).distanceTo(e.point)
      if (d < bd) (bd = d), (best = i)
    })
    if (best < 0) return
    const to = root.current.worldToLocal(mouths.current[best].getWorldPosition(new THREE.Vector3()))
    const out = new THREE.Vector3(to.x, 0, to.z).normalize()
    const from = to.clone().addScaledVector(out, 1.3).add(new THREE.Vector3(-out.z * 0.6, 0.55, out.x * 0.6))
    S.fly = { t0: t, trap: best, from, to, done: false }
  }

  const flyPath = (u, F) => {
    const e = smooth(u)
    const k = 1 - e
    return new THREE.Vector3().lerpVectors(F.to, F.from, k).add(new THREE.Vector3(Math.cos(u * 11) * 0.22 * k + Math.sin(u * 47) * 0.02 * k, Math.sin(u * 15) * 0.08 * k + 0.02 * (1 - u), Math.sin(u * 11) * 0.22 * k + Math.cos(u * 53) * 0.02 * k))
  }

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 1 / 30)
    const t = clock.elapsedTime
    const S = st.current
    // the fly: in on its path, then gone once the trap has it
    const F = S.fly
    if (fly.current) {
      if (F && !F.done) {
        const u = Math.min(1, (t - F.t0) / FLIGHT)
        fly.current.visible = true
        followPath(fly.current, (x) => flyPath(Math.min(1, x), F), u, 0.8, 0.01)
        if (u >= 1) {
          F.done = true
          S.traps[F.trap].shut = t
          snap.kick(t)
          if (burstAt.current) burstAt.current.position.copy(F.to)
        }
      } else fly.current.visible = !!F && t - S.traps[F.trap].shut < 0.12
      const flap = Math.sin(t * 90) * 0.6
      if (wings.current[0]) wings.current[0].rotation.z = 0.25 + flap
      if (wings.current[1]) wings.current[1].rotation.z = 0.25 + flap
    }
    // each trap's jaws on a spring: a lazy breath when idle, a snap when shut
    TRAPS.forEach((T, i) => {
      const s = S.traps[i]
      const since = t - s.shut
      const shut = since >= 0 && since < HOLD
      const target = shut ? SHUT : OPEN + 0.2 * Math.sin(t * 0.8 + i * 2.1) - 0.08
      const k = shut ? 520 : 22
      const c = shut ? 16 : 7
      s.v += ((target - s.th) * k - s.v * c) * dt
      s.th += s.v * dt
      const th = Math.min(s.th, SHUT + 0.04)
      const j = jaws.current[i]
      if (j && j[0] && j[1]) {
        j[0].rotation.z = th
        j[1].rotation.z = th
      }
      const g = stems.current[i]
      if (g) {
        const w = wobble(since, 18, 4)
        g.rotation.x = T.lean + Math.sin(t * 0.7 + i * 1.3) * 0.03 + w * 0.08
        g.rotation.z = Math.sin(t * 0.5 + i) * 0.03 + w * 0.05
      }
    })
  })

  return (
    <group ref={root} {...handlers} onClick={onClick}>
      {/* pot, rim and soil */}
      <mesh geometry={geo.pot}>
        <Flat color={L.pot} />
      </mesh>
      <mesh geometry={geo.rim}>
        <Flat color={L.rim} />
      </mesh>
      <mesh geometry={geo.soil}>
        <Flat color={L.soil} roughness={1} />
      </mesh>
      {pebbles.map((p, i) => (
        <mesh key={i} geometry={geo.pebble} position={p.p} scale={p.s}>
          <Flat color={i % 2 ? '#9a948a' : '#b4aea2'} />
        </mesh>
      ))}
      {/* flat leaves over the soil and the rim */}
      {LEAVES.map((a, i) => (
        <group key={i} rotation-y={a} position-y={SOIL + 0.01}>
          <mesh geometry={geo.leaf} scale={0.85 + (i % 3) * 0.1} rotation-x={-0.1}>
            <Flat color={L.leaf[i % 2]} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      {/* stems, each ending in a trap */}
      {TRAPS.map((T, i) => (
        <group key={i} rotation-y={T.a} position-y={SOIL - 0.01}>
          <group ref={(el) => (stems.current[i] = el)} rotation-x={T.lean}>
            <mesh geometry={geo.stem} scale={[1, T.h, 1]}>
              <Flat color={L.stem} />
            </mesh>
            <group position-y={T.h} rotation-x={-T.lean + T.tilt} scale={T.s}>
              <mesh geometry={geo.blade}>
                <Flat color={L.stem} />
              </mesh>
              <group position={[0, 0.012, HL]}>
                <group ref={(el) => ((jaws.current[i] = jaws.current[i] || [])[0] = el)}>
                  <Jaw geo={geo} bits={bits} L={L} innerMat={innerMat} />
                </group>
                <group rotation-y={Math.PI}>
                  <group ref={(el) => ((jaws.current[i] = jaws.current[i] || [])[1] = el)}>
                    <Jaw geo={geo} bits={bits} L={L} innerMat={innerMat} />
                  </group>
                </group>
                <group ref={(el) => (mouths.current[i] = el)} position-y={0.07} />
                {L.glow > 0 && <pointLight color={L.inner} intensity={0.25} distance={0.9} decay={2} position-y={0.12} />}
              </group>
            </group>
          </group>
        </group>
      ))}
      <Fly L={L} flyRef={fly} wings={wings} />
      <group ref={burstAt}>
        <Burst tap={snap} geometry={geo.spark} count={12} colors={[L.lip, L.inner, '#ffffff']} speed={1.1} gravity={2.5} size={0.025} life={0.8} origin={[0, 0.05, 0]} spread={0.9} up={1} seed={5} />
      </group>
    </group>
  )
}

export default function VenusFlytrapScene({ background, autoRotate, float, look = 'classic', ...props }) {
  const bg = look === 'night' && (!background || background.toLowerCase() === '#eceaf1') ? NIGHT_BG : background
  return (
    <Stage background={bg} autoRotate={autoRotate} float={float} camera={[2.5, 1.9, 3.3]} target={[0, 0.78, 0]} hint="The traps breathe, their jaws slowly opening and closing · tap the plant and a fly buzzes in to the nearest trap, which snaps shut on it and opens again after a moment · Look swaps classic, red and night (glowing jaws) · drag to orbit">
      <VenusFlytrap look={look} {...props} />
    </Stage>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls, useCursor } from '@react-three/drei'
import * as THREE from 'three'

// A clay-toy ferret: a long, gently arched tube of a body on short dark legs,
// a round head with a dark mask painted across the eyes, a cream muzzle with
// a dark nose, small cream-lined ears and a long tail that darkens to the tip.
// It breathes, weaves its head, blinks and curls its tail. Tap it and it does
// a weasel war dance: hopping sideways with a wiggle, then settling back.
// It faces +z and stands on y = 0.

const KINDS = {
  sable: { base: '#7a5638', face: '#f1e4cd', mask: '#4a3222', muzzle: '#f8eedd', leg: '#3e2a1d', tip: '#2f2017', ear: '#6e4c31', inner: '#f5e7d1', nose: '#2c1e17', eye: '#0d0806' },
  albino: { base: '#f8f1e3', face: '#fcf7ee', mask: '#efe2cb', muzzle: '#fffaf2', leg: '#f1e6d2', tip: '#eadcc3', ear: '#f6eee0', inner: '#f7cbc8', nose: '#ee9fa4', eye: '#c3263c' },
  cinnamon: { base: '#c0844f', face: '#f4e6cf', mask: '#8e5a37', muzzle: '#faefde', leg: '#86522f', tip: '#6c3e23', ear: '#b37848', inner: '#f7e7d2', nose: '#6e4232', eye: '#2c0f0b' },
  silver: { base: '#a2a2a6', face: '#f3f1ee', mask: '#6b6b72', muzzle: '#f8f7f4', leg: '#5c5c63', tip: '#4a4a51', ear: '#97979c', inner: '#f4e7e3', nose: '#3f3a3e', eye: '#0e0e12' },
}

const TAU = Math.PI * 2
const smooth = (a, b, x) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return k * k * (3 - 2 * k)
}

const HEAD = { pos: [0, 0.5, 0.74], scale: [0.23, 0.208, 0.23] }
const MUZZLE = { pos: [0, 0.44, 0.91], scale: [0.11, 0.09, 0.125] }
// a point on the head's surface, from a direction
const onHead = (x, y, z, k = 1) => {
  const l = Math.hypot(x, y, z)
  return HEAD.pos.map((p, i) => p + ([x, y, z][i] / l) * HEAD.scale[i] * k)
}
const EYE = onHead(0.5, 0.26, 0.83, 0.975)
const EAR = onHead(0.62, 0.74, -0.12, 0.92)
const LEGS = [
  [-0.09, 0.34],
  [0.09, 0.34],
  [-0.095, -0.5],
  [0.095, -0.5],
]
const LEG_TOP = 0.3 // up to the body's middle, so the leg tops are buried

// the long body: a tube along a gently arched spine that rises into the neck
const SPINE = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0.26, -0.76),
  new THREE.Vector3(0, 0.315, -0.38),
  new THREE.Vector3(0, 0.32, 0.0),
  new THREE.Vector3(0, 0.33, 0.34),
  new THREE.Vector3(0, 0.42, 0.6),
])
const bodyR = (u) => 0.175 - 0.03 * smooth(0.45, 1, u)

// the tail runs back and low, then lifts a little at the tip
const TAIL_ROOT = [0, 0.27, -0.8]
const TAIL = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0, 0.12),
  new THREE.Vector3(0, -0.04, -0.2),
  new THREE.Vector3(0.03, -0.12, -0.5),
  new THREE.Vector3(0.12, -0.15, -0.8),
  new THREE.Vector3(0.3, -0.12, -1.0),
  new THREE.Vector3(0.42, -0.04, -1.07),
])
const tailR = (u) => 0.078 - 0.036 * u

// A tube round a curve, its ends rounded off, painted by `paint(point, u)`.
function tube(curve, radius, paint, { rings = 120, sides = 40, ry = 1, rx = 1, roundStart = true } = {}) {
  const len = curve.getLength()
  const pos = []
  const col = []
  const idx = []
  const up = new THREE.Vector3(0, 1, 0)
  const N = new THREE.Vector3()
  const S = new THREE.Vector3()
  const w = new THREE.Vector3()
  const c = new THREE.Color()
  for (let i = 0; i <= rings; i++) {
    const v = i / rings
    // denser rings near the rounded ends
    const u = roundStart ? (1 - Math.cos(Math.PI * v)) / 2 : Math.sin((Math.PI / 2) * v)
    const P = curve.getPointAt(u)
    const T = curve.getTangentAt(u)
    N.copy(up).addScaledVector(T, -T.dot(up)).normalize()
    S.crossVectors(N, T).normalize()
    let r = radius(u)
    const sEnd = (1 - u) * len
    if (sEnd < r) r *= Math.sqrt(Math.max(0, 1 - (1 - sEnd / r) ** 2))
    const s0 = u * len
    if (roundStart && s0 < r) r *= Math.sqrt(Math.max(0, 1 - (1 - s0 / r) ** 2))
    for (let j = 0; j < sides; j++) {
      const a = (j / sides) * TAU
      w.copy(P)
        .addScaledVector(S, Math.cos(a) * r * rx)
        .addScaledVector(N, Math.sin(a) * r * ry)
      pos.push(w.x, w.y, w.z)
      paint(c, w, u)
      col.push(c.r, c.g, c.b)
    }
  }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < sides; j++) {
      const a = i * sides + j
      const b = i * sides + ((j + 1) % sides)
      idx.push(a, b, a + sides, b, b + sides, a + sides)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// The coat, as a field in model space: every painted piece takes its colour
// from it, so the mask, face and dark legs flow across the joins with no rims.
function coat(K) {
  const base = new THREE.Color(K.base)
  const face = new THREE.Color(K.face)
  const mask = new THREE.Color(K.mask)
  const muzzle = new THREE.Color(K.muzzle)
  const leg = new THREE.Color(K.leg)
  return (c, w) => {
    c.copy(base)
    // the face pales towards the front of the head
    c.lerp(face, smooth(0.62, 0.8, w.z) * smooth(0.76, 0.66, w.y))
    // dark legs: the colour runs up from each leg into the body underneath
    LEGS.forEach(([x, z]) => {
      const d = Math.hypot((w.x - x) * 1.1, (w.y - 0.13) * 1.4, w.z - z)
      c.lerp(leg, smooth(0.17, 0.1, d))
    })
    // a cream muzzle and chin
    c.lerp(muzzle, Math.max(smooth(0.84, 0.94, w.z) * smooth(0.54, 0.5, w.y), smooth(0.48, 0.42, w.y) * smooth(0.7, 0.82, w.z)))
    // the mask: a band across the eyes, broad round them and narrow over the bridge
    const ax = Math.abs(w.x)
    const yc = EYE[1] - 0.005 - 0.3 * Math.max(0, ax - EYE[0])
    const h = 0.022 + 0.27 * Math.min(ax, EYE[0] + 0.03)
    c.lerp(mask, smooth(h + 0.018, h - 0.012, Math.abs(w.y - yc)) * smooth(0.6, 0.72, w.z))
  }
}

function paintedBall(paint, { pos, scale }, segs = 96) {
  const g = new THREE.SphereGeometry(1, segs, Math.round(segs * 0.7))
  const p = g.attributes.position
  const col = new Float32Array(p.count * 3)
  const v = new THREE.Vector3()
  const w = new THREE.Vector3()
  const c = new THREE.Color()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    w.set(pos[0] + v.x * scale[0], pos[1] + v.y * scale[1], pos[2] + v.z * scale[2])
    paint(c, w)
    c.toArray(col, i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}

function useFerretGeometry(K) {
  const geo = useMemo(() => {
    const paint = coat(K)
    const base = new THREE.Color(K.base)
    const tip = new THREE.Color(K.tip)
    return {
      ball: new THREE.SphereGeometry(1, 48, 32),
      body: tube(SPINE, bodyR, paint, { rings: 160, sides: 56, rx: 1.04, ry: 0.95 }),
      head: paintedBall(paint, HEAD, 128),
      muzzle: paintedBall(paint, MUZZLE, 96),
      tail: tube(TAIL, tailR, (c, w, u) => c.copy(base).lerp(tip, smooth(0.25, 0.92, u)), { rings: 90, sides: 32, roundStart: false }),
      // a short column with a rounded foot, running up into the body's middle
      leg: new THREE.LatheGeometry(
        [
          [0.001, 0],
          [0.045, 0],
          [0.062, 0.012],
          [0.07, 0.035],
          [0.066, 0.08],
          [0.062, 0.2],
          [0.062, LEG_TOP],
        ].map(([r, y]) => new THREE.Vector2(r, y)),
        28,
      ),
    }
  }, [K])
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])
  return geo
}

// One piece of clay: a soft, matt material that casts and takes shadow.
function Clay({ color, roughness = 0.66, ...props }) {
  return (
    <mesh castShadow receiveShadow {...props}>
      <meshStandardMaterial color={color} roughness={roughness} metalness={0} />
    </mesh>
  )
}

function Painted({ geometry, ...props }) {
  return (
    <mesh geometry={geometry} castShadow receiveShadow {...props}>
      <meshStandardMaterial vertexColors roughness={0.66} metalness={0} />
    </mesh>
  )
}

const DANCE = 2.6

export function Ferret({ kind = 'sable' }) {
  const K = KINDS[kind] || KINDS.sable
  const geo = useFerretGeometry(K)
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const tapAt = useRef(-99)
  const now = useRef(0)
  const hopper = useRef()
  const squish = useRef()
  const chest = useRef()
  const head = useRef()
  const tail = useRef()
  const tail2 = useRef()
  const eyes = useRef([])

  useFrame(({ clock }) => {
    const t = (now.current = clock.elapsedTime)
    const s = t - tapAt.current
    // the war dance: bouncy sideways hops out and back, wiggling all the way
    let x = 0
    let y = 0
    let wig = 0
    let turn = 0
    let d = 0
    if (s >= 0 && s < DANCE) {
      const q = s / DANCE
      d = Math.sin(Math.PI * q) ** 0.6
      x = 0.32 * Math.sin(TAU * q)
      y = 0.15 * Math.abs(Math.sin(7 * Math.PI * q)) * d
      wig = Math.sin(14 * Math.PI * q) * d
      turn = Math.sin(TAU * q) * d
    }
    hopper.current.position.set(x, y, 0)
    hopper.current.rotation.set(0, turn * 0.35 + wig * 0.12, wig * 0.14)
    // an arched back for the dance, and a bounce on each landing
    const land = s >= 0 && s < DANCE ? Math.max(0, 1 - y / 0.05) * d * 0.05 : 0
    squish.current.scale.set(1 + land * 0.6, 1 - land + d * 0.05, 1 - d * 0.04)
    // a slow breath
    const b = 1 + Math.sin(t * 2.2) * 0.018
    chest.current.scale.set(b, b, 1)
    // the head weaves gently from side to side
    head.current.rotation.set(0.05 * Math.sin(t * 0.8) - d * 0.15, 0.22 * Math.sin(t * 0.95) + 0.06 * Math.sin(t * 2.1) - wig * 0.2, 0.08 * Math.sin(t * 0.95 + 0.6))
    head.current.position.x = 0.025 * Math.sin(t * 0.95 - 0.5)
    // the tail curls lazily, and swishes in the dance
    tail.current.rotation.set(0.06 * Math.sin(t * 0.7) - d * 0.35, 0.3 * Math.sin(t * 0.6) + wig * 0.3, 0)
    tail2.current.rotation.y = 0.25 + 0.25 * Math.sin(t * 0.6 - 0.8)
    // a blink now and then (offset so the eyes are open at the start)
    const lid = (t + 0.4) % 4.3 < 0.13 ? 0.12 : 1
    eyes.current.forEach((e) => e && (e.scale.y = lid))
  })

  return (
    <group
      onClick={(e) => {
        e.stopPropagation()
        tapAt.current = now.current
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHover(true)
      }}
      onPointerOut={() => setHover(false)}
    >
      <group ref={hopper}>
        <group ref={squish}>
          {/* short dark legs, their tops buried at the body's middle */}
          {LEGS.map(([x, z]) => (
            <Clay key={`${x}${z}`} geometry={geo.leg} color={K.leg} position={[x, 0, z]} rotation-z={x * 0.6} />
          ))}

          {/* the long tube of a body */}
          <group ref={chest} position-y={0.3}>
            <group position-y={-0.3}>
              <Painted geometry={geo.body} />
            </group>
          </group>

          {/* the long tail, darkening to its tip */}
          <group ref={tail} position={TAIL_ROOT}>
            <group ref={tail2}>
              <Painted geometry={geo.tail} />
            </group>
          </group>

          {/* head: round, with a painted mask, cream muzzle, dark nose, eyes and ears */}
          <group ref={head} position={[0, 0.42, 0.55]}>
            <group position={[0, -0.42, -0.55]}>
              <Painted geometry={geo.head} position={HEAD.pos} scale={HEAD.scale} />
              <Painted geometry={geo.muzzle} position={MUZZLE.pos} scale={MUZZLE.scale} />
              <Clay geometry={geo.ball} color={K.nose} roughness={0.4} position={[0, 0.47, 1.028]} rotation-x={-0.4} scale={[0.036, 0.026, 0.024]} />
              {[-1, 1].map((x, i) => (
                <group key={x} position={[x * EYE[0], EYE[1], EYE[2]]} rotation-y={x * 0.5}>
                  <group ref={(el) => (eyes.current[i] = el)}>
                    <mesh geometry={geo.ball} scale={0.04}>
                      <meshStandardMaterial color={K.eye} roughness={0.08} />
                    </mesh>
                    <mesh geometry={geo.ball} position={[x * -0.01, 0.016, 0.03]} scale={0.012}>
                      <meshStandardMaterial color="#ffffff" roughness={0.2} />
                    </mesh>
                  </group>
                </group>
              ))}
              {[-1, 1].map((x) => (
                <group key={x} position={[x * EAR[0], EAR[1], EAR[2]]} rotation={[-0.1, x * 0.45, -x * 0.55]}>
                  <Clay geometry={geo.ball} color={K.ear} position-y={0.035} scale={[0.064, 0.058, 0.03]} />
                  <Clay geometry={geo.ball} color={K.inner} position={[0, 0.04, 0.017]} scale={[0.044, 0.04, 0.018]} />
                </group>
              ))}
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}

// The ferret springs in from nothing, overshoots a touch and settles.
function PopIn({ children }) {
  const g = useRef()
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    g.current.scale.setScalar(Math.max(0.001, 1 - Math.exp(-5.5 * t) * Math.cos(8 * t)))
  })
  return <group ref={g}>{children}</group>
}

// The usage tips sit behind a small "i" button in the corner.
function InfoHint({ children }) {
  const [hover, setHover] = useState(false)
  const [pinned, setPinned] = useState(false)
  const open = hover || pinned
  return (
    <div
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(false)}
      style={{ position: 'absolute', right: 12, bottom: 12, zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, maxWidth: 'calc(100% - 24px)' }}
    >
      {open && (
        <div role="tooltip" style={{ maxWidth: 340, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.94)', boxShadow: '0 8px 24px rgba(0,0,0,.14), inset 0 0 0 1px rgba(0,0,0,.06)', font: '500 11px/1.6 ui-monospace, Menlo, monospace', letterSpacing: '0.03em', color: '#2a2925', textAlign: 'left' }}>
          {children}
        </div>
      )}
      <button
        type="button"
        aria-label="How to use"
        aria-expanded={open}
        onClick={() => setPinned((p) => !p)}
        style={{ width: 30, height: 30, padding: 0, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', background: open ? '#1c1a16' : 'rgba(255,255,255,0.88)', color: open ? '#f4f1ea' : '#2a2925', font: 'italic 700 15px/1 Georgia, "Times New Roman", serif', boxShadow: '0 2px 8px rgba(0,0,0,.14), inset 0 0 0 1px rgba(0,0,0,.08)' }}
      >
        i
      </button>
    </div>
  )
}

export default function FerretScene({ background = '#f6f4ef', autoRotate = true, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [3.3, 1.3, 2.4], fov: 30, near: 0.05, far: 60 }} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1 }}>
        <color attach="background" args={[background]} />
        <hemisphereLight args={['#ffffff', '#e8e4ec', 1.6]} />
        <directionalLight position={[3, 6, 5]} intensity={1.9} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.03} shadow-radius={5}>
          <orthographicCamera attach="shadow-camera" args={[-2.6, 2.6, 2.6, -1.2, 0.5, 16]} />
        </directionalLight>
        <directionalLight position={[-5, 3, -4]} intensity={0.9} color="#fff0e0" />
        <PopIn>
          <Ferret {...props} />
        </PopIn>
        <ContactShadows position={[0, 0, 0]} opacity={0.34} scale={7} blur={2.6} far={2.2} resolution={512} color="#3a2a28" />
        <OrbitControls makeDefault enablePan={false} target={[0, 0.3, -0.15]} autoRotate={autoRotate} autoRotateSpeed={0.7} minDistance={2.5} maxDistance={14} maxPolarAngle={1.5} />
      </Canvas>
      <InfoHint>It breathes, weaves its head, blinks and curls its tail on its own · tap it and it does a weasel war dance, hopping sideways with a wiggle · Kind swaps sable, albino, cinnamon and silver · drag to orbit</InfoHint>
    </div>
  )
}

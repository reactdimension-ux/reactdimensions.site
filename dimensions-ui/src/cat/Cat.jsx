import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls, useCursor } from '@react-three/drei'
import * as THREE from 'three'

// A clay-toy cat sitting down: a pear of a body with its haunches tucked in,
// a cream belly, two front legs planted under the chest with cream paws, an
// orange round head with pointed pink-lined ears, big glossy eyes, a pink nose
// over two cream muzzle puffs and a cream-tipped tail curled up behind.
// It breathes, flicks its ears, blinks slowly and sways its tail. Tap it and
// it stretches up and kneads with its front paws.
// It faces +z and sits on y = 0.

const TAU = Math.PI * 2

const KINDS = {
  ginger: { skin: '#ee9a4a', tail: '#ee9a4a', cream: '#fcf0dc', inner: '#f6a5b1', nose: '#ee8597', eye: '#21170f' },
  grey: { skin: '#a3a8b0', tail: '#a3a8b0', cream: '#f1f1ef', inner: '#f2a9b4', nose: '#e88a9a', eye: '#1b1d22' },
  black: { skin: '#2f2c31', tail: '#2f2c31', cream: '#efe7dc', inner: '#d9909d', nose: '#d97b8d', eye: '#cfd24a', pupil: '#15120e' },
  calico: { skin: '#f8f3ea', tail: '#e8903d', cream: '#ffffff', inner: '#f6a5b1', nose: '#ee8597', eye: '#21170f', spots: ['#e8903d', '#3b3331'] },
}

// patch directions (on a unit ball), angular radii and which spot colour, for calico
const BODY_SPOTS = [
  [[0.75, 0.35, -0.55], 0.55, 0],
  [[-0.65, 0.05, -0.75], 0.5, 1],
  [[-0.95, 0.35, 0.15], 0.32, 0],
  [[0.15, 0.85, -0.5], 0.3, 1],
  [[0.9, -0.3, 0.2], 0.26, 1],
]
const HEAD_SPOTS = [
  [[0.65, 0.6, 0.3], 0.42, 0],
  [[-0.55, 0.7, 0.1], 0.38, 1],
  [[0, 0.4, -0.9], 0.55, 0],
]

const BODY = { pos: [0, 0.48, -0.08], scale: [0.33, 0.44, 0.35] }
const NECK = [0, 0.88, 0.06] // the head tips about this point, inside the body
const TAIL_ROOT = [0, 0.12, -0.38]

// A ball painted with soft flush patches (vertex colours, so nothing is raised).
function paintedBall(base, colors, spots) {
  const g = new THREE.SphereGeometry(1, 72, 52)
  const p = g.attributes.position
  const cb = new THREE.Color(base)
  const cs = (colors || []).map((x) => new THREE.Color(x))
  const c = new THREE.Color()
  const v = new THREE.Vector3()
  const d = new THREE.Vector3()
  const col = []
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize()
    c.copy(cb)
    if (cs.length)
      for (const [dir, r, k] of spots) {
        const a = Math.acos(THREE.MathUtils.clamp(v.dot(d.set(...dir).normalize()), -1, 1))
        // a slightly wobbly edge so the patches read as painted by hand
        const w = r * (1 + 0.12 * Math.sin(Math.atan2(v.y, v.x) * 5 + dir[0] * 7))
        c.lerp(cs[k], 1 - THREE.MathUtils.smoothstep(a, w - 0.07, w + 0.07))
      }
    col.push(c.r, c.g, c.b)
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  return g
}

// ---- the tail: a tube sweeping back and curling up, cream at the tip ----

const TAIL = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0, 0.02, -0.17),
  new THREE.Vector3(0, 0.15, -0.31),
  new THREE.Vector3(0, 0.38, -0.36),
  new THREE.Vector3(0, 0.58, -0.3),
  new THREE.Vector3(0, 0.67, -0.17),
])
const tailR = (u) => (0.056 + 0.01 * Math.sin(Math.PI * u)) * Math.sqrt(Math.max(0, 1 - u ** 8))

function tailGeometry(skin, tip, rings = 48, sides = 24) {
  const pos = []
  const col = []
  const idx = []
  const X = new THREE.Vector3(1, 0, 0)
  const N = new THREE.Vector3()
  const cs = new THREE.Color(skin)
  const ct = new THREE.Color(tip)
  const c = new THREE.Color()
  for (let i = 0; i <= rings; i++) {
    const u = i / rings
    const P = TAIL.getPointAt(u)
    const T = TAIL.getTangentAt(u)
    N.crossVectors(T, X).normalize()
    const r = tailR(u)
    c.copy(cs).lerp(ct, THREE.MathUtils.smoothstep(u, 0.78, 0.86))
    for (let j = 0; j < sides; j++) {
      const a = (j / sides) * TAU
      pos.push(P.x + r * Math.cos(a), P.y + r * Math.sin(a) * N.y, P.z + r * Math.sin(a) * N.z)
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

// A pointed ear: a cone rounded off at the tip, its base sitting at y = 0.
function earGeometry() {
  const pts = []
  for (let i = 0; i <= 24; i++) {
    const u = i / 24
    // radius shrinks to a soft point, with a little belly near the base
    const r = (1 - u) ** 0.9 * (1 + 0.15 * Math.sin(Math.PI * u)) * Math.sqrt(Math.max(0, 1 - u ** 10))
    pts.push(new THREE.Vector2(Math.max(r, 0.0001), u - 0.15))
  }
  return new THREE.LatheGeometry(pts, 32)
}

function useCatGeometry() {
  const geo = useMemo(
    () => ({
      ball: new THREE.SphereGeometry(1, 48, 32),
      ear: earGeometry(),
    }),
    [],
  )
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])
  return geo
}

// One piece of clay: a soft, matt material that casts and takes shadow.
function Clay({ color, roughness = 0.64, ...props }) {
  return (
    <mesh castShadow receiveShadow {...props}>
      <meshStandardMaterial color={color} roughness={roughness} metalness={0} />
    </mesh>
  )
}

// A painted piece of clay (vertex coloured).
function Painted({ roughness = 0.64, ...props }) {
  return (
    <mesh castShadow receiveShadow {...props}>
      <meshStandardMaterial vertexColors roughness={roughness} metalness={0} />
    </mesh>
  )
}

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))

export function Cat({ kind = 'ginger' }) {
  const K = KINDS[kind] || KINDS.ginger
  const geo = useCatGeometry()
  const painted = useMemo(
    () => ({
      body: paintedBall(K.skin, K.spots, BODY_SPOTS),
      head: paintedBall(K.skin, K.spots, HEAD_SPOTS),
      leg: paintedBall(K.skin),
      tail: tailGeometry(K.tail, K.cream),
    }),
    [K],
  )
  useEffect(() => () => Object.values(painted).forEach((g) => g.dispose()), [painted])
  const earColor = K.spots ? K.spots[0] : K.skin
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const tapAt = useRef(-99)
  const now = useRef(0)
  const stretch = useRef()
  const chest = useRef()
  const head = useRef()
  const ears = useRef([])
  const eyes = useRef([])
  const legs = useRef([])
  const tail = useRef()

  useFrame(({ clock }) => {
    const t = (now.current = clock.elapsedTime)
    const s = t - tapAt.current
    // the stretch after a tap: up quickly, held while kneading, then eased down
    const x = s < 0 ? 0 : smooth(s / 0.35) * (1 - smooth((s - 2.4) / 0.6))
    stretch.current.scale.set(1 - x * 0.05, 1 + x * 0.1, 1 - x * 0.05)
    // breathing
    const b = 1 + Math.sin(t * 1.6) * 0.018
    chest.current.scale.set(BODY.scale[0] * b, BODY.scale[1] * (1 + (b - 1) * 0.6), BODY.scale[2] * b)
    // the head looks about lazily, and tips up, eyes half shut, in the stretch
    head.current.rotation.set(0.04 * Math.sin(t * 0.9) - x * 0.32, 0.22 * Math.sin(t * 0.33) * (1 - x), 0.08 * Math.sin(t * 0.47) * (1 - x))
    // the ears: each flicks on its own beat
    ears.current.forEach((e, i) => {
      if (!e) return
      const side = i ? 1 : -1
      const ph = (t + i * 2.3) % (3.4 + i * 1.1)
      const flick = ph < 0.25 ? Math.sin((ph / 0.25) * Math.PI) : 0
      e.rotation.set(-0.08 - flick * 0.15, -side * flick * 0.5, -side * (0.22 + flick * 0.3))
    })
    // a slow blink now and then (open at t ~ 3), and a contented squint while kneading
    const bp = (t + 0.4) % 4.8
    const blink = bp < 0.6 ? Math.sin((bp / 0.6) * Math.PI) : 0
    const lid = Math.max(0.1, 1 - blink * 0.92 - x * 0.6)
    eyes.current.forEach((e) => e && (e.scale.y = lid))
    // kneading: the front paws press up and down in turn
    legs.current.forEach((l, i) => {
      if (!l) return
      const k = Math.max(0, Math.sin(s * 8 + i * Math.PI)) * x
      l.position.y = k * 0.06
      l.rotation.x = -k * 0.25
    })
    // the tail: a slow sway, with a curl at the tip that follows
    tail.current.rotation.z = Math.sin(t * 1.1) * 0.22 + Math.sin(s * 3) * 0.1 * x
    tail.current.rotation.y = Math.sin(t * 1.1 - 0.6) * 0.18
    tail.current.rotation.x = 0.04 * Math.sin(t * 0.8) - x * 0.12
  })

  return (
    <group
      onClick={(e) => {
        e.stopPropagation()
        // a fresh tap restarts the stretch only once the last one is ending
        if (now.current - tapAt.current > 2.6) tapAt.current = now.current
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHover(true)
      }}
      onPointerOut={() => setHover(false)}
    >
      <group ref={stretch}>
        {/* body, tucked haunches, back feet and cream belly */}
        <group ref={chest} position={BODY.pos} scale={BODY.scale}>
          <Painted geometry={painted.body} />
        </group>
        {[-1, 1].map((x) => (
          <group key={x}>
            <Painted geometry={painted.body} position={[x * 0.19, 0.21, -0.1]} rotation={[0.2, 0, x * 0.1]} scale={[0.16, 0.19, 0.26]} />
            <Clay geometry={geo.ball} color={K.cream} position={[x * 0.21, 0.05, 0.13]} scale={[0.075, 0.052, 0.11]} />
          </group>
        ))}
        <Clay geometry={geo.ball} color={K.cream} position={[0, 0.48, 0.15]} rotation-x={-0.12} scale={[0.16, 0.29, 0.15]} />

        {/* front legs, planted, with cream paws */}
        {[-1, 1].map((x, i) => (
          <group key={x} ref={(el) => (legs.current[i] = el)} position={[x * 0.125, 0, 0.235]}>
            <Painted geometry={painted.leg} rotation-x={-0.2} position={[0, 0.35, -0.07]} scale={[0.078, 0.34, 0.078]} />
            <Clay geometry={geo.ball} color={K.cream} position={[0, 0.042, 0.025]} scale={[0.084, 0.058, 0.105]} />
          </group>
        ))}

        {/* tail */}
        <group ref={tail} position={TAIL_ROOT}>
          <mesh geometry={painted.tail} castShadow receiveShadow>
            <meshStandardMaterial vertexColors roughness={0.66} metalness={0} />
          </mesh>
        </group>

        {/* the head: skull, ears, eyes, nose and muzzle puffs */}
        <group ref={head} position={NECK}>
          <Painted geometry={painted.head} position={[0, 0.24, 0.06]} scale={[0.34, 0.29, 0.29]} />
          {[-1, 1].map((x) => (
            <Clay key={x} geometry={geo.ball} color={K.cream} position={[x * 0.055, 0.135, 0.3]} scale={[0.072, 0.058, 0.062]} />
          ))}
          <Clay geometry={geo.ball} color={K.cream} position={[0, 0.095, 0.27]} scale={[0.05, 0.035, 0.05]} />
          <Clay geometry={geo.ball} color={K.nose} roughness={0.3} position={[0, 0.185, 0.345]} rotation-x={0.3} scale={[0.036, 0.024, 0.022]} />
          {[-1, 1].map((x, i) => (
            <group key={x} ref={(el) => (eyes.current[i] = el)} position={[x * 0.13, 0.27, 0.29]} rotation-y={x * 0.36}>
              <mesh geometry={geo.ball} scale={[0.074, 0.084, 0.05]}>
                <meshStandardMaterial color={K.eye} roughness={0.06} />
              </mesh>
              {K.pupil && (
                <mesh geometry={geo.ball} position={[0, 0, 0.014]} scale={[0.026, 0.068, 0.04]}>
                  <meshStandardMaterial color={K.pupil} roughness={0.06} />
                </mesh>
              )}
              <mesh geometry={geo.ball} position={[0.022, 0.03, 0.044]} scale={0.018}>
                <meshBasicMaterial color="#ffffff" />
              </mesh>
            </group>
          ))}
          {[-1, 1].map((x, i) => (
            <group key={x} ref={(el) => (ears.current[i] = el)} position={[x * 0.19, 0.43, 0.05]} rotation-z={-x * 0.22}>
              <Clay geometry={geo.ear} color={earColor} scale={[0.125, 0.25, 0.07]} />
              <Clay geometry={geo.ear} color={K.inner} position={[0, 0.015, 0.042]} scale={[0.08, 0.19, 0.035]} />
            </group>
          ))}
        </group>
      </group>
    </group>
  )
}

// The cat springs in from nothing, overshoots a touch and settles.
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

export default function CatScene({ background = '#f6f4ef', autoRotate = true, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [2.7, 1.35, 2.85], fov: 30, near: 0.05, far: 60 }} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1 }}>
        <color attach="background" args={[background]} />
        <hemisphereLight args={['#ffffff', '#e4e6ee', 1.6]} />
        <directionalLight position={[3, 6, 5]} intensity={1.9} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.03} shadow-radius={5}>
          <orthographicCamera attach="shadow-camera" args={[-2.2, 2.2, 2.6, -0.6, 0.5, 16]} />
        </directionalLight>
        <directionalLight position={[-5, 3, -4]} intensity={0.9} color="#e4e8ff" />
        <PopIn>
          <Cat {...props} />
        </PopIn>
        <ContactShadows position={[0, 0, 0]} opacity={0.34} scale={8} blur={2.6} far={2.6} resolution={512} color="#2a2a40" />
        <OrbitControls makeDefault enablePan={false} target={[0, 0.7, 0.02]} autoRotate={autoRotate} autoRotateSpeed={0.7} minDistance={2.5} maxDistance={14} maxPolarAngle={1.5} />
      </Canvas>
      <InfoHint>It breathes, flicks its ears, blinks slowly and sways its tail on its own · tap it and it stretches up and kneads with its front paws · Kind swaps ginger, grey, black and calico · drag to orbit</InfoHint>
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls, useCursor } from '@react-three/drei'
import * as THREE from 'three'

// A clay-toy puppy sitting down: a pear of a body with its haunches tucked in,
// a cream belly, two front legs planted under the chest, a round head with
// long floppy ears, glossy eyes, a cream muzzle with a button nose and a
// little pink tongue, a red collar with a yellow tag and a cream-tipped tail.
// It breathes, tilts its head, blinks and pants. Tap it and it wags hard and
// gives a bark bounce.
// It faces +z and sits on y = 0.

const TAU = Math.PI * 2

const KINDS = {
  tan: { skin: '#d9a56b', ear: '#8c5a36', cream: '#f6ead4', nose: '#2c1f18', tongue: '#ef8796', collar: '#d63a3c', tag: '#f2c232', eye: '#1d1510' },
  chocolate: { skin: '#80513a', ear: '#4f2f1f', cream: '#ecd3b3', nose: '#1f130d', tongue: '#ee8a98', collar: '#2f9c8f', tag: '#f2c232', eye: '#1a110c' },
  golden: { skin: '#eab65e', ear: '#c78634', cream: '#fbf1d9', nose: '#3a2618', tongue: '#f08796', collar: '#3a74d4', tag: '#f6d04a', eye: '#22170f' },
  spotted: { skin: '#f4f0e8', ear: '#38302c', cream: '#ffffff', nose: '#221c1a', tongue: '#ef8796', collar: '#d63a3c', tag: '#f2c232', eye: '#1a1513', spot: '#38302c' },
}

// patch directions (on a unit ball) and angular radii, for the spotted kind
const BODY_SPOTS = [
  [[0.75, 0.35, -0.55], 0.5],
  [[-0.6, -0.1, -0.75], 0.55],
  [[-0.95, 0.25, 0.2], 0.35],
  [[0.2, 0.85, -0.5], 0.32],
  [[0.9, -0.25, 0.25], 0.28],
]
const HEAD_SPOTS = [
  [[0.5, 0.35, 0.8], 0.36],
  [[-0.3, 0.75, -0.6], 0.45],
]

const BODY = { pos: [0, 0.5, -0.08], scale: [0.36, 0.46, 0.38] }
const NECK = [0, 0.9, 0.06] // the head tilts about this point, inside the body
const TAIL_ROOT = [0, 0.2, -0.36]

// A ball painted with soft flush patches (vertex colours, so nothing is raised).
function paintedBall(base, spot, spots) {
  const g = new THREE.SphereGeometry(1, 72, 52)
  const p = g.attributes.position
  const cb = new THREE.Color(base)
  const cs = new THREE.Color(spot || base)
  const c = new THREE.Color()
  const v = new THREE.Vector3()
  const d = new THREE.Vector3()
  const col = []
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize()
    let m = 0
    if (spot)
      for (const [dir, r] of spots) {
        const a = Math.acos(THREE.MathUtils.clamp(v.dot(d.set(...dir).normalize()), -1, 1))
        // a slightly wobbly edge so the patches read as painted by hand
        const w = r * (1 + 0.12 * Math.sin(Math.atan2(v.y, v.x) * 5 + dir[0] * 7))
        m = Math.max(m, 1 - THREE.MathUtils.smoothstep(a, w - 0.08, w + 0.08))
      }
    c.copy(cb).lerp(cs, m)
    col.push(c.r, c.g, c.b)
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  return g
}

// ---- the tail: a short tube curling up off the back, cream at the tip ----

const TAIL = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0, 0.05, -0.14),
  new THREE.Vector3(0, 0.2, -0.25),
  new THREE.Vector3(0, 0.41, -0.26),
])
const tailR = (u) => (0.056 + 0.024 * Math.sin(Math.PI * Math.min(1, u * 1.1))) * Math.sqrt(Math.max(0, 1 - u ** 6))

function tailGeometry(skin, tip, rings = 36, sides = 24) {
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
    c.copy(cs).lerp(ct, THREE.MathUtils.smoothstep(u, 0.7, 0.82))
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

function usePuppyGeometry() {
  const geo = useMemo(
    () => ({
      ball: new THREE.SphereGeometry(1, 48, 32),
      // a front leg, from the paw up into the chest
      leg: new THREE.CylinderGeometry(0.068, 0.072, 0.6, 24, 1).translate(0, 0.32, 0),
      collar: new THREE.TorusGeometry(1, 0.16, 18, 56),
      tag: new THREE.CylinderGeometry(0.045, 0.045, 0.016, 24).rotateX(Math.PI / 2),
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

export function Puppy({ kind = 'tan' }) {
  const K = KINDS[kind] || KINDS.tan
  const geo = usePuppyGeometry()
  const painted = useMemo(
    () => ({
      body: paintedBall(K.skin, K.spot, BODY_SPOTS),
      head: paintedBall(K.skin, K.spot, HEAD_SPOTS),
      leg: paintedBall(K.skin),
      tail: tailGeometry(K.spot || K.skin, K.cream),
    }),
    [K.skin, K.spot, K.cream],
  )
  useEffect(() => () => Object.values(painted).forEach((g) => g.dispose()), [painted])
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const tapAt = useRef(-99)
  const now = useRef(0)
  const bounce = useRef()
  const chest = useRef()
  const head = useRef()
  const jaw = useRef()
  const tongue = useRef()
  const ears = useRef([])
  const eyes = useRef([])
  const tail = useRef()

  useFrame(({ clock }) => {
    const t = (now.current = clock.elapsedTime)
    const s = t - tapAt.current
    // the excitement after a tap: on quickly, held, then eased off
    const x = s < 0 ? 0 : smooth(s / 0.15) * (1 - smooth((s - 1.6) / 0.5))
    // the bark bounce: a hop up off the haunches with a squash on landing
    const hop = s > 0 && s < 0.5 ? Math.sin((s / 0.5) * Math.PI) : 0
    const land = s > 0.45 && s < 0.9 ? Math.sin(((s - 0.45) / 0.45) * Math.PI) * Math.exp(-(s - 0.45) * 4) : 0
    bounce.current.position.y = hop * 0.16
    const sq = land * 0.1 - hop * 0.04
    bounce.current.scale.set(1 + sq * 0.6, 1 - sq, 1 + sq * 0.6)
    // panting in bouts: quick shallow breaths with the tongue out, then a slow breath
    const pant = smooth(Math.sin(t * 0.55) * 2 + 0.6)
    const pb = Math.sin(t * 11)
    const b = 1 + Math.sin(t * 1.7) * 0.016 * (1 - pant) + pb * 0.012 * pant
    chest.current.scale.set(BODY.scale[0] * b, BODY.scale[1] * (1 + (b - 1) * 0.6), BODY.scale[2] * b)
    // the head tilts curiously from side to side, and tips up to bark
    const bark = s > 0.05 && s < 0.6 ? Math.sin(((s - 0.05) / 0.55) * Math.PI) : 0
    const tilt = 0.22 * Math.sin(t * 0.45) * smooth(Math.abs(Math.sin(t * 0.45)) * 1.6)
    head.current.rotation.set(0.04 * Math.sin(t * 1.3) - bark * 0.3 + pb * 0.012 * pant, 0.18 * Math.sin(t * 0.31) * (1 - x), tilt * (1 - x))
    // the mouth: just ajar while panting, wide for the bark
    jaw.current.rotation.x = 0.1 + pant * (0.12 + pb * 0.04) + bark * 0.4
    tongue.current.scale.set(1, 1, 0.75 + pant * 0.45 + pb * 0.06 * pant)
    // the ears swing with the head and flap with the bounce
    ears.current.forEach((e, i) => {
      if (!e) return
      const side = i ? 1 : -1
      e.rotation.set(0.05 * Math.sin(t * 1.3 + i) - hop * 0.2, 0, side * (0.3 + hop * 0.35 - land * 0.2) - tilt * 0.35)
    })
    // a blink now and then
    const lid = (t + 1.2) % 3.6 < 0.13 ? 0.12 : 1
    eyes.current.forEach((e) => e && (e.scale.y = lid))
    // the tail: a lazy sway, or a hard wag once tapped
    tail.current.rotation.z = Math.sin(t * 2.2) * 0.18 * (1 - x) + Math.sin(s * 30) * 0.6 * x
    tail.current.rotation.x = 0.05 * Math.sin(t * 1.7) - x * 0.2
  })

  return (
    <group
      onClick={(e) => {
        e.stopPropagation()
        // a fresh tap restarts the bark only once the last one is ending
        if (now.current - tapAt.current > 1.4) tapAt.current = now.current
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHover(true)
      }}
      onPointerOut={() => setHover(false)}
    >
      <group ref={bounce}>
        {/* body, tucked haunches, back feet and cream belly */}
        <group ref={chest} position={BODY.pos} scale={BODY.scale}>
          <Painted geometry={painted.body} />
        </group>
        {[-1, 1].map((x) => (
          <group key={x}>
            <Painted geometry={painted.body} position={[x * 0.2, 0.22, -0.1]} rotation={[0.2, 0, x * 0.1]} scale={[0.17, 0.2, 0.27]} />
            <Clay geometry={geo.ball} color={K.cream} position={[x * 0.22, 0.055, 0.14]} scale={[0.085, 0.06, 0.13]} />
          </group>
        ))}
        <Clay geometry={geo.ball} color={K.cream} position={[0, 0.48, 0.16]} rotation-x={-0.12} scale={[0.22, 0.31, 0.16]} />

        {/* front legs, planted, with cream paws */}
        {[-1, 1].map((x) => (
          <group key={x} position={[x * 0.12, 0, 0.21]}>
            <Painted geometry={painted.leg} position-y={0.36} scale={[0.085, 0.34, 0.085]} />
            <Clay geometry={geo.ball} color={K.cream} position={[0, 0.045, 0.03]} scale={[0.085, 0.06, 0.11]} />
          </group>
        ))}

        {/* tail */}
        <group ref={tail} position={TAIL_ROOT}>
          <mesh geometry={painted.tail} castShadow receiveShadow>
            <meshStandardMaterial vertexColors roughness={0.66} metalness={0} />
          </mesh>
        </group>

        {/* collar and tag */}
        <group position={[0, 0.86, 0.03]} rotation-x={Math.PI / 2 + 0.35}>
          <Clay geometry={geo.collar} color={K.collar} roughness={0.5} scale={[0.225, 0.24, 0.24]} />
        </group>
        <Clay geometry={geo.tag} color={K.tag} roughness={0.3} position={[0, 0.695, 0.3]} rotation-x={-0.25} />

        {/* the head: skull, muzzle, nose, mouth and tongue, eyes and floppy ears */}
        <group ref={head} position={NECK}>
          <Painted geometry={painted.head} position={[0, 0.24, 0.06]} scale={[0.34, 0.31, 0.31]} />
          {[-1, 1].map((x) => (
            <Clay key={x} geometry={geo.ball} color={K.cream} position={[x * 0.06, 0.14, 0.32]} scale={[0.11, 0.09, 0.11]} />
          ))}
          <Clay geometry={geo.ball} color={K.cream} position={[0, 0.19, 0.3]} scale={[0.11, 0.095, 0.11]} />
          <Clay geometry={geo.ball} color={K.nose} roughness={0.25} position={[0, 0.21, 0.42]} scale={[0.055, 0.04, 0.035]} />
          <group ref={jaw} position={[0, 0.11, 0.31]}>
            <Clay geometry={geo.ball} color={K.cream} position={[0, -0.025, 0.02]} scale={[0.075, 0.04, 0.07]} />
            <group ref={tongue} position={[0, -0.005, 0.04]}>
              <Clay geometry={geo.ball} color={K.tongue} roughness={0.4} position={[0, -0.01, 0.05]} rotation-x={0.5} scale={[0.038, 0.014, 0.055]} />
            </group>
          </group>
          {[-1, 1].map((x, i) => (
            <group key={x} ref={(el) => (eyes.current[i] = el)} position={[x * 0.13, 0.3, 0.335]}>
              <mesh geometry={geo.ball} scale={0.042}>
                <meshStandardMaterial color={K.eye} roughness={0.08} />
              </mesh>
              <mesh geometry={geo.ball} position={[0.012, 0.014, 0.034]} scale={0.011}>
                <meshBasicMaterial color="#ffffff" />
              </mesh>
            </group>
          ))}
          {[-1, 1].map((x, i) => (
            <group key={x} ref={(el) => (ears.current[i] = el)} position={[x * 0.25, 0.43, 0.03]} rotation-z={x * 0.3}>
              <Clay geometry={geo.ball} color={K.ear} position={[x * 0.03, -0.19, 0]} rotation-y={x * 0.2} scale={[0.065, 0.25, 0.14]} />
            </group>
          ))}
        </group>
      </group>
    </group>
  )
}

// The puppy springs in from nothing, overshoots a touch and settles.
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

export default function PuppyScene({ background = '#f6f4ef', autoRotate = true, ...props }) {
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
          <Puppy {...props} />
        </PopIn>
        <ContactShadows position={[0, 0, 0]} opacity={0.34} scale={8} blur={2.6} far={2.6} resolution={512} color="#2a2a40" />
        <OrbitControls makeDefault enablePan={false} target={[0, 0.66, 0.05]} autoRotate={autoRotate} autoRotateSpeed={0.7} minDistance={2.5} maxDistance={14} maxPolarAngle={1.5} />
      </Canvas>
      <InfoHint>It breathes, tilts its head, blinks and pants on its own · tap it and it wags hard and gives a bark bounce · Kind swaps tan, chocolate, golden and spotted · drag to orbit</InfoHint>
    </div>
  )
}

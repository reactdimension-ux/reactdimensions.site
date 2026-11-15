import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls, useCursor } from '@react-three/drei'
import * as THREE from 'three'

// A clay-toy guinea pig: a long rounded loaf of a body with its head melted
// into the front, painted with soft patches, tiny pink-lined ears, glossy
// bead eyes, a puffy muzzle with a pink nose and four stubby white legs. It
// breathes, twitches its nose, blinks and wiggles its ears. Tap it and it
// popcorns: a sudden little jump with a twist and a squashy landing.
// It faces +z and stands on y = 0.

const KINDS = {
  tricolour: { base: '#fbf5ea', belly: '#fbf5ea', slots: ['#6e4a35', '#e69a4c', '#e69a4c', null], leg: '#fbf5ea', ear: '#c99a7c', inner: '#f3b3b6', nose: '#f0959f', eye: '#1d1512' },
  ginger: { base: '#e79d52', belly: '#f8d8ae', slots: [null, '#f2b673', '#fbf2e4', '#fbf2e4'], leg: '#fbf2e4', ear: '#d48a4a', inner: '#f3b3b6', nose: '#ef8f98', eye: '#1d1512' },
  cream: { base: '#f2dcb6', belly: '#fbf0dd', slots: [null, '#f8e7c8', null, '#fbf0dd'], leg: '#fbf3e6', ear: '#e6c49a', inner: '#f5b9bb', nose: '#f19aa2', eye: '#2a1a16' },
  grey: { base: '#a9a6ab', belly: '#f4f1ec', slots: ['#6d6a72', null, '#f4f1ec', '#f4f1ec'], leg: '#f4f1ec', ear: '#8d8a92', inner: '#f0b2b8', nose: '#e8939c', eye: '#141016' },
}

// The patches are soft blobs in model space; every painted piece of clay
// (body, head, muzzle) takes its colour from them, so they flow across the
// joins and lie flush in the surface with no rims.
// [x, y, z, radius, slot]
const SPOTS = [
  [-0.3, 0.74, 0.66, 0.27, 0], // round the eyes, leaving a white blaze
  [0.3, 0.74, 0.66, 0.27, 0],
  [-0.1, 0.8, -0.72, 0.4, 0], // rump
  [0.56, 0.48, -0.32, 0.27, 0],
  [0.12, 0.94, -0.06, 0.38, 1], // saddle
  [-0.58, 0.56, 0.18, 0.3, 1],
  [-0.62, 0.62, -0.42, 0.22, 2],
  [0, 0.94, 0.62, 0.08, 3], // a blaze down the nose to a pale muzzle
  [0, 0.91, 0.73, 0.09, 3],
  [0, 0.85, 0.83, 0.1, 3],
  [0, 0.76, 0.92, 0.12, 3],
  [0, 0.5, 1.0, 0.22, 3],
]

const BODY = { pos: [0, 0.5, -0.12], scale: [0.52, 0.44, 0.74] }
const HEAD = { pos: [0, 0.57, 0.6], scale: [0.4, 0.37, 0.4] }
const MUZZLE = [
  { pos: [-0.085, 0.46, 0.9], scale: [0.14, 0.12, 0.13] },
  { pos: [0.085, 0.46, 0.9], scale: [0.14, 0.12, 0.13] },
]

const smooth = (a, b, x) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return k * k * (3 - 2 * k)
}

// A unit sphere whose vertex colours are painted from where it sits in the model.
function paintedBall(K, { pos, scale }, flatBelly = false, segs = 96) {
  const g = new THREE.SphereGeometry(1, segs, Math.round(segs * 0.7))
  const p = g.attributes.position
  const col = new Float32Array(p.count * 3)
  const v = new THREE.Vector3()
  const w = new THREE.Vector3()
  const base = new THREE.Color(K.base)
  const belly = new THREE.Color(K.belly)
  const slots = K.slots.map((h) => h && new THREE.Color(h))
  const c = new THREE.Color()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    // a loaf sits a little flat underneath
    if (flatBelly && v.y < 0) v.y *= 0.82
    w.set(pos[0] + v.x * scale[0], pos[1] + v.y * scale[1], pos[2] + v.z * scale[2])
    c.copy(base)
    SPOTS.forEach(([x, y, z, r, s]) => {
      if (!slots[s]) return
      const d = Math.hypot(w.x - x, w.y - y, w.z - z)
      c.lerp(slots[s], smooth(r + 0.026, r - 0.026, d))
    })
    c.lerp(belly, smooth(0.34, 0.24, w.y))
    c.toArray(col, i * 3)
    p.setXYZ(i, v.x, v.y, v.z)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

function useGuineaPigGeometry() {
  const geo = useMemo(
    () => ({
      ball: new THREE.SphereGeometry(1, 48, 32),
      // a stubby column with a rounded foot, running up to the body's middle
      leg: new THREE.LatheGeometry(
        [
          [0.001, 0],
          [0.06, 0],
          [0.08, 0.012],
          [0.09, 0.04],
          [0.092, 0.08],
          [0.092, 0.5],
        ].map(([r, y]) => new THREE.Vector2(r, y)),
        28,
      ),
    }),
    [],
  )
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

function Painted({ geometry, pos, scale }) {
  return (
    <mesh geometry={geometry} position={pos} scale={scale} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.66} metalness={0} />
    </mesh>
  )
}

export function GuineaPig({ kind = 'tricolour' }) {
  const K = KINDS[kind] || KINDS.tricolour
  const geo = useGuineaPigGeometry()
  const painted = useMemo(() => ({ body: paintedBall(K, BODY, true, 192), head: paintedBall(K, HEAD, false, 128), muzzle: MUZZLE.map((m) => paintedBall(K, m)) }), [K])
  useEffect(() => () => [painted.body, painted.head, ...painted.muzzle].forEach((g) => g.dispose()), [painted])
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const tapAt = useRef(-99)
  const now = useRef(0)
  const hopper = useRef()
  const squish = useRef()
  const chest = useRef()
  const head = useRef()
  const nose = useRef()
  const ears = useRef([])
  const eyes = useRef([])

  useFrame(({ clock }) => {
    const t = (now.current = clock.elapsedTime)
    const s = t - tapAt.current
    // the popcorn: a quick crouch, a sudden twisting jump, a squashy landing
    let y = 0
    let k = 0
    let twist = 0
    let air = 0
    if (s >= 0 && s < 0.12) k = 0.14 * Math.sin((s / 0.12) * Math.PI * 0.5)
    else if (s >= 0.12 && s < 0.68) {
      const q = (s - 0.12) / 0.56
      y = 4 * q * (1 - q) * 0.42
      k = q < 0.4 ? -0.1 * (1 - q / 0.4) : 0
      twist = Math.sin(q * Math.PI)
      air = Math.sin(q * Math.PI)
    } else if (s >= 0.68 && s < 1.6) k = 0.2 * Math.exp(-6 * (s - 0.68)) * Math.cos((s - 0.68) * 14)
    hopper.current.position.y = y
    hopper.current.rotation.set(-air * 0.12, twist * 0.7, twist * 0.25)
    squish.current.scale.set(1 + k * 0.5, 1 - k, 1 + k * 0.35)
    // a quick little breath
    const b = 1 + Math.sin(t * 2.6) * 0.016
    chest.current.scale.set(b, b, 1)
    // the head looks about a little
    head.current.rotation.set(0.03 * Math.sin(t * 0.9) - air * 0.1, 0.12 * Math.sin(t * 0.41) + 0.05 * Math.sin(t * 1.13), 0.03 * Math.sin(t * 0.7))
    // the nose twitches in rapid little bursts
    const ph = t % 1.9
    const tw = ph < 0.6 ? Math.abs(Math.sin(ph * 26)) : 0
    nose.current.position.y = tw * 0.012
    nose.current.scale.set(1 + tw * 0.12, 1 - tw * 0.08, 1)
    // ears: flicks on their own beats, and a flap in the air
    ears.current.forEach((e, i) => {
      if (!e) return
      const p = (t * 0.42 + i * 0.37) % 1
      const flick = p < 0.1 ? Math.sin((p / 0.1) * Math.PI * 2) * 0.4 : 0
      e.rotation.z = (i ? -1 : 1) * (0.5 + flick + air * 0.5)
    })
    // a blink now and then
    const lid = (t + 2.6) % 4.1 < 0.13 ? 0.12 : 1
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
          {/* stubby white legs, their tops buried at the body's middle */}
          {[
            [-0.26, 0.3],
            [0.26, 0.3],
            [-0.27, -0.46],
            [0.27, -0.46],
          ].map(([x, z]) => (
            <Clay key={`${x}${z}`} geometry={geo.leg} color={K.leg} position={[x, 0, z]} />
          ))}

          {/* the loaf of a body */}
          <group ref={chest} position-y={0.06}>
            <group position-y={-0.06}>
              <Painted geometry={painted.body} {...BODY} />
            </group>
          </group>

          {/* head: melted into the front of the loaf, with muzzle, nose, eyes and ears */}
          <group ref={head} position={[0, 0.55, 0.35]}>
            <group position={[0, -0.55, -0.35]}>
              <Painted geometry={painted.head} {...HEAD} />
              {MUZZLE.map((m, i) => (
                <Painted key={i} geometry={painted.muzzle[i]} {...m} />
              ))}
              <group position={[0, 0.54, 1.0]}>
                <group ref={nose}>
                  <Clay geometry={geo.ball} color={K.nose} roughness={0.45} rotation-x={-0.5} scale={[0.05, 0.034, 0.03]} />
                </group>
              </group>
              {[-1, 1].map((x, i) => (
                <group key={x} position={[x * 0.318, 0.675, 0.79]} rotation-y={x * 0.75}>
                  <group ref={(el) => (eyes.current[i] = el)}>
                    <mesh geometry={geo.ball} scale={0.062}>
                      <meshStandardMaterial color={K.eye} roughness={0.1} />
                    </mesh>
                    <mesh geometry={geo.ball} position={[x * -0.012, 0.022, 0.044]} scale={0.014}>
                      <meshStandardMaterial color="#ffffff" roughness={0.2} />
                    </mesh>
                  </group>
                </group>
              ))}
              {[-1, 1].map((x, i) => (
                <group key={x} position={[x * 0.25, 0.85, 0.55]} rotation-y={x * 0.5}>
                  <group ref={(el) => (ears.current[i] = el)} rotation-z={-x * 0.5}>
                    <Clay geometry={geo.ball} color={K.ear} position-y={0.06} scale={[0.085, 0.075, 0.03]} />
                    <Clay geometry={geo.ball} color={K.inner} position={[0, 0.064, 0.016]} scale={[0.058, 0.05, 0.02]} />
                  </group>
                </group>
              ))}
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}

// The guinea pig springs in from nothing, overshoots a touch and settles.
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

export default function GuineaPigScene({ background = '#f6f4ef', autoRotate = true, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [3.0, 1.3, 2.85], fov: 30, near: 0.05, far: 60 }} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1 }}>
        <color attach="background" args={[background]} />
        <hemisphereLight args={['#ffffff', '#e8e4ec', 1.6]} />
        <directionalLight position={[3, 6, 5]} intensity={1.9} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.03} shadow-radius={5}>
          <orthographicCamera attach="shadow-camera" args={[-2.2, 2.2, 2.4, -0.6, 0.5, 16]} />
        </directionalLight>
        <directionalLight position={[-5, 3, -4]} intensity={0.9} color="#fff0e0" />
        <PopIn>
          <GuineaPig {...props} />
        </PopIn>
        <ContactShadows position={[0, 0, 0]} opacity={0.34} scale={6} blur={2.6} far={2.2} resolution={512} color="#3a2a28" />
        <OrbitControls makeDefault enablePan={false} target={[0, 0.42, 0.05]} autoRotate={autoRotate} autoRotateSpeed={0.7} minDistance={2.5} maxDistance={14} maxPolarAngle={1.5} />
      </Canvas>
      <InfoHint>It breathes, twitches its nose, blinks and wiggles its ears on its own · tap it and it popcorns: a sudden little jump with a twist and a squashy landing · Kind swaps tricolour, ginger, cream and grey · drag to orbit</InfoHint>
    </div>
  )
}

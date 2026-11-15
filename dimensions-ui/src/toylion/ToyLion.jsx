import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls, useCursor } from '@react-three/drei'
import * as THREE from 'three'

// A clay-toy lion: a mustard egg of a body on four short, thick legs with
// big rounded boot paws, a round head ringed by a puffy mane of balloon
// lobes, little cupped ears, bead eyes, a rounded-triangle nose over a
// two-puff muzzle and a thin curling tail with a fuzzy pom-pom. It breathes,
// looks about, blinks, flicks its ears and swishes its tail. Tap it and it
// roars: a crouch, the head throws back, the mane puffs out and springs back
// with a wobble, and a little shake.
// It faces +z and stands on y = 0.

const TAU = Math.PI * 2

const KINDS = {
  golden: { body: '#eab02c', mane: '#ef7a2e', inner: '#f8dc8c', muzzle: '#f8ebbf', nose: '#94502e', tuft: '#64331b' },
  sunset: { body: '#f0952a', mane: '#e0472a', inner: '#fbd09a', muzzle: '#fde3c0', nose: '#77311f', tuft: '#561f14' },
  cream: { body: '#f4e2bd', mane: '#c78a4c', inner: '#fbf0dc', muzzle: '#fffaee', nose: '#85563a', tuft: '#6e4127' },
  snow: { body: '#f7f6f3', mane: '#c8c3d9', inner: '#ebe4f2', muzzle: '#ffffff', nose: '#8b8098', tuft: '#958eaa' },
}

const BODY = { pos: [0, 0.73, -0.1], scale: [0.42, 0.37, 0.6] }
const NECK = [0, 1.14, 0.4] // the head turns about this point
const HC = [0, 0.05, 0.08] // centre of the head ball, inside the head group
const HEAD_R = 0.41

// The mane: a ring of balloon lobes behind the face, a touch bigger at the
// top and the sides. [angle round the face, size, depth offset]
const LOBES = Array.from({ length: 12 }, (_, i) => {
  const a = Math.PI / 2 + Math.PI / 12 + (i / 12) * TAU
  const size = 0.142 + 0.022 * (0.5 + 0.5 * Math.sin(a)) + 0.016 * Math.abs(Math.cos(a))
  return { a, size, z: i % 2 ? 0.03 : -0.01, r: 0.465 + 0.015 * Math.abs(Math.cos(a)) }
})

const TAIL_CURVE = new THREE.CatmullRomCurve3(
  [
    [0, 0, 0],
    [0, 0.07, -0.12],
    [0, 0.03, -0.26],
    [0, -0.12, -0.35],
    [0, -0.27, -0.37],
  ].map((p) => new THREE.Vector3(...p)),
)
const TAIL_END = TAIL_CURVE.getPoint(1)

// a rounded triangle: a squashed ball narrowed towards the bottom
function noseGeometry() {
  const g = new THREE.SphereGeometry(1, 40, 28)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i)
    const k = 0.42 + 0.58 * ((y + 1) / 2) ** 0.8
    p.setX(i, p.getX(i) * k)
    p.setZ(i, p.getZ(i) * (0.75 + 0.25 * k))
  }
  g.computeVertexNormals()
  return g
}

// a fuzzy pom-pom: a ball with lots of fine bumps
function fuzzGeometry() {
  const g = new THREE.SphereGeometry(1, 96, 72)
  const p = g.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    const n =
      Math.sin(v.x * 41 + 1.3) * Math.sin(v.y * 37 + 0.4) * Math.sin(v.z * 43 + 2.1) +
      0.6 * Math.sin(v.x * 67 + v.y * 59 + 0.7) * Math.sin(v.z * 71 - v.y * 53)
    v.multiplyScalar(1 + 0.07 * n)
    p.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  return g
}

function useLionGeometry() {
  const geo = useMemo(
    () => ({
      ball: new THREE.SphereGeometry(1, 64, 44),
      // a short thick column, hidden at the top inside the body
      leg: new THREE.LatheGeometry(
        [
          [0.001, 0.06],
          [0.125, 0.06],
          [0.132, 0.12],
          [0.134, 0.3],
          [0.136, 0.76], // up to the body's middle, so the top is buried inside it
        ].map(([r, y]) => new THREE.Vector2(r, y)),
        40,
      ),
      tail: new THREE.TubeGeometry(TAIL_CURVE, 48, 0.026, 16, false),
      nose: noseGeometry(),
      fuzz: fuzzGeometry(),
    }),
    [],
  )
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])
  return geo
}

// One piece of clay: a soft, matt material that casts and takes shadow.
function Clay({ color, roughness = 0.62, ...props }) {
  return (
    <mesh castShadow receiveShadow {...props}>
      <meshStandardMaterial color={color} roughness={roughness} metalness={0} />
    </mesh>
  )
}

export function ToyLion({ kind = 'golden' }) {
  const K = KINDS[kind] || KINDS.golden
  const geo = useLionGeometry()
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const tapAt = useRef(-99)
  const now = useRef(0)
  const squish = useRef()
  const chest = useRef()
  const head = useRef()
  const lobes = useRef([])
  const ears = useRef([])
  const eyes = useRef([])
  const mouth = useRef()
  const tail = useRef()

  useFrame(({ clock }) => {
    const t = (now.current = clock.elapsedTime)
    const s = t - tapAt.current
    // the roar: a brief crouch, then the head throws back and the mane puffs
    let k = 0 // squash (+) / stretch (-)
    let roar = 0 // 0..1, how far into the roar
    let puff = 0
    let crouch = 0
    if (s >= 0 && s < 0.2) {
      crouch = Math.sin((s / 0.2) * Math.PI * 0.5)
      k = 0.1 * crouch
    } else if (s >= 0.2 && s < 2.4) {
      const a = s - 0.2
      crouch = Math.max(0, 1 - a / 0.1)
      roar = a < 0.7 ? Math.sin(Math.min(1, a / 0.14) * Math.PI * 0.5) : Math.exp(-6 * (a - 0.7))
      puff = a < 0.7 ? 0.3 * Math.sin(Math.min(1, a / 0.12) * Math.PI * 0.5) : 0.3 * Math.exp(-4.5 * (a - 0.7)) * Math.cos((a - 0.7) * 15)
      k = 0.1 * crouch + (a < 0.7 ? -0.05 * roar : -0.05 * Math.exp(-5 * (a - 0.7)) * Math.cos((a - 0.7) * 12))
    }
    const shake = roar * Math.sin(s * 42) * 0.05
    squish.current.scale.set(1 + k * 0.5, 1 - k, 1 + k * 0.5)
    squish.current.rotation.z = shake * 0.4
    // a slow breath
    const b = 1 + Math.sin(t * 1.6) * 0.014
    chest.current.scale.set(BODY.scale[0] * b, BODY.scale[1] * b, BODY.scale[2])
    // the head looks about, nods with the breath, dips in the crouch and
    // throws back for the roar
    head.current.rotation.set(
      0.03 * Math.sin(t * 1.6 + 0.6) + 0.05 * Math.sin(t * 0.43) + crouch * 0.12 - roar * 0.38,
      (0.24 * Math.sin(t * 0.37) + 0.1 * Math.sin(t * 0.83)) * (1 - roar),
      0.04 * Math.sin(t * 0.6) + shake,
    )
    // the mane lobes puff out together, each with its own little flutter
    lobes.current.forEach((m, i) => {
      if (!m) return
      const L = LOBES[i]
      const p = 0.85 * puff + (roar > 0 ? 0.04 * Math.sin(s * 26 + i * 1.7) * roar : 0) + 0.012 * Math.sin(t * 1.6 + i)
      const r = L.r + p * 0.22
      m.position.set(HC[0] + Math.cos(L.a) * r, HC[1] + Math.sin(L.a) * r, HC[2] + L.z - 0.05)
      m.scale.set(L.size * (1 + p), L.size * 1.12 * (1 + p * 1.2), L.size * (1 + p * 0.6))
    })
    // the mouth opens for the roar
    mouth.current.scale.set(0.075, 0.001 + 0.07 * roar, 0.05)
    // ears: quick flicks on their own beats, and pinned back in the roar
    ears.current.forEach((e, i) => {
      if (!e) return
      const ph = (t * 0.33 + i * 0.43) % 1
      const flick = ph < 0.1 ? Math.sin((ph / 0.1) * Math.PI * 2) * 0.35 : 0
      e.rotation.z = (i ? -1 : 1) * (0.25 + flick + roar * 0.35)
      e.rotation.x = -flick * 0.4 - roar * 0.4
    })
    // a blink now and then
    const lid = roar === 0 && (t + 0.6) % 3.9 < 0.13 ? 0.12 : 1
    eyes.current.forEach((e) => e && (e.scale.y = 0.044 * lid))
    // the tail swishes slowly, and lashes in the roar
    tail.current.rotation.y = Math.sin(t * 1.7) * 0.35 + Math.sin(s * 9) * roar * 0.5
    tail.current.rotation.x = Math.sin(t * 1.1) * 0.08 - roar * 0.35
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
      <group ref={squish}>
        {/* legs, each ending in a big rounded boot of a paw */}
        {[
          [-0.2, 0.22],
          [0.2, 0.22],
          [-0.2, -0.4],
          [0.2, -0.4],
        ].map(([x, z]) => (
          <group key={`${x}${z}`} position={[x, 0, z]} rotation-y={x * 0.5}>
            <Clay geometry={geo.leg} color={K.body} />
            <Clay geometry={geo.ball} color={K.body} position={[0, 0.115, 0.05]} scale={[0.17, 0.12, 0.205]} />
          </group>
        ))}

        {/* body */}
        <group ref={chest} position={BODY.pos} scale={BODY.scale}>
          <Clay geometry={geo.ball} color={K.body} />
        </group>

        {/* tail with its pom-pom */}
        <group ref={tail} position={[0, 0.9, -0.62]}>
          <Clay geometry={geo.tail} color={K.body} />
          <Clay geometry={geo.fuzz} color={K.tuft} roughness={1} position={TAIL_END} scale={0.11} />
        </group>

        {/* head: ball, mane, ears, eyes, nose, muzzle and mouth */}
        <group ref={head} position={NECK}>
          <Clay geometry={geo.ball} color={K.body} position={HC} scale={HEAD_R} />
          {/* the back of the mane, so it reads from behind too */}
          <Clay geometry={geo.ball} color={K.mane} position={[HC[0], HC[1], HC[2] - 0.12]} scale={[0.52, 0.52, 0.28]} />
          {LOBES.map((L, i) => (
            <mesh key={i} ref={(el) => (lobes.current[i] = el)} castShadow receiveShadow geometry={geo.ball} rotation-z={L.a - Math.PI / 2}>
              <meshStandardMaterial color={K.mane} roughness={0.6} metalness={0} />
            </mesh>
          ))}
          {[-1, 1].map((x, i) => (
            <group key={x} ref={(el) => (ears.current[i] = el)} position={[HC[0] + x * 0.26, HC[1] + 0.31, HC[2] + 0.13]} rotation-z={-x * 0.25}>
              <Clay geometry={geo.ball} color={K.body} rotation-x={-0.3} scale={[0.1, 0.092, 0.055]} />
              <Clay geometry={geo.ball} color={K.inner} position={[0, -0.008, 0.034]} rotation-x={-0.3} scale={[0.064, 0.058, 0.028]} />
            </group>
          ))}
          {[-1, 1].map((x, i) => (
            <mesh key={x} ref={(el) => (eyes.current[i] = el)} geometry={geo.ball} position={[HC[0] + x * 0.16, HC[1] + 0.07, HC[2] + 0.37]} scale={0.044}>
              <meshStandardMaterial color="#141110" roughness={0.15} />
            </mesh>
          ))}
          <Clay geometry={geo.nose} color={K.nose} roughness={0.5} position={[HC[0], HC[1] - 0.02, HC[2] + 0.415]} rotation-x={0.2} scale={[0.08, 0.062, 0.055]} />
          {[-1, 1].map((x) => (
            <Clay key={x} geometry={geo.ball} color={K.muzzle} position={[HC[0] + x * 0.075, HC[1] - 0.115, HC[2] + 0.36]} scale={[0.1, 0.082, 0.075]} />
          ))}
          <mesh ref={mouth} geometry={geo.ball} position={[HC[0], HC[1] - 0.2, HC[2] + 0.35]}>
            <meshStandardMaterial color="#5a2620" roughness={0.7} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

// The lion springs in from nothing, overshoots a touch and settles.
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

export default function ToyLionScene({ background = '#f6f4ef', autoRotate = true, kind = 'golden', ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [4.6, 1.8, 3.1], fov: 30, near: 0.05, far: 60 }} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1 }}>
        <color attach="background" args={[background]} />
        <hemisphereLight args={['#ffffff', '#efe6d6', 1.6]} />
        <directionalLight position={[3, 6, 5]} intensity={1.9} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.03} shadow-radius={5}>
          <orthographicCamera attach="shadow-camera" args={[-2.2, 2.2, 2.6, -0.6, 0.5, 16]} />
        </directionalLight>
        <directionalLight position={[-5, 3, -4]} intensity={0.9} color="#fff1dc" />
        <PopIn>
          <ToyLion kind={kind} {...props} />
        </PopIn>
        <ContactShadows position={[0, 0, 0]} opacity={0.32} scale={8} blur={2.6} far={2.6} resolution={512} color="#3a2a18" />
        <OrbitControls makeDefault enablePan={false} target={[0, 0.82, 0.05]} autoRotate={autoRotate} autoRotateSpeed={0.7} minDistance={3} maxDistance={14} maxPolarAngle={1.5} />
      </Canvas>
      <InfoHint>It breathes, looks about, blinks, flicks its ears and swishes its tail on its own · tap it and it roars: a crouch, the head throws back, the mane puffs out and springs back with a wobble, and a little shake · Kind swaps golden, sunset, cream and snow · drag to orbit</InfoHint>
    </div>
  )
}

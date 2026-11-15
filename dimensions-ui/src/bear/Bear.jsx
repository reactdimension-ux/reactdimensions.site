import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls, useCursor } from '@react-three/drei'
import * as THREE from 'three'

// A clay-toy bear: a big round head sitting forward over a bean of a body,
// a cream muzzle with a glossy button nose, wide-set bead eyes, two cupped
// ears lined in tan, four capsule legs and a fuzzy pom-pom tail. It breathes,
// sways its head, blinks and wiggles its ears. Tap it and it rears up onto
// its hind legs, paws in the air, holds a beat and drops back down with a
// squashy wobble.
// It faces +z and stands on y = 0.

const KINDS = {
  brown: { fur: '#a4643f', inner: '#d9a873', muzzle: '#f3e7c0', nose: '#3a1d14', eye: '#24130e' },
  honey: { fur: '#cf9443', inner: '#f0d19a', muzzle: '#f7ebcb', nose: '#55301c', eye: '#25160e' },
  panda: { fur: '#f2f0ea', inner: '#3a3638', muzzle: '#fbfaf6', nose: '#1a181a', eye: '#100e0f', ear: '#222022', leg: '#222022', patch: '#222022' },
  polar: { fur: '#f0ebdf', inner: '#e0d0b6', muzzle: '#f8f4e8', nose: '#1d1b1c', eye: '#141213' },
}

const BODY = { pos: [0, 0.79, -0.2], scale: [0.47, 0.44, 0.72] }
const NECK = [0, 0.96, 0.27] // the head turns about this point, inside the body
const SKULL = [0, 0.12, 0.2]
const HIP = [0, 0.46, -0.52] // the bear rears up about this point, over its back legs

function useBearGeometry() {
  const geo = useMemo(() => {
    // a pom-pom: a ball with a soft, lumpy, fuzzy surface
    const pom = new THREE.SphereGeometry(1, 48, 32)
    const p = pom.attributes.position
    const v = new THREE.Vector3()
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i)
      const n = Math.sin(v.x * 37.1 + v.y * 11.3) * Math.sin(v.y * 29.7 - v.z * 17.9) * Math.sin(v.z * 41.3 + v.x * 7.7)
      v.multiplyScalar(1 + n * 0.07)
      p.setXYZ(i, v.x, v.y, v.z)
    }
    pom.computeVertexNormals()
    return {
      ball: new THREE.SphereGeometry(1, 64, 44),
      // tall enough that its top is buried in the body: from the floor to y = 0.85
      leg: new THREE.CapsuleGeometry(0.13, 0.59, 16, 32),
      pom,
    }
  }, [])
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

const LEGS = [
  [-0.22, 0.24],
  [0.22, 0.24],
  [-0.22, -0.52],
  [0.22, -0.52],
]

export function Bear({ kind = 'brown' }) {
  const K = KINDS[kind] || KINDS.brown
  const geo = useBearGeometry()
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const tapAt = useRef(-99)
  const now = useRef(0)
  const squish = useRef()
  const rearer = useRef()
  const chest = useRef()
  const head = useRef()
  const ears = useRef([])
  const eyes = useRef([])
  const front = useRef([])
  const tail = useRef()

  useFrame(({ clock }) => {
    const t = (now.current = clock.elapsedTime)
    const s = t - tapAt.current
    // the rear: a quick rise, a held beat with paws paddling, a heavy drop
    let r = 0
    let k = 0
    let paddle = 0
    if (s >= 0 && s < 0.12) k = 0.08 * Math.sin((s / 0.12) * Math.PI)
    if (s >= 0.08 && s < 0.48) {
      const q = (s - 0.08) / 0.4
      r = 1 - Math.pow(1 - q, 3) + Math.sin(q * Math.PI) * 0.06
    } else if (s >= 0.48 && s < 1.25) {
      r = 1 + Math.sin((s - 0.48) * 9) * 0.03
      paddle = Math.sin((s - 0.48) * 14) * Math.min(1, (s - 0.48) * 6)
    } else if (s >= 1.25 && s < 1.55) {
      const q = (s - 1.25) / 0.3
      r = 1 - q * q
    } else if (s >= 1.55 && s < 2.6) k = 0.17 * Math.exp(-5 * (s - 1.55)) * Math.cos((s - 1.55) * 13)
    rearer.current.rotation.x = -0.72 * r
    squish.current.scale.set(1 + k * 0.5, 1 - k, 1 + k * 0.5)
    // a slow breath
    const b = 1 + Math.sin(t * 1.6) * 0.015
    chest.current.scale.set(BODY.scale[0] * b, BODY.scale[1] * b, BODY.scale[2])
    // front paws hang and paddle while up
    front.current.forEach((l, i) => l && (l.rotation.x = r * 0.5 + paddle * (i ? 0.28 : -0.28)))
    // the head sways, tips forward to look ahead while reared, and wobbles on landing
    const wob = s >= 1.55 && s < 3 ? Math.exp(-3 * (s - 1.55)) * Math.sin((s - 1.55) * 11) : 0
    head.current.rotation.set(
      0.03 * Math.sin(t * 1.6 + 0.6) + 0.04 * Math.sin(t * 0.47) + r * 0.42,
      0.22 * Math.sin(t * 0.37) + 0.07 * Math.sin(t * 0.83),
      0.05 * Math.sin(t * 0.6) + wob * 0.14,
    )
    // ears: quick wiggles on their own beats, perked while up
    ears.current.forEach((e, i) => {
      if (!e) return
      const ph = (t * 0.33 + i * 0.47) % 1
      const flick = ph < 0.11 ? Math.sin((ph / 0.11) * Math.PI * 2) * 0.3 : 0
      e.rotation.z = (i ? -1 : 1) * (0.42 + flick - r * 0.15 + wob * 0.3)
      e.rotation.x = -flick * 0.5 - r * 0.2
    })
    // a blink now and then
    const lid = t % 5.9 > 5.76 ? 0.12 : 1
    eyes.current.forEach((e) => e && (e.scale.y = 0.05 * lid))
    // the pom-pom jiggles
    tail.current.position.y = 0.94 + Math.sin(t * 3.2) * 0.008 + wob * 0.03
  })

  const eyeZ = K.patch ? 0.585 : 0.56

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
        {/* back legs stay planted */}
        {LEGS.slice(2).map(([x, z]) => (
          <Clay key={x} geometry={geo.leg} color={K.leg || K.fur} position={[x, 0.425, z]} />
        ))}

        {/* everything else pitches back about the hips when it rears */}
        <group ref={rearer} position={HIP}>
          <group position={[-HIP[0], -HIP[1], -HIP[2]]}>
            {LEGS.slice(0, 2).map(([x, z], i) => (
              <group key={x} ref={(el) => (front.current[i] = el)} position={[x, 0.56, z]}>
                <Clay geometry={geo.leg} color={K.leg || K.fur} position-y={-0.135} />
              </group>
            ))}

            {/* body */}
            <group ref={chest} position={BODY.pos} scale={BODY.scale}>
              <Clay geometry={geo.ball} color={K.fur} />
            </group>

            {/* pom-pom tail */}
            <group ref={tail} position={[0, 0.94, -0.9]}>
              <Clay geometry={geo.pom} color={K.fur} roughness={1} scale={0.085} />
            </group>

            {/* head: skull, muzzle, nose, eyes and ears */}
            <group ref={head} position={NECK}>
              <Clay geometry={geo.ball} color={K.fur} position={SKULL} scale={[0.46, 0.44, 0.44]} />
              <Clay geometry={geo.ball} color={K.muzzle} position={[0, -0.05, 0.56]} scale={[0.23, 0.18, 0.19]} />
              <mesh geometry={geo.ball} position={[0, 0.04, 0.745]} rotation-x={-0.3} scale={[0.07, 0.05, 0.05]}>
                <meshStandardMaterial color={K.nose} roughness={0.18} />
              </mesh>
              {K.patch &&
                [-1, 1].map((x) => (
                  <Clay key={x} geometry={geo.ball} color={K.patch} position={[x * 0.24, 0.15, 0.55]} rotation={[0, x * 0.55, x * 0.6]} scale={[0.105, 0.14, 0.05]} />
                ))}
              {[-1, 1].map((x, i) => (
                <mesh key={x} ref={(el) => (eyes.current[i] = el)} geometry={geo.ball} position={[x * 0.25, 0.17, eyeZ]} scale={0.05}>
                  <meshStandardMaterial color={K.eye} roughness={0.1} />
                </mesh>
              ))}
              {[-1, 1].map((x, i) => (
                <group key={x} ref={(el) => (ears.current[i] = el)} position={[x * 0.27, 0.46, 0.14]} rotation-z={-x * 0.42}>
                  <Clay geometry={geo.ball} color={K.ear || K.fur} position-y={0.08} scale={[0.135, 0.13, 0.07]} />
                  <Clay geometry={geo.ball} color={K.inner} position={[0, 0.075, 0.045]} scale={[0.085, 0.08, 0.04]} />
                </group>
              ))}
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}

// The bear springs in from nothing, overshoots a touch and settles.
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

export default function BearScene({ background = '#f6f4ef', autoRotate = true, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [4.1, 1.75, 3.9], fov: 30, near: 0.05, far: 60 }} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1 }}>
        <color attach="background" args={[background]} />
        <hemisphereLight args={['#ffffff', '#e8e2da', 1.6]} />
        <directionalLight position={[3, 6, 5]} intensity={1.9} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.03} shadow-radius={5}>
          <orthographicCamera attach="shadow-camera" args={[-2.2, 2.2, 2.4, -0.6, 0.5, 16]} />
        </directionalLight>
        <directionalLight position={[-5, 3, -4]} intensity={0.9} color="#e4e8ff" />
        <PopIn>
          <Bear {...props} />
        </PopIn>
        <ContactShadows position={[0, 0, 0]} opacity={0.34} scale={8} blur={2.6} far={2.4} resolution={512} color="#2a2a40" />
        <OrbitControls makeDefault enablePan={false} target={[0, 0.78, 0.05]} autoRotate={autoRotate} autoRotateSpeed={0.7} minDistance={3} maxDistance={14} maxPolarAngle={1.5} />
      </Canvas>
      <InfoHint>It breathes, sways its head, blinks and wiggles its ears on its own · tap it and it rears up onto its hind legs, holds a beat and drops back down with a squashy wobble · Kind swaps brown, honey, panda and polar · drag to orbit</InfoHint>
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls, useCursor } from '@react-three/drei'
import * as THREE from 'three'

// A clay-toy hippo: a big egg of a body on four stubby legs, a round head
// with a huge bulbous snout, two nostril dimples, glossy bead eyes, little
// cupped ears lined in pink and a stub of a tail. It breathes, sways its
// head, blinks, wiggles its ears and wags its tail. Tap it and it does a
// heavy little hop with a big squashy landing.
// It faces +z and stands on y = 0.

const KINDS = {
  slate: { skin: '#9da3ba', inner: '#f1c6cb', nostril: '#747a92', eye: '#2a2126' },
  blush: { skin: '#eaa6b6', inner: '#fbdde2', nostril: '#c97c8f', eye: '#3a2228' },
  lilac: { skin: '#b9a6e6', inner: '#f3d3ea', nostril: '#917cc4', eye: '#2a2138' },
  moss: { skin: '#9bbf8f', inner: '#f3e3c2', nostril: '#74996a', eye: '#22281f' },
}

const BODY = { pos: [0, 0.78, -0.1], scale: [0.56, 0.5, 0.8] }
const NECK = [0, 0.9, 0.4] // the head turns about this point, inside the body

function useHippoGeometry() {
  const geo = useMemo(
    () => ({
      ball: new THREE.SphereGeometry(1, 56, 36),
      // a stubby column with a flat sole and a rounded edge
      leg: new THREE.LatheGeometry(
        [
          [0.001, 0],
          [0.1, 0],
          [0.135, 0.014],
          [0.152, 0.05],
          [0.156, 0.11],
          [0.156, 0.82], // up to the body's middle, so the top is buried inside it
        ].map(([r, y]) => new THREE.Vector2(r, y)),
        32,
      ),
      tail: new THREE.CapsuleGeometry(0.048, 0.09, 8, 16).translate(0, 0.06, 0),
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

export function Hippo({ kind = 'slate' }) {
  const K = KINDS[kind] || KINDS.slate
  const geo = useHippoGeometry()
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const tapAt = useRef(-99)
  const now = useRef(0)
  const hopper = useRef()
  const squish = useRef()
  const chest = useRef()
  const head = useRef()
  const ears = useRef([])
  const eyes = useRef([])
  const tail = useRef()

  useFrame(({ clock }) => {
    const t = (now.current = clock.elapsedTime)
    const s = t - tapAt.current
    // the hop: a deep crouch, a short heavy jump, a big wobbling landing
    let y = 0
    let k = 0
    let air = 0
    if (s >= 0 && s < 0.28) k = 0.16 * Math.sin((s / 0.28) * Math.PI * 0.5)
    else if (s >= 0.28 && s < 0.78) {
      const q = (s - 0.28) / 0.5
      y = 4 * q * (1 - q) * 0.26
      k = q < 0.5 ? -0.09 * (1 - q * 2) : -0.02
      air = Math.sin(q * Math.PI)
    } else if (s >= 0.78 && s < 1.7) k = 0.2 * Math.exp(-5 * (s - 0.78)) * Math.cos((s - 0.78) * 12)
    hopper.current.position.y = y
    squish.current.scale.set(1 + k * 0.5, 1 - k, 1 + k * 0.5)
    // a slow, deep breath
    const b = 1 + Math.sin(t * 1.5) * 0.014
    chest.current.scale.set(BODY.scale[0] * b, BODY.scale[1] * b, BODY.scale[2])
    // the head sways, nods with the breath and shakes after a tap
    const shake = s >= 0 && s < 2.2 ? Math.exp(-2.4 * s) * Math.sin(s * 12) : 0
    head.current.rotation.set(0.03 * Math.sin(t * 1.5 + 0.6) + 0.04 * Math.sin(t * 0.47) - air * 0.14, 0.2 * Math.sin(t * 0.37) + 0.08 * Math.sin(t * 0.83), 0.04 * Math.sin(t * 0.6) + shake * 0.16)
    // ears: quick wiggles on their own beats, and a flap in the air
    ears.current.forEach((e, i) => {
      if (!e) return
      const ph = (t * 0.36 + i * 0.41) % 1
      const flick = ph < 0.12 ? Math.sin((ph / 0.12) * Math.PI * 2) * 0.35 : 0
      e.rotation.z = (i ? -1 : 1) * (0.35 + flick + air * 0.5 + shake * 0.3)
      e.rotation.x = -flick * 0.4
    })
    // a blink now and then
    const lid = (t + 2) % 3.7 < 0.13 ? 0.12 : 1
    eyes.current.forEach((e) => e && (e.scale.y = 0.046 * lid))
    // the tail wags in bursts, harder after a tap
    const wag = t % 3.1 < 1.1 ? Math.sin(t * 16) * 0.45 : Math.sin(t * 2) * 0.08
    tail.current.rotation.z = wag + shake * 0.8
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
          {/* legs */}
          {[
            [-0.28, 0.36],
            [0.28, 0.36],
            [-0.28, -0.56],
            [0.28, -0.56],
          ].map(([x, z]) => (
            <Clay key={`${x}${z}`} geometry={geo.leg} color={K.skin} position={[x, 0, z]} />
          ))}

          {/* body */}
          <group ref={chest} position={BODY.pos} scale={BODY.scale}>
            <Clay geometry={geo.ball} color={K.skin} />
          </group>

          {/* tail */}
          <group ref={tail} position={[0, 0.96, -0.83]} rotation-x={-1.05}>
            <Clay geometry={geo.tail} color={K.skin} />
          </group>

          {/* head: skull, snout, nostrils, eyes and ears */}
          <group ref={head} position={NECK}>
            <Clay geometry={geo.ball} color={K.skin} position={[0, 0.06, 0.22]} scale={[0.42, 0.4, 0.42]} />
            <Clay geometry={geo.ball} color={K.skin} position={[0, -0.16, 0.6]} scale={[0.47, 0.36, 0.42]} />
            {[-1, 1].map((x) => (
              <mesh key={x} geometry={geo.ball} position={[x * 0.178, 0.036, 0.908]} rotation={[-0.75, x * 0.3, 0]} scale={[0.026, 0.03, 0.012]}>
                <meshStandardMaterial color={K.nostril} roughness={0.8} />
              </mesh>
            ))}
            {[-1, 1].map((x, i) => (
              <mesh key={x} ref={(el) => (eyes.current[i] = el)} geometry={geo.ball} position={[x * 0.255, 0.24, 0.485]} scale={0.046}>
                <meshStandardMaterial color={K.eye} roughness={0.12} />
              </mesh>
            ))}
            {[-1, 1].map((x, i) => (
              <group key={x} ref={(el) => (ears.current[i] = el)} position={[x * 0.24, 0.36, 0.17]} rotation-z={-x * 0.35}>
                <Clay geometry={geo.ball} color={K.skin} position-y={0.07} scale={[0.092, 0.1, 0.055]} />
                <Clay geometry={geo.ball} color={K.inner} position={[0, 0.072, 0.03]} scale={[0.06, 0.068, 0.034]} />
              </group>
            ))}
          </group>
        </group>
      </group>
    </group>
  )
}

// The hippo springs in from nothing, overshoots a touch and settles.
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

export default function HippoScene({ background = '#f6f4ef', autoRotate = true, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [4.5, 1.8, 4.2], fov: 30, near: 0.05, far: 60 }} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1 }}>
        <color attach="background" args={[background]} />
        <hemisphereLight args={['#ffffff', '#e6e3ee', 1.6]} />
        <directionalLight position={[3, 6, 5]} intensity={1.9} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.03} shadow-radius={5}>
          <orthographicCamera attach="shadow-camera" args={[-2.2, 2.2, 2.4, -0.6, 0.5, 16]} />
        </directionalLight>
        <directionalLight position={[-5, 3, -4]} intensity={0.9} color="#e4e8ff" />
        <PopIn>
          <Hippo {...props} />
        </PopIn>
        <ContactShadows position={[0, 0, 0]} opacity={0.34} scale={8} blur={2.6} far={2.4} resolution={512} color="#2a2a40" />
        <OrbitControls makeDefault enablePan={false} target={[0, 0.7, 0.2]} autoRotate={autoRotate} autoRotateSpeed={0.7} minDistance={3} maxDistance={14} maxPolarAngle={1.5} />
      </Canvas>
      <InfoHint>It breathes, sways its head, blinks, wiggles its ears and wags its tail on its own · tap it and it does a heavy hop with a big squashy landing · Kind swaps slate, blush, lilac and moss · drag to orbit</InfoHint>
    </div>
  )
}

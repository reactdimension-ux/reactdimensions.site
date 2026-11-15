import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls, useCursor } from '@react-three/drei'
import * as THREE from 'three'

// A clay-toy rhino: a long capsule of a body on four straight column legs,
// a thick collar at the neck, a round head with a bulbous snout carrying two
// ivory horns, bead eyes, upright tube ears with round tips and a thin
// little tail ending in a ball. It breathes, sways its head, blinks,
// swivels its ears and flicks its tail. Tap it and it paws the ground, drops
// its head and makes a little charge forward, then springs back to its spot.
// It faces +z and stands on y = 0.

const KINDS = {
  slate: { skin: '#9099a6', hoof: '#6c7787', horn: '#ece6d6', eye: '#3c4048', collar: '#88919f' },
  sand: { skin: '#d9c3a2', hoof: '#b39d7c', horn: '#fbfaf5', eye: '#3e3328', collar: '#cfb894' },
  sage: { skin: '#a3b5a0', hoof: '#7f927c', horn: '#f1ead2', eye: '#2f372d', collar: '#99ac96' },
  lilac: { skin: '#b8acd6', hoof: '#9285b6', horn: '#fbf9fd', eye: '#352f45', collar: '#ae9fd0' },
}

const BODY = { pos: [0, 0.86, -0.16], r: 0.42, len: 0.74, scale: [0.9, 1, 1] }
const NECK = [0, 0.9, 0.66] // the head turns about this point, inside the collar
const HIP = 0.62 // legs hang from this height
const LEGS = [
  [-0.2, 0.32],
  [0.2, 0.32],
  [-0.2, -0.62],
  [0.2, -0.62],
]

function useRhinoGeometry() {
  const geo = useMemo(() => {
    const body = new THREE.CapsuleGeometry(BODY.r, BODY.len, 24, 64)
    body.rotateX(Math.PI / 2)
    return {
      ball: new THREE.SphereGeometry(1, 56, 36),
      body,
      collar: new THREE.TorusGeometry(0.27, 0.105, 28, 64),
      // a straight column with a flat sole and a softly rounded edge
      leg: new THREE.LatheGeometry(
        [
          [0.001, 0],
          [0.09, 0],
          [0.118, 0.012],
          [0.132, 0.045],
          [0.135, 0.1],
          [0.135, BODY.pos[1]], // up to the body's middle, so the top is buried inside it
        ].map(([r, y]) => new THREE.Vector2(r, y)),
        40,
      ),
      // a horn: a fat cone with a slight swell and a rounded tip
      horn: new THREE.LatheGeometry(
        [
          [0.001, 0],
          [1, 0],
          [0.92, 0.25],
          [0.72, 0.5],
          [0.46, 0.75],
          [0.2, 0.93],
          [0.08, 0.985],
          [0.001, 1],
        ].map(([r, y]) => new THREE.Vector2(r, y)),
        40,
      ),
      stalk: new THREE.CylinderGeometry(1, 1, 1, 24, 1),
    }
  }, [])
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])
  return geo
}

// One piece of clay: a soft, matt material that casts and takes shadow.
function Clay({ color, roughness = 0.7, ...props }) {
  return (
    <mesh castShadow receiveShadow {...props}>
      <meshStandardMaterial color={color} roughness={roughness} metalness={0} />
    </mesh>
  )
}

const smooth = (a, b, x) => {
  const q = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return q * q * (3 - 2 * q)
}

export function Rhino({ kind = 'slate' }) {
  const K = KINDS[kind] || KINDS.slate
  const geo = useRhinoGeometry()
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const tapAt = useRef(-99)
  const now = useRef(0)
  const mover = useRef()
  const squish = useRef()
  const chest = useRef()
  const head = useRef()
  const legs = useRef([])
  const ears = useRef([])
  const eyes = useRef([])
  const tail = useRef()

  useFrame(({ clock }) => {
    const t = (now.current = clock.elapsedTime)
    const s = t - tapAt.current
    const on = s >= 0 && s < 3.4

    // --- the charge timeline ---
    // 0 – 1.2 s: one front leg scrapes back and forth twice
    // 0.2 – 2.2 s: the head lowers, horns forward
    // 1.25 – 1.5 s: a wind-up; 1.5 – 1.85 s: the lunge; 1.85 – 2.45 s: back home
    let paw = 0
    let lift = 0
    if (on && s < 1.2) {
      const env = Math.sin((s / 1.2) * Math.PI)
      paw = Math.sin((s / 1.2) * Math.PI * 4) * 0.5 * Math.min(1, env * 2)
      lift = Math.abs(Math.sin((s / 1.2) * Math.PI * 4)) * 0.04 * Math.min(1, env * 2)
    }
    const lower = on ? smooth(0.15, 0.6, s) * (1 - smooth(2.1, 2.7, s)) : 0
    let z = 0
    let k = 0
    let pitch = 0
    if (on) {
      if (s >= 1.25 && s < 1.5) {
        const q = (s - 1.25) / 0.25
        z = -0.06 * Math.sin(q * Math.PI * 0.5)
        k = 0.08 * Math.sin(q * Math.PI * 0.5)
      } else if (s >= 1.5 && s < 1.85) {
        const q = (s - 1.5) / 0.35
        const e = 1 - Math.pow(1 - q, 3)
        z = -0.06 + 0.56 * e
        k = 0.08 * (1 - q) - 0.06 * Math.sin(q * Math.PI)
        pitch = 0.07 * Math.sin(q * Math.PI)
      } else if (s >= 1.85 && s < 2.45) {
        const q = (s - 1.85) / 0.6
        z = 0.5 * (1 - smooth(0, 1, q))
        pitch = -0.03 * Math.sin(q * Math.PI)
      } else if (s >= 2.45) {
        k = 0.15 * Math.exp(-5 * (s - 2.45)) * Math.cos((s - 2.45) * 13)
      }
    }
    const gallop = on && s >= 1.5 && s < 2.45 ? Math.sin((s - 1.5) * 26) * 0.35 * Math.sin(((s - 1.5) / 0.95) * Math.PI) : 0
    mover.current.position.z = z
    mover.current.rotation.x = pitch
    squish.current.scale.set(1 + k * 0.5, 1 - k, 1 + k * 0.5)

    // legs: the pawing front leg, and a scurry during the charge
    legs.current.forEach((g, i) => {
      if (!g) return
      const side = i % 2 ? 1 : -1
      const front = i < 2
      g.rotation.x = (front ? side : -side) * gallop + (i === 1 ? -paw : 0)
      g.position.y = HIP + (i === 1 ? lift : 0)
    })

    // a slow, deep breath
    const b = 1 + Math.sin(t * 1.4) * 0.012
    chest.current.scale.set(BODY.scale[0] * b, BODY.scale[1] * b, BODY.scale[2])

    // the head sways and nods, then drops for the charge
    head.current.rotation.set(
      0.03 * Math.sin(t * 1.4 + 0.6) + 0.04 * Math.sin(t * 0.43) + lower * 0.42,
      (0.16 * Math.sin(t * 0.35) + 0.06 * Math.sin(t * 0.81)) * (1 - lower),
      0.035 * Math.sin(t * 0.57) * (1 - lower),
    )

    // ears swivel on their own beats and pin back for the charge
    ears.current.forEach((e, i) => {
      if (!e) return
      const ph = (t * 0.3 + i * 0.47) % 1
      const swivel = ph < 0.2 ? Math.sin((ph / 0.2) * Math.PI) * 0.7 : 0
      e.rotation.y = (i ? -1 : 1) * swivel
      e.rotation.z = (i ? -1 : 1) * (0.22 + 0.05 * Math.sin(t * 1.1 + i))
      e.rotation.x = -lower * 0.5 - swivel * 0.15
    })

    // a blink now and then
    const lid = (t + 0.9) % 4.1 < 0.13 ? 0.12 : 1
    eyes.current.forEach((e) => e && (e.scale.y = 0.04 * lid))

    // the tail flicks in little bursts, and sticks out straight on the charge
    const flick = t % 2.7 < 0.6 ? Math.sin(t * 22) * 0.4 : Math.sin(t * 1.7) * 0.08
    tail.current.rotation.y = flick * (1 - lower)
    tail.current.rotation.x = -0.12 + Math.sin(t * 1.3) * 0.05 - lower * 0.25
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
      <group ref={mover}>
        <group ref={squish}>
          {/* legs, each hung from the hip so it can swing */}
          {LEGS.map(([x, lz], i) => (
            <group key={i} ref={(el) => (legs.current[i] = el)} position={[x, HIP, lz]}>
              <Clay geometry={geo.leg} color={K.skin} position-y={-HIP} />
              {/* the darker toe at the front of the foot */}
              <Clay geometry={geo.ball} color={K.hoof} position={[0, -HIP + 0.035, 0.1]} scale={[0.1, 0.04, 0.05]} />
            </group>
          ))}

          {/* body */}
          <group ref={chest} position={BODY.pos} scale={BODY.scale}>
            <Clay geometry={geo.body} color={K.skin} />
          </group>

          {/* collar where the neck meets the body */}
          <Clay geometry={geo.collar} color={K.collar} position={[0, 0.88, 0.5]} scale={[1, 1.06, 1.25]} />

          {/* tail: a thin stalk sticking straight back with a ball on the end */}
          <group ref={tail} position={[0, 0.98, -0.95]}>
            <Clay geometry={geo.stalk} color={K.skin} rotation-x={Math.PI / 2} position-z={-0.09} scale={[0.018, 0.2, 0.018]} />
            <Clay geometry={geo.ball} color={K.skin} position-z={-0.2} scale={0.045} />
          </group>

          {/* head: skull, snout, horns, eyes and ears */}
          <group ref={head} position={NECK}>
            <Clay geometry={geo.ball} color={K.skin} position={[0, 0.08, 0.06]} scale={[0.3, 0.33, 0.3]} />
            <Clay geometry={geo.ball} color={K.skin} position={[0, -0.1, 0.4]} scale={[0.28, 0.25, 0.32]} />
            {/* the big front horn and the small one behind it */}
            <Clay geometry={geo.horn} color={K.horn} roughness={0.55} position={[0, 0.07, 0.6]} rotation-x={0.48} scale={[0.115, 0.35, 0.115]} />
            <Clay geometry={geo.horn} color={K.horn} roughness={0.55} position={[0, 0.18, 0.38]} rotation-x={0.3} scale={[0.085, 0.21, 0.085]} />
            {[-1, 1].map((x, i) => (
              <mesh key={x} ref={(el) => (eyes.current[i] = el)} geometry={geo.ball} position={[x * 0.25, 0.08, 0.24]} scale={0.04}>
                <meshStandardMaterial color={K.eye} roughness={0.3} />
              </mesh>
            ))}
            {[-1, 1].map((x, i) => (
              <group key={x} ref={(el) => (ears.current[i] = el)} position={[x * 0.15, 0.3, -0.04]}>
                <Clay geometry={geo.stalk} color={K.skin} position-y={0.07} scale={[0.054, 0.14, 0.054]} />
                <Clay geometry={geo.ball} color={K.skin} position-y={0.14} scale={[0.062, 0.07, 0.062]} />
              </group>
            ))}
          </group>
        </group>
      </group>
    </group>
  )
}

// The rhino springs in from nothing, overshoots a touch and settles.
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

export default function RhinoScene({ background = '#f6f4ef', autoRotate = true, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [4.3, 1.6, 4.0], fov: 30, near: 0.05, far: 60 }} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1 }}>
        <color attach="background" args={[background]} />
        <hemisphereLight args={['#ffffff', '#e6e3ee', 1.6]} />
        <directionalLight position={[3, 6, 5]} intensity={1.9} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.03} shadow-radius={5}>
          <orthographicCamera attach="shadow-camera" args={[-2.4, 2.4, 2.6, -0.8, 0.5, 16]} />
        </directionalLight>
        <directionalLight position={[-5, 3, -4]} intensity={0.9} color="#e4e8ff" />
        <PopIn>
          <Rhino {...props} />
        </PopIn>
        <ContactShadows position={[0, 0, 0]} opacity={0.34} scale={8} blur={2.6} far={2.4} resolution={512} color="#2a2a40" />
        <OrbitControls makeDefault enablePan={false} target={[0, 0.65, 0.05]} autoRotate={autoRotate} autoRotateSpeed={0.7} minDistance={3} maxDistance={14} maxPolarAngle={1.5} />
      </Canvas>
      <InfoHint>It breathes, sways its head, blinks, swivels its ears and flicks its tail on its own · tap it and it paws the ground, lowers its horns and makes a little charge before springing back to its spot · Kind swaps slate, sand, sage and lilac · drag to orbit</InfoHint>
    </div>
  )
}

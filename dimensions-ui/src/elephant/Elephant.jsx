import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls, useCursor } from '@react-three/drei'
import * as THREE from 'three'

// A clay-toy elephant: a big egg of a body on four thick column legs with
// cream toenails, a round head with big round ears lined in pink, a long
// curling trunk, two small white tusks, glossy bead eyes and a little tufted
// tail. It breathes, flaps its ears, swings its trunk, blinks and flicks its
// tail. Tap it and it trumpets: the trunk curls up high and the ears flare wide.
// It faces +z and stands on y = 0.

const KINDS = {
  slate: { skin: '#a3aabd', inner: '#f2c3cb', tusk: '#fbf8f0', nail: '#ece5d6', tuft: '#6e758a', eye: '#262229' },
  blush: { skin: '#eeb1c0', inner: '#fbdde3', tusk: '#fffaf3', nail: '#fbeee4', tuft: '#c47a8e', eye: '#3a2228' },
  mint: { skin: '#9fd6c2', inner: '#f7c8d1', tusk: '#fffcf4', nail: '#eef6e8', tuft: '#5d9e88', eye: '#1f2a26' },
  lavender: { skin: '#bdafe6', inner: '#f6cde2', tusk: '#fffaf6', nail: '#f1ebfa', tuft: '#8676bd', eye: '#2a2138' },
}

const BODY = { pos: [0, 0.82, -0.12], scale: [0.56, 0.52, 0.72] }
const NECK = [0, 1.02, 0.42] // the head turns about this point, inside the body
const SKULL = [0, 0.08, 0.12]
const SKULL_R = 0.4

// the trunk: a chain of tapering segments hanging from the face
const TRUNK = Array.from({ length: 8 }, (_, i) => ({ r: 0.115 - i * 0.0085, len: 0.088 }))

const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))

function useElephantGeometry() {
  const geo = useMemo(
    () => ({
      ball: new THREE.SphereGeometry(1, 56, 36),
      // a thick column with a flat sole and a rounded edge
      leg: new THREE.LatheGeometry(
        [
          [0.001, 0],
          [0.12, 0],
          [0.152, 0.016],
          [0.17, 0.055],
          [0.172, 0.12],
          [0.165, 0.4],
          [0.165, 0.82], // up to the body's middle, so the top is buried inside it
        ].map(([r, y]) => new THREE.Vector2(r, y)),
        32,
      ),
      trunk: TRUNK.map(({ r, len }) => new THREE.CapsuleGeometry(r, len, 8, 24).translate(0, -len / 2, 0)),
      // a short rounded horn: base at the origin, tip up +y
      tusk: new THREE.LatheGeometry(
        [
          [0.001, 0],
          [0.036, 0],
          [0.034, 0.06],
          [0.026, 0.12],
          [0.014, 0.165],
          [0.001, 0.178],
        ].map(([r, y]) => new THREE.Vector2(r, y)),
        20,
      ),
      tail: new THREE.CylinderGeometry(0.022, 0.016, 0.24, 12, 1).translate(0, -0.12, 0),
    }),
    [],
  )
  useEffect(
    () => () =>
      Object.values(geo)
        .flat()
        .forEach((g) => g.dispose()),
    [geo],
  )
  return geo
}

// One piece of clay: a soft, matt material that casts and takes shadow.
function Clay({ color, roughness = 0.66, children, ...props }) {
  return (
    <mesh castShadow receiveShadow {...props}>
      <meshStandardMaterial color={color} roughness={roughness} metalness={0} />
      {children}
    </mesh>
  )
}

export function Elephant({ kind = 'slate' }) {
  const K = KINDS[kind] || KINDS.slate
  const geo = useElephantGeometry()
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const tapAt = useRef(-99)
  const now = useRef(0)
  const rig = useRef()
  const chest = useRef()
  const head = useRef()
  const ears = useRef([])
  const eyes = useRef([])
  const joints = useRef([])
  const tail = useRef()

  useFrame(({ clock }) => {
    const t = (now.current = clock.elapsedTime)
    const s = t - tapAt.current
    // the trumpet: rise fast, hold with a trembling blast, then ease back down
    const up = s >= 0 && s < 2.4 ? ease(s / 0.32) * (1 - ease((s - 1.5) / 0.9)) : 0
    const blast = s >= 0.25 && s < 1.6 ? Math.sin(s * 46) * Math.min(1, (1.6 - s) * 2) : 0
    // the whole body rocks back onto its heels a touch
    rig.current.rotation.x = -up * 0.06
    rig.current.position.z = -up * 0.03
    // a slow, deep breath
    const b = 1 + Math.sin(t * 1.4) * 0.014
    chest.current.scale.set(BODY.scale[0] * b, BODY.scale[1] * b, BODY.scale[2])
    // the head sways and nods with the breath, and lifts to trumpet
    head.current.rotation.set(0.03 * Math.sin(t * 1.4 + 0.6) + 0.03 * Math.sin(t * 0.47) - up * 0.26, (0.16 * Math.sin(t * 0.37) + 0.06 * Math.sin(t * 0.83)) * (1 - up), 0.035 * Math.sin(t * 0.6))
    // ears: a slow lazy flap, flared out wide on a trumpet
    ears.current.forEach((e, i) => {
      if (!e) return
      const side = i ? 1 : -1
      const flap = 0.2 + 0.18 * Math.sin(t * 2.1 + i * 0.5) * (1 - up)
      e.rotation.y = side * (flap * (1 - up) - up * 0.28 + blast * 0.04)
      e.rotation.z = side * (-0.08 - up * 0.22)
    })
    // the trunk swings and curls; on a trumpet it rears up high and the tip curls back
    joints.current.forEach((j, i) => {
      if (!j) return
      const f = i / (TRUNK.length - 1)
      const idle = -(0.04 + 0.32 * f * f) - 0.07 * Math.sin(t * 1.3 - i * 0.55)
      const loud = i === 0 ? -1.55 : -0.2 - 0.08 * f
      j.rotation.x = idle * (1 - up) + loud * up + blast * 0.015 * f
      j.rotation.z = i === 0 ? (0.12 * Math.sin(t * 0.9) + 0.05 * Math.sin(t * 1.7)) * (1 - up) : 0.03 * Math.sin(t * 0.9 - i * 0.4) * (1 - up)
    })
    // a blink now and then (phased so the eyes are open at the start)
    const lid = (t + 1) % 3.6 < 0.13 ? 0.12 : 1
    eyes.current.forEach((e) => e && (e.scale.y = 0.044 * lid))
    // the tail flicks in quick bursts, and wags hard with the trumpet
    const flick = t % 2.9 < 0.7 ? Math.sin(t * 18) * 0.5 : Math.sin(t * 1.8) * 0.1
    tail.current.rotation.z = flick + blast * 0.3 + up * Math.sin(t * 14) * 0.4
    tail.current.rotation.x = 0.35 + up * 0.5
  })

  // the trunk chain, built inside out so each segment hangs from the last
  let chain = (
    <group position-y={-TRUNK[TRUNK.length - 1].len}>
      <Clay geometry={geo.ball} color={K.skin} scale={[TRUNK[7].r * 1.18, TRUNK[7].r * 0.75, TRUNK[7].r * 1.18]} />
      <mesh geometry={geo.ball} position-y={-TRUNK[7].r * 0.6} scale={[TRUNK[7].r * 0.62, 0.012, TRUNK[7].r * 0.62]}>
        <meshStandardMaterial color={K.tuft} roughness={0.85} />
      </mesh>
    </group>
  )
  for (let i = TRUNK.length - 1; i >= 0; i--) {
    chain = (
      <group ref={(el) => (joints.current[i] = el)} position-y={i ? -TRUNK[i - 1].len : 0}>
        <Clay geometry={geo.trunk[i]} color={K.skin} />
        {chain}
      </group>
    )
  }

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
      <group ref={rig}>
        {/* legs, with a soft hip blob at each join and three toenails */}
        {[
          [-0.27, 0.27],
          [0.27, 0.27],
          [-0.27, -0.5],
          [0.27, -0.5],
        ].map(([x, z]) => (
          <group key={`${x}${z}`} position={[x, 0, z]}>
            <Clay geometry={geo.leg} color={K.skin} />
            <Clay geometry={geo.ball} color={K.skin} position={[-x * 0.12, 0.56, -(z + 0.12) * 0.12]} scale={[0.2, 0.22, 0.2]} />
            {[-1, 0, 1].map((n) => (
              <Clay key={n} geometry={geo.ball} color={K.nail} roughness={0.45} position={[Math.sin(n * 0.55) * 0.166, 0.06, Math.cos(n * 0.55) * 0.166]} rotation-y={n * 0.55} scale={[0.044, 0.04, 0.024]} />
            ))}
          </group>
        ))}

        {/* body */}
        <group ref={chest} position={BODY.pos} scale={BODY.scale}>
          <Clay geometry={geo.ball} color={K.skin} />
        </group>

        {/* tail with a little tuft */}
        <group ref={tail} position={[0, 0.98, -0.8]} rotation-x={0.35}>
          <Clay geometry={geo.tail} color={K.skin} />
          <Clay geometry={geo.ball} color={K.tuft} position-y={-0.26} scale={[0.04, 0.06, 0.04]} />
        </group>

        {/* head: skull, ears, eyes, tusks and trunk */}
        <group ref={head} position={NECK}>
          <Clay geometry={geo.ball} color={K.skin} position={SKULL} scale={SKULL_R} />
          {/* cheeks round the trunk root */}
          {[-1, 1].map((x) => (
            <Clay key={x} geometry={geo.ball} color={K.skin} position={[x * 0.14, -0.1, 0.36]} scale={[0.18, 0.17, 0.17]} />
          ))}
          {[-1, 1].map((x, i) => (
            <mesh key={x} ref={(el) => (eyes.current[i] = el)} geometry={geo.ball} position={[x * 0.19, 0.16, 0.45]} scale={0.044}>
              <meshStandardMaterial color={K.eye} roughness={0.12} />
            </mesh>
          ))}
          {[-1, 1].map((x, i) => (
            <group key={x} ref={(el) => (ears.current[i] = el)} position={[x * 0.28, 0.2, 0.1]} rotation-y={x * 0.2}>
              <Clay geometry={geo.ball} color={K.skin} position={[x * 0.28, 0.02, 0]} scale={[0.34, 0.36, 0.055]} />
              <Clay geometry={geo.ball} color={K.inner} position={[x * 0.3, 0.01, 0.03]} scale={[0.25, 0.275, 0.034]} />
            </group>
          ))}
          {[-1, 1].map((x) => (
            <group key={x} position={[x * 0.16, -0.21, 0.44]} rotation={[1.75, 0, -x * 0.3]}>
              <Clay geometry={geo.tusk} color={K.tusk} roughness={0.35} />
            </group>
          ))}
          <group position={[0, -0.08, 0.46]} rotation-x={-0.25}>
            {chain}
          </group>
        </group>
      </group>
    </group>
  )
}

// The elephant springs in from nothing, overshoots a touch and settles.
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

export default function ElephantScene({ background = '#f6f4ef', autoRotate = true, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [4.8, 2, 4.5], fov: 30, near: 0.05, far: 60 }} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1 }}>
        <color attach="background" args={[background]} />
        <hemisphereLight args={['#ffffff', '#e6e3ee', 1.6]} />
        <directionalLight position={[3, 6, 5]} intensity={1.9} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.03} shadow-radius={5}>
          <orthographicCamera attach="shadow-camera" args={[-2.2, 2.2, 2.6, -0.6, 0.5, 16]} />
        </directionalLight>
        <directionalLight position={[-5, 3, -4]} intensity={0.9} color="#e4e8ff" />
        <PopIn>
          <Elephant {...props} />
        </PopIn>
        <ContactShadows position={[0, 0, 0]} opacity={0.34} scale={8} blur={2.6} far={2.4} resolution={512} color="#2a2a40" />
        <OrbitControls makeDefault enablePan={false} target={[0, 0.82, 0.2]} autoRotate={autoRotate} autoRotateSpeed={0.7} minDistance={3} maxDistance={14} maxPolarAngle={1.5} />
      </Canvas>
      <InfoHint>It breathes, flaps its ears, swings its trunk, blinks and flicks its tail on its own · tap it and it trumpets with its trunk curled up high and its ears flared wide · Kind swaps slate, blush, mint and lavender · drag to orbit</InfoHint>
    </div>
  )
}

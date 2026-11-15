import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls, useCursor } from '@react-three/drei'
import * as THREE from 'three'

// A clay-toy bunny sitting upright: a big round head with tall ears lined in
// pink, bead eyes, a pink nose over a puffy muzzle and blushing cheeks, a
// round body with a bow tie, stubby arms, big feet with pink pads turned to
// the front and a cotton tail. It breathes, wiggles its nose, blinks and
// flops its ears. Tap it and it hops in place with a happy ear flap.
// It faces +z and sits on y = 0.

const TAU = Math.PI * 2

const KINDS = {
  white: { fur: '#f7f3ee', belly: '#fffdfa', inner: '#f5aebd', nose: '#ee7f98', cheek: '#f59aae', pad: '#f4a3b5', bow: '#4f86d6', knot: '#3b6fbd', tail: '#ffffff', eye: '#211a1d' },
  grey: { fur: '#a7a8b6', belly: '#e3e2ea', inner: '#f2b9c5', nose: '#e5839a', cheek: '#f09cb0', pad: '#eeb0be', bow: '#e0585e', knot: '#c2434a', tail: '#f1f0f5', eye: '#1c1a22' },
  brown: { fur: '#b98a62', belly: '#f3e3cf', inner: '#f2b4a6', nose: '#d76c84', cheek: '#ec8f98', pad: '#f0aeae', bow: '#3e9a80', knot: '#2f7d67', tail: '#f8eedf', eye: '#1f1612' },
  pink: { fur: '#f5c2cf', belly: '#fde8ed', inner: '#ee8aa5', nose: '#de5d7e', cheek: '#ec7f9c', pad: '#ec8eaa', bow: '#8a6fd6', knot: '#6f55bb', tail: '#fff4f6', eye: '#2a1a22' },
}

const BODY = { y: 0.52, scale: [0.46, 0.5, 0.42] }
const NECK = [0, 0.95, 0.02] // the head nods about this point, inside the body
const HEAD = { pos: [0, 0.26, 0.04], scale: [0.44, 0.4, 0.4] }
const EAR = [0.105, 0.32, 0.056]
const FOOT = [0.13, 0.09, 0.24]

const UP = new THREE.Vector3(0, 1, 0)
const toward = (x, y, z) => new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(x, y, z).normalize())

// A soft disc that lies on a unit sphere round its +y pole: the rim is sunk
// just under the surface and the middle stands a little proud. Drawn inside a
// part's own scale, so it hugs that part's egg shape exactly.
function capGeometry(angle, puff = 0.03) {
  const g = new THREE.SphereGeometry(1, 48, 12, 0, TAU, 0, angle)
  const p = g.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize()
    const k = Math.min(1, Math.acos(Math.min(1, v.y)) / angle)
    v.multiplyScalar(0.992 + puff * Math.sqrt(1 - k * k))
    p.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  return g
}

function useBunnyGeometry() {
  const geo = useMemo(
    () => ({
      ball: new THREE.SphereGeometry(1, 56, 36),
      lining: capGeometry(0.78, 0.12),
      blush: capGeometry(0.2, 0.03),
      pad: capGeometry(0.52, 0.1),
      bean: capGeometry(0.2, 0.12),
      mouth: new THREE.TorusGeometry(0.028, 0.008, 8, 20, Math.PI).rotateZ(Math.PI),
    }),
    [],
  )
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])
  return geo
}

// where the pads and blushes sit, as directions on their part's unit sphere
const SOLE = toward(0, -1, 0.12)
const BEANS = [toward(-0.42, -0.7, 0.62), toward(0, -0.7, 0.72), toward(0.42, -0.7, 0.62)]
const BELLY = new THREE.Vector3(0, -0.12, 1).normalize()

// The body: a unit sphere with the paler belly painted into the clay as a
// soft-edged vertex colour, so there is no rim where the two meet.
function bodyGeometry(K) {
  const g = new THREE.SphereGeometry(1, 72, 48)
  const p = g.attributes.position
  const col = new Float32Array(p.count * 3)
  const v = new THREE.Vector3()
  const fur = new THREE.Color(K.fur)
  const belly = new THREE.Color(K.belly)
  const c = new THREE.Color()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    const a = Math.acos(Math.min(1, v.dot(BELLY)))
    const k = Math.min(1, Math.max(0, (0.84 - a) / 0.1))
    c.copy(fur).lerp(belly, k * k * (3 - 2 * k)).toArray(col, i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}
const LINING = toward(0, 0.12, 1)
const BLUSH = [toward(-0.62, -0.2, 0.76), toward(0.62, -0.2, 0.76)]

// One piece of clay: a soft, matt material that casts and takes shadow.
function Clay({ color, roughness = 0.64, children, ...props }) {
  return (
    <mesh castShadow receiveShadow {...props}>
      <meshStandardMaterial color={color} roughness={roughness} metalness={0} />
      {children}
    </mesh>
  )
}

export function Bunny({ kind = 'white' }) {
  const K = KINDS[kind] || KINDS.white
  const geo = useBunnyGeometry()
  const body = useMemo(() => bodyGeometry(K), [K])
  useEffect(() => () => body.dispose(), [body])
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
  const arms = useRef([])
  const tail = useRef()

  useFrame(({ clock }) => {
    const t = (now.current = clock.elapsedTime)
    const s = t - tapAt.current
    // the hop: a quick crouch, a springy jump, a bouncy landing
    let y = 0
    let k = 0
    let air = 0
    if (s >= 0 && s < 0.2) k = 0.13 * Math.sin((s / 0.2) * Math.PI * 0.5)
    else if (s >= 0.2 && s < 0.74) {
      const q = (s - 0.2) / 0.54
      y = 4 * q * (1 - q) * 0.26
      k = q < 0.5 ? -0.08 * (1 - q * 2) : -0.02
      air = Math.sin(q * Math.PI)
    } else if (s >= 0.74 && s < 1.6) k = 0.15 * Math.exp(-6 * (s - 0.74)) * Math.cos((s - 0.74) * 15)
    hopper.current.position.y = y
    squish.current.scale.set(1 + k * 0.5, 1 - k, 1 + k * 0.5)
    // a soft breath
    const b = 1 + Math.sin(t * 1.8) * 0.016
    chest.current.scale.set(BODY.scale[0] * b, BODY.scale[1] * b, BODY.scale[2] * b)
    // the head tilts about and nods with the breath, and tips up in the air
    const happy = s >= 0 && s < 2.4 ? Math.exp(-2.2 * s) : 0
    head.current.rotation.set(0.03 * Math.sin(t * 1.8 + 0.5) + 0.03 * Math.sin(t * 0.5) - air * 0.12, 0.18 * Math.sin(t * 0.33) + 0.06 * Math.sin(t * 0.81), 0.07 * Math.sin(t * 0.42) + happy * 0.1 * Math.sin(s * 9))
    // the nose wiggles in little bursts
    const sniff = t % 2.7 < 0.7 ? Math.sin(t * 38) : 0
    nose.current.position.y = sniff * 0.006
    nose.current.scale.set(1 + sniff * 0.08, 1 - sniff * 0.06, 1)
    // ears: a gentle sway, a lazy flop now and then, a happy flap after a tap
    const flap = happy * Math.sin(s * 14)
    ears.current.forEach((e, i) => {
      if (!e) return
      const x = i ? 1 : -1
      const ph = (t * 0.21 + i * 0.5) % 1
      const flop = ph < 0.2 ? Math.sin((ph / 0.2) * Math.PI) ** 2 : 0
      e.rotation.z = -x * (0.13 + flop * 0.55 + air * 0.38 + flap * 0.3 + Math.sin(t * 1.1 + i) * 0.03)
      e.rotation.x = -0.12 - flop * 0.2 + air * 0.25 + Math.sin(t * 0.9 + i * 2) * 0.03
    })
    // a blink now and then (kept clear of the first few seconds)
    const lid = t % 4.3 < 0.13 ? 0.12 : 1
    eyes.current.forEach((e) => e && (e.scale.y = lid))
    // the arms lift with the hop
    arms.current.forEach((a, i) => a && (a.rotation.z = (i ? 1 : -1) * (0.25 + air * 0.5 + happy * 0.15 * Math.sin(s * 10))))
    // the cotton tail twitches
    tail.current.rotation.y = t % 3.3 < 0.5 ? Math.sin(t * 30) * 0.25 : 0
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
          {/* body, with a paler belly drawn in its own scale so it hugs it */}
          <group ref={chest} position-y={BODY.y} scale={BODY.scale}>
            <mesh geometry={body} castShadow receiveShadow>
              <meshStandardMaterial vertexColors roughness={0.64} metalness={0} />
            </mesh>
          </group>

          {/* haunches, sunk into the body's sides */}
          {[-1, 1].map((x) => (
            <Clay key={x} geometry={geo.ball} color={K.fur} position={[x * 0.27, 0.24, 0.02]} scale={[0.2, 0.21, 0.27]} />
          ))}

          {/* big feet, toes tipped up so the pink soles face the front */}
          {[-1, 1].map((x) => (
            <group key={x} position={[x * 0.22, 0.19, 0.32]} rotation={[-1.0, x * 0.18, 0]}>
              <group scale={FOOT}>
                <Clay geometry={geo.ball} color={K.fur} />
                <Clay geometry={geo.pad} color={K.pad} quaternion={SOLE} />
                {BEANS.map((q, i) => (
                  <Clay key={i} geometry={geo.bean} color={K.pad} quaternion={q} />
                ))}
              </group>
            </group>
          ))}

          {/* stubby arms on the front of the body */}
          {[-1, 1].map((x, i) => (
            <group key={x} ref={(el) => (arms.current[i] = el)} position={[x * 0.27, 0.66, 0.2]} rotation-z={x * 0.25}>
              <Clay geometry={geo.ball} color={K.fur} position={[0, -0.11, 0.04]} rotation-x={-0.35} scale={[0.09, 0.15, 0.095]} />
            </group>
          ))}

          {/* cotton tail: a cluster of soft balls */}
          <group ref={tail} position={[0, 0.26, -0.37]}>
            <Clay geometry={geo.ball} color={K.tail} position-z={-0.03} scale={0.11} roughness={0.85} />
            {[
              [0.06, 0.05, -0.06],
              [-0.06, 0.04, -0.07],
              [0.05, -0.05, -0.07],
              [-0.05, -0.05, -0.06],
              [0, 0, -0.11],
            ].map((p, i) => (
              <Clay key={i} geometry={geo.ball} color={K.tail} position={p} scale={0.07} roughness={0.85} />
            ))}
          </group>

          {/* bow tie at the neck */}
          <group position={[0, 0.835, 0.335]} rotation-x={-0.3}>
            {[-1, 1].map((x) => (
              <Clay key={x} geometry={geo.ball} color={K.bow} position-x={x * 0.08} rotation-z={x * 0.12} scale={[0.085, 0.062, 0.04]} roughness={0.5} />
            ))}
            <Clay geometry={geo.ball} color={K.knot} position-z={0.016} scale={[0.036, 0.04, 0.034]} roughness={0.5} />
          </group>

          {/* head: skull, muzzle, nose, eyes, cheeks and ears */}
          <group ref={head} position={NECK}>
            <group position={HEAD.pos} scale={1.08}>
              <group scale={HEAD.scale}>
                <Clay geometry={geo.ball} color={K.fur} />
                {BLUSH.map((q, i) => (
                  <mesh key={i} geometry={geo.blush} quaternion={q}>
                    <meshStandardMaterial color={K.cheek} roughness={0.8} />
                  </mesh>
                ))}
              </group>
              {/* puffy muzzle and a little mouth */}
              {[-1, 1].map((x) => (
                <Clay key={x} geometry={geo.ball} color={K.belly} position={[x * 0.058, -0.13, 0.33]} scale={[0.078, 0.07, 0.07]} />
              ))}
              <mesh geometry={geo.mouth} position={[0, -0.16, 0.4]} rotation-x={-0.3}>
                <meshStandardMaterial color={K.eye} roughness={0.5} />
              </mesh>
              <group ref={nose} position={[0, -0.075, 0.398]}>
                <Clay geometry={geo.ball} color={K.nose} rotation-x={-0.3} scale={[0.048, 0.034, 0.03]} roughness={0.45} />
              </group>
              {/* bead eyes with a glint */}
              {[-1, 1].map((x, i) => (
                <group key={x} ref={(el) => (eyes.current[i] = el)} position={[x * 0.165, 0.04, 0.33]}>
                  <mesh geometry={geo.ball} scale={0.058}>
                    <meshStandardMaterial color={K.eye} roughness={0.12} />
                  </mesh>
                  <mesh geometry={geo.ball} position={[x * -0.016, 0.02, 0.05]} scale={0.014}>
                    <meshStandardMaterial color="#ffffff" roughness={0.2} />
                  </mesh>
                </group>
              ))}
              {/* tall ears, rooted inside the skull */}
              {[-1, 1].map((x, i) => (
                <group key={x} ref={(el) => (ears.current[i] = el)} position={[x * 0.16, 0.28, -0.04]} rotation={[-0.12, 0, -x * 0.13]}>
                  <group position-y={EAR[1] * 0.95} rotation-y={x * 0.25} scale={EAR}>
                    <Clay geometry={geo.ball} color={K.fur} />
                    <Clay geometry={geo.lining} color={K.inner} quaternion={LINING} />
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

// The bunny springs in from nothing, overshoots a touch and settles.
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

export default function BunnyScene({ background = '#f6f4ef', autoRotate = true, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [3.94, 2.16, 3.95], fov: 30, near: 0.05, far: 60 }} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1 }}>
        <color attach="background" args={[background]} />
        <hemisphereLight args={['#ffffff', '#ddd8e6', 1.35]} />
        <directionalLight position={[3, 6, 5]} intensity={1.8} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.03} shadow-radius={5}>
          <orthographicCamera attach="shadow-camera" args={[-2, 2, 3, -0.6, 0.5, 16]} />
        </directionalLight>
        <directionalLight position={[-5, 3, -4]} intensity={0.9} color="#e8e6ff" />
        <PopIn>
          <Bunny {...props} />
        </PopIn>
        <ContactShadows position={[0, 0, 0]} opacity={0.42} scale={6} blur={2.4} far={2.4} resolution={512} color="#2e2838" />
        <OrbitControls makeDefault enablePan={false} target={[0, 1.1, 0.1]} autoRotate={autoRotate} autoRotateSpeed={0.7} minDistance={3} maxDistance={14} maxPolarAngle={1.5} />
      </Canvas>
      <InfoHint>It breathes, wiggles its nose, blinks and flops its ears on its own · tap it and it hops in place with a happy ear flap · Kind swaps white, grey, brown and pink · drag to orbit</InfoHint>
    </div>
  )
}

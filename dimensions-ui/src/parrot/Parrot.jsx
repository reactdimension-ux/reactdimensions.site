import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls, useCursor } from '@react-three/drei'
import * as THREE from 'three'

// A clay-toy parrot: a round red head and body, an orange hooked beak, bead
// eyes on cream face patches, layered wing and tail feathers in bands of
// colour, and yellow feet wrapped round a wooden perch on two posts. It bobs,
// tilts its head, blinks and ruffles its wings. Tap it and it squawks: the
// beak opens and the wings flap wide. It faces +z and stands on y = 0.

const TAU = Math.PI * 2

// wing / tail bands run from the shoulder out: body colour, band, mid, tips
const KINDS = {
  scarlet: { body: '#e8392f', face: '#fbf1e4', beak: '#ff9b30', jaw: '#e5752a', band: '#ffd03a', mid: '#47b35a', tips: '#2f7de0', feet: '#ffc83a', eye: '#221a1c', mouth: '#5a2a2e' },
  blue: { body: '#3b8ee8', face: '#fbf3e2', beak: '#ff9b30', jaw: '#e5752a', band: '#ffd23f', mid: '#2fb3c4', tips: '#2459c4', feet: '#ffc83a', eye: '#1c1a24', mouth: '#4a2a34' },
  green: { body: '#5ec25a', face: '#fbf3e2', beak: '#ff9b30', jaw: '#e5752a', band: '#ff5a48', mid: '#2e9e66', tips: '#2f7de0', feet: '#ffc83a', eye: '#1c2420', mouth: '#4a2a2e' },
  sunset: { body: '#ff9f2e', face: '#fff2dc', beak: '#ff6a3d', jaw: '#d9502e', band: '#ffd84a', mid: '#4fbf5a', tips: '#2f7de0', feet: '#ffc83a', eye: '#241a1a', mouth: '#5a2a2e' },
}

const WOOD = { perch: '#b98252', post: '#a26f43', foot: '#8f603a' }

// The perch runs along x; the bird's feet wrap round it.
const PERCH = { y: 0.5, z: 0.05, r: 0.058, half: 0.56 }
const LIFT = 0.08 // the bird stands this far above its usual height, so its legs show
const BODY = { pos: [0, 1.06, -0.02], scale: [0.36, 0.44, 0.36], tilt: 0.18 }
const NECK = [0, 1.38, 0.04] // the head turns about this point, inside the body
const TOE_R = 0.03
const TOE_ARC = PERCH.r + TOE_R * 0.75 // toes sink a touch into the wood

// A clay tube along a curve in the y-z plane, its radius set by radius(u),
// closed at the far end. path(u) returns [y, z].
function tubeGeometry(path, radius, { rings = 28, sides = 28, sx = 1 } = {}) {
  const pos = []
  const idx = []
  for (let i = 0; i <= rings; i++) {
    const u = i / rings
    const [y, z] = path(u)
    const [y1, z1] = path(Math.min(1, u + 0.002))
    const [y0, z0] = path(Math.max(0, u - 0.002))
    const l = Math.hypot(y1 - y0, z1 - z0)
    const ty = (y1 - y0) / l
    const tz = (z1 - z0) / l
    const r = radius(u)
    for (let j = 0; j < sides; j++) {
      const a = (j / sides) * TAU
      pos.push(Math.cos(a) * r * sx, y - Math.sin(a) * r * tz, z + Math.sin(a) * r * ty)
    }
    if (i === rings) pos.push(0, y + ty * r * 0.9, z + tz * r * 0.9)
  }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < sides; j++) {
      const a = i * sides + j
      const b = i * sides + ((j + 1) % sides)
      idx.push(a, a + sides, b, b, a + sides, b + sides)
    }
  const last = rings * sides
  const tip = last + sides
  for (let j = 0; j < sides; j++) idx.push(last + j, tip, last + ((j + 1) % sides))
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

const bez = (a, b, c, u) => (1 - u) * (1 - u) * a + 2 * (1 - u) * u * b + u * u * c

// a toe: an arc round the perch from its top (angle 0) to angle `to`
const toeGeometry = (to) =>
  tubeGeometry(
    (u) => [TOE_ARC * Math.cos(to * u), TOE_ARC * Math.sin(to * u)],
    (u) => TOE_R * (1 - 0.18 * u),
    { rings: 20, sides: 18 },
  )

function useParrotGeometry() {
  const geo = useMemo(
    () => ({
      ball: new THREE.SphereGeometry(1, 48, 32),
      // the upper beak: thick where it leaves the face, hooking down to a point
      beak: tubeGeometry(
        (u) => [bez(0, 0.075, -0.17, u), bez(0, 0.2, 0.25, u)],
        (u) => 0.01 + 0.112 * (1 - u) ** 0.85,
        { rings: 32, sides: 32, sx: 0.82 },
      ),
      toeFront: toeGeometry(1.95),
      toeBack: toeGeometry(-1.75),
      perch: new THREE.CapsuleGeometry(PERCH.r, PERCH.half * 2, 8, 24).rotateZ(Math.PI / 2),
      post: new THREE.CylinderGeometry(0.05, 0.066, PERCH.y, 24).translate(0, PERCH.y / 2, 0),
      leg: new THREE.CapsuleGeometry(0.036, 0.16, 8, 16),
    }),
    [],
  )
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])
  return geo
}

// One piece of clay: a soft, matt material that casts and takes shadow.
function Clay({ color, roughness = 0.64, children, ...props }) {
  return (
    <mesh castShadow receiveShadow {...props}>
      <meshStandardMaterial color={color} roughness={roughness} metalness={0} />
      {children}
    </mesh>
  )
}

// A feather: a flattened lozenge of clay hanging down from the group's origin.
function Feather({ geo, color, len, wide, thick, ...props }) {
  return (
    <group {...props}>
      <Clay geometry={geo.ball} color={color} position-y={-len * 0.82} scale={[thick, len, wide]} />
    </group>
  )
}

// A wing: four layers, the shortest on the outside, the long flight feathers
// underneath. `side` is +1 for the bird's left (+x) and -1 for its right.
function Wing({ geo, K, side }) {
  const layers = [
    [K.tips, 0.38, 0.13, -0.2, 0],
    [K.mid, 0.28, 0.145, -0.13, 0.018],
    [K.band, 0.2, 0.155, -0.07, 0.036],
    [K.body, 0.15, 0.165, 0, 0.052],
  ]
  return layers.map(([c, len, wide, y, x]) => <Feather key={c + len} geo={geo} color={c} len={len} wide={wide} thick={0.065} position={[x * side, y, 0]} />)
}

export function Parrot({ kind = 'scarlet' }) {
  const K = KINDS[kind] || KINDS.scarlet
  const geo = useParrotGeometry()
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const tapAt = useRef(-99)
  const now = useRef(0)
  const bob = useRef()
  const chest = useRef()
  const head = useRef()
  const jaw = useRef()
  const eyes = useRef([])
  const wings = useRef([])
  const tail = useRef()

  useFrame(({ clock }) => {
    const t = (now.current = clock.elapsedTime)
    const s = t - tapAt.current
    // the squawk: the beak snaps open, the head throws back, the wings flap
    let sq = 0
    if (s >= 0 && s < 1.4) sq = Math.min(1, s / 0.12) * (s < 1 ? 1 : 1 - (s - 1) / 0.4)
    const flap = sq * (1.75 + Math.sin(s * 19) * 0.45)
    const cry = sq * (0.75 + Math.sin(s * 26) * 0.2)
    // bobbing on the perch: a little dip and lean, faster when it bobs its head
    const beat = Math.sin(t * 2.4)
    const dance = Math.max(0, Math.sin(t * 0.55)) ** 3
    bob.current.position.y = PERCH.y + beat * 0.012 - dance * Math.abs(Math.sin(t * 7)) * 0.035 + sq * 0.02
    bob.current.rotation.x = 0.03 * Math.sin(t * 2.4 + 0.5) + dance * Math.abs(Math.sin(t * 7)) * 0.08 - sq * 0.1
    const b = 1 + Math.sin(t * 1.8) * 0.014
    chest.current.scale.set(BODY.scale[0] * b, BODY.scale[1] * (2 - b), BODY.scale[2] * b)
    // the head tilts, curious, and looks about; it throws back to squawk
    head.current.rotation.set(
      0.05 * Math.sin(t * 1.3) - cry * 0.12,
      0.32 * Math.sin(t * 0.42) + 0.1 * Math.sin(t * 1.1),
      0.26 * Math.sin(t * 0.7) ** 3 + 0.04 * Math.sin(t * 2.2),
    )
    jaw.current.rotation.x = 0.04 + cry * 0.95
    // a blink now and then
    const lid = (t + 2) % 3.7 < 0.13 ? 0.12 : 1
    eyes.current.forEach((e) => e && (e.scale.y = 0.046 * lid))
    // a ruffle every few seconds: the wings shiver and lift a little
    const rp = t % 4.6
    const ruffle = rp > 3.4 && rp < 4.1 ? Math.sin(((rp - 3.4) / 0.7) * Math.PI) : 0
    wings.current.forEach((w, i) => {
      if (!w) return
      const side = i ? -1 : 1
      const open = -0.1 + ruffle * (0.14 + Math.sin(t * 40) * 0.07) + flap
      w.rotation.set(0.72 - sq * 0.55, side * sq * 0.35, side * open)
    })
    tail.current.rotation.set(0.8 + sq * 0.2 * Math.sin(s * 19), 0, Math.sin(t * 1.3) * 0.06 + ruffle * Math.sin(t * 30) * 0.05)
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
      rotation-y={-0.05}
    >
      {/* the perch: a wooden T-stand, a dowel on one post with a round foot */}
      <Clay geometry={geo.perch} color={WOOD.perch} position={[0, PERCH.y, PERCH.z]} roughness={0.72} />
      <group position={[0, 0, PERCH.z]}>
        <Clay geometry={geo.post} color={WOOD.post} roughness={0.72} />
        <Clay geometry={geo.ball} color={WOOD.post} position-y={PERCH.y - 0.01} scale={[0.075, 0.06, 0.075]} roughness={0.72} />
        <Clay geometry={geo.ball} color={WOOD.foot} scale={[0.36, 0.075, 0.36]} roughness={0.72} />
      </group>

      {/* legs and feet: two toes over the front of the perch, two round the back */}
      {[-1, 1].map((x) => (
        <group key={x} position={[x * 0.12, PERCH.y, PERCH.z]}>
          <Clay geometry={geo.leg} color={K.feet} position-y={0.17} />
          {[-1, 1].map((d) => (
            <group key={d} position-x={d * 0.026}>
              <Clay geometry={geo.toeFront} color={K.feet} />
              <Clay geometry={geo.ball} color={K.feet} position={[0, TOE_ARC * Math.cos(1.95), TOE_ARC * Math.sin(1.95)]} scale={TOE_R * 0.86} />
            </group>
          ))}
          {[-1, 1].map((d) => (
            <group key={d} position-x={d * 0.03}>
              <Clay geometry={geo.toeBack} color={K.feet} />
              <Clay geometry={geo.ball} color={K.feet} position={[0, TOE_ARC * Math.cos(-1.75), TOE_ARC * Math.sin(-1.75)]} scale={TOE_R * 0.86} />
            </group>
          ))}
        </group>
      ))}

      <group ref={bob} position={[0, PERCH.y, PERCH.z]}>
        <group position={[0, LIFT - PERCH.y, -PERCH.z]}>
          {/* body, with soft feathered thighs that blend down into the legs */}
          <group position={BODY.pos} rotation-x={BODY.tilt}>
            <group ref={chest} scale={BODY.scale}>
              <Clay geometry={geo.ball} color={K.body} />
            </group>
          </group>
          {/* a soft neck that fills the crease between head and chest */}
          <Clay geometry={geo.ball} color={K.body} position={[0, 1.34, 0.06]} scale={[0.27, 0.19, 0.27]} />
          {[-1, 1].map((x) => (
            <Clay key={x} geometry={geo.ball} color={K.body} position={[x * 0.12, 0.69, 0.05]} scale={[0.09, 0.11, 0.1]} />
          ))}

          {/* tail: long feathers fanning down behind the perch */}
          <group ref={tail} position={[0, 0.78, -0.2]}>
            <Feather geo={geo} color={K.tips} len={0.4} wide={0.08} thick={0.03} position-z={-0.03} />
            {[-1, 1].map((x) => (
              <Feather key={x} geo={geo} color={K.mid} len={0.32} wide={0.07} thick={0.03} position-z={-0.015} rotation-z={x * 0.2} />
            ))}
            {[-1, 1].map((x) => (
              <Feather key={x} geo={geo} color={K.band} len={0.2} wide={0.075} thick={0.034} rotation-z={x * 0.1} />
            ))}
          </group>

          {/* wings */}
          {[1, -1].map((side, i) => (
            <group key={side} ref={(el) => (wings.current[i] = el)} position={[side * 0.29, 1.27, -0.03]}>
              <Wing geo={geo} K={K} side={side} />
            </group>
          ))}

          {/* head: skull, face patches, bead eyes and the hooked beak */}
          <group ref={head} position={NECK}>
            <Clay geometry={geo.ball} color={K.body} position={[0, 0.12, 0.08]} scale={0.3} />
            {[-1, 1].map((x, i) => (
              <group key={x} position={[x * 0.26, 0.167, 0.222]} rotation-y={x * 1.07}>
                <Clay geometry={geo.ball} color={K.face} position-z={-0.012} scale={[0.115, 0.1, 0.035]} roughness={0.7} />
                <mesh ref={(el) => (eyes.current[i] = el)} geometry={geo.ball} position-z={0.018} scale={0.046}>
                  <meshStandardMaterial color={K.eye} roughness={0.12} />
                </mesh>
                <mesh geometry={geo.ball} position={[0.014, 0.018, 0.058]} scale={0.012}>
                  <meshStandardMaterial color="#ffffff" roughness={0.2} />
                </mesh>
              </group>
            ))}
            <group position={[0, 0.08, 0.3]}>
              <Clay geometry={geo.beak} color={K.beak} roughness={0.45} />
              <mesh geometry={geo.ball} position={[0, -0.05, 0.06]} scale={[0.05, 0.04, 0.07]}>
                <meshStandardMaterial color={K.mouth} roughness={0.6} />
              </mesh>
              <group ref={jaw} position={[0, -0.05, 0.02]}>
                <Clay geometry={geo.ball} color={K.jaw} position={[0, -0.01, 0.07]} scale={[0.07, 0.05, 0.1]} roughness={0.5} />
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}

// The parrot springs in from nothing, overshoots a touch and settles.
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

export default function ParrotScene({ background = '#f6f4ef', autoRotate = true, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [3.6, 1.8, 3.55], fov: 30, near: 0.05, far: 60 }} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1 }}>
        <color attach="background" args={[background]} />
        <hemisphereLight args={['#ffffff', '#e8e4ee', 1.6]} />
        <directionalLight position={[3, 6, 5]} intensity={1.9} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.03} shadow-radius={5}>
          <orthographicCamera attach="shadow-camera" args={[-2.2, 2.2, 2.4, -0.6, 0.5, 16]} />
        </directionalLight>
        <directionalLight position={[-5, 3, -4]} intensity={0.9} color="#fff0e0" />
        <PopIn>
          <Parrot {...props} />
        </PopIn>
        <ContactShadows position={[0, 0, 0]} opacity={0.34} scale={6} blur={2.6} far={2.4} resolution={512} color="#3a2a28" />
        <OrbitControls makeDefault enablePan={false} target={[0, 0.98, 0]} autoRotate={autoRotate} autoRotateSpeed={0.7} minDistance={3} maxDistance={14} maxPolarAngle={1.5} />
      </Canvas>
      <InfoHint>It bobs on its perch, tilts its head, blinks and ruffles its wings on its own · tap it and it squawks, opening its beak and flapping its wings wide · Kind swaps scarlet, blue, green and sunset · drag to orbit</InfoHint>
    </div>
  )
}

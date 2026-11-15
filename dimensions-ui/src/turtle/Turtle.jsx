import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls, useCursor } from '@react-three/drei'
import * as THREE from 'three'

// A clay-toy turtle: a domed shell covered in raised, rounded plates with a
// thick lip of a rim, a pale belly plate underneath, a round head on a bent
// neck with glossy bead eyes, blushing cheeks and a little smile, four stubby
// legs and a tiny pointed tail. It breathes, bobs its head, blinks and
// paddles its legs. Tap it and it ducks everything into its shell, waits a
// beat, then pops back out.
// It faces +z and stands on y = 0.

const D = Math.PI / 180

const KINDS = {
  green: { skin: '#8fcf7a', shell: '#6e4528', plate: '#a8703e', rim: '#8a5832', belly: '#f3e4b4', cheek: '#f49a9a', eye: '#1d1a17' },
  teal: { skin: '#74ccbf', shell: '#87512a', plate: '#d08b46', rim: '#a86a36', belly: '#f4ecd2', cheek: '#f59aa6', eye: '#18222a' },
  olive: { skin: '#aab25e', shell: '#4f3522', plate: '#7a5434', rim: '#664429', belly: '#efe2bd', cheek: '#ec9a86', eye: '#1e1c14' },
  pink: { skin: '#f3a9ba', shell: '#7c5ea3', plate: '#ad8fd4', rim: '#9175bd', belly: '#fde8ec', cheek: '#ee7e98', eye: '#2a1d2c' },
}

const SHELL_Y = 0.36 // the shell's base, where the rim sits
const SHELL = [0.62, 0.5, 0.74] // the dome's half sizes
const BELLY = { pos: [0, 0.3, 0], scale: [0.55, 0.12, 0.67] }
const NECK = [0, 0.24, 0.42] // the neck's root, hidden inside the belly
const HEAD = [0.24, 0.22, 0.23] // half sizes of the head ball
const HC = [0, 0.34, 0.66] // the head's centre, inside the neck group

// A direction on the unit sphere: az round the y axis (0 is +x, 90 is +z,
// the front), el up from the equator, both in degrees.
const dirOf = (az, el) => new THREE.Vector3(Math.cos(el * D) * Math.cos(az * D), Math.sin(el * D), Math.cos(el * D) * Math.sin(az * D))

// A raised clay plate on a unit sphere: a rounded hexagon centred on a
// direction, its edge sunk just under the surface and its middle domed proud.
// Drawn inside the dome's scale, so it hugs the shell exactly.
function plateGeometry([az, el, radius, height = 0.075, turn = 0], rings = 9, seg = 48) {
  const c = dirOf(az, el)
  const e1 = Math.abs(c.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), c).normalize()
  const e2 = new THREE.Vector3().crossVectors(c, e1).normalize()
  const pos = [c.x * (0.99 + height), c.y * (0.99 + height), c.z * (0.99 + height)]
  const p = new THREE.Vector3()
  for (let i = 1; i <= rings; i++) {
    const u = i / rings
    for (let k = 0; k < seg; k++) {
      const f = (k / seg) * Math.PI * 2
      const r = radius * D * u * (1 - 0.03 * Math.cos(6 * (f + turn * D)))
      p.copy(c)
        .multiplyScalar(Math.cos(r))
        .addScaledVector(e1, Math.cos(f) * Math.sin(r))
        .addScaledVector(e2, Math.sin(f) * Math.sin(r))
        .normalize()
        .multiplyScalar(0.99 + height * Math.sqrt(Math.max(0, 1 - u ** 4)))
      pos.push(p.x, p.y, p.z)
    }
  }
  const idx = []
  for (let k = 0; k < seg; k++) idx.push(0, 1 + k, 1 + ((k + 1) % seg))
  for (let i = 0; i < rings - 1; i++)
    for (let k = 0; k < seg; k++) {
      const a = 1 + i * seg + k
      const b = 1 + i * seg + ((k + 1) % seg)
      const cc = a + seg
      const d = b + seg
      idx.push(a, cc, b, b, cc, d)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// one plate on the crown, a ring of six round it, a ring of twelve lower down
const PLATES = [
  [0, 90, 21.5, 0.07],
  ...[0, 1, 2, 3, 4, 5].map((i) => [30 + i * 60, 52.5, 17.8, 0.07, -(30 + i * 60)]),
  ...Array.from({ length: 12 }, (_, i) => [i * 30, 21.5, 13.2, 0.065, -i * 30]),
]

// the rim: a soft tube running round the shell's base
const RIM_CURVE = new THREE.CatmullRomCurve3(
  Array.from({ length: 72 }, (_, i) => {
    const a = (i / 72) * Math.PI * 2
    return new THREE.Vector3(Math.cos(a) * (SHELL[0] + 0.012), 0, Math.sin(a) * (SHELL[2] + 0.012))
  }),
  true,
)

// the neck: forward from inside the belly, under the rim, then up
const NECK_CURVE = new THREE.CatmullRomCurve3(
  [
    [0, 0, 0],
    [0, 0.0, 0.26],
    [0, 0.05, 0.44],
    [0, 0.17, 0.56],
    [0, 0.3, 0.62],
  ].map((p) => new THREE.Vector3(...p)),
)

// a point on the head's surface, for placing the face
const onHead = (x, y, inset = 0) => [HC[0] + x, HC[1] + y, HC[2] + HEAD[2] * Math.sqrt(Math.max(0, 1 - (x / HEAD[0]) ** 2 - (y / HEAD[1]) ** 2)) - inset]

// legs: root inside the belly, pointing out and down
const LEGS = [
  { root: [-0.33, 0.32, 0.36], dir: [-0.55, -0.6, 0.38], ph: 0 },
  { root: [0.33, 0.32, 0.36], dir: [0.55, -0.6, 0.38], ph: Math.PI },
  { root: [-0.33, 0.32, -0.36], dir: [-0.52, -0.6, -0.32], ph: Math.PI },
  { root: [0.33, 0.32, -0.36], dir: [0.52, -0.6, -0.32], ph: 0 },
].map((l) => ({ ...l, q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(...l.dir).normalize()) }))
const LEG_LEN = 0.32

function useTurtleGeometry() {
  const geo = useMemo(
    () => ({
      ball: new THREE.SphereGeometry(1, 64, 44),
      dome: new THREE.SphereGeometry(1, 72, 36, 0, Math.PI * 2, 0, Math.PI / 2),
      rim: new THREE.TubeGeometry(RIM_CURVE, 144, 0.066, 18, true),
      neck: new THREE.TubeGeometry(NECK_CURVE, 40, 0.088, 20, false),
      // a stubby leg, its top at the root and its rounded end towards the ground
      leg: new THREE.CapsuleGeometry(0.098, LEG_LEN - 0.098, 10, 24).translate(0, -(LEG_LEN - 0.098) / 2 - 0.049, 0),
      smile: new THREE.TorusGeometry(0.046, 0.011, 10, 28, Math.PI),
      plates: PLATES.map((p) => plateGeometry(p)),
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
function Clay({ color, roughness = 0.64, ...props }) {
  return (
    <mesh castShadow receiveShadow {...props}>
      <meshStandardMaterial color={color} roughness={roughness} metalness={0} />
    </mesh>
  )
}

const easeOutBack = (x) => 1 + 2.4 * (x - 1) ** 3 + 1.4 * (x - 1) ** 2

export function Turtle({ kind = 'green' }) {
  const K = KINDS[kind] || KINDS.green
  const geo = useTurtleGeometry()
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const tapAt = useRef(-99)
  const now = useRef(0)
  const squish = useRef()
  const shell = useRef()
  const neck = useRef()
  const head = useRef()
  const eyes = useRef([])
  const legs = useRef([])
  const tail = useRef()

  useFrame(({ clock }) => {
    const t = (now.current = clock.elapsedTime)
    const s = t - tapAt.current
    // the duck: everything whips in, a beat inside, then pops back out
    let r = 0 // 0 out .. 1 tucked in
    let k = 0 // squash (+) / stretch (-)
    if (s >= 0 && s < 0.16) r = Math.sin((s / 0.16) * Math.PI * 0.5)
    else if (s >= 0.16 && s < 1.0) r = 1
    else if (s >= 1.0 && s < 1.45) r = 1 - easeOutBack((s - 1.0) / 0.45)
    if (s >= 0 && s < 0.6) k = 0.07 * Math.exp(-7 * s) * Math.cos(s * 22)
    else if (s >= 1.0 && s < 1.9) k = -0.045 * Math.exp(-6 * (s - 1.0)) * Math.cos((s - 1.0) * 16)
    const rin = Math.max(0, Math.min(1, r)) // clamped, for things that must not overshoot inward
    squish.current.scale.set(1 + k * 0.5, 1 - k, 1 + k * 0.5)
    // a slow breath lifts the shell a touch
    const b = Math.sin(t * 1.5)
    shell.current.scale.set(1 + b * 0.008, 1 + b * 0.016, 1 + b * 0.008)
    // neck and head: bob, look about, and tuck right into the shell
    neck.current.position.set(NECK[0], NECK[1] - 0.06 * rin, NECK[2] - 0.6 * r)
    neck.current.scale.setScalar(1 - 0.45 * rin)
    neck.current.rotation.x = 0.06 * Math.sin(t * 1.5 + 0.4) + 0.14 * rin
    head.current.rotation.set(0.07 * Math.sin(t * 2.1) + 0.04 * Math.sin(t * 0.53), 0.26 * Math.sin(t * 0.41) + 0.08 * Math.sin(t * 0.97), 0.05 * Math.sin(t * 0.63))
    // the legs paddle in diagonal pairs and fold in when it ducks
    legs.current.forEach((l, i) => {
      if (!l) return
      const L = LEGS[i]
      const p = Math.sin(t * 2.3 + L.ph)
      l.rotation.set(p * 0.22, 0, p * 0.08 * Math.sign(L.root[0]))
      l.position.set(L.root[0] * (1 - 0.35 * rin), L.root[1] + 0.02 * rin, L.root[2] * (1 - 0.25 * rin))
      l.scale.setScalar(Math.max(0.001, 1 - 0.88 * r))
    })
    // a little wag of the tail, which tucks in too
    tail.current.rotation.y = Math.sin(t * 3.1) * 0.35
    tail.current.position.z = -0.6 + 0.22 * rin
    tail.current.scale.setScalar(Math.max(0.001, 1 - 0.8 * r))
    // a blink now and then (phased so the first one lands after the pop-in)
    const lid = (t + 0.4) % 4.3 < 0.13 ? 0.12 : 1
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
      <group ref={squish}>
        {/* legs, each with a flattened round foot */}
        {LEGS.map((L, i) => (
          <group key={i} ref={(el) => (legs.current[i] = el)} position={L.root}>
            <group quaternion={L.q}>
              <Clay geometry={geo.leg} color={K.skin} />
              <Clay geometry={geo.ball} color={K.skin} position={[0, -LEG_LEN + 0.03, 0]} scale={[0.118, 0.075, 0.13]} />
            </group>
          </group>
        ))}

        {/* tail */}
        <group ref={tail} position={[0, 0.28, -0.6]} rotation-x={0.28}>
          <Clay geometry={geo.ball} color={K.skin} position={[0, 0, -0.1]} scale={[0.06, 0.05, 0.15]} />
        </group>

        {/* belly plate */}
        <Clay geometry={geo.ball} color={K.belly} position={BELLY.pos} scale={BELLY.scale} />

        {/* shell: the dome with its plates drawn in the same scale, and the rim */}
        <group ref={shell} position-y={SHELL_Y}>
          <group scale={SHELL}>
            <mesh castShadow receiveShadow geometry={geo.dome}>
              <meshStandardMaterial color={K.shell} roughness={0.7} metalness={0} side={THREE.DoubleSide} />
            </mesh>
            {geo.plates.map((g, i) => (
              <Clay key={i} geometry={g} color={K.plate} roughness={0.58} />
            ))}
          </group>
          <Clay geometry={geo.rim} color={K.rim} roughness={0.6} scale={[1, 0.72, 1]} />
        </group>

        {/* neck and head: ball, eyes with a shine, cheeks, nostrils and a smile */}
        <group ref={neck} position={NECK}>
          <Clay geometry={geo.neck} color={K.skin} />
          <group ref={head} position={[0, 0.3, 0.62]}>
            <group position={[0, -0.3, -0.62]}>
              <Clay geometry={geo.ball} color={K.skin} position={HC} scale={HEAD} />
              {[-1, 1].map((x, i) => (
                <group key={x} ref={(el) => (eyes.current[i] = el)} position={onHead(x * 0.1, 0.05, 0.016)}>
                  <mesh geometry={geo.ball} scale={0.046}>
                    <meshStandardMaterial color={K.eye} roughness={0.1} />
                  </mesh>
                  <mesh geometry={geo.ball} position={[0.014, 0.018, 0.036]} scale={0.013}>
                    <meshStandardMaterial color="#ffffff" roughness={0.2} />
                  </mesh>
                </group>
              ))}
              {[-1, 1].map((x) => (
                <Clay key={x} geometry={geo.ball} color={K.cheek} roughness={0.75} position={onHead(x * 0.152, -0.045, 0.008)} rotation-y={x * 0.68} scale={[0.05, 0.032, 0.02]} />
              ))}
              {[-1, 1].map((x) => (
                <mesh key={x} geometry={geo.ball} position={onHead(x * 0.03, 0.0, 0.002)} scale={[0.009, 0.007, 0.006]}>
                  <meshStandardMaterial color={K.eye} roughness={0.6} />
                </mesh>
              ))}
              <mesh geometry={geo.smile} position={onHead(0, -0.045, 0.006)} rotation={[-0.25, 0, Math.PI]}>
                <meshStandardMaterial color="#4a2a24" roughness={0.6} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}

// The turtle springs in from nothing, overshoots a touch and settles.
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

export default function TurtleScene({ background = '#f6f4ef', autoRotate = true, kind = 'green', ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [2.65, 2.3, 2.85], fov: 30, near: 0.05, far: 60 }} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1 }}>
        <color attach="background" args={[background]} />
        <hemisphereLight args={['#ffffff', '#e8e6dc', 1.6]} />
        <directionalLight position={[3, 6, 5]} intensity={1.9} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.03} shadow-radius={5}>
          <orthographicCamera attach="shadow-camera" args={[-2, 2, 2, -0.6, 0.5, 16]} />
        </directionalLight>
        <directionalLight position={[-5, 3, -4]} intensity={0.9} color="#eef2ff" />
        <PopIn>
          <Turtle kind={kind} {...props} />
        </PopIn>
        <ContactShadows position={[0, 0, 0]} opacity={0.34} scale={8} blur={2.6} far={2} resolution={512} color="#2e3a24" />
        <OrbitControls makeDefault enablePan={false} target={[0, 0.42, 0.18]} autoRotate={autoRotate} autoRotateSpeed={0.7} minDistance={2.6} maxDistance={14} maxPolarAngle={1.5} />
      </Canvas>
      <InfoHint>It breathes, bobs its head, blinks and paddles its legs on its own · tap it and it ducks into its shell, waits a beat and pops back out · Kind swaps green, teal, olive and pink · drag to orbit</InfoHint>
    </div>
  )
}

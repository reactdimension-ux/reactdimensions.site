import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls, useCursor } from '@react-three/drei'
import * as THREE from 'three'

// A clay-toy zebra: an egg of a body on four straight legs with rounded hoof
// caps, a thick upright neck, a round head with a big ball muzzle, bead eyes,
// two little upright ears, a blocky two-tone mane running up the neck and over
// the brow, raised curved stripes stuck on the body and neck, and a short tail
// with a tuft. It breathes, nods, blinks, flicks its ears and swishes its
// tail. Tap it and it bucks: weight onto the front legs, hind end and back
// legs kick up and back, then it settles with a squash.
// It faces +z and stands on y = 0.

const TAU = Math.PI * 2

const KINDS = {
  classic: { body: '#f4f3ef', stripe: '#1c1c1e', muzzle: '#5a5a5e', mane: ['#1c1c1e', '#f4f3ef'], hoof: '#1c1c1e', tuft: '#1c1c1e', eye: '#111113' },
  pastel: { body: '#fbdde3', stripe: '#b9a3e3', muzzle: '#c7a9d9', mane: ['#a58fd6', '#fff3f5'], hoof: '#9b82cc', tuft: '#a58fd6', eye: '#3a2f4f' },
  candy: { body: '#bff0dc', stripe: '#ff4f9a', muzzle: '#ff86b8', mane: ['#ff4f9a', '#effcf6'], hoof: '#e23a85', tuft: '#ff4f9a', eye: '#2a1f2a' },
  midnight: { body: '#26315f', stripe: '#f4f3ef', muzzle: '#121834', mane: ['#f4f3ef', '#121834'], hoof: '#0f1430', tuft: '#f4f3ef', eye: '#f4f3ef' },
}

// ---- the neck: a thick tube along a curve in the y-z plane ----

const N0 = new THREE.Vector3(0, 0, 0)
const N1 = new THREE.Vector3(0, 0.3, 0.04)
const N2 = new THREE.Vector3(0, 0.6, 0.13)
const NECK_ROOT = [0, 0.97, 0.32] // set inside the body, so the neck grows out of it

const neckAt = (u, out = new THREE.Vector3()) => {
  const k = 1 - u
  return out.set(0, k * k * N0.y + 2 * k * u * N1.y + u * u * N2.y, k * k * N0.z + 2 * k * u * N1.z + u * u * N2.z)
}
const neckTan = (u, out = new THREE.Vector3()) =>
  out.set(0, 2 * (1 - u) * (N1.y - N0.y) + 2 * u * (N2.y - N1.y), 2 * (1 - u) * (N1.z - N0.z) + 2 * u * (N2.z - N1.z)).normalize()
// thick all the way, flaring where it meets the body
const neckR = (u) => 0.155 + 0.1 * (1 - u) ** 3

// A point on the neck's skin at u along it and angle a round it (0 is the
// right side, -pi/2 the front, +pi/2 the back), with the outward normal and tangent.
function neckSkin(u, a, lift = 0) {
  const P = neckAt(u)
  const T = neckTan(u)
  const n = new THREE.Vector3(Math.cos(a), Math.sin(a) * T.z, -Math.sin(a) * T.y)
  return { pos: P.addScaledVector(n, neckR(u) + lift), n, T }
}

function neckGeometry(rings = 30, sides = 40) {
  const pos = []
  const idx = []
  for (let i = 0; i <= rings; i++)
    for (let j = 0; j < sides; j++) {
      const p = neckSkin(i / rings, (j / sides) * TAU).pos
      pos.push(p.x, p.y, p.z)
    }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < sides; j++) {
      const a = i * sides + j
      const b = i * sides + ((j + 1) % sides)
      const c = a + sides
      const d = b + sides
      idx.push(a, b, c, b, d, c)
    }
  // close the top with a fan (it sits inside the head anyway)
  const top = pos.length / 3
  const P = neckAt(1)
  pos.push(P.x, P.y, P.z)
  for (let j = 0; j < sides; j++) idx.push(rings * sides + j, rings * sides + ((j + 1) % sides), top)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// ---- stripes ----

// Build a strip from a function that maps (s along, v across in -1..1, h
// height above the skin) to a point. The rim (|v| = 1) is sunk just under the
// skin and the middle stands proud, so it reads as a raised stuck-on stripe.
function stripGeometry(at, nu = 48, nv = 10) {
  const pos = []
  const idx = []
  for (let i = 0; i <= nu; i++)
    for (let j = 0; j <= nv; j++) {
      const s = i / nu
      const v = (j / nv) * 2 - 1
      const p = at(s, v, Math.sqrt(Math.max(0, 1 - v * v)))
      pos.push(p.x, p.y, p.z)
    }
  for (let i = 0; i < nu; i++)
    for (let j = 0; j < nv; j++) {
      const a = i * (nv + 1) + j
      const b = a + 1
      const c = a + nv + 1
      const d = c + 1
      idx.push(a, b, c, b, d, c)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// tapers to rounded points at both ends
const taper = (s) => Math.sin(Math.PI * s) ** 0.55

// A stripe on the unit sphere's right side (drawn inside the body's scale so
// it hugs the egg): phi is the angle round from the side towards the front,
// running from elevation e0 (top) down to e1, leaning and bowing as it goes.
function bodyStripe([phi, e0, e1, w, lean, bow]) {
  const d = new THREE.Vector3()
  return stripGeometry((s, v, h) => {
    const el = e0 + (e1 - e0) * s
    const f = phi + lean * (s - 0.5) + bow * Math.sin(Math.PI * s)
    const tw = taper(s)
    const p = f + (v * w * tw) / Math.max(0.3, Math.cos(el))
    d.set(Math.cos(el) * Math.cos(p), Math.sin(el), Math.cos(el) * Math.sin(p))
    return d.clone().multiplyScalar(0.986 + 0.075 * h * Math.min(1, tw * 1.6))
  })
}

// A stripe wrapped round the neck, from (u0, a0) to (u1, a1).
function neckStripe([u0, a0, u1, a1, w]) {
  return stripGeometry((s, v, h) => {
    const tw = taper(s)
    const u = u0 + (u1 - u0) * s + v * w * tw
    const a = a0 + (a1 - a0) * s
    return neckSkin(u, a, -0.004 + 0.022 * h * Math.min(1, tw * 1.6)).pos
  })
}

const BODY = { y: 0.93, scale: [0.42, 0.36, 0.62] }
// [phi, top elevation, bottom elevation, half-width, lean, bow]
const BODY_STRIPES = [
  [-1.02, 1.12, -0.05, 0.075, 0.28, 0.06],
  [-0.62, 1.32, -0.42, 0.085, 0.3, 0.08],
  [-0.12, 1.22, 0.38, 0.075, 0.22, 0.05],
  [-0.3, 0.2, -0.72, 0.075, 0.2, -0.06],
  [0.22, 1.2, -0.15, 0.08, 0.3, 0.07],
]
// [u0, a0, u1, a1, half-width in u]
const NECK_STRIPES = [[0.6, 1.25, 0.34, -0.55, 0.055]]

// mane blocks along the back of the neck: [u, height, width]
const NECK_MANE = [
  [0.08, 0.075, 0.1],
  [0.2, 0.085, 0.1],
  [0.32, 0.08, 0.1],
  [0.44, 0.09, 0.1],
  [0.56, 0.085, 0.1],
  [0.68, 0.09, 0.1],
  [0.8, 0.085, 0.1],
  [0.92, 0.09, 0.1],
]
// and over the top of the head to the brow: [angle from the back, height]
const HEAD_MANE = [
  [0.95, 0.09],
  [1.28, 0.1],
  [1.6, 0.095],
  [1.92, 0.08],
]

function useZebraGeometry() {
  const geo = useMemo(() => {
    const ball = new THREE.SphereGeometry(1, 48, 32)
    const hoof = new THREE.LatheGeometry(
      [
        [0.001, 0],
        [0.088, 0],
        [0.1, 0.016],
        [0.103, 0.06],
        [0.1, 0.13],
        [0.094, 0.15],
        [0.001, 0.152],
      ].map(([r, y]) => new THREE.Vector2(r, y)),
      32,
    ).scale(1.1, 1, 1.1)
    return {
      ball,
      hoof,
      neck: neckGeometry(),
      leg: new THREE.CylinderGeometry(0.093, 0.095, 0.87, 32, 1).translate(0, -0.345, 0), // top end tucked up at the body's centre height
      block: new THREE.BoxGeometry(1, 1, 1, 1, 1, 1),
      ear: new THREE.CapsuleGeometry(0.048, 0.07, 10, 24),
      tail: new THREE.CylinderGeometry(0.045, 0.034, 0.24, 20, 1).translate(0, -0.12, 0),
      tuft: new THREE.CapsuleGeometry(0.055, 0.11, 10, 20),
      stripes: BODY_STRIPES.map(bodyStripe),
      neckStripes: NECK_STRIPES.map(neckStripe),
    }
  }, [])
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
function Clay({ color, roughness = 0.62, children, ...props }) {
  return (
    <mesh castShadow receiveShadow {...props}>
      <meshStandardMaterial color={color} roughness={roughness} metalness={0} />
      {children}
    </mesh>
  )
}

const LEG_Y = 0.84
const FRONT_Z = 0.3
const BACK_Z = -0.3
const LEG_X = 0.18
const HEAD_C = [0, 0.1, 0.05] // head centre, relative to the top of the neck
const HEAD_S = [0.215, 0.205, 0.245]

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))

export function Zebra({ kind = 'classic' }) {
  const K = KINDS[kind] || KINDS.classic
  const geo = useZebraGeometry()
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const tapAt = useRef(-99)
  const now = useRef(0)
  const squish = useRef()
  const pitch = useRef()
  const frontLegs = useRef([])
  const backLegs = useRef([])
  const chest = useRef()
  const neck = useRef()
  const head = useRef()
  const ears = useRef([])
  const eyes = useRef([])
  const tail = useRef()

  const mane = useMemo(
    () => ({
      neck: NECK_MANE.map(([u, h, w], i) => {
        const { pos, n, T } = neckSkin(u, Math.PI / 2, h * 0.5 - 0.02)
        const x = new THREE.Vector3().crossVectors(T, n).normalize()
        return { pos, q: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, n, T.clone().negate())), scale: [w, h, 0.088], c: i % 2 }
      }),
      head: HEAD_MANE.map(([b, h], i) => {
        const d = [0, Math.sin(b), -Math.cos(b)]
        const r = HEAD_S[1] * Math.sin(b) ** 2 + HEAD_S[2] * Math.cos(b) ** 2
        return { pos: [HEAD_C[0], HEAD_C[1] + d[1] * (r + h * 0.5 - 0.025), HEAD_C[2] + d[2] * (r + h * 0.5 - 0.025)], rot: b - Math.PI / 2, scale: [0.095, h, 0.085], c: (NECK_MANE.length + i) % 2 }
      }),
    }),
    [],
  )

  useFrame(({ clock }) => {
    const t = (now.current = clock.elapsedTime)
    const s = t - tapAt.current
    // the buck: lean onto the front legs, throw the hind end up and the back
    // legs out behind, then come down with a squash
    let p = 0
    let kick = 0
    let k = 0
    let shift = 0
    if (s >= 0 && s < 0.18) {
      const q = s / 0.18
      p = -0.05 * Math.sin(q * Math.PI * 0.5)
      k = 0.06 * Math.sin(q * Math.PI * 0.5)
      shift = 0.05 * smooth(q)
    } else if (s >= 0.18 && s < 0.82) {
      const q = (s - 0.18) / 0.64
      const b = Math.sin(Math.PI * q)
      p = 0.42 * b - 0.05 * (1 - q) ** 2
      kick = 1.05 * Math.sin(Math.PI * Math.min(1, q * 1.12)) ** 1.4
      k = 0.06 * (1 - q) ** 2 - 0.04 * b
      shift = 0.05 + 0.03 * b - 0.08 * smooth((q - 0.6) / 0.4)
    } else if (s >= 0.82 && s < 1.7) {
      const r = s - 0.82
      k = 0.14 * Math.exp(-5.5 * r) * Math.cos(r * 13)
      p = -0.035 * Math.exp(-5 * r) * Math.sin(r * 11)
    }
    const air = Math.max(0, p) / 0.42
    squish.current.scale.set(1 + k * 0.5, 1 - k, 1 + k * 0.5)
    squish.current.position.z = shift
    pitch.current.rotation.x = p
    backLegs.current.forEach((l, i) => l && (l.rotation.x = kick * (i ? 1 : 0.9)))
    frontLegs.current.forEach((l) => l && (l.rotation.x = -p * 0.25))
    // a slow breath in the body
    const br = 1 + Math.sin(t * 1.9) * 0.014
    chest.current.scale.set(BODY.scale[0] * br, BODY.scale[1] * br, BODY.scale[2])
    // the neck nods; it throws back as the hind end goes up
    const shake = s >= 0 && s < 2.2 ? Math.exp(-2.4 * s) * Math.sin(s * 12) : 0
    const nod = Math.max(0, Math.sin(t * 1.25)) ** 3
    neck.current.rotation.x = Math.sin(t * 0.7) * 0.025 - p * 0.9 + k * 0.4
    neck.current.rotation.z = Math.sin(t * 0.5) * 0.03
    head.current.rotation.set(0.1 + nod * 0.16 - air * 0.15, 0.22 * Math.sin(t * 0.33) + 0.08 * Math.sin(t * 0.81), shake * 0.22)
    // ears: each flicks on its own beat, and pin back in the buck
    ears.current.forEach((e, i) => {
      if (!e) return
      const ph = (t * 0.29 + i * 0.43) % 1
      const flick = ph < 0.08 ? Math.sin((ph / 0.08) * Math.PI) : 0
      e.rotation.z = (i ? 1 : -1) * (0.2 + flick * 0.35 + air * 0.25)
      e.rotation.x = -air * 0.6 - flick * 0.2
    })
    // a blink now and then
    const lid = (t + 1.5) % 3.6 < 0.12 ? 0.12 : 1
    eyes.current.forEach((e) => e && (e.scale.y = 0.036 * lid))
    // the tail swishes, and flicks up in the buck
    tail.current.rotation.z = Math.sin(t * 2.2) * 0.32 + shake * 0.6
    tail.current.rotation.x = 0.85 +Math.sin(t * 1.1) * 0.08 + air * 0.6
  })

  const leg = (x, z, refs, i) => (
    <group key={`${x}${z}`} ref={(el) => (refs.current[i] = el)} position={[x, LEG_Y, z]}>
      <Clay geometry={geo.leg} color={K.body} />
      {/* a soft clay hip where the leg enters the body's underside */}
      <Clay geometry={geo.ball} color={K.body} position-y={-0.11} scale={[0.125, 0.16, 0.125]} />
      <Clay geometry={geo.hoof} color={K.hoof} roughness={0.45} position-y={-LEG_Y} />
    </group>
  )

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
        {/* the front legs stay planted; everything else pitches about the shoulders */}
        {[-LEG_X, LEG_X].map((x, i) => leg(x, FRONT_Z, frontLegs, i))}
        <group ref={pitch} position={[0, LEG_Y, FRONT_Z]}>
          <group position={[0, -LEG_Y, -FRONT_Z]}>
            {[-LEG_X, LEG_X].map((x, i) => leg(x, BACK_Z, backLegs, i))}

            {/* body, with its stripes drawn in the same scale so they hug it */}
            <group ref={chest} position-y={BODY.y} scale={BODY.scale}>
              <Clay geometry={geo.ball} color={K.body} />
              {[1, -1].map((side) => (
                <group key={side} scale-x={side}>
                  {geo.stripes.map((g, i) => (
                    <Clay key={i} geometry={g} color={K.stripe} roughness={0.55} />
                  ))}
                </group>
              ))}
            </group>

            {/* tail */}
            <group ref={tail} position={[0, 1.08, -0.56]} rotation-x={0.85}>
              <Clay geometry={geo.tail} color={K.body} />
              <Clay geometry={geo.tuft} color={K.tuft} position-y={-0.29} scale={[1, 1, 0.85]} />
            </group>

            {/* neck, mane and head */}
            <group ref={neck} position={NECK_ROOT}>
              <Clay geometry={geo.neck} color={K.body} />
              {[1, -1].map((side) => (
                <group key={side} scale-x={side}>
                  {geo.neckStripes.map((g, i) => (
                    <Clay key={i} geometry={g} color={K.stripe} roughness={0.55} />
                  ))}
                </group>
              ))}
              {mane.neck.map((b, i) => (
                <Clay key={i} geometry={geo.block} color={K.mane[b.c]} position={b.pos} quaternion={b.q} scale={b.scale} roughness={0.55} />
              ))}
              <group ref={head} position={[N2.x, N2.y, N2.z]} scale={1.1}>
                <Clay geometry={geo.ball} color={K.body} position={HEAD_C} scale={HEAD_S} />
                <Clay geometry={geo.ball} color={K.muzzle} position={[0, 0.04, 0.29]} scale={[0.165, 0.155, 0.15]} roughness={0.55} />
                {[-1, 1].map((x, i) => (
                  <mesh key={x} ref={(el) => (eyes.current[i] = el)} geometry={geo.ball} position={[x * 0.198, 0.15, 0.14]} scale={0.036}>
                    <meshStandardMaterial color={K.eye} roughness={0.2} />
                  </mesh>
                ))}
                {[-1, 1].map((x, i) => (
                  <group key={x} ref={(el) => (ears.current[i] = el)} position={[x * 0.11, 0.25, 0.0]} rotation-z={-x * 0.2}>
                    <Clay geometry={geo.ear} color={K.body} position-y={0.08} scale={[1, 1, 0.8]} />
                  </group>
                ))}
                {mane.head.map((b, i) => (
                  <Clay key={i} geometry={geo.block} color={K.mane[b.c]} position={b.pos} rotation-x={b.rot} scale={b.scale} roughness={0.55} />
                ))}
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}

// The zebra springs in from nothing, overshoots a touch and settles.
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

export default function ZebraScene({ background = '#f6f4ef', autoRotate = true, kind = 'classic' }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [-4.5, 1.9, 2.9], fov: 30, near: 0.05, far: 60 }} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1 }}>
        <color attach="background" args={[background]} />
        <hemisphereLight args={['#ffffff', '#ece6dc', 1.6]} />
        <directionalLight position={[3, 6, 5]} intensity={1.9} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.03} shadow-radius={5}>
          <orthographicCamera attach="shadow-camera" args={[-2, 2, 2.8, -0.6, 0.5, 16]} />
        </directionalLight>
        <directionalLight position={[-5, 3, -4]} intensity={0.9} color="#f6f2ec" />
        <PopIn>
          <Zebra kind={kind} />
        </PopIn>
        <ContactShadows position={[0, 0, 0]} opacity={0.32} scale={7} blur={2.6} far={3.2} resolution={512} color="#2a2826" />
        <OrbitControls makeDefault enablePan={false} target={[0, 0.98, 0.1]} autoRotate={autoRotate} autoRotateSpeed={0.7} minDistance={3} maxDistance={14} maxPolarAngle={1.5} />
      </Canvas>
      <InfoHint>It breathes, nods, blinks, flicks its ears and swishes its tail on its own · tap it and it bucks: weight onto the front legs, hind end and back legs kick up, then a squashy landing · Kind swaps classic, pastel, candy and midnight · drag to orbit</InfoHint>
    </div>
  )
}

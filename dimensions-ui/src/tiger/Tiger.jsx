import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls, useCursor } from '@react-three/drei'
import * as THREE from 'three'

// A clay-toy tiger: an egg of a body on four short, thick legs with cream
// boot paws, a big round head with a cream two-puff muzzle and a dark nose,
// bead eyes, round ears lined in pink, raised clay stripes on the brow, the
// cheeks and the back, and a curling tail banded in dark with a dark tip.
// It breathes, looks about, blinks and swishes its tail. Tap it and it roars:
// a crouch, the head throws back with the mouth wide, then a shake.
// It faces +z and stands on y = 0.

const TAU = Math.PI * 2
const D = Math.PI / 180

const KINDS = {
  orange: { body: '#f08a2e', stripe: '#3b2419', cream: '#fcefd9', inner: '#f7b3b6', nose: '#3b2419', eye: '#17110e' },
  white: { body: '#f4f1ea', stripe: '#3f3a4c', cream: '#ffffff', inner: '#f6c3ca', nose: '#5c4a55', eye: '#1f2c44' },
  golden: { body: '#f5c763', stripe: '#b5652a', cream: '#fff6e2', inner: '#f7c0b0', nose: '#7a4224', eye: '#2a1a10' },
  black: { body: '#57505a', stripe: '#16121a', cream: '#d8d0c8', inner: '#d99aa4', nose: '#16121a', eye: '#f2b437' },
}

const BODY = { pos: [0, 0.67, -0.1], scale: [0.44, 0.38, 0.6] }
const NECK = [0, 1.08, 0.4] // the head turns about this point
const HC = [0, 0.05, 0.08] // centre of the head ball, inside the head group
const HEAD = [0.43, 0.4, 0.41]

// ---- stripes ----

// A direction on the unit sphere: az round the y axis (0 is +x, 90 is +z,
// the front), el up from the equator, both in degrees.
const dirOf = (az, el) => new THREE.Vector3(Math.cos(el * D) * Math.cos(az * D), Math.sin(el * D), Math.cos(el * D) * Math.sin(az * D))

// A raised clay stripe lying on a unit sphere: it runs along a curve through
// three points, tapers to a point at each end, and its rim is sunk just under
// the surface while the middle stands proud. Drawn inside the scale of the
// ball it sits on, so it follows that ball's curvature exactly.
function stripeGeometry([a0, e0, a1, e1, a2, e2, width, height = 0.05], along = 26, across = 9) {
  const P0 = dirOf(a0, e0)
  const P1 = dirOf(a1, e1)
  const P2 = dirOf(a2, e2)
  const C = new THREE.Vector3()
  const C2 = new THREE.Vector3()
  const side = new THREE.Vector3()
  const p = new THREE.Vector3()
  const at = (u, out) => {
    const k = 1 - u
    return out
      .set(0, 0, 0)
      .addScaledVector(P0, k * k)
      .addScaledVector(P1, 2 * k * u)
      .addScaledVector(P2, u * u)
      .normalize()
  }
  const pos = []
  const idx = []
  for (let i = 0; i <= along; i++) {
    const u = i / along
    at(Math.min(1, u + 0.01), C2)
    at(Math.max(0, u - 0.01), C)
    C2.sub(C) // the tangent, from a central difference
    at(u, C)
    side.crossVectors(C, C2).normalize()
    const env = Math.sin(Math.PI * u)
    const w = width * D * env ** 0.7
    for (let j = 0; j <= across; j++) {
      const v = (j / across) * 2 - 1
      p.copy(C).addScaledVector(side, w * v).normalize()
      p.multiplyScalar(0.986 + height * Math.sqrt(Math.max(0, 1 - v * v)) * env ** 0.5)
      pos.push(p.x, p.y, p.z)
    }
  }
  for (let i = 0; i < along; i++)
    for (let j = 0; j < across; j++) {
      const a = i * (across + 1) + j
      const b = a + 1
      const c = a + across + 1
      const d = c + 1
      idx.push(a, c, b, b, c, d)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// mirror a stripe to the other side (az -> 180 - az)
const mirror = ([a0, e0, a1, e1, a2, e2, ...rest]) => [180 - a0, e0, 180 - a1, e1, 180 - a2, e2, ...rest]

// back stripes: from near the spine down the flank, bowed backwards a touch
const BACK = [-64, -38, -12, 14, 40].map((a, i) => [a + 5, 80, a - 7, 46, a + 1, 4 + (i % 2) * 10, 8, 0.06])
const BODY_STRIPES = [...BACK, ...BACK.map(mirror)]

// head: three on the brow, two on each cheek, a couple over the crown
const HEAD_STRIPES = [
  [90, 44, 90, 58, 90, 74, 8, 0.05],
  [72, 40, 66, 52, 56, 64, 7, 0.05],
  [36, 6, 50, 2, 64, -4, 8, 0.05],
  [30, -14, 44, -16, 58, -24, 7, 0.05],
  [60, 76, 20, 70, -10, 58, 7, 0.045],
]
const HEAD_ALL = [...HEAD_STRIPES, ...HEAD_STRIPES.slice(1).map(mirror)]

const TAIL_CURVE = new THREE.CatmullRomCurve3(
  [
    [0, 0, 0],
    [0, 0.08, -0.13],
    [0, 0.08, -0.27],
    [0, 0.17, -0.38],
    [0, 0.33, -0.42],
  ].map((p) => new THREE.Vector3(...p)),
)
const TAIL_R = 0.034
const tailFrame = (u) => {
  const p = TAIL_CURVE.getPointAt(u)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), TAIL_CURVE.getTangentAt(u))
  return { p, q }
}
const TAIL_BANDS = [0.42, 0.6].map(tailFrame)
const TAIL_TIP = new THREE.CatmullRomCurve3(TAIL_CURVE.getSpacedPoints(40).slice(31))
const TAIL_END = TAIL_CURVE.getPointAt(1)

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

function useTigerGeometry() {
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
          [0.136, 0.69], // up to the body's middle, so the top is buried inside it
        ].map(([r, y]) => new THREE.Vector2(r, y)),
        40,
      ),
      tail: new THREE.TubeGeometry(TAIL_CURVE, 48, TAIL_R, 16, false),
      tip: new THREE.TubeGeometry(TAIL_TIP, 16, TAIL_R + 0.002, 16, false),
      band: new THREE.TorusGeometry(TAIL_R - 0.004, 0.013, 12, 28),
      nose: noseGeometry(),
      body: BODY_STRIPES.map((s) => stripeGeometry(s)),
      head: HEAD_ALL.map((s) => stripeGeometry(s)),
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
function Clay({ color, roughness = 0.62, ...props }) {
  return (
    <mesh castShadow receiveShadow {...props}>
      <meshStandardMaterial color={color} roughness={roughness} metalness={0} />
    </mesh>
  )
}

export function Tiger({ kind = 'orange' }) {
  const K = KINDS[kind] || KINDS.orange
  const geo = useTigerGeometry()
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const tapAt = useRef(-99)
  const now = useRef(0)
  const squish = useRef()
  const chest = useRef()
  const head = useRef()
  const ears = useRef([])
  const eyes = useRef([])
  const mouth = useRef()
  const tail = useRef()

  useFrame(({ clock }) => {
    const t = (now.current = clock.elapsedTime)
    const s = t - tapAt.current
    // the roar: a brief crouch, the head throws back, then a shake
    let k = 0 // squash (+) / stretch (-)
    let roar = 0 // 0..1, how wide the roar is
    let crouch = 0
    let shake = 0
    if (s >= 0 && s < 0.2) {
      crouch = Math.sin((s / 0.2) * Math.PI * 0.5)
      k = 0.1 * crouch
    } else if (s >= 0.2 && s < 2.6) {
      const a = s - 0.2
      crouch = Math.max(0, 1 - a / 0.1)
      roar = a < 0.75 ? Math.sin(Math.min(1, a / 0.14) * Math.PI * 0.5) : Math.exp(-6 * (a - 0.75))
      k = 0.1 * crouch + (a < 0.75 ? -0.05 * roar : -0.05 * Math.exp(-5 * (a - 0.75)) * Math.cos((a - 0.75) * 12))
      if (a > 0.7) shake = Math.exp(-2.8 * (a - 0.7)) * Math.sin((a - 0.7) * 17)
    }
    const rumble = roar * Math.sin(s * 42) * 0.04
    squish.current.scale.set(1 + k * 0.5, 1 - k, 1 + k * 0.5)
    squish.current.rotation.z = rumble * 0.4 + shake * 0.03
    // a slow breath
    const b = 1 + Math.sin(t * 1.6) * 0.014
    chest.current.scale.set(BODY.scale[0] * b, BODY.scale[1] * b, BODY.scale[2])
    // the head looks about, nods with the breath, dips in the crouch, throws
    // back for the roar and shakes after it
    head.current.rotation.set(
      0.03 * Math.sin(t * 1.6 + 0.6) + 0.05 * Math.sin(t * 0.43) + crouch * 0.12 - roar * 0.4,
      (0.26 * Math.sin(t * 0.37) + 0.1 * Math.sin(t * 0.83)) * (1 - roar) + shake * 0.3,
      0.04 * Math.sin(t * 0.6) + rumble + shake * 0.12,
    )
    // the mouth opens for the roar
    mouth.current.scale.set(0.085, 0.001 + 0.08 * roar, 0.05)
    // ears: quick flicks on their own beats, and pinned back in the roar
    ears.current.forEach((e, i) => {
      if (!e) return
      const ph = (t * 0.33 + i * 0.43) % 1
      const flick = ph < 0.1 ? Math.sin((ph / 0.1) * Math.PI * 2) * 0.3 : 0
      e.rotation.z = (i ? -1 : 1) * (0.22 + flick + roar * 0.35 + shake * 0.3)
      e.rotation.x = -flick * 0.4 - roar * 0.45
    })
    // a blink now and then (phased so the first one lands after the pop-in)
    const lid = roar === 0 && (t + 0.2) % 4.7 < 0.13 ? 0.12 : 1
    eyes.current.forEach((e) => e && (e.scale.y = 0.046 * lid))
    // the tail swishes slowly, and lashes in the roar
    tail.current.rotation.y = Math.sin(t * 1.5) * 0.38 + Math.sin(s * 9) * roar * 0.5 + shake * 0.4
    tail.current.rotation.x = Math.sin(t * 1.1) * 0.08 - roar * 0.3
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
        {/* legs, each ending in a big rounded cream boot of a paw */}
        {[
          [-0.2, 0.22],
          [0.2, 0.22],
          [-0.2, -0.4],
          [0.2, -0.4],
        ].map(([x, z]) => (
          <group key={`${x}${z}`} position={[x, 0, z]} rotation-y={x * 0.5}>
            <Clay geometry={geo.leg} color={K.body} />
            <Clay geometry={geo.ball} color={K.cream} position={[0, 0.115, 0.05]} scale={[0.17, 0.12, 0.205]} />
          </group>
        ))}

        {/* body, with its stripes drawn in the same scale so they hug it */}
        <group ref={chest} position={BODY.pos} scale={BODY.scale}>
          <Clay geometry={geo.ball} color={K.body} />
          {geo.body.map((g, i) => (
            <Clay key={i} geometry={g} color={K.stripe} roughness={0.55} />
          ))}
        </group>

        {/* tail: banded, with a dark tip */}
        <group ref={tail} position={[0, 0.82, -0.6]}>
          <Clay geometry={geo.tail} color={K.body} />
          {TAIL_BANDS.map(({ p, q }, i) => (
            <Clay key={i} geometry={geo.band} color={K.stripe} roughness={0.55} position={p} quaternion={q} />
          ))}
          <Clay geometry={geo.tip} color={K.stripe} roughness={0.55} />
          <Clay geometry={geo.ball} color={K.stripe} roughness={0.55} position={TAIL_END} scale={TAIL_R + 0.002} />
        </group>

        {/* head: ball and stripes, ears, eyes, nose, muzzle and mouth */}
        <group ref={head} position={NECK}>
          <group position={HC} scale={HEAD}>
            <Clay geometry={geo.ball} color={K.body} />
            {geo.head.map((g, i) => (
              <Clay key={i} geometry={g} color={K.stripe} roughness={0.55} />
            ))}
          </group>
          {[-1, 1].map((x, i) => (
            <group key={x} ref={(el) => (ears.current[i] = el)} position={[HC[0] + x * 0.27, HC[1] + 0.3, HC[2] + 0.04]} rotation-z={-x * 0.22}>
              <Clay geometry={geo.ball} color={K.body} rotation-x={-0.2} scale={[0.115, 0.105, 0.06]} />
              <Clay geometry={geo.ball} color={K.inner} position={[0, -0.006, 0.038]} rotation-x={-0.2} scale={[0.075, 0.068, 0.03]} />
            </group>
          ))}
          {[-1, 1].map((x, i) => (
            <mesh key={x} ref={(el) => (eyes.current[i] = el)} geometry={geo.ball} position={[HC[0] + x * 0.165, HC[1] + 0.075, HC[2] + 0.365]} scale={0.046}>
              <meshStandardMaterial color={K.eye} roughness={0.15} />
            </mesh>
          ))}
          {[-1, 1].map((x) => (
            <Clay key={x} geometry={geo.ball} color={K.cream} position={[HC[0] + x * 0.088, HC[1] - 0.12, HC[2] + 0.36]} scale={[0.118, 0.096, 0.085]} />
          ))}
          <Clay geometry={geo.ball} color={K.cream} position={[HC[0], HC[1] - 0.205, HC[2] + 0.31]} scale={[0.085, 0.06, 0.07]} />
          <Clay geometry={geo.nose} color={K.nose} roughness={0.45} position={[HC[0], HC[1] - 0.03, HC[2] + 0.435]} rotation-x={0.2} scale={[0.085, 0.064, 0.056]} />
          <mesh ref={mouth} geometry={geo.ball} position={[HC[0], HC[1] - 0.2, HC[2] + 0.36]}>
            <meshStandardMaterial color="#5a2620" roughness={0.7} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

// The tiger springs in from nothing, overshoots a touch and settles.
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

export default function TigerScene({ background = '#f6f4ef', autoRotate = true, kind = 'orange', ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [3.9, 1.6, 3.6], fov: 30, near: 0.05, far: 60 }} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1 }}>
        <color attach="background" args={[background]} />
        <hemisphereLight args={['#ffffff', '#efe6d6', 1.6]} />
        <directionalLight position={[3, 6, 5]} intensity={1.9} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.03} shadow-radius={5}>
          <orthographicCamera attach="shadow-camera" args={[-2.2, 2.2, 2.6, -0.6, 0.5, 16]} />
        </directionalLight>
        <directionalLight position={[-5, 3, -4]} intensity={0.9} color="#fff1dc" />
        <PopIn>
          <Tiger kind={kind} {...props} />
        </PopIn>
        <ContactShadows position={[0, 0, 0]} opacity={0.32} scale={8} blur={2.6} far={2.6} resolution={512} color="#3a2a18" />
        <OrbitControls makeDefault enablePan={false} target={[0, 0.74, 0.1]} autoRotate={autoRotate} autoRotateSpeed={0.7} minDistance={3} maxDistance={14} maxPolarAngle={1.5} />
      </Canvas>
      <InfoHint>It breathes, looks about, blinks, flicks its ears and swishes its tail on its own · tap it and it roars: a crouch, the head throws back with a wide mouth, then a shake · Kind swaps orange, white, golden and black · drag to orbit</InfoHint>
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls, useCursor } from '@react-three/drei'
import * as THREE from 'three'

// A clay-toy giraffe: an egg of a body on four thin legs with brown hooves, a
// long tapering neck that leans forward, a round head with a peach muzzle,
// bead eyes, leaf ears and two knobbed horns, stuck-on oval spots and a
// tufted tail. It breathes, sways its neck, looks about, blinks, flicks its
// ears and swishes its tail. Tap it and it hops with squash and stretch.
// It faces +z and stands on y = 0.

const TAU = Math.PI * 2

const KINDS = {
  sunny: { skin: '#ffc233', muzzle: '#f4a35c', spots: ['#8c5527', '#ea7d22'], hoof: '#6e3d21', horn: '#cf9762', knob: '#613522' },
  peach: { skin: '#f8b89a', muzzle: '#fbd9c4', spots: ['#b5553f', '#f08a5d'], hoof: '#7a3f33', horn: '#e2a182', knob: '#7a3f33' },
  mint: { skin: '#9bdcc0', muzzle: '#d6f3e4', spots: ['#2f8f7a', '#5fc0a0'], hoof: '#2c6a5c', horn: '#7cc4a8', knob: '#2c6a5c' },
  lilac: { skin: '#c9b3f2', muzzle: '#e9defb', spots: ['#6c4bb5', '#9a7de0'], hoof: '#4c3585', horn: '#b09ae0', knob: '#4c3585' },
}

// ---- the neck: a tapering tube along a curve in the y-z plane ----

const N0 = new THREE.Vector3(0, 0, 0)
const N1 = new THREE.Vector3(0, 0.52, 0.1)
const N2 = new THREE.Vector3(0, 1.0, 0.36)
const NECK_ROOT = [0, 1.1, 0.3] // set inside the body, so the neck grows out of it

const neckAt = (u, out = new THREE.Vector3()) => {
  const k = 1 - u
  return out.set(0, k * k * N0.y + 2 * k * u * N1.y + u * u * N2.y, k * k * N0.z + 2 * k * u * N1.z + u * u * N2.z)
}
const neckTan = (u, out = new THREE.Vector3()) =>
  out.set(0, 2 * (1 - u) * (N1.y - N0.y) + 2 * u * (N2.y - N1.y), 2 * (1 - u) * (N1.z - N0.z) + 2 * u * (N2.z - N1.z)).normalize()
// thick where it leaves the body, slim under the head
const neckR = (u) => 0.122 + 0.14 * (1 - u) ** 2.4

// A point on the neck's skin at u along it and angle a round it (0 is the
// right side, -pi/2 the front), with the outward normal and the tangent.
function neckSkin(u, a) {
  const P = neckAt(u)
  const T = neckTan(u)
  const n = new THREE.Vector3(Math.cos(a), Math.sin(a) * T.z, -Math.sin(a) * T.y)
  return { pos: P.addScaledVector(n, neckR(u)), n, T }
}

function neckGeometry(rings = 28, sides = 36) {
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
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// ---- spots ----

// A puffy disc that lies on a unit sphere round its +y pole: the rim is sunk
// just under the surface and the middle stands proud. Drawn inside the body's
// own scale, so it follows the body's egg shape exactly.
function capGeometry(angle) {
  const g = new THREE.SphereGeometry(1, 28, 7, 0, TAU, 0, angle)
  const p = g.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize()
    const k = Math.min(1, Math.acos(Math.min(1, v.y)) / angle)
    v.multiplyScalar(0.992 + 0.03 * Math.sqrt(1 - k * k))
    p.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  return g
}

const BODY = { y: 1.05, scale: [0.4, 0.34, 0.56] }
// [angle round the body (0 right side, +forward), elevation, size, colour index]
const BODY_SPOTS = [
  [0.18, 0.5, 0.3, 0],
  [-0.6, 0.42, 0.22, 1],
  [-0.22, 0.08, 0.15, 1],
  [Math.PI - 0.3, 0.46, 0.26, 1],
  [Math.PI + 0.55, 0.5, 0.27, 0],
  [Math.PI + 0.12, 0.05, 0.14, 0],
  [-Math.PI / 2, 1.0, 0.2, 1],
]
// [along the neck 0..1, angle round it, half-width, half-height, colour index]
const NECK_SPOTS = [
  [0.72, 0.2, 0.05, 0.075, 0],
  [0.47, -0.55, 0.058, 0.06, 1],
  [0.36, 0.5, 0.045, 0.085, 1],
  [0.62, Math.PI - 0.1, 0.055, 0.07, 1],
  [0.4, Math.PI + 0.45, 0.05, 0.08, 0],
  [0.55, Math.PI / 2, 0.045, 0.06, 0],
]

const UP = new THREE.Vector3(0, 1, 0)

function useGiraffeGeometry() {
  const geo = useMemo(() => {
    const ball = new THREE.SphereGeometry(1, 48, 32)
    const hoof = new THREE.LatheGeometry(
      [
        [0.001, 0],
        [0.078, 0],
        [0.088, 0.018],
        [0.087, 0.1],
        [0.079, 0.14],
        [0.06, 0.156],
        [0.001, 0.158],
      ].map(([r, y]) => new THREE.Vector2(r, y)),
      28,
    )
    return {
      ball,
      hoof,
      neck: neckGeometry(),
      leg: new THREE.CylinderGeometry(0.07, 0.074, 0.92, 24, 1).translate(0, -0.46, 0),
      horn: new THREE.CylinderGeometry(0.019, 0.025, 0.17, 16, 1).translate(0, 0.085, 0),
      tail: new THREE.CylinderGeometry(0.02, 0.013, 0.36, 12, 1).translate(0, -0.18, 0),
      caps: BODY_SPOTS.map((s) => capGeometry(s[2])),
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

export function Giraffe({ kind = 'sunny', spots = true }) {
  const K = KINDS[kind] || KINDS.sunny
  const geo = useGiraffeGeometry()
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const tapAt = useRef(-99)
  const now = useRef(0)
  const hopper = useRef()
  const squish = useRef()
  const chest = useRef()
  const neck = useRef()
  const head = useRef()
  const ears = useRef([])
  const eyes = useRef([])
  const tail = useRef()

  const bodySpots = useMemo(
    () =>
      BODY_SPOTS.map(([az, el, , c]) => ({
        q: new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az))),
        c,
      })),
    [],
  )
  const neckSpots = useMemo(
    () =>
      NECK_SPOTS.map(([u, a, rx, ry, c]) => {
        const { pos, n, T } = neckSkin(u, a)
        const x = new THREE.Vector3().crossVectors(T, n).normalize()
        const y = new THREE.Vector3().crossVectors(n, x)
        return { pos: pos.addScaledVector(n, -0.006), q: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, n)), scale: [rx, ry, 0.02], c }
      }),
    [],
  )

  useFrame(({ clock }) => {
    const t = (now.current = clock.elapsedTime)
    const s = t - tapAt.current
    // the hop: crouch, stretch into the air, squashy landing
    let y = 0
    let k = 0
    let air = 0
    if (s >= 0 && s < 0.22) k = 0.14 * Math.sin((s / 0.22) * Math.PI * 0.5)
    else if (s >= 0.22 && s < 0.82) {
      const q = (s - 0.22) / 0.6
      y = 4 * q * (1 - q) * 0.3
      k = q < 0.5 ? -0.1 * (1 - q * 2) : -0.03
      air = Math.sin(q * Math.PI)
    } else if (s >= 0.82 && s < 1.5) k = 0.15 * Math.exp(-6 * (s - 0.82)) * Math.cos((s - 0.82) * 14)
    hopper.current.position.y = y
    squish.current.scale.set(1 + k * 0.5, 1 - k, 1 + k * 0.5)
    // a slow breath in the body
    const b = 1 + Math.sin(t * 1.9) * 0.012
    chest.current.scale.set(BODY.scale[0] * b, BODY.scale[1] * b, BODY.scale[2])
    // the neck sways and dips back in the air; the head looks about
    const shake = s >= 0 && s < 2 ? Math.exp(-2.6 * s) * Math.sin(s * 13) : 0
    neck.current.rotation.x = Math.sin(t * 0.8) * 0.03 - air * 0.16 + k * 0.5
    neck.current.rotation.z = Math.sin(t * 0.55) * 0.04
    head.current.rotation.set(0.12 + 0.08 * Math.sin(t * 0.53) - air * 0.25, 0.32 * Math.sin(t * 0.37) + 0.14 * Math.sin(t * 0.83), shake * 0.28)
    // ears: each flicks on its own beat and both flap in the air
    ears.current.forEach((e, i) => {
      if (!e) return
      const ph = (t * 0.31 + i * 0.47) % 1
      const flick = ph < 0.09 ? Math.sin((ph / 0.09) * Math.PI) * 0.45 : 0
      e.rotation.z = (i ? 1 : -1) * (0.45 - flick - air * 0.7 + shake * 0.2)
      e.rotation.y = (i ? -1 : 1) * flick * 0.5
    })
    // a blink now and then
    const lid = (t + 1.5) % 3.4 < 0.12 ? 0.12 : 1
    eyes.current.forEach((e) => e && (e.scale.y = 0.03 * lid))
    // the tail swishes, harder after a tap
    tail.current.rotation.z = Math.sin(t * 2.3) * 0.3 + shake * 0.6
    tail.current.rotation.x = 0.75 + Math.sin(t * 1.1) * 0.08 + air * 0.5
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
          {/* legs and hooves */}
          {[
            [-0.19, 0.28],
            [0.19, 0.28],
            [-0.19, -0.3],
            [0.19, -0.3],
          ].map(([x, z]) => (
            <group key={`${x}${z}`} position={[x, 0, z]}>
              <Clay geometry={geo.leg} color={K.skin} position-y={1} />
              <Clay geometry={geo.hoof} color={K.hoof} roughness={0.5} />
            </group>
          ))}

          {/* body, with its spots drawn in the same scale so they hug it */}
          <group ref={chest} position-y={BODY.y} scale={BODY.scale}>
            <Clay geometry={geo.ball} color={K.skin} />
            {spots && bodySpots.map((sp, i) => <Clay key={i} geometry={geo.caps[i]} color={K.spots[sp.c]} quaternion={sp.q} />)}
          </group>

          {/* tail */}
          <group ref={tail} position={[0, 1.15, -0.52]} rotation-x={0.75}>
            <Clay geometry={geo.tail} color={K.skin} />
            <Clay geometry={geo.ball} color={K.hoof} position-y={-0.39} scale={[0.05, 0.078, 0.05]} />
          </group>

          {/* neck and head */}
          <group ref={neck} position={NECK_ROOT}>
            <Clay geometry={geo.neck} color={K.skin} />
            {spots && neckSpots.map((sp, i) => <Clay key={i} geometry={geo.ball} color={K.spots[sp.c]} position={sp.pos} quaternion={sp.q} scale={sp.scale} />)}
            <group ref={head} position={[N2.x, N2.y, N2.z]} scale={1.18}>
              <Clay geometry={geo.ball} color={K.skin} position={[0, 0.08, 0.07]} scale={[0.2, 0.185, 0.23]} />
              <Clay geometry={geo.ball} color={K.muzzle} position={[0, -0.01, 0.26]} scale={[0.165, 0.135, 0.15]} />
              {[-1, 1].map((x, i) => (
                <mesh key={x} ref={(el) => (eyes.current[i] = el)} geometry={geo.ball} position={[x * 0.152, 0.13, 0.205]} scale={0.03}>
                  <meshStandardMaterial color="#16110e" roughness={0.18} />
                </mesh>
              ))}
              {[-1, 1].map((x, i) => (
                <group key={x} ref={(el) => (ears.current[i] = el)} position={[x * 0.15, 0.17, 0.02]} rotation-z={x * 0.45}>
                  <Clay geometry={geo.ball} color={K.skin} position-x={x * 0.09} scale={[0.1, 0.045, 0.065]} />
                </group>
              ))}
              {[-1, 1].map((x) => (
                <group key={x} position={[x * 0.07, 0.24, 0.03]} rotation-z={-x * 0.12}>
                  <Clay geometry={geo.horn} color={K.horn} />
                  <Clay geometry={geo.ball} color={K.knob} position-y={0.185} scale={0.042} />
                </group>
              ))}
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}

// The giraffe springs in from nothing, overshoots a touch and settles.
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

export default function GiraffeScene({ background = '#f6f4ef', autoRotate = true, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [5.3, 2.3, 4.6], fov: 30, near: 0.05, far: 60 }} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1 }}>
        <color attach="background" args={[background]} />
        <hemisphereLight args={['#ffffff', '#f1e6d6', 1.6]} />
        <directionalLight position={[3, 6, 5]} intensity={1.9} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.03} shadow-radius={5}>
          <orthographicCamera attach="shadow-camera" args={[-2, 2, 3.2, -0.4, 0.5, 16]} />
        </directionalLight>
        <directionalLight position={[-5, 3, -4]} intensity={0.9} color="#fff1dc" />
        <PopIn>
          <Giraffe {...props} />
        </PopIn>
        <ContactShadows position={[0, 0, 0]} opacity={0.3} scale={7} blur={2.6} far={3.2} resolution={512} color="#3a2a18" />
        <OrbitControls makeDefault enablePan={false} target={[0, 1.3, 0.15]} autoRotate={autoRotate} autoRotateSpeed={0.7} minDistance={3} maxDistance={14} maxPolarAngle={1.5} />
      </Canvas>
      <InfoHint>It breathes, sways its neck, looks about, blinks, flicks its ears and swishes its tail on its own · tap it and it hops with a squashy landing · Kind swaps sunny, peach, mint and lilac · drag to orbit</InfoHint>
    </div>
  )
}

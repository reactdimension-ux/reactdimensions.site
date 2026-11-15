import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls, useCursor } from '@react-three/drei'
import * as THREE from 'three'

// A clay-toy budgie: a yellow head shading into a green body, a small orange
// beak under a blue cere, blue cheek spots, bead eyes, layered blue wing and
// tail feathers, and peach feet gripping a forked branch perch that stands on
// the ground. It bobs, tilts its head, blinks and now and then preens. Tap it
// and it chirps: the head bobs quickly and the wings lift.
// It faces +z; the perch stands on y = 0.

const TAU = Math.PI * 2

const KINDS = {
  green: { head: '#ffe04a', body: '#7fd04c', back: '#5cad3a', wing: ['#2f63c9', '#4f86e6', '#86b4f6'], tail: '#2a55b8', cheek: '#3b63da', cere: '#5d8bef', beak: '#ff9b38', feet: '#f6b9a0', eye: '#1d1a1f' },
  blue: { head: '#fbfaf4', body: '#69b6f0', back: '#4c97d8', wing: ['#2c4a9e', '#4a6fc8', '#9bbdf0'], tail: '#283f92', cheek: '#6a4fd6', cere: '#4f78e4', beak: '#ffa64a', feet: '#f6b9a0', eye: '#1d1a1f' },
  yellow: { head: '#fff4a6', body: '#ffcf2e', back: '#f3bf22', wing: ['#3b8fd0', '#5eaee6', '#9fd2f6'], tail: '#357fc2', cheek: '#4f86e6', cere: '#6a95ee', beak: '#ff9233', feet: '#f6b9a0', eye: '#1d1a1f' },
  white: { head: '#ffffff', body: '#eef2f6', back: '#dbe3ec', wing: ['#7fa8dc', '#a3c3ea', '#d0e2f6'], tail: '#7099d2', cheek: '#9aa8f0', cere: '#7c9ff0', beak: '#ffa64a', feet: '#f6b9a0', eye: '#1d1a1f' },
}

const WOOD = { bark: '#a7764b', end: '#d8b184', leaf: '#8cc46a' }

const smooth = (a, b, x) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return k * k * (3 - 2 * k)
}

// ---- the perch: a Y-shaped branch, a tapering tube along a curve ----

const LIMB = new THREE.CatmullRomCurve3(
  [
    [-0.44, -0.02, 0.02],
    [-0.42, 0.3, 0.0],
    [-0.35, 0.55, 0.0],
    [-0.2, 0.68, 0.0],
    [0.0, 0.7, 0.0],
    [0.2, 0.7, 0.0],
    [0.4, 0.72, 0.0],
  ].map((p) => new THREE.Vector3(...p)),
)
const LIMB_R = (u) => 0.072 - 0.028 * u
const TWIG = new THREE.CatmullRomCurve3(
  [
    [-0.41, 0.34, 0.0],
    [-0.54, 0.56, 0.1],
    [-0.68, 0.78, 0.22],
    [-0.72, 0.9, 0.27],
  ].map((p) => new THREE.Vector3(...p)),
)
const TWIG_R = (u) => 0.05 - 0.022 * u

// where the limb passes x = 0: the bird stands on top of it there
const PERCH = (() => {
  let best = { d: 9 }
  for (let i = 0; i <= 400; i++) {
    const u = i / 400
    const p = LIMB.getPointAt(u)
    if (Math.abs(p.x) < best.d) best = { d: Math.abs(p.x), u, y: p.y, r: LIMB_R(u) }
  }
  return { y: best.y, r: best.r, top: best.y + best.r }
})()

function tubeGeometry(curve, radius, rings = 48, sides = 28) {
  const frames = curve.computeFrenetFrames(rings, false)
  const pos = []
  const idx = []
  const p = new THREE.Vector3()
  for (let i = 0; i <= rings; i++) {
    const u = i / rings
    curve.getPointAt(u, p)
    const r = radius(u)
    const N = frames.normals[i]
    const B = frames.binormals[i]
    for (let j = 0; j < sides; j++) {
      const a = (j / sides) * TAU
      const c = Math.cos(a) * r
      const s = Math.sin(a) * r
      pos.push(p.x + N.x * c + B.x * s, p.y + N.y * c + B.y * s, p.z + N.z * c + B.z * s)
    }
  }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < sides; j++) {
      const a = i * sides + j
      const b = i * sides + ((j + 1) % sides)
      idx.push(a, a + sides, b, b, a + sides, b + sides)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// ---- the bird: head and body share one colour field, so they blend ----

const NECK = [0, 0.72, 0.04] // the head turns about this point, inside the body
const HEAD = { c: [0, 0.17, 0.07], s: [0.235, 0.228, 0.25] } // in the head's own space
const HEAD_R = 0.24

function paint(K) {
  const head = new THREE.Color(K.head)
  const body = new THREE.Color(K.body)
  const back = new THREE.Color(K.back)
  const c = new THREE.Color()
  // x, y, z in the bird's space at rest
  return (x, y, z) => {
    c.copy(body).lerp(back, smooth(0.02, -0.26, z) * 0.85)
    return c.lerp(head, smooth(0.6, 0.8, y + 0.42 * z))
  }
}

function bodyGeometry(K) {
  const col = paint(K)
  const g = new THREE.SphereGeometry(1, 112, 80)
  const p = g.attributes.position
  const colors = new Float32Array(p.count * 3)
  const v = new THREE.Vector3()
  const m = new THREE.Matrix4().compose(new THREE.Vector3(0, 0.46, -0.03), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, 0, 0)), new THREE.Vector3(0.29, 0.42, 0.29))
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    // a plump chest, slimming toward the tail
    const k = 1 + 0.09 * (v.z > 0 ? v.z : 0) - 0.12 * Math.max(0, -v.y) * Math.max(0, -v.z)
    v.set(v.x * (1 + 0.06 * Math.max(0, -v.y) - 0.04 * Math.max(0, v.y)), v.y, v.z * k).applyMatrix4(m)
    p.setXYZ(i, v.x, v.y, v.z)
    col(v.x, v.y, v.z).toArray(colors, i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  g.computeVertexNormals()
  return g
}

function headGeometry(K) {
  const col = paint(K)
  const g = new THREE.SphereGeometry(1, 96, 64)
  const p = g.attributes.position
  const colors = new Float32Array(p.count * 3)
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    v.set(v.x * HEAD.s[0] + HEAD.c[0], v.y * HEAD.s[1] + HEAD.c[1], v.z * HEAD.s[2] + HEAD.c[2])
    p.setXYZ(i, v.x, v.y, v.z)
    col(v.x + NECK[0], v.y + NECK[1], v.z + NECK[2]).toArray(colors, i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  g.computeVertexNormals()
  return g
}

function useBudgieGeometry() {
  const geo = useMemo(() => {
    const TOE_R = 0.021
    const toeRing = PERCH.r + TOE_R * 0.55
    return {
      ball: new THREE.SphereGeometry(1, 40, 28),
      limb: tubeGeometry(LIMB, LIMB_R, 64, 30),
      twig: tubeGeometry(TWIG, TWIG_R, 36, 24),
      // a hooked drop of a beak, tip at -y
      beak: new THREE.LatheGeometry(
        [
          [0.001, -0.115],
          [0.014, -0.1],
          [0.03, -0.07],
          [0.046, -0.03],
          [0.054, 0.0],
          [0.05, 0.026],
          [0.03, 0.044],
          [0.001, 0.05],
        ].map(([r, y]) => new THREE.Vector2(r, y)),
        32,
      ),
      leg: new THREE.CapsuleGeometry(0.03, 0.14, 8, 16).translate(0, 0.07, 0),
      // a toe curls a part of the way round the branch, in the y-z plane
      toe: new THREE.TorusGeometry(toeRing, TOE_R, 12, 24, 1.95),
      toeR: TOE_R,
      toeRing,
    }
  }, [])
  useEffect(
    () => () =>
      Object.values(geo).forEach((g) => g.dispose && g.dispose()),
    [geo],
  )
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

// Something set onto the head's surface: yaw turns round to the side (+ right),
// pitch tips up (+) or down; the child sits at z = r, facing outward.
function OnHead({ yaw, pitch, r = HEAD_R, children }) {
  return (
    <group position={HEAD.c} rotation-y={yaw}>
      <group rotation-x={-pitch}>
        <group position-z={r}>{children}</group>
      </group>
    </group>
  )
}

// A wing of three layered rows of feathers, long dark flights under shorter, lighter coverts.
function Wing({ geo, K, side }) {
  const rows = [
    { c: K.wing[0], n: 3, len: 0.34, w: 0.085, y: -0.33, x: 0.0, z: -0.04 },
    { c: K.wing[1], n: 3, len: 0.24, w: 0.09, y: -0.22, x: 0.02, z: 0.0 },
    { c: K.wing[2], n: 2, len: 0.15, w: 0.1, y: -0.11, x: 0.038, z: 0.035 },
  ]
  return rows.map((r, j) =>
    Array.from({ length: r.n }, (_, i) => {
      const f = r.n === 1 ? 0 : i / (r.n - 1) - 0.5
      return <Clay key={`${j}${i}`} geometry={geo.ball} color={r.c} position={[side * r.x, r.y + Math.abs(f) * 0.04, r.z + f * r.w * 1.3]} rotation-x={f * 0.22} scale={[0.034, r.len, r.w]} />
    }),
  )
}

export function Budgie({ kind = 'green' }) {
  const K = KINDS[kind] || KINDS.green
  const geo = useBudgieGeometry()
  const body = useMemo(() => bodyGeometry(K), [K])
  const head = useMemo(() => headGeometry(K), [K])
  useEffect(() => () => body.dispose(), [body])
  useEffect(() => () => head.dispose(), [head])
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const tapAt = useRef(-99)
  const now = useRef(0)
  const bird = useRef()
  const chest = useRef()
  const neck = useRef()
  const jaw = useRef()
  const eyes = useRef([])
  const wings = useRef([])
  const tail = useRef()

  useFrame(({ clock }) => {
    const t = (now.current = clock.elapsedTime)
    const s = t - tapAt.current
    // the chirp: quick little head bobs and the wings lifting
    const chirp = s >= 0 && s < 1 ? Math.sin((s / 1) * Math.PI) : 0
    const peck = chirp * Math.sin(s * 30)
    // preening every so often: the head turns into the right wing and nibbles
    const pp = (t % 9) - 5.4
    const preen = pp > 0 && pp < 1.9 ? smooth(0, 0.35, pp) * smooth(1.9, 1.5, pp) : 0
    const nib = preen * Math.sin(t * 22) * 0.06
    // a gentle bob from the knees and a breath
    const bob = Math.sin(t * 2.2)
    bird.current.position.y = PERCH.top + bob * 0.012 - chirp * 0.02
    const b = 1 + Math.sin(t * 2.6) * 0.012
    chest.current.scale.set(b, 1 - bob * 0.008, b)
    // the head tilts and looks about
    neck.current.position.set(NECK[0], NECK[1] + peck * 0.035, NECK[2] + peck * 0.02)
    neck.current.rotation.set(
      0.06 * Math.sin(t * 0.7) - peck * 0.22 - chirp * 0.12 + preen * 0.55 + nib,
      (0.38 * Math.sin(t * 0.33) + 0.12 * Math.sin(t * 0.9)) * (1 - preen) + preen * 1.25,
      0.2 * Math.sin(t * 0.52 + 1) * (1 - preen) + preen * 0.25,
    )
    jaw.current.rotation.x = chirp * (0.3 + 0.3 * Math.sin(s * 30))
    // a blink now and then, off the beat of the screenshot
    const lid = (t + 0.6) % 4.3 < 0.13 ? 0.12 : 1
    eyes.current.forEach((e) => e && (e.scale.y = 0.042 * lid))
    // wings: tucked, the right one shrugs out when preened, both lift on a chirp
    wings.current.forEach((w, i) => {
      if (!w) return
      const x = i ? 1 : -1
      const up = chirp * (0.75 + 0.2 * Math.sin(s * 34)) + (x > 0 ? preen * 0.22 : 0)
      w.rotation.set(0.34 - up * 0.25, 0, x * (-0.04 + up))
    })
    tail.current.rotation.x = 0.8 + Math.sin(t * 2.2 - 0.8) * 0.03 + chirp * 0.1
    tail.current.rotation.y = Math.sin(t * 0.6) * 0.05
  })

  const FOOT_X = 0.085
  const theta0 = -0.35 // front toes reach from the top down the front

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
      rotation-y={-0.35}
    >
      {/* the forked perch, flaring into a little mound of roots on the ground */}
      <Clay geometry={geo.limb} color={WOOD.bark} roughness={0.78} />
      <Clay geometry={geo.twig} color={WOOD.bark} roughness={0.78} />
      <Clay geometry={geo.ball} color={WOOD.bark} roughness={0.78} position={[-0.44, 0, 0.02]} scale={[0.17, 0.08, 0.17]} />
      <Clay geometry={geo.ball} color={WOOD.end} roughness={0.7} position={LIMB.getPointAt(1).toArray()} scale={LIMB_R(1) * 1.0} />
      <Clay geometry={geo.ball} color={WOOD.end} roughness={0.7} position={TWIG.getPointAt(1).toArray()} scale={TWIG_R(1) * 1.0} />
      <group position={TWIG.getPointAt(1).toArray()} rotation={[0.3, 0.4, -0.9]}>
        <Clay geometry={geo.ball} color={WOOD.leaf} position-y={0.1} scale={[0.06, 0.12, 0.02]} />
      </group>
      <group position={TWIG.getPointAt(0.78).toArray()} rotation={[-0.2, -0.5, 0.95]}>
        <Clay geometry={geo.ball} color={WOOD.leaf} position-y={0.08} scale={[0.05, 0.1, 0.018]} />
      </group>

      {/* feet: two toes over the front of the branch and two round the back */}
      {[-1, 1].map((x) => (
        <group key={x} position={[x * FOOT_X, PERCH.y, 0]}>
          {[-0.022, 0.022].map((dx) => (
            <group key={dx} position-x={dx} rotation-y={-Math.PI / 2}>
              <mesh geometry={geo.toe} rotation-z={theta0} castShadow receiveShadow>
                <meshStandardMaterial color={K.feet} roughness={0.6} />
              </mesh>
              <mesh geometry={geo.toe} rotation-z={Math.PI / 2 + 0.25} castShadow receiveShadow>
                <meshStandardMaterial color={K.feet} roughness={0.6} />
              </mesh>
              {[theta0, Math.PI / 2 + 0.25 + 1.95].map((a) => (
                <Clay key={a} geometry={geo.ball} color={K.feet} roughness={0.6} position={[Math.cos(a) * geo.toeRing, Math.sin(a) * geo.toeRing, 0]} scale={geo.toeR} />
              ))}
            </group>
          ))}
          <Clay geometry={geo.ball} color={K.feet} roughness={0.6} position-y={PERCH.r + 0.012} scale={[0.05, 0.03, 0.05]} />
          <Clay geometry={geo.leg} color={K.feet} roughness={0.6} position-y={PERCH.r} />
        </group>
      ))}

      <group ref={bird} position-y={PERCH.top}>
        {/* body */}
        <group ref={chest}>
          <mesh geometry={body} castShadow receiveShadow>
            <meshStandardMaterial vertexColors roughness={0.6} metalness={0} />
          </mesh>
        </group>

        {/* tail: long layered feathers, the darkest in the middle */}
        <group ref={tail} position={[0, 0.17, -0.2]} rotation-x={0.8}>
          <Clay geometry={geo.ball} color={K.tail} position={[0, -0.4, 0]} scale={[0.05, 0.42, 0.022]} />
          {[-1, 1].map((x) => (
            <Clay key={x} geometry={geo.ball} color={K.wing[1]} position={[x * 0.04, -0.3, 0.012]} rotation-z={x * 0.12} scale={[0.045, 0.31, 0.02]} />
          ))}
          <Clay geometry={geo.ball} color={K.wing[2]} position={[0, -0.12, 0.03]} scale={[0.075, 0.16, 0.035]} />
        </group>

        {/* wings */}
        {[-1, 1].map((x, i) => (
          <group key={x} ref={(el) => (wings.current[i] = el)} position={[x * 0.25, 0.72, 0.03]}>
            <Wing geo={geo} K={K} side={x} />
          </group>
        ))}

        {/* head: the face, cere, beak, cheek spots and bead eyes */}
        <group ref={neck} position={NECK}>
          <mesh geometry={head} castShadow receiveShadow>
            <meshStandardMaterial vertexColors roughness={0.6} metalness={0} />
          </mesh>
          <OnHead yaw={0} pitch={-0.32} r={0.245}>
            <Clay geometry={geo.beak} color={K.beak} roughness={0.42} position={[0, 0, -0.01]} rotation-x={-0.12} />
            <group ref={jaw} position={[0, -0.03, -0.035]}>
              <Clay geometry={geo.ball} color={K.beak} roughness={0.45} position={[0, -0.012, 0.012]} scale={[0.03, 0.02, 0.028]} />
            </group>
          </OnHead>
          <OnHead yaw={0} pitch={0.02} r={0.248}>
            <Clay geometry={geo.ball} color={K.cere} roughness={0.5} scale={[0.058, 0.03, 0.032]} />
          </OnHead>
          {[-1, 1].map((x) => (
            <OnHead key={x} yaw={x * 0.6} pitch={-0.42} r={0.236}>
              <mesh geometry={geo.ball} scale={[0.046, 0.04, 0.014]}>
                <meshStandardMaterial color={K.cheek} roughness={0.6} />
              </mesh>
            </OnHead>
          ))}
          {[-1, 1].map((x, i) => (
            <OnHead key={x} yaw={x * 0.92} pitch={0.16} r={0.232}>
              <mesh ref={(el) => (eyes.current[i] = el)} geometry={geo.ball} scale={[0.042, 0.042, 0.03]}>
                <meshStandardMaterial color={K.eye} roughness={0.12} />
              </mesh>
              <mesh geometry={geo.ball} position={[0.012, 0.014, 0.026]} scale={0.009}>
                <meshStandardMaterial color="#ffffff" roughness={0.2} />
              </mesh>
            </OnHead>
          ))}
        </group>
      </group>
    </group>
  )
}

// The budgie springs in from nothing, overshoots a touch and settles.
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

export default function BudgieScene({ background = '#f6f4ef', autoRotate = true, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [3.7, 1.75, 3.9], fov: 30, near: 0.05, far: 60 }} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1 }}>
        <color attach="background" args={[background]} />
        <hemisphereLight args={['#ffffff', '#e6e8ee', 1.6]} />
        <directionalLight position={[3, 6, 5]} intensity={1.9} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.03} shadow-radius={5}>
          <orthographicCamera attach="shadow-camera" args={[-2, 2, 2.6, -0.6, 0.5, 16]} />
        </directionalLight>
        <directionalLight position={[-5, 3, -4]} intensity={0.9} color="#fff4e4" />
        <PopIn>
          <Budgie {...props} />
        </PopIn>
        <ContactShadows position={[0, 0, 0]} opacity={0.34} scale={6} blur={2.6} far={2.4} resolution={512} color="#2a2a30" />
        <OrbitControls makeDefault enablePan={false} target={[0, 0.92, -0.05]} autoRotate={autoRotate} autoRotateSpeed={0.7} minDistance={3} maxDistance={14} maxPolarAngle={1.5} />
      </Canvas>
      <InfoHint>It bobs, tilts its head, blinks and now and then preens on its own · tap it and it chirps with quick head bobs and lifted wings · Kind swaps green, blue, yellow and white · drag to orbit</InfoHint>
    </div>
  )
}

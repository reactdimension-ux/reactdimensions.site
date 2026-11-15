import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls, useCursor } from '@react-three/drei'
import * as THREE from 'three'

// A clay-toy fox: a round head with a long pointed snout, a black nose and a
// white underside, tall triangular ears, a white chest bib, capsule legs in
// dark socks and a big upswept tail with a white tip. It breathes, cocks its
// head, blinks, flicks its ears and waves its tail. Tap it and it pounces: a
// crouch, a leap forward and a bouncy landing, then it trots back.
// It faces +z and stands on y = 0.

const TAU = Math.PI * 2

const KINDS = {
  red: { fur: '#e9773d', white: '#fcf4e8', sock: '#3b2b27', inner: '#f8dcc8', nose: '#1d1617', eye: '#1d1617' },
  arctic: { fur: '#e4e8ef', white: '#ffffff', sock: '#c9cfdb', inner: '#f4d0d8', nose: '#2b2b35', eye: '#22222b' },
  silver: { fur: '#8e909e', white: '#f3f2f5', sock: '#2f2e36', inner: '#dccbd2', nose: '#1b1a20', eye: '#1b1a20' },
  cream: { fur: '#f1c58c', white: '#fff8ed', sock: '#b5845c', inner: '#fbe2cd', nose: '#3a2a22', eye: '#2a201b' },
}

const BODY = { pos: [0, 0.64, -0.05], scale: [0.34, 0.33, 0.56] }
const NECK = [0, 0.9, 0.3] // the head turns about this point, inside the body
const HIP_Y = 0.64 // legs hang from the body's centre height, buried inside it
const LEGS = [
  [-0.17, 0.24, 1],
  [0.17, 0.24, 1],
  [-0.17, -0.34, -1],
  [0.17, -0.34, -1],
]

const smooth = (a, b, x) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return k * k * (3 - 2 * k)
}

// Paint a geometry in two colours, blending by weight w(x, y, z) in 0..1.
function paint(g, a, b, w) {
  const p = g.attributes.position
  const A = new THREE.Color(a)
  const B = new THREE.Color(b)
  const c = new THREE.Color()
  const col = new Float32Array(p.count * 3)
  for (let i = 0; i < p.count; i++) {
    c.copy(A).lerp(B, w(p.getX(i), p.getY(i), p.getZ(i)))
    col.set([c.r, c.g, c.b], i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}

// ---- the tail: a fat tapering tube along a curve in the y-z plane ----

const T0 = new THREE.Vector3(0, 0, 0)
const T1 = new THREE.Vector3(0, -0.06, -0.42)
const T2 = new THREE.Vector3(0, 0.34, -0.78)
const T3 = new THREE.Vector3(0, 0.76, -0.64)
const tailAt = (u) => {
  const k = 1 - u
  return new THREE.Vector3(0, k * k * k * T0.y + 3 * k * k * u * T1.y + 3 * k * u * u * T2.y + u * u * u * T3.y, k * k * k * T0.z + 3 * k * k * u * T1.z + 3 * k * u * u * T2.z + u * u * u * T3.z)
}
const tailTan = (u) => {
  const k = 1 - u
  const d = (a, b, c, e) => 3 * k * k * (b - a) + 6 * k * u * (c - b) + 3 * u * u * (e - c)
  return new THREE.Vector3(0, d(T0.y, T1.y, T2.y, T3.y), d(T0.z, T1.z, T2.z, T3.z)).normalize()
}
// slim at the root, a big bushy brush, a rounded point
const tailR = (u) => 0.17 * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.75)), 0.55)

function tailGeometry(rings = 48, sides = 36) {
  const pos = []
  const idx = []
  const us = []
  for (let i = 0; i <= rings; i++) {
    const u = i / rings
    const P = tailAt(u)
    const T = tailTan(u)
    const r = tailR(u)
    for (let j = 0; j < sides; j++) {
      const a = (j / sides) * TAU
      pos.push(P.x + Math.cos(a) * r, P.y + Math.sin(a) * T.z * r, P.z - Math.sin(a) * T.y * r)
      us.push(u)
    }
  }
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < sides; j++) {
      const a = i * sides + j
      const b = i * sides + ((j + 1) % sides)
      idx.push(a, b, a + sides, b, b + sides, a + sides)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  g.userData.u = us
  return g
}

function useFoxGeometry(K) {
  const geo = useMemo(() => {
    const ball = new THREE.SphereGeometry(1, 48, 32)
    // a capsule leg hanging from the hip: rounded foot, straight shin
    const leg = new THREE.LatheGeometry(
      [
        [0.001, 0],
        [0.045, 0.004],
        [0.07, 0.02],
        [0.084, 0.05],
        [0.088, 0.09],
        [0.083, 0.3],
        [0.08, HIP_Y],
      ].map(([r, y]) => new THREE.Vector2(r, y)),
      28,
    ).translate(0, -HIP_Y, 0)
    paint(leg, K.sock, K.fur, (x, y) => smooth(-HIP_Y + 0.17, -HIP_Y + 0.27, y))
    // a long pointed snout along +z, white underneath
    const snout = new THREE.LatheGeometry(
      [
        [0.001, -0.08],
        [0.1, -0.06],
        [0.145, 0],
        [0.135, 0.09],
        [0.105, 0.2],
        [0.07, 0.31],
        [0.04, 0.39],
        [0.02, 0.42],
        [0.001, 0.43],
      ].map(([r, y]) => new THREE.Vector2(r, y)),
      32,
    )
      .rotateX(Math.PI / 2)
      .scale(1, 0.78, 1)
    paint(snout, K.fur, K.white, (x, y) => smooth(0.0, -0.035, y))
    // a tall ear: a flattened cone with a soft tip
    const ear = new THREE.LatheGeometry(
      [
        [0.001, -0.04],
        [0.115, -0.02],
        [0.112, 0.05],
        [0.08, 0.15],
        [0.04, 0.24],
        [0.012, 0.285],
        [0.001, 0.29],
      ].map(([r, y]) => new THREE.Vector2(r, y)),
      28,
    )
    const tail = tailGeometry()
    const us = tail.userData.u
    let n = 0
    paint(tail, K.fur, K.white, () => smooth(0.8, 0.86, us[n++]))
    return { ball, leg, snout, ear, tail }
  }, [K])
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])
  return geo
}

// One piece of clay: a soft, matt material that casts and takes shadow.
function Clay({ color, roughness = 0.64, painted = false, ...props }) {
  return (
    <mesh castShadow receiveShadow {...props}>
      <meshStandardMaterial color={painted ? '#ffffff' : color} vertexColors={painted} roughness={roughness} metalness={0} />
    </mesh>
  )
}

export function Fox({ kind = 'red' }) {
  const K = KINDS[kind] || KINDS.red
  const geo = useFoxGeometry(K)
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const tapAt = useRef(-99)
  const now = useRef(0)
  const hopper = useRef()
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
    // the pounce: crouch low, leap forward, bounce on landing, trot back
    let y = 0
    let z = 0
    let k = 0
    let air = 0
    let pitch = 0
    let crouch = 0
    const LEAP = 0.62
    if (s >= 0 && s < 0.34) {
      crouch = Math.sin((s / 0.34) * Math.PI * 0.5)
      k = 0.17 * crouch
      pitch = 0.1 * crouch
    } else if (s >= 0.34 && s < 0.86) {
      const q = (s - 0.34) / 0.52
      y = 4 * q * (1 - q) * 0.36
      z = LEAP * (q * q * (3 - 2 * q))
      k = q < 0.5 ? -0.1 * (1 - q * 2) : -0.03
      air = Math.sin(q * Math.PI)
      pitch = -0.28 * Math.cos(q * Math.PI)
    } else if (s >= 0.86 && s < 1.8) {
      const q = s - 0.86
      z = LEAP
      k = 0.2 * Math.exp(-5.5 * q) * Math.cos(q * 13)
      pitch = 0.28 * Math.exp(-6 * q) * Math.cos(q * 9)
    } else if (s >= 1.8 && s < 2.9) {
      const q = (s - 1.8) / 1.1
      z = LEAP * (1 - q * q * (3 - 2 * q))
      y = Math.abs(Math.sin(q * Math.PI * 4)) * 0.04 * Math.sin(q * Math.PI)
    }
    hopper.current.position.set(0, y, z)
    hopper.current.rotation.x = pitch
    squish.current.scale.set(1 + k * 0.5, 1 - k, 1 + k * 0.5)
    // legs reach out in the leap and tuck in the crouch
    legs.current.forEach((l, i) => l && (l.rotation.x = -LEGS[i][2] * (air * 0.6 - crouch * 0.15)))
    // a quick, light breath
    const b = 1 + Math.sin(t * 2.1) * 0.016
    chest.current.scale.set(BODY.scale[0] * b, BODY.scale[1] * b, BODY.scale[2])
    // the head looks about and now and then cocks to one side, curious
    const cock = Math.pow(Math.max(0, Math.sin(t * 0.55)), 4) - Math.pow(Math.max(0, Math.sin(t * 0.55 + 2.4)), 4) * 0.7
    head.current.rotation.set(0.04 * Math.sin(t * 2.1 + 0.6) + 0.05 * Math.sin(t * 0.43) - air * 0.2 + crouch * 0.15, 0.22 * Math.sin(t * 0.33) + 0.08 * Math.sin(t * 0.91), cock * 0.34)
    // ears: quick flicks on their own beats, pressed back in the air
    ears.current.forEach((e, i) => {
      if (!e) return
      const ph = (t * 0.29 + i * 0.43) % 1
      const flick = ph < 0.08 ? Math.sin((ph / 0.08) * Math.PI * 2) * 0.32 : 0
      e.rotation.z = (i ? -1 : 1) * (0.3 + flick + air * 0.2)
      e.rotation.x = -air * 0.5 - Math.abs(flick) * 0.3
    })
    // a blink now and then
    const lid = (t + 2) % 3.6 < 0.13 ? 0.12 : 1
    eyes.current.forEach((e) => e && (e.scale.y = 0.05 * lid))
    // the tail waves slowly, and streams out behind in the leap
    tail.current.rotation.y = Math.sin(t * 1.6) * 0.32
    tail.current.rotation.z = Math.sin(t * 1.6 - 0.8) * 0.08
    tail.current.rotation.x = Math.sin(t * 0.9) * 0.05 + air * 0.4 - crouch * 0.15
  })

  return (
    <group
      scale={1.08}
      onClick={(e) => {
        e.stopPropagation()
        if (now.current - tapAt.current > 2.9) tapAt.current = now.current
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHover(true)
      }}
      onPointerOut={() => setHover(false)}
    >
      <group ref={hopper}>
        <group ref={squish}>
          {/* legs, hung from the body's middle, with soft hip blends */}
          {LEGS.map(([x, z], i) => (
            <group key={i} ref={(el) => (legs.current[i] = el)} position={[x, HIP_Y, z]}>
              <Clay geometry={geo.leg} painted />
            </group>
          ))}
          {LEGS.map(([x, z], i) => (
            <Clay key={i} geometry={geo.ball} color={K.fur} position={[x * 0.95, 0.5, z]} scale={[0.1, 0.12, 0.105]} />
          ))}

          {/* body and chest bib */}
          <group ref={chest} position={BODY.pos} scale={BODY.scale}>
            <Clay geometry={geo.ball} color={K.fur} />
          </group>
          <Clay geometry={geo.ball} color={K.white} position={[0, 0.74, 0.35]} scale={[0.2, 0.28, 0.18]} />

          {/* tail */}
          <group ref={tail} position={[0, 0.72, -0.44]}>
            <Clay geometry={geo.tail} painted />
          </group>

          {/* head: neck, skull, snout, nose, cheeks, eyes and ears */}
          <group ref={head} position={NECK}>
            <Clay geometry={geo.ball} color={K.fur} position={[0, 0.06, 0.06]} scale={[0.2, 0.24, 0.2]} />
            <Clay geometry={geo.ball} color={K.white} position={[0, 0.0, 0.15]} scale={[0.15, 0.23, 0.14]} />
            <group position={[0, 0.24, 0.17]}>
              <Clay geometry={geo.ball} color={K.fur} scale={[0.29, 0.26, 0.26]} />
              {[-1, 1].map((x) => (
                <Clay key={x} geometry={geo.ball} color={K.white} position={[x * 0.14, -0.12, 0.1]} scale={[0.11, 0.08, 0.12]} />
              ))}
              <Clay geometry={geo.snout} painted position={[0, -0.06, 0.13]} />
              <mesh geometry={geo.ball} position={[0, -0.05, 0.555]} scale={[0.05, 0.042, 0.042]}>
                <meshStandardMaterial color={K.nose} roughness={0.25} />
              </mesh>
              {[-1, 1].map((x, i) => (
                <mesh key={x} ref={(el) => (eyes.current[i] = el)} geometry={geo.ball} position={[x * 0.125, 0.06, 0.232]} scale={0.05}>
                  <meshStandardMaterial color={K.eye} roughness={0.12} />
                </mesh>
              ))}
              {[-1, 1].map((x, i) => (
                <group key={x} ref={(el) => (ears.current[i] = el)} position={[x * 0.15, 0.17, -0.02]} rotation-z={-x * 0.3}>
                  <Clay geometry={geo.ear} color={K.fur} scale={[1, 1, 0.45]} />
                  <Clay geometry={geo.ear} color={K.inner} position={[0, 0.0, 0.03]} scale={[0.68, 0.78, 0.3]} />
                </group>
              ))}
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}

// The fox springs in from nothing, overshoots a touch and settles.
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

export default function FoxScene({ background = '#f6f4ef', autoRotate = true, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [4.5, 1.8, 4.2], fov: 30, near: 0.05, far: 60 }} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1 }}>
        <color attach="background" args={[background]} />
        <hemisphereLight args={['#ffffff', '#efe6dc', 1.6]} />
        <directionalLight position={[3, 6, 5]} intensity={1.9} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.03} shadow-radius={5}>
          <orthographicCamera attach="shadow-camera" args={[-2.4, 2.4, 2.6, -0.8, 0.5, 16]} />
        </directionalLight>
        <directionalLight position={[-5, 3, -4]} intensity={0.9} color="#fff0e0" />
        <PopIn>
          <Fox {...props} />
        </PopIn>
        <ContactShadows position={[0, 0, 0]} opacity={0.32} scale={8} blur={2.6} far={2.4} resolution={512} color="#3a2a20" />
        <OrbitControls makeDefault enablePan={false} target={[0, 0.75, 0.05]} autoRotate={autoRotate} autoRotateSpeed={0.7} minDistance={3} maxDistance={14} maxPolarAngle={1.5} />
      </Canvas>
      <InfoHint>It breathes, cocks its head, blinks, flicks its ears and waves its tail on its own · tap it and it pounces: a crouch, a leap forward and a bouncy landing · Kind swaps red, arctic, silver and cream · drag to orbit</InfoHint>
    </div>
  )
}

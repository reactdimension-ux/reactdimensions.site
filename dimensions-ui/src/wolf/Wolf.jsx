import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls, useCursor } from '@react-three/drei'
import * as THREE from 'three'

// A clay-toy wolf: an egg of a body on four straight slim legs with dark paw
// caps, a white chest bib, a round head with white cheeks, a tapered muzzle
// with a white tip and a bead nose, tall pointed ears and a thick upswept
// tail. It breathes, turns its head, blinks, swivels its ears and wags its
// tail. Tap it and it howls: the head tips up, the body stretches and the
// tail lifts.
// It faces +z and stands on y = 0.

const TAU = Math.PI * 2

const KINDS = {
  steel: { skin: '#8f9db3', white: '#f4f2ed', paw: '#3c4252', nose: '#24272f', inner: '#efcdd0', eye: '#1d1f26', tip: '#5e6b82' },
  timber: { skin: '#a88d70', white: '#f5ede1', paw: '#4b3b2d', nose: '#2b2219', inner: '#efc9ba', eye: '#22190f', tip: '#5e4837' },
  arctic: { skin: '#e3e8ef', white: '#ffffff', paw: '#97a3b6', nose: '#373c48', inner: '#f6d3d7', eye: '#1f222b', tip: '#bdc7d6' },
  black: { skin: '#41444d', white: '#cfd2d9', paw: '#1c1d22', nose: '#111114', inner: '#c0939b', eye: '#e0a93c', tip: '#26282e' },
}

const BODY = { pos: [0, 0.8, -0.05], scale: [0.36, 0.35, 0.64] }
const NECK = [0, 0.94, 0.38] // the head turns about this point, inside the body
const TAIL_ROOT = [0, 0.94, -0.58]
const LEG_TOP = 0.8 // legs run up to the body's middle, so their tops are buried

// ---- the tail: a thick tube along a curve, bushy in the middle, round at the tip ----

const TAIL = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0, 0.08, -0.2),
  new THREE.Vector3(0, 0.27, -0.34),
  new THREE.Vector3(0, 0.47, -0.34),
])
const tailR = (u) => (0.064 + 0.08 * Math.sin(Math.PI * Math.min(1, u * 1.05))) * Math.sqrt(Math.max(0, 1 - u ** 5))

function tailGeometry(skin, tip, rings = 40, sides = 28) {
  const pos = []
  const col = []
  const idx = []
  const X = new THREE.Vector3(1, 0, 0)
  const N = new THREE.Vector3()
  const cs = new THREE.Color(skin)
  const ct = new THREE.Color(tip)
  const c = new THREE.Color()
  for (let i = 0; i <= rings; i++) {
    const u = i / rings
    const P = TAIL.getPointAt(u)
    const T = TAIL.getTangentAt(u)
    N.crossVectors(T, X).normalize()
    const r = tailR(u)
    const m = THREE.MathUtils.smoothstep(u, 0.72, 0.86)
    c.copy(cs).lerp(ct, m)
    for (let j = 0; j < sides; j++) {
      const a = (j / sides) * TAU
      pos.push(P.x + r * Math.cos(a), P.y + r * Math.sin(a) * N.y, P.z + r * Math.sin(a) * N.z)
      col.push(c.r, c.g, c.b)
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
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

const lathe = (pts, seg = 32) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg)

function useWolfGeometry() {
  const geo = useMemo(
    () => ({
      ball: new THREE.SphereGeometry(1, 48, 32),
      // a straight slim leg, from the paw up into the body
      leg: new THREE.CylinderGeometry(0.074, 0.07, LEG_TOP - 0.06, 24, 1).translate(0, (LEG_TOP + 0.06) / 2, 0),
      // a dark rounded paw cap
      paw: lathe([
        [0.001, 0],
        [0.082, 0],
        [0.096, 0.016],
        [0.1, 0.05],
        [0.095, 0.092],
        [0.076, 0.126],
        [0.001, 0.138],
      ]),
      // the muzzle, tapering forward along +z: the grey bridge and the white tip
      muzzle: lathe([
        [0.001, -0.02],
        [0.135, -0.02],
        [0.134, 0.06],
        [0.122, 0.13],
        [0.104, 0.19],
        [0.001, 0.2],
      ]).rotateX(Math.PI / 2),
      snout: lathe([
        [0.001, 0.15],
        [0.112, 0.15],
        [0.098, 0.21],
        [0.08, 0.27],
        [0.062, 0.32],
        [0.034, 0.348],
        [0.001, 0.356],
      ]).rotateX(Math.PI / 2),
      ear: new THREE.ConeGeometry(0.1, 0.3, 24, 1).translate(0, 0.15, 0),
      earIn: new THREE.ConeGeometry(0.064, 0.21, 20, 1).translate(0, 0.105, 0),
    }),
    [],
  )
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])
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

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))

export function Wolf({ kind = 'steel' }) {
  const K = KINDS[kind] || KINDS.steel
  const geo = useWolfGeometry()
  const tailGeo = useMemo(() => tailGeometry(K.skin, K.tip), [K.skin, K.tip])
  useEffect(() => () => tailGeo.dispose(), [tailGeo])
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const tapAt = useRef(-99)
  const now = useRef(0)
  const stretch = useRef()
  const chest = useRef()
  const head = useRef()
  const jaw = useRef()
  const ears = useRef([])
  const eyes = useRef([])
  const tail = useRef()
  const wagger = useRef()

  useFrame(({ clock }) => {
    const t = (now.current = clock.elapsedTime)
    const s = t - tapAt.current
    // the howl: rises quickly, holds with a wavering note, then eases off
    const h = s < 0 ? 0 : smooth(s / 0.34) * (1 - smooth((s - 1.9) / 0.5))
    const quaver = h * Math.sin(s * 22) * 0.025
    // the body stretches tall and slim while it howls
    const k = h * 0.06
    stretch.current.scale.set(1 - k * 0.4, 1 + k, 1 - k * 0.25)
    // a slow breath in the chest
    const b = 1 + Math.sin(t * 1.7) * 0.014 + h * 0.03
    chest.current.scale.set(BODY.scale[0] * b, BODY.scale[1] * b, BODY.scale[2])
    // the head turns to look about, and tips right up to howl
    const idleX = 0.04 * Math.sin(t * 1.7 + 0.6) + 0.05 * Math.sin(t * 0.43)
    const idleY = 0.32 * Math.sin(t * 0.36) + 0.1 * Math.sin(t * 0.81)
    head.current.rotation.set(idleX * (1 - h) - h * 0.82 + quaver, idleY * (1 - h), 0.04 * Math.sin(t * 0.6) * (1 - h))
    jaw.current.rotation.x = h * (0.42 + Math.sin(s * 9) * 0.04)
    // ears swivel on their own beats and lie back for the howl
    ears.current.forEach((e, i) => {
      if (!e) return
      const x = i ? 1 : -1
      const ph = (t * 0.29 + i * 0.43) % 1
      const turn = ph < 0.22 ? Math.sin((ph / 0.22) * Math.PI) * 0.7 : 0
      const twitch = ((t * 0.53 + i * 0.3) % 1) < 0.06 ? 0.12 : 0
      e.rotation.set(-0.08 - h * 0.3 + twitch, x * turn * (1 - h), x * -(0.22 + h * 0.15))
    })
    // a blink now and then
    const lid = (t + 1.2) % 3.6 < 0.13 ? 0.12 : 1
    eyes.current.forEach((e) => e && (e.scale.y = 0.036 * lid * (1 - h * 0.55)))
    // the tail wags in happy bursts, and lifts high for the howl
    const wag = (t % 3.3 < 1.3 ? Math.sin(t * 13) * 0.4 : Math.sin(t * 1.8) * 0.08) * (1 - h * 0.7)
    wagger.current.rotation.z = wag
    tail.current.rotation.x = -0.12 + 0.04 * Math.sin(t * 1.7) + h * 0.55
  })

  return (
    <group
      onClick={(e) => {
        e.stopPropagation()
        // a fresh tap restarts the howl only once the last one is ending
        if (now.current - tapAt.current > 1.9) tapAt.current = now.current
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHover(true)
      }}
      onPointerOut={() => setHover(false)}
    >
      <group ref={stretch}>
        {/* legs, hip blends and paws */}
        {[
          [-0.16, 0.33],
          [0.16, 0.33],
          [-0.16, -0.38],
          [0.16, -0.38],
        ].map(([x, z]) => (
          <group key={`${x}${z}`} position={[x, 0, z]}>
            <Clay geometry={geo.leg} color={K.skin} />
            <Clay geometry={geo.ball} color={K.skin} position-y={0.64} scale={[0.1, 0.16, 0.12]} />
            <Clay geometry={geo.paw} color={K.paw} roughness={0.55} position-z={0.012} scale={[1, 1, 1.12]} />
          </group>
        ))}

        {/* body and chest bib */}
        <group ref={chest} position={BODY.pos} scale={BODY.scale}>
          <Clay geometry={geo.ball} color={K.skin} />
        </group>
        <Clay geometry={geo.ball} color={K.white} position={[0, 0.82, 0.47]} rotation-x={-0.3} scale={[0.19, 0.24, 0.14]} />

        {/* tail */}
        <group ref={tail} position={TAIL_ROOT}>
          <group ref={wagger}>
            <mesh geometry={tailGeo} castShadow receiveShadow>
              <meshStandardMaterial vertexColors roughness={0.66} metalness={0} />
            </mesh>
          </group>
        </group>

        {/* neck and head: skull, cheeks, muzzle, nose, jaw, eyes and ears */}
        <group ref={head} position={NECK}>
          <Clay geometry={geo.ball} color={K.skin} position={[0, 0.14, 0.06]} rotation-x={0.45} scale={[0.2, 0.27, 0.2]} />
          <Clay geometry={geo.ball} color={K.white} position={[0, 0.12, 0.17]} rotation-x={0.5} scale={[0.15, 0.22, 0.12]} />
          <Clay geometry={geo.ball} color={K.skin} position={[0, 0.34, 0.2]} scale={[0.26, 0.24, 0.25]} />
          {[-1, 1].map((x) => (
            <Clay key={x} geometry={geo.ball} color={K.white} position={[x * 0.125, 0.27, 0.26]} rotation={[0, x * 0.5, x * 0.4]} scale={[0.1, 0.085, 0.12]} />
          ))}
          <group position={[0, 0.3, 0.4]}>
            <Clay geometry={geo.muzzle} color={K.skin} />
            <Clay geometry={geo.snout} color={K.white} />
            <Clay geometry={geo.ball} color={K.nose} roughness={0.3} position={[0, 0.04, 0.34]} scale={[0.05, 0.04, 0.036]} />
            <group ref={jaw} position={[0, -0.06, 0.02]}>
              <Clay geometry={geo.ball} color={K.white} position={[0, -0.012, 0.15]} scale={[0.07, 0.04, 0.15]} />
            </group>
          </group>
          {[-1, 1].map((x, i) => (
            <mesh key={x} ref={(el) => (eyes.current[i] = el)} geometry={geo.ball} position={[x * 0.112, 0.4, 0.41]} scale={0.036}>
              <meshStandardMaterial color={K.eye} roughness={0.12} />
            </mesh>
          ))}
          {[-1, 1].map((x, i) => (
            <group key={x} ref={(el) => (ears.current[i] = el)} position={[x * 0.13, 0.5, 0.15]} rotation-z={-x * 0.22}>
              <Clay geometry={geo.ear} color={K.skin} scale={[1, 1, 0.55]} />
              <Clay geometry={geo.earIn} color={K.inner} position={[0, 0.02, 0.03]} scale={[1, 1, 0.4]} />
            </group>
          ))}
        </group>
      </group>
    </group>
  )
}

// The wolf springs in from nothing, overshoots a touch and settles.
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

export default function WolfScene({ background = '#f6f4ef', autoRotate = true, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [4.0, 1.7, 3.75], fov: 30, near: 0.05, far: 60 }} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1 }}>
        <color attach="background" args={[background]} />
        <hemisphereLight args={['#ffffff', '#e4e6ee', 1.6]} />
        <directionalLight position={[3, 6, 5]} intensity={1.9} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.03} shadow-radius={5}>
          <orthographicCamera attach="shadow-camera" args={[-2.2, 2.2, 2.6, -0.6, 0.5, 16]} />
        </directionalLight>
        <directionalLight position={[-5, 3, -4]} intensity={0.9} color="#e4e8ff" />
        <PopIn>
          <Wolf {...props} />
        </PopIn>
        <ContactShadows position={[0, 0, 0]} opacity={0.34} scale={8} blur={2.6} far={2.6} resolution={512} color="#2a2a40" />
        <OrbitControls makeDefault enablePan={false} target={[0, 0.84, 0.1]} autoRotate={autoRotate} autoRotateSpeed={0.7} minDistance={3} maxDistance={14} maxPolarAngle={1.5} />
      </Canvas>
      <InfoHint>It breathes, turns its head, blinks, swivels its ears and wags its tail on its own · tap it and it howls, head tipped up, body stretched and tail raised · Kind swaps steel, timber, arctic and black · drag to orbit</InfoHint>
    </div>
  )
}

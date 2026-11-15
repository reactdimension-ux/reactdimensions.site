import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls, useCursor } from '@react-three/drei'
import * as THREE from 'three'

// A clay-toy hamster standing up: a tall pear body with a cream belly, huge
// round cheek pouches, small cupped ears lined in pink, glossy eyes, a pink
// nose, stubby arms held in front and little pink feet. It breathes, twitches
// its nose, blinks and its cheeks puff. Tap it and it stuffs its cheeks: they
// swell up big and shrink back. It faces +z and stands on y = 0.

const TAU = Math.PI * 2

const KINDS = {
  golden: { fur: '#e3a464', belly: '#fdeed8', inner: '#f3aeac', nose: '#e9849a', pad: '#f3b3b4', blush: '#f29d94', eye: '#1d1410' },
  cream: { fur: '#f0d6ae', belly: '#fff6e8', inner: '#f2b3b6', nose: '#e98aa0', pad: '#f4b9bc', blush: '#f3a8a6', eye: '#231713' },
  grey: { fur: '#a19ea8', belly: '#eeedf1', inner: '#f0b5c0', nose: '#e2869c', pad: '#efb6c1', blush: '#f0a3b3', eye: '#1b191f' },
  white: { fur: '#f6f2ec', belly: '#ffffff', inner: '#f5b0bd', nose: '#ee8199', pad: '#f6b6c3', blush: '#f5a5b7', eye: '#4a1622' },
}

const BODY = { y: 0.6, scale: [0.5, 0.6, 0.46] }
const NECK = [0, 1.02, 0.02] // the head nods about this point, inside the body
const HEAD = { pos: [0, 0.17, 0.04], scale: [0.4, 0.36, 0.37] }
const CHEEK = { pos: [0.235, -0.1, 0.07], scale: [0.27, 0.25, 0.25] }

const UP = new THREE.Vector3(0, 1, 0)
const toward = (x, y, z) => new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(x, y, z).normalize())
const smooth = (k) => k * k * (3 - 2 * k)

// A soft disc that lies on a unit sphere round its +y pole: the rim is sunk
// just under the surface and the middle stands a little proud.
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

// A unit ball of clay with a paler patch painted into it as a soft-edged
// vertex colour (no rim), optionally tapered into a pear (wider at the base).
function paintedGeometry(fur, pale, dir, angle, soft, taper = 0) {
  const g = new THREE.SphereGeometry(1, 72, 48)
  const p = g.attributes.position
  const col = new Float32Array(p.count * 3)
  const v = new THREE.Vector3()
  const d = dir.clone().normalize()
  const a0 = new THREE.Color(fur)
  const a1 = new THREE.Color(pale)
  const c = new THREE.Color()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    const a = Math.acos(Math.min(1, v.dot(d)))
    const k = Math.min(1, Math.max(0, (angle - a) / soft))
    c.copy(a0).lerp(a1, smooth(k)).toArray(col, i * 3)
    if (taper) {
      const m = 1 - taper * v.y
      p.setXYZ(i, v.x * m, v.y, v.z * m)
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

function useHamsterGeometry(K) {
  const geo = useMemo(
    () => ({
      ball: new THREE.SphereGeometry(1, 56, 36),
      lining: capGeometry(0.85, 0.2),
      blush: capGeometry(0.28, 0.03),
      toe: capGeometry(0.3, 0.1),
      mouth: new THREE.TorusGeometry(0.022, 0.007, 8, 20, Math.PI).rotateZ(Math.PI),
    }),
    [],
  )
  const painted = useMemo(
    () => ({
      body: paintedGeometry(K.fur, K.belly, new THREE.Vector3(0, -0.1, 1), 0.92, 0.14, 0.17),
      head: paintedGeometry(K.fur, K.belly, new THREE.Vector3(0, -0.6, 1), 0.64, 0.16, 0.14),
      cheekL: paintedGeometry(K.fur, K.belly, new THREE.Vector3(-0.25, -0.9, 0.7), 0.95, 0.25),
      cheekR: paintedGeometry(K.fur, K.belly, new THREE.Vector3(0.25, -0.9, 0.7), 0.95, 0.25),
    }),
    [K],
  )
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])
  useEffect(() => () => Object.values(painted).forEach((g) => g.dispose()), [painted])
  return { ...geo, ...painted }
}

const LINING = toward(0, 0.1, 1)
const BLUSH = toward(0, -0.15, 1)
const TOES = [toward(-0.5, 0.25, 0.83), toward(0, 0.3, 0.95), toward(0.5, 0.25, 0.83)]

// One piece of clay: a soft, matt material that casts and takes shadow.
function Clay({ color, roughness = 0.64, children, ...props }) {
  return (
    <mesh castShadow receiveShadow {...props}>
      <meshStandardMaterial color={color} roughness={roughness} metalness={0} />
      {children}
    </mesh>
  )
}

function PaintedClay({ geometry, ...props }) {
  return (
    <mesh geometry={geometry} castShadow receiveShadow {...props}>
      <meshStandardMaterial vertexColors roughness={0.64} metalness={0} />
    </mesh>
  )
}

export function Hamster({ kind = 'golden' }) {
  const K = KINDS[kind] || KINDS.golden
  const geo = useHamsterGeometry(K)
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const tapAt = useRef(-99)
  const now = useRef(0)
  const squish = useRef()
  const chest = useRef()
  const head = useRef()
  const nose = useRef()
  const cheeks = useRef([])
  const ears = useRef([])
  const eyes = useRef([])
  const arms = useRef([])

  useFrame(({ clock }) => {
    const t = (now.current = clock.elapsedTime)
    const s = t - tapAt.current
    // stuffing: the pouches swell quickly, wobble while full, then ease back
    let stuff = 0
    if (s >= 0 && s < 0.35) stuff = smooth(s / 0.35)
    else if (s >= 0.35 && s < 1.5) stuff = 1 + 0.06 * Math.sin((s - 0.35) * 14) * Math.exp(-2 * (s - 0.35))
    else if (s >= 1.5 && s < 2.6) stuff = 1 - smooth((s - 1.5) / 1.1)
    const busy = s >= 0 && s < 1.5 ? Math.sin(Math.min(1, s / 0.2) * Math.PI * 0.5) : 0
    // a soft breath, and a little hop of the whole body as the cheeks fill
    const b = 1 + Math.sin(t * 1.9) * 0.016
    chest.current.scale.set(BODY.scale[0] * b, BODY.scale[1] * b, BODY.scale[2] * b)
    const k = s >= 0 && s < 1.2 ? 0.05 * Math.exp(-4 * s) * Math.sin(s * 18) : 0
    squish.current.scale.set(1 + k * 0.5, 1 - k, 1 + k * 0.5)
    // the head looks about, and tips up proudly while stuffing
    head.current.rotation.set(0.03 * Math.sin(t * 1.9 + 0.5) + 0.03 * Math.sin(t * 0.5) - stuff * 0.08, 0.2 * Math.sin(t * 0.31) + 0.06 * Math.sin(t * 0.83), 0.06 * Math.sin(t * 0.43))
    // the nose twitches in little bursts
    const sniff = t % 2.4 < 0.6 || busy > 0 ? Math.sin(t * 42) : 0
    nose.current.position.y = sniff * 0.005
    nose.current.scale.set(1 + sniff * 0.1, 1 - sniff * 0.08, 1)
    // cheeks: a gentle idle puff, and a big swell on a tap (scaled, so smooth)
    const ph = t % 3.7
    const puff = ph < 0.6 ? Math.sin((ph / 0.6) * Math.PI) * 0.07 : 0
    const c = 1 + puff + Math.sin(t * 1.9) * 0.012 + stuff * 0.28
    cheeks.current.forEach((g) => g && g.scale.set(c, c * (1 - stuff * 0.06), c))
    // a blink now and then (kept clear of the first few seconds)
    const lid = (t + 0.4) % 4.4 < 0.13 ? 0.12 : 1
    eyes.current.forEach((e) => e && (e.scale.y = lid))
    // ears give a small flick, and perk back while stuffing
    ears.current.forEach((e, i) => {
      if (!e) return
      const x = i ? 1 : -1
      const flick = (t + i * 1.3) % 3.1 < 0.25 ? Math.sin(((t + i * 1.3) % 3.1) * 25) * 0.15 : 0
      e.rotation.z = -x * (0.45 + flick + stuff * 0.12)
    })
    // the arms rest on the tummy and paw quickly at the mouth while stuffing
    arms.current.forEach((a, i) => {
      if (!a) return
      const x = i ? 1 : -1
      a.rotation.x = -0.15 - busy * (0.55 + 0.18 * Math.sin(s * 22 + i * Math.PI)) + Math.sin(t * 1.9 + i) * 0.03
      a.rotation.z = x * (0.15 + busy * 0.08)
    })
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
        {/* the tall pear body with its cream belly painted into the clay */}
        <group ref={chest} position-y={BODY.y} scale={BODY.scale}>
          <PaintedClay geometry={geo.body} />
        </group>

        {/* little pink feet, heels buried under the body, toes peeking out */}
        {[-1, 1].map((x) => (
          <group key={x} position={[x * 0.17, 0.055, 0.28]} rotation-y={x * 0.25}>
            <group scale={[0.1, 0.06, 0.14]}>
              <Clay geometry={geo.ball} color={K.pad} />
            </group>
          </group>
        ))}

        {/* a tiny tail nub */}
        <Clay geometry={geo.ball} color={K.fur} position={[0, 0.2, -0.47]} scale={[0.07, 0.06, 0.06]} />

        {/* stubby arms held in front, with pink paws */}
        {[-1, 1].map((x, i) => (
          <group key={x} ref={(el) => (arms.current[i] = el)} position={[x * 0.15, 0.97, 0.27]}>
            <Clay geometry={geo.ball} color={K.fur} position={[x * -0.01, -0.1, 0.05]} rotation={[-0.45, 0, x * 0.15]} scale={[0.075, 0.13, 0.08]} />
            <Clay geometry={geo.ball} color={K.pad} position={[x * -0.025, -0.2, 0.12]} scale={[0.05, 0.042, 0.045]} />
          </group>
        ))}

        {/* head: skull with a cream muzzle, pouches, ears, eyes and nose */}
        <group ref={head} position={NECK}>
          <group position={HEAD.pos}>
            <group scale={HEAD.scale}>
              <PaintedClay geometry={geo.head} />
            </group>

            {/* huge cheek pouches, centred inside the skull so they swell smoothly */}
            {[-1, 1].map((x, i) => (
              <group key={x} ref={(el) => (cheeks.current[i] = el)} position={[x * CHEEK.pos[0], CHEEK.pos[1], CHEEK.pos[2]]}>
                <group scale={CHEEK.scale}>
                  <PaintedClay geometry={i ? geo.cheekR : geo.cheekL} />
                  <mesh geometry={geo.blush} quaternion={toward(x * 0.55, 0.05, 0.83)}>
                    <meshStandardMaterial color={K.blush} roughness={0.8} />
                  </mesh>
                </group>
              </group>
            ))}

            {/* glossy eyes with a glint */}
            {[-1, 1].map((x, i) => (
              <group key={x} ref={(el) => (eyes.current[i] = el)} position={[x * 0.145, 0.1, 0.3]}>
                <mesh geometry={geo.ball} scale={0.058}>
                  <meshStandardMaterial color={K.eye} roughness={0.08} />
                </mesh>
                <mesh geometry={geo.ball} position={[x * -0.016, 0.02, 0.05]} scale={0.015}>
                  <meshStandardMaterial color="#ffffff" roughness={0.2} />
                </mesh>
              </group>
            ))}

            {/* pink nose and a little mouth */}
            <group ref={nose} position={[0, -0.035, 0.382]}>
              <Clay geometry={geo.ball} color={K.nose} rotation-x={-0.3} scale={[0.04, 0.03, 0.028]} roughness={0.45} />
            </group>
            <mesh geometry={geo.mouth} position={[0, -0.09, 0.372]} rotation-x={-0.4}>
              <meshStandardMaterial color={K.eye} roughness={0.5} />
            </mesh>

            {/* small cupped ears, rooted in the skull, lined in pink */}
            {[-1, 1].map((x, i) => (
              <group key={x} ref={(el) => (ears.current[i] = el)} position={[x * 0.2, 0.25, -0.04]} rotation-z={-x * 0.45}>
                <group position-y={0.06} rotation-y={x * 0.3} scale={[0.1, 0.1, 0.045]}>
                  <Clay geometry={geo.ball} color={K.fur} />
                  <Clay geometry={geo.lining} color={K.inner} quaternion={LINING} />
                </group>
              </group>
            ))}
          </group>
        </group>
      </group>
    </group>
  )
}

// The hamster springs in from nothing, overshoots a touch and settles.
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

export default function HamsterScene({ background = '#f6f4ef', autoRotate = true, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [3.94, 2.16, 3.95], fov: 30, near: 0.05, far: 60 }} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1 }}>
        <color attach="background" args={[background]} />
        <hemisphereLight args={['#ffffff', '#ece2d4', 1.4]} />
        <directionalLight position={[3, 6, 5]} intensity={1.8} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.03} shadow-radius={5}>
          <orthographicCamera attach="shadow-camera" args={[-2, 2, 3, -0.6, 0.5, 16]} />
        </directionalLight>
        <directionalLight position={[-5, 3, -4]} intensity={0.9} color="#e8e6ff" />
        <PopIn>
          <group scale={1.1}>
            <Hamster {...props} />
          </group>
        </PopIn>
        <ContactShadows position={[0, 0, 0]} opacity={0.42} scale={6} blur={2.4} far={2.4} resolution={512} color="#2e2838" />
        <OrbitControls makeDefault enablePan={false} target={[0, 0.9, 0.1]} autoRotate={autoRotate} autoRotateSpeed={0.7} minDistance={3} maxDistance={14} maxPolarAngle={1.5} />
      </Canvas>
      <InfoHint>It breathes, twitches its nose, blinks and puffs its cheeks on its own · tap it and it stuffs its cheeks till they swell up big, then shrink back · Kind swaps golden, cream, grey and white · drag to orbit</InfoHint>
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls, useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// A blocky toy polar bear in matt white: a big pillowy box of a body on four
// round stubby legs, a soft cube of a head set a little low on the front, a
// slate-grey block of a snout with a dark nose on top, two bead eyes, little
// open-loop ears and a tab of a tail. It breathes, looks around, blinks,
// twitches its ears, shifts its weight from paw to paw and wags its tail.
// Tap it and it does a chunky hop with a squashy landing and a head shake.
// It faces +z and stands on y = 0.

const KINDS = {
  polar: { fur: '#f4f4f2', snout: '#6c6c70', nose: '#38383b', eye: '#2a2a2d' },
  honey: { fur: '#e9c58d', snout: '#8b5d3d', nose: '#3a2a20', eye: '#2a201b' },
  mint: { fur: '#c4e6d4', snout: '#5f8e7b', nose: '#2f4a40', eye: '#22302b' },
  blush: { fur: '#f4c9d1', snout: '#a96c7a', nose: '#5a3540', eye: '#2e2226' },
}

// A box w×h×d centred on the origin. r: corner radius. edge: 'round' | 'chamfer' | 'sharp'.
// taper: [sx, sy] size of the +z end relative to the back. base: taper anchor (-1 bottom, 0 centre, 1 top).
function block(w, h, d, { r = 0.06, edge = 'round', taper = [1, 1], base = 0 } = {}) {
  const rad = Math.max(1e-4, Math.min(r, w / 2, h / 2, d / 2) - 1e-4)
  let g = edge === 'sharp' ? new THREE.BoxGeometry(w, h, d) : new RoundedBoxGeometry(w, h, d, edge === 'chamfer' ? 1 : 4, rad)
  const shaped = taper[0] !== 1 || taper[1] !== 1
  if (shaped) {
    const p = g.attributes.position
    const y0 = (base * h) / 2
    for (let i = 0; i < p.count; i++) {
      const t = (p.getZ(i) + d / 2) / d
      p.setXYZ(i, p.getX(i) * (1 + (taper[0] - 1) * t), y0 + (p.getY(i) - y0) * (1 + (taper[1] - 1) * t), p.getZ(i))
    }
  }
  if (edge !== 'round') {
    if (g.index) g = g.toNonIndexed()
    g.computeVertexNormals()
  } else if (shaped) {
    g.deleteAttribute('normal')
    g.deleteAttribute('uv')
    g = mergeVertices(g, 1e-5)
    g.computeVertexNormals()
  }
  return g
}

// A round leg of radius r and height h standing on y = 0, with a rounded sole.
function post(r, h, { round = 0.25, seg = 32 } = {}) {
  const e = r * round
  const pts = [[0.001, 0]]
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2)
    pts.push([r - e + Math.sin(a) * e, e - Math.cos(a) * e])
  }
  pts.push([r, h])
  return new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg)
}

const BODY = [0, 0.84, -0.08] // 0.92 × 0.84 × 1.3: underside at 0.42, top at 1.26, front at 0.57
const HIP_Y = 0.52 // legs reach 0.1 up inside the body
const LEGS = [
  [-0.255, 0.33],
  [0.255, 0.33],
  [-0.265, -0.48],
  [0.265, -0.48],
]
const NECK = [0, 0.8, 0.46] // the head turns about this point, inside the body
const TAIL = [0, 1.17, -0.66]

function useBearGeometry() {
  const geo = useMemo(
    () => ({
      body: block(0.92, 0.84, 1.3, { r: 0.17 }),
      leg: post(0.165, HIP_Y, { round: 0.4 }).translate(0, -HIP_Y, 0),
      head: block(0.76, 0.74, 0.56, { r: 0.16 }),
      snout: block(0.36, 0.27, 0.3, { r: 0.075, taper: [0.94, 0.9], base: -1 }),
      nose: block(0.22, 0.1, 0.17, { r: 0.04 }),
      eye: block(0.06, 0.08, 0.03, { r: 0.015 }),
      earBar: block(0.16, 0.05, 0.07, { r: 0.016 }),
      earPost: block(0.05, 0.14, 0.07, { r: 0.014 }),
      tail: block(0.26, 0.14, 0.27, { r: 0.045 }).translate(0, 0, -0.11),
    }),
    [],
  )
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])
  return geo
}

// One piece of the toy: a soft, fully matt material that casts and takes shadow.
function Matt({ color, roughness = 0.92, ...props }) {
  return (
    <mesh castShadow receiveShadow {...props}>
      <meshStandardMaterial color={color} roughness={roughness} metalness={0} />
    </mesh>
  )
}

export function PolarBear({ kind = 'polar' }) {
  const K = KINDS[kind] || KINDS.polar
  const geo = useBearGeometry()
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const tapAt = useRef(-99)
  const now = useRef(0)
  const hopper = useRef()
  const squish = useRef()
  const chest = useRef()
  const head = useRef()
  const hips = useRef([])
  const ears = useRef([])
  const eyes = useRef([])
  const tail = useRef()

  useFrame(({ clock }) => {
    const t = (now.current = clock.elapsedTime)
    const s = t - tapAt.current
    // the hop: a crouch, a short chunky jump, a wobbling landing
    let y = 0
    let k = 0
    let air = 0
    if (s >= 0 && s < 0.25) k = 0.13 * Math.sin((s / 0.25) * Math.PI * 0.5)
    else if (s >= 0.25 && s < 0.73) {
      const q = (s - 0.25) / 0.48
      y = 4 * q * (1 - q) * 0.3
      k = q < 0.5 ? -0.07 * (1 - q * 2) : -0.015
      air = Math.sin(q * Math.PI)
    } else if (s >= 0.73 && s < 1.6) k = 0.16 * Math.exp(-5.5 * (s - 0.73)) * Math.cos((s - 0.73) * 13)
    hopper.current.position.y = y
    squish.current.scale.set(1 + k * 0.45, 1 - k, 1 + k * 0.45)
    // a slow breath
    const b = 1 + Math.sin(t * 1.6) * 0.012
    chest.current.scale.set(b, b, 1)
    // the head looks around, nods with the breath and shakes after a tap
    const shake = s >= 0 && s < 2.2 ? Math.exp(-2.6 * s) * Math.sin(s * 13) : 0
    head.current.rotation.set(
      0.025 * Math.sin(t * 1.6 + 0.6) + 0.05 * Math.sin(t * 0.43) - air * 0.12,
      0.24 * Math.sin(t * 0.33) + 0.07 * Math.sin(t * 0.91),
      0.035 * Math.sin(t * 0.57) + shake * 0.18,
    )
    // weight shifts: now and then one paw lifts and sets down; in the air they all dangle
    hips.current.forEach((h, i) => {
      if (!h) return
      const ph = (t * 0.22 + [0, 0.5, 0.25, 0.75][i]) % 1
      const step = ph < 0.07 ? Math.sin((ph / 0.07) * Math.PI) : 0
      h.position.y = HIP_Y + step * 0.035
      h.rotation.x = (i < 2 ? -1 : 1) * (step * 0.12 + air * 0.22)
    })
    // ears twitch on their own beats
    ears.current.forEach((e, i) => {
      if (!e) return
      const ph = (t * 0.31 + i * 0.47) % 1
      const flick = ph < 0.1 ? Math.sin((ph / 0.1) * Math.PI * 2) : 0
      e.rotation.z = (i ? -1 : 1) * (flick * 0.3 + air * 0.25 + shake * 0.2)
      e.rotation.x = -flick * 0.15
    })
    // a blink now and then (phased so the first seconds have open eyes)
    const lid = (t + 2.8) % 4.3 < 0.13 ? 0.12 : 1
    eyes.current.forEach((e) => e && (e.scale.y = lid))
    // the tail wags in short bursts, harder after a tap
    const wag = t % 3.4 < 0.9 ? Math.sin(t * 15) * 0.32 : Math.sin(t * 2) * 0.05
    tail.current.rotation.y = wag + shake * 0.7
    tail.current.rotation.x = -air * 0.3
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
          {/* legs, each hung from its hip so it can lift */}
          {LEGS.map(([x, z], i) => (
            <group key={i} ref={(el) => (hips.current[i] = el)} position={[x, HIP_Y, z]}>
              <Matt geometry={geo.leg} color={K.fur} />
            </group>
          ))}

          {/* body (breathes about its own centre) */}
          <group ref={chest} position={BODY}>
            <Matt geometry={geo.body} color={K.fur} />
          </group>

          {/* tail: a tab on the top of the rump */}
          <group ref={tail} position={TAIL}>
            <Matt geometry={geo.tail} color={K.fur} />
          </group>

          {/* head: block, snout, nose, eyes and loop ears */}
          <group ref={head} position={NECK}>
            <Matt geometry={geo.head} color={K.fur} position={[0, 0.02, 0.24]} />
            <Matt geometry={geo.snout} color={K.snout} roughness={0.88} position={[0, -0.17, 0.56]} />
            <Matt geometry={geo.nose} color={K.nose} roughness={0.5} position={[0, -0.04, 0.665]} rotation-x={0.12} />
            {[-1, 1].map((x, i) => (
              <group key={x} ref={(el) => (eyes.current[i] = el)} position={[x * 0.2, 0.08, 0.537]}>
                <Matt geometry={geo.eye} color={K.eye} roughness={0.45} />
              </group>
            ))}
            {[-1, 1].map((x, i) => (
              <group key={x} ref={(el) => (ears.current[i] = el)} position={[x * 0.2, 0.37, 0.1]}>
                <Matt geometry={geo.earBar} color={K.fur} position-y={0.1} />
                <Matt geometry={geo.earPost} color={K.fur} position={[-0.055, 0.02, 0]} />
                <Matt geometry={geo.earPost} color={K.fur} position={[0.055, 0.02, 0]} />
              </group>
            ))}
          </group>
        </group>
      </group>
    </group>
  )
}

// The bear springs in from nothing, overshoots a touch and settles.
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

export default function PolarBearScene({ background = '#f6f4ef', autoRotate = true, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [-2.75, 2.45, 3.85], fov: 30, near: 0.05, far: 60 }} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1 }}>
        <color attach="background" args={[background]} />
        <hemisphereLight args={['#ffffff', '#ebeaf0', 2.1]} />
        <directionalLight position={[-3, 6, 5]} intensity={1.35} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.03} shadow-radius={6}>
          <orthographicCamera attach="shadow-camera" args={[-2, 2, 2.2, -0.6, 0.5, 16]} />
        </directionalLight>
        <directionalLight position={[5, 3, -4]} intensity={0.9} color="#e6e9f5" />
        <PopIn>
          <PolarBear {...props} />
        </PopIn>
        <ContactShadows position={[0, 0, 0]} opacity={0.32} scale={8} blur={2.8} far={2.4} resolution={512} color="#2a2a38" />
        <OrbitControls makeDefault enablePan={false} target={[0, 0.65, 0.1]} autoRotate={autoRotate} autoRotateSpeed={0.7} minDistance={3} maxDistance={14} maxPolarAngle={1.5} />
      </Canvas>
      <InfoHint>It breathes, looks around, blinks, twitches its ears, shifts its paws and wags its tail on its own · tap it and it does a chunky hop with a squashy landing · Kind swaps polar, honey, mint and blush · drag to orbit</InfoHint>
    </div>
  )
}

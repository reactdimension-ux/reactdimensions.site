import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls, useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// A blocky toy panda in matt cream and black: a big soft box of a body with
// a black band wrapped round the shoulders, four stout black legs ending in
// rounded feet, a large cube of a head carried high at the front, two
// slanted black eye patches with bright eye dots, a small square muzzle with
// a black nose, two black ears on the top corners and a stub of a tail.
// It breathes, looks around, blinks, twitches its ears, shifts its weight
// from paw to paw and wags its tail. Tap it and it does a heavy hop with a
// squashy landing and a head shake.
// It faces +z and stands on y = 0.

const KINDS = {
  panda: { fur: '#f3f1ec', dark: '#1f1d1c', eye: '#f6f4f0' },
  mocha: { fur: '#efe1cc', dark: '#5a3c2a', eye: '#f8f1e6' },
  sky: { fur: '#e9f0f6', dark: '#2c4a74', eye: '#f4f8fc' },
  berry: { fur: '#f6e6ee', dark: '#5a2742', eye: '#fbf3f7' },
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

// A flat polygon (points in the x/y plane) extruded d along z, centred on z = 0, with a small bevel.
function slab(pts, d, { bevel = 0.008 } = {}) {
  const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)))
  const g = new THREE.ExtrudeGeometry(sh, { depth: d - bevel * 2, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 24 })
  g.translate(0, 0, -(d - bevel * 2) / 2)
  return g
}

// A rounded rectangle w×h (corner radius r) extruded d along z: a band that wraps round a body.
// Unlike block(), only the four long edges are rounded, so the whole band stands proud of the body.
function band(w, h, d, r, opts) {
  const sh = new THREE.Shape()
  const hw = w / 2
  const hh = h / 2
  sh.moveTo(-hw + r, -hh)
  sh.lineTo(hw - r, -hh)
  sh.absarc(hw - r, -hh + r, r, -Math.PI / 2, 0, false)
  sh.lineTo(hw, hh - r)
  sh.absarc(hw - r, hh - r, r, 0, Math.PI / 2, false)
  sh.lineTo(-hw + r, hh)
  sh.absarc(-hw + r, hh - r, r, Math.PI / 2, Math.PI, false)
  sh.lineTo(-hw, -hh + r)
  sh.absarc(-hw + r, -hh + r, r, Math.PI, Math.PI * 1.5, false)
  const bevel = 0.012
  const g = new THREE.ExtrudeGeometry(sh, { depth: d - bevel * 2, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 24, ...opts })
  g.translate(0, 0, -(d - bevel * 2) / 2)
  return g
}

const BODY = [0, 0.8, -0.12] // 1.0 × 0.74 × 1.32: underside at 0.43, top at 1.17, front at 0.54, back at -0.78
const HIP_Y = 0.54 // legs reach 0.11 up inside the body
const LEGS = [
  [-0.28, 0.26],
  [0.28, 0.26],
  [-0.28, -0.52],
  [0.28, -0.52],
]
const NECK = [0, 0.9, 0.3] // the head turns about this point, inside the body
const TAIL = [0, 1.14, -0.72]

function usePandaGeometry() {
  const geo = useMemo(
    () => ({
      body: block(1.0, 0.74, 1.32, { r: 0.16 }),
      // the shoulder band wraps the body: same section plus a hair, thin along the body
      band: band(1.02, 0.76, 0.46, 0.17),
      // a stout square-round leg hanging from the hip, with a flared rounded foot
      leg: block(0.3, HIP_Y - 0.06, 0.3, { r: 0.1 }).translate(0, -(HIP_Y - 0.06) / 2 - 0.06, 0),
      foot: block(0.34, 0.16, 0.36, { r: 0.07 }).translate(0, 0.08, 0.02),
      head: block(0.88, 0.8, 0.72, { r: 0.17 }),
      // a slanted six-sided eye patch, pointed up and outward (mirrored for the other eye)
      patch: slab([[-0.1, 0.1], [0.1, 0.16], [0.14, 0.0], [0.05, -0.13], [-0.09, -0.16], [-0.14, -0.04]], 0.04),
      eye: block(0.07, 0.07, 0.024, { r: 0.03 }),
      muzzle: block(0.38, 0.24, 0.2, { r: 0.045, edge: 'chamfer' }),
      nose: block(0.2, 0.09, 0.1, { r: 0.024, edge: 'chamfer' }),
      ear: block(0.26, 0.16, 0.16, { r: 0.07 }),
      tail: block(0.16, 0.14, 0.14, { r: 0.045 }).translate(0, 0.02, -0.05),
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

export function Panda({ kind = 'panda' }) {
  const K = KINDS[kind] || KINDS.panda
  const geo = usePandaGeometry()
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
    // the hop: a deep crouch, a short heavy jump, a wobbling landing
    let y = 0
    let k = 0
    let air = 0
    if (s >= 0 && s < 0.28) k = 0.14 * Math.sin((s / 0.28) * Math.PI * 0.5)
    else if (s >= 0.28 && s < 0.76) {
      const q = (s - 0.28) / 0.48
      y = 4 * q * (1 - q) * 0.26
      k = q < 0.5 ? -0.06 * (1 - q * 2) : -0.015
      air = Math.sin(q * Math.PI)
    } else if (s >= 0.76 && s < 1.7) k = 0.17 * Math.exp(-5 * (s - 0.76)) * Math.cos((s - 0.76) * 12)
    hopper.current.position.y = y
    squish.current.scale.set(1 + k * 0.45, 1 - k, 1 + k * 0.45)
    // a slow breath
    const b = 1 + Math.sin(t * 1.5) * 0.012
    chest.current.scale.set(b, b, 1)
    // the head looks around, nods with the breath and shakes after a tap
    const shake = s >= 0 && s < 2.2 ? Math.exp(-2.6 * s) * Math.sin(s * 12) : 0
    head.current.rotation.set(
      0.025 * Math.sin(t * 1.5 + 0.6) + 0.05 * Math.sin(t * 0.41) - air * 0.12,
      0.22 * Math.sin(t * 0.31) + 0.07 * Math.sin(t * 0.87),
      0.03 * Math.sin(t * 0.53) + shake * 0.16,
    )
    // weight shifts: now and then one paw lifts and sets down; in the air they all dangle
    hips.current.forEach((h, i) => {
      if (!h) return
      const ph = (t * 0.2 + [0, 0.5, 0.25, 0.75][i]) % 1
      const step = ph < 0.07 ? Math.sin((ph / 0.07) * Math.PI) : 0
      h.position.y = HIP_Y + step * 0.035
      h.rotation.x = (i < 2 ? -1 : 1) * (step * 0.1 + air * 0.2)
    })
    // ears twitch on their own beats
    ears.current.forEach((e, i) => {
      if (!e) return
      const ph = (t * 0.29 + i * 0.47) % 1
      const flick = ph < 0.1 ? Math.sin((ph / 0.1) * Math.PI * 2) : 0
      e.rotation.z = (i ? -1 : 1) * (flick * 0.22 + air * 0.2 + shake * 0.15)
      e.rotation.x = -flick * 0.15
    })
    // a blink now and then (phased so the first seconds have open eyes)
    const lid = (t + 2.8) % 4.3 < 0.13 ? 0.12 : 1
    eyes.current.forEach((e) => e && (e.scale.y = lid))
    // the tail wags in short bursts, harder after a tap
    const wag = t % 3.6 < 0.9 ? Math.sin(t * 15) * 0.35 : Math.sin(t * 2) * 0.05
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
              <Matt geometry={geo.leg} color={K.dark} />
              <Matt geometry={geo.foot} color={K.dark} position-y={-HIP_Y} />
            </group>
          ))}

          {/* body with the shoulder band (breathes about its own centre) */}
          <group ref={chest} position={BODY}>
            <Matt geometry={geo.body} color={K.fur} />
            <Matt geometry={geo.band} color={K.dark} position-z={0.22} rotation-x={-0.3} />
          </group>

          {/* tail: a stub on the top of the rump */}
          <group ref={tail} position={TAIL}>
            <Matt geometry={geo.tail} color={K.dark} />
          </group>

          {/* head: block, eye patches with eye dots, muzzle, nose and ears */}
          <group ref={head} position={NECK}>
            <Matt geometry={geo.head} color={K.fur} position={[0, 0.2, 0.36]} />
            {[-1, 1].map((x, i) => (
              <group key={x} position={[x * 0.22, 0.13, 0.735]} scale-x={x}>
                <Matt geometry={geo.patch} color={K.dark} />
                <group ref={(el) => (eyes.current[i] = el)} position={[-0.04 * x, 0.05, 0.03]}>
                  <Matt geometry={geo.eye} color={K.eye} roughness={0.5} />
                </group>
              </group>
            ))}
            <Matt geometry={geo.muzzle} color={K.fur} position={[0, -0.06, 0.78]} />
            <Matt geometry={geo.nose} color={K.dark} roughness={0.6} position={[0, 0.05, 0.86]} />
            {[-1, 1].map((x, i) => (
              <group key={x} ref={(el) => (ears.current[i] = el)} position={[x * 0.33, 0.6, 0.28]}>
                <Matt geometry={geo.ear} color={K.dark} position-y={0.05} rotation-z={x * -0.1} />
              </group>
            ))}
          </group>
        </group>
      </group>
    </group>
  )
}

// The panda springs in from nothing, overshoots a touch and settles.
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

export default function PandaScene({ background = '#f6f4ef', autoRotate = true, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [2.9, 2.2, 3.9], fov: 30, near: 0.05, far: 60 }} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1 }}>
        <color attach="background" args={[background]} />
        <hemisphereLight args={['#ffffff', '#ebeaf0', 2.1]} />
        <directionalLight position={[3, 6, 5]} intensity={1.35} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.03} shadow-radius={6}>
          <orthographicCamera attach="shadow-camera" args={[-2, 2, 2.4, -0.6, 0.5, 16]} />
        </directionalLight>
        <directionalLight position={[-5, 3, -4]} intensity={0.9} color="#e6e9f5" />
        <PopIn>
          <Panda {...props} />
        </PopIn>
        <ContactShadows position={[0, 0, 0]} opacity={0.32} scale={8} blur={2.8} far={2.4} resolution={512} color="#2a2a38" />
        <OrbitControls makeDefault enablePan={false} target={[0, 0.72, 0.1]} autoRotate={autoRotate} autoRotateSpeed={0.7} minDistance={3} maxDistance={14} maxPolarAngle={1.5} />
      </Canvas>
      <InfoHint>It breathes, looks around, blinks, twitches its ears, shifts its paws and wags its tail on its own · tap it and it does a heavy hop with a squashy landing · Kind swaps panda, mocha, sky and berry · drag to orbit</InfoHint>
    </div>
  )
}

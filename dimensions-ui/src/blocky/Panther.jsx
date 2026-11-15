import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls, useCursor } from '@react-three/drei'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// A blocky toy black panther in matt near-black: a long, crisply chamfered box
// of a body on four round cylinder legs with flat disc feet, a faceted wedge of
// a head with a flat brow, a pointed muzzle, narrow amber eyes set under angled
// brows, two pyramid ears, a dark spiked collar round the neck and a long tail
// of chamfered segments that hooks up and forward over its back. It breathes,
// looks around, blinks, flicks its ears, shifts its paws and sways its tail.
// Tap it and it crouches, pounces forward with a squashy landing and lashes
// its tail before padding back. It faces +z and stands on y = 0.

const KINDS = {
  panther: { fur: '#202023', nose: '#0a0a0c', collar: '#3a3a3e', spike: '#b4b6bc', eye: '#e8a030', pupil: '#17110a' },
  graphite: { fur: '#5a5c62', nose: '#2a2b2f', collar: '#2e2f33', spike: '#d4d5d9', eye: '#f0d24a', pupil: '#1a1708' },
  midnight: { fur: '#1d2440', nose: '#0d1020', collar: '#3c4a72', spike: '#aebbe0', eye: '#7ee4ff', pupil: '#0a1a28' },
  plum: { fur: '#3d2040', nose: '#1a0d1c', collar: '#6b3f70', spike: '#d4a8d8', eye: '#ffb347', pupil: '#2a140a' },
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

// A panther leg standing on y = 0: a flat disc of a foot, a plain cylinder and a domed top
// that shows against the flank. r: leg radius, h: total height, foot: [radius, height].
function pantherLeg(r, h, foot = [r * 1.12, 0.07], seg = 40) {
  const pts = [[0.001, 0]]
  const fe = 0.012 // a tiny rounding on the foot rim
  pts.push([foot[0] - fe, 0])
  pts.push([foot[0], fe])
  pts.push([foot[0], foot[1] - fe])
  pts.push([foot[0] - fe, foot[1]])
  pts.push([r, foot[1]])
  pts.push([r, h - r])
  for (let i = 1; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2)
    pts.push([Math.cos(a) * r, h - r + Math.sin(a) * r])
  }
  pts.push([0.001, h])
  return new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg)
}

// A four-sided pyramid pointing +y with its base on y = 0, flat-shaded.
function pyramid(r, h) {
  const g = new THREE.ConeGeometry(r, h, 4, 1).toNonIndexed().translate(0, h / 2, 0)
  g.computeVertexNormals()
  return g
}

// A flat triangular fin (an ear): w wide, h tall, th thick, base on y = 0, faces towards ±z.
function fin(w, h, th) {
  const g = new THREE.ConeGeometry(w / Math.SQRT2, h, 4, 1).rotateY(Math.PI / 4).scale(1, 1, th / w).translate(0, h / 2, 0).toNonIndexed()
  g.computeVertexNormals()
  return g
}

const BODY = [0, 1.175, 0] // 0.8 × 0.85 × 1.5: underside at 0.75, top at 1.6, front at 0.75, rump at -0.75
const HIP_Y = 0.85 // the domed leg tops only just show above the belly line
const LEGS = [
  [-0.41, 0.5],
  [0.41, 0.5],
  [-0.41, -0.5],
  [0.41, -0.5],
]
const NECK = [0, 1.4, 0.6] // the head turns about this point, inside the chest
const TAIL = [0, 1.3, -0.75] // the tail root, on the rump at about 65 % of the body height
// joint angles: two segments back, a rise, then a broad open hook forward with the tip pointing down
const TAIL_BEND = [0.05, 0.15, 0.35, 0.4, 0.3, 0.25, 0.35, 0.45, 0.45, 0.4]
const TAIL_PITCH = 0.17
const TAIL_TAPER = 0.975
const SPIKES = [-90, -60, -120, -30, -150, 0, 180, 30, 150] // degrees round the collar, from the bottom
// The skull is one wedge: 0.7 wide × 0.66 tall at the back, tapering to half the width and 0.72 of the height at the front, flat jaw.
const SKULL = { w: 0.7, h: 0.66, d: 0.5, r: 0.12, tx: 0.6, ty: 0.75, z: 0.43, y: 0.1 } // local to the head group
const EYE_T = 0.893 // how far along the skull the eyes sit (on the front-side bevels)
const EYE_X = (SKULL.w / 2 - SKULL.r / 2) * (1 - (1 - SKULL.tx) * EYE_T)
const EYE_Z = SKULL.z - SKULL.d / 2 + SKULL.d * EYE_T
const EYE_Y = SKULL.y - SKULL.h / 2 + 0.32

function usePantherGeometry() {
  const geo = useMemo(
    () => ({
      body: block(0.8, 0.85, 1.5, { r: 0.035, edge: 'chamfer' }),
      leg: pantherLeg(0.18, HIP_Y, [0.216, 0.05]).translate(0, -HIP_Y, 0),
      neck: block(0.44, 0.52, 0.4, { r: 0.03, edge: 'chamfer' }),
      collar: block(0.6, 0.6, 0.05, { r: 0.012, edge: 'chamfer' }),
      spike: pyramid(0.03, 0.075),
      skull: block(SKULL.w, SKULL.h, SKULL.d, { r: SKULL.r, edge: 'chamfer', taper: [SKULL.tx, SKULL.ty], base: -1 }),
      muzzle: block(0.38, 0.3, 0.26, { r: 0.05, edge: 'chamfer', taper: [0.6, 0.62], base: -1 }),
      nose: block(0.09, 0.05, 0.05, { r: 0.01, edge: 'chamfer' }),
      eye: block(0.14, 0.056, 0.05, { r: 0.006, edge: 'chamfer' }),
      pupil: block(0.032, 0.05, 0.012, { r: 0.003, edge: 'chamfer' }),
      brow: block(0.16, 0.04, 0.07, { r: 0.01, edge: 'chamfer' }),
      ear: fin(0.2, 0.2, 0.06),
      tailSeg: block(0.17, 0.17, 0.19, { r: 0.028, edge: 'chamfer' }).translate(0, 0, -0.085),
    }),
    [],
  )
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])
  return geo
}

// One piece of the toy: a soft matt material that casts and takes shadow.
function Matt({ color, roughness = 0.78, ...props }) {
  return (
    <mesh castShadow receiveShadow {...props}>
      <meshStandardMaterial color={color} roughness={roughness} metalness={0} />
    </mesh>
  )
}

const ease = (q) => q * q * (3 - 2 * q)

export function Panther({ kind = 'panther' }) {
  const K = KINDS[kind] || KINDS.panther
  const geo = usePantherGeometry()
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
  const segs = useRef([])

  useFrame(({ clock }) => {
    const t = (now.current = clock.elapsedTime)
    const s = t - tapAt.current
    // the pounce: a crouch, a leap forward, a squashy landing, then it pads back
    let y = 0
    let z = 0
    let k = 0
    let air = 0
    let crouch = 0
    if (s >= 0 && s < 0.32) {
      crouch = Math.sin((s / 0.32) * Math.PI * 0.5)
      k = 0.15 * crouch
      z = -0.08 * crouch
    } else if (s >= 0.32 && s < 0.86) {
      const q = (s - 0.32) / 0.54
      y = 4 * q * (1 - q) * 0.36
      z = -0.08 + q * 0.58
      k = q < 0.5 ? -0.08 * (1 - q * 2) : -0.015
      air = Math.sin(q * Math.PI)
    } else if (s >= 0.86 && s < 1.8) {
      k = 0.17 * Math.exp(-5.5 * (s - 0.86)) * Math.cos((s - 0.86) * 13)
      z = 0.5
    } else if (s >= 1.8 && s < 2.9) {
      const q = ease((s - 1.8) / 1.1)
      z = 0.5 * (1 - q)
      y = Math.abs(Math.sin(q * Math.PI * 2)) * 0.02
    }
    hopper.current.position.set(0, y, z)
    squish.current.scale.set(1 + k * 0.45, 1 - k, 1 + k * 0.45)
    // a slow breath
    const b = 1 + Math.sin(t * 1.5) * 0.011
    chest.current.scale.set(b, b, 1)
    // the head looks around slowly, drops in the crouch and lifts in the leap
    const shake = s >= 0.86 && s < 2.6 ? Math.exp(-2.8 * (s - 0.86)) * Math.sin((s - 0.86) * 12) : 0
    head.current.rotation.set(
      -0.04 + 0.02 * Math.sin(t * 1.5 + 0.6) + 0.04 * Math.sin(t * 0.41) + crouch * 0.22 - air * 0.2,
      0.06 + 0.14 * Math.sin(t * 0.29 + 0.5) + 0.05 * Math.sin(t * 0.83),
      0.025 * Math.sin(t * 0.53) + shake * 0.12,
    )
    // weight shifts: now and then one paw lifts and sets down; in the air the legs tuck
    hips.current.forEach((h, i) => {
      if (!h) return
      const ph = (t * 0.2 + [0, 0.5, 0.25, 0.75][i]) % 1
      const step = ph < 0.07 ? Math.sin((ph / 0.07) * Math.PI) : 0
      h.position.y = HIP_Y + step * 0.03
      h.rotation.x = (i < 2 ? -1 : 1) * (step * 0.1 + air * 0.3) + (i < 2 ? 1 : -1) * crouch * 0.12
    })
    // the pad-back: a little paddling of the legs
    if (s >= 1.8 && s < 2.9) hips.current.forEach((h, i) => h && (h.rotation.x += Math.sin((s - 1.8) * 18 + i * 1.6) * 0.1))
    // ears flick on their own beats, flatten in the crouch
    ears.current.forEach((e, i) => {
      if (!e) return
      const ph = (t * 0.27 + i * 0.47) % 1
      const flick = ph < 0.1 ? Math.sin((ph / 0.1) * Math.PI * 2) : 0
      e.rotation.z = (i ? -1 : 1) * (0.18 + flick * 0.25 + crouch * 0.35 + shake * 0.15)
      e.rotation.x = -flick * 0.15 - crouch * 0.3
    })
    // a blink now and then (phased so the first seconds have open eyes)
    const lid = (t + 2.8) % 4.3 < 0.13 ? 0.1 : 1
    eyes.current.forEach((e) => e && (e.scale.y = lid))
    // the tail sways slowly from side to side and lashes after a tap
    const lash = s >= 0 && s < 2.4 ? Math.exp(-1.4 * s) * Math.sin(s * 11) : 0
    tail.current.rotation.y = Math.sin(t * 0.7) * 0.18 + lash * 0.8
    tail.current.rotation.z = Math.sin(t * 0.7 + 0.8) * 0.06
    segs.current.forEach((g, j) => {
      if (!g) return
      g.rotation.x = TAIL_BEND[j] + Math.sin(t * 1.1 - j * 0.6) * 0.025 - crouch * 0.05 + air * (j > 3 ? -0.08 : 0.02)
      g.rotation.y = j ? Math.sin(t * 0.7 - j * 0.5) * 0.03 + lash * 0.12 : 0
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
      <group ref={hopper}>
        <group ref={squish}>
          {/* legs: round posts hung from the hips, splayed a touch outwards */}
          {LEGS.map(([x, z], i) => (
            <group key={i} ref={(el) => (hips.current[i] = el)} position={[x, HIP_Y, z]}>
              <Matt geometry={geo.leg} color={K.fur} rotation-z={Math.sign(x) * 0.055} />
            </group>
          ))}

          {/* body (breathes about its own centre) */}
          <group ref={chest} position={BODY}>
            <Matt geometry={geo.body} color={K.fur} />
          </group>

          {/* tail: a chain of chamfered segments, each hinged on the last */}
          <group ref={tail} position={TAIL}>
            {TAIL_BEND.reduceRight(
              (child, bend, j) => (
                <group key={j} ref={(el) => (segs.current[j] = el)} position={[0, 0, j ? -TAIL_PITCH * Math.pow(TAIL_TAPER, j - 1) : 0]} rotation-x={bend}>
                  <Matt geometry={geo.tailSeg} color={K.fur} scale={Math.pow(TAIL_TAPER, j)} />
                  {child}
                </group>
              ),
              null,
            )}
          </group>

          {/* head: neck, spiked collar, faceted skull, muzzle, nose, eyes under brows, pyramid ears */}
          <group ref={head} position={NECK}>
            <Matt geometry={geo.neck} color={K.fur} position={[0, -0.06, 0.2]} />
            <group position={[0, -0.1, 0.22]} rotation-x={-0.35}>
              <Matt geometry={geo.collar} color={K.collar} roughness={0.6} />
              {SPIKES.map((deg) => {
                const a = (deg * Math.PI) / 180
                const c = Math.cos(a)
                const sn = Math.sin(a)
                const m = Math.max(Math.abs(c), Math.abs(sn))
                return <Matt key={deg} geometry={geo.spike} color={K.spike} roughness={0.5} position={[(0.3 * c) / m - c * 0.015, (0.3 * sn) / m - sn * 0.015, 0]} rotation-z={a - Math.PI / 2} />
              })}
            </group>
            <Matt geometry={geo.skull} color={K.fur} position={[0, SKULL.y, SKULL.z]} />
            <Matt geometry={geo.muzzle} color={K.fur} position={[0, SKULL.y - SKULL.h / 2 + 0.15, SKULL.z + SKULL.d / 2 + 0.04]} />
            <Matt geometry={geo.nose} color={K.nose} roughness={0.45} position={[0, SKULL.y - SKULL.h / 2 + 0.158, SKULL.z + SKULL.d / 2 + 0.165]} />
            {/* eyes: narrow amber slots on the angled cheek facets, each under an overhanging brow */}
            {[-1, 1].map((x, i) => (
              <group key={x} position={[x * EYE_X, EYE_Y, EYE_Z]} rotation={[0, x * 0.64, -x * 0.2, 'YZX']}>
                <group ref={(el) => (eyes.current[i] = el)}>
                  <Matt geometry={geo.eye} color={K.eye} roughness={0.35} />
                  <Matt geometry={geo.pupil} color={K.pupil} roughness={0.35} position={[-x * 0.01, 0, 0.022]} />
                </group>
                <Matt geometry={geo.brow} color={K.fur} position={[0, 0.045, 0.012]} rotation-x={0.3} />
              </group>
            ))}
            {/* ears: flat triangular fins on the top-rear corners, tilted a little outwards */}
            {[-1, 1].map((x, i) => (
              <group key={x} ref={(el) => (ears.current[i] = el)} position={[x * 0.2, 0.36, 0.3]}>
                <Matt geometry={geo.ear} color={K.fur} rotation-x={-0.08} />
              </group>
            ))}
          </group>
        </group>
      </group>
    </group>
  )
}

// The panther springs in from nothing, overshoots a touch and settles.
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

export default function PantherScene({ background = '#f6f4ef', autoRotate = true, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [6.6, 3.2, 2.55], fov: 30, near: 0.05, far: 60 }} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1 }}>
        <color attach="background" args={[background]} />
        <hemisphereLight args={['#ffffff', '#d8d8e4', 3.6]} />
        <directionalLight position={[3, 6, 5]} intensity={2.0} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.03} shadow-radius={6}>
          <orthographicCamera attach="shadow-camera" args={[-2.5, 2.5, 3.2, -0.6, 0.5, 18]} />
        </directionalLight>
        <directionalLight position={[-5, 3, -4]} intensity={1.6} color="#dfe5f8" />
        <directionalLight position={[5, 1.5, 4]} intensity={0.9} color="#ffffff" />
        <PopIn>
          <Panther {...props} />
        </PopIn>
        <ContactShadows position={[0, 0, 0]} opacity={0.34} scale={8} blur={2.8} far={2.6} resolution={512} color="#2a2a38" />
        <OrbitControls makeDefault enablePan={false} target={[0, 1.05, 0]} autoRotate={autoRotate} autoRotateSpeed={0.7} minDistance={3} maxDistance={14} maxPolarAngle={1.5} />
      </Canvas>
      <InfoHint>It breathes, looks around, blinks, flicks its ears, shifts its paws and sways its tail on its own · tap it and it crouches, pounces forward with a squashy landing and lashes its tail · Kind swaps panther, graphite, midnight and plum · drag to orbit</InfoHint>
    </div>
  )
}

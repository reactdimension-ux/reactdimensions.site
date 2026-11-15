import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls, useCursor } from '@react-three/drei'
import * as THREE from 'three'

// A clay-toy penguin: one tall rounded capsule of a body (head and body in a
// single piece), a big white oval painted flush across the face and belly,
// two glossy bead eyes, a little orange cone of a beak, flat paddle flippers
// and two flattened orange feet. It breathes, waddles side to side, blinks
// and flaps its flippers. Tap it and it does a happy hop with both flippers
// flapping.
// It faces +z and stands on y = 0.

const KINDS = {
  classic: { body: '#1f1f23', belly: '#ffffff', blush: null, beak: '#f5861a', feet: '#f5861a', eye: '#08080a' },
  blue: { body: '#1b2747', belly: '#fbfaf6', blush: null, beak: '#f5861a', feet: '#f5861a', eye: '#08080c' },
  emperor: { body: '#373c44', belly: '#fbf8ef', blush: '#f7bf4f', beak: '#f08a2a', feet: '#2b2e34', eye: '#08080a' },
  pink: { body: '#f0a5bb', belly: '#fff3e2', blush: null, beak: '#f6973a', feet: '#f6973a', eye: '#2a1720' },
}

// The body is a lathe: a flat-ish bottom with a rounded edge, sides that
// taper a touch towards the top, and a domed crown.
const FOOT_Y = 0.06 // underside of the body
const TOP_Y = 1.7
const DEPTH = 0.9 // the body is a little shallower front to back than it is wide
const CORNER = 0.18
const DOME_Y = 1.16

const smooth = (a, b, x) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return k * k * (3 - 2 * k)
}

// The body's radius at height y.
function radiusAt(y) {
  if (y <= FOOT_Y) return 0.38
  if (y < FOOT_Y + CORNER) {
    const q = (FOOT_Y + CORNER - y) / CORNER
    return 0.38 + CORNER * Math.sqrt(Math.max(0, 1 - q * q))
  }
  if (y < DOME_Y) return 0.56 - 0.05 * smooth(FOOT_Y + CORNER, DOME_Y, y)
  const q = (y - DOME_Y) / (TOP_Y - DOME_Y)
  return 0.51 * Math.sqrt(Math.max(0, 1 - q * q))
}

// A point on the body's surface, `theta` round from the front (+x is positive).
function surf(theta, y, inset = 0) {
  const r = radiusAt(y) - inset
  return [r * Math.sin(theta), y, r * Math.cos(theta) * DEPTH]
}

// The white oval, in (angle round the body, height) space.
const OVAL = { half: 0.86, yc: 0.86, hy: 0.66 }

function bodyGeometry() {
  const pts = [new THREE.Vector2(0.0001, FOOT_Y)]
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI * 0.5
    pts.push(new THREE.Vector2(0.38 + CORNER * Math.sin(a), FOOT_Y + CORNER - CORNER * Math.cos(a)))
  }
  for (let i = 1; i <= 60; i++) {
    const y = FOOT_Y + CORNER + (i / 60) * (DOME_Y - FOOT_Y - CORNER)
    pts.push(new THREE.Vector2(radiusAt(y), y))
  }
  for (let i = 1; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 0.5
    pts.push(new THREE.Vector2(Math.max(0.0001, 0.51 * Math.cos(a)), DOME_Y + (TOP_Y - DOME_Y) * Math.sin(a)))
  }
  return new THREE.LatheGeometry(pts, 160, Math.PI) // the seam sits at the back
}

// The body's clay paints its white oval (and the emperor's blush) per pixel
// from the model-space position, so the edge is crisp, soft and flush.
function bodyMaterial(K) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0 })
  const uniforms = {
    uBody: { value: new THREE.Color(K.body) },
    uBelly: { value: new THREE.Color(K.belly) },
    uBlush: { value: new THREE.Color(K.blush || K.body) },
    uBlushOn: { value: K.blush ? 1 : 0 },
    uOval: { value: new THREE.Vector3(OVAL.half, OVAL.yc, OVAL.hy) },
  }
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms)
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vModel;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvModel = position;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vModel;\nuniform vec3 uBody;\nuniform vec3 uBelly;\nuniform vec3 uBlush;\nuniform float uBlushOn;\nuniform vec3 uOval;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float pu = atan(vModel.x, vModel.z) / uOval.x;
        float pv = (vModel.y - uOval.y) / uOval.z;
        float pd = length(vec2(pu, pv));
        float pe = max(fwidth(pd) * 1.2, 0.008);
        vec3 pc = uBody;
        float glow = smoothstep(0.05, 0.35, pv) * smoothstep(0.85, 0.5, pv) * smoothstep(1.3, 1.02, pd) * smoothstep(0.45, 0.85, abs(pu));
        pc = mix(pc, uBlush, glow * 0.7 * uBlushOn);
        pc = mix(pc, uBelly, smoothstep(1.0 + pe, 1.0 - pe, pd));
        pc = mix(pc, uBlush, smoothstep(0.7, 0.97, pd) * smoothstep(0.1, 0.35, pv) * smoothstep(0.8, 0.5, pv) * smoothstep(1.0, 0.94, pd) * 0.4 * uBlushOn);
        diffuseColor.rgb = pc;
        float pw = smoothstep(1.0 + pe, 1.0 - pe, pd);`,
      )
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += uBelly * pw * 0.1;')
  }
  m.customProgramCacheKey = () => 'penguin-body'
  return m
}

function usePenguinGeometry() {
  const geo = useMemo(
    () => ({
      ball: new THREE.SphereGeometry(1, 48, 32),
      // a rounded cone along +y
      beak: new THREE.LatheGeometry(
        [
          [0.0001, -0.02],
          [0.06, -0.012],
          [0.086, 0.02],
          [0.088, 0.05],
          [0.074, 0.095],
          [0.05, 0.14],
          [0.026, 0.172],
          [0.0001, 0.184],
        ].map(([r, y]) => new THREE.Vector2(r, y)),
        40,
      ),
    }),
    [],
  )
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])
  return geo
}

// One piece of clay: a soft material that casts and takes shadow.
function Clay({ color, roughness = 0.55, ...props }) {
  return (
    <mesh castShadow receiveShadow {...props}>
      <meshStandardMaterial color={color} roughness={roughness} metalness={0} />
    </mesh>
  )
}

const EYE_THETA = 0.39
const EYE_Y = 1.2
const BEAK_Y = 1.05

export function Penguin({ kind = 'classic' }) {
  const K = KINDS[kind] || KINDS.classic
  const geo = usePenguinGeometry()
  const body = useMemo(() => bodyGeometry(), [])
  const skin = useMemo(() => bodyMaterial(K), [K])
  useEffect(() => () => body.dispose(), [body])
  useEffect(() => () => skin.dispose(), [skin])
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const tapAt = useRef(-99)
  const now = useRef(0)
  const hopper = useRef()
  const squish = useRef()
  const chest = useRef()
  const flippers = useRef([])
  const eyes = useRef([])

  useFrame(({ clock }) => {
    const t = (now.current = clock.elapsedTime)
    const s = t - tapAt.current
    // the happy hop: a crouch, a bouncy jump, a squashy landing
    let y = 0
    let k = 0
    let air = 0
    if (s >= 0 && s < 0.2) k = 0.12 * Math.sin((s / 0.2) * Math.PI * 0.5)
    else if (s >= 0.2 && s < 0.74) {
      const q = (s - 0.2) / 0.54
      y = 4 * q * (1 - q) * 0.22
      k = q < 0.45 ? -0.08 * (1 - q / 0.45) : 0
      air = Math.sin(q * Math.PI)
    } else if (s >= 0.74 && s < 1.6) k = 0.16 * Math.exp(-6 * (s - 0.74)) * Math.cos((s - 0.74) * 14)
    const happy = s >= 0 && s < 1.5 ? 1 - s / 1.5 : 0
    hopper.current.position.y = y
    // a gentle waddle, rocking from foot to foot
    const w = Math.sin(t * 1.9)
    hopper.current.rotation.set(0, 0.03 * Math.sin(t * 0.5), w * 0.045 * (1 - air))
    hopper.current.position.x = w * 0.012
    squish.current.scale.set(1 + k * 0.5, 1 - k, 1 + k * 0.5)
    // a slow breath
    const b = 1 + Math.sin(t * 1.6) * 0.012
    chest.current.scale.set(b, 1 + (b - 1) * 0.6, b)
    // flippers: rest, the odd little flap, and a frantic flap when happy
    const ph = (t + 1.2) % 4.6
    const flap = ph < 0.9 ? Math.sin((ph / 0.9) * Math.PI * 3) * Math.sin((ph / 0.9) * Math.PI) * 0.22 : 0
    const frantic = happy > 0 ? (0.45 + 0.4 * Math.sin(s * 30)) * Math.min(1, happy * 3) : 0
    flippers.current.forEach((f, i) => f && (f.rotation.z = (i ? 1 : -1) * (flap + frantic + w * (i ? 0.03 : -0.03))))
    // a blink now and then
    const lid = (t + 1.5) % 3.9 < 0.13 ? 0.12 : 1
    eyes.current.forEach((e) => e && (e.scale.y = lid))
  })

  const beakAt = surf(0, BEAK_Y, 0.02)

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
          {/* two flattened orange feet poking out forward */}
          {[-1, 1].map((x) => (
            <Clay key={x} geometry={geo.ball} color={K.feet} roughness={0.5} position={[x * 0.22, 0.064, 0.36]} rotation-y={x * 0.2} scale={[0.145, 0.066, 0.22]} />
          ))}

          <group ref={chest}>
            {/* the one-piece body, white oval painted flush */}
            <mesh geometry={body} material={skin} scale={[1, 1, DEPTH]} castShadow receiveShadow />

            {/* eyes */}
            {[-1, 1].map((x, i) => {
              const at = surf(x * EYE_THETA, EYE_Y, 0.03)
              return (
                <group key={x} position={at} rotation-y={x * EYE_THETA}>
                  <group ref={(el) => (eyes.current[i] = el)}>
                    <mesh geometry={geo.ball} scale={0.062}>
                      <meshStandardMaterial color={K.eye} roughness={0.08} />
                    </mesh>
                    <mesh geometry={geo.ball} position={[-0.018, 0.024, 0.048]} scale={0.013}>
                      <meshStandardMaterial color="#ffffff" roughness={0.2} emissive="#ffffff" emissiveIntensity={0.4} />
                    </mesh>
                  </group>
                </group>
              )
            })}

            {/* beak */}
            <group position={beakAt} rotation-x={Math.PI / 2 + 0.22}>
              <Clay geometry={geo.beak} castShadow={false} color={K.beak} roughness={0.42} scale={[1, 1, 0.85]} />
            </group>

            {/* flippers hinge at the shoulders */}
            {[-1, 1].map((x, i) => (
              <group key={x} position={[x * 0.5, 0.96, -0.02]} rotation-y={-x * 0.35}>
                <group ref={(el) => (flippers.current[i] = el)}>
                  <Clay geometry={geo.ball} color={K.body} roughness={0.62} position={[x * 0.14, -0.3, 0]} rotation-z={x * 0.48} scale={[0.07, 0.34, 0.16]} />
                </group>
              </group>
            ))}
          </group>
        </group>
      </group>
    </group>
  )
}

// The penguin springs in from nothing, overshoots a touch and settles.
function PopIn({ children }) {
  const g = useRef()
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    g.current.scale.setScalar(Math.max(0.001, 1 - Math.exp(-5.5 * t) * Math.cos(8 * t)))
  })
  return <group ref={g}>{children}</group>
}

// Auto-rotation waits a few seconds so the opening view is the classic
// three-quarter pose.
function Orbit({ autoRotate }) {
  const c = useRef()
  useFrame(({ clock }) => {
    if (c.current) c.current.autoRotate = autoRotate && clock.elapsedTime > 5
  })
  return <OrbitControls ref={c} makeDefault enablePan={false} target={[0, 0.84, 0]} autoRotateSpeed={0.7} minDistance={2.6} maxDistance={14} maxPolarAngle={1.5} />
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

export default function PenguinScene({ background = '#f6f4ef', autoRotate = true, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [-2.0, 1.62, 3.6], fov: 30, near: 0.05, far: 60 }} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1 }}>
        <color attach="background" args={[background]} />
        <hemisphereLight args={['#ffffff', '#e6e4ea', 1.9]} />
        <directionalLight position={[-2, 9, 4.5]} intensity={1.9} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.03} shadow-radius={5}>
          <orthographicCamera attach="shadow-camera" args={[-2.2, 2.2, 2.4, -0.6, 0.5, 16]} />
        </directionalLight>
        <directionalLight position={[5, 3, -4]} intensity={0.9} color="#eef0ff" />
        <PopIn>
          <Penguin {...props} />
        </PopIn>
        <ContactShadows position={[0, 0, 0]} opacity={0.34} scale={6} blur={2.6} far={2.4} resolution={512} color="#2a2a33" />
        <Orbit autoRotate={autoRotate} />
      </Canvas>
      <InfoHint>It breathes, waddles side to side, blinks and flaps its flippers on its own · tap it and it does a happy hop with both flippers flapping · Kind swaps classic, blue, emperor and pink · drag to orbit</InfoHint>
    </div>
  )
}

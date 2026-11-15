import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls, useCursor } from '@react-three/drei'
import * as THREE from 'three'

// A clay-toy chicken: a plump egg of a body, a round head sitting on its
// top front, a glossy red comb of four bobbles, two dark bead eyes, an orange
// cone of a beak with two red wattles under it, little teardrop wings tucked
// to the sides, a fan of red, orange and yellow tail feathers and two orange
// legs ending in three rounded toes. It breathes, bobs its head and pecks,
// blinks, shrugs its wings, wiggles its tail and shifts its weight. Tap it
// and it flusters: a hop with fast flapping wings and a head shake.
// It faces +z and stands on y = 0.

const KINDS = {
  cream: { body: '#f4ead3', comb: '#e4323f', beak: '#f6931f', leg: '#f08a1d', eye: '#2a1810', tail: ['#e4323f', '#f6931f', '#f2c330'] },
  brown: { body: '#b9794f', comb: '#d82b3a', beak: '#f2a53a', leg: '#e58b2a', eye: '#1e130d', tail: ['#5a3220', '#8a4f2d', '#d8a257'] },
  snow: { body: '#fbfaf6', comb: '#ef3a47', beak: '#f7a33b', leg: '#f3a24a', eye: '#2a2024', tail: ['#f4f4f4', '#dcdcdc', '#b8b8bc'] },
  black: { body: '#2d2a2c', comb: '#e4323f', beak: '#f6c14a', leg: '#e8b95a', eye: '#0e0a0a', tail: ['#1e5b4a', '#3b7f60', '#8fbf5a'] },
}

// The egg of a body: fatter low down, narrowing towards the shoulders.
function eggGeometry(height, radius, waist = 0.4) {
  const pts = []
  const N = 40
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const d = t < waist ? (t - waist) / waist : (t - waist) / (1 - waist)
    const r = radius * Math.sqrt(Math.max(0, 1 - d * d))
    pts.push(new THREE.Vector2(i === 0 || i === N ? 0.001 : r, t * height))
  }
  return new THREE.LatheGeometry(pts, 64)
}

function useChickenGeometry() {
  const geo = useMemo(
    () => ({
      ball: new THREE.SphereGeometry(1, 64, 40),
      body: eggGeometry(1.5, 0.76, 0.38),
      wing: eggGeometry(1, 0.5, 0.32),
      beak: new THREE.ConeGeometry(0.15, 0.42, 40).rotateX(Math.PI / 2).translate(0, 0, 0.17),
      leg: new THREE.CapsuleGeometry(0.085, 0.4, 10, 24).translate(0, 0.27, 0),
      toe: new THREE.CapsuleGeometry(0.072, 0.15, 10, 24).rotateX(Math.PI / 2).translate(0, 0, 0.11),
      feather: new THREE.CapsuleGeometry(0.1, 0.34, 12, 28).scale(1, 1, 0.5).translate(0, 0.22, 0),
    }),
    [],
  )
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])
  return geo
}

// A piece of clay: soft, with a faint waxy sheen that catches the lights.
function Clay({ color, roughness = 0.5, sheen = 0.15, ...props }) {
  return (
    <mesh castShadow receiveShadow {...props}>
      <meshPhysicalMaterial color={color} roughness={roughness} metalness={0} clearcoat={sheen} clearcoatRoughness={0.45} />
    </mesh>
  )
}

export function Chicken({ kind = 'cream' }) {
  const K = KINDS[kind] || KINDS.cream
  const geo = useChickenGeometry()
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const tapAt = useRef(-99)
  const now = useRef(0)
  const hopper = useRef()
  const squish = useRef()
  const chest = useRef()
  const head = useRef()
  const wattles = useRef([])
  const wings = useRef([])
  const eyes = useRef([])
  const tail = useRef()
  const feet = useRef([])

  useFrame(({ clock }) => {
    const t = (now.current = clock.elapsedTime)
    const s = t - tapAt.current
    // the fluster: a crouch, a quick hop, a wobbling landing
    let y = 0
    let k = 0
    let air = 0
    if (s >= 0 && s < 0.2) k = 0.12 * Math.sin((s / 0.2) * Math.PI * 0.5)
    else if (s >= 0.2 && s < 0.7) {
      const q = (s - 0.2) / 0.5
      y = 4 * q * (1 - q) * 0.34
      k = q < 0.5 ? -0.08 * (1 - q * 2) : -0.02
      air = Math.sin(q * Math.PI)
    } else if (s >= 0.7 && s < 1.6) k = 0.14 * Math.exp(-5.5 * (s - 0.7)) * Math.cos((s - 0.7) * 13)
    hopper.current.position.y = y
    squish.current.scale.set(1 + k * 0.5, 1 - k, 1 + k * 0.5)
    // a slow breath
    const b = 1 + Math.sin(t * 1.7) * 0.012
    chest.current.scale.set(b, 1, b)
    // the head bobs, looks about, pecks now and then and shakes after a tap
    const peckPh = (t * 0.17) % 1
    const peck = peckPh < 0.16 ? Math.pow(Math.sin((peckPh / 0.16) * Math.PI * 2), 2) * (peckPh < 0.08 ? 1 : 0.6) : 0
    const shake = s >= 0 && s < 2 ? Math.exp(-2.4 * s) * Math.sin(s * 16) : 0
    head.current.rotation.set(0.05 * Math.sin(t * 1.7 + 0.5) + peck * 0.55 - air * 0.15, 0.18 * Math.sin(t * 0.29 + 1.6) + 0.08 * Math.sin(t * 0.77), shake * 0.14)
    head.current.position.z = 0.1 + peck * 0.08
    // the wattles swing with the head
    wattles.current.forEach((w, i) => w && (w.rotation.x = -peck * 0.6 - shake * 0.5 + 0.08 * Math.sin(t * 3 + i)))
    // wings: a shrug now and then, and a fast flap in the air and on landing
    const flap = s >= 0 && s < 1.3 ? Math.abs(Math.sin(s * 22)) * Math.exp(-1.6 * s) : 0
    wings.current.forEach((w, i) => {
      if (!w) return
      const ph = (t * 0.23 + i * 0.5) % 1
      const shrug = ph < 0.1 ? Math.sin((ph / 0.1) * Math.PI) * 0.25 : 0
      w.rotation.z = (i ? -1 : 1) * (shrug + flap * 1.1 + air * 0.3)
    })
    // a blink now and then (phased so the first seconds have open eyes)
    const lid = (t + 2.6) % 4.1 < 0.12 ? 0.1 : 1
    eyes.current.forEach((e) => e && (e.scale.y = lid))
    // the tail wiggles in bursts, and lifts in the air
    const wag = t % 3.3 < 0.8 ? Math.sin(t * 17) * 0.14 : Math.sin(t * 1.3) * 0.03
    tail.current.rotation.y = wag + shake * 0.3
    tail.current.rotation.x = -air * 0.35
    // a little weight shift from foot to foot
    feet.current.forEach((f, i) => f && (f.position.y = Math.max(0, (i ? -1 : 1) * Math.sin(t * 0.6)) * 0.012 + y * 0))
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
        {/* legs and feet stay on the ground; the body squashes above them */}
        {[-1, 1].map((x, i) => (
          <group key={x} ref={(el) => (feet.current[i] = el)} position={[x * 0.21, 0, 0.04]}>
            <Clay geometry={geo.leg} color={K.leg} roughness={0.42} />
            {[-0.55, 0, 0.55].map((a) => (
              <Clay key={a} geometry={geo.toe} color={K.leg} roughness={0.42} position={[0, 0.072, 0.02]} rotation-y={a} />
            ))}
          </group>
        ))}

        <group ref={squish} position-y={0.36}>
          {/* body */}
          <group ref={chest}>
            <Clay geometry={geo.body} color={K.body} rotation-x={0.06} />
          </group>

          {/* wings: teardrops tucked to the sides, pivoting at the shoulder */}
          {[-1, 1].map((x, i) => (
            <group key={x} ref={(el) => (wings.current[i] = el)} position={[x * 0.55, 1.04, -0.02]}>
              <Clay geometry={geo.wing} color={K.body} position={[x * 0.22, -0.52, -0.02]} rotation={[-0.3, 0, x * 0.16]} scale={[0.27, 0.6, 0.4]} />
            </group>
          ))}

          {/* tail: three flat feathers fanned up and back */}
          <group ref={tail} position={[0, 1.08, -0.58]}>
            {[
              [-0.02, -0.7, 0.05, 1.3],
              [0.1, -1.0, 0.22, 1.12],
              [0.2, -1.3, 0.4, 0.95],
            ].map(([x, rx, rz, sc], i) => (
              <Clay key={i} geometry={geo.feather} color={K.tail[i]} roughness={0.4} position={[x, 0, 0]} rotation={[rx, 0, -rz]} scale={sc} />
            ))}
          </group>

          {/* head: ball, comb, eyes, beak and wattles; it turns about the neck */}
          <group ref={head} position={[0, 1.32, 0.1]}>
            <Clay geometry={geo.ball} color={K.body} position={[0, 0.28, 0.08]} scale={0.49} />
            {[
              [0.05, 0.78, 0.34, 0.17],
              [-0.03, 0.83, 0.1, 0.19],
              [0.05, 0.76, -0.14, 0.15],
              [-0.09, 0.72, 0.26, 0.1],
            ].map(([x, y, z, r], i) => (
              <Clay key={i} geometry={geo.ball} color={K.comb} roughness={0.3} sheen={0.5} position={[x, y, z]} scale={r} />
            ))}
            {[-1, 1].map((x, i) => (
              <group key={x} ref={(el) => (eyes.current[i] = el)} position={[x * 0.27, 0.36, 0.48]}>
                <mesh geometry={geo.ball} scale={0.074}>
                  <meshPhysicalMaterial color={K.eye} roughness={0.08} clearcoat={1} clearcoatRoughness={0.05} />
                </mesh>
              </group>
            ))}
            <Clay geometry={geo.beak} color={K.beak} roughness={0.4} position={[0, 0.17, 0.5]} rotation-x={0.1} />
            {[-1, 1].map((x, i) => (
              <group key={x} ref={(el) => (wattles.current[i] = el)} position={[x * 0.09, 0.04, 0.42]}>
                <Clay geometry={geo.ball} color={K.comb} roughness={0.3} sheen={0.5} position-y={-0.06} scale={[0.085, 0.09, 0.08]} />
              </group>
            ))}
          </group>
        </group>
      </group>
    </group>
  )
}

// The chicken springs in from nothing, overshoots a touch and settles.
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

export default function ChickenScene({ background = '#f6f4ef', autoRotate = true, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [3.9, 2.7, 4.6], fov: 30, near: 0.05, far: 60 }} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1 }}>
        <color attach="background" args={[background]} />
        <hemisphereLight args={['#ffffff', '#e9e6ee', 1.7]} />
        {/* a big soft key from the upper left, a cool fill from the right and a warm rim from behind */}
        <directionalLight position={[-3.5, 7, 5]} intensity={1.7} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0003} shadow-normalBias={0.03} shadow-radius={8}>
          <orthographicCamera attach="shadow-camera" args={[-2.2, 2.2, 3, -0.6, 0.5, 18]} />
        </directionalLight>
        <directionalLight position={[5, 3, 3]} intensity={0.55} color="#e3e8ff" />
        <directionalLight position={[1, 4, -6]} intensity={0.8} color="#fff1dc" />
        <PopIn>
          <Chicken {...props} />
        </PopIn>
        <ContactShadows position={[0, 0, 0]} opacity={0.36} scale={8} blur={2.4} far={2.6} resolution={1024} color="#2a2430" />
        <OrbitControls makeDefault enablePan={false} target={[0, 1.25, 0]} autoRotate={autoRotate} autoRotateSpeed={0.7} minDistance={3} maxDistance={14} maxPolarAngle={1.5} />
      </Canvas>
      <InfoHint>It breathes, bobs and pecks, blinks, shrugs its wings and wiggles its tail on its own · tap it and it flusters with a hop and fast flapping · Kind swaps cream, brown, snow and black · drag to orbit</InfoHint>
    </div>
  )
}

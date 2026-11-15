import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls, useCursor } from '@react-three/drei'
import * as THREE from 'three'

// A clay-toy goldfish: a plump egg of a body with huge bulging white eyes, a
// tiny smile and rosy cheeks, a dorsal fin, two pectoral fins and a fan of
// tail fins, hovering over its shadow. It swims in place, bobbing and wagging
// its tail and fins, and its eyes roll about. Tap it and it does a quick
// barrel roll. It faces +z and hovers above y = 0.

const TAU = Math.PI * 2

const KINDS = {
  orange: { skin: '#ff8a2e', belly: '#ffc27e', fin: '#ffad55', patches: [], lip: '#b8451c', cheek: '#ff6f5e', pupil: '#1d1512' },
  white: { skin: '#f6f0e6', belly: '#fffaf2', fin: '#f9dcc6', patches: [], lip: '#c27a64', cheek: '#f7a5a0', pupil: '#1d1512' },
  black: { skin: '#47434e', belly: '#6c6674', fin: '#625c6c', patches: [], lip: '#f2b6a6', cheek: '#9c6f86', pupil: '#141016' },
  calico: { skin: '#f6f0e6', belly: '#fffaf2', fin: '#f6cfae', patches: ['#ff8a2e', '#36313d'], lip: '#b8451c', cheek: '#f7a5a0', pupil: '#1d1512' },
}

// The body is a unit sphere made into an egg (fuller at the front, slimmer
// toward the tail) and then scaled. Its belly and the calico patches are
// painted into the clay as soft-edged vertex colours, so there are no rims.
const BODY = [0.46, 0.53, 0.78]
const HOVER = 1.02

const smooth = (a, b, x) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return k * k * (3 - 2 * k)
}
const dirOf = (az, el) => new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az))

// [angle round the body (0 right side, +pi/2 forward), elevation, size, colour index]
const CALICO = [
  [0.3, 0.6, 0.5, 0],
  [Math.PI + 0.9, 0.35, 0.46, 0],
  [-0.45, 0.0, 0.34, 1],
  [Math.PI - 0.25, -0.1, 0.3, 1],
  [-Math.PI / 2, 0.7, 0.36, 1],
  [Math.PI / 2 + 0.3, 0.95, 0.26, 0],
  [Math.PI + 0.1, 0.62, 0.36, 0],
].map(([az, el, a, c]) => ({ d: dirOf(az, el), a, c }))

function bodyGeometry(K) {
  const g = new THREE.SphereGeometry(1, 144, 96)
  const p = g.attributes.position
  const col = new Float32Array(p.count * 3)
  const v = new THREE.Vector3()
  const skin = new THREE.Color(K.skin)
  const belly = new THREE.Color(K.belly)
  const patch = K.patches.map((h) => new THREE.Color(h))
  const c = new THREE.Color()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    c.copy(skin).lerp(belly, smooth(-0.12, -0.55, v.y - 0.12 * v.z))
    if (patch.length) CALICO.forEach((s) => c.lerp(patch[s.c], smooth(s.a + 0.05, s.a - 0.03, Math.acos(Math.min(1, v.dot(s.d))))))
    c.toArray(col, i * 3)
    const k = 1 + 0.16 * v.z
    p.setXYZ(i, v.x * k, v.y * k, v.z)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

function useGoldfishGeometry() {
  const geo = useMemo(
    () => ({
      ball: new THREE.SphereGeometry(1, 48, 32),
      smile: new THREE.TorusGeometry(0.05, 0.013, 10, 28, Math.PI).rotateZ(Math.PI),
    }),
    [],
  )
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])
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

// A fin: a thin, soft-edged lozenge of clay whose root sits at the group's origin.
function Fin({ geo, color, len, wide, thick = 0.026, ...props }) {
  return (
    <group {...props}>
      <Clay geometry={geo.ball} color={color} position-z={-len * 0.82} scale={[thick, wide, len]} />
    </group>
  )
}

const EYE_R = 0.22

export function Goldfish({ kind = 'orange' }) {
  const K = KINDS[kind] || KINDS.orange
  const geo = useGoldfishGeometry()
  const body = useMemo(() => bodyGeometry(K), [K])
  useEffect(() => () => body.dispose(), [body])
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const tapAt = useRef(-99)
  const now = useRef(0)
  const bob = useRef()
  const roll = useRef()
  const swim = useRef()
  const chest = useRef()
  const tail = useRef()
  const lobes = useRef([])
  const dorsal = useRef()
  const fins = useRef([])
  const looks = useRef([])

  useFrame(({ clock }) => {
    const t = (now.current = clock.elapsedTime)
    const s = t - tapAt.current
    // the barrel roll: a quick spin about the long axis with a little lift
    let spin = 0
    let lift = 0
    let rush = 0
    const D = 0.78
    if (s >= 0 && s < D) {
      const q = s / D
      spin = q * q * (3 - 2 * q) * TAU
      lift = Math.sin(q * Math.PI) * 0.16
      rush = Math.sin(q * Math.PI)
    }
    const settle = s >= D && s < D + 1.4 ? Math.exp(-4 * (s - D)) * Math.sin((s - D) * 11) : 0
    bob.current.position.y = HOVER + Math.sin(t * 1.6) * 0.055 + lift
    bob.current.rotation.x = Math.sin(t * 1.6 - 0.9) * 0.05
    roll.current.rotation.z = spin + settle * 0.12
    // swimming in place: the body sways a little against the tail's wag
    const w = Math.sin(t * 5.2)
    swim.current.rotation.y = -w * 0.06 + Math.sin(t * 0.45) * 0.1
    const b = 1 + Math.sin(t * 2.1) * 0.012
    chest.current.scale.set(b, b, 1)
    tail.current.rotation.y = Math.sin(t * 5.2 - 0.6) * (0.32 + rush * 0.3)
    lobes.current.forEach((l, i) => l && (l.rotation.y = Math.sin(t * 5.2 - 1.5 - i * 0.2) * 0.22))
    dorsal.current.rotation.z = Math.sin(t * 5.2 - 0.3) * 0.08
    // the pectoral fins paddle, out of step with each other
    fins.current.forEach((f, i) => {
      if (!f) return
      const x = i ? 1 : -1
      f.rotation.set(0.25, -x * (0.55 + Math.sin(t * 4.4 + i * Math.PI) * 0.3 + rush * 0.5), x * -0.45)
    })
    // the eyes roll about together, now and then darting to a new spot
    const ex = Math.sin(t * 0.9) * 0.28 + Math.sin(t * 2.3) * 0.08 + settle * 0.6
    const ey = Math.sin(t * 0.63 + 1) * 0.45 + Math.sin(t * 1.7) * 0.1 + Math.sin(s * 20) * rush * 0.3
    looks.current.forEach((l) => l && l.rotation.set(ex, ey, 0))
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
      rotation-y={1.4}
    >
      <group ref={bob} position-y={HOVER}>
        <group ref={roll}>
          <group ref={swim}>
            {/* body, with its belly and patches drawn in the same egg so they hug it */}
            <group ref={chest}>
              <group scale={BODY}>
                <mesh geometry={body} castShadow receiveShadow>
                  <meshStandardMaterial vertexColors roughness={0.62} metalness={0} />
                </mesh>
              </group>
            </group>

            {/* huge bulging eyes: white globes set half into the head, pupils that roll */}
            {[-1, 1].map((x, i) => (
              <group key={x} position={[x * 0.3, 0.2, 0.4]} rotation={[-0.12, x * 0.72, 0]}>
                <Clay geometry={geo.ball} color="#fbfaf6" roughness={0.32} scale={EYE_R} />
                <group ref={(el) => (looks.current[i] = el)}>
                  <mesh geometry={geo.ball} position-z={EYE_R * 0.8} scale={[EYE_R * 0.52, EYE_R * 0.52, EYE_R * 0.3]}>
                    <meshStandardMaterial color={K.pupil} roughness={0.14} />
                  </mesh>
                  <mesh geometry={geo.ball} position={[EYE_R * 0.16, EYE_R * 0.2, EYE_R * 1.08]} scale={EYE_R * 0.11}>
                    <meshStandardMaterial color="#ffffff" roughness={0.2} />
                  </mesh>
                </group>
              </group>
            ))}

            {/* a tiny smile and rosy cheeks */}
            <mesh geometry={geo.smile} position={[0, -0.1, 0.758]} rotation-x={-0.18}>
              <meshStandardMaterial color={K.lip} roughness={0.5} />
            </mesh>
            {[-1, 1].map((x) => (
              <mesh key={x} geometry={geo.ball} position={[x * 0.2, -0.08, 0.703]} rotation-y={x * 0.5} scale={[0.06, 0.038, 0.02]}>
                <meshStandardMaterial color={K.cheek} roughness={0.8} transparent opacity={0.7} />
              </mesh>
            ))}

            {/* dorsal fin */}
            <group ref={dorsal} position={[0, 0.42, -0.02]}>
              <Fin geo={geo} color={K.fin} len={0.3} wide={0.24} position-y={0.06} rotation-x={-0.42} />
            </group>

            {/* pectoral fins */}
            {[-1, 1].map((x, i) => (
              <group key={x} ref={(el) => (fins.current[i] = el)} position={[x * 0.38, -0.2, 0.18]}>
                <Fin geo={geo} color={K.fin} len={0.19} wide={0.1} thick={0.022} />
              </group>
            ))}

            {/* tail: a soft stalk and a fan of three lobes */}
            <group ref={tail} position={[0, 0, -0.52]}>
              <Clay geometry={geo.ball} color={K.skin} position-z={-0.08} scale={[0.13, 0.19, 0.2]} />
              {[0.62, 0, -0.62].map((a, i) => (
                <group key={a} ref={(el) => (lobes.current[i] = el)} position-z={-0.16}>
                  <Fin geo={geo} color={K.fin} len={a ? 0.36 : 0.26} wide={a ? 0.17 : 0.13} thick={0.028} rotation-x={a} />
                </group>
              ))}
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}

// The goldfish springs in from nothing, overshoots a touch and settles.
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

export default function GoldfishScene({ background = '#f6f4ef', autoRotate = true, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background }}>
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [4.1, 1.65, 3.85], fov: 30, near: 0.05, far: 60 }} gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1 }}>
        <color attach="background" args={[background]} />
        <hemisphereLight args={['#ffffff', '#e8e4ee', 1.6]} />
        <directionalLight position={[3, 6, 5]} intensity={1.9} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.03} shadow-radius={5}>
          <orthographicCamera attach="shadow-camera" args={[-2.2, 2.2, 2.4, -0.6, 0.5, 16]} />
        </directionalLight>
        <directionalLight position={[-5, 3, -4]} intensity={0.9} color="#fff0e0" />
        <PopIn>
          <Goldfish {...props} />
        </PopIn>
        <ContactShadows position={[0, 0, 0]} opacity={0.32} scale={6} blur={3} far={2.2} resolution={512} color="#3a2a28" />
        <OrbitControls makeDefault enablePan={false} target={[0, 0.82, -0.15]} autoRotate={autoRotate} autoRotateSpeed={0.7} minDistance={3} maxDistance={14} maxPolarAngle={1.5} />
      </Canvas>
      <InfoHint>It swims in place, bobbing and wagging its tail and fins, and its eyes roll about on their own · tap it and it does a quick barrel roll · Kind swaps orange, white, black and calico · drag to orbit</InfoHint>
    </div>
  )
}

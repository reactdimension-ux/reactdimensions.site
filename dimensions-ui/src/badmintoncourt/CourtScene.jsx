import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Html, Lightformer, Line, OrbitControls } from '@react-three/drei'
import { EffectComposer, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import Court from './Court.jsx'
import { COURT, FX, FZ, MAT_T, MX, MZ, SLAB } from './textures.js'

const FOV = 30
const T = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
const { L2, W2, S2, short, longD, netPost, netCentre } = COURT
const V = (x, y, z) => new THREE.Vector3(x, y, z)
const BACKDROP = { dark: '#1b1c1f', light: '#e4e5e7' }

// The views on a court drawing sheet, each fitted to the canvas's aspect.
// "Front" is the +x end; "left" is the -z side (the red post).
const quarter = (sx, sz) => (a) => {
  const d = Math.max(20, 12.6 / (T * Math.min(a, 1.9)))
  return { pos: V(sx * 0.62, 0.6, sz * 0.5).normalize().multiplyScalar(d), target: V(0, 0, 0) }
}
const VIEWS = {
  Plan: (a) => ({ pos: V(0, Math.max(FZ * 1.1, (FX * 1.04) / a) / T, 0.001), target: V(0, 0, 0) }),
  Front: (a) => {
    const d = Math.max(16, (FZ * 1.15) / (T * Math.min(a, 1.6)) + FX)
    return { pos: V(d * 0.86, d * 0.5, 0), target: V(0, 0, 0) }
  },
  Rear: (a) => {
    const d = Math.max(16, (FZ * 1.15) / (T * Math.min(a, 1.6)) + FX)
    return { pos: V(-d * 0.86, d * 0.5, 0), target: V(0, 0, 0) }
  },
  Left: (a) => {
    const d = (FX * 1.04) / (T * a) + FZ
    return { pos: V(0, d * 0.09, -d), target: V(0, 0.4, 0) }
  },
  Right: (a) => {
    const d = (FX * 1.04) / (T * a) + FZ
    return { pos: V(0, d * 0.09, d), target: V(0, 0.4, 0) }
  },
  'Front-L': quarter(1, -1),
  'Front-R': quarter(1, 1),
  'Rear-L': quarter(-1, -1),
  'Rear-R': quarter(-1, 1),
  Net: (a) => {
    const k = Math.max(1, 1 / a)
    return { pos: V(1.9 * k, 1.45, -W2 - 1.25 * k), target: V(0, 0.9, -W2 + 0.75) }
  },
  Junction: (a) => {
    const k = Math.max(1, 1 / a)
    return { pos: V(short + 0.55 * k, 0.5 * k, 0.5 * k), target: V(short + 0.02, 0, 0) }
  },
  Corner: (a) => {
    const k = Math.max(1, 1 / a)
    return { pos: V(L2 - 0.7 * k, 0.95 * k, W2 - 0.75 * k), target: V(L2 + 0.15, 0, W2 + 0.12) }
  },
  Surface: (a) => {
    const k = Math.max(1, 1 / a)
    return { pos: V(MX - 0.6 * k, 0.5 * k, MZ - 0.65 * k), target: V(MX - 0.02, 0, MZ - 0.02) }
  },
}
const MAIN = ['Plan', 'Front', 'Rear', 'Left', 'Right', 'Front-L', 'Front-R', 'Rear-L', 'Rear-R']
const DETAIL = ['Net', 'Junction', 'Corner', 'Surface']

// Flies the camera to the chosen view (instantly the first time). The
// canvas draws on demand, so the rig asks for frames while it moves.
function CameraRig({ view }) {
  const { camera, controls, size, invalidate } = useThree()
  const anim = useRef(null)
  const first = useRef(true)
  useEffect(() => {
    if (!controls) return
    const v = (VIEWS[view] || VIEWS['Front-L'])(size.width / size.height)
    if (first.current) {
      first.current = false
      camera.position.copy(v.pos)
      controls.target.copy(v.target)
      controls.update()
      invalidate()
      return
    }
    anim.current = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1: v.pos, t1: v.target, lift: camera.position.distanceTo(v.pos) * 0.12 }
    invalidate()
  }, [view, controls, camera, size.width, size.height, invalidate])
  useFrame((_, dt) => {
    const a = anim.current
    if (!a || !controls) return
    a.t = Math.min(1, a.t + Math.min(dt, 1 / 30) / 1.6)
    const k = a.t < 0.5 ? 4 * a.t * a.t * a.t : 1 - Math.pow(-2 * a.t + 2, 3) / 2
    camera.position.lerpVectors(a.p0, a.p1, k)
    camera.position.y += Math.sin(Math.PI * k) * a.lift
    controls.target.lerpVectors(a.t0, a.t1, k)
    controls.update()
    invalidate()
    if (a.t >= 1) anim.current = null
  })
  return null
}

// Sports-hall light: rows of LED panels overhead (which the varnish and the
// mat's sheen reflect), pale walls, and one high key light for shadows.
function Hall({ brightness }) {
  const panels = []
  for (let i = -2; i <= 2; i++) for (let j = -1; j <= 1; j++) panels.push([i * 4.2, j * 4.5])
  return (
    <Environment resolution={512} frames={1}>
      <color attach="background" args={['#3a3b3e']} />
      {panels.map(([x, z]) => (
        <Lightformer key={`${x},${z}`} form="rect" intensity={3.2 * brightness} color="#fbfaf6" position={[x, 9, z]} rotation-x={Math.PI / 2} scale={[2.6, 0.6, 1]} />
      ))}
      <Lightformer form="rect" intensity={0.5 * brightness} color="#e8e6e0" position={[0, 4, -14]} scale={[40, 8, 1]} />
      <Lightformer form="rect" intensity={0.5 * brightness} color="#e8e6e0" position={[0, 4, 14]} rotation-y={Math.PI} scale={[40, 8, 1]} />
      <Lightformer form="rect" intensity={0.4 * brightness} color="#ece6da" position={[18, 4, 0]} rotation-y={-Math.PI / 2} scale={[30, 8, 1]} />
      <Lightformer form="rect" intensity={0.4 * brightness} color="#ece6da" position={[-18, 4, 0]} rotation-y={Math.PI / 2} scale={[30, 8, 1]} />
    </Environment>
  )
}

function KeyLight() {
  return (
    <directionalLight position={[-6, 18, -5]} intensity={1.4} color="#fffaf2" castShadow shadow-mapSize={[4096, 4096]} shadow-bias={-0.0002} shadow-normalBias={0.015}>
      <orthographicCamera attach="shadow-camera" args={[-13, 13, 13, -13, 1, 50]} />
    </directionalLight>
  )
}

function Floor({ dark }) {
  const y = -SLAB
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position-y={y - 0.0005} receiveShadow>
        <planeGeometry args={[300, 300]} />
        <shadowMaterial opacity={dark ? 0.5 : 0.2} />
      </mesh>
      <ContactShadows position={[0, y + 0.002, 0]} scale={[2 * FX + 5, 2 * FZ + 5]} resolution={1024} blur={2.4} far={0.25} opacity={dark ? 0.8 : 0.5} color="#0c0d0f" frames={1} />
    </>
  )
}

// ---- dimension callouts ----
function Label({ position, children, small, dark }) {
  return (
    <Html position={position} center zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
      <div style={{ whiteSpace: 'nowrap', padding: small ? '3px 7px' : '4px 9px', borderRadius: 999, background: dark ? 'rgba(20,21,24,0.86)' : 'rgba(255,255,255,0.92)', color: dark ? '#eceae4' : '#26241f', font: `600 ${small ? 10 : 11}px/1.2 ui-monospace, Menlo, monospace`, letterSpacing: '0.04em', boxShadow: dark ? '0 2px 8px rgba(0,0,0,.4), inset 0 0 0 1px rgba(255,255,255,.12)' : '0 2px 8px rgba(0,0,0,.14), inset 0 0 0 1px rgba(0,0,0,.08)' }}>{children}</div>
    </Html>
  )
}
function Dim({ a, b, tick, label, at, small, dark }) {
  const A = V(...a)
  const B = V(...b)
  const t = V(...tick)
  const ink = dark ? '#e8e6e0' : '#26241f'
  return (
    <group>
      <Line points={[A.clone().add(t), A.clone().sub(t)]} color={ink} lineWidth={1.4} />
      <Line points={[A, B]} color={ink} lineWidth={1.4} />
      <Line points={[B.clone().add(t), B.clone().sub(t)]} color={ink} lineWidth={1.4} />
      <Label position={at || A.clone().lerp(B, 0.5).toArray()} small={small} dark={dark}>
        {label}
      </Label>
    </group>
  )
}
function Dimensions({ dark }) {
  const { camera } = useThree()
  const [near, setNear] = useState(false)
  const anchors = useMemo(() => [V(0, 1, -W2), V(0, 1, W2)], [])
  useFrame(() => {
    const n = Math.min(...anchors.map((p) => camera.position.distanceTo(p))) < 4.5
    if (n !== near) setNear(n)
  })
  const y = MAT_T + 0.01
  const p = { dark }
  return (
    <group>
      {!near && (
        <>
          <Dim {...p} a={[-L2, y, -MZ - 0.6]} b={[L2, y, -MZ - 0.6]} tick={[0, 0, 0.18]} label="13.40 m" />
          <Dim {...p} a={[MX + 0.6, y, -W2]} b={[MX + 0.6, y, W2]} tick={[0.18, 0, 0]} label="6.10 m · doubles" />
          <Dim {...p} a={[-MX - 0.6, y, -S2]} b={[-MX - 0.6, y, S2]} tick={[0.16, 0, 0]} label="5.18 m · singles" small />
          <Dim {...p} a={[0, y, MZ + 0.5]} b={[short, y, MZ + 0.5]} tick={[0, 0, 0.12]} label="1.98 m" small />
          <Dim {...p} a={[L2 - longD, y, MZ + 0.5]} b={[L2, y, MZ + 0.5]} tick={[0, 0, 0.12]} label="0.76 m" small at={[L2 - longD / 2, y, MZ + 0.85]} />
        </>
      )}
      {near && (
        <>
          <Dim {...p} a={[0.18, MAT_T, -W2]} b={[0.18, MAT_T + netPost, -W2]} tick={[0.03, 0, 0]} label="post 1.55 m" small at={[0.18, MAT_T + netPost + 0.09, -W2]} />
          <Dim {...p} a={[0.18, MAT_T, 0]} b={[0.18, MAT_T + netCentre, 0]} tick={[0.03, 0, 0]} label="net 1.524 m" small at={[0.18, MAT_T + netCentre + 0.09, 0]} />
        </>
      )}
    </group>
  )
}

function Effects({ ao }) {
  return (
    <EffectComposer disableNormalPass multisampling={0}>
      {ao && <N8AO aoRadius={0.25} distanceFalloff={0.6} intensity={2.2} quality="medium" halfRes />}
      <SMAA />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}

const segBtn = (on) => ({
  height: 28,
  padding: '0 10px',
  borderRadius: 14,
  border: 'none',
  cursor: 'pointer',
  background: on ? '#1c1a16' : 'transparent',
  color: on ? '#f4f1ea' : '#2a2925',
  font: '600 10.5px/1 ui-monospace, Menlo, monospace',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
})

export default function CourtScene({ matColor = '#2c7a4b', lineColor = '#f3f3ee', woodColor = '#d9a86c', postColorA = '#b3181d', postColorB = '#1c3f9c', netColor = '#2a1915', wear = 0.3, shuttles = true, lights = 1, backdrop = 'dark', dimensions = true, ambientOcclusion = true, autoRotate = false, view: initialView = 'Front-L' }) {
  const [view, setView] = useState(initialView)
  useEffect(() => setView(initialView), [initialView])
  const dark = backdrop !== 'light'
  const bg = BACKDROP[dark ? 'dark' : 'light']
  const pill = { pointerEvents: 'auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 2, padding: 3, borderRadius: 17, background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', boxShadow: '0 2px 10px rgba(0,0,0,.12), inset 0 0 0 1px rgba(0,0,0,.07)' }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background: bg }}>
      <Canvas frameloop={autoRotate ? 'always' : 'demand'} shadows dpr={[1, 1.75]} camera={{ position: [14, 9, -11], fov: FOV, near: 0.02, far: 400 }} gl={{ antialias: false, powerPreference: 'high-performance' }}>
        <color attach="background" args={[bg]} />
        <Floor dark={dark} />
        <hemisphereLight args={['#ffffff', '#6b5a48', 0.2 * lights]} />
        <KeyLight />
        <Hall brightness={lights} />
        <Court matColor={matColor} lineColor={lineColor} woodColor={woodColor} postColorA={postColorA} postColorB={postColorB} netColor={netColor} wear={wear} shuttles={shuttles} />
        {dimensions && <Dimensions dark={dark} />}
        <CameraRig view={view} />
        <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate} autoRotateSpeed={0.4} minDistance={0.12} maxDistance={90} maxPolarAngle={1.56} />
        <Effects ao={ambientOcclusion} />
      </Canvas>

      <div style={{ position: 'absolute', top: 12, left: 0, right: 0, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 6, pointerEvents: 'none', padding: '0 12px' }}>
        <div role="tablist" aria-label="Camera view" style={pill}>
          {MAIN.map((v) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} style={segBtn(view === v)} onClick={() => setView(v)}>
              {v}
            </button>
          ))}
        </div>
        <div role="tablist" aria-label="Close-ups" style={pill}>
          {DETAIL.map((v) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} style={segBtn(view === v)} onClick={() => setView(v)}>
              {v}
            </button>
          ))}
        </div>
      </div>
      <InfoHint>
        A BWF court at full size: 13.40 × 6.10 m, 40 mm lines measured to their outside edges · a PVC court mat in four welded rolls on a varnished maple floor that mirrors the hall lights · the net is 1.55 m at the posts and 1.524 m at the centre · raise wear for sole marks and dull patches · pick a view, or drag to orbit and scroll right down to a shuttle
      </InfoHint>
    </div>
  )
}

// The usage tips live behind a small "i" button in the corner instead of a
// line of text over the scene: hover it (or tap it) to read them.
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
        <div role="tooltip" style={{ maxWidth: 340, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', boxShadow: '0 8px 24px rgba(0,0,0,.14), inset 0 0 0 1px rgba(0,0,0,.06)', font: '500 11px/1.6 ui-monospace, Menlo, monospace', letterSpacing: '0.03em', color: '#2a2925', textAlign: 'left' }}>
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

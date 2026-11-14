import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Html, Lightformer, Line, OrbitControls, Sky } from '@react-three/drei'
import { EffectComposer, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import Court from './Court.jsx'
import { COURT, HX, HZ, LAWN_TILE, buildLawn } from './textures.js'

const STUDIO_BG = '#e4e6e9'
const FOV = 30
const T = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
const { L2, W2, S2, SV, postZ, netPost, netCentre } = COURT
const V = (x, y, z) => new THREE.Vector3(x, y, z)

// The views on a court drawing sheet, each fitted to the canvas's aspect.
// North is -z (the winder post's side), west is -x.
const corner = (sx, sz) => (a) => {
  const d = Math.max(30, 20.5 / (T * Math.min(a, 1.9)))
  return { pos: V(sx * 0.6, 0.62, sz * 0.5).normalize().multiplyScalar(d), target: V(0, 0, 0) }
}
const VIEWS = {
  Plan: (a) => ({ pos: V(0, Math.max(HZ * 1.1, (HX * 1.05) / a) / T, 0.001), target: V(0, 0, 0) }),
  Front: (a) => ({ pos: V(HX + 4 + 3 / Math.min(a, 1), 1.75, 0), target: V(0, 0.45, 0) }),
  Rear: (a) => ({ pos: V(-(HX + 4 + 3 / Math.min(a, 1)), 1.75, 0), target: V(0, 0.45, 0) }),
  Left: (a) => {
    const d = (HX * 1.04) / (T * a) + HZ
    return { pos: V(0, d * 0.035, -d), target: V(0, 0.35, 0) }
  },
  Right: (a) => {
    const d = (HX * 1.04) / (T * a) + HZ
    return { pos: V(0, d * 0.035, d), target: V(0, 0.35, 0) }
  },
  NW: corner(-1, -1),
  NE: corner(1, -1),
  SW: corner(-1, 1),
  SE: corner(1, 1),
  Net: (a) => {
    const k = Math.max(1, 1 / a)
    return { pos: V(1.0 * k, 0.98, 2.1 + 0.6 * k), target: V(0, 0.72, 1.35) }
  },
  Post: (a) => {
    const k = Math.max(1, 1 / a)
    return { pos: V(1.55 * k, 1.05, -postZ - 1.35 * k), target: V(0, 0.6, -postZ) }
  },
  Line: (a) => {
    const k = Math.max(1, 1 / a)
    return { pos: V(SV - 0.32 * k, 0.36 * k, 1.8 - 0.3 * k), target: V(SV - 0.02, 0, 2.05) }
  },
  Corner: (a) => {
    const k = Math.max(1, 1 / a)
    return { pos: V(L2 - 0.8 * k, 1.05 * k, W2 - 0.9 * k), target: V(L2 - 0.1, 0, W2 - 0.1) }
  },
}
const MAIN = ['Plan', 'Front', 'Rear', 'Left', 'Right', 'NW', 'NE', 'SW', 'SE']
const DETAIL = ['Net', 'Post', 'Line', 'Corner']

// Flies the camera to the chosen view (instantly the first time). The
// canvas draws on demand, so the rig asks for frames while it moves.
function CameraRig({ view }) {
  const { camera, controls, size, invalidate } = useThree()
  const anim = useRef(null)
  const first = useRef(true)
  useEffect(() => {
    if (!controls) return
    const v = (VIEWS[view] || VIEWS.NW)(size.width / size.height)
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

function sunDir(elevation) {
  const e = THREE.MathUtils.degToRad(elevation)
  const az = 2.45 // from the north-west, so the net's shadow falls across the court
  return new THREE.Vector3(Math.cos(e) * Math.cos(az), Math.sin(e), -Math.cos(e) * Math.sin(az))
}

function Sun({ elevation, outdoor }) {
  const dir = useMemo(() => sunDir(elevation), [elevation])
  const color = useMemo(() => new THREE.Color('#ffe0b8').lerp(new THREE.Color('#fff8ef'), THREE.MathUtils.smoothstep(elevation, 8, 45)), [elevation])
  return (
    <directionalLight position={dir.clone().multiplyScalar(60).toArray()} intensity={outdoor ? 2.7 : 1.9} color={color} castShadow shadow-mapSize={[4096, 4096]} shadow-bias={-0.0002} shadow-normalBias={0.02}>
      <orthographicCamera attach="shadow-camera" args={[-22, 22, 22, -22, 1, 140]} />
    </directionalLight>
  )
}

function Ambient({ outdoor }) {
  return (
    <Environment resolution={256} frames={1}>
      <color attach="background" args={[outdoor ? '#8ea8c0' : '#c8cacd']} />
      <Lightformer form="rect" intensity={outdoor ? 1.3 : 1.15} color={outdoor ? '#dde8f4' : '#ffffff'} position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={[30, 30, 1]} />
      <Lightformer form="rect" intensity={1.1} color="#fff1df" position={[-10, 5, -8]} rotation-y={Math.PI / 4} scale={[8, 6, 1]} />
      <Lightformer form="rect" intensity={0.7} color="#eef3ff" position={[10, 4, 8]} rotation-y={-Math.PI / 1.4} scale={[10, 5, 1]} />
      <Lightformer form="rect" intensity={0.25} color={outdoor ? '#8a8f7a' : '#d6d2ca'} position={[0, -8, 0]} rotation-x={-Math.PI / 2} scale={[40, 40, 1]} />
    </Environment>
  )
}

function Floor() {
  const y = -COURT.slab
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position-y={y - 0.0005} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <shadowMaterial opacity={0.2} />
      </mesh>
      <ContactShadows position={[0, y + 0.002, 0]} scale={[2 * HX + 6, 2 * HZ + 6]} resolution={1024} blur={2.4} far={0.3} opacity={0.55} color="#24262a" frames={1} />
    </>
  )
}

// lawn round the slab, with the slab's footprint cut out so it sits in it
function Lawn() {
  const tex = useMemo(() => {
    const t = buildLawn()
    t.repeat.set(1 / LAWN_TILE, 1 / LAWN_TILE)
    return t
  }, [])
  const geo = useMemo(() => {
    const s = new THREE.Shape().absarc(0, 0, 220, 0, Math.PI * 2, false)
    s.holes.push(new THREE.Path([V(-HX, -HZ, 0), V(-HX, HZ, 0), V(HX, HZ, 0), V(HX, -HZ, 0)].map((p) => new THREE.Vector2(p.x, p.y))))
    return new THREE.ShapeGeometry(s, 96)
  }, [])
  useEffect(() => () => (tex.dispose(), geo.dispose()), [tex, geo])
  return (
    <mesh geometry={geo} rotation-x={-Math.PI / 2} position-y={-0.03} receiveShadow>
      <meshStandardMaterial map={tex} roughness={0.95} />
    </mesh>
  )
}

// ---- dimension callouts ----
const INK = '#26241f'
function Label({ position, children, small }) {
  return (
    <Html position={position} center zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
      <div style={{ whiteSpace: 'nowrap', padding: small ? '3px 7px' : '4px 9px', borderRadius: 999, background: 'rgba(255,255,255,0.92)', color: INK, font: `600 ${small ? 10 : 11}px/1.2 ui-monospace, Menlo, monospace`, letterSpacing: '0.04em', boxShadow: '0 2px 8px rgba(0,0,0,.14), inset 0 0 0 1px rgba(0,0,0,.08)' }}>{children}</div>
    </Html>
  )
}
function Dim({ a, b, tick, label, at, small }) {
  const A = V(...a)
  const B = V(...b)
  const t = V(...tick)
  return (
    <group>
      <Line points={[A.clone().add(t), A.clone().sub(t)]} color={INK} lineWidth={1.4} />
      <Line points={[A, B]} color={INK} lineWidth={1.4} />
      <Line points={[B.clone().add(t), B.clone().sub(t)]} color={INK} lineWidth={1.4} />
      <Label position={at || A.clone().lerp(B, 0.5).toArray()} small={small}>
        {label}
      </Label>
    </group>
  )
}
function Dimensions() {
  const { camera } = useThree()
  const [near, setNear] = useState(false)
  const netPost0 = useMemo(() => V(0, 0.6, -postZ), [])
  useFrame(() => {
    const n = Math.min(camera.position.distanceTo(netPost0), camera.position.distanceTo(V(0, 0.6, 0))) < 5
    if (n !== near) setNear(n)
  })
  const y = 0.02
  return (
    <group>
      {!near && (
        <>
          <Dim a={[-L2, y, -W2 - 1.4]} b={[L2, y, -W2 - 1.4]} tick={[0, 0, 0.3]} label="23.77 m · 78 ft" />
          <Dim a={[L2 + 1.6, y, -W2]} b={[L2 + 1.6, y, W2]} tick={[0.3, 0, 0]} label="10.97 m · doubles" />
          <Dim a={[-L2 - 1.6, y, -S2]} b={[-L2 - 1.6, y, S2]} tick={[0.25, 0, 0]} label="8.23 m · singles" small />
          <Dim a={[0, y, W2 + 1.0]} b={[SV, y, W2 + 1.0]} tick={[0, 0, 0.2]} label="6.40 m" small />
        </>
      )}
      {near && (
        <>
          <Dim a={[0.25, 0, -postZ + 0.2]} b={[0.25, netPost, -postZ + 0.2]} tick={[0.04, 0, 0]} label="1.07 m" small at={[0.25, netPost + 0.1, -postZ + 0.2]} />
          <Dim a={[0.25, 0, 0]} b={[0.25, netCentre, 0]} tick={[0.04, 0, 0]} label="0.914 m" small at={[0.25, netCentre + 0.1, 0]} />
        </>
      )}
    </group>
  )
}

function Effects({ ao }) {
  return (
    <EffectComposer disableNormalPass multisampling={0}>
      {ao && <N8AO aoRadius={0.3} distanceFalloff={0.6} intensity={2.2} quality="medium" halfRes />}
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

export default function CourtScene({ courtColor = '#21406f', surroundColor = '#3a6a3e', lineColor = '#f4f4f0', postColor = '#1f4a30', wear = 0.35, sun = 40, setting = 'studio', dimensions = true, ambientOcclusion = true, autoRotate = false, view: initialView = 'NW' }) {
  const [view, setView] = useState(initialView)
  useEffect(() => setView(initialView), [initialView])
  const outdoor = setting === 'outdoor'
  const sunPos = useMemo(() => sunDir(sun).multiplyScalar(100).toArray(), [sun])
  const pill = { pointerEvents: 'auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 2, padding: 3, borderRadius: 17, background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', boxShadow: '0 2px 10px rgba(0,0,0,.12), inset 0 0 0 1px rgba(0,0,0,.07)' }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background: outdoor ? '#b9c9d6' : STUDIO_BG }}>
      <Canvas frameloop={autoRotate ? 'always' : 'demand'} shadows dpr={[1, 1.75]} camera={{ position: [-20, 18, -16], fov: FOV, near: 0.02, far: 800 }} gl={{ antialias: false, powerPreference: 'high-performance' }}>
        {outdoor ? (
          <>
            <Sky sunPosition={sunPos} turbidity={6} rayleigh={1.3} mieCoefficient={0.004} mieDirectionalG={0.86} />
            <fog attach="fog" args={['#c3d0d9', 60, 320]} />
            <Lawn />
          </>
        ) : (
          <>
            <color attach="background" args={[STUDIO_BG]} />
            <Floor />
          </>
        )}
        <hemisphereLight args={[outdoor ? '#cfe0f0' : '#ffffff', outdoor ? '#77735e' : '#cfc8bb', 0.25]} />
        <Sun elevation={sun} outdoor={outdoor} />
        <Ambient outdoor={outdoor} />
        <Court courtColor={courtColor} surroundColor={surroundColor} lineColor={lineColor} postColor={postColor} wear={wear} />
        {dimensions && <Dimensions />}
        <CameraRig view={view} />
        <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate} autoRotateSpeed={0.4} minDistance={0.2} maxDistance={140} maxPolarAngle={1.56} />
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
        A regulation hard court at full size: 23.77 × 10.97 m inside the lines, with the recommended run-off · the lines are exact and stay sharp however close you get · the net hangs 1.07 m at the posts and 0.914 m at the centre strap: click the crank on the winder post to tighten or slacken it · raise wear for rubber scuffs, ball marks and a faded baseline · pick a view, or drag to orbit and scroll down to the surface
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

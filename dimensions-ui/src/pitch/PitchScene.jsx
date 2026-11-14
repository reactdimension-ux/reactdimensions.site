import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Html, Lightformer, Line, OrbitControls, Sky } from '@react-three/drei'
import { EffectComposer, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import Pitch from './Pitch.jsx'
import { LEN, OUTFIELD_TILE, PITCH, POPPING_Z, STUMP, STUMPS_Z, buildOutfield } from './textures.js'

const STUDIO_BG = '#e6e7e9'
const FOV = 30
const T = Math.tan(THREE.MathUtils.degToRad(FOV / 2))

// The views on the reference sheet. Each returns a camera position and a
// target, fitted to the canvas's aspect ratio.
const VIEWS = {
  '3D': (a) => {
    const dir = a < 1 ? new THREE.Vector3(0.32, 0.62, 0.72) : new THREE.Vector3(0.66, 0.52, 0.54)
    const d = Math.max(19, 11.8 / (T * Math.min(a, 1.9)))
    return { pos: dir.normalize().multiplyScalar(d), target: new THREE.Vector3(0, 0, 0) }
  },
  Top: (a) => {
    const d = Math.max((LEN / 2) * 1.08, (PITCH.w / 2) * 1.4 / a) / T
    return { pos: new THREE.Vector3(0, d, 0.001), target: new THREE.Vector3(0, 0, 0) }
  },
  Side: (a) => {
    const d = ((LEN / 2) * 1.06) / (T * a) + PITCH.w / 2
    return { pos: new THREE.Vector3(d, d * 0.07, 0), target: new THREE.Vector3(0, 0.1, 0) }
  },
  End: (a) => {
    const back = 4 + 2.5 / Math.min(a, 1)
    return { pos: new THREE.Vector3(0, 1.45, LEN / 2 + back), target: new THREE.Vector3(0, 0.25, 2) }
  },
  Stumps: (a) => {
    const d = 0.5 / (T * Math.min(a, 1)) + 0.25
    return { pos: new THREE.Vector3(0.42, 0.62, STUMPS_Z - d), target: new THREE.Vector3(0, 0.37, STUMPS_Z) }
  },
  Surface: (a) => {
    const k = Math.max(1, 1 / a)
    return { pos: new THREE.Vector3(0.35, 0.95 * k, POPPING_Z - 1.0 * k), target: new THREE.Vector3(0.95, 0, POPPING_Z + 0.2) }
  },
}
const PITCH_VIEWS = Object.keys(VIEWS)

// Moves the camera to the chosen view: instantly on first show, otherwise
// along an easy arc. The orbit controls stay live the whole time.
// The scene only draws on demand (it is still unless something moves), so
// the rig asks for frames while it is flying.
function CameraRig({ view }) {
  const { camera, controls, size, invalidate } = useThree()
  const anim = useRef(null)
  const first = useRef(true)
  useEffect(() => {
    if (!controls) return
    const v = (VIEWS[view] || VIEWS['3D'])(size.width / size.height)
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
    a.t = Math.min(1, a.t + Math.min(dt, 1 / 30) / 1.5)
    invalidate()
    const k = a.t < 0.5 ? 4 * a.t * a.t * a.t : 1 - Math.pow(-2 * a.t + 2, 3) / 2
    camera.position.lerpVectors(a.p0, a.p1, k)
    camera.position.y += Math.sin(Math.PI * k) * a.lift
    controls.target.lerpVectors(a.t0, a.t1, k)
    controls.update()
    if (a.t >= 1) anim.current = null
  })
  return null
}

function sunDir(elevation) {
  const e = THREE.MathUtils.degToRad(elevation)
  const az = 3.75 // low and from the far corner, so shadows fall across the pitch
  return new THREE.Vector3(Math.cos(e) * Math.cos(az), Math.sin(e), Math.cos(e) * Math.sin(az))
}

function Sun({ elevation, field }) {
  const dir = useMemo(() => sunDir(elevation), [elevation])
  const warm = new THREE.Color('#ffe2bd').lerp(new THREE.Color('#fff8ee'), THREE.MathUtils.smoothstep(elevation, 8, 45))
  return (
    <directionalLight
      position={dir.clone().multiplyScalar(40).toArray()}
      intensity={field ? 3.1 : 2.6}
      color={warm}
      castShadow
      shadow-mapSize={[4096, 4096]}
      shadow-bias={-0.00015}
      shadow-normalBias={0.012}
    >
      <orthographicCamera attach="shadow-camera" args={[-13, 13, 13, -13, 1, 90]} />
    </directionalLight>
  )
}

// soft light all round: a broad sky overhead and a warm bounce off the ground
function Ambient({ field }) {
  return (
    <Environment resolution={256} frames={1}>
      <color attach="background" args={[field ? '#8fa7bd' : '#c9cbcf']} />
      <Lightformer form="rect" intensity={field ? 1.6 : 1.8} color={field ? '#dfe9f5' : '#ffffff'} position={[0, 10, 0]} rotation-x={Math.PI / 2} scale={[20, 20, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#fff1df" position={[-8, 4, -6]} rotation-y={Math.PI / 4} scale={[6, 5, 1]} />
      <Lightformer form="rect" intensity={0.7} color="#eef3ff" position={[8, 3, 6]} rotation-y={-Math.PI / 1.4} scale={[8, 4, 1]} />
      <Lightformer form="rect" intensity={field ? 0.22 : 0.35} color={field ? '#8c9078' : '#d8d2c6'} position={[0, -6, 0]} rotation-x={-Math.PI / 2} scale={[30, 30, 1]} />
    </Environment>
  )
}

function Floor() {
  const y = -PITCH.slab
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position-y={y - 0.0005} receiveShadow>
        <planeGeometry args={[300, 300]} />
        <shadowMaterial opacity={0.2} />
      </mesh>
      <ContactShadows position={[0, y + 0.002, 0]} scale={[7, 28]} resolution={1024} blur={2.4} far={0.35} opacity={0.6} color="#2a2620" frames={1} />
    </>
  )
}

function Outfield() {
  const tex = useMemo(() => {
    const t = buildOutfield()
    t.repeat.set(1 / OUTFIELD_TILE, 1 / OUTFIELD_TILE) // shape UVs are in metres
    return t
  }, [])
  // a disc of outfield with the pitch cut out of it, so the block (and its
  // footmarks, pressed below the outfield's level) sits in the hole
  const geo = useMemo(() => {
    const s = new THREE.Shape().absarc(0, 0, 200, 0, Math.PI * 2, false)
    const hw = PITCH.w / 2
    const hl = LEN / 2
    s.holes.push(new THREE.Path([new THREE.Vector2(-hw, -hl), new THREE.Vector2(-hw, hl), new THREE.Vector2(hw, hl), new THREE.Vector2(hw, -hl)]))
    return new THREE.ShapeGeometry(s, 96)
  }, [])
  useEffect(() => () => (tex.dispose(), geo.dispose()), [tex, geo])
  return (
    <mesh geometry={geo} rotation-x={-Math.PI / 2} position-y={-0.004} receiveShadow>
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
// a dimension line from a to b with end ticks along `tick`
function Dim({ a, b, tick, label, at, small }) {
  const A = new THREE.Vector3(...a)
  const B = new THREE.Vector3(...b)
  const t = new THREE.Vector3(...tick)
  const pts = [A.clone().add(t), A.clone().sub(t), A, B, B.clone().add(t), B.clone().sub(t)]
  return (
    <group>
      <Line points={[pts[0], pts[1]]} color={INK} lineWidth={1.4} />
      <Line points={[pts[2], pts[3]]} color={INK} lineWidth={1.4} />
      <Line points={[pts[4], pts[5]]} color={INK} lineWidth={1.4} />
      <Label position={at || A.clone().lerp(B, 0.5).toArray()} small={small}>
        {label}
      </Label>
    </group>
  )
}
function Dimensions() {
  const { camera } = useThree()
  const [near, setNear] = useState(false)
  const stumpsAt = useMemo(() => new THREE.Vector3(0, 0.4, STUMPS_Z), [])
  useFrame(() => {
    const n = camera.position.distanceTo(stumpsAt) < 4.5
    if (n !== near) setNear(n)
  })
  const y = 0.02
  const half = 0.2286 / 2
  return (
    <group>
      {!near && (
        <>
          <Dim a={[-PITCH.w / 2 - 0.5, y, -STUMPS_Z]} b={[-PITCH.w / 2 - 0.5, y, STUMPS_Z]} tick={[0.18, 0, 0]} label="20.12 m · 22 yd" />
          <Dim a={[-PITCH.w / 2, y, LEN / 2 + 0.5]} b={[PITCH.w / 2, y, LEN / 2 + 0.5]} tick={[0, 0, 0.18]} label="3.05 m · 10 ft" />
          <Dim a={[PITCH.w / 2 + 0.4, y, POPPING_Z]} b={[PITCH.w / 2 + 0.4, y, STUMPS_Z]} tick={[0.12, 0, 0]} label="1.22 m" small at={[PITCH.w / 2 + 0.95, y, (POPPING_Z + STUMPS_Z) / 2]} />
        </>
      )}
      {near && (
        <>
          <Dim a={[-half, STUMP.h + 0.07, STUMPS_Z]} b={[half, STUMP.h + 0.07, STUMPS_Z]} tick={[0, 0.015, 0]} label="22.86 cm" small at={[0, STUMP.h + 0.115, STUMPS_Z]} />
          <Dim a={[-half - 0.07, 0, STUMPS_Z]} b={[-half - 0.07, STUMP.h, STUMPS_Z]} tick={[0.015, 0, 0]} label="71.1 cm" small at={[-half - 0.16, STUMP.h / 2, STUMPS_Z]} />
          <Dim a={[0.35, y, POPPING_Z]} b={[0.35, y, STUMPS_Z]} tick={[0.05, 0, 0]} label="1.22 m" small at={[0.55, y, (POPPING_Z + STUMPS_Z) / 2]} />
        </>
      )}
    </group>
  )
}

function Effects({ ao }) {
  return (
    <EffectComposer disableNormalPass multisampling={0}>
      {ao && <N8AO aoRadius={0.35} distanceFalloff={0.6} intensity={2.4} quality="medium" halfRes />}
      <SMAA />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}

const segBtn = (on) => ({
  height: 30,
  padding: '0 12px',
  borderRadius: 15,
  border: 'none',
  cursor: 'pointer',
  background: on ? '#1c1a16' : 'transparent',
  color: on ? '#f4f1ea' : '#2a2925',
  font: '600 11px/1 ui-monospace, Menlo, monospace',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
})

export default function PitchScene({ wear = 0.45, grass = 0.6, sun = 34, stumpWood = '#dcb98a', setting = 'studio', dimensions = true, ambientOcclusion = true, autoRotate = false, view: initialView = '3D' }) {
  const [view, setView] = useState(initialView)
  useEffect(() => setView(initialView), [initialView])
  const field = setting === 'field'
  const sunPos = useMemo(() => sunDir(sun).multiplyScalar(100).toArray(), [sun])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background: field ? '#b9c9d6' : STUDIO_BG }}>
      <Canvas frameloop={autoRotate ? 'always' : 'demand'} shadows dpr={[1, 1.75]} camera={{ position: [14, 11, 12], fov: FOV, near: 0.02, far: 600 }} gl={{ antialias: false, powerPreference: 'high-performance' }}>
        {field ? (
          <>
            <Sky sunPosition={sunPos} turbidity={6} rayleigh={1.3} mieCoefficient={0.004} mieDirectionalG={0.86} />
            <fog attach="fog" args={['#c3d0d9', 40, 260]} />
            <Outfield />
          </>
        ) : (
          <>
            <color attach="background" args={[STUDIO_BG]} />
            <Floor />
          </>
        )}
        <hemisphereLight args={[field ? '#cfe0f0' : '#ffffff', field ? '#77735e' : '#cfc8bb', 0.25]} />
        <Sun elevation={sun} field={field} />
        <Ambient field={field} />
        <Pitch wear={wear} grass={grass} stumpWood={stumpWood} />
        {dimensions && <Dimensions />}
        <CameraRig view={view} />
        <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate} autoRotateSpeed={0.4} minDistance={0.25} maxDistance={90} maxPolarAngle={field ? 1.5 : 1.62} />
        <Effects ao={ambientOcclusion} />
      </Canvas>

      <div style={{ position: 'absolute', top: 12, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none', padding: '0 12px' }}>
        <div role="tablist" aria-label="Camera view" style={{ pointerEvents: 'auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 2, padding: 3, borderRadius: 18, background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', boxShadow: '0 2px 10px rgba(0,0,0,.12), inset 0 0 0 1px rgba(0,0,0,.07)' }}>
          {PITCH_VIEWS.map((v) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} style={segBtn(view === v)} onClick={() => setView(v)}>
              {v}
            </button>
          ))}
        </div>
      </div>
      <InfoHint>
        A regulation pitch at full size: 20.12 m between the stumps, 3.05 m wide, creases painted to the Laws · the grass is real blades, worn away where bowlers land and the ball pitches · raise wear to go from a green first morning to a cracked, footmarked fifth day · pick a view, or drag to orbit and scroll to get down to the turf
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

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Airliner from './Airliner.jsx'

const BG = '#cdd0d2'
const FOV = 26
const TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2))

// A photo studio big enough for an aircraft: one huge soft box overhead and
// long strips down each side, which is what the paint and the glass mirror.
function Studio() {
  return (
    <Environment resolution={512} frames={1}>
      <color attach="background" args={['#8d9195']} />
      <Lightformer form="rect" intensity={1.9} color="#ffffff" position={[0, 60, 0]} rotation-x={Math.PI / 2} scale={[150, 90, 1]} />
      <Lightformer form="rect" intensity={1.25} color="#fff6ea" position={[-30, 22, 70]} rotation-y={Math.PI} scale={[110, 22, 1]} />
      <Lightformer form="rect" intensity={1.0} color="#eaf1ff" position={[30, 22, -70]} scale={[110, 22, 1]} />
      <Lightformer form="rect" intensity={0.9} color="#ffffff" position={[-80, 18, 0]} rotation-y={Math.PI / 2} scale={[70, 20, 1]} />
      <Lightformer form="rect" intensity={0.7} color="#ffffff" position={[80, 18, 0]} rotation-y={-Math.PI / 2} scale={[70, 20, 1]} />
      {/* the studio floor, so the belly reflects something */}
      <Lightformer form="rect" intensity={0.5} color="#c9cbcd" position={[0, -30, 0]} rotation-x={-Math.PI / 2} scale={[300, 300, 1]} />
    </Environment>
  )
}

// The views of a reference sheet. Each gives a camera position and target for
// the canvas aspect: the whole-aircraft ones back off until it fits.
const fit = (w, h, aspect) => Math.max(h / 2 / TAN, w / 2 / (TAN * aspect)) * 1.1
const V = (x, y, z) => new THREE.Vector3(x, y, z)
const from = (target, dir, dist) => ({ target, pos: target.clone().addScaledVector(dir.normalize(), dist) })
const VIEWS = {
  'three-quarter': (a) => from(V(0, 4.4, 0), V(-0.74, 0.2, 0.64), fit(41, 15, a)),
  front: (a) => from(V(0, 5.9, 0), V(-1, 0.02, 0), fit(38, 14, a)),
  rear: (a) => from(V(0, 5.9, 0), V(1, 0.03, 0), fit(38, 14, a)),
  side: (a) => from(V(0, 5.4, 0), V(0, 0.02, 1), fit(40, 13.5, a)),
  'side-right': (a) => from(V(0, 5.4, 0), V(0, 0.02, -1), fit(40, 13.5, a)),
  top: (a) => from(V(0, 4, 0), V(0.0001, 1, 0), fit(40, 38, a)),
  underside: (a) => from(V(0, 3, 0), V(0.0001, -1, 0), fit(40, 38, a)),
  'rear-quarter': (a) => from(V(0, 4.6, 0), V(0.72, 0.22, 0.66), fit(41, 15, a)),
  engine: () => from(V(-6.6, 1.9, 5.6), V(-0.8, 0.12, 0.45), 9.5),
  'flight-deck': () => from(V(-16.6, 4.3, 0.6), V(-0.72, 0.2, 0.67), 11),
  gear: () => from(V(-13.2, 1.2, 0), V(-1, 0.02, 0.05), 13),
  sharklet: () => from(V(2.6, 5.0, 17.3), V(-0.55, 0.12, 0.83), 11),
  tail: () => from(V(13.6, 8.2, 0), V(0.12, 0.02, 1), 21),
  door: () => from(V(-13.6, 4.1, 1.9), V(-0.12, 0.04, 1), 9),
}
export const VIEW_NAMES = Object.keys(VIEWS)

// Flies the camera to a view: straight there the first time, then on an eased
// path, and lets go again so the view can be orbited from where it lands.
function CameraRig({ view }) {
  const { camera, controls, size } = useThree()
  const anim = useRef(null)
  const first = useRef(true)
  useEffect(() => {
    if (!controls) return
    const v = (VIEWS[view] || VIEWS['three-quarter'])(size.width / size.height)
    if (first.current) {
      first.current = false
      camera.position.copy(v.pos)
      controls.target.copy(v.target)
      controls.update()
      return
    }
    anim.current = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1: v.pos, t1: v.target }
    // only the view (or the first sight of the controls) moves the camera: a resize leaves the user's orbit alone
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, controls])
  useFrame((_, dt) => {
    const a = anim.current
    if (!a || !controls) return
    a.t = Math.min(1, a.t + Math.min(dt, 1 / 30) / 1.6)
    const k = a.t < 0.5 ? 4 * a.t ** 3 : 1 - (-2 * a.t + 2) ** 3 / 2
    // swing round the aircraft rather than cutting through it
    const r = THREE.MathUtils.lerp(a.p0.distanceTo(a.t0), a.p1.distanceTo(a.t1), k)
    controls.target.lerpVectors(a.t0, a.t1, k)
    const d0 = a.p0.clone().sub(a.t0).normalize()
    const d1 = a.p1.clone().sub(a.t1).normalize()
    const q = new THREE.Quaternion().setFromUnitVectors(d0, d1)
    const dir = d0.applyQuaternion(new THREE.Quaternion().slerp(q, k))
    camera.position.copy(controls.target).addScaledVector(dir, r)
    controls.update()
    if (a.t >= 1) anim.current = null
  })
  return null
}

export default function AirlinerScene({ view = 'three-quarter', autoRotate = false, ...props }) {
  const start = useMemo(() => VIEWS['three-quarter'](1.6).pos.toArray(), [])
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas shadows="variance" dpr={[1, 2]} camera={{ position: start, fov: FOV, near: 0.5, far: 600 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.92 }}>
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#b9bcbf', 0.32]} />
        <directionalLight position={[-4, 60, 7]} intensity={0.95} color="#fffaf2" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-radius={14} shadow-blurSamples={20}>
          <orthographicCamera attach="shadow-camera" args={[-26, 26, 26, -26, 5, 90]} />
        </directionalLight>
        <directionalLight position={[20, 12, -24]} intensity={0.35} color="#e8efff" />
        <Studio />
        <Airliner {...props} />
        {/* the floor is only its shadows, so it runs seamlessly into the backdrop */}
        <mesh rotation-x={-Math.PI / 2} position-y={-0.002} receiveShadow>
          <planeGeometry args={[400, 400]} />
          <shadowMaterial opacity={0.12} />
        </mesh>
        <ContactShadows position={[0, 0.002, 0]} scale={56} resolution={1024} blur={3} far={9} opacity={0.6} color="#1b1e22" />
        <CameraRig view={view} />
        <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate} autoRotateSpeed={0.5} minDistance={5} maxDistance={150} maxPolarAngle={Math.PI - 0.05} />
      </Canvas>
      <InfoHint>Click the forward door to open it · click an engine to start it · click the landing gear to raise it · drag to orbit</InfoHint>
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

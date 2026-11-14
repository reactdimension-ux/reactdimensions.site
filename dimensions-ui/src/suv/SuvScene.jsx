import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Suv from './Suv.jsx'

const BG = '#d3d5d7'
const FOV = 26
const TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2))

// A car photo studio: a long soft box overhead, whose edges draw the lines
// along the shoulders and the bonnet, and strips down each side.
function Studio() {
  return (
    <Environment resolution={512} frames={1}>
      <color attach="background" args={['#74787d']} />
      <Lightformer form="rect" intensity={2.0} color="#ffffff" position={[0, 7, 0]} rotation-x={Math.PI / 2} scale={[22, 10, 1]} />
      <Lightformer form="rect" intensity={1.5} color="#fff6ea" position={[-2, 2.6, 9]} rotation-y={Math.PI} scale={[16, 2.6, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#eaf1ff" position={[2, 2.6, -9]} scale={[16, 2.6, 1]} />
      <Lightformer form="rect" intensity={1.1} color="#ffffff" position={[-11, 2.4, 0]} rotation-y={Math.PI / 2} scale={[9, 3, 1]} />
      <Lightformer form="rect" intensity={0.9} color="#ffffff" position={[11, 2.4, 0]} rotation-y={-Math.PI / 2} scale={[9, 3, 1]} />
      {/* the studio floor, so the sills reflect something */}
      <Lightformer form="rect" intensity={0.55} color="#cfd1d3" position={[0, -3, 0]} rotation-x={-Math.PI / 2} scale={[40, 40, 1]} />
    </Environment>
  )
}

// The views of a reference sheet. Each gives a camera position and target for
// the canvas aspect: the whole-car ones back off until it fits.
const fit = (w, h, aspect) => Math.max(h / 2 / TAN, w / 2 / (TAN * aspect)) * 1.12
const V = (x, y, z) => new THREE.Vector3(x, y, z)
const from = (target, dir, dist) => ({ target, pos: target.clone().addScaledVector(dir.normalize(), dist) })
const VIEWS = {
  'three-quarter': (a) => from(V(0, 0.74, 0), V(-0.76, 0.2, 0.62), fit(5.0, 2.1, a)),
  front: (a) => from(V(0, 0.82, 0), V(-1, 0.03, 0), fit(3.3, 2.7, a)),
  rear: (a) => from(V(0, 0.82, 0), V(1, 0.03, 0), fit(3.3, 2.7, a)),
  side: (a) => from(V(0, 0.8, 0), V(0, 0.03, 1), fit(4.9, 1.9, a)),
  'side-right': (a) => from(V(0, 0.8, 0), V(0, 0.03, -1), fit(4.9, 1.9, a)),
  top: (a) => from(V(0, 0.8, 0), V(0.0001, 1, 0), fit(2.6, 4.9, a)),
  underside: (a) => from(V(0, 0.3, 0), V(0.0001, -1, 0), fit(2.6, 4.9, a)),
  'rear-quarter': (a) => from(V(0, 0.78, 0), V(0.74, 0.2, 0.64), fit(5.0, 2.1, a)),
  wheel: () => from(V(-1.3, 0.42, 0.9), V(-0.28, 0.06, 1), 2.6),
  headlamp: () => from(V(-2.0, 0.68, 0.55), V(-0.8, 0.14, 0.58), 2.3),
  'tail-lamp': () => from(V(2.0, 1.0, 0.6), V(0.72, 0.1, 0.68), 2.4),
  door: () => from(V(0.2, 0.92, 0.9), V(0.04, 0.05, 1), 3.2),
  mirror: () => from(V(-0.6, 1.1, 0.95), V(-0.55, 0.1, 0.83), 2.2),
}
export const VIEW_NAMES = Object.keys(VIEWS)

// Flies the camera to a view: straight there the first time, then on an eased
// path round the car, and lets go so the view can be orbited from where it lands.
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
    a.t = Math.min(1, a.t + Math.min(dt, 1 / 30) / 1.5)
    const k = a.t < 0.5 ? 4 * a.t ** 3 : 1 - (-2 * a.t + 2) ** 3 / 2
    const r = THREE.MathUtils.lerp(a.p0.distanceTo(a.t0), a.p1.distanceTo(a.t1), k)
    controls.target.lerpVectors(a.t0, a.t1, k)
    const d0 = a.p0.clone().sub(a.t0).normalize()
    const d1 = a.p1.clone().sub(a.t1).normalize()
    const q = new THREE.Quaternion().setFromUnitVectors(d0, d1)
    camera.position.copy(controls.target).addScaledVector(d0.applyQuaternion(new THREE.Quaternion().slerp(q, k)), r)
    controls.update()
    if (a.t >= 1) anim.current = null
  })
  return null
}

export default function SuvScene({ view = 'three-quarter', autoRotate = false, ...props }) {
  const start = useMemo(() => VIEWS['three-quarter'](1.6).pos.toArray(), [])
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas shadows="variance" dpr={[1, 2]} camera={{ position: start, fov: FOV, near: 0.1, far: 120 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95 }}>
        <color attach="background" args={[BG]} />
        <hemisphereLight args={['#ffffff', '#b9bcbf', 0.3]} />
        <directionalLight position={[-0.8, 9, 1.4]} intensity={0.9} color="#fffaf2" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-radius={10} shadow-blurSamples={20}>
          <orthographicCamera attach="shadow-camera" args={[-4, 4, 4, -4, 1, 16]} />
        </directionalLight>
        <directionalLight position={[4, 2.5, -5]} intensity={0.3} color="#e8efff" />
        <Studio />
        <Suv {...props} />
        {/* the floor is only its shadows, so it runs seamlessly into the backdrop */}
        <mesh rotation-x={-Math.PI / 2} position-y={-0.001} receiveShadow>
          <planeGeometry args={[60, 60]} />
          <shadowMaterial opacity={0.16} />
        </mesh>
        <ContactShadows position={[0, 0.001, 0]} scale={9} resolution={1024} blur={2.2} far={0.9} opacity={0.75} color="#15181b" />
        <CameraRig view={view} />
        <OrbitControls makeDefault enablePan={false} autoRotate={autoRotate} autoRotateSpeed={0.6} minDistance={1.5} maxDistance={22} maxPolarAngle={Math.PI - 0.05} />
      </Canvas>
      <InfoHint>Click the car to switch its lights · drag to orbit</InfoHint>
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

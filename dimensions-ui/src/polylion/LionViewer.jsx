import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Lion from './Lion.jsx'

// The Polygon Lion's viewer: a white studio, an orthographic camera you can
// orbit, zoom and pan, and buttons that glide the camera to ten fixed views
// of the same single lion.

// Directions from the lion to the camera. The lion faces +x and its right
// side is +z. Top and bottom lean a hair toward the tail so the head points
// up the screen.
const E = 0.1
const VIEWS = [
  ['Front', [1, E, 0]],
  ['Front left', [1, E, -1]],
  ['Left', [0, E, -1]],
  ['Back left', [-1, E, -1]],
  ['Back', [-1, E, 0]],
  ['Back right', [-1, E, 1]],
  ['Right', [0, E, 1]],
  ['Front right', [1, E, 1]],
  ['Top', [-0.002, 1, 0]],
  ['Bottom', [-0.002, -1, 0]],
]
const HOME = [1, 0.42, 0.95] // the opening front three-quarter view
const DIST = 12

// How far to zoom so the whole lion fits, in pixels per metre.
const fitZoom = (w, h) => Math.max(20, Math.min(w / 3.9, h / 2.7))

// Glides the camera to a view: it turns around the lion on a sphere (so the
// front-to-back move swings round instead of passing through it), recentres
// the target and refits the zoom. Grabbing the scene cancels the glide.
function CameraController({ cmd, centre }) {
  const { camera, size, controls } = useThree()
  const anim = useRef(null)

  const start = (dir) => {
    if (!controls) return
    const from = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target))
    const to = new THREE.Spherical().setFromVector3(new THREE.Vector3(...dir).normalize().multiplyScalar(DIST))
    let dTheta = to.theta - from.theta
    dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta)) // the short way round
    anim.current = { t: 0, from, dTheta, toPhi: to.phi, fromTarget: controls.target.clone(), fromZoom: camera.zoom, toZoom: fitZoom(size.width, size.height) }
  }

  // first frame: straight to the home view, no glide
  useLayoutEffect(() => {
    if (!controls) return
    camera.position.copy(centre).add(new THREE.Vector3(...HOME).normalize().multiplyScalar(DIST))
    camera.zoom = fitZoom(size.width, size.height)
    camera.updateProjectionMatrix()
    controls.target.copy(centre)
    controls.update()
    const stop = () => (anim.current = null)
    controls.addEventListener('start', stop)
    return () => controls.removeEventListener('start', stop)
  }, [controls]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (cmd.n) start(cmd.view === 'reset' ? HOME : VIEWS.find((v) => v[0] === cmd.view)?.[1] ?? HOME)
  }, [cmd]) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, dt) => {
    const a = anim.current
    if (!a || !controls) return
    a.t = Math.min(1, a.t + dt / 0.9)
    const k = a.t < 0.5 ? 4 * a.t ** 3 : 1 - (-2 * a.t + 2) ** 3 / 2 // ease in-out
    const sph = new THREE.Spherical(DIST, THREE.MathUtils.lerp(a.from.phi, a.toPhi, k), a.from.theta + a.dTheta * k)
    sph.makeSafe()
    controls.target.lerpVectors(a.fromTarget, centre, k)
    camera.position.setFromSpherical(sph).add(controls.target)
    camera.zoom = THREE.MathUtils.lerp(a.fromZoom, a.toZoom, k)
    camera.updateProjectionMatrix()
    controls.update()
    if (a.t >= 1) anim.current = null
  })
  return null
}

// The lion, moved so it is centred over the origin on the ground; reports the
// middle of its bounding box for the camera to look at.
function Centred({ onCentre, children }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const box = new THREE.Box3().setFromObject(ref.current.children[0])
    const c = box.getCenter(new THREE.Vector3())
    ref.current.position.set(-c.x, 0, -c.z)
    onCentre(new THREE.Vector3(0, c.y, 0))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return <group ref={ref}>{children}</group>
}

export default function LionViewer({ mane = 'golden', walk = false, idle = true, autoRotate = false, background = '#ffffff' }) {
  const [cmd, setCmd] = useState({ view: 'reset', n: 0 })
  const [centre, setCentre] = useState(null)
  const go = (view) => setCmd((c) => ({ view, n: c.n + 1 }))
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background, touchAction: 'none' }}>
      <Canvas orthographic shadows={{ type: THREE.PCFSoftShadowMap }} dpr={[1, 2]} flat camera={{ position: [8, 4, 8], zoom: 100, near: 0.1, far: 60 }} gl={{ antialias: true }}>
        <color attach="background" args={[background]} />
        <ambientLight intensity={1.05} />
        <hemisphereLight args={['#ffffff', '#e8dcc8', 0.55]} />
        <directionalLight position={[3.5, 6, 4]} intensity={2.1} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02} shadow-radius={6}>
          <orthographicCamera attach="shadow-camera" args={[-3, 3, 3, -3, 0.5, 20]} />
        </directionalLight>
        <directionalLight position={[-4, 3, -3]} intensity={0.55} color="#fff4e6" />
        {/* a matte floor the colour of the background: it only shows where the lion shades it */}
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[60, 60]} />
          <shadowMaterial color="#3a2a14" opacity={0.2} />
        </mesh>
        <Centred onCentre={setCentre}>
          <Lion palette={mane} walk={walk} idle={idle} />
        </Centred>
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} autoRotate={autoRotate} autoRotateSpeed={0.8} minZoom={25} maxZoom={1200} zoomToCursor />
        {centre && <CameraController cmd={cmd} centre={centre} />}
      </Canvas>
      <ViewBar onView={go} />
      <InfoHint>Drag to turn the lion all the way round, scroll or pinch to zoom, right-drag or two-finger drag to pan · the buttons glide to fixed views · ⟲ resets the camera</InfoHint>
    </div>
  )
}

const pill = (on) => ({
  padding: '6px 9px', borderRadius: 8, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
  background: on ? '#1c1a16' : 'transparent', color: on ? '#f4f1ea' : '#2a2925',
  font: '600 10.5px/1 ui-monospace, Menlo, monospace', letterSpacing: '0.02em',
})

function ViewBar({ onView }) {
  const [active, setActive] = useState(null)
  const pick = (v) => {
    setActive(v === 'reset' ? null : v)
    onView(v)
  }
  return (
    <div role="toolbar" aria-label="Camera views" style={{ position: 'absolute', left: 12, top: 12, right: 12, zIndex: 5, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 2, padding: 4, borderRadius: 12, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', boxShadow: '0 2px 10px rgba(0,0,0,.1), inset 0 0 0 1px rgba(0,0,0,.07)', pointerEvents: 'auto', maxWidth: '100%' }}>
        {VIEWS.map(([name]) => (
          <button key={name} type="button" aria-pressed={active === name} onClick={() => pick(name)} style={pill(active === name)}>
            {name}
          </button>
        ))}
        <button type="button" aria-label="Reset camera" title="Reset camera" onClick={() => pick('reset')} style={{ ...pill(false), fontSize: 13, padding: '3px 9px' }}>
          ⟲
        </button>
      </div>
    </div>
  )
}

// The usage tips live behind a small "i" button in the corner.
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

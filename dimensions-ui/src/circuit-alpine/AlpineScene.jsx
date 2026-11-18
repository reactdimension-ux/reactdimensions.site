import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Bloom, EffectComposer, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { InfoHint } from '../airliner/stage.jsx'
import RaceCar from '../racecar/RaceCar.jsx'
import { START, input, resetVehicle, vehicle } from '../pickup/controls.js'
import { HALF, N } from '../circuit/track.js'
import Alpine from './Alpine.jsx'
import { TRACK as T } from './layout.js'
import { bankAt } from './world.js'

const HOME = [210, 230, 340]
const TARGET = [0, 0, 0]
const FOV = 40
const DRIVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']
const DEFAULT_START = { x: 0, z: 0, heading: -0.65 }

// The ice is slippery: the car's line of travel lags behind where it points
// (see `grip` in pickup/drive.js). Cleared ice is the slipperiest; the snow in
// the runoff grips better but drags; past the snowbank the car is held in.
function surface(x, z) {
  const q = T.nearest(x, z)
  const d = Math.abs(q.lat)
  const b = q.lat > 0 ? T.bL[q.i] : T.bR[q.i]
  if (d < HALF + 0.6) return { y: 0, grip: 0.42 }
  if (d < b) return { y: 0, grip: 0.72, drag: 1.6 }
  return { y: 0.8, grip: 0.5, drag: 3.2 }
}
const DRIVE = { arena: 640, surface }

// A grid slot behind the start line.
function gridSlot() {
  const p = T.sample(-3.5, 2.6)
  return { x: p.x, z: p.z, heading: Math.atan2(-p.tz, p.tx) }
}

// Snowbanks push back: if the car goes past the crest it is shoved out and loses speed.
function Snowbanks() {
  useFrame(() => {
    const v = vehicle
    const q = T.nearest(v.x, v.z)
    const side = q.lat > 0 ? 1 : -1
    const over = Math.abs(q.lat) - bankAt(q.i, side)
    if (over <= 0) return
    v.x -= T.nx[q.i] * side * over
    v.z -= T.nz[q.i] * side * over
    v.speed *= 0.55
  })
  return null
}

// The driving camera wants a wider lens than the overview.
function DriveCam() {
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    camera.fov = 45
    camera.updateProjectionMatrix()
  }, [camera])
  return null
}

// Overview leaves the camera to the orbit controls. Chase rides behind the
// leading car; trackside cuts between fixed cameras round the lap, each one
// panning with the leader as it comes past.
function Rig({ view, lead }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls)
  const cams = useMemo(() => {
    const list = []
    const p = {}
    for (let i = 20; i < N; i += 62) {
      T.sample(i, T.bL[i] + 8, p)
      list.push(new THREE.Vector3(p.x, 6, p.z))
    }
    return list
  }, [])
  const st = useRef({ cam: -1, fresh: true, look: new THREE.Vector3(), want: new THREE.Vector3() })
  useEffect(() => {
    st.current.fresh = true
    st.current.cam = -1
    camera.fov = view === 'chase' ? 62 : view === 'trackside' ? 20 : FOV
    camera.updateProjectionMatrix()
    if (view === 'overview') {
      camera.position.set(...HOME)
      if (controls) {
        controls.target.set(...TARGET)
        controls.update()
      }
    }
  }, [view, camera, controls])
  useFrame((_, dt) => {
    const L = lead.current
    const s = st.current
    if (view === 'overview' || !L) return
    const ease = s.fresh ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) * 6)
    if (view === 'chase') {
      s.want.set(L.x - L.dx * 9.5, 3.4, L.z - L.dz * 9.5)
      camera.position.lerp(s.want, ease)
      s.want.set(L.x + L.dx * 9, 1, L.z + L.dz * 9)
      s.look.lerp(s.want, ease)
    } else {
      let best = s.cam
      let bd = best < 0 ? 1e9 : cams[best].distanceTo(s.want.set(L.x + L.dx * 30, 0, L.z + L.dz * 30)) * 0.8
      cams.forEach((c, i) => {
        const d = c.distanceTo(s.want.set(L.x + L.dx * 30, 0, L.z + L.dz * 30))
        if (d < bd) (bd = d), (best = i)
      })
      if (best !== s.cam) (s.cam = best), (s.fresh = true)
      camera.position.copy(cams[best])
      s.want.set(L.x, 0.8, L.z)
      s.look.lerp(s.want, s.fresh ? 1 : ease)
    }
    camera.lookAt(s.look)
    s.fresh = false
  })
  return null
}

export default function AlpineScene({ autoRotate = false, view = 'overview', drivable = false, ...props }) {
  const lead = useRef(null)
  const wrap = useRef()
  const mode = drivable ? 'drive' : view
  const driving = mode === 'drive'

  // Put the car on the grid when driving starts; hand the shared state back after.
  useEffect(() => {
    if (!driving) return
    Object.assign(START, gridSlot())
    resetVehicle()
    return () => {
      input.keys.clear()
      Object.assign(START, DEFAULT_START)
      resetVehicle()
    }
  }, [driving])

  // Keys only count while the preview has focus, so the page can still scroll.
  const onKeyDown = (e) => {
    if (!driving) return
    if (DRIVE_KEYS.includes(e.code)) {
      e.preventDefault()
      input.keys.add(e.code)
    }
    if (e.code === 'KeyR') resetVehicle()
  }
  const onKeyUp = (e) => input.keys.delete(e.code)

  return (
    <div
      ref={wrap}
      tabIndex={0}
      aria-label="3D alpine ice circuit. When driving is on, use W A S D or the arrow keys."
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={() => input.keys.clear()}
      onPointerDown={() => wrap.current?.focus({ preventScroll: true })}
      style={{ position: 'relative', width: '100%', height: '100%', outline: 'none', touchAction: 'none' }}
    >
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: HOME, fov: FOV, near: 0.5, far: 20000 }} gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping }}>
        <Alpine {...props} drive={driving} lead={lead} />
        {driving ? (
          <>
            <DriveCam />
            <RaceCar drivable autoRotate={false} lightsOn drive={DRIVE} />
            <Snowbanks />
          </>
        ) : (
          <>
            <Rig view={mode} lead={lead} />
            <OrbitControls makeDefault enabled={mode === 'overview'} target={TARGET} autoRotate={autoRotate && mode === 'overview'} autoRotateSpeed={0.3} minDistance={10} maxDistance={760} minPolarAngle={0.1} maxPolarAngle={1.5} screenSpacePanning={false} />
          </>
        )}
        <EffectComposer disableNormalPass multisampling={0}>
          <Bloom luminanceThreshold={1.05} luminanceSmoothing={0.3} intensity={0.45} mipmapBlur />
          <Vignette eskil={false} offset={0.2} darkness={0.4} />
          <SMAA />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      </Canvas>
      <InfoHint>
        {driving
          ? 'Click here, then W A S D / arrows · Space brake · R reset to the grid · the ice is slippery: brake early, steer gently, and the snowbanks push you back'
          : 'Drag to look round the circuit · scroll to fly in · right-drag to pan · View rides behind the leading car or cuts between trackside cameras · Drive puts the Low Poly Race Car on the grid · the Palette presets set the time of day and the weather'}
      </InfoHint>
    </div>
  )
}

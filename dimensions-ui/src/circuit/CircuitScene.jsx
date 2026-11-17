import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Bloom, EffectComposer, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { InfoHint } from '../airliner/stage.jsx'
import Circuit from './Circuit.jsx'
import { N, TRACK as T, groundAt } from './track.js'

const HOME = [150, 150, 250]
const TARGET = [0, 0, -22]
const FOV = 40

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
      const pit = T.pitZone(i)
      T.sample(i, pit ? -(T.bR[i] + 3.5) : T.bL[i] + 8, p)
      list.push(new THREE.Vector3(p.x, groundAt(p.x, p.z).y + (pit ? 8 : 6), p.z))
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
      // the camera nearest to where the leader is heading, with some stickiness
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

export default function CircuitScene({ autoRotate = false, view = 'overview', ...props }) {
  const lead = useRef(null)
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: HOME, fov: FOV, near: 1, far: 20000 }} gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping }}>
        <Circuit {...props} lead={lead} />
        <Rig view={view} lead={lead} />
        <EffectComposer disableNormalPass multisampling={0}>
          <Bloom luminanceThreshold={1.05} luminanceSmoothing={0.3} intensity={0.45} mipmapBlur />
          <Vignette eskil={false} offset={0.2} darkness={0.42} />
          <SMAA />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
        <OrbitControls makeDefault enabled={view === 'overview'} target={TARGET} autoRotate={autoRotate && view === 'overview'} autoRotateSpeed={0.3} minDistance={10} maxDistance={720} minPolarAngle={0.1} maxPolarAngle={1.5} screenSpacePanning={false} />
      </Canvas>
      <InfoHint>Drag to look round the circuit · scroll to fly in · right-drag to pan along the track · View rides behind the leading car or cuts between the trackside cameras · the Palette presets set the time of day</InfoHint>
    </div>
  )
}

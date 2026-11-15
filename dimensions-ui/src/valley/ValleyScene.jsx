import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { InfoHint } from '../airliner/stage.jsx'
import { heightAt } from './land.js'
import Valley from './Valley.jsx'

// Keeps the eye above the ground however the view is dragged.
function StayAboveGround() {
  const camera = useThree((s) => s.camera)
  useFrame(() => {
    const floor = Math.max(heightAt(camera.position.x, camera.position.z), 0) + 1.2
    if (camera.position.y < floor) camera.position.y = floor
  })
  return null
}

export default function ValleyScene({ autoRotate = false, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background: '#a9bfd6' }}>
      <Canvas shadows="soft" dpr={[1, 1.5]} camera={{ position: [1.5, 2.6, 54], fov: 50, near: 0.3, far: 40000 }} gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping }}>
        <Valley {...props} />
        <EffectComposer disableNormalPass multisampling={0}>
          <N8AO aoRadius={1.6} distanceFalloff={0.6} intensity={1.6} halfRes />
          <Bloom luminanceThreshold={1.1} luminanceSmoothing={0.25} intensity={0.35} mipmapBlur />
          <Vignette eskil={false} offset={0.25} darkness={0.4} />
          <SMAA />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
        <OrbitControls makeDefault target={[0, 6, 0]} autoRotate={autoRotate} autoRotateSpeed={0.2} minDistance={6} maxDistance={420} minPolarAngle={0.2} maxPolarAngle={1.66} screenSpacePanning={false} />
        <StayAboveGround />
      </Canvas>
      <InfoHint>Drag to look round the valley · scroll to walk in or fly out · right-drag to move along the river · the Palette presets set the time of day; Snowline lowers or lifts the snow on the peaks; Wind moves the trees, the grass and the clouds; Flow sets the river's pace</InfoHint>
    </div>
  )
}

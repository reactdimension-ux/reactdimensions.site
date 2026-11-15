import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Bloom, EffectComposer, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { InfoHint } from '../airliner/stage.jsx'
import City from './City.jsx'

// Keeps the eye above the street however the view is dragged.
function StayAboveStreet() {
  const camera = useThree((s) => s.camera)
  useFrame(() => {
    if (camera.position.y < 1.6) camera.position.y = 1.6
  })
  return null
}

export default function CityScene({ autoRotate = false, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background: '#b4c2d0' }}>
      <Canvas shadows="soft" dpr={[1, 1.5]} camera={{ position: [5, 11, 96], fov: 52, near: 0.3, far: 30000 }} gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping }}>
        <City {...props} />
        <EffectComposer disableNormalPass multisampling={0}>
          <Bloom luminanceThreshold={1.0} luminanceSmoothing={0.3} intensity={0.55} mipmapBlur />
          <Vignette eskil={false} offset={0.25} darkness={0.4} />
          <SMAA />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
        <OrbitControls makeDefault target={[0, 22, 0]} autoRotate={autoRotate} autoRotateSpeed={0.2} minDistance={8} maxDistance={1400} minPolarAngle={0.1} maxPolarAngle={1.62} screenSpacePanning={false} />
        <StayAboveStreet />
      </Canvas>
      <InfoHint>Drag to look round · scroll to drop to street level or rise over the skyline · right-drag to travel along the avenue · the Palette presets set the time of day (try Night) · Traffic thins or packs the streets; the lights on every corner run the traffic, and the cars queue for the reds</InfoHint>
    </div>
  )
}

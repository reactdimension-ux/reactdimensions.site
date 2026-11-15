import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Bloom, EffectComposer, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { InfoHint } from '../airliner/stage.jsx'
import Forest from './Forest.jsx'

export default function ForestScene({ autoRotate = false, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: [44, 26, 96], fov: 48, near: 0.5, far: 20000 }} gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping }}>
        <Forest {...props} />
        <EffectComposer disableNormalPass multisampling={0}>
          <Bloom luminanceThreshold={1.05} luminanceSmoothing={0.3} intensity={0.45} mipmapBlur />
          <Vignette eskil={false} offset={0.2} darkness={0.42} />
          <SMAA />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
        <OrbitControls makeDefault target={[0, 2, 0]} autoRotate={autoRotate} autoRotateSpeed={0.25} minDistance={6} maxDistance={280} minPolarAngle={0.15} maxPolarAngle={1.5} screenSpacePanning={false} />
      </Canvas>
      <InfoHint>Drag to look round the valley · scroll to fly in · right-drag to pan along the river · the Palette presets set the time of day; Season changes the woods, the water and the snowline; raise Wind to see the trees and clouds move</InfoHint>
    </div>
  )
}

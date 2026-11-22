import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { InfoHint } from '../airliner/stage.jsx'
import { VIEW, heightAt } from './land.js'
import Country from './Country.jsx'

// Keeps the eye above the ground however the view is dragged.
function StayAboveGround() {
  const camera = useThree((s) => s.camera)
  useFrame(() => {
    const floor = heightAt(camera.position.x, camera.position.z) + 1.4
    if (camera.position.y < floor) camera.position.y = floor
  })
  return null
}

// Keeps the point being looked at inside the land that is modelled, moving the
// camera with it, so dragging never carries the view off the edge of the world.
function KeepInBounds() {
  const camera = useThree((st) => st.camera)
  const controls = useThree((st) => st.controls)
  useFrame(() => {
    if (!controls) return
    const t = controls.target
    const x = THREE.MathUtils.clamp(t.x, -400, 400)
    const z = THREE.MathUtils.clamp(t.z, -740, 220)
    if (x !== t.x || z !== t.z) {
      camera.position.x += x - t.x
      camera.position.z += z - t.z
      t.x = x
      t.z = z
    }
  })
  return null
}

// The viewer stands in the meadow at eye height, looking out over the vale.
const EYE = [VIEW.x, heightAt(VIEW.x, VIEW.z) + 2.1, VIEW.z]
const LOOK = [VIEW.x + 6, heightAt(VIEW.x + 6, VIEW.z - 70) - 2.5, VIEW.z - 70]

export default function CountryScene({ autoRotate = false, ...props }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none', background: '#b4c6d8' }}>
      <Canvas shadows="soft" dpr={[1, 1.5]} camera={{ position: EYE, fov: 50, near: 0.25, far: 40000 }} gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping }}>
        <Country {...props} />
        <EffectComposer disableNormalPass multisampling={0}>
          <N8AO aoRadius={1.6} distanceFalloff={0.6} intensity={1.5} halfRes />
          <Bloom luminanceThreshold={1.1} luminanceSmoothing={0.25} intensity={0.35} mipmapBlur />
          <Vignette eskil={false} offset={0.25} darkness={0.4} />
          <SMAA />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
        <OrbitControls
          makeDefault
          target={LOOK}
          autoRotate={autoRotate}
          autoRotateSpeed={0.2}
          minDistance={4}
          maxDistance={600}
          minPolarAngle={0.2}
          maxPolarAngle={1.62}
          screenSpacePanning={false}
          zoomToCursor
          mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
          touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE }}
        />
        <KeepInBounds />
        <StayAboveGround />
      </Canvas>
      <InfoHint>Drag to move across the countryside, anywhere you like · scroll to zoom in on whatever the pointer is over · right-drag to look round · the Palette presets set the time of day; Wind moves the wheat, the grass, the trees, the clouds and the chimney smoke; Sheep and Clouds switch them on and off</InfoHint>
    </div>
  )
}

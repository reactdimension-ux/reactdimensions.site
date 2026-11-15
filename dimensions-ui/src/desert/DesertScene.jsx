import { useCallback, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { InfoHint } from '../airliner/stage.jsx'
import Desert from './Desert.jsx'

export default function DesertScene({ autoRotate = false, ...props }) {
  const controls = useRef()
  // the dune field puts a crest at the origin; look at it from a little above
  const onReady = useCallback((h) => {
    const c = controls.current
    if (!c) return
    c.target.set(0, h + 2, 0)
    c.object.position.set(-46, h + 16, 34)
    c.update()
  }, [])
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <Canvas dpr={[1, 1.5]} camera={{ position: [-46, 24, 34], fov: 50, near: 0.5, far: 30000 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
        <Desert {...props} onReady={onReady} />
        <OrbitControls ref={controls} makeDefault enablePan={false} target={[0, 10, 0]} autoRotate={autoRotate} autoRotateSpeed={0.3} minDistance={6} maxDistance={400} maxPolarAngle={1.5} />
      </Canvas>
      <InfoHint>Drag to look round the dunes · scroll to climb · move the sun low for long shadows, and raise the wind to see the sand blow off the crests</InfoHint>
    </div>
  )
}

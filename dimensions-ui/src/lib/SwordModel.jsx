import { Suspense, lazy } from 'react'

// An ornate longsword: a forged, etched blade under a bronze guard with
// down-swept quillons, a ringed grip and a spiked pommel. Take hold of it
// and swing it with its real weight and balance; tap the blade to make it
// ring. Drag the background to orbit.
// (Thin wrapper: the scene lives in sword/SwordScene.jsx.)
const Scene = lazy(() => import('../sword/SwordScene.jsx'))

export default function SwordModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

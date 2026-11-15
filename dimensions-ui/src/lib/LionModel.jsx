import { Suspense, lazy } from 'react'

// A furred, maned 3D lion you walk around with WASD or the arrow keys.
// (Thin wrapper: the scene lives in lion/LionScene.jsx.)
const Scene = lazy(() => import('../lion/LionScene.jsx'))

export default function LionModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

import { Suspense, lazy } from 'react'

// A three-arm fidget spinner at real size with its mechanism: anodised
// aluminium body, 608 bearings, an open centre bearing whose balls orbit in
// their cage, turned finger caps, and bearing-friction spin-down physics.
// (Thin wrapper: the scene lives in spinner/SpinnerScene.jsx.)
const Scene = lazy(() => import('../spinner/SpinnerScene.jsx'))

export default function FidgetSpinnerModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

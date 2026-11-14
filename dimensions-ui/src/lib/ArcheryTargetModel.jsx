import { Suspense, lazy } from 'react'

// A field archery target: a ten-ring face on a straw boss, leaning back on
// a wooden tripod. Shoot the library's carbon arrows into it and score.
// (Thin wrapper: the scene lives in archery/TargetScene.jsx.)
const Scene = lazy(() => import('../archery/TargetScene.jsx'))

export default function ArcheryTargetModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

import { Suspense, lazy } from 'react'

// One steel-tip dart at real size, thrown into a sisal practice target:
// solved projectile flight in slow motion, the flights' fish-tail wobble,
// a tail-up landing and a damped shudder round the buried point.
// (Thin wrapper: the scene lives in dart/DartScene.jsx.)
const Scene = lazy(() => import('../dart/DartScene.jsx'))

export default function DartModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

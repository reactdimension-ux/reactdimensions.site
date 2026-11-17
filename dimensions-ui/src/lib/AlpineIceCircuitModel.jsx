import { Suspense, lazy } from 'react'

// A racing circuit on a frozen lake; see circuit-alpine/Alpine.jsx for what it does.
// (Thin wrapper: the scene lives in circuit-alpine/AlpineScene.jsx.)
const Scene = lazy(() => import('../circuit-alpine/AlpineScene.jsx'))

export default function AlpineIceCircuitModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

import { Suspense, lazy } from 'react'

// A clay-toy hamster character; see hamster/Hamster.jsx for what it does.
// (Thin wrapper: the scene lives in hamster/Hamster.jsx.)
const Scene = lazy(() => import('../hamster/Hamster.jsx'))

export default function HamsterModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

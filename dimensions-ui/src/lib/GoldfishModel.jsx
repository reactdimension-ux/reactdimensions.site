import { Suspense, lazy } from 'react'

// A clay-toy goldfish character; see goldfish/Goldfish.jsx for what it does.
// (Thin wrapper: the scene lives in goldfish/Goldfish.jsx.)
const Scene = lazy(() => import('../goldfish/Goldfish.jsx'))

export default function GoldfishModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

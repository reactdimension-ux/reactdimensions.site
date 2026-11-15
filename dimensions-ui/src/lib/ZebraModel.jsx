import { Suspense, lazy } from 'react'

// A clay-toy zebra character; see zebra/Zebra.jsx for what it does.
// (Thin wrapper: the scene lives in zebra/Zebra.jsx.)
const Scene = lazy(() => import('../zebra/Zebra.jsx'))

export default function ZebraModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

import { Suspense, lazy } from 'react'

// A blocky toy black panther; see blocky/Panther.jsx for what it does.
// (Thin wrapper: the scene lives in blocky/Panther.jsx.)
const Scene = lazy(() => import('../blocky/Panther.jsx'))

export default function BlockyPantherModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

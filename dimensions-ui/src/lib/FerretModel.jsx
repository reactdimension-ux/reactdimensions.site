import { Suspense, lazy } from 'react'

// A clay-toy ferret character; see ferret/Ferret.jsx for what it does.
// (Thin wrapper: the scene lives in ferret/Ferret.jsx.)
const Scene = lazy(() => import('../ferret/Ferret.jsx'))

export default function FerretModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

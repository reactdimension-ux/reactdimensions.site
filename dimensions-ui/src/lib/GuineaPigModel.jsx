import { Suspense, lazy } from 'react'

// A clay-toy guinea pig character; see guineapig/GuineaPig.jsx for what it does.
// (Thin wrapper: the scene lives in guineapig/GuineaPig.jsx.)
const Scene = lazy(() => import('../guineapig/GuineaPig.jsx'))

export default function GuineaPigModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

import { Suspense, lazy } from 'react'

// A blocky toy polar bear; see blocky/PolarBear.jsx for what it does.
// (Thin wrapper: the scene lives in blocky/PolarBear.jsx.)
const Scene = lazy(() => import('../blocky/PolarBear.jsx'))

export default function BlockyPolarBearModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

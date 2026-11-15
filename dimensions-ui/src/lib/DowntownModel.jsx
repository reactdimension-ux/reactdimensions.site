import { Suspense, lazy } from 'react'

// A photoreal Manhattan-style city with live traffic; see city/City.jsx for what it does.
// (Thin wrapper: the scene lives in city/CityScene.jsx.)
const Scene = lazy(() => import('../city/CityScene.jsx'))

export default function DowntownModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

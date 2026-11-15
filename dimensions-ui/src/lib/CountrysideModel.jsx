import { Suspense, lazy } from 'react'

// Photoreal rolling farmland: hedged fields, a farm, sheep and wild flowers; see country/Country.jsx.
// (Thin wrapper: the scene lives in country/CountryScene.jsx.)
const Scene = lazy(() => import('../country/CountryScene.jsx'))

export default function CountrysideModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

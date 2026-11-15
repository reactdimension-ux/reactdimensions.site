import { Suspense, lazy } from 'react'

// A clay-toy budgie character; see budgie/Budgie.jsx for what it does.
// (Thin wrapper: the scene lives in budgie/Budgie.jsx.)
const Scene = lazy(() => import('../budgie/Budgie.jsx'))

export default function BudgieModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

import { Suspense, lazy } from 'react'

// A low-poly patch of snowy pines under light snowfall; tap it and snow slides off a branch with a puff.
// (Thin wrapper: the scene lives in lowpoly/SnowyPines.jsx.)
const Scene = lazy(() => import('../lowpoly/SnowyPines.jsx'))

export default function LowPolySnowyPinesModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

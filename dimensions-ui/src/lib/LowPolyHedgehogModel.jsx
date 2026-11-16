import { Suspense, lazy } from 'react'

// A low-poly hedgehog on a mossy patch: a round body covered in cone spines, a pointed snout and a twitching nose. It snuffles about; tap it and it curls into a spiky ball and rolls, then uncurls.
// (Thin wrapper: the scene lives in lowpoly/Hedgehog.jsx.)
const Scene = lazy(() => import('../lowpoly/Hedgehog.jsx'))

export default function LowPolyHedgehogModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

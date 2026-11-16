import { Suspense, lazy } from 'react'

// A low-poly flamingo standing on one leg in a shallow pool, S-curved neck and bent beak, swaying to keep its balance. Tap it and it swaps legs and flaps its wings.
// (Thin wrapper: the scene lives in lowpoly/Flamingo.jsx.)
const Scene = lazy(() => import('../lowpoly/Flamingo.jsx'))

export default function LowPolyFlamingoModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

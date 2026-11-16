import { Suspense, lazy } from 'react'

// A low-poly fern in a mossy clump, one frond slowly unfurling from its spiral; tap it and every frond curls up, then opens again.
// (Thin wrapper: the scene lives in lowpoly/Fern.jsx.)
const Scene = lazy(() => import('../lowpoly/Fern.jsx'))

export default function LowPolyFernModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

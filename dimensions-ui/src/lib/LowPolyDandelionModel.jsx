import { Suspense, lazy } from 'react'

// A low-poly dandelion swaying in a light breeze; tap it and its seeds blow off and drift away, then the seed head regrows.
// (Thin wrapper: the scene lives in lowpoly/Dandelion.jsx.)
const Scene = lazy(() => import('../lowpoly/Dandelion.jsx'))

export default function LowPolyDandelionModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

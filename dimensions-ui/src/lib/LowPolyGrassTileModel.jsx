import { Suspense, lazy } from 'react'

// A low-poly ground tile of soil and turf with pebbles and swaying grass; tap it and it squashes and springs back.
// (Thin wrapper: the scene lives in lowpoly/GrassTile.jsx.)
const Scene = lazy(() => import('../lowpoly/GrassTile.jsx'))

export default function LowPolyGrassTileModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

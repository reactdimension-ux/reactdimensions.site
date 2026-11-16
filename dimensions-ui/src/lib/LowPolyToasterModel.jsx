import { Suspense, lazy } from 'react'

// A low-poly toaster with heat shimmering from its slots; tap it and the toast pops up and falls back in.
// (Thin wrapper: the scene lives in lowpoly/Toaster.jsx.)
const Scene = lazy(() => import('../lowpoly/Toaster.jsx'))

export default function LowPolyToasterModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

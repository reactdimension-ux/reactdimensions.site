import { Suspense, lazy } from 'react'

// A low-poly pufferfish hovering with fluttering fins; tap it and it puffs up into a spiky ball, then slowly deflates.
// (Thin wrapper: the scene lives in lowpoly/Pufferfish.jsx.)
const Scene = lazy(() => import('../lowpoly/Pufferfish.jsx'))

export default function LowPolyPufferfishModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

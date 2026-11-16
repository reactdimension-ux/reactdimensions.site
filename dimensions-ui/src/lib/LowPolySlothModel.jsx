import { Suspense, lazy } from 'react'

// A low-poly sloth hanging from a branch, blinking and turning its head very slowly; tap it and it slowly waves one arm.
// (Thin wrapper: the scene lives in lowpoly/Sloth.jsx.)
const Scene = lazy(() => import('../lowpoly/Sloth.jsx'))

export default function LowPolySlothModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

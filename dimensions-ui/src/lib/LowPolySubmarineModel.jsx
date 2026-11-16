import { Suspense, lazy } from 'react'

// A low-poly submarine with a capsule hull, a conning tower and a periscope that turns, rising and sinking gently. Tap it and it dives with a trail of bubbles.
// (Thin wrapper: the scene lives in lowpoly/Submarine.jsx.)
const Scene = lazy(() => import('../lowpoly/Submarine.jsx'))

export default function LowPolySubmarineModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

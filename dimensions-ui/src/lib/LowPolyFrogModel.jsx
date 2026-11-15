import { Suspense, lazy } from 'react'

// A low-poly animal for the motion-graphics set; see lowpoly/Frog.jsx for what it does.
// (Thin wrapper: the scene lives in lowpoly/Frog.jsx.)
const Scene = lazy(() => import('../lowpoly/Frog.jsx'))

export default function LowPolyFrogModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

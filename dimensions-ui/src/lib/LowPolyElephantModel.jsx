import { Suspense, lazy } from 'react'

// A low-poly animal for the motion-graphics set; see lowpoly/Elephant.jsx for what it does.
// (Thin wrapper: the scene lives in lowpoly/Elephant.jsx.)
const Scene = lazy(() => import('../lowpoly/Elephant.jsx'))

export default function LowPolyElephantModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

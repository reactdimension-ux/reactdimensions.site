import { Suspense, lazy } from 'react'

// A low-poly animal for the motion-graphics set; see lowpoly/Bee.jsx for what it does.
// (Thin wrapper: the scene lives in lowpoly/Bee.jsx.)
const Scene = lazy(() => import('../lowpoly/Bee.jsx'))

export default function LowPolyBeeModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

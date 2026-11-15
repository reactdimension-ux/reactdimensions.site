import { Suspense, lazy } from 'react'

// A low-poly animal for the motion-graphics set; see lowpoly/Bunny.jsx for what it does.
// (Thin wrapper: the scene lives in lowpoly/Bunny.jsx.)
const Scene = lazy(() => import('../lowpoly/Bunny.jsx'))

export default function LowPolyBunnyModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

import { Suspense, lazy } from 'react'

// A low-poly animal for the motion-graphics set; see lowpoly/Whale.jsx for what it does.
// (Thin wrapper: the scene lives in lowpoly/Whale.jsx.)
const Scene = lazy(() => import('../lowpoly/Whale.jsx'))

export default function LowPolyWhaleModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

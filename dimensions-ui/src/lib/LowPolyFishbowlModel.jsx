import { Suspense, lazy } from 'react'

// A low-poly animal for the motion-graphics set; see lowpoly/Fishbowl.jsx for what it does.
// (Thin wrapper: the scene lives in lowpoly/Fishbowl.jsx.)
const Scene = lazy(() => import('../lowpoly/Fishbowl.jsx'))

export default function LowPolyFishbowlModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

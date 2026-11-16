import { Suspense, lazy } from 'react'

// A low-poly rover creeping over a cratered patch on mesh wheels; tap it and its dish turns and beams a signal.
// (Thin wrapper: the scene lives in lowpoly/LunarRover.jsx.)
const Scene = lazy(() => import('../lowpoly/LunarRover.jsx'))

export default function LowPolyLunarRoverModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

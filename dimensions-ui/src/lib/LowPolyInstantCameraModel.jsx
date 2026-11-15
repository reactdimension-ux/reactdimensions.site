import { Suspense, lazy } from 'react'

// A low-poly motion-graphics model; see lowpoly/InstantCamera.jsx for what it does.
// (Thin wrapper: the scene lives in lowpoly/InstantCamera.jsx.)
const Scene = lazy(() => import('../lowpoly/InstantCamera.jsx'))

export default function LowPolyInstantCameraModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

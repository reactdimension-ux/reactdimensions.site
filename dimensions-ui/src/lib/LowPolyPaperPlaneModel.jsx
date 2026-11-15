import { Suspense, lazy } from 'react'

// A low-poly paper dart gliding a figure of eight; tap it and it loops.
// (Thin wrapper: the scene lives in lowpoly/PaperPlane.jsx.)
const Scene = lazy(() => import('../lowpoly/PaperPlane.jsx'))

export default function LowPolyPaperPlaneModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

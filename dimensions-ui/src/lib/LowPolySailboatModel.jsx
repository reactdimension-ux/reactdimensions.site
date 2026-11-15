import { Suspense, lazy } from 'react'

// A low-poly motion-graphics model; see lowpoly/Sailboat.jsx for what it does.
// (Thin wrapper: the scene lives in lowpoly/Sailboat.jsx.)
const Scene = lazy(() => import('../lowpoly/Sailboat.jsx'))

export default function LowPolySailboatModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

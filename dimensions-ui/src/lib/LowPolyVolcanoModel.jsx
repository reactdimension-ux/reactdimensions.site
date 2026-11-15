import { Suspense, lazy } from 'react'

// A low-poly motion-graphics model; see lowpoly/Volcano.jsx for what it does.
// (Thin wrapper: the scene lives in lowpoly/Volcano.jsx.)
const Scene = lazy(() => import('../lowpoly/Volcano.jsx'))

export default function LowPolyVolcanoModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

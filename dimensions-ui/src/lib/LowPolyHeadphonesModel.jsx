import { Suspense, lazy } from 'react'

// A low-poly motion-graphics model; see lowpoly/Headphones.jsx for what it does.
// (Thin wrapper: the scene lives in lowpoly/Headphones.jsx.)
const Scene = lazy(() => import('../lowpoly/Headphones.jsx'))

export default function LowPolyHeadphonesModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

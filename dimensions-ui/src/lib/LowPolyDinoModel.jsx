import { Suspense, lazy } from 'react'

// A low-poly animal for the motion-graphics set; see lowpoly/Dino.jsx for what it does.
// (Thin wrapper: the scene lives in lowpoly/Dino.jsx.)
const Scene = lazy(() => import('../lowpoly/Dino.jsx'))

export default function LowPolyDinoModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

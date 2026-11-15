import { Suspense, lazy } from 'react'

// A low-poly animal for the motion-graphics set; see lowpoly/Penguin.jsx for what it does.
// (Thin wrapper: the scene lives in lowpoly/Penguin.jsx.)
const Scene = lazy(() => import('../lowpoly/Penguin.jsx'))

export default function LowPolyPenguinModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

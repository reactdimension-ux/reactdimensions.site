import { Suspense, lazy } from 'react'

// A low-poly animal for the motion-graphics set; see lowpoly/Turtle.jsx for what it does.
// (Thin wrapper: the scene lives in lowpoly/Turtle.jsx.)
const Scene = lazy(() => import('../lowpoly/Turtle.jsx'))

export default function LowPolyTurtleModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

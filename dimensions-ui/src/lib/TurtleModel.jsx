import { Suspense, lazy } from 'react'

// A clay-toy turtle character; see turtle/Turtle.jsx for what it does.
// (Thin wrapper: the scene lives in turtle/Turtle.jsx.)
const Scene = lazy(() => import('../turtle/Turtle.jsx'))

export default function TurtleModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

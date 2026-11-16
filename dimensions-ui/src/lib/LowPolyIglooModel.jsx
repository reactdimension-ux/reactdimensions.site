import { Suspense, lazy } from 'react'

// A low-poly igloo of snow blocks with a tunnel entrance, snow falling around it. Tap it and a penguin pokes its head out of the tunnel.
// (Thin wrapper: the scene lives in lowpoly/Igloo.jsx.)
const Scene = lazy(() => import('../lowpoly/Igloo.jsx'))

export default function LowPolyIglooModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

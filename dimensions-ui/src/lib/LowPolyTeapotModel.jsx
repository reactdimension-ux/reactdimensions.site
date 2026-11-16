import { Suspense, lazy } from 'react'

// A low-poly teapot with steam curling from its spout; tap it and it tilts and pours into the cup.
// (Thin wrapper: the scene lives in lowpoly/Teapot.jsx.)
const Scene = lazy(() => import('../lowpoly/Teapot.jsx'))

export default function LowPolyTeapotModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

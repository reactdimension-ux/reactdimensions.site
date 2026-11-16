import { Suspense, lazy } from 'react'

// A low-poly ladybug crawling in a little circle on a leaf; tap it and its shell opens, it flies off and lands back.
// (Thin wrapper: the scene lives in lowpoly/Ladybug.jsx.)
const Scene = lazy(() => import('../lowpoly/Ladybug.jsx'))

export default function LowPolyLadybugModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

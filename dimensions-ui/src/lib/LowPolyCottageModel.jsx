import { Suspense, lazy } from 'react'

// A low-poly cottage with chimney smoke and glowing windows; tap it and the door swings open.
// (Thin wrapper: the scene lives in lowpoly/Cottage.jsx.)
const Scene = lazy(() => import('../lowpoly/Cottage.jsx'))

export default function LowPolyCottageModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

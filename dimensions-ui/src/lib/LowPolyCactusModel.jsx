import { Suspense, lazy } from 'react'

// A low-poly saguaro in a pot with a blooming flower and a sleepy face; tap it and it wobbles.
// (Thin wrapper: the scene lives in lowpoly/Cactus.jsx.)
const Scene = lazy(() => import('../lowpoly/Cactus.jsx'))

export default function LowPolyCactusModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

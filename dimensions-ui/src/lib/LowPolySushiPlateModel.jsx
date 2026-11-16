import { Suspense, lazy } from 'react'

// A low-poly sushi plate turning slowly; tap it and chopsticks pick up a piece.
// (Thin wrapper: the scene lives in lowpoly/SushiPlate.jsx.)
const Scene = lazy(() => import('../lowpoly/SushiPlate.jsx'))

export default function LowPolySushiPlateModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

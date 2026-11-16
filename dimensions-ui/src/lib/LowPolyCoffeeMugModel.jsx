import { Suspense, lazy } from 'react'

// A low-poly coffee mug with steam curling up from the cup. Tap it and a spoon stirs the coffee into a swirl.
// (Thin wrapper: the scene lives in lowpoly/Mug.jsx.)
const Scene = lazy(() => import('../lowpoly/Mug.jsx'))

export default function LowPolyCoffeeMugModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

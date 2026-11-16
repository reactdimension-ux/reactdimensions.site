import { Suspense, lazy } from 'react'

// A low-poly red panda with a ringed tail, flicking its ears; tap it and it stands up on its hind legs with its arms raised.
// (Thin wrapper: the scene lives in lowpoly/RedPanda.jsx.)
const Scene = lazy(() => import('../lowpoly/RedPanda.jsx'))

export default function LowPolyRedPandaModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

import { Suspense, lazy } from 'react'

// A tenpin made to the USBC specification, glossy and stripe-necked, as a
// real rigid body: tap it to make it wobble, press longer to knock it over,
// pick it up and throw it, or rack all ten on an oiled maple lane and bowl.
// Drag the background to orbit.
// (Thin wrapper: the scene lives in pin/BowlingPinScene.jsx.)
const Scene = lazy(() => import('../pin/BowlingPinScene.jsx'))

export default function BowlingPinModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

import { Suspense, lazy } from 'react'

// A compact electric SUV at real size, in a photo studio. The body is one skin
// built from a few rows of numbers; its glass, lamps, grille, cladding and
// shut lines are drawn on it by the material, so they stay sharp at any
// distance. Set the paint and the number plate, switch the lights, turn the
// wheels and steer them. `view` flies the camera round the views of a
// reference sheet. Drag to orbit.
// (Thin wrapper: the scene lives in suv/SuvScene.jsx.)
const Scene = lazy(() => import('../suv/SuvScene.jsx'))

export default function SuvModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

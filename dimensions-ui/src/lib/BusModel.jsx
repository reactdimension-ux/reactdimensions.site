import { Suspense, lazy } from 'react'

// A 12 m low-floor city bus at real size, in a photo studio. Every surface
// is built from the bus's own dimensions: the rounded shell with its glass
// cut in, the raked windscreen and the engine door, the saloon behind the
// glass with its seats, poles and straps, the chassis under the floor. The
// plug doors swing out and slide open; the lamps and the amber destination
// displays light. `view` flies the camera round the views of a reference
// sheet. Livery, lettering and plates are props. Drag to orbit. (Thin
// wrapper: the scene lives in bus/BusScene.jsx.)
const Scene = lazy(() => import('../bus/BusScene.jsx'))

export default function BusModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

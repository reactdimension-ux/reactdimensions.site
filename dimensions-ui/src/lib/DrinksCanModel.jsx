import { Suspense, lazy } from 'react'

// A 330 ml aluminium drinks can at real size, in a photo studio, built from
// its own dimensions: the domed base and chime, the straight wall, the neck
// and double seam, the countersunk end with its scored opening panel, and a
// stay-on pull tab on its rivet. Click the tab to open it. Bare brushed,
// polished or matte aluminium, or painted any colour. `view` flies the
// camera round the views of a product sheet. Drag to orbit.
// (Thin wrapper: the scene lives in can/CanScene.jsx.)
const Scene = lazy(() => import('../can/CanScene.jsx'))

export default function DrinksCanModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

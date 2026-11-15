import { Suspense, lazy } from 'react'

// A twin-engine stealth fighter at real size, in a photo studio. Every
// surface is built from the aircraft's own dimensions: the chined radome, the
// caret inlets and their ducts, the diamond wing with its flaps, the canted
// fins, the two-dimensional nozzles down to the flame holders. Open the
// canopy, swing the weapon bay doors down onto the missiles, raise the gear,
// light the afterburners, switch the lights. `view` flies the camera round
// the views of a reference sheet. Paint and lettering are props. Drag to
// orbit. (Thin wrapper: the scene lives in fighter/FighterScene.jsx.)
const Scene = lazy(() => import('../fighter/FighterScene.jsx'))

export default function FighterModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

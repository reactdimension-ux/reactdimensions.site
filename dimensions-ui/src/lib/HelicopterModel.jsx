import { Suspense, lazy } from 'react'

// A twin-engine light helicopter at real size, in a photo studio. Every
// surface is built from the aircraft's own dimensions: the glazed nose and
// boxy cabin, the cowling over the engines, the rotor head down to its pitch
// links, the skids, the fan in its shroud. Start the engines and the blades,
// which droop at rest, spin up into a blur and cone; lift it into the hover;
// switch the lights. `view` flies the camera round the views of a reference
// sheet. Paint, lettering and the number of blades are props. Drag to orbit.
// (Thin wrapper: the scene lives in helicopter/HelicopterScene.jsx.)
const Scene = lazy(() => import('../helicopter/HelicopterScene.jsx'))

export default function HelicopterModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

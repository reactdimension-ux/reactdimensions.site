import { Suspense, lazy } from 'react'

// A single-aisle twin-jet airliner at real size, in a photo studio. Every
// surface is built from the aircraft's own dimensions: the fuselage, the swept
// wing with its sharklets, the turbofans down to the fan blades, the landing
// gear. Set the flaps and the slats come out with them; raise the gear, start
// the engines, open the forward door, switch the lights. `view` flies the
// camera round the views of a reference sheet. Paint and lettering are props.
// Drag to orbit.
// (Thin wrapper: the scene lives in airliner/AirlinerScene.jsx.)
const Scene = lazy(() => import('../airliner/AirlinerScene.jsx'))

export default function AirlinerModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

import { Suspense, lazy } from 'react'

// A low-poly arcade stick: a ball-top lever and a row of buttons on a box base. The stick wiggles and the buttons light in turn; tap it and every button flashes.
// (Thin wrapper: the scene lives in lowpoly/Joystick.jsx.)
const Scene = lazy(() => import('../lowpoly/Joystick.jsx'))

export default function LowPolyArcadeJoystickModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

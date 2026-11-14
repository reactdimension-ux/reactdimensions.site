import { Suspense, lazy } from 'react'

// A small gem-on-a-plinth model whose camera orbits as you tilt your phone
// (DeviceOrientation beta/gamma). iPhones ask permission first, so there is an
// "Enable motion" button. With no sensor, or if motion is denied, moving the
// pointer (or dragging a finger) across the stage drives the same orbit. A
// little phone glyph in the corner tilts to show the current virtual tilt, and
// says which source is driving it.
// (Thin wrapper: the scene lives in ix/TiltOrbit.jsx.)
const Scene = lazy(() => import('../ix/TiltOrbit.jsx'))

export default function TiltOrbit({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

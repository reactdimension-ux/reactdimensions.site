import { Suspense, lazy } from 'react'

// A low-poly GT race car: faceted red body, dark glass, splitter, swan-neck
// wing and race numbers. Drag to orbit, double-tap to bounce it on its springs.
// Turn on `drivable` to drive it with W A S D / arrow keys (the Pickup's rig).
// (Thin wrapper: the scene lives in racecar/RaceCarScene.jsx.)
const Scene = lazy(() => import('../racecar/RaceCarScene.jsx'))

export default function LowPolyRaceCarModel({
  drivable = false,
  lightsOn = true,
  autoRotate = true,
  color = '#c8141e',
  number = '07',
  background = '#e4e0d8',
  bounce = 0,
  height = 460,
  style,
}) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene drivable={drivable} lightsOn={lightsOn} autoRotate={autoRotate} color={color} number={number} background={background} bounce={bounce} />
      </Suspense>
    </div>
  )
}

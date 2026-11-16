import { Suspense, lazy } from 'react'

// A low-poly space station: a core module with a turning ring and solar panels that track the light, over a starfield. Tap it and a capsule flies in and docks.
// (Thin wrapper: the scene lives in lowpoly/SpaceStation.jsx.)
const Scene = lazy(() => import('../lowpoly/SpaceStation.jsx'))

export default function LowPolySpaceStationModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

import { Suspense, lazy } from 'react'

// A low-poly drive-in with a flickering screen, a projector beam and a few parked cars; tap it and headlights flash as the film changes.
// (Thin wrapper: the scene lives in lowpoly/DriveInCinema.jsx.)
const Scene = lazy(() => import('../lowpoly/DriveInCinema.jsx'))

export default function LowPolyDriveInCinemaModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

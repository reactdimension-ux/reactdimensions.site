import { Suspense, lazy } from 'react'

// A low-poly sewing machine with its needle bobbing and wheel turning; tap it and fabric feeds through, leaving a stitched line.
// (Thin wrapper: the scene lives in lowpoly/SewingMachine.jsx.)
const Scene = lazy(() => import('../lowpoly/SewingMachine.jsx'))

export default function LowPolySewingMachineModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

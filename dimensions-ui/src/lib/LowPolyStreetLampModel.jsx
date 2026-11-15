import { Suspense, lazy } from 'react'

// A low-poly Victorian street lamp with a flickering light and moths; tap it to switch it off and on.
// (Thin wrapper: the scene lives in lowpoly/StreetLamp.jsx.)
const Scene = lazy(() => import('../lowpoly/StreetLamp.jsx'))

export default function LowPolyStreetLampModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

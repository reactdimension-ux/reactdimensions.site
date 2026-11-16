import { Suspense, lazy } from 'react'

// A low-poly light bulb whose filament smoulders; tap it to switch it on with a flash.
// (Thin wrapper: the scene lives in lowpoly/Bulb.jsx.)
const Scene = lazy(() => import('../lowpoly/Bulb.jsx'))

export default function LowPolyLightBulbModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

import { Suspense, lazy } from 'react'

// A low-poly striped lighthouse with sweeping twin beams; tap it and the lamp flashes.
// (Thin wrapper: the scene lives in lowpoly/Lighthouse.jsx.)
const Scene = lazy(() => import('../lowpoly/Lighthouse.jsx'))

export default function LowPolyLighthouseModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

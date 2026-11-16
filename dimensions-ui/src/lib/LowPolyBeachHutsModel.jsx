import { Suspense, lazy } from 'react'

// A low-poly row of striped beach huts on the sand with flags fluttering on the roofs; tap it and a door swings open.
// (Thin wrapper: the scene lives in lowpoly/BeachHuts.jsx.)
const Scene = lazy(() => import('../lowpoly/BeachHuts.jsx'))

export default function LowPolyBeachHutsModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

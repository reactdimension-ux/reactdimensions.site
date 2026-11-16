import { Suspense, lazy } from 'react'

// A low-poly seahorse bobbing upright, its tail curling and uncurling; tap it and it spins round a strand of seagrass.
// (Thin wrapper: the scene lives in lowpoly/Seahorse.jsx.)
const Scene = lazy(() => import('../lowpoly/Seahorse.jsx'))

export default function LowPolySeahorseModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

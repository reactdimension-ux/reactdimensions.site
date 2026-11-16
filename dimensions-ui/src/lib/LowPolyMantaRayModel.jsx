import { Suspense, lazy } from 'react'

// A low-poly manta ray gliding with slow waves of its wide wings over a patch of seabed; tap it and it does a barrel roll.
// (Thin wrapper: the scene lives in lowpoly/MantaRay.jsx.)
const Scene = lazy(() => import('../lowpoly/MantaRay.jsx'))

export default function LowPolyMantaRayModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

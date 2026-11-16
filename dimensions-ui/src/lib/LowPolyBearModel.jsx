import { Suspense, lazy } from 'react'

// A low-poly bear on a patch of meadow that sniffs and looks about; tap it and
// it rears up and roars. (Thin wrapper: the scene lives in lowpoly/Bear.jsx.)
const Scene = lazy(() => import('../lowpoly/Bear.jsx'))

export default function LowPolyBearModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

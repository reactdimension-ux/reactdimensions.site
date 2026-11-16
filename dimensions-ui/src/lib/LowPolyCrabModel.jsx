import { Suspense, lazy } from 'react'

// A low-poly crab on a patch of beach: a broad shell, eyes on stalks, eight jointed legs and two big claws. It scuttles sideways and back, claws raised; tap it and it snaps both claws with a clack.
// (Thin wrapper: the scene lives in lowpoly/Crab.jsx.)
const Scene = lazy(() => import('../lowpoly/Crab.jsx'))

export default function LowPolyCrabModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

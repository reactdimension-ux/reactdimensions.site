import { Suspense, lazy } from 'react'

// A low-poly stag beetle on a log, antennae twitching and mandibles opening slowly; tap it and it rears up and clacks its mandibles.
// (Thin wrapper: the scene lives in lowpoly/StagBeetle.jsx.)
const Scene = lazy(() => import('../lowpoly/StagBeetle.jsx'))

export default function LowPolyStagBeetleModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

import { Suspense, lazy } from 'react'

// A low-poly octopus over a sandy sea floor: a round head and eight tapering tentacles that wave in a rolling pattern. Tap it and it squirts a puff of ink and jets upward, tentacles trailing.
// (Thin wrapper: the scene lives in lowpoly/Octopus.jsx.)
const Scene = lazy(() => import('../lowpoly/Octopus.jsx'))

export default function LowPolyOctopusModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

import { Suspense, lazy } from 'react'

// A low-poly patch of reef on sand: branching corals, fan corals and an anemone whose fronds sway. Tap it and tiny fish dart out and back.
// (Thin wrapper: the scene lives in lowpoly/CoralReef.jsx.)
const Scene = lazy(() => import('../lowpoly/CoralReef.jsx'))

export default function LowPolyCoralReefModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

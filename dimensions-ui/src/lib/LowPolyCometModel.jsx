import { Suspense, lazy } from 'react'

// A low-poly comet with an icy faceted head streaking slowly past with a glowing tail; tap it and the tail flares bright and long.
// (Thin wrapper: the scene lives in lowpoly/Comet.jsx.)
const Scene = lazy(() => import('../lowpoly/Comet.jsx'))

export default function LowPolyCometModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

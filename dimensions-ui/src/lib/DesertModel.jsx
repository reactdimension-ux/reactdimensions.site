import { Suspense, lazy } from 'react'

// A sand sea: transverse dunes to the horizon under a physical sky. The
// ocean's radial grid is lifted onto a dune field in the vertex shader, and
// the sand is shaded for what it is: wind ripples on the windward slopes,
// grains glittering in the sun, the lee of every dune in shadow, dusty haze
// to the horizon, and sand streaming off the crests in the wind. Set the sun
// from dawn to noon and the wind from still to a sandstorm.
// (Thin wrapper: the scene lives in desert/DesertScene.jsx.)
const Scene = lazy(() => import('../desert/DesertScene.jsx'))

export default function DesertModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

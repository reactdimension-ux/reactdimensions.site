import { Suspense, lazy } from 'react'

// A tiny low-poly planet with a little house and trees on top, turning slowly under them as clouds circle. Tap it and day flips to night: the sky darkens, the windows light and the stars come out.
// (Thin wrapper: the scene lives in lowpoly/TinyPlanet.jsx.)
const Scene = lazy(() => import('../lowpoly/TinyPlanet.jsx'))

export default function LowPolyTinyPlanetModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

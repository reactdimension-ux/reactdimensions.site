import { Suspense, lazy } from 'react'

// A low-poly canal gondola with a gondolier rowing as the boat rocks; tap it and it turns under a little bridge.
// (Thin wrapper: the scene lives in lowpoly/CanalGondola.jsx.)
const Scene = lazy(() => import('../lowpoly/CanalGondola.jsx'))

export default function LowPolyCanalGondolaModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

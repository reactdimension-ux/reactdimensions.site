import { Suspense, lazy } from 'react'

// A low-poly snowman with a fluttering scarf in falling snow; tap him and he wobbles.
// (Thin wrapper: the scene lives in lowpoly/Snowman.jsx.)
const Scene = lazy(() => import('../lowpoly/Snowman.jsx'))

export default function LowPolySnowmanModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

import { Suspense, lazy } from 'react'

// A low-poly motion-graphics model; see lowpoly/Potion.jsx for what it does.
// (Thin wrapper: the scene lives in lowpoly/Potion.jsx.)
const Scene = lazy(() => import('../lowpoly/Potion.jsx'))

export default function LowPolyPotionModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

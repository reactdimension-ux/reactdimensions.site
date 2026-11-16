import { Suspense, lazy } from 'react'

// A low-poly deer in a meadow, with slim long legs, antlers and a white tail. It grazes, lifts its head and flicks its ears; tap it and it lifts its head, bounds away across the meadow and trots back.
// (Thin wrapper: the scene lives in lowpoly/Deer.jsx.)
const Scene = lazy(() => import('../lowpoly/Deer.jsx'))

export default function LowPolyDeerModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

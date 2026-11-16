import { Suspense, lazy } from 'react'

// A low-poly dragon egg wobbling and glowing in a twig nest; tap it and it cracks open and a tiny dragon peeks out.
// (Thin wrapper: the scene lives in lowpoly/DragonEgg.jsx.)
const Scene = lazy(() => import('../lowpoly/DragonEgg.jsx'))

export default function LowPolyDragonEggModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

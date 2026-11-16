import { Suspense, lazy } from 'react'

// A low-poly bakery shopfront with a striped awning and warm smoke from the chimney; tap it and the door opens and a loaf pops out on a tray.
// (Thin wrapper: the scene lives in lowpoly/Bakery.jsx.)
const Scene = lazy(() => import('../lowpoly/Bakery.jsx'))

export default function LowPolyBakeryModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

import { Suspense, lazy } from 'react'

// A low-poly lion built the same way as the Low Poly Bear: a tawny body on stubby legs, a shaggy mane and a tufted tail on a patch of savanna. It breathes, sniffs, looks about and swings its tail; tap it and it throws its head back and roars.
// (Thin wrapper: the scene lives in lowpoly/Lion.jsx.)
const Scene = lazy(() => import('../lowpoly/Lion.jsx'))

export default function LowPolyLionModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

import { Suspense, lazy } from 'react'

// A low-poly dog built the same way as the Low Poly Bear: floppy ears, a longer snout and a waggy tail on a meadow. It breathes, sniffs, looks about and wags; tap it and it bounces up in two happy hops, spinning and barking.
// (Thin wrapper: the scene lives in lowpoly/Dog.jsx.)
const Scene = lazy(() => import('../lowpoly/Dog.jsx'))

export default function LowPolyDogModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

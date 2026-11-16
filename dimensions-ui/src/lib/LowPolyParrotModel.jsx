import { Suspense, lazy } from 'react'

// A bright low-poly parrot on a perch, with a hooked beak, folded wings and a long tail. It bobs its head and shuffles; tap it and it squawks, ruffling its feathers and spreading its wings.
// (Thin wrapper: the scene lives in lowpoly/Parrot.jsx.)
const Scene = lazy(() => import('../lowpoly/Parrot.jsx'))

export default function LowPolyParrotModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

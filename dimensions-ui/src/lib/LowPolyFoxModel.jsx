import { Suspense, lazy } from 'react'

// A low-poly sitting fox that breathes, blinks, looks about and swishes its tail; tap it and it cocks its head.
// (Thin wrapper: the scene lives in lowpoly/Fox.jsx.)
const Scene = lazy(() => import('../lowpoly/Fox.jsx'))

export default function LowPolyFoxModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

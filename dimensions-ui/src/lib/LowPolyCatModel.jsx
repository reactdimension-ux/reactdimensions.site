import { Suspense, lazy } from 'react'

// A slender low-poly cat built the same way as the Low Poly Bear: pointed ears, slit-pupil eyes, whiskers and a tail curving up. It breathes, sniffs and swishes its tail; tap it and it arches its back, fur up and tail in the air, and hisses.
// (Thin wrapper: the scene lives in lowpoly/Cat.jsx.)
const Scene = lazy(() => import('../lowpoly/Cat.jsx'))

export default function LowPolyCatModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

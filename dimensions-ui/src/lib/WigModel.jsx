import { Suspense, lazy } from 'react'

// A realistic wig on a display head: thousands of strands grown from a scalp,
// draped over the head and shoulders, in waves or curls, with a glossy
// highlight that runs along the hair. (Thin wrapper: the scene lives in wig/WigScene.jsx.)
const Scene = lazy(() => import('../wig/WigScene.jsx'))

export default function WigModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

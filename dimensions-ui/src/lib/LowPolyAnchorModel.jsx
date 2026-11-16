import { Suspense, lazy } from 'react'

// A low-poly ship's anchor hanging on a chain of links above the sea floor, swaying gently. Tap it and it drops, thuds into the sand and kicks up a puff.
// (Thin wrapper: the scene lives in lowpoly/Anchor.jsx.)
const Scene = lazy(() => import('../lowpoly/Anchor.jsx'))

export default function LowPolyAnchorModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

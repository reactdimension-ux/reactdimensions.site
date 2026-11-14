import { Suspense, lazy } from 'react'

// A classic stemmed wine glass of our own design, in real glass: wine that
// sloshes when the glass is slid or swirled, and a ring when you strike it
// whose pitch drops as the glass fills. (Thin wrapper: the scene lives in
// wineglass/WineGlassScene.jsx.)
const Scene = lazy(() => import('../wineglass/WineGlassScene.jsx'))

export default function WineGlassModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

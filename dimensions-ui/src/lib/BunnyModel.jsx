import { Suspense, lazy } from 'react'

// A clay-toy bunny character; see bunny/Bunny.jsx for what it does.
// (Thin wrapper: the scene lives in bunny/Bunny.jsx.)
const Scene = lazy(() => import('../bunny/Bunny.jsx'))

export default function BunnyModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

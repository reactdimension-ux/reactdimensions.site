import { Suspense, lazy } from 'react'

// A clay-toy lion character; see toylion/ToyLion.jsx for what it does.
// (Thin wrapper: the scene lives in toylion/ToyLion.jsx.)
const Scene = lazy(() => import('../toylion/ToyLion.jsx'))

export default function ToyLionModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

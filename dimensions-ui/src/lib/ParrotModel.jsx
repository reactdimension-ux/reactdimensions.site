import { Suspense, lazy } from 'react'

// A clay-toy parrot character; see parrot/Parrot.jsx for what it does.
// (Thin wrapper: the scene lives in parrot/Parrot.jsx.)
const Scene = lazy(() => import('../parrot/Parrot.jsx'))

export default function ParrotModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

import { Suspense, lazy } from 'react'

// A clay-toy elephant character; see elephant/Elephant.jsx for what it does.
// (Thin wrapper: the scene lives in elephant/Elephant.jsx.)
const Scene = lazy(() => import('../elephant/Elephant.jsx'))

export default function ElephantModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

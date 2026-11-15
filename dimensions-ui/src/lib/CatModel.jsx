import { Suspense, lazy } from 'react'

// A clay-toy cat character; see cat/Cat.jsx for what it does.
// (Thin wrapper: the scene lives in cat/Cat.jsx.)
const Scene = lazy(() => import('../cat/Cat.jsx'))

export default function CatModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

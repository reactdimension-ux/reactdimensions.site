import { Suspense, lazy } from 'react'

// A clay-toy giraffe character; see giraffe/Giraffe.jsx for what it does.
// (Thin wrapper: the scene lives in giraffe/Giraffe.jsx.)
const Scene = lazy(() => import('../giraffe/Giraffe.jsx'))

export default function GiraffeModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

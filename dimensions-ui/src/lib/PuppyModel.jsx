import { Suspense, lazy } from 'react'

// A clay-toy puppy character; see puppy/Puppy.jsx for what it does.
// (Thin wrapper: the scene lives in puppy/Puppy.jsx.)
const Scene = lazy(() => import('../puppy/Puppy.jsx'))

export default function PuppyModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

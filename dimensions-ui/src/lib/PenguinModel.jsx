import { Suspense, lazy } from 'react'

// A clay-toy penguin character; see penguin/Penguin.jsx for what it does.
// (Thin wrapper: the scene lives in penguin/Penguin.jsx.)
const Scene = lazy(() => import('../penguin/Penguin.jsx'))

export default function PenguinModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

import { Suspense, lazy } from 'react'

// A blocky toy panda; see blocky/Panda.jsx for what it does.
// (Thin wrapper: the scene lives in blocky/Panda.jsx.)
const Scene = lazy(() => import('../blocky/Panda.jsx'))

export default function BlockyPandaModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

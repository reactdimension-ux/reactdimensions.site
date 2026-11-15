import { Suspense, lazy } from 'react'

// A clay-toy rhino character; see rhino/Rhino.jsx for what it does.
// (Thin wrapper: the scene lives in rhino/Rhino.jsx.)
const Scene = lazy(() => import('../rhino/Rhino.jsx'))

export default function RhinoModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

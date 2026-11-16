import { Suspense, lazy } from 'react'

// A procedural low-poly male lion in an orthographic viewer with ten camera views.
// (Thin wrapper: the scene lives in polylion/LionViewer.jsx.)
const Scene = lazy(() => import('../polylion/LionViewer.jsx'))

export default function PolygonLionModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

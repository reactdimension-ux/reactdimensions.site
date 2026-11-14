import { Suspense, lazy } from 'react'

// A full-size BWF badminton court as laid in a sports hall: a green PVC
// court mat with exact 40 mm lines on a varnished maple floor, the net on
// weighted red and blue posts, and shuttles lying on court. Jump between the
// views on a court drawing (plan, ends, sides, four quarters, net, line
// junction, corner, mat edge) or orbit freely.
// (Thin wrapper: the scene lives in badmintoncourt/CourtScene.jsx.)
const Scene = lazy(() => import('../badmintoncourt/CourtScene.jsx'))

export default function BadmintonCourtModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

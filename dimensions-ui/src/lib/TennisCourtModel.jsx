import { Suspense, lazy } from 'react'

// A full-size tennis court on its slab: an acrylic hard surface with sand
// grit and exact painted lines, a real mesh net on green posts with a winder
// crank, and wear from play. Jump between the views on a court drawing
// (plan, ends, sides, four corners, net, post, line, corner) or orbit freely.
// (Thin wrapper: the scene lives in tenniscourt/CourtScene.jsx.)
const Scene = lazy(() => import('../tenniscourt/CourtScene.jsx'))

export default function TennisCourtModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

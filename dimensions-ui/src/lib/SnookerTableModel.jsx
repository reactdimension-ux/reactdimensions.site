import { Suspense, lazy } from 'react'

// A full-size 12 ft snooker table on a studio floor, built from the roulette
// and poker tables' parts: baize with the baulk line, D and spots, rubber
// cushions cut back into the pocket jaws, leather pocket plates over string
// nets on brass irons, a mitred mahogany rail and apron, and eight fluted
// legs. The balls can be racked or cleared, every colour is a prop, and
// `view` flies the camera round the views of a product sheet. Drag to orbit.
// (Thin wrapper: the scene lives in snooker/SnookerScene.jsx.)
const Scene = lazy(() => import('../snooker/SnookerScene.jsx'))

export default function SnookerTableModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

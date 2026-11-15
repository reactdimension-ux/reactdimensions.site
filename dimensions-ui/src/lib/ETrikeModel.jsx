import { Suspense, lazy } from 'react'

// An electric tuk-tuk (auto rickshaw) at real size, in a photo studio, of our
// own design. Every surface is built from its own dimensions: the rounded
// cowl over the single front wheel, the raked windscreen, the canvas soft
// top, the open cab with its pleated seats, the battery under the bench, the
// motor on the rear axle. `view` flies the camera round the views of a
// reference sheet, close-ups included. Steer it, drive it, lift the bench,
// open the charging flap and plug in, switch the lamps. Drag to orbit.
// (Thin wrapper: the scene lives in etrike/ETrikeScene.jsx.)
const Scene = lazy(() => import('../etrike/ETrikeScene.jsx'))

export default function ETrikeModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

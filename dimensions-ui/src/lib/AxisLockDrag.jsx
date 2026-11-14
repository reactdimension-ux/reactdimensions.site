import { Suspense, lazy } from 'react'

// Shift-drag to lock an axis. Drag a crate across a gridded floor; hold Shift
// and it moves along only the X or the Z axis (whichever you moved first), with
// a guide line and an "Axis locked" badge. Touch has no Shift, so an on-screen
// "Lock axis" toggle does the same. It lifts when held and settles with a small
// bounce when released; optional snap-to-grid.
// (Thin wrapper: the scene lives in ix/AxisLockDrag.jsx.)
const Scene = lazy(() => import('../ix/AxisLockDrag.jsx'))

export default function AxisLockDrag({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

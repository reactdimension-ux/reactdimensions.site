import { Suspense, lazy } from 'react'

// A one-piece moulded stadium seat at real size, on two powder-coated steel
// brackets: a rolled front lip, drain slots, a raised panel on the backrest,
// and a truss of ribs and boxed bosses underneath where black clamp blocks
// bolt it to the uprights. `seats` lines up a row; `explode` lifts the shell
// off its brackets (click a seat to toggle it). `view` flies the camera round
// the views of a product sheet. Drag to orbit.
// (Thin wrapper: the scene lives in stadiumseat/StadiumSeatScene.jsx.)
const Scene = lazy(() => import('../stadiumseat/StadiumSeatScene.jsx'))

export default function StadiumSeatModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

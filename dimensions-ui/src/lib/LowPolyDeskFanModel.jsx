import { Suspense, lazy } from 'react'

// A low-poly desk fan with spinning blades and an oscillating head; tap it and the speed jumps and a paper flies off the desk.
// (Thin wrapper: the scene lives in lowpoly/DeskFan.jsx.)
const Scene = lazy(() => import('../lowpoly/DeskFan.jsx'))

export default function LowPolyDeskFanModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

import { Suspense, lazy } from 'react'

// A crooked low-poly haunted house with a bare tree and a broken fence, its windows glowing. A ghost peeks from a window now and then; tap it and bats burst from the roof.
// (Thin wrapper: the scene lives in lowpoly/HauntedHouse.jsx.)
const Scene = lazy(() => import('../lowpoly/HauntedHouse.jsx'))

export default function LowPolyHauntedHouseModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

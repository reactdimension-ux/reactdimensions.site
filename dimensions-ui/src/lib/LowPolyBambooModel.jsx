import { Suspense, lazy } from 'react'

// A clump of low-poly bamboo: segmented stalks with blade leaves, swaying out of step in the breeze. Tap it and the stalks knock together, clacking, and settle.
// (Thin wrapper: the scene lives in lowpoly/Bamboo.jsx.)
const Scene = lazy(() => import('../lowpoly/Bamboo.jsx'))

export default function LowPolyBambooModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

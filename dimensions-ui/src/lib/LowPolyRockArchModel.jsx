import { Suspense, lazy } from 'react'

// A low-poly desert rock arch with a sun shadow sweeping beneath it; tap it and a tumbleweed rolls through the gap.
// (Thin wrapper: the scene lives in lowpoly/RockArch.jsx.)
const Scene = lazy(() => import('../lowpoly/RockArch.jsx'))

export default function LowPolyRockArchModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

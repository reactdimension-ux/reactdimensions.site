import { Suspense, lazy } from 'react'

// A low-poly biplane with two wings, struts and a spinning propeller, banking gently as it flies. Tap it and it does a barrel roll.
// (Thin wrapper: the scene lives in lowpoly/Biplane.jsx.)
const Scene = lazy(() => import('../lowpoly/Biplane.jsx'))

export default function LowPolyBiplaneModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

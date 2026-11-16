import { Suspense, lazy } from 'react'

// A low-poly axolotl with frilly gills that wave as its tail sways; tap it and it smiles and swims a little loop.
// (Thin wrapper: the scene lives in lowpoly/Axolotl.jsx.)
const Scene = lazy(() => import('../lowpoly/Axolotl.jsx'))

export default function LowPolyAxolotlModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

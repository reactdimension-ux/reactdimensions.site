import { Suspense, lazy } from 'react'

// A low-poly jack-o'-lantern with a flickering carved face; tap it and it hops and pulls a new face.
// (Thin wrapper: the scene lives in lowpoly/Pumpkin.jsx.)
const Scene = lazy(() => import('../lowpoly/Pumpkin.jsx'))

export default function LowPolyPumpkinModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

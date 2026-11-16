import { Suspense, lazy } from 'react'

// A low-poly glass popcorn cart where kernels pop now and then; tap it and a burst of popcorn overflows the kettle.
// (Thin wrapper: the scene lives in lowpoly/PopcornMachine.jsx.)
const Scene = lazy(() => import('../lowpoly/PopcornMachine.jsx'))

export default function LowPolyPopcornMachineModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

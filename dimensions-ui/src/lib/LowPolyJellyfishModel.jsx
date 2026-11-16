import { Suspense, lazy } from 'react'

// A translucent low-poly jellyfish: a glowing bell trailing ribbon tentacles, pulsing as it drifts up and sinks back. Tap it and it glows bright and pulses fast.
// (Thin wrapper: the scene lives in lowpoly/Jellyfish.jsx.)
const Scene = lazy(() => import('../lowpoly/Jellyfish.jsx'))

export default function LowPolyJellyfishModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

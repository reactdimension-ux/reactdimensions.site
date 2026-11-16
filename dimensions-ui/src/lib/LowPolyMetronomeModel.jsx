import { Suspense, lazy } from 'react'

// A low-poly metronome with its arm ticking side to side; tap it and the tempo speeds up, then settles back.
// (Thin wrapper: the scene lives in lowpoly/Metronome.jsx.)
const Scene = lazy(() => import('../lowpoly/Metronome.jsx'))

export default function LowPolyMetronomeModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

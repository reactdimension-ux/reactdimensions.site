import { Suspense, lazy } from 'react'

// A low-poly gramophone with its record spinning and notes floating out of the horn; tap it and the needle drops with a sparkle of notes.
// (Thin wrapper: the scene lives in lowpoly/Gramophone.jsx.)
const Scene = lazy(() => import('../lowpoly/Gramophone.jsx'))

export default function LowPolyGramophoneModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

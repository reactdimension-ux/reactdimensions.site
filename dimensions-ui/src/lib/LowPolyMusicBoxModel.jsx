import { Suspense, lazy } from 'react'

// A low-poly music box with its lid open a crack and a small dancer turning; tap it and the lid opens fully and the dancer spins.
// (Thin wrapper: the scene lives in lowpoly/MusicBox.jsx.)
const Scene = lazy(() => import('../lowpoly/MusicBox.jsx'))

export default function LowPolyMusicBoxModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

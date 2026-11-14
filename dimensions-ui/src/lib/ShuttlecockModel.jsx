import { Suspense, lazy } from 'react'

// A feathered badminton shuttlecock at real size: sixteen translucent goose
// feathers drawn barb by barb, glued cotton binding, and a leather-covered
// cork with a speed band. Serve it and it flips cork-first, spins and falls
// at terminal speed, then topples onto its side.
// (Thin wrapper: the scene lives in shuttlecock/ShuttlecockScene.jsx.)
const Scene = lazy(() => import('../shuttlecock/ShuttlecockScene.jsx'))

export default function ShuttlecockModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

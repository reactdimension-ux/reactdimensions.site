import { Suspense, lazy } from 'react'

// A low-poly padlock with its key hovering beside it, turning slowly. Tap it and the key slides in, turns, and the shackle pops up open.
// (Thin wrapper: the scene lives in lowpoly/LockKey.jsx.)
const Scene = lazy(() => import('../lowpoly/LockKey.jsx'))

export default function LowPolyLockAndKeyModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

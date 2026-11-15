import { Suspense, lazy } from 'react'

// A low-poly motion-graphics model; see lowpoly/CubeBuddy.jsx for what it does.
// (Thin wrapper: the scene lives in lowpoly/CubeBuddy.jsx.)
const Scene = lazy(() => import('../lowpoly/CubeBuddy.jsx'))

export default function LowPolyCubeBuddyModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

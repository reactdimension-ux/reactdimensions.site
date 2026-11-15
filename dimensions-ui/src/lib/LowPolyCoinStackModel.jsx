import { Suspense, lazy } from 'react'

// A low-poly motion-graphics model; see lowpoly/CoinStack.jsx for what it does.
// (Thin wrapper: the scene lives in lowpoly/CoinStack.jsx.)
const Scene = lazy(() => import('../lowpoly/CoinStack.jsx'))

export default function LowPolyCoinStackModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

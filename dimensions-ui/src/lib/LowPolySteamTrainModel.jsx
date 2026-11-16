import { Suspense, lazy } from 'react'

// A low-poly steam locomotive and tender chugging round a ring of track, wheels and rods turning and smoke puffing from the stack. Tap it and it whistles a burst of steam.
// (Thin wrapper: the scene lives in lowpoly/SteamTrain.jsx.)
const Scene = lazy(() => import('../lowpoly/SteamTrain.jsx'))

export default function LowPolySteamTrainModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

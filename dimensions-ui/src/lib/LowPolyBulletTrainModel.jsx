import { Suspense, lazy } from 'react'

// A low-poly bullet train humming on its track with pulsing lights; tap it and it shoots past in a blur and glides back.
// (Thin wrapper: the scene lives in lowpoly/BulletTrain.jsx.)
const Scene = lazy(() => import('../lowpoly/BulletTrain.jsx'))

export default function LowPolyBulletTrainModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

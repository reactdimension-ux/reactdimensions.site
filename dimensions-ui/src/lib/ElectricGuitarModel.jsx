import { Suspense, lazy } from 'react'

// A classic solid-body electric guitar of our own design, playable: string
// physics, a floating vibrato bridge, three single coils with a five-way
// switch, volume and tone, and WebAudio sound shaped by the pickups.
// (Thin wrapper: the scene lives in electric/ElectricScene.jsx.)
const Scene = lazy(() => import('../electric/ElectricScene.jsx'))

export default function ElectricGuitarModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

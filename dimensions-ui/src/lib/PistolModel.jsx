import { Suspense, lazy } from 'react'

// A compact striker-fired pistol, unloaded, built to real proportions: a
// chamfered slide with cocking serrations and an ejection port, a tilting
// barrel, a stippled polymer grip, sights, pins and levers. Drag the slide
// back to rack it, click the trigger to dry-fire (it stays back until you
// rack again), and drop or seat the magazine. Drag the background to orbit.
// (Thin wrapper: the scene lives in pistol/PistolScene.jsx.)
const Scene = lazy(() => import('../pistol/PistolScene.jsx'))

export default function PistolModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

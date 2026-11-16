import { Suspense, lazy } from 'react'

// A low-poly crooked wizard tower with glowing windows and a floating orb; tap it and sparks spiral up into fireworks.
// (Thin wrapper: the scene lives in lowpoly/WizardTower.jsx.)
const Scene = lazy(() => import('../lowpoly/WizardTower.jsx'))

export default function LowPolyWizardTowerModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

import { Suspense, lazy } from 'react'

// A recordable CD (CD-R) of our own brand, to the real dimensions: clear
// polycarbonate, a dye and mirror layer, a printed label, and a data side
// whose spiral track splits light into rainbows. Spin it, flip it, burn it.
// (Thin wrapper: the scene lives in cd/DiscScene.jsx.)
const Scene = lazy(() => import('../cd/DiscScene.jsx'))

export default function CompactDiscModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

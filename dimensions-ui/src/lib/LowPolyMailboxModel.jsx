import { Suspense, lazy } from 'react'

// A low-poly roadside mailbox; tap it and the door opens, a letter pops out and the flag goes up.
// (Thin wrapper: the scene lives in lowpoly/Mailbox.jsx.)
const Scene = lazy(() => import('../lowpoly/Mailbox.jsx'))

export default function LowPolyMailboxModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

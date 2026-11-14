import { Suspense, lazy } from 'react'

// Nudge a part with the keyboard. A small toy robot is built from separate
// parts; click one to select it, then the arrow keys move it a unit on X/Z,
// PageUp/PageDown move it on Y, Shift makes the step five units, Backspace
// resets it and Esc deselects. A readout shows its name and position. The
// stage must be focused for the keys to act.
// (Thin wrapper: the scene lives in ix/NudgePart.jsx.)
const Scene = lazy(() => import('../ix/NudgePart.jsx'))

export default function NudgePart({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

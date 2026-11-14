import { Suspense, lazy } from 'react'

// A full-size roulette table with a working single-zero wheel: baize
// printed with the betting layout, a padded leather arm rail, lyre
// pedestals, and a ball that is simulated round the track, off the
// deflectors and over the pocket separators until it settles on a number.
// Bet chips on the cloth and spin. Built on the board models' studio.
// (Thin wrapper: the scene lives in roulette/RouletteScene.jsx.)
const Scene = lazy(() => import('../roulette/RouletteScene.jsx'))

export default function RouletteModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

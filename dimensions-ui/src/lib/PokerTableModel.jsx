import { Suspense, lazy } from 'react'

// A full-size oval poker table: a padded leather arm rail with steel cup
// holders, a polished racetrack, baize printed with the betting line and
// seat lines, a dealer's cut-out with a chip tray and drop slot, octagonal
// pedestals and a brass foot rail. Built from the roulette table's builders
// and materials on the board models' studio.
// (Thin wrapper: the scene lives in poker/PokerScene.jsx.)
const Scene = lazy(() => import('../poker/PokerScene.jsx'))

export default function PokerTableModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

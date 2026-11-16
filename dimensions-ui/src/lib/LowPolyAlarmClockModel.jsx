import { Suspense, lazy } from 'react'

// A twin-bell low-poly alarm clock whose hands tick round. Tap it and it rings: the hammer rattles between the bells and the clock judders across the floor.
// (Thin wrapper: the scene lives in lowpoly/AlarmClock.jsx.)
const Scene = lazy(() => import('../lowpoly/AlarmClock.jsx'))

export default function LowPolyAlarmClockModel({ height = 520, style, ...props }) {
  return (
    <div style={{ width: '100%', height, ...style }}>
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </div>
  )
}

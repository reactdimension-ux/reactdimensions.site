import { useEffect, useState } from 'react'

// A quiet loading state over the preview stage, shown until the component
// has actually drawn, not just until its code has arrived.
//
// 3D models load their scene lazily and then build textures and compile
// shaders on the main thread, which can take a second or two with the page
// busy. So for those we wait for the canvas to appear and be sized by the
// renderer, then for that heavy work to finish and a frame or two to paint
// after it:
//   where the browser reports long tasks (Chromium), directly: no long task
//   for a quarter of a second and two frames since the last one (if no long
//   task turns up within a second of sizing, the scene was light);
//   elsewhere, by a run of smooth frames (judged against the page's own frame
//   rate, so a throttled view still settles).
// Other components are ready as soon as they have rendered something.
//
// The spinner is a CSS transform animation, which the compositor keeps
// running even while the main thread is busy. It fades in after a beat, so
// components that appear at once never flash it.
const LONGTASKS = typeof PerformanceObserver !== 'undefined' && (PerformanceObserver.supportedEntryTypes || []).includes('longtask')

export default function StageLoader({ target, expectCanvas }) {
  const [phase, setPhase] = useState('loading') // loading -> leaving -> gone

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const start = last
    let smooth = 0
    let minGap = Infinity
    let canvasAt = 0
    let sizedAt = 0
    let lastLong = 0 // when the latest long task ended
    let longSinceCanvas = false
    let framesSinceLong = 0
    let counted = 0

    let po = null
    if (LONGTASKS) {
      po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          const end = e.startTime + e.duration
          if (end > lastLong) lastLong = end
          if (canvasAt && end > canvasAt) longSinceCanvas = true
        }
      })
      try {
        po.observe({ type: 'longtask' })
      } catch {
        po = null
      }
    }

    const tick = (now) => {
      const gap = now - last
      last = now
      if (gap > 4) minGap = Math.min(minGap, gap)
      smooth = gap < Math.max(50, minGap * 1.6) ? smooth + 1 : 0
      if (lastLong !== counted) {
        counted = lastLong
        framesSinceLong = 0
      } else framesSinceLong++

      const el = target.current
      let ready = false
      if (el) {
        const canvas = el.querySelector('canvas')
        if (canvas && !canvasAt) canvasAt = now
        // the renderer only builds the scene once it has measured the canvas
        // and sized its drawing buffer (a bare canvas starts at 300 x 150), so
        // time the "no heavy work turned up" fallback from that moment
        if (canvas && !sizedAt && canvas.clientWidth > 0 && (canvas.width !== 300 || canvas.height !== 150) && canvas.width >= canvas.clientWidth * 0.95) sizedAt = now
        if (expectCanvas) {
          const settled = po
            ? (longSinceCanvas || now - sizedAt > 1000) && now - lastLong > 250 && framesSinceLong >= 2
            : smooth >= 4
          ready = sizedAt > 0 && now - sizedAt > 150 && settled
        } else ready = !!(canvas || el.querySelector('svg, img, video') || el.textContent.trim().length > 0)
      }
      // ready before the loader has faded in: just drop it, no flash
      if (ready && now - start < 150) setPhase('gone')
      // otherwise fade out (and never hold the stage hostage)
      else if (ready || now - start > 15000) setPhase('leaving')
      else raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      po?.disconnect()
    }
  }, [target, expectCanvas])

  useEffect(() => {
    if (phase !== 'leaving') return
    const id = setTimeout(() => setPhase('gone'), 320)
    return () => clearTimeout(id)
  }, [phase])

  if (phase === 'gone') return null
  return (
    <div className={`stage-loader${phase === 'leaving' ? ' is-leaving' : ''}`} role="status" aria-live="polite">
      <span className="stage-loader-ring" aria-hidden="true" />
      <span className="stage-loader-label">Loading</span>
    </div>
  )
}

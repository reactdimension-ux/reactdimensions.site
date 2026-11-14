import { useEffect, useRef, useState } from 'react'

// A window onto a layered landscape: sky, sun, three ridges and a foreground
// sill. The view shifts as your viewpoint moves, near layers more than far
// ones, like looking through a real window. By default the pointer (or a
// finger) is the viewpoint. "Use camera" optionally starts head tracking: it
// asks for the webcam only after you press it, uses the browser's FaceDetector
// when there is one and otherwise a small motion-centroid tracker on a tiny
// downscaled frame. The video never leaves the device, nothing is recorded or
// stored, and "Stop camera" (or leaving the page) stops every track.

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

export default function HeadParallax({
  strength = 1,
  smoothing = 0.85,
  mirror = false,
  skyColor = '#f6c58f',
  farColor = '#c98a8f',
  nearColor = '#2b3a55',
  accent = '#ff4d1a',
  style,
}) {
  const stage = useRef(null)
  const layers = useRef([])
  const video = useRef(null)
  const dot = useRef(null)
  const target = useRef({ x: 0, y: 0 })
  const cur = useRef({ x: 0, y: 0 })
  const opts = useRef({})
  opts.current = { strength, smoothing, mirror }
  const camRef = useRef({ stream: null, timer: 0, alive: true, token: 0 })
  const [cam, setCam] = useState('off') // off | starting | on
  const [msg, setMsg] = useState('')
  const [mode, setMode] = useState('pointer')

  const stopCamera = () => {
    const c = camRef.current
    c.token++
    if (c.timer) clearInterval(c.timer)
    c.timer = 0
    if (c.stream) c.stream.getTracks().forEach((t) => t.stop())
    c.stream = null
    if (video.current) video.current.srcObject = null
    if (c.alive) {
      setCam('off')
      setMode('pointer')
      target.current = { x: 0, y: 0 }
    }
  }

  useEffect(() => {
    const c = camRef.current
    c.alive = true
    return () => {
      c.alive = false
      c.token++
      if (c.timer) clearInterval(c.timer)
      if (c.stream) c.stream.getTracks().forEach((t) => t.stop())
      c.stream = null
    }
  }, [])

  const startCamera = async () => {
    const c = camRef.current
    if (!navigator.mediaDevices?.getUserMedia) {
      setMsg('Camera is not available here (it needs a secure page and a camera). Using the pointer.')
      return
    }
    const token = ++c.token
    setCam('starting')
    setMsg('')
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: 'user' }, audio: false })
    } catch (err) {
      if (c.alive && token === c.token) {
        setCam('off')
        setMsg(err && err.name === 'NotFoundError' ? 'No camera found. Using the pointer.' : 'Camera permission was denied. Using the pointer instead.')
      }
      return
    }
    if (!c.alive || token !== c.token) {
      stream.getTracks().forEach((t) => t.stop())
      return
    }
    c.stream = stream
    const v = video.current
    v.srcObject = stream
    try {
      await v.play()
    } catch {
      /* autoplay is allowed for muted inline video; ignore */
    }
    if (!c.alive || token !== c.token) return
    setCam('on')
    setMode('camera')

    // tracker: FaceDetector if present, else motion centroid on a 40x30 frame
    let detector = null
    try {
      if ('FaceDetector' in window) detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 })
    } catch {
      detector = null
    }
    const W = 40
    const H = 30
    const small = document.createElement('canvas')
    small.width = W
    small.height = H
    const sg = small.getContext('2d', { willReadFrequently: true })
    let prev = null
    let busy = false
    let pos = { x: 0.5, y: 0.5 } // in video coords 0..1
    const mark = () => {
      // the preview is mirrored, so the dot is too
      if (dot.current) {
        dot.current.style.left = (1 - pos.x) * 100 + '%'
        dot.current.style.top = pos.y * 100 + '%'
      }
      // viewer's right = positive x
      target.current = { x: clamp((0.5 - pos.x) * 2, -1, 1), y: clamp((pos.y - 0.5) * 2, -1, 1) }
    }
    const tick = async () => {
      if (busy || v.readyState < 2 || !v.videoWidth) return
      busy = true
      try {
        let found = false
        if (detector) {
          const faces = await detector.detect(v)
          if (faces && faces[0]) {
            const b = faces[0].boundingBox
            pos = { x: (b.x + b.width / 2) / v.videoWidth, y: (b.y + b.height / 2) / v.videoHeight }
            found = true
          }
        } else {
          sg.drawImage(v, 0, 0, W, H)
          const d = sg.getImageData(0, 0, W, H).data
          const lum = new Float32Array(W * H)
          for (let i = 0; i < W * H; i++) lum[i] = d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11
          if (prev) {
            let sx = 0
            let sy = 0
            let sw = 0
            for (let y = 0; y < H; y++)
              for (let x = 0; x < W; x++) {
                const diff = Math.abs(lum[y * W + x] - prev[y * W + x])
                if (diff > 18) {
                  sx += x * diff
                  sy += y * diff
                  sw += diff
                }
              }
            if (sw > 400) {
              pos = { x: pos.x + ((sx / sw + 0.5) / W - pos.x) * 0.5, y: pos.y + ((sy / sw + 0.5) / H - pos.y) * 0.5 }
              found = true
            }
          }
          prev = lum
        }
        if (found) mark()
      } catch {
        /* a failed frame is fine; try the next */
      }
      busy = false
    }
    c.timer = setInterval(tick, 66)
  }

  // smoothing + layer transforms
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const reduce = reducedMotion()
    const depths = [0.1, 0.25, 0.5, 0.8, 1.4]
    const step = (now) => {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      const o = opts.current
      const alpha = reduce ? 1 : 1 - Math.pow(clamp(o.smoothing, 0, 0.99), dt * 60)
      cur.current.x += (target.current.x - cur.current.x) * alpha
      cur.current.y += (target.current.y - cur.current.y) * alpha
      const r = stage.current && stage.current.getBoundingClientRect()
      if (r) {
        const k = o.strength * (reduce ? 0.4 : 1) * r.width * 0.045 * (o.mirror ? -1 : 1)
        layers.current.forEach((el, i) => {
          if (!el) return
          const d = depths[i]
          el.style.transform = `translate(${(-cur.current.x * d * k).toFixed(2)}px, ${(-cur.current.y * d * k * 0.6).toFixed(2)}px) scale(${(1 + d * 0.02 * o.strength).toFixed(3)})`
        })
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])

  const onMove = (e) => {
    if (camRef.current.stream) return
    if (e.pointerType === 'pen' && !e.buttons) return
    const r = stage.current.getBoundingClientRect()
    target.current = {
      x: clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1),
      y: clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1),
    }
  }
  const onLeave = () => {
    if (!camRef.current.stream) target.current = { x: 0, y: 0 }
  }

  const L = (i) => (el) => (layers.current[i] = el)
  const fill = { position: 'absolute', left: '-8%', top: '-8%', width: '116%', height: '116%', willChange: 'transform' }
  const mono = '500 11px/1.4 ui-monospace, Menlo, monospace'
  const camOn = cam === 'on'

  return (
    <div
      style={{ position: 'relative', width: '100%', height: 460, background: nearColor, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16, boxSizing: 'border-box', overflow: 'hidden', ...style }}
    >
      <div
        ref={stage}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        style={{ position: 'relative', flex: '1 1 auto', width: '100%', maxWidth: 780, minHeight: 0, overflow: 'hidden', borderRadius: 14, background: skyColor, touchAction: 'none', boxShadow: 'inset 0 0 0 6px rgba(0,0,0,.35), 0 10px 30px rgba(0,0,0,.35)' }}
      >
        {/* 0: sky + sun */}
        <svg ref={L(0)} viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" style={fill} aria-hidden="true">
          <rect width="400" height="240" fill={skyColor} />
          <circle cx="280" cy="90" r="46" fill={accent} opacity="0.35" />
          <circle cx="280" cy="90" r="28" fill={accent} />
        </svg>
        {/* 1: far ridge */}
        <svg ref={L(1)} viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" style={fill} aria-hidden="true">
          <path d="M0 150 L50 110 L95 140 L150 95 L210 140 L270 105 L330 138 L400 100 L400 240 L0 240Z" fill={farColor} />
        </svg>
        {/* 2: middle ridge */}
        <svg ref={L(2)} viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" style={fill} aria-hidden="true">
          <path d="M0 175 Q60 130 120 165 T240 160 T400 150 L400 240 L0 240Z" fill={nearColor} opacity="0.6" />
        </svg>
        {/* 3: near hills with trees */}
        <svg ref={L(3)} viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" style={fill} aria-hidden="true">
          <path d="M0 200 Q100 165 200 195 T400 185 L400 240 L0 240Z" fill={nearColor} opacity="0.85" />
          {[60, 110, 300, 350].map((x, i) => (
            <path key={x} d={`M${x} ${190 + (i % 2) * 4} l-12 0 l12 -34 l12 34z`} fill={nearColor} />
          ))}
        </svg>
        {/* 4: foreground sill with a plant */}
        <svg ref={L(4)} viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" style={fill} aria-hidden="true">
          <rect x="0" y="218" width="400" height="30" fill={nearColor} />
          <rect x="30" y="196" width="34" height="26" rx="3" fill={accent} />
          <path d="M47 196 q-18 -26 -26 -30 M47 196 q4 -34 2 -40 M47 196 q18 -22 28 -26" stroke="#3b6b45" strokeWidth="4" fill="none" strokeLinecap="round" />
        </svg>
        {/* window frame: fixed, does not shift */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', boxShadow: `inset 0 0 0 10px ${nearColor}`, borderRadius: 14 }} />
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 6, marginLeft: -3, background: nearColor, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 10, left: 14, font: mono, letterSpacing: '.08em', color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.6)', pointerEvents: 'none' }}>
          {mode === 'camera' ? 'HEAD TRACKING' : 'POINTER'}
        </div>
        {/* mirrored camera preview with the tracked point */}
        <div style={{ position: 'absolute', right: 14, bottom: 14, width: 110, height: 82, borderRadius: 8, overflow: 'hidden', background: '#000', boxShadow: '0 2px 10px rgba(0,0,0,.5)', display: camOn ? 'block' : 'none', pointerEvents: 'none' }}>
          <video ref={video} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
          <span ref={dot} style={{ position: 'absolute', left: '50%', top: '50%', width: 12, height: 12, marginLeft: -6, marginTop: -6, borderRadius: '50%', border: `2px solid ${accent}`, background: 'rgba(255,255,255,.4)' }} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: '#f4f1ea', textAlign: 'center' }}>
        {camOn ? (
          <button type="button" onClick={stopCamera} style={{ padding: '9px 16px', borderRadius: 999, border: 'none', cursor: 'pointer', background: '#f4f1ea', color: '#1c1a16', font: '700 12px/1 system-ui, sans-serif' }}>
            Stop camera
          </button>
        ) : (
          <button type="button" onClick={startCamera} disabled={cam === 'starting'} style={{ padding: '9px 16px', borderRadius: 999, border: 'none', cursor: 'pointer', background: accent, color: '#fff', font: '700 12px/1 system-ui, sans-serif', opacity: cam === 'starting' ? 0.6 : 1 }}>
            {cam === 'starting' ? 'Starting camera...' : 'Use camera'}
          </button>
        )}
        <div style={{ font: mono, fontSize: 10, opacity: 0.7 }}>
          Video stays on your device: nothing is recorded, stored or sent, and it stops when you press Stop or leave.
        </div>
        {msg && (
          <div role="status" style={{ font: mono, fontSize: 11, color: '#ffd9a8' }}>
            {msg}
          </div>
        )}
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'

const W = 520
const H = 330
// where things sit inside the page, so the cursor can aim at them
const INPUT = { x: 60, y: 118, w: 330, h: 40 }
const BUTTON = { x: 400, y: 118, w: 60, h: 40 }
const RESULTS = [
  { title: 'Low Poly Robot: free 3D model', host: 'models.example.com' },
  { title: 'How to build a low poly robot', host: 'blog.example.com' },
  { title: 'Robot rig pack for React Three Fiber', host: 'docs.example.com' },
]

// A mock browser where an agent drives the page by itself: the cursor glides to the
// search box, clicks, types a query, presses the button, then opens the first result.
// The script is a plain sequence of waits and moves, and it loops.
export default function BrowserAgent({
  query = 'low poly robot',
  speed = 1,
  loop = true,
  width = W,
  background = '#141414',
  pageColor = '#f6f4ef',
  textColor = '#1d1d1d',
  accent = '#d77757',
}) {
  const [cur, setCur] = useState({ x: 420, y: 260, click: 0 })
  const [typed, setTyped] = useState('')
  const [phase, setPhase] = useState('search') // search | results | open
  const [url, setUrl] = useState('search.example.com')
  const [run, setRun] = useState(0)
  const page = useRef(null)
  const [scale, setScale] = useState(1)

  // the page is drawn at a fixed design size and scaled to fit the box
  useEffect(() => {
    const el = page.current
    if (!el) return
    const fit = () => setScale(el.clientWidth / W)
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    let dead = false
    const wait = (ms) => new Promise((r) => setTimeout(r, ms / speed))
    const go = async () => {
      setTyped('')
      setPhase('search')
      setUrl('search.example.com')
      setCur({ x: 430, y: 280, click: 0 })
      await wait(700)
      if (dead) return
      setCur((c) => ({ ...c, x: INPUT.x + 90, y: INPUT.y + INPUT.h / 2 }))
      await wait(1000)
      if (dead) return
      setCur((c) => ({ ...c, click: c.click + 1 }))
      await wait(350)
      for (let i = 1; i <= query.length && !dead; i++) {
        setTyped(query.slice(0, i))
        await wait(95)
      }
      await wait(350)
      if (dead) return
      setCur((c) => ({ ...c, x: BUTTON.x + 30, y: BUTTON.y + 20 }))
      await wait(750)
      if (dead) return
      setCur((c) => ({ ...c, click: c.click + 1 }))
      await wait(300)
      setPhase('results')
      setUrl('search.example.com/?q=' + encodeURIComponent(query))
      await wait(900)
      if (dead) return
      setCur((c) => ({ ...c, x: 150, y: 160 }))
      await wait(900)
      if (dead) return
      setCur((c) => ({ ...c, click: c.click + 1 }))
      await wait(300)
      setPhase('open')
      setUrl(RESULTS[0].host + '/low-poly-robot')
      await wait(2600)
      if (dead) return
      if (loop) setRun((n) => n + 1)
    }
    go()
    return () => {
      dead = true
    }
  }, [run, speed, query, loop])

  return (
    <div style={{ width: `min(${width}px, 100%)`, boxSizing: 'border-box', borderRadius: 10, background, overflow: 'hidden', font: '400 13px/1.3 ui-monospace, "SF Mono", Menlo, Consolas, monospace', boxShadow: '0 10px 30px #0004' }}>
      <style>{`
        @keyframes ba-ripple{from{transform:translate(-50%,-50%) scale(.2);opacity:.7}to{transform:translate(-50%,-50%) scale(1.6);opacity:0}}
        @keyframes ba-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @keyframes ba-caret{50%{opacity:0}}
        @media (prefers-reduced-motion:reduce){.ba *{animation:none!important;transition:none!important}}
      `}</style>
      {/* toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px' }}>
        {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
          <i key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, display: 'block' }} />
        ))}
        <div style={{ flex: 1, marginLeft: 8, padding: '5px 12px', borderRadius: 6, background: '#262626', color: '#b9b6ae', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{url}</div>
      </div>
      {/* page: fixed design size, scaled to fit */}
      <div className="ba" ref={page} style={{ position: 'relative', width: '100%', aspectRatio: `${W} / ${H}`, background: pageColor, color: textColor, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, transformOrigin: '0 0', transform: `scale(${scale})` }}>
          {phase !== 'open' ? (
            <>
              <div style={{ position: 'absolute', left: 0, right: 0, top: 50, textAlign: 'center', font: '700 26px/1 system-ui, sans-serif' }}>
                Find<span style={{ color: accent }}>It</span>
              </div>
              <div style={{ position: 'absolute', left: INPUT.x, top: INPUT.y, width: INPUT.w, height: INPUT.h, boxSizing: 'border-box', padding: '0 12px', display: 'flex', alignItems: 'center', border: `2px solid ${typed ? accent : '#d6d2c8'}`, borderRadius: 8, background: '#fff', transition: 'border-color .2s', fontSize: 15 }}>
                {typed}
                <span style={{ width: 1.5, height: 18, background: textColor, marginLeft: 1, animation: 'ba-caret 1s step-end infinite' }} />
              </div>
              <div style={{ position: 'absolute', left: BUTTON.x, top: BUTTON.y, width: BUTTON.w, height: BUTTON.h, display: 'grid', placeItems: 'center', borderRadius: 8, background: accent, color: '#fff', fontWeight: 600 }}>Go</div>
              {phase === 'results' &&
                RESULTS.map((r, i) => (
                  <div key={r.title} style={{ position: 'absolute', left: 60, top: 180 + i * 48, right: 60, animation: `ba-in .3s ${i * 0.12}s both` }}>
                    <div style={{ color: '#2b5fb4', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                    <div style={{ color: '#6b685f', fontSize: 12 }}>{r.host}</div>
                  </div>
                ))}
            </>
          ) : (
            <div style={{ position: 'absolute', inset: 0, padding: '40px 60px', animation: 'ba-in .3s both' }}>
              <div style={{ font: '700 24px/1.2 system-ui, sans-serif' }}>Low Poly Robot</div>
              <div style={{ color: '#6b685f', margin: '8px 0 18px' }}>models.example.com</div>
              {[100, 92, 64].map((w) => (
                <div key={w} style={{ height: 10, width: `${w}%`, borderRadius: 5, background: '#dcd8cd', marginBottom: 12 }} />
              ))}
              <div style={{ display: 'inline-block', marginTop: 8, padding: '9px 18px', borderRadius: 8, background: accent, color: '#fff', fontWeight: 600 }}>Download</div>
            </div>
          )}
          {/* the agent's cursor */}
          <div style={{ position: 'absolute', left: 0, top: 0, transform: `translate(${cur.x}px, ${cur.y}px)`, transition: `transform ${0.9 / speed}s cubic-bezier(.4,0,.2,1)`, pointerEvents: 'none' }}>
            <span key={cur.click} aria-hidden style={{ position: 'absolute', left: 0, top: 0, width: 36, height: 36, borderRadius: '50%', border: `2px solid ${accent}`, animation: cur.click ? 'ba-ripple .5s ease-out' : 'none', opacity: 0 }} />
            <svg width="22" height="22" viewBox="0 0 22 22" style={{ display: 'block', filter: 'drop-shadow(0 1px 2px #0006)' }}>
              <path d="M3 2l14 7-6 2-2 6z" fill="#1d1d1d" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}

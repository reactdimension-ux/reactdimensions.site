import { useEffect, useRef, useState } from 'react'

// kinds: cmd (a typed command), out (plain output), dim, ok, err, warn
const SCRIPT = [
  { kind: 'cmd', text: 'npm test -- Timer' },
  { kind: 'dim', text: '> vitest run Timer' },
  { kind: 'err', text: '✗ Timer › stops after unmount (1204 ms)' },
  { kind: 'out', text: '  expected 1 interval, found 14' },
  { kind: 'cmd', text: 'git diff --stat' },
  { kind: 'out', text: ' src/Timer.jsx | 6 ++++--' },
  { kind: 'cmd', text: 'npm test -- Timer' },
  { kind: 'dim', text: '> vitest run Timer' },
  { kind: 'ok', text: '✓ Timer › starts one interval (3 ms)' },
  { kind: 'ok', text: '✓ Timer › stops after unmount (2 ms)' },
  { kind: 'warn', text: '! 1 snapshot obsolete' },
  { kind: 'ok', text: 'Tests 2 passed (2)' },
]

// A terminal the agent is working in. Commands type themselves out, output lines
// follow, and it keeps scrolled to the newest line unless you scroll up to read.
export default function TerminalLog({
  script = SCRIPT,
  title = 'agent — zsh',
  speed = 1,
  loop = true,
  height = 280,
  width = 540,
  size = 13,
  background = '#0e0e0e',
  textColor = '#d9d6cf',
  prompt = '#d77757',
}) {
  const [lines, setLines] = useState(0) // lines fully shown
  const [typed, setTyped] = useState(0) // characters typed of the current command
  const box = useRef(null)
  const stick = useRef(true) // follow the newest line

  useEffect(() => {
    setLines(0)
    setTyped(0)
  }, [script])

  useEffect(() => {
    let t
    if (lines >= script.length) {
      if (loop)
        t = setTimeout(() => {
          setLines(0)
          setTyped(0)
          stick.current = true
        }, 3000 / speed)
    } else {
      const l = script[lines]
      if (l.kind === 'cmd' && typed < l.text.length) t = setTimeout(() => setTyped((n) => n + 1), (28 + Math.random() * 40) / speed)
      else
        t = setTimeout(() => {
          setLines((n) => n + 1)
          setTyped(0)
        }, (l.kind === 'cmd' ? 420 : l.kind === 'dim' ? 700 : 260) / speed)
    }
    return () => clearTimeout(t)
  }, [lines, typed, script, loop, speed])

  useEffect(() => {
    const el = box.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [lines, typed])

  const colour = { ok: '#4eba65', err: '#e5534b', warn: '#d9a43a', dim: '#7c7a75', out: textColor, cmd: textColor }
  const row = (l, i, text, live) => (
    <div key={i} style={{ color: colour[l.kind], whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {l.kind === 'cmd' && <span style={{ color: prompt }}>❯ </span>}
      {text}
      {live && <span aria-hidden style={{ display: 'inline-block', width: '0.6em', height: '1.1em', marginLeft: 1, verticalAlign: '-0.2em', background: textColor, animation: 'tl-blink 1s step-end infinite' }} />}
    </div>
  )
  const cur = script[lines]

  return (
    <div style={{ width: `min(${width}px, 100%)`, borderRadius: 12, overflow: 'hidden', background, border: '1px solid #ffffff14', boxShadow: '0 24px 50px -24px rgba(0,0,0,.8)', font: `400 ${size}px/1.6 ui-monospace, "SF Mono", Menlo, Consolas, monospace` }}>
      <style>{`
        @keyframes tl-blink{0%,50%{opacity:1}51%,100%{opacity:0}}
        @media (prefers-reduced-motion:reduce){.tl *{animation:none!important}}
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 12px', background: '#ffffff0a', borderBottom: '1px solid #ffffff10' }}>
        {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
          <span key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.85 }} />
        ))}
        <span style={{ flex: 1, textAlign: 'center', color: '#8a8780', fontSize: '0.88em', marginRight: 44 }}>{title}</span>
      </div>
      <div
        ref={box}
        className="tl"
        role="log"
        aria-live="polite"
        onScroll={(e) => {
          const el = e.currentTarget
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 8
        }}
        style={{ height, overflowY: 'auto', padding: '10px 14px', boxSizing: 'border-box', scrollbarWidth: 'thin' }}
      >
        {script.slice(0, lines).map((l, i) => row(l, i, l.text, false))}
        {cur && cur.kind === 'cmd' && row(cur, lines, cur.text.slice(0, typed), true)}
        {!cur && row({ kind: 'cmd' }, 'idle', '', true)}
      </div>
    </div>
  )
}

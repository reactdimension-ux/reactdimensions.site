import { useEffect, useRef, useState } from 'react'

const REPLIES = [
  'The timer is started on every render and never cleared, so they pile up. Move it into an effect and clear it on cleanup.',
  'Each render calls setInterval again, and nothing stops the old ones. Put it in useEffect and return clearInterval.',
  'You have a leak: a new interval per render. Start it once inside an effect, and clear it when the component unmounts.',
]

const THUMB = 'M7 11v9H4v-9zM7 11l4-7c1.4 0 2.3 1.1 2 2.5L12.5 10H18a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 16.8 20H7'

// The small row of actions under an agent reply: copy, try again, thumbs up and
// down. "Try again" flips through alternative replies with a 1 / 3 pager.
export default function MessageActions({
  replies = REPLIES,
  show = 'always', // 'always' | 'hover'
  size = 15,
  width = 480,
  background = '#141414',
  textColor = '#e8e6e1',
  mutedColor = '#8f8c86',
  accent = '#d77757',
  onAction,
}) {
  const [i, setI] = useState(0)
  const [vote, setVote] = useState(null) // 'up' | 'down' | null
  const [copied, setCopied] = useState(false)
  const [spin, setSpin] = useState(false)
  const [tip, setTip] = useState(null)
  const timers = useRef([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(replies[i])
    } catch {}
    setCopied(true)
    later(() => setCopied(false), 1500)
    onAction?.('copy')
  }
  const again = () => {
    setSpin(true)
    later(() => {
      setI((n) => (n + 1) % replies.length)
      setSpin(false)
    }, 450)
    onAction?.('retry')
  }
  const cast = (v) => {
    setVote((x) => (x === v ? null : v))
    onAction?.(v)
  }

  const icon = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }
  // a plain function, not a component, so the buttons are not remounted on every render
  const btn = (label, on, onClick, children) => (
    <span key={label} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={on}
        onClick={onClick}
        onPointerEnter={() => setTip(label)}
        onPointerLeave={() => setTip(null)}
        onFocus={() => setTip(label)}
        onBlur={() => setTip(null)}
        className="ma-btn"
        style={{ all: 'unset', display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 8, cursor: 'pointer', color: on ? accent : mutedColor, transition: 'background .15s, color .15s' }}
      >
        {children}
      </button>
      {tip === label && (
        <span role="tooltip" style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)', padding: '3px 8px', borderRadius: 6, background: '#000', color: '#fff', fontSize: 11, whiteSpace: 'nowrap', pointerEvents: 'none', animation: 'ma-in .15s ease-out' }}>
          {label === 'Copy' && copied ? 'Copied' : label}
        </span>
      )}
    </span>
  )

  return (
    <div className={`ma ma-${show}`} style={{ width: `min(${width}px, 100%)`, boxSizing: 'border-box', padding: '1.1em 1.2em 0.7em', borderRadius: 12, background, color: textColor, font: `400 ${size}px/1.55 "Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", sans-serif` }}>
      <style>{`
        @keyframes ma-in{from{opacity:0;transform:translate(-50%,3px)}to{opacity:1;transform:translate(-50%,0)}}
        @keyframes ma-spin{to{transform:rotate(-360deg)}}
        @keyframes ma-fade{from{opacity:0;filter:blur(2px)}to{opacity:1;filter:none}}
        .ma .ma-btn:hover,.ma .ma-btn:focus-visible{background:${mutedColor}26}
        .ma-hover .ma-bar{opacity:0;transition:opacity .2s}
        .ma-hover:hover .ma-bar,.ma-hover:focus-within .ma-bar{opacity:1}
        @media (prefers-reduced-motion:reduce){.ma *{animation:none!important;transition:none!important}}
      `}</style>
      {/* every reply is stacked in one cell, so switching never changes the height */}
      <div style={{ display: 'grid' }}>
        {replies.map((r, n) => (
          <p key={n} aria-hidden={n !== i} style={{ gridArea: '1 / 1', margin: 0, visibility: n === i ? 'visible' : 'hidden', opacity: spin ? 0.3 : 1, transition: 'opacity .25s', animation: n === i ? 'ma-fade .35s ease-out' : 'none' }}>
            {r}
          </p>
        ))}
      </div>
      <div className="ma-bar" style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: '0.6em', marginLeft: -6 }}>
        {btn(
          'Copy',
          copied,
          copy,
          copied ? (
            <svg {...icon}><path d="M5 12.5 10 17l9-10" /></svg>
          ) : (
            <svg {...icon}><rect x="8" y="8" width="12" height="12" rx="2.5" /><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8" /></svg>
          ),
        )}
        {btn('Try again', false, again, <svg {...icon} style={{ animation: spin ? 'ma-spin .45s ease-in-out' : 'none' }}><path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5" /></svg>)}
        {btn('Good reply', vote === 'up', () => cast('up'), <svg {...icon} fill={vote === 'up' ? 'currentColor' : 'none'}><path d={THUMB} /></svg>)}
        {btn('Bad reply', vote === 'down', () => cast('down'), <svg {...icon} fill={vote === 'down' ? 'currentColor' : 'none'} style={{ transform: 'scaleY(-1)' }}><path d={THUMB} /></svg>)}
        {replies.length > 1 && (
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 2, color: mutedColor, fontSize: '0.82em', fontVariantNumeric: 'tabular-nums' }}>
            <button type="button" aria-label="Previous reply" className="ma-btn" onClick={() => setI((n) => (n - 1 + replies.length) % replies.length)} style={{ all: 'unset', cursor: 'pointer', padding: '2px 6px', borderRadius: 6 }}>‹</button>
            {i + 1} / {replies.length}
            <button type="button" aria-label="Next reply" className="ma-btn" onClick={() => setI((n) => (n + 1) % replies.length)} style={{ all: 'unset', cursor: 'pointer', padding: '2px 6px', borderRadius: 6 }}>›</button>
          </span>
        )}
      </div>
    </div>
  )
}

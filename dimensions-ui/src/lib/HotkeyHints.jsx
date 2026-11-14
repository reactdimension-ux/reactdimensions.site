import { useState, useRef, useEffect, useId } from 'react'

// Hotkey hints: a tiny canvas app whose six actions really work from the
// keyboard (B C G R D, Cmd/Ctrl+Z). Hovering or keyboard-focusing a button
// pops its hotkey as a chip; pressing ? opens a grouped overlay listing every
// shortcut. The overlay is a modal dialog: Tab is trapped inside, Esc closes
// it and focus goes back to where it was. Keys act only while the component
// has focus, and only the keys it uses are prevented.

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || '')
const MOD = IS_MAC ? '⌘' : 'Ctrl'
const COLORS = ['#ff4d1a', '#2f6bff', '#1fa971', '#b44cff', '#f5b301']

const ACTIONS = [
  { id: 'bold', label: 'Bold', key: 'B', group: 'Style' },
  { id: 'color', label: 'Colour', key: 'C', group: 'Style' },
  { id: 'grid', label: 'Grid', key: 'G', group: 'View' },
  { id: 'rotate', label: 'Rotate', key: 'R', group: 'Transform' },
  { id: 'dup', label: 'Duplicate', key: 'D', group: 'Transform' },
  { id: 'undo', label: 'Undo', key: 'Z', mod: true, group: 'Edit' },
]
const OTHER = [
  { label: 'Show this list', keys: ['?'], group: 'Help' },
  { label: 'Close the list', keys: ['Esc'], group: 'Help' },
]
const START = { bold: false, ci: 0, grid: true, rot: 0, copies: 0 }

const chipKeys = (a) => (a.mod ? [MOD, a.key] : [a.key])

function Chip({ keys }) {
  return (
    <span style={{ display: 'inline-flex', gap: 3 }}>
      {keys.map((k) => (
        <kbd key={k} style={{ font: '600 11px/1 ui-monospace, monospace', padding: '3px 6px', borderRadius: 5, background: '#f4f1ea', color: '#1c1a16', boxShadow: '0 1px 0 rgba(0,0,0,.4)' }}>{k}</kbd>
      ))}
    </span>
  )
}

export default function HotkeyHints({ accent = '#ff4d1a', alwaysChips = false, overlayStyle = 'modal', style }) {
  const uid = useId().replace(/:/g, '')
  const [cur, setCur] = useState(START)
  const [hist, setHist] = useState([])
  const [help, setHelp] = useState(false)
  const [focused, setFocused] = useState(false)
  const [flash, setFlash] = useState('')
  const rootRef = useRef(null)
  const dlgRef = useRef(null)
  const returnTo = useRef(null)
  const flashT = useRef(0)

  useEffect(() => () => clearTimeout(flashT.current), [])

  const run = (id) => {
    if (id === 'undo') {
      if (!hist.length) return
      setCur(hist[hist.length - 1])
      setHist(hist.slice(0, -1))
    } else {
      const n = { ...cur }
      if (id === 'bold') n.bold = !cur.bold
      if (id === 'color') n.ci = (cur.ci + 1) % COLORS.length
      if (id === 'grid') n.grid = !cur.grid
      if (id === 'rotate') n.rot = cur.rot + 45
      if (id === 'dup') n.copies = Math.min(5, cur.copies + 1)
      setHist([...hist.slice(-19), cur])
      setCur(n)
    }
    setFlash(id)
    clearTimeout(flashT.current)
    flashT.current = setTimeout(() => setFlash(''), 350)
  }

  const openHelp = () => {
    returnTo.current = document.activeElement
    setHelp(true)
  }
  const closeHelp = () => {
    setHelp(false)
    const t = returnTo.current && document.contains(returnTo.current) ? returnTo.current : rootRef.current
    t?.focus?.()
  }
  useEffect(() => {
    if (help) dlgRef.current?.querySelector('button')?.focus()
  }, [help])

  const onKeyDown = (e) => {
    if (help) return
    if (e.key === '?') { e.preventDefault(); openHelp(); return }
    if (e.altKey) return
    const k = e.key.toLowerCase()
    const mod = IS_MAC ? e.metaKey : e.ctrlKey
    if (k === 'z' && mod) { e.preventDefault(); run('undo'); return }
    if (e.ctrlKey || e.metaKey) return
    const a = ACTIONS.find((x) => !x.mod && x.key.toLowerCase() === k)
    if (a) { e.preventDefault(); run(a.id) }
  }

  const onDlgKey = (e) => {
    e.stopPropagation()
    if (e.key === 'Escape') { e.preventDefault(); closeHelp() }
    else if (e.key === 'Tab') {
      const f = [...dlgRef.current.querySelectorAll('button')]
      if (!f.length) return
      const first = f[0]
      const last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
  }

  const color = COLORS[cur.ci]
  const shape = (i) => (
    <div
      key={i}
      style={{ position: 'absolute', left: '50%', top: '50%', width: 110, height: 110, marginLeft: -55 + i * 26, marginTop: -55 + i * 18, borderRadius: 22, background: i ? 'transparent' : color, border: `${cur.bold ? 10 : 3}px solid ${color}`, transform: `rotate(${cur.rot}deg)`, transition: 'transform 300ms cubic-bezier(.2,.8,.2,1), background 200ms, border-color 200ms, border-width 160ms', opacity: i ? 0.85 : 1 }}
    />
  )

  const groups = {}
  ;[...ACTIONS.map((a) => ({ label: a.label, keys: chipKeys(a), group: a.group })), ...OTHER].forEach((r) => (groups[r.group] ||= []).push(r))

  const ov =
    overlayStyle === 'side'
      ? { inset: '0 0 0 auto', width: 280, borderRadius: '16px 0 0 16px', alignSelf: 'stretch' }
      : overlayStyle === 'full'
        ? { inset: 0, borderRadius: 0 }
        : { left: '50%', top: '50%', width: 'min(360px, 88%)', maxHeight: '92%', transform: 'translate(-50%, -50%)', borderRadius: 16 }

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      role="application"
      aria-label="Canvas with hotkeys. Press question mark to list them."
      onKeyDown={onKeyDown}
      onFocus={() => setFocused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setFocused(false)}
      className={`hh-${uid}`}
      data-chips={alwaysChips ? '1' : '0'}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#f4f1ea', color: '#1c1a16', font: '400 14px/1.4 system-ui, sans-serif', outline: 'none', boxShadow: focused ? `inset 0 0 0 2px ${accent}` : 'none', ...style }}
    >
      <style>{`
        .hh-${uid} .hh-btn { all: unset; position: relative; cursor: pointer; padding: 8px 12px; border-radius: 9px; font-weight: 600; background: #fff; box-shadow: 0 0 0 1px rgba(0,0,0,.12); transition: background 120ms, transform 120ms; }
        .hh-${uid} .hh-btn:hover { background: #efebe1; }
        .hh-${uid} .hh-btn:focus-visible { outline: 3px solid ${accent}; outline-offset: 2px; }
        .hh-${uid} .hh-btn[data-flash='1'] { background: ${accent}; color: #fff; transform: scale(.95); }
        .hh-${uid} .hh-tip { position: absolute; left: 50%; top: calc(100% + 8px); transform: translateX(-50%); background: #1c1a16; padding: 5px 7px; border-radius: 8px; opacity: 0; pointer-events: none; transition: opacity 140ms; white-space: nowrap; z-index: 3; }
        .hh-${uid} .hh-btn:hover .hh-tip, .hh-${uid} .hh-btn:focus-visible .hh-tip, .hh-${uid}[data-chips='1'] .hh-tip { opacity: 1; }
        @media (prefers-reduced-motion: reduce) { .hh-${uid} * { transition: none !important; } }
      `}</style>

      <div role="toolbar" aria-label="Actions" style={{ position: 'absolute', top: 16, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', padding: '0 12px' }}>
        {ACTIONS.map((a) => (
          <button key={a.id} type="button" className="hh-btn" data-flash={flash === a.id ? '1' : '0'} aria-keyshortcuts={a.mod ? `${IS_MAC ? 'Meta' : 'Control'}+${a.key}` : a.key} onClick={() => run(a.id)}>
            {a.label}
            <span className="hh-tip" aria-hidden="true"><Chip keys={chipKeys(a)} /></span>
          </button>
        ))}
        <button type="button" className="hh-btn" onClick={openHelp} aria-haspopup="dialog" aria-keyshortcuts="?">
          ?
          <span className="hh-tip" aria-hidden="true"><Chip keys={['?']} /></span>
        </button>
      </div>

      <div style={{ position: 'absolute', inset: '84px 20px 40px', borderRadius: 14, background: '#fff', boxShadow: '0 0 0 1px rgba(0,0,0,.1)', overflow: 'hidden', backgroundImage: cur.grid ? 'linear-gradient(rgba(0,0,0,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,.07) 1px, transparent 1px)' : 'none', backgroundSize: '24px 24px' }}>
        {Array.from({ length: cur.copies + 1 }, (_, i) => shape(i))}
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 12, textAlign: 'center', fontSize: 12, color: '#6b665c' }}>
        {focused ? `Press ? for all hotkeys. ${hist.length} undo step${hist.length === 1 ? '' : 's'}.` : 'Click here, then press ?'}
      </div>

      {help && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,18,14,.45)', display: 'flex', justifyContent: 'flex-end', zIndex: 5 }} onMouseDown={(e) => e.target === e.currentTarget && closeHelp()}>
          <div ref={dlgRef} role="dialog" aria-modal="true" aria-label="Hotkeys" onKeyDown={onDlgKey} style={{ position: 'absolute', background: '#1c1a16', color: '#f4f1ea', padding: 18, boxShadow: '0 20px 50px rgba(0,0,0,.4)', overflow: 'auto', ...ov }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <strong style={{ fontSize: 16 }}>Hotkeys</strong>
              <button type="button" onClick={closeHelp} aria-label="Close hotkeys" style={{ all: 'unset', cursor: 'pointer', padding: '4px 10px', borderRadius: 7, background: accent, color: '#fff', fontWeight: 600 }}>Esc</button>
            </div>
            {Object.entries(groups).map(([g, rows]) => (
              <div key={g} style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', opacity: 0.55, marginBottom: 4 }}>{g}</div>
                {rows.map((r) => (
                  <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                    <span>{r.label}</span>
                    <Chip keys={r.keys} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

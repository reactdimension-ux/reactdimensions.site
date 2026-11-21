import { useState } from 'react'

// A scene's buttons, tucked behind one small "Controls" button in a corner so
// they never sit over the model. Click it to open the panel; click again (or
// pick something) to close it. corner: 'tl' | 'tr' | 'bl' | 'br'.
const glass = {
  background: 'rgba(255,255,255,0.92)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  boxShadow: '0 2px 10px rgba(0,0,0,.18), inset 0 0 0 1px rgba(0,0,0,.07)',
}

export default function ControlDock({ children, label = 'Controls', corner = 'tl', closeOnPick = false }) {
  const [open, setOpen] = useState(false)
  const bottom = corner[0] === 'b'
  const right = corner[1] === 'r'
  const side = right ? { right: 12 } : { left: 12 }
  return (
    <div
      style={{
        position: 'absolute',
        ...side,
        [bottom ? 'bottom' : 'top']: 12,
        zIndex: 6,
        display: 'flex',
        flexDirection: bottom ? 'column-reverse' : 'column',
        alignItems: right ? 'flex-end' : 'flex-start',
        gap: 6,
        // leave room for the "i" button in the bottom-right corner
        maxWidth: bottom && !right ? 'calc(100% - 64px)' : 'calc(100% - 24px)',
        maxHeight: 'calc(100% - 24px)',
        pointerEvents: 'none',
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{ ...glass, pointerEvents: 'auto', border: 'none', cursor: 'pointer', height: 32, padding: '0 12px', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 8, font: '600 10.5px/1 ui-monospace, Menlo, monospace', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#2a2925' }}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
          <path d="M2 4h7M13 4h1M2 12h1M7 12h7" />
          <circle cx="11" cy="4" r="1.8" />
          <circle cx="5" cy="12" r="1.8" />
        </svg>
        {label}
        <span aria-hidden="true" style={{ display: 'inline-block', transition: 'transform .2s', transform: open !== bottom ? 'rotate(180deg)' : 'none' }}>▾</span>
      </button>
      {open && (
        <div
          onClick={closeOnPick ? () => setOpen(false) : undefined}
          style={{ ...glass, pointerEvents: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 14, maxWidth: '100%', overflow: 'auto', minHeight: 0 }}
        >
          {children}
        </div>
      )}
    </div>
  )
}

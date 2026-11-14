import { useEffect, useRef, useState } from 'react'

// Autosave to the URL. A tiny customiser (shape, colour, size, text) whose
// state is written into ONE query parameter (param, default "rd") a moment
// after each change, using history.replaceState so no history entries are
// added, and restored from that parameter on load. Everything else in the URL
// (path, other params, hash, the router's history.state) is left alone, and the
// parameter is removed again on unmount so nothing is left behind when you
// navigate away. Back/forward (popstate) and hashchange re-read the parameter.
// A read-only field shows the live link, with Copy link and Reset. Encoding is
// either readable (shape.star_size.80) or compact (base64url JSON).

const SHAPES = ['circle', 'square', 'triangle', 'star']
const SWATCHES = ['#ff4d1a', '#2a9d8f', '#e9c46a', '#7b2cbf', '#1d3557']
const DEFAULTS = { shape: 'circle', color: SWATCHES[0], size: 70, text: 'Hello' }

const esc = (t) =>
  encodeURIComponent(t).replace(/[-_.!~*'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()).replace(/%/g, '*')
const unesc = (t) => { try { return decodeURIComponent(t.replace(/\*/g, '%')) } catch { return t } }
const b64 = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64 = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))))

function encode(st, mode) {
  if (mode === 'compact') {
    return b64(JSON.stringify([SHAPES.indexOf(st.shape), SWATCHES.indexOf(st.color) >= 0 ? SWATCHES.indexOf(st.color) : st.color, st.size, st.text]))
  }
  return `shape.${st.shape}_color.${st.color.replace('#', '')}_size.${st.size}_text.${esc(st.text)}`
}
function decode(raw) {
  if (!raw) return null
  const out = { ...DEFAULTS }
  try {
    if (raw.startsWith('shape.')) {
      raw.split('_').forEach((p) => {
        const i = p.indexOf('.')
        const k = p.slice(0, i)
        const v = p.slice(i + 1)
        if (k === 'shape' && SHAPES.includes(v)) out.shape = v
        else if (k === 'color' && /^[0-9a-f]{6}$/i.test(v)) out.color = '#' + v
        else if (k === 'size' && +v >= 20 && +v <= 100) out.size = Math.round(+v)
        else if (k === 'text') out.text = unesc(v).slice(0, 24)
      })
    } else {
      const [sh, co, sz, tx] = JSON.parse(unb64(raw))
      if (SHAPES[sh]) out.shape = SHAPES[sh]
      if (typeof co === 'number' && SWATCHES[co]) out.color = SWATCHES[co]
      else if (typeof co === 'string' && /^#[0-9a-f]{6}$/i.test(co)) out.color = co
      if (sz >= 20 && sz <= 100) out.size = Math.round(sz)
      if (typeof tx === 'string') out.text = tx.slice(0, 24)
    }
  } catch { return null }
  return out
}

const readParam = (param) => {
  if (typeof window === 'undefined') return null
  return decode(new URLSearchParams(window.location.search).get(param))
}
const urlWith = (param, value) => {
  const u = new URL(window.location.href)
  if (value == null) u.searchParams.delete(param)
  else u.searchParams.set(param, value)
  return u
}
const writeParam = (param, value) => {
  const u = urlWith(param, value)
  if (u.href !== window.location.href) window.history.replaceState(window.history.state, '', u.pathname + u.search + u.hash)
}

function Shape({ v }) {
  const s = v.size / 100
  return (
    <svg viewBox="0 0 100 100" width="140" height="140" aria-hidden="true" style={{ overflow: 'visible' }}>
      <g transform={`translate(50 50) scale(${s}) translate(-50 -50)`} fill={v.color}>
        {v.shape === 'circle' && <circle cx="50" cy="50" r="44" />}
        {v.shape === 'square' && <rect x="8" y="8" width="84" height="84" rx="10" />}
        {v.shape === 'triangle' && <polygon points="50,8 94,90 6,90" />}
        {v.shape === 'star' && <polygon points="50,4 62,38 97,38 69,59 80,93 50,72 20,93 31,59 3,38 38,38" />}
      </g>
      <text x="50" y="56" textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff" style={{ font: '700 14px ui-monospace, monospace' }}>{v.text}</text>
    </svg>
  )
}

export default function UrlState({
  param = 'rd',
  debounce = 300,
  accent = '#ff4d1a',
  encoding = 'readable',
  textColor = '#1c1a16',
  style,
}) {
  const [st, setSt] = useState(() => readParam(param) || DEFAULTS)
  const [copied, setCopied] = useState(false)
  const [tick, setTick] = useState(0) // bumps when the real URL changes under us
  const copyTimer = useRef(0)
  const field = useRef(null)

  const isDefault = st.shape === DEFAULTS.shape && st.color === DEFAULTS.color && st.size === DEFAULTS.size && st.text === DEFAULTS.text
  const value = isDefault ? null : encode(st, encoding)
  const shown = typeof window === 'undefined' ? '' : urlWith(param, value).href

  // debounced autosave; replaceState only, never pushState
  useEffect(() => {
    const t = setTimeout(() => { writeParam(param, value); setTick((n) => n + 1) }, Math.max(0, debounce))
    return () => clearTimeout(t)
  }, [param, value, debounce])

  // leave nothing behind
  useEffect(() => () => writeParam(param, null), [param])

  // back/forward or a hash edit: follow the param if it changed
  useEffect(() => {
    const sync = () => {
      const next = readParam(param) || DEFAULTS
      setSt((cur) => (JSON.stringify(cur) === JSON.stringify(next) ? cur : next))
      setTick((n) => n + 1)
    }
    window.addEventListener('popstate', sync)
    window.addEventListener('hashchange', sync)
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('hashchange', sync) }
  }, [param])

  useEffect(() => () => clearTimeout(copyTimer.current), [])

  const set = (patch) => setSt((s) => ({ ...s, ...patch }))
  const copy = async () => {
    let ok = false
    try { await navigator.clipboard.writeText(shown); ok = true } catch { /* fall through */ }
    if (!ok) {
      const ta = document.createElement('textarea')
      ta.value = shown
      ta.setAttribute('readonly', '')
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0'
      document.body.appendChild(ta)
      ta.select()
      try { ok = document.execCommand('copy') } catch { ok = false }
      ta.remove()
    }
    if (!ok) field.current?.select()
    setCopied(ok)
    clearTimeout(copyTimer.current)
    copyTimer.current = setTimeout(() => setCopied(false), 1500)
  }

  return (
    <>
      <style>{`
        .us { box-sizing: border-box; display: flex; flex-direction: column; gap: 14px; padding: 16px; background: #f4f1ea; color: var(--us-ink); font: 500 12px/1.3 ui-monospace, Menlo, monospace; overflow: auto; min-width: 0; }
        .us-main { display: flex; flex: 1; gap: 16px; flex-wrap: wrap; min-height: 0; }
        .us-stage { flex: 1 1 180px; min-height: 160px; display: grid; place-items: center; border-radius: 14px; background: repeating-conic-gradient(#e9e4d8 0% 25%, #f1ede3 0% 50%) 0 0 / 20px 20px; }
        .us-ctl { flex: 1 1 220px; display: flex; flex-direction: column; gap: 10px; justify-content: center; }
        .us-row { display: grid; grid-template-columns: 50px 1fr; align-items: center; gap: 8px; }
        .us input[type=range] { width: 100%; margin: 0; accent-color: var(--us-accent); min-height: 24px; }
        .us input[type=text], .us select { font: inherit; padding: 6px 8px; border-radius: 8px; border: 1px solid #1c1a1633; background: #fff; color: inherit; min-width: 0; box-sizing: border-box; width: 100%; }
        .us input:focus-visible, .us select:focus-visible, .us button:focus-visible { outline: 2px solid var(--us-accent); outline-offset: 1px; }
        .us-sw { display: flex; gap: 8px; }
        .us-sw button { width: 24px; height: 24px; border-radius: 50%; border: 0; padding: 0; cursor: pointer; box-shadow: 0 0 0 1px #0003; }
        .us-sw button[aria-pressed='true'] { box-shadow: 0 0 0 2px #f4f1ea, 0 0 0 4px var(--us-accent); }
        .us-link { display: flex; gap: 8px; align-items: center; }
        .us-btn { font: inherit; flex: none; padding: 6px 12px; min-height: 32px; border-radius: 999px; border: 1px solid #1c1a1633; background: #fff; color: inherit; cursor: pointer; }
        .us-btn[data-primary='true'] { background: var(--us-accent); color: #fff; border-color: transparent; }
        .us-hint { opacity: .55; font-size: 11px; }
      `}</style>
      <div className="us" style={{ '--us-accent': accent, '--us-ink': textColor, ...style }}>
        <div className="us-main">
          <div className="us-stage"><Shape v={st} /></div>
          <div className="us-ctl">
            <label className="us-row"><span>Shape</span>
              <select value={st.shape} onChange={(e) => set({ shape: e.target.value })}>{SHAPES.map((s) => <option key={s}>{s}</option>)}</select>
            </label>
            <div className="us-row"><span>Colour</span>
              <div className="us-sw">{SWATCHES.map((c) => <button key={c} type="button" aria-label={c} aria-pressed={st.color === c} style={{ background: c }} onClick={() => set({ color: c })} />)}</div>
            </div>
            <label className="us-row"><span>Size</span>
              <input type="range" min="20" max="100" value={st.size} onChange={(e) => set({ size: +e.target.value })} />
            </label>
            <label className="us-row"><span>Text</span>
              <input type="text" maxLength={24} value={st.text} onChange={(e) => set({ text: e.target.value })} />
            </label>
          </div>
        </div>
        <div className="us-link">
          <input ref={field} type="text" readOnly aria-label="Shareable link" value={shown} onFocus={(e) => e.target.select()} />
          <button type="button" className="us-btn" data-primary="true" onClick={copy} aria-live="polite">{copied ? 'Copied' : 'Copy link'}</button>
          <button type="button" className="us-btn" onClick={() => setSt(DEFAULTS)}>Reset</button>
        </div>
        <div className="us-hint" data-tick={tick}>Saved to <b>?{param}=</b> after {debounce} ms; no history entries added.</div>
      </div>
    </>
  )
}

import { useEffect, useRef, useState } from 'react'

// Undo and redo with a visible history strip. A tiny shape customiser (shape,
// size, corner radius, rotation, colour) where every change is recorded as a
// chip in a strip under the preview. Ctrl/Cmd+Z undoes, Shift+Ctrl/Cmd+Z or
// Ctrl+Y redoes, or use the buttons; click any chip to jump straight there.
// The current chip is highlighted and chips after it are dimmed. Edit after
// undoing and the dimmed future shrinks away. A slider drag is one entry,
// committed on release or after a short pause. Keys only act while the
// component has focus, and only the keys it uses are intercepted. Under
// reduced motion the chip animations are near instant.

const SHAPES = {
  square: null,
  triangle: '50,8 92,88 8,88',
  hexagon: '50,6 89,28 89,72 50,94 11,72 11,28',
  star: '50,5 61,38 96,38 68,58 79,92 50,71 21,92 32,58 4,38 39,38',
}
const SWATCHES = ['#ff4d1a', '#2a9d8f', '#e9c46a', '#7b2cbf', '#1d3557', '#1c1a16']
const START = { shape: 'square', size: 60, radius: 12, rot: 0, color: SWATCHES[0] }
const LABELS = { shape: 'Shape', size: 'Size', radius: 'Radius', rot: 'Rotate', color: 'Colour' }
let uid = 1

const same = (a, b) => Object.keys(START).every((k) => a[k] === b[k])
const labelFor = (a, b) => {
  const k = Object.keys(START).find((key) => a[key] !== b[key])
  if (!k) return 'Edit'
  return k === 'color' || k === 'shape' ? `${LABELS[k]}: ${b[k]}` : `${LABELS[k]} ${b[k]}`
}

function Shape({ v, box = 100 }) {
  const common = { fill: v.color, stroke: v.color, strokeLinejoin: 'round' }
  const s = v.size / 100
  return (
    <svg width={box} height={box} viewBox="0 0 100 100" aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      <g transform={`translate(50 50) rotate(${v.rot}) scale(${s}) translate(-50 -50)`}>
        {v.shape === 'square' ? (
          <rect x="8" y="8" width="84" height="84" rx={v.radius * 1.6} {...common} strokeWidth="0" />
        ) : (
          <polygon points={SHAPES[v.shape]} {...common} strokeWidth={v.radius * 0.7} />
        )}
      </g>
    </svg>
  )
}

export default function UndoHistory({
  maxHistory = 12,
  accent = '#ff4d1a',
  showLabels = true,
  textColor = '#1c1a16',
  style,
}) {
  const max = Math.max(2, Math.round(maxHistory))
  const [S, setS] = useState(() => ({ items: [{ id: uid++, v: START, label: 'Start' }], idx: 0, live: START, cut: null }))
  const timer = useRef(0)
  const cutTimer = useRef(0)
  const strip = useRef(null)
  const curChip = useRef(null)
  const live = useRef(START)
  live.current = S.live

  // pure transitions
  const commitS = (s) => {
    const base = s.items[s.idx].v
    if (same(base, s.live)) return s
    const kept = s.items.slice(0, s.idx + 1)
    const removed = s.items.slice(s.idx + 1)
    let items = kept.concat({ id: uid++, v: s.live, label: labelFor(base, s.live) })
    let at = kept.length
    if (items.length > max) { const n = items.length - max; items = items.slice(n); at = Math.max(0, at - n) }
    return { items, idx: items.length - 1, live: s.live, cut: removed.length ? { at, items: removed } : null }
  }
  const jump = (s, i) => {
    const c = commitS(s)
    const t = clamp2(i, c.items.length)
    return { ...c, idx: t, live: c.items[t].v, cut: null }
  }
  const clamp2 = (i, n) => Math.max(0, Math.min(n - 1, i))

  const flush = () => { clearTimeout(timer.current); setS(commitS) }
  const edit = (patch, immediate) => {
    setS((s) => ({ ...s, live: { ...s.live, ...patch } }))
    clearTimeout(timer.current)
    if (immediate) timer.current = setTimeout(() => setS(commitS), 0)
    else timer.current = setTimeout(() => setS(commitS), 700)
  }
  const undo = () => { clearTimeout(timer.current); setS((s) => { const c = commitS(s); return jump(c, c.idx - 1) }) }
  const redo = () => { clearTimeout(timer.current); setS((s) => { const c = commitS(s); return jump(c, c.idx + 1) }) }
  const go = (i) => { clearTimeout(timer.current); setS((s) => jump(s, i)) }

  // let a cut animation play, then drop the ghosts
  useEffect(() => {
    if (!S.cut) return
    clearTimeout(cutTimer.current)
    cutTimer.current = setTimeout(() => setS((s) => (s.cut ? { ...s, cut: null } : s)), 320)
  }, [S.cut])
  useEffect(() => () => { clearTimeout(timer.current); clearTimeout(cutTimer.current) }, [])

  // keep the current chip in view without scrolling the page
  useEffect(() => {
    const st = strip.current
    const ch = curChip.current
    if (!st || !ch) return
    const l = ch.offsetLeft
    const r = l + ch.offsetWidth
    if (l < st.scrollLeft) st.scrollLeft = l - 8
    else if (r > st.scrollLeft + st.clientWidth) st.scrollLeft = r - st.clientWidth + 8
  }, [S.idx, S.items.length])

  const keyDown = (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return
    const k = e.key.toLowerCase()
    if (k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo() }
    else if (k === 'y' && !e.shiftKey) { e.preventDefault(); redo() }
  }

  const v = S.live
  const canUndo = S.idx > 0 || !same(S.items[S.idx].v, S.live)
  const canRedo = S.idx < S.items.length - 1

  const chip = (it, i, ghost) => (
    <button
      key={it.id}
      ref={!ghost && i === S.idx ? curChip : null}
      type="button"
      className="uh-chip"
      data-current={!ghost && i === S.idx}
      data-future={!ghost && i > S.idx}
      data-cut={!!ghost}
      tabIndex={ghost ? -1 : 0}
      aria-current={!ghost && i === S.idx ? 'step' : undefined}
      aria-label={`History step ${i + 1}: ${it.label}`}
      title={it.label}
      onClick={() => !ghost && go(i)}
    >
      <span className="uh-thumb"><Shape v={it.v} box={30} /></span>
      {showLabels && <span className="uh-lbl">{it.label}</span>}
    </button>
  )
  const at = S.cut ? S.cut.at : S.items.length

  return (
    <>
      <style>{`
        .uh { box-sizing: border-box; display: flex; flex-direction: column; gap: 12px; padding: 16px; background: #f4f1ea; color: var(--uh-ink); font: 500 12px/1.3 ui-monospace, Menlo, monospace; outline: none; min-width: 0; overflow: auto; -webkit-tap-highlight-color: transparent; }
        .uh:focus-visible { box-shadow: inset 0 0 0 3px var(--uh-accent); }
        .uh-main { display: flex; gap: 16px; flex: 1; min-height: 0; flex-wrap: wrap; }
        .uh-stage { flex: 1 1 180px; min-height: 150px; display: grid; place-items: center; border-radius: 14px; background: repeating-conic-gradient(#e9e4d8 0% 25%, #f1ede3 0% 50%) 0 0 / 20px 20px; }
        .uh-ctl { flex: 1 1 220px; display: flex; flex-direction: column; gap: 10px; justify-content: center; }
        .uh-row { display: grid; grid-template-columns: 62px 1fr 34px; align-items: center; gap: 8px; }
        .uh-row span:last-child { text-align: right; opacity: .6; }
        .uh input[type=range] { width: 100%; accent-color: var(--uh-accent); margin: 0; min-height: 24px; touch-action: pan-y; }
        .uh-sw { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .uh-sw button { width: 24px; height: 24px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; padding: 0; box-shadow: 0 0 0 1px #0003; }
        .uh-sw button[aria-pressed='true'] { box-shadow: 0 0 0 2px #f4f1ea, 0 0 0 4px var(--uh-accent); }
        .uh select { font: inherit; padding: 5px 8px; border-radius: 8px; border: 1px solid #1c1a1633; background: #fff; color: inherit; }
        .uh-bar { display: flex; align-items: center; gap: 8px; }
        .uh-btn { font: inherit; padding: 6px 12px; min-height: 32px; border-radius: 999px; border: 1px solid #1c1a1633; background: #fff; color: inherit; cursor: pointer; }
        .uh-btn:disabled { opacity: .35; cursor: default; }
        .uh-btn:not(:disabled):active { background: var(--uh-accent); color: #fff; }
        .uh-count { margin-left: auto; opacity: .55; }
        .uh-strip { display: flex; gap: 6px; overflow-x: auto; padding: 4px 2px 8px; scrollbar-width: thin; }
        .uh-chip { flex: none; display: flex; align-items: center; gap: 6px; padding: 4px 8px 4px 4px; border-radius: 10px; border: 1px solid #1c1a1626; background: #fff; color: inherit; font: inherit; cursor: pointer; transition: opacity 200ms, background 200ms, border-color 200ms; max-width: 160px; }
        .uh-chip[data-current='true'] { border-color: var(--uh-accent); background: color-mix(in srgb, var(--uh-accent) 14%, #fff); box-shadow: 0 0 0 1px var(--uh-accent); }
        .uh-chip[data-future='true'] { opacity: .4; }
        .uh-chip:focus-visible { outline: 2px solid var(--uh-accent); outline-offset: 1px; }
        .uh-chip[data-cut='true'] { animation: uh-cut 300ms ease-in forwards; pointer-events: none; overflow: hidden; }
        .uh-chip:not([data-cut='true']):last-child { animation: uh-in 240ms ease-out; }
        .uh-thumb { width: 30px; height: 30px; flex: none; display: grid; place-items: center; background: #f1ede3; border-radius: 7px; }
        .uh-lbl { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        @keyframes uh-cut { from { opacity: .4; transform: scale(1); } to { opacity: 0; transform: scale(.4); max-width: 0; padding: 4px 0; margin-right: -6px; border-width: 0; } }
        @keyframes uh-in { from { opacity: 0; transform: translateY(6px) scale(.9); } to { opacity: 1; transform: none; } }
        .uh-hint { opacity: .55; font-size: 11px; }
        @media (prefers-reduced-motion: reduce) { .uh-chip { transition-duration: 1ms; } .uh-chip[data-cut='true'] { animation-duration: 40ms; } .uh-chip:last-child { animation-duration: 1ms !important; } }
      `}</style>
      <div className="uh" tabIndex={0} role="group" aria-label="Customiser with undo history" onKeyDown={keyDown} style={{ '--uh-accent': accent, '--uh-ink': textColor, ...style }}>
        <div className="uh-main">
          <div className="uh-stage"><Shape v={v} box={150} /></div>
          <div className="uh-ctl">
            {[['size', 20, 100], ['radius', 0, 40], ['rot', -180, 180]].map(([k, lo, hi]) => (
              <label className="uh-row" key={k}>
                <span>{LABELS[k]}</span>
                <input
                  type="range" min={lo} max={hi} value={v[k]}
                  onChange={(e) => edit({ [k]: +e.target.value })}
                  onPointerUp={flush} onKeyUp={flush} onBlur={flush}
                />
                <span>{v[k]}</span>
              </label>
            ))}
            <div className="uh-sw" role="group" aria-label="Colour">
              {SWATCHES.map((c) => (
                <button key={c} type="button" aria-label={c} aria-pressed={v.color === c} style={{ background: c }} onClick={() => edit({ color: c }, true)} />
              ))}
            </div>
            <label className="uh-row" style={{ gridTemplateColumns: '62px 1fr' }}>
              <span>Shape</span>
              <select value={v.shape} onChange={(e) => edit({ shape: e.target.value }, true)}>
                {Object.keys(SHAPES).map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
          </div>
        </div>
        <div className="uh-bar">
          <button type="button" className="uh-btn" disabled={!canUndo} onClick={undo} aria-label="Undo">Undo</button>
          <button type="button" className="uh-btn" disabled={!canRedo} onClick={redo} aria-label="Redo">Redo</button>
          <span className="uh-count">{S.idx + 1} / {S.items.length} (max {max})</span>
        </div>
        <div className="uh-strip" ref={strip} role="list" aria-label="History">
          {S.items.slice(0, at).map((it, i) => chip(it, i))}
          {S.cut && S.cut.items.map((it, i) => chip(it, at + i, true))}
          {S.items.slice(at).map((it, i) => chip(it, at + i))}
        </div>
        <div className="uh-hint">Focus here, then Ctrl/Cmd+Z undo, Shift+Ctrl/Cmd+Z or Ctrl+Y redo.</div>
      </div>
    </>
  )
}

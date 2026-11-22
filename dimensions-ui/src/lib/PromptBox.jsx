import { useEffect, useRef, useState } from 'react'

const COMMANDS = [
  { cmd: '/explain', hint: 'Explain the selected code' },
  { cmd: '/fix', hint: 'Find and fix a bug' },
  { cmd: '/test', hint: 'Write tests for a file' },
  { cmd: '/review', hint: 'Review the latest changes' },
  { cmd: '/summarize', hint: 'Summarize a long thread' },
  { cmd: '/translate', hint: 'Translate text to another language' },
]
const IDEAS = ['How can I help you today?', 'Ask about your code…', 'Type / for commands', 'Drop a file to talk about it']

// The box you type to an agent in: it grows with the text, rotates helpful
// placeholders, opens a command menu when a line starts with "/", and sends on Enter.
export default function PromptBox({
  model = 'Alpha B1',
  rotate = true, // rotate the placeholder ideas
  rows = 2,
  maxRows = 6,
  size = 15,
  width = 560,
  background = '#1f1e1d',
  border = '#3a3936',
  textColor = '#ece9e3',
  mutedColor = '#8f8c86',
  accent = '#d77757',
  onSend,
}) {
  const [text, setText] = useState('')
  const [idea, setIdea] = useState(0)
  const [hi, setHi] = useState(0)
  const [sent, setSent] = useState(null)
  const [files, setFiles] = useState([])
  const area = useRef(null)
  const pickFile = useRef(null)

  useEffect(() => {
    if (!rotate || text) return
    const t = setInterval(() => setIdea((n) => (n + 1) % IDEAS.length), 2800)
    return () => clearInterval(t)
  }, [rotate, text])

  // grow with the text, from `rows` up to `maxRows`
  useEffect(() => {
    const el = area.current
    if (!el) return
    const line = size * 1.5
    el.style.height = 'auto'
    el.style.height = `${Math.min(Math.max(el.scrollHeight, rows * line), maxRows * line)}px`
  }, [text, rows, maxRows, size])

  const slash = /^\/\S*$/.test(text)
  const matches = slash ? COMMANDS.filter((c) => c.cmd.startsWith(text)) : []
  useEffect(() => setHi(0), [text])

  const send = () => {
    const msg = text.trim()
    if (!msg) return
    onSend?.(msg, files)
    setSent(msg)
    setText('')
    setFiles([])
    setTimeout(() => setSent(null), 1800)
  }
  const onKey = (e) => {
    if (matches.length) {
      if (e.key === 'ArrowDown') return e.preventDefault(), setHi((h) => (h + 1) % matches.length)
      if (e.key === 'ArrowUp') return e.preventDefault(), setHi((h) => (h - 1 + matches.length) % matches.length)
      if (e.key === 'Enter' || e.key === 'Tab') return e.preventDefault(), setText(`${matches[hi].cmd} `)
      if (e.key === 'Escape') return setText('')
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const icon = { width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }
  const ghost = { all: 'unset', display: 'grid', placeItems: 'center', width: 32, height: 32, borderRadius: 8, color: mutedColor, cursor: 'pointer', border: `1px solid ${border}` }
  const ready = !!text.trim()

  return (
    <div style={{ position: 'relative', width: `min(${width}px, 100%)`, font: `400 ${size}px/1.5 "Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", sans-serif` }}>
      <style>{`
        @keyframes pb-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @keyframes pb-ph{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
        @keyframes pb-fly{0%{opacity:1;transform:none}100%{opacity:0;transform:translateY(-26px)}}
        .pb-area::placeholder{color:transparent}
        @media (prefers-reduced-motion:reduce){.pb *{animation:none!important;transition:none!important}}
      `}</style>
      <div className="pb">
        {/* command menu, opened by typing "/" */}
        {matches.length > 0 && (
          <ul role="listbox" style={{ position: 'absolute', left: 0, right: 0, bottom: 'calc(100% + 8px)', margin: 0, padding: 5, listStyle: 'none', background, border: `1px solid ${border}`, borderRadius: 12, boxShadow: '0 16px 40px -14px rgba(0,0,0,.6)', animation: 'pb-in .16s ease-out', zIndex: 2 }}>
            {matches.map((c, i) => (
              <li
                key={c.cmd}
                role="option"
                aria-selected={i === hi}
                onPointerEnter={() => setHi(i)}
                onMouseDown={(e) => (e.preventDefault(), setText(`${c.cmd} `), area.current?.focus())}
                style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '7px 10px', borderRadius: 8, cursor: 'pointer', background: i === hi ? `${mutedColor}26` : 'transparent' }}
              >
                <span style={{ color: accent, font: `500 ${size * 0.9}px/1 ui-monospace, Menlo, monospace`, minWidth: '6.5em' }}>{c.cmd}</span>
                <span style={{ color: mutedColor, fontSize: '0.88em' }}>{c.hint}</span>
              </li>
            ))}
          </ul>
        )}

        {sent && (
          <div aria-live="polite" style={{ position: 'absolute', right: 12, top: -30, padding: '4px 10px', borderRadius: 8, background: accent, color: '#fff', fontSize: '0.8em', maxWidth: '70%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', animation: 'pb-fly 1.8s ease-in forwards' }}>
            Sent: {sent}
          </div>
        )}

        <div style={{ background, border: `1px solid ${border}`, borderRadius: 16, padding: '14px 14px 10px', boxShadow: '0 1px 0 rgba(255,255,255,.04) inset, 0 10px 30px -18px rgba(0,0,0,.7)' }}>
          {files.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {files.map((f, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 6px 4px 9px', borderRadius: 8, border: `1px solid ${border}`, color: textColor, fontSize: '0.82em', animation: 'pb-in .2s ease-out' }}>
                  {f}
                  <button type="button" aria-label={`Remove ${f}`} onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} style={{ all: 'unset', cursor: 'pointer', color: mutedColor, padding: '0 3px' }}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <div style={{ position: 'relative' }}>
            {!text && (
              <span key={idea} aria-hidden style={{ position: 'absolute', inset: '0 auto auto 2px', color: mutedColor, pointerEvents: 'none', animation: rotate ? 'pb-ph .35s ease-out' : 'none' }}>
                {rotate ? IDEAS[idea] : IDEAS[0]}
              </span>
            )}
            <textarea
              ref={area}
              className="pb-area"
              rows={rows}
              value={text}
              placeholder={IDEAS[0]}
              aria-label="Message"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKey}
              style={{ all: 'unset', display: 'block', width: '100%', boxSizing: 'border-box', padding: '0 2px', resize: 'none', color: textColor, font: 'inherit', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <button type="button" aria-label="Attach a file" style={ghost} onClick={() => pickFile.current?.click()}>
              <svg viewBox="0 0 24 24" {...icon}>
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
            <input ref={pickFile} type="file" multiple hidden onChange={(e) => (setFiles((x) => [...x, ...[...e.target.files].map((f) => f.name)]), (e.target.value = ''))} />
            <button type="button" aria-label="Commands" style={ghost} onClick={() => (setText('/'), area.current?.focus())}>
              <svg viewBox="0 0 24 24" {...icon}>
                <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
                <circle cx="16" cy="7" r="2" />
                <circle cx="8" cy="17" r="2" />
              </svg>
            </button>
            <span style={{ marginLeft: 'auto', color: mutedColor, fontSize: '0.86em', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {model}
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="m7 10 5 5 5-5" />
              </svg>
            </span>
            <button
              type="button"
              aria-label="Send"
              disabled={!ready}
              onClick={send}
              style={{ all: 'unset', display: 'grid', placeItems: 'center', width: 32, height: 32, borderRadius: 9, background: ready ? accent : `${mutedColor}33`, color: ready ? '#fff' : mutedColor, cursor: ready ? 'pointer' : 'default', transition: 'background .2s, transform .15s', transform: ready ? 'scale(1)' : 'scale(.94)' }}
            >
              <svg viewBox="0 0 24 24" {...icon} strokeWidth="2.2">
                <path d="M12 19V5M6 11l6-6 6 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

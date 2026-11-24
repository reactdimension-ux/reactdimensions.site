import { useEffect, useRef, useState } from 'react'

const TASK = 'Fix the timer that keeps running after unmount'
const PLAN = ['Read the component', 'Find the cause', 'Fix the cleanup', 'Run the tests']
const REPLY = 'Found it: the interval in Timer.jsx was never cleared. I now return a cleanup function from the effect, and all 12 tests pass.'
const REPLY_DENIED = 'Understood, I left Timer.jsx as it was. The fix is one line: return () => clearInterval(id) from the effect.'

const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace'

// A whole agent session in one window: the person sends a task, the agent thinks, shows
// its plan, runs tool calls, asks permission before editing a file, and streams its reply.
// Status pill, timer and token count sit in the header. It plays itself on a loop; click
// Allow or Deny on the approval to steer it (it allows by itself after a few seconds).
// Everything is inline so one file copies anywhere.
export default function AgentConsole({
  task = TASK,
  autoApprove = true,
  speed = 1,
  height = 400,
  width = 740,
  size = 14,
  background = '#141414',
  panelColor = '#1b1b1b',
  textColor = '#e8e6e1',
  mutedColor = '#8a8a8a',
  color = '#d77757',
  doneColor = '#4eba65',
  errorColor = '#e5534b',
  workingColor = '#5b9bd5',
}) {
  const [msgs, setMsgs] = useState([])
  const [typed, setTyped] = useState('')
  const [status, setStatus] = useState('idle') // idle | thinking | working | done | error
  const [step, setStep] = useState(-1)
  const [secs, setSecs] = useState(0)
  const [tokens, setTokens] = useState(0)
  const [run, setRun] = useState(0)
  const [pending, setPending] = useState(false) // approval waiting for a click
  const answer = useRef(null)

  const running = status === 'thinking' || status === 'working'

  // elapsed timer and token count tick while the agent works
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => {
      setSecs((n) => n + 1)
      setTokens((n) => n + 40 + Math.floor(Math.random() * 90))
    }, 1000 / speed)
    return () => clearInterval(t)
  }, [running, speed])

  // the script
  useEffect(() => {
    let dead = false
    const wait = (ms) => new Promise((r) => setTimeout(r, ms / speed))
    const push = (m) => setMsgs((l) => [...l, m])
    const patch = (id, p) => setMsgs((l) => l.map((m) => (m.id === id ? { ...m, ...p } : m)))
    const drop = (id) => setMsgs((l) => l.filter((m) => m.id !== id))
    let n = 0
    const tool = async (name, args, result, ms, extra) => {
      const id = ++n
      push({ id, type: 'tool', name, args, state: 'running' })
      await wait(ms)
      if (dead) return
      patch(id, { state: extra?.fail ? 'error' : 'done', result: extra?.fail || result })
    }

    const go = async () => {
      setMsgs([])
      setTyped('')
      setStatus('idle')
      setStep(-1)
      setSecs(0)
      setTokens(0)
      setPending(false)
      await wait(900)
      // 1. the person types the task and sends it
      for (let i = 1; i <= task.length && !dead; i++) {
        setTyped(task.slice(0, i))
        await wait(32)
      }
      await wait(450)
      if (dead) return
      setTyped('')
      push({ id: ++n, type: 'user', text: task })
      setStatus('thinking')
      // 2. thinking
      const think = ++n
      push({ id: think, type: 'thinking' })
      await wait(1700)
      if (dead) return
      drop(think)
      setStatus('working')
      // 3. plan and tool calls
      setStep(0)
      await tool('Read', 'src/Timer.jsx', 'Read 84 lines', 1300)
      if (dead) return
      setStep(1)
      await tool('Search', '"setInterval" in src', 'Found 3 matches in 2 files', 1300)
      if (dead) return
      setStep(2)
      // 4. ask before editing
      const ask = ++n
      push({ id: ask, type: 'approval', action: 'Edit(src/Timer.jsx)', choice: null })
      setPending(true)
      const choice = await new Promise((resolve) => {
        answer.current = resolve
        if (autoApprove) setTimeout(() => resolve('allow'), 3600 / speed)
      })
      answer.current = null
      setPending(false)
      if (dead) return
      patch(ask, { choice })
      await wait(600)
      if (dead) return
      const allowed = choice !== 'deny'
      await tool('Edit', 'src/Timer.jsx', 'Updated with 3 additions and 1 removal', 1200, allowed ? null : { fail: 'Denied by you' })
      if (dead) return
      if (allowed) {
        setStep(3)
        await tool('Bash', 'npm test', '12 passed', 1600)
        if (dead) return
      }
      // 5. stream the reply
      const reply = ++n
      const text = allowed ? REPLY : REPLY_DENIED
      const words = text.split(' ')
      push({ id: reply, type: 'reply', text: '', streaming: true })
      for (let i = 1; i <= words.length && !dead; i++) {
        patch(reply, { text: words.slice(0, i).join(' ') })
        await wait(75)
      }
      if (dead) return
      patch(reply, { streaming: false })
      setStep(allowed ? 4 : 3)
      setStatus(allowed ? 'done' : 'error')
      await wait(5000)
      if (!dead) setRun((r) => r + 1)
    }
    go()
    return () => {
      dead = true
      if (answer.current) answer.current('allow')
    }
  }, [run, task, autoApprove, speed])

  const sc = { idle: mutedColor, thinking: color, working: workingColor, done: doneColor, error: errorColor }[status]
  const fmt = (s) => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`)
  const btn = (bg, fg, bd) => ({ cursor: 'pointer', font: 'inherit', fontWeight: 600, padding: '0.35em 0.9em', borderRadius: 6, border: `1px solid ${bd}`, background: bg, color: fg })

  return (
    <div
      style={{ width: `min(${width}px, 100%)`, height, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', borderRadius: 12, background, color: textColor, overflow: 'hidden', font: `400 ${size}px/1.45 ${MONO}`, boxShadow: '0 12px 36px #0005' }}
    >
      <style>{`
        @keyframes ac-blink{0%,100%{opacity:1}50%{opacity:.25}}
        @keyframes ac-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @keyframes ac-shimmer{from{background-position:200% 0}to{background-position:-200% 0}}
        @keyframes ac-pulse{0%{box-shadow:0 0 0 0 var(--ac-c)}100%{box-shadow:0 0 0 .5em transparent}}
        @keyframes ac-caret{50%{opacity:0}}
        .ac-msg{animation:ac-in .25s ease-out}
        @media (prefers-reduced-motion:reduce){.ac *{animation:none!important}}
      `}</style>

      {/* header: title, status pill, timer, tokens */}
      <div className="ac" style={{ display: 'flex', alignItems: 'center', gap: '0.9em', padding: '0.7em 1em', background: panelColor, borderBottom: '1px solid #ffffff10', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', gap: 6 }} aria-hidden>
          {['#ff5f57', '#febc2e', '#28c840'].map((c) => <i key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, display: 'block' }} />)}
        </span>
        <b style={{ fontWeight: 600, flex: 1 }}>Agent</b>
        <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5em', padding: '0.2em 0.8em 0.2em 0.65em', borderRadius: 99, border: `1px solid ${sc}55`, color: sc, fontWeight: 500 }}>
          <i aria-hidden style={{ '--ac-c': sc + '99', width: '0.55em', height: '0.55em', borderRadius: '50%', background: sc, display: 'block', animation: running ? 'ac-pulse 1.3s ease-out infinite' : 'none' }} />
          {status[0].toUpperCase() + status.slice(1)}
        </span>
        <span style={{ color: mutedColor, fontVariantNumeric: 'tabular-nums' }}>{fmt(secs)}</span>
        <span style={{ color: mutedColor, fontVariantNumeric: 'tabular-nums' }}>{tokens.toLocaleString('en-US')} tokens</span>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {/* chat log: newest at the bottom, older lines scroll off the top */}
        <div className="ac" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: '0.75em', padding: '1em', overflow: 'hidden' }}>
          {msgs.map((m) => {
            if (m.type === 'user')
              return (
                <div key={m.id} className="ac-msg" style={{ alignSelf: 'flex-end', maxWidth: '85%', padding: '0.55em 0.9em', borderRadius: '12px 12px 3px 12px', background: color + '26', border: `1px solid ${color}55` }}>
                  {m.text}
                </div>
              )
            if (m.type === 'thinking')
              return (
                <div key={m.id} className="ac-msg" style={{ display: 'flex', gap: '0.6em', color }}>
                  <span aria-hidden style={{ animation: 'ac-blink 1s ease-in-out infinite' }}>✻</span>
                  <span style={{ backgroundImage: `linear-gradient(90deg, ${color} 0%, #fff 50%, ${color} 100%)`, backgroundSize: '200% 100%', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', animation: 'ac-shimmer 2.2s linear infinite' }}>Thinking…</span>
                </div>
              )
            if (m.type === 'tool') {
              const c = { running: mutedColor, done: doneColor, error: errorColor }[m.state]
              return (
                <div key={m.id} className="ac-msg" style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: '0.6em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <span aria-hidden style={{ color: c, animation: m.state === 'running' ? 'ac-blink 1s ease-in-out infinite' : 'none' }}>⏺</span>
                    <span><b style={{ fontWeight: 600 }}>{m.name}</b><span style={{ color: mutedColor }}>(</span>{m.args}<span style={{ color: mutedColor }}>)</span></span>
                  </div>
                  <div style={{ paddingLeft: '0.4em', color: m.state === 'error' ? errorColor : mutedColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    ⎿ {m.state === 'running' ? 'Running…' : m.state === 'error' ? `Error: ${m.result}` : m.result}
                  </div>
                </div>
              )
            }
            if (m.type === 'approval')
              return (
                <div key={m.id} role="alertdialog" aria-label="Approval needed" className="ac-msg" style={{ padding: '0.8em 0.9em', borderRadius: 9, background: panelColor, border: `1px solid ${color}66` }}>
                  <div style={{ fontWeight: 600, marginBottom: '0.45em' }}><span aria-hidden style={{ color }}>⏺ </span>Allow this action?</div>
                  <div style={{ padding: '0.4em 0.7em', borderRadius: 6, background: '#0b0b0b', marginBottom: '0.7em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.action}</div>
                  {m.choice ? (
                    <span style={{ color: m.choice === 'deny' ? errorColor : doneColor, fontWeight: 600 }}>{m.choice === 'deny' ? '✘ Denied' : m.choice === 'always' ? '✔ Always allowed' : '✔ Allowed'}</span>
                  ) : (
                    <span style={{ display: 'flex', gap: '0.5em', flexWrap: 'wrap' }}>
                      <button disabled={!pending} onClick={() => answer.current?.('allow')} style={btn(doneColor, '#0b0b0b', doneColor)}>Allow</button>
                      <button disabled={!pending} onClick={() => answer.current?.('always')} style={btn('transparent', textColor, mutedColor + '88')}>Always allow</button>
                      <button disabled={!pending} onClick={() => answer.current?.('deny')} style={btn('transparent', errorColor, errorColor + '88')}>Deny</button>
                    </span>
                  )}
                </div>
              )
            // reply
            return (
              <div key={m.id} className="ac-msg">
                {m.text}
                {m.streaming && <span aria-hidden style={{ display: 'inline-block', width: '0.55em', height: '1.05em', marginLeft: 2, verticalAlign: '-0.15em', background: color, animation: 'ac-caret 1s step-end infinite' }} />}
              </div>
            )
          })}
        </div>

        {/* plan: the step timeline */}
        <aside className="ac" aria-label="Plan" style={{ width: '14em', flex: 'none', padding: '1em', background: panelColor, borderLeft: '1px solid #ffffff10', display: 'grid', alignContent: 'start', gap: '0.2em' }}>
          <div style={{ color: mutedColor, fontSize: '0.8em', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5em' }}>Plan</div>
          {PLAN.map((label, i) => {
            const st = step < 0 ? 'todo' : i < step ? 'done' : i === step ? 'active' : 'todo'
            const lit = step >= 0
            return (
              <div key={label} style={{ display: 'flex', gap: '0.7em', minHeight: '2.5em', opacity: lit ? 1 : 0.5, transition: 'opacity .3s' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '0.8em', flex: 'none' }}>
                  <span style={{ '--ac-c': color + '88', width: '0.7em', height: '0.7em', boxSizing: 'border-box', borderRadius: '50%', marginTop: '0.3em', border: `2px solid ${st === 'todo' ? mutedColor : color}`, background: st === 'done' ? color : 'transparent', animation: st === 'active' ? 'ac-pulse 1.4s ease-out infinite' : 'none', transition: 'background .3s' }} />
                  {i < PLAN.length - 1 && <span style={{ flex: 1, width: 2, marginTop: 3, background: i < step ? color : mutedColor + '44', transition: 'background .4s' }} />}
                </div>
                <span style={{ color: st === 'todo' ? mutedColor : textColor, fontWeight: st === 'active' ? 600 : 400 }}>{label}</span>
              </div>
            )
          })}
        </aside>
      </div>

      {/* prompt box */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6em', margin: '0 1em 1em', padding: '0.6em 0.7em 0.6em 1em', borderRadius: 10, border: `1px solid ${typed ? color : mutedColor + '44'}`, background: '#0e0e0e', transition: 'border-color .2s' }}>
        <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: typed ? textColor : mutedColor }}>
          {typed || (running ? 'Working… esc to interrupt' : 'Ask the agent to do something…')}
        </span>
        <span aria-hidden style={{ width: '2em', height: '2em', borderRadius: 8, display: 'grid', placeItems: 'center', background: typed ? color : mutedColor + '33', color: typed ? '#0b0b0b' : mutedColor, fontWeight: 700, transition: 'background .2s' }}>↑</span>
      </div>
    </div>
  )
}

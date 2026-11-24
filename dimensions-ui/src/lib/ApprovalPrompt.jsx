import { useEffect, useState } from 'react'

// "Allow this action?" for an agent that asks before it acts. It is a real dialog
// (role="alertdialog", Escape denies). The exact action is shown in a monospace box so
// the person knows what they are allowing. The choice goes out through
// onChoose('allow' | 'deny' | 'always'); in the demo the prompt then shows the result
// for a moment and comes back.
export default function ApprovalPrompt({
  title = 'Allow this action?',
  action = 'rm -rf node_modules && npm install',
  tool = 'Bash',
  onChoose = () => {},
  demo = true, // reset after a choice so the preview can be tried again
  width = 460,
  size = 15,
  background = '#141414',
  textColor = '#e8e6e1',
  mutedColor = '#8a8a8a',
  color = '#d77757',
  allowColor = '#4eba65',
  denyColor = '#e5534b',
}) {
  const [choice, setChoice] = useState(null)

  useEffect(() => {
    if (!choice || !demo) return
    const t = setTimeout(() => setChoice(null), 2200)
    return () => clearTimeout(t)
  }, [choice, demo])

  const pick = (c) => {
    setChoice(c)
    onChoose(c)
  }
  const result = { allow: ['✔ Allowed once', allowColor], always: ['✔ Always allowed', allowColor], deny: ['✘ Denied', denyColor] }[choice]

  const btn = (bg, fg, border) => ({ cursor: 'pointer', font: 'inherit', fontWeight: 600, padding: '0.5em 1em', borderRadius: 6, border: `1px solid ${border}`, background: bg, color: fg })

  return (
    <div
      role="alertdialog"
      aria-labelledby="ap-title"
      aria-describedby="ap-action"
      onKeyDown={(e) => e.key === 'Escape' && !choice && pick('deny')}
      style={{ width: `min(${width}px, 100%)`, boxSizing: 'border-box', padding: '1.2em 1.3em', borderRadius: 10, background, color: textColor, border: `1px solid ${color}55`, font: `400 ${size}px/1.4 ui-monospace, "SF Mono", Menlo, Consolas, monospace` }}
    >
      <div id="ap-title" style={{ fontWeight: 600, marginBottom: '0.7em' }}>
        <span aria-hidden style={{ color }}>⏺ </span>
        {title}
      </div>
      <div id="ap-action" style={{ padding: '0.7em 0.9em', borderRadius: 6, background: '#0b0b0b', border: '1px solid #ffffff14', marginBottom: '1em', overflowX: 'auto', whiteSpace: 'nowrap' }}>
        <b style={{ fontWeight: 600 }}>{tool}</b>
        <span style={{ color: mutedColor }}>(</span>
        {action}
        <span style={{ color: mutedColor }}>)</span>
      </div>
      <div style={{ minHeight: '2.5em', display: 'flex', gap: '0.6em', flexWrap: 'wrap', alignItems: 'center' }}>
        {choice ? (
          <span role="status" style={{ color: result[1], fontWeight: 600 }}>{result[0]}</span>
        ) : (
          <>
            <button onClick={() => pick('allow')} style={btn(allowColor, '#0b0b0b', allowColor)}>Allow</button>
            <button onClick={() => pick('always')} style={btn('transparent', textColor, mutedColor + '88')}>Always allow</button>
            <button onClick={() => pick('deny')} style={btn('transparent', denyColor, denyColor + '88')}>Deny</button>
          </>
        )}
      </div>
    </div>
  )
}

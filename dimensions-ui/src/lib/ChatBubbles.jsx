import { useEffect, useState } from 'react'
import TypingIndicator from './TypingIndicator.jsx'

const MESSAGES = [
  { from: 'user', text: 'My page gets slower the longer it stays open. Any idea why?' },
  { from: 'agent', text: 'Probably a timer that is never cleared. Each render starts a new one, so they pile up.' },
  { from: 'user', text: 'Can you fix it?' },
  { from: 'agent', text: 'Done. The timer now lives in an effect and is cleared on cleanup, so only one ever runs.' },
]

// A short chat between a person and an agent. Messages arrive one at a time; before
// each agent reply a typing bubble shows. Every message keeps its place from the
// start, so the conversation never pushes the layout around.
export default function ChatBubbles({
  messages = MESSAGES,
  typing = 'dots', // any Typing Indicator kind
  avatar = true,
  loop = true,
  speed = 1,
  size = 15,
  width = 460,
  background = '#141414',
  userBubble = '#2b2a28',
  agentColor = '#e8e6e1',
  userColor = '#f2f0eb',
  accent = '#d77757',
}) {
  // shown: how many messages are visible; typing: the agent is writing the next one
  const [shown, setShown] = useState(0)
  const [isTyping, setTyping] = useState(false)

  useEffect(() => {
    let wait
    let next
    if (shown >= messages.length) {
      if (!loop) return
      wait = 3600
      next = () => setShown(0)
    } else if (messages[shown].from === 'agent' && !isTyping) {
      wait = 500
      next = () => setTyping(true)
    } else {
      wait = isTyping ? 1500 : 900
      next = () => {
        setTyping(false)
        setShown((n) => n + 1)
      }
    }
    const t = setTimeout(next, wait / speed)
    return () => clearTimeout(t)
  }, [shown, isTyping, messages, loop, speed])

  const Avatar = () => (
    <span aria-hidden style={{ flex: '0 0 auto', width: '1.7em', height: '1.7em', borderRadius: 7, background: accent, color: background, display: 'grid', placeItems: 'center', fontSize: '0.9em', fontWeight: 700, marginTop: '0.15em' }}>
      ✻
    </span>
  )

  return (
    <div
      role="log"
      aria-live="polite"
      style={{ width: `min(${width}px, 100%)`, boxSizing: 'border-box', padding: '1.1em', borderRadius: 12, background, font: `400 ${size}px/1.5 "Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", sans-serif` }}
    >
      <style>{`
        @keyframes cb-in{from{opacity:0;transform:translateY(6px) scale(.98)}to{opacity:1;transform:none}}
        @media (prefers-reduced-motion:reduce){.cb *{animation:none!important}}
      `}</style>
      <div className="cb" style={{ display: 'grid', gap: '0.85em' }}>
        {messages.map((m, i) => {
          const user = m.from === 'user'
          const visible = i < shown
          const typingHere = !visible && isTyping && i === shown
          return (
            // the message and its typing bubble share one grid cell, so the row keeps its height
            <div key={i} style={{ display: 'grid' }}>
              <div style={{ gridArea: '1 / 1', display: 'flex', justifyContent: user ? 'flex-end' : 'flex-start', gap: '0.6em', visibility: visible ? 'visible' : 'hidden', animation: visible ? 'cb-in .35s ease-out' : 'none' }}>
                {!user && avatar && <Avatar />}
                <div
                  style={
                    user
                      ? { maxWidth: '80%', padding: '0.55em 0.9em', borderRadius: '14px 14px 4px 14px', background: userBubble, color: userColor }
                      : { maxWidth: avatar ? '85%' : '92%', padding: '0.2em 0', color: agentColor }
                  }
                >
                  {m.text}
                </div>
              </div>
              {typingHere && (
                <div aria-label="Agent is typing" style={{ gridArea: '1 / 1', display: 'flex', alignItems: 'flex-start', gap: '0.6em', animation: 'cb-in .25s ease-out' }}>
                  {avatar && <Avatar />}
                  <TypingIndicator kind={typing} color={agentColor} background={userBubble} accent={accent} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

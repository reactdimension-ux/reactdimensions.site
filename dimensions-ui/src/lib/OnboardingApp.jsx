import { useEffect, useRef, useState } from 'react'

// An onboarding flow on a phone, as a click-through prototype. Three intro
// pages you can swipe (drag) or step through with Next, with an illustration
// that slides at a different speed from the text for a parallax feel and a
// progress pill that stretches under the current page. Skip jumps to Sign up,
// which validates the form (name, email, a password with a strength meter and
// the terms box) before it lets you in. Home greets you by name with a setup
// checklist you can tick off, and a button to replay the flow. The phone
// scales to fit whatever box it is in.

const W = 390 // the phone screen, in CSS px (an iPhone's width)
const H = 844
const INK = '#17142b'
const MUTED = '#7d7a93'

const PAGES = [
  { title: 'Plan your day in seconds', text: 'Drop tasks in, and the app sorts them by what matters most.', a: '#7c3aed', b: '#c4b5fd', art: 'plan' },
  { title: 'Focus without the noise', text: 'Quiet timers and gentle nudges keep you in the flow.', a: '#0ea5e9', b: '#bae6fd', art: 'focus' },
  { title: 'Celebrate every win', text: 'Streaks and weekly recaps show how far you have come.', a: '#f97316', b: '#fed7aa', art: 'win' },
]

const STEPS = ['intro1', 'intro2', 'intro3', 'signup', 'home']

// the illustration for each page, drawn in SVG
function Art({ kind, a, b }) {
  return (
    <svg viewBox="0 0 300 260" width="300" height="260" aria-hidden="true">
      <circle cx="150" cy="130" r="112" fill={b} opacity=".55" />
      <circle cx="150" cy="130" r="74" fill={b} />
      {kind === 'plan' && (
        <g>
          <rect x="88" y="62" width="124" height="150" rx="16" fill="#fff" stroke={a} strokeWidth="4" />
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect x="104" y={84 + i * 38} width="20" height="20" rx="6" fill={i < 2 ? a : 'none'} stroke={a} strokeWidth="3" />
              {i < 2 && <path d={`M108 ${94 + i * 38}l5 5 8-10`} stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
              <rect x="134" y={89 + i * 38} width={62 - i * 12} height="9" rx="4.5" fill={i < 2 ? '#d9d4ef' : a} />
            </g>
          ))}
        </g>
      )}
      {kind === 'focus' && (
        <g>
          <circle cx="150" cy="132" r="62" fill="#fff" stroke={a} strokeWidth="4" />
          <circle cx="150" cy="132" r="48" fill="none" stroke="#e0f2fe" strokeWidth="10" />
          <path d="M150 84a48 48 0 1 1-41 23" fill="none" stroke={a} strokeWidth="10" strokeLinecap="round" />
          <path d="M150 112v22l14 9" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
      {kind === 'win' && (
        <g>
          <path d="M112 78h76v34a38 38 0 0 1-76 0z" fill={a} />
          <path d="M112 90H92a4 4 0 0 0-4 4c0 18 12 30 28 32M188 90h20a4 4 0 0 1 4 4c0 18-12 30-28 32" fill="none" stroke={a} strokeWidth="6" strokeLinecap="round" />
          <rect x="140" y="148" width="20" height="26" fill={a} />
          <rect x="120" y="174" width="60" height="14" rx="6" fill={INK} />
          <path d="M150 92l6 12 13 2-9.5 9 2.5 13-12-6.500-12 6.500 2.500-13-9.500-9 13-2z" fill="#fff" />
        </g>
      )}
    </svg>
  )
}

function StatusBar({ frame, dark }) {
  const c = dark ? '#fff' : INK
  const clock = new Date().toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px 0 36px', fontSize: 16, fontWeight: 600, color: c, pointerEvents: 'none' }}>
      <span>{clock}</span>
      {frame && <span style={{ position: 'absolute', left: '50%', top: 11, width: 122, height: 35, marginLeft: -61, borderRadius: 20, background: '#000' }} />}
      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }} aria-hidden="true">
        <svg width="18" height="11" viewBox="0 0 18 11" fill={c}>
          <rect x="0" y="7" width="3" height="4" rx="1" />
          <rect x="5" y="5" width="3" height="6" rx="1" />
          <rect x="10" y="2.5" width="3" height="8.5" rx="1" />
          <rect x="15" y="0" width="3" height="11" rx="1" />
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12">
          <rect x="0.5" y="0.5" width="22" height="11" rx="3.5" fill="none" stroke={c} opacity=".45" />
          <rect x="2.5" y="2.5" width="16" height="7" rx="2" fill={c} />
          <rect x="23.5" y="4" width="2" height="4" rx="1" fill={c} opacity=".45" />
        </svg>
      </span>
    </div>
  )
}

const strength = (pw) => {
  let s = 0
  if (pw.length >= 8) s++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++
  if (/\d/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  return s
}

// ---------------------------------------------------------------- app

export default function OnboardingApp({ name: appName = 'Flowly', accent = '#7c3aed', startScreen = 'intro1', frame = true, style }) {
  const box = useRef()
  const toastTimer = useRef()
  const drag = useRef(null)
  const [scale, setScale] = useState(1)
  const [step, setStep] = useState(Math.max(0, STEPS.indexOf(startScreen)))
  const [dir, setDir] = useState(1)
  const [dx, setDx] = useState(0) // live finger offset while swiping an intro page
  const [form, setForm] = useState({ name: '', email: '', pw: '', terms: false })
  const [touched, setTouched] = useState(false)
  const [show, setShow] = useState(false)
  const [done, setDone] = useState([true, false, false])
  const [toast, setToast] = useState('')

  useEffect(() => (setStep(Math.max(0, STEPS.indexOf(startScreen))), setDx(0)), [startScreen])

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => {
      const fw = frame ? W + 28 : W
      const fh = frame ? H + 28 : H
      setScale(Math.min(1.2, (e.contentRect.width - 24) / fw, (e.contentRect.height - 24) / fh))
    })
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [frame])

  useEffect(() => () => clearTimeout(toastTimer.current), [])
  const say = (t) => {
    setToast(t)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 1900)
  }

  const go = (n) => (setDir(n >= step ? 1 : -1), setDx(0), setStep(Math.max(0, Math.min(STEPS.length - 1, n))))
  const screen = STEPS[step]
  const isIntro = step < 3

  // swipe an intro page: drag left for the next, right for the previous
  const down = (e) => {
    if (!isIntro) return
    drag.current = { x: e.clientX }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const move = (e) => {
    if (!drag.current) return
    const d = (e.clientX - drag.current.x) / scale
    setDx(step === 0 && d > 0 ? d * 0.3 : d)
  }
  const up = () => {
    if (!drag.current) return
    drag.current = null
    if (dx < -70) go(step + 1)
    else if (dx > 70 && step > 0) go(step - 1)
    else setDx(0)
  }

  const errs = {
    name: form.name.trim().length < 2 ? 'Tell us your name' : '',
    email: /^\S+@\S+\.\S+$/.test(form.email) ? '' : 'Enter a valid email',
    pw: form.pw.length < 8 ? 'At least 8 characters' : '',
    terms: form.terms ? '' : 'Please accept the terms',
  }
  const valid = !Object.values(errs).some(Boolean)
  const pwScore = strength(form.pw)
  const submit = (e) => {
    e.preventDefault()
    setTouched(true)
    if (valid) (say(`Welcome, ${form.name.trim().split(' ')[0]}!`), go(4))
  }

  const field = (key, label, type, ph) => (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', height: 50, borderRadius: 14, background: '#fff', boxShadow: `inset 0 0 0 1.5px ${touched && errs[key] ? '#ef4444' : '#e6e2f3'}` }}>
        <input
          type={key === 'pw' && show ? 'text' : type}
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          placeholder={ph}
          autoComplete="off"
          style={{ flex: 1, minWidth: 0, height: '100%', padding: '0 14px', border: 'none', outline: 'none', background: 'none', font: 'inherit', fontSize: 15, color: INK }}
        />
        {key === 'pw' && (
          <button type="button" onClick={() => setShow(!show)} style={{ border: 'none', background: 'none', font: 'inherit', fontSize: 12.5, fontWeight: 700, color: accent, padding: '0 14px', cursor: 'pointer' }}>
            {show ? 'Hide' : 'Show'}
          </button>
        )}
      </span>
      {touched && errs[key] && <span style={{ display: 'block', fontSize: 12, color: '#ef4444', marginTop: 5 }}>{errs[key]}</span>}
    </label>
  )

  const pill = (dark) => (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }} aria-label={`Page ${Math.min(step + 1, 3)} of 3`}>
      {[0, 1, 2].map((i) => (
        <button key={i} type="button" onClick={() => go(i)} aria-label={`Go to page ${i + 1}`} style={{ width: step === i ? 28 : 8, height: 8, borderRadius: 4, border: 'none', padding: 0, background: step === i ? accent : dark ? '#d9d4ef' : '#d9d4ef', transition: 'width .3s, background .3s', cursor: 'pointer' }} />
      ))}
    </div>
  )

  let body
  if (isIntro) {
    const p = PAGES[step]
    // the picture moves a little further than the text as you drag: parallax
    body = (
      <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} style={{ position: 'absolute', inset: 0, touchAction: 'pan-y', userSelect: 'none', cursor: 'grab', background: `linear-gradient(180deg, ${p.b}66, #fff 55%)` }}>
        <button type="button" onClick={() => go(3)} style={{ position: 'absolute', right: 22, top: 64, zIndex: 5, border: 'none', background: 'none', font: 'inherit', fontSize: 14, fontWeight: 600, color: MUTED, cursor: 'pointer' }}>
          Skip
        </button>
        <div key={step} style={{ position: 'absolute', inset: 0, animation: dx ? 'none' : `${dir > 0 ? 'ob-r' : 'ob-l'} .35s ease` }}>
          <div style={{ position: 'absolute', left: '50%', top: 150, marginLeft: -150, transform: `translateX(${dx * 1.4}px)`, transition: dx ? 'none' : 'transform .3s' }}>
            <Art kind={p.art} a={p.a} b={p.b} />
          </div>
          <div style={{ position: 'absolute', left: 32, right: 32, top: 450, textAlign: 'center', transform: `translateX(${dx * 0.6}px)`, transition: dx ? 'none' : 'transform .3s', opacity: 1 - Math.min(Math.abs(dx) / 260, 0.7) }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15 }}>{p.title}</h1>
            <p style={{ margin: '12px 0 0', fontSize: 15, lineHeight: 1.5, color: MUTED }}>{p.text}</p>
          </div>
        </div>
        <div style={{ position: 'absolute', left: 28, right: 28, bottom: 44 }}>
          {pill()}
          <button type="button" onClick={() => go(step + 1)} style={{ width: '100%', height: 54, marginTop: 22, borderRadius: 27, border: 'none', background: accent, color: '#fff', font: 'inherit', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: `0 10px 24px ${accent}55` }}>
            {step === 2 ? 'Get started' : 'Next'}
          </button>
        </div>
      </div>
    )
  } else if (screen === 'signup') {
    body = (
      <form onSubmit={submit} noValidate style={{ position: 'absolute', inset: 0, padding: '70px 26px 0', overflowY: 'auto', background: '#fbfaff' }} className="ob-scroll">
        <button type="button" onClick={() => go(2)} aria-label="Back" style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: '#fff', cursor: 'pointer', fontSize: 18, color: INK, boxShadow: '0 2px 8px rgba(23,20,43,.08)' }}>‹</button>
        <h1 style={{ margin: '18px 0 4px', fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>Create your account</h1>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: MUTED }}>Join {appName} in under a minute.</p>
        <div style={{ display: 'grid', gap: 14 }}>
          {field('name', 'Full name', 'text', 'Alex Rivera')}
          {field('email', 'Email', 'email', 'alex@example.com')}
          {field('pw', 'Password', 'password', 'At least 8 characters')}
          <div style={{ display: 'flex', gap: 5, marginTop: -6 }} aria-label={`Password strength ${pwScore} of 4`}>
            {[1, 2, 3, 4].map((k) => (
              <span key={k} style={{ flex: 1, height: 5, borderRadius: 3, background: k <= pwScore ? ['#ef4444', '#f59e0b', '#84cc16', '#22c55e'][pwScore - 1] : '#e6e2f3', transition: 'background .25s' }} />
            ))}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: MUTED, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.terms} onChange={(e) => setForm((f) => ({ ...f, terms: e.target.checked }))} style={{ width: 20, height: 20, accentColor: accent }} />
            I agree to the Terms and Privacy Policy
          </label>
          {touched && errs.terms && <span style={{ fontSize: 12, color: '#ef4444', marginTop: -8 }}>{errs.terms}</span>}
        </div>
        <button type="submit" style={{ width: '100%', height: 54, marginTop: 22, borderRadius: 27, border: 'none', background: accent, color: '#fff', font: 'inherit', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: `0 10px 24px ${accent}55` }}>
          Create account
        </button>
        <button type="button" onClick={() => say('Signing in with Apple…')} style={{ width: '100%', height: 50, marginTop: 10, borderRadius: 25, border: 'none', background: INK, color: '#fff', font: 'inherit', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
          Continue with Apple
        </button>
      </form>
    )
  } else {
    const first = form.name.trim().split(' ')[0] || 'there'
    const tasks = ['Create your account', 'Add your first task', 'Start a focus timer']
    const count = done.filter(Boolean).length
    body = (
      <div style={{ position: 'absolute', inset: 0, padding: '70px 24px 0', overflowY: 'auto', background: '#fbfaff' }} className="ob-scroll">
        <div style={{ fontSize: 14, color: MUTED }}>Welcome to {appName}</div>
        <h1 style={{ margin: '2px 0 18px', fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em' }}>Hi {first} 👋</h1>
        <div style={{ borderRadius: 24, padding: 20, color: '#fff', background: `linear-gradient(135deg, ${accent}, #4c1d95)`, boxShadow: `0 14px 30px ${accent}44` }}>
          <div style={{ fontSize: 13, opacity: 0.85 }}>Setup progress</div>
          <div style={{ fontSize: 32, fontWeight: 800, marginTop: 2 }}>{count} of 3</div>
          <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,.25)', marginTop: 12, overflow: 'hidden' }}>
            <div style={{ width: `${(count / 3) * 100}%`, height: '100%', background: '#fff', borderRadius: 4, transition: 'width .4s' }} />
          </div>
        </div>
        <h2 style={{ margin: '22px 0 10px', fontSize: 16, fontWeight: 800 }}>Get started</h2>
        <div style={{ display: 'grid', gap: 8 }}>
          {tasks.map((t, i) => (
            <button key={t} type="button" onClick={() => (setDone((d) => d.map((x, j) => (j === i ? !x : x))), !done[i] && say('Nice — one step closer'))} aria-pressed={done[i]} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', border: 'none', borderRadius: 18, background: '#fff', font: 'inherit', textAlign: 'left', cursor: 'pointer', color: INK, boxShadow: '0 2px 8px rgba(23,20,43,.05)' }}>
              <span style={{ width: 26, height: 26, borderRadius: 9, display: 'grid', placeItems: 'center', background: done[i] ? accent : 'transparent', boxShadow: done[i] ? 'none' : 'inset 0 0 0 2px #d9d4ef', color: '#fff', fontSize: 15, transition: 'background .2s' }}>{done[i] ? '✓' : ''}</span>
              <span style={{ flex: 1, fontSize: 15, fontWeight: 600, textDecoration: done[i] ? 'line-through' : 'none', color: done[i] ? MUTED : INK }}>{t}</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={() => (setForm({ name: '', email: '', pw: '', terms: false }), setTouched(false), setDone([true, false, false]), go(0))} style={{ width: '100%', height: 50, marginTop: 22, borderRadius: 25, border: 'none', background: '#ece8fa', color: accent, font: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
          Replay onboarding
        </button>
      </div>
    )
  }

  const phone = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frame ? 46 : 0, background: '#fff', color: INK, fontFamily: "-apple-system, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes ob-r { from { opacity: 0; transform: translateX(60px) } to { opacity: 1; transform: none } }
        @keyframes ob-l { from { opacity: 0; transform: translateX(-60px) } to { opacity: 1; transform: none } }
        @keyframes ob-in { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
        .ob-scroll { scrollbar-width: none } .ob-scroll::-webkit-scrollbar { display: none }
        .ob-app button:focus-visible, .ob-app input:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px }
      `}</style>
      <StatusBar frame={frame} />
      {isIntro ? body : <div key={screen} style={{ position: 'absolute', inset: 0, animation: `${dir > 0 ? 'ob-r' : 'ob-l'} .3s ease` }}>{body}</div>}
      <div role="status" style={{ position: 'absolute', left: '50%', top: 58, zIndex: 30, transform: `translate(-50%, ${toast ? 0 : -90}px)`, transition: 'transform .35s cubic-bezier(.2,.8,.2,1)', padding: '10px 16px', borderRadius: 20, background: INK, color: '#fff', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{toast}</div>
      <div style={{ position: 'absolute', left: '50%', bottom: 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: INK, opacity: 0.8, zIndex: 25 }} />
    </div>
  )

  return (
    <div ref={box} className="ob-app" style={{ position: 'relative', width: '100%', height: '100%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #ece8fa, #c4bde6 75%)', ...style }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
        {frame ? (
          <div style={{ padding: 12, borderRadius: 58, background: 'linear-gradient(145deg, #3a3550, #15121f 40%, #2d2842)', boxShadow: '0 40px 80px rgba(40,30,80,.35), inset 0 0 0 2px #514a6b' }}>
            <div style={{ padding: 2, borderRadius: 48, background: '#000' }}>{phone}</div>
          </div>
        ) : (
          phone
        )}
      </div>
    </div>
  )
}

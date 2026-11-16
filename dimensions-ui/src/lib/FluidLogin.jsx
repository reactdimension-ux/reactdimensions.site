import FluidGradient from './FluidGradient.jsx'

// A split sign-in screen: a white form panel on the left and a Fluid Gradient
// hero on the right, inside a rounded card on a tinted page.

const UserGlyph = ({ size = 16, stroke = 'currentColor', width = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
  </svg>
)

const LockGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2.2" />
  </svg>
)

export default function FluidLogin({
  brand = 'Studio Form',
  accent = '#6f8579',
  page,
  title = 'Welcome.',
  color1 = '#f0517a',
  color2 = '#fdd36b',
  color3 = '#b9dccb',
  color4 = '#f7849a',
  speed = 1,
  warp = 1,
  scale = 1,
  grain = 0.04,
  style,
}) {
  const gradient = { color1, color2, color3, color4, speed, warp, scale, grain }

  return (
    <div className="fl-page" style={{ '--fl-accent': accent, background: page ?? color1, ...style }}>
      <style>{`
        .fl-page { container-type: inline-size; display: grid; place-items: center; padding: clamp(12px, 4cqi, 40px); box-sizing: border-box; font-family: 'Montserrat', 'Inter', system-ui, sans-serif; }
        .fl-page *, .fl-page *::before, .fl-page *::after { box-sizing: border-box; }
        .fl-card { width: 100%; height: 100%; max-width: 1040px; max-height: 560px; display: grid; grid-template-columns: minmax(240px, 35%) 1fr; border-radius: 22px; overflow: hidden; background: #fff; box-shadow: 0 24px 60px -20px rgba(80, 10, 30, .45); }
        .fl-side { display: flex; flex-direction: column; padding: 28px 30px 22px; color: #2c3532; }
        .fl-brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 13px; line-height: 1.1; color: var(--fl-accent); }
        .fl-logo { position: relative; width: 26px; height: 26px; flex: none; }
        .fl-logo i { position: absolute; width: 18px; height: 18px; border-radius: 5px; background: var(--fl-accent); }
        .fl-logo i:first-child { left: 0; top: 0; opacity: .55; }
        .fl-logo i:last-child { right: 0; bottom: 0; box-shadow: -2px -2px 0 2px #fff; }
        .fl-form { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 12px; }
        .fl-avatar { align-self: center; width: 72px; height: 72px; border-radius: 50%; background: var(--fl-accent); display: grid; place-items: center; color: #fff; margin-bottom: 10px; }
        .fl-field { display: flex; align-items: center; gap: 10px; height: 40px; padding: 0 16px; border: 2px solid #2c3532; border-radius: 999px; color: #2c3532; }
        .fl-field input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; font: 600 12px/1 inherit; letter-spacing: .06em; color: inherit; }
        .fl-field input::placeholder { color: #2c3532; text-transform: uppercase; }
        .fl-field:focus-within { border-color: var(--fl-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--fl-accent) 25%, transparent); }
        .fl-login { height: 40px; border: 0; border-radius: 999px; background: var(--fl-accent); color: #fff; font: 700 13px/1 inherit; letter-spacing: .12em; cursor: pointer; transition: filter .2s, transform .1s; }
        .fl-login:hover { filter: brightness(1.08); }
        .fl-login:active { transform: scale(.98); }
        .fl-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 9.5px; font-weight: 600; white-space: nowrap; }
        .fl-row label { display: flex; align-items: center; gap: 6px; cursor: pointer; }
        .fl-row input { accent-color: var(--fl-accent); margin: 0; }
        .fl-row a { color: inherit; font-style: italic; }
        .fl-dots { display: flex; justify-content: center; gap: 6px; }
        .fl-dots i { width: 7px; height: 7px; border-radius: 50%; background: #2c3532; }
        .fl-hero { display: flex; flex-direction: column; height: 100%; padding: 22px 30px 28px; color: #fff; }
        .fl-nav { display: flex; justify-content: flex-end; align-items: center; gap: clamp(14px, 3cqi, 36px); font-size: 10px; font-weight: 600; letter-spacing: .1em; }
        .fl-nav a { color: inherit; text-decoration: none; opacity: .92; white-space: nowrap; }
        .fl-nav a:hover { opacity: 1; text-decoration: underline; }
        .fl-signin { padding: 7px 18px; border-radius: 999px; background: var(--fl-accent); }
        .fl-burger { display: grid; gap: 3px; }
        .fl-burger i { width: 16px; height: 2px; background: #fff; }
        .fl-copy { margin-top: auto; text-align: right; }
        .fl-copy h1 { margin: 0 0 14px; font-size: clamp(36px, 7cqi, 64px); font-weight: 800; letter-spacing: -.02em; line-height: 1; text-shadow: 0 2px 20px rgba(0, 0, 0, .08); }
        .fl-copy p { margin: 0 0 0 auto; max-width: 240px; font-size: 10px; line-height: 1.5; opacity: .9; }
        .fl-copy .fl-join { margin-top: 26px; font-size: 11px; }
        .fl-copy .fl-join a { color: inherit; font-weight: 700; }
        @container (max-width: 640px) {
          .fl-card { grid-template-columns: 1fr; max-height: none; }
          .fl-hero { display: none; }
        }
      `}</style>
      <div className="fl-card">
        <aside className="fl-side">
          <div className="fl-brand">
            <span className="fl-logo"><i /><i /></span>
            <span>{brand}</span>
          </div>
          <form className="fl-form" onSubmit={(e) => e.preventDefault()}>
            <div className="fl-avatar"><UserGlyph size={38} stroke="#fff" width={1.8} /></div>
            <label className="fl-field">
              <UserGlyph />
              <input type="text" placeholder="Username" autoComplete="username" aria-label="Username" />
            </label>
            <label className="fl-field">
              <LockGlyph />
              <input type="password" placeholder="••••••••••" autoComplete="current-password" aria-label="Password" />
            </label>
            <button className="fl-login" type="submit">LOGIN</button>
            <div className="fl-row">
              <label><input type="checkbox" defaultChecked /> Remember me</label>
              <a href="#forgot" onClick={(e) => e.preventDefault()}>Forgot your password?</a>
            </div>
          </form>
          <div className="fl-dots" aria-hidden="true"><i /><i /><i /></div>
        </aside>
        <FluidGradient {...gradient} style={{ height: '100%' }}>
          <div className="fl-hero">
            <nav className="fl-nav">
              <a href="#about">ABOUT</a>
              <a href="#download">DOWNLOAD</a>
              <a href="#pricing">PRICING</a>
              <a href="#contact">CONTACT</a>
              <a href="#signin" className="fl-signin">SIGN IN</a>
              <span className="fl-burger" aria-hidden="true"><i /><i /><i /></span>
            </nav>
            <div className="fl-copy">
              <h1>{title}</h1>
              <p>Sign in to pick up where you left off. Your projects, drafts and saved palettes are waiting for you.</p>
              <p className="fl-join">Not a member? <a href="#signup">Sign up now</a></p>
            </div>
          </div>
        </FluidGradient>
      </div>
    </div>
  )
}

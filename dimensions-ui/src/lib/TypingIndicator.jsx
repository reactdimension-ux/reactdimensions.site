import { useEffect, useState } from 'react'

const WORDS = ['Thinking', 'Pondering', 'Brewing', 'Mulling']

export const TYPING_KINDS = [
  'dots', 'glyph', 'wave', 'orb', 'shimmer', 'words', 'pulse', 'orbit', 'bounce', 'cursor', 'blob', 'skeleton',
  'scribble', 'flicker', 'neural', 'sparkle', 'thought', 'ticks', 'helix', 'ripple', 'radar', 'eyes', 'morse', 'gears',
]
const GLYPHS = 'abcdefghijklmnopqrstuvwxyz{}<>/=;'
const MORSE = [1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1] // 1 is a dash, 0 a dot

// "The agent is typing": one small mark in any of twenty-four styles. Used on its own,
// or inside Chat Bubbles while a reply is on its way.
export default function TypingIndicator({
  kind = 'dots',
  bubble = true, // sit in a chat bubble, or stand alone
  color = '#e8e6e1',
  accent = '#d77757',
  background = '#2b2a28',
  scale = 1,
}) {
  const [w, setW] = useState(0)
  useEffect(() => {
    if (kind !== 'words') return
    const t = setInterval(() => setW((n) => (n + 1) % WORDS.length), 1100)
    return () => clearInterval(t)
  }, [kind])

  // flicker: faint random letters that stand in for the text on its way
  const [junk, setJunk] = useState('')
  useEffect(() => {
    if (kind !== 'flicker') return
    const roll = () => setJunk(Array.from({ length: 9 }, () => (Math.random() < 0.18 ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join(''))
    roll()
    const t = setInterval(roll, 90)
    return () => clearInterval(t)
  }, [kind])

  const dot = (d, extra) => <span key={d} style={{ width: 6, height: 6, borderRadius: '50%', background: color, ...extra }} />
  let mark
  switch (kind) {
    case 'glyph':
      mark = <span style={{ color: accent, display: 'inline-block', animation: 'ty-spin 1.6s linear infinite' }}>✻</span>
      break
    case 'wave':
      mark = (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, height: '1.1em' }}>
          {[0, 1, 2, 3, 4].map((d) => (
            <span key={d} style={{ width: 3, height: '100%', borderRadius: 2, background: color, animation: `ty-bar .9s ${d * 0.1}s ease-in-out infinite` }} />
          ))}
        </span>
      )
      break
    case 'orb':
      mark = <span style={{ width: 12, height: 12, borderRadius: '50%', background: accent, animation: 'ty-orb 1.4s ease-in-out infinite', '--ty-a': `${accent}33` }} />
      break
    case 'shimmer':
      mark = (
        <span style={{ display: 'grid', gap: 7, width: '10em' }}>
          {[100, 65].map((wd) => (
            <span key={wd} style={{ width: `${wd}%`, height: 8, borderRadius: 4, backgroundImage: `linear-gradient(90deg, ${color}22 30%, ${color}66 50%, ${color}22 70%)`, backgroundSize: '250% 100%', animation: 'ty-sweep 1.4s linear infinite' }} />
          ))}
        </span>
      )
      break
    case 'words':
      mark = (
        <span style={{ display: 'inline-flex', gap: '0.45em', color: accent, fontSize: '0.92em' }}>
          <span>✻</span>
          <span key={w} style={{ minWidth: '6.2em', animation: 'ty-in .3s ease-out' }}>
            {WORDS[w]}…
          </span>
        </span>
      )
      break
    case 'pulse':
      mark = dot(0, { width: 9, height: 9, animation: 'ty-pulse 1.2s ease-in-out infinite' })
      break
    case 'orbit':
      mark = (
        <span style={{ position: 'relative', width: 18, height: 18, display: 'inline-block', animation: 'ty-spin 1.2s linear infinite' }}>
          {[0, 1, 2].map((d) => (
            <span key={d} style={{ position: 'absolute', left: 6, top: 6, width: 6, height: 6, borderRadius: '50%', background: d ? color : accent, opacity: 1 - d * 0.3, transform: `rotate(${d * 120}deg) translateX(7px)` }} />
          ))}
        </span>
      )
      break
    case 'bounce':
      mark = (
        <span style={{ position: 'relative', width: 30, height: 16, display: 'inline-block' }}>
          <span style={{ position: 'absolute', bottom: 0, width: 8, height: 8, borderRadius: '50%', background: accent, animation: 'ty-hop 1.4s ease-in-out infinite' }} />
        </span>
      )
      break
    case 'cursor':
      mark = <span style={{ width: '0.55em', height: '1.05em', borderRadius: 2, background: accent, animation: 'ty-blink 1s step-end infinite' }} />
      break
    case 'blob':
      mark = <span style={{ width: 16, height: 16, background: `linear-gradient(135deg, ${accent}, ${color})`, animation: 'ty-blob 3s ease-in-out infinite' }} />
      break
    case 'skeleton':
      mark = (
        <span style={{ display: 'grid', gap: 6, width: '12em' }}>
          {[100, 90, 55].map((wd, i) => (
            <span key={i} style={{ width: `${wd}%`, height: 7, borderRadius: 4, background: color, animation: `ty-fade 1.4s ${i * 0.15}s ease-in-out infinite` }} />
          ))}
        </span>
      )
      break
    case 'scribble':
      // a pen line that draws itself, then erases
      mark = (
        <svg width="46" height="18" viewBox="0 0 46 18" fill="none" style={{ overflow: 'visible' }}>
          <path d="M2 12c4-9 7-9 8 0s5 6 8-2 6-7 7 1 5 6 9-3 5-4 10 1" stroke={accent} strokeWidth="2" strokeLinecap="round" pathLength="100" style={{ strokeDasharray: 100, animation: 'ty-draw 2s ease-in-out infinite' }} />
        </svg>
      )
      break
    case 'flicker':
      mark = <span style={{ font: '400 14px/1 ui-monospace, Menlo, monospace', color, opacity: 0.45, whiteSpace: 'pre', minWidth: '9ch' }}>{junk}</span>
      break
    case 'neural':
      // three nodes; light runs along the links between them
      mark = (
        <svg width="40" height="18" viewBox="0 0 40 18" style={{ overflow: 'visible' }}>
          <path d="M4 13L20 4L36 13" stroke={`${color}44`} strokeWidth="1.5" fill="none" />
          <path d="M4 13L20 4L36 13" stroke={accent} strokeWidth="2" fill="none" strokeLinecap="round" pathLength="100" style={{ strokeDasharray: '14 86', animation: 'ty-run 1.4s linear infinite' }} />
          {[[4, 13], [20, 4], [36, 13]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="3" fill={color} style={{ animation: `ty-node 1.4s ${i * 0.47}s ease-in-out infinite` }} />
          ))}
        </svg>
      )
      break
    case 'sparkle':
      mark = (
        <span style={{ position: 'relative', width: 34, height: 18, display: 'inline-block' }}>
          {[[2, 8, 0], [13, 0, 0.35], [24, 9, 0.7], [17, 12, 1.05]].map(([x, y, d], i) => (
            <span key={i} style={{ position: 'absolute', left: x, top: y, color: i % 2 ? color : accent, fontSize: 10, lineHeight: 1, animation: `ty-pop 1.4s ${d}s ease-in-out infinite` }}>
              ✦
            </span>
          ))}
        </span>
      )
      break
    case 'thought':
      // cartoon thought bubbles rising and fading
      mark = (
        <span style={{ position: 'relative', width: 28, height: 22, display: 'inline-block' }}>
          {[5, 8, 11].map((r, i) => (
            <span key={i} style={{ position: 'absolute', left: i * 8, bottom: 0, width: r, height: r, borderRadius: '50%', border: `1.5px solid ${color}`, animation: `ty-rise 1.8s ${i * 0.3}s ease-out infinite` }} />
          ))}
        </span>
      )
      break
    case 'ticks':
      // steps of a plan lighting one after another
      mark = (
        <span style={{ display: 'inline-flex', gap: 4 }}>
          {[0, 1, 2, 3, 4].map((d) => (
            <span key={d} style={{ width: 10, height: 4, borderRadius: 2, background: color, opacity: 0.2, animation: `ty-tick 2s ${d * 0.3}s ease-in-out infinite`, '--ty-c': accent }} />
          ))}
        </span>
      )
      break
    case 'helix':
      // two rows of dots passing over and under each other, like a strand of DNA
      mark = (
        <span style={{ display: 'inline-flex', gap: 3, height: 16, alignItems: 'center' }}>
          {[0, 1, 2, 3, 4, 5].map((d) => (
            <span key={d} style={{ position: 'relative', width: 5, height: 16 }}>
              <span style={{ position: 'absolute', left: 0, width: 5, height: 5, borderRadius: '50%', background: accent, animation: `ty-helix 1.4s ${-d * 0.18}s ease-in-out infinite` }} />
              <span style={{ position: 'absolute', left: 0, width: 5, height: 5, borderRadius: '50%', background: color, animation: `ty-helix 1.4s ${-d * 0.18 - 0.7}s ease-in-out infinite` }} />
            </span>
          ))}
        </span>
      )
      break
    case 'ripple':
      mark = (
        <span style={{ position: 'relative', width: 18, height: 18, display: 'inline-grid', placeItems: 'center' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent }} />
          {[0, 0.6].map((d) => (
            <span key={d} style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `1.5px solid ${accent}`, animation: `ty-ripple 1.2s ${d}s ease-out infinite` }} />
          ))}
        </span>
      )
      break
    case 'radar':
      mark = (
        <span style={{ position: 'relative', width: 18, height: 18, borderRadius: '50%', border: `1.5px solid ${color}55`, display: 'inline-block', overflow: 'hidden' }}>
          <span style={{ position: 'absolute', inset: 0, background: `conic-gradient(from 0deg, ${accent}cc, transparent 30%)`, animation: 'ty-spin 1.3s linear infinite' }} />
        </span>
      )
      break
    case 'eyes':
      // a pair of eyes that glance around and blink, as if reading
      mark = (
        <span style={{ display: 'inline-flex', gap: 5 }}>
          {[0, 1].map((d) => (
            <span key={d} style={{ width: 12, height: 12, borderRadius: '50%', background: color, display: 'grid', placeItems: 'center', animation: 'ty-lid 3.2s ease-in-out infinite' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#141414', animation: 'ty-look 3.2s ease-in-out infinite' }} />
            </span>
          ))}
        </span>
      )
      break
    case 'morse':
      mark = (
        <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
          {MORSE.map((m, i) => (
            <span key={i} style={{ width: m ? 10 : 4, height: 4, borderRadius: 2, background: color, opacity: 0.2, animation: `ty-tick 2.2s ${i * 0.12}s ease-in-out infinite`, '--ty-c': accent }} />
          ))}
        </span>
      )
      break
    case 'gears':
      mark = (
        <span style={{ position: 'relative', width: 30, height: 20, display: 'inline-block', color: accent }}>
          <span style={{ position: 'absolute', left: 0, top: 0, fontSize: 18, lineHeight: 1, animation: 'ty-spin 2.4s linear infinite' }}>⚙</span>
          <span style={{ position: 'absolute', left: 15, top: 7, fontSize: 13, lineHeight: 1, color, animation: 'ty-spin 1.6s linear infinite reverse' }}>⚙</span>
        </span>
      )
      break
    default:
      mark = <span style={{ display: 'inline-flex', gap: 4 }}>{[0, 1, 2].map((d) => dot(d, { animation: `ty-dot 1.1s ${d * 0.15}s ease-in-out infinite` }))}</span>
  }

  return (
    <span
      role="status"
      aria-label="Agent is typing"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: '1.1em',
        fontSize: 15,
        lineHeight: 1.2,
        fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
        ...(bubble ? { padding: '0.75em 0.85em', borderRadius: '14px 14px 14px 4px', background } : {}),
        // zoom scales the pixel-sized dots and bars too, not just the text
        zoom: scale,
      }}
    >
      <style>{`
        @keyframes ty-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
        @keyframes ty-dot{0%,60%,100%{opacity:.25;transform:none}30%{opacity:1;transform:translateY(-3px)}}
        @keyframes ty-spin{to{transform:rotate(360deg)}}
        @keyframes ty-bar{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}}
        @keyframes ty-orb{0%,100%{transform:scale(.75);box-shadow:0 0 0 0 transparent}50%{transform:scale(1);box-shadow:0 0 0 6px var(--ty-a)}}
        @keyframes ty-sweep{from{background-position:130% 0}to{background-position:-30% 0}}
        @keyframes ty-pulse{0%,100%{transform:scale(.6);opacity:.4}50%{transform:scale(1.15);opacity:1}}
        @keyframes ty-hop{0%,100%{left:0;transform:translateY(0)}25%{transform:translateY(-8px)}50%{left:22px;transform:translateY(0)}75%{transform:translateY(-8px)}}
        @keyframes ty-blink{0%,50%{opacity:1}51%,100%{opacity:0}}
        @keyframes ty-blob{0%,100%{border-radius:42% 58% 63% 37%/45% 40% 60% 55%;transform:rotate(0)}50%{border-radius:60% 40% 35% 65%/55% 62% 38% 45%;transform:rotate(180deg)}}
        @keyframes ty-draw{0%{stroke-dashoffset:100}45%,55%{stroke-dashoffset:0}100%{stroke-dashoffset:-100}}
        @keyframes ty-run{from{stroke-dashoffset:100}to{stroke-dashoffset:0}}
        @keyframes ty-node{0%,100%{opacity:.45}30%{opacity:1}}
        @keyframes ty-pop{0%,100%{transform:scale(0) rotate(0);opacity:0}40%{transform:scale(1.2) rotate(45deg);opacity:1}70%{transform:scale(.8) rotate(90deg);opacity:.6}}
        @keyframes ty-rise{0%{transform:translateY(4px) scale(.4);opacity:0}30%{opacity:1}100%{transform:translateY(-10px) scale(1);opacity:0}}
        @keyframes ty-tick{0%,15%{opacity:.2}30%,70%{opacity:1;background:var(--ty-c)}100%{opacity:.2}}
        @keyframes ty-helix{0%,100%{top:0;transform:scale(.7);z-index:0}50%{top:11px;transform:scale(1.1);z-index:1}}
        @keyframes ty-ripple{from{transform:scale(.3);opacity:1}to{transform:scale(1.4);opacity:0}}
        @keyframes ty-lid{0%,44%,50%,100%{transform:scaleY(1)}47%{transform:scaleY(.1)}}
        @keyframes ty-look{0%,20%{transform:translate(0,0)}30%,45%{transform:translate(-3px,1px)}60%,80%{transform:translate(3px,-1px)}90%,100%{transform:translate(0,0)}}
        @keyframes ty-fade{0%,100%{opacity:.12}50%{opacity:.35}}
        @media (prefers-reduced-motion:reduce){[aria-label="Agent is typing"] *{animation:none!important}}
      `}</style>
      {mark}
    </span>
  )
}

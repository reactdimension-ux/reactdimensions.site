// Tennis ball sounds made in the browser, no audio files. A tennis ball is a
// small pressurised rubber core, so a bounce is the familiar hollow "pok": a
// short, fairly high ring from the air inside, plus a soft scuff of felt on
// the court. A racket hit is a crisper "thock" with the strings' ping on
// top. Louder for harder hits.

export function createBallAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  const ctx = new Ctx()
  const out = ctx.createGain()
  out.gain.value = 0.8
  out.connect(ctx.destination)
  const len = Math.floor(ctx.sampleRate * 0.1)
  const noise = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = noise.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1

  const tone = (f0, f1, decay, gain, t) => {
    const o = ctx.createOscillator()
    o.frequency.setValueAtTime(f0, t)
    o.frequency.exponentialRampToValueAtTime(f1, t + decay)
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
    o.connect(g).connect(out)
    o.start(t)
    o.stop(t + decay + 0.02)
  }
  const scuff = (freq, gain, decay, t) => {
    const n = ctx.createBufferSource()
    n.buffer = noise
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = freq
    f.Q.value = 0.9
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
    n.connect(f).connect(g).connect(out)
    n.start(t)
    n.stop(t + decay + 0.01)
  }
  const now = () => {
    if (ctx.state === 'suspended') ctx.resume()
    return ctx.currentTime
  }
  return {
    bounce(strength = 1, kind = 'floor') {
      const s = Math.min(1, strength)
      const t = now()
      tone(kind === 'floor' ? 620 : 700, 380, 0.07, 0.45 * s, t)
      scuff(kind === 'floor' ? 1800 : 2400, 0.35 * s, 0.04, t)
    },
    hit(strength = 1) {
      const s = Math.min(1, strength)
      const t = now()
      tone(520, 300, 0.06, 0.6 * s, t)
      tone(1250, 1100, 0.12, 0.12 * s, t)
      scuff(3000, 0.5 * s, 0.03, t)
    },
    dispose() {
      ctx.close()
    },
  }
}

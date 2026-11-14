// Bowling machine sounds made in the browser, no audio files: the motor's
// whine (its pitch follows the wheel's speed, and dips as each ball takes
// energy out of it), the slap of the ball being flung, the rattle of balls
// shuffling down the hopper, and bounces that sound different for a felt
// tennis ball and a leather cricket ball.

export function createBowlerAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  const ctx = new Ctx()
  const out = ctx.createGain()
  out.gain.value = 0.7
  out.connect(ctx.destination)
  const len = Math.floor(ctx.sampleRate * 0.6)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1

  // the motor: a buzzy fundamental, its harmonics, and fan noise
  const motorGain = ctx.createGain()
  motorGain.gain.value = 0
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 1800
  const o1 = ctx.createOscillator()
  o1.type = 'sawtooth'
  const o2 = ctx.createOscillator()
  o2.type = 'triangle'
  const g2 = ctx.createGain()
  g2.gain.value = 0.5
  o1.connect(lp)
  o2.connect(g2).connect(lp)
  const fan = ctx.createBufferSource()
  fan.buffer = buf
  fan.loop = true
  const fanF = ctx.createBiquadFilter()
  fanF.type = 'bandpass'
  fanF.Q.value = 0.8
  const fanG = ctx.createGain()
  fanG.gain.value = 0.35
  fan.connect(fanF).connect(fanG).connect(lp)
  lp.connect(motorGain).connect(out)
  o1.start()
  o2.start()
  fan.start()

  const noise = (freq, q, decay, gain, at = 0, type = 'bandpass') => {
    const t = ctx.currentTime + at
    const src = ctx.createBufferSource()
    src.buffer = buf
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq * (0.92 + Math.random() * 0.16)
    f.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay * 4)
    src.connect(f).connect(g).connect(out)
    src.start(t, Math.random() * 0.3)
    src.stop(t + decay * 4 + 0.02)
  }
  const tone = (freq, decay, gain, at = 0) => {
    const t = ctx.currentTime + at
    const o = ctx.createOscillator()
    o.frequency.value = freq
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
    o.connect(g).connect(out)
    o.start(t)
    o.stop(t + decay + 0.02)
  }
  const wake = () => {
    if (ctx.state === 'suspended') ctx.resume()
  }
  const k = (s) => Math.min(1, Math.max(0.05, s))

  return {
    // rpm of the wheel; 0 switches the motor off
    motor(rpm) {
      const t = ctx.currentTime
      const f = Math.max(20, rpm / 60) // shaft frequency
      o1.frequency.setTargetAtTime(f, t, 0.05)
      o2.frequency.setTargetAtTime(f * 2.01, t, 0.05)
      fanF.frequency.setTargetAtTime(400 + f * 6, t, 0.05)
      motorGain.gain.setTargetAtTime(rpm > 30 ? 0.05 + Math.min(0.08, rpm / 40000) : 0, t, 0.08)
    },
    // the wheel slapping the ball out
    launch(s = 1) {
      wake()
      s = k(s)
      noise(1700, 1.2, 0.012, 0.6 * s)
      tone(260, 0.07, 0.15 * s)
    },
    // a ball dropping down the feed
    clack(s = 1) {
      wake()
      noise(2600, 3, 0.006, 0.18 * k(s))
    },
    bounce(s = 1, kind = 'tennis') {
      wake()
      s = k(s)
      if (kind === 'tennis') {
        noise(520, 1, 0.025, 0.45 * s)
        tone(190, 0.06, 0.08 * s)
      } else {
        noise(300, 0.8, 0.03, 0.5 * s, 0, 'lowpass')
        tone(140, 0.08, 0.1 * s)
      }
    },
    net(s = 1) {
      wake()
      noise(900, 0.6, 0.05, 0.2 * k(s))
    },
    start: wake,
    dispose() {
      ctx.close()
    },
  }
}
